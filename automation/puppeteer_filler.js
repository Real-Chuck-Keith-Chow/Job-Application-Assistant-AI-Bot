"use strict";

const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");
const BrowserLauncher = require("./browser_launcher");
const { match_question } = require("../ai/question_matcher");

const DEFAULTS = {
  dryRun: true, // safety: don't submit unless explicitly false
  navigationTimeoutMs: 60000,
  actionTimeoutMs: 30000,
  waitUntil: "networkidle2",
  typingDelayMs: 20,

  questionTextSelector: '[data-qa="question-text"]',
  submitSelector: '[data-qa="submit-application"]',
  screenshotDir: "screenshots",
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function saveScreenshot(page, dir, prefix) {
  const fp = path.join(dir, `${prefix}_${Date.now()}.png`);
  await page.screenshot({ path: fp, fullPage: true }).catch(() => {});
  return fp;
}

async function extractQuestions(page, options = {}) {
  const { questionTextSelector } = { ...DEFAULTS, ...options };

  return page.$$eval(questionTextSelector, (nodes) => {
    const buildSelector = (el) => {
      if (!el) return null;
      const tag = el.tagName.toLowerCase();
      if (el.id) return `#${CSS.escape(el.id)}`;

      const dataQa = el.getAttribute("data-qa");
      if (dataQa) return `${tag}[data-qa="${CSS.escape(dataQa)}"]`;

      const name = el.getAttribute("name");
      if (name) return `${tag}[name="${CSS.escape(name)}"]`;

      return tag;
    };

    const pickField = (container) => {
      const field =
        container?.querySelector("textarea") ||
        container?.querySelector("input[type='text']") ||
        container?.querySelector("input:not([type])") ||
        container?.querySelector("select");

      return field
        ? { fieldSelector: buildSelector(field), fieldTag: field.tagName.toLowerCase() }
        : { fieldSelector: null, fieldTag: null };
    };

    return nodes
      .map((q) => {
        const text = (q.innerText || "").trim();
        if (!text) return null;

        const container = q.closest('[data-qa="question"]') || q.closest("fieldset") || q.parentElement;
        const { fieldSelector, fieldTag } = pickField(container);

        return { text, fieldSelector, fieldTag };
      })
      .filter(Boolean);
  });
}

async function safeClearAndType(page, selector, value, delay) {
  await page.waitForSelector(selector, { visible: true, timeout: 5000 });
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center" }));
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  if (value) await page.type(selector, value, { delay });
}

async function safeSelect(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 5000 });
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center" }));

  const ok = await page.evaluate(
    ({ selector, value }) => {
      const el = document.querySelector(selector);
      if (!el || el.tagName.toLowerCase() !== "select") return false;

      const v = String(value ?? "").trim().toLowerCase();
      const opt =
        Array.from(el.options).find((o) => o.value === value) ||
        Array.from(el.options).find((o) => (o.textContent || "").trim().toLowerCase() === v);

      if (!opt) return false;

      el.value = opt.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { selector, value }
  );

  if (!ok) throw new Error(`Unable to select "${value}" for ${selector}`);
}

async function populateAnswers(page, questions, options = {}) {
  const { typingDelayMs } = { ...DEFAULTS, ...options };

  for (const q of questions) {
    const label = (q.text || "").slice(0, 120);

    if (!q.fieldSelector) {
      logger.warn(`No field found: "${label}"`);
      continue;
    }

    try {
      const matched = await match_question(q.text);
      const answerText =
        typeof matched === "string" ? matched : String(matched?.answer ?? "").trim();

      if (!answerText) {
        logger.warn(`No match/empty answer: "${label}"`);
        continue;
      }

      if (q.fieldTag === "select") {
        await safeSelect(page, q.fieldSelector, answerText);
      } else {
        await safeClearAndType(page, q.fieldSelector, answerText, typingDelayMs);
      }

      logger.info(`Answered: "${label}"`);
    } catch (err) {
      logger.error(`Answer failed: "${label}" -> ${err.message}`);
    }
  }
}

async function submitApplication(page, options = {}) {
  const { submitSelector, waitUntil } = { ...DEFAULTS, ...options };

  await page.waitForSelector(submitSelector, { visible: true, timeout: 15000 });
  await page.click(submitSelector);

  await page.waitForNavigation({ waitUntil, timeout: 60000 }).catch(() => {});
}

async function fillApplication(jobUrl, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  ensureDir(cfg.screenshotDir);

  const browser = await BrowserLauncher.launch(cfg.launchOptions || {});
  const page = await BrowserLauncher.newPage(browser);

  try {
    await page.setDefaultNavigationTimeout(cfg.navigationTimeoutMs);
    await page.setDefaultTimeout(cfg.actionTimeoutMs);

    logger.info(`Opening: ${jobUrl}`);
    await page.goto(jobUrl, { waitUntil: cfg.waitUntil, timeout: cfg.navigationTimeoutMs });

    const questions = await extractQuestions(page, cfg);
    logger.info(`Found ${questions.length} question(s)`);

    await populateAnswers(page, questions, cfg);

    if (cfg.dryRun) {
      const fp = await saveScreenshot(page, cfg.screenshotDir, "dryrun");
      logger.info(`Dry run: skipped submit, saved ${fp}`);
      return { success: true, dryRun: true, questionsFound: questions.length };
    }

    await submitApplication(page, cfg);
    const fp = await saveScreenshot(page, cfg.screenshotDir, "submitted");
    logger.info(`Submitted: saved ${fp}`);

    return { success: true, dryRun: false, questionsFound: questions.length };
  } catch (error) {
    logger.error(`Application flow failed: ${error.message}`);
    await saveScreenshot(page, cfg.screenshotDir, "error");
    throw error;
  } finally {
    await BrowserLauncher.close(browser);
  }
}

module.exports = {
  fillApplication,
  extractQuestions,
  populateAnswers,
  submitApplication,
};
