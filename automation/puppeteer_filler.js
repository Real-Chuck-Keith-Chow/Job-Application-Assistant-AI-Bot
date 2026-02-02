"use strict";

const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");
const BrowserLauncher = require("./browser_launcher");

// Keep your existing matcher import style
// (Adjust if your project exports it differently)
const { match_question } = require("../ai/question_matcher");

const DEFAULTS = {
  dryRun: true, // SAFETY: don't submit unless explicitly set false
  navigationTimeoutMs: 60000,
  actionTimeoutMs: 30000,
  questionTextSelector: '[data-qa="question-text"]',
  submitSelector: '[data-qa="submit-application"]',
  screenshotDir: "screenshots",
  waitUntil: "networkidle2",
  typingDelayMs: 20,
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

/**
 * Attempt to extract questions and their *nearest* answer field.
 * Returns: [{ text, fieldSelector, fieldTag }]
 *
 * This tries (in order):
 * - textarea / input[type=text] / input (no type) / select within a nearby container
 * - falls back to null if no field found
 */
async function extractQuestions(page, options = {}) {
  const { questionTextSelector } = { ...DEFAULTS, ...options };

  return page.$$eval(questionTextSelector, (nodes) => {
    const pickField = (container) => {
      if (!container) return null;

      // Prefer text areas first (common for "Why us?" etc), then inputs, then select
      const field =
        container.querySelector("textarea") ||
        container.querySelector("input[type='text']") ||
        container.querySelector("input:not([type])") ||
        container.querySelector("select");

      if (!field) return null;

      // Build a best-effort selector (id preferred)
      // CSS.escape exists in the browser context
      const tag = field.tagName.toLowerCase();

      if (field.id) {
        return { selector: `#${CSS.escape(field.id)}`, tag };
      }

      // Try stable attributes
      const name = field.getAttribute("name");
      if (name) {
        return { selector: `${tag}[name="${CSS.escape(name)}"]`, tag };
      }

      const aria = field.getAttribute("aria-label");
      if (aria) {
        return { selector: `${tag}[aria-label="${CSS.escape(aria)}"]`, tag };
      }

      const dataQa = field.getAttribute("data-qa");
      if (dataQa) {
        return { selector: `${tag}[data-qa="${CSS.escape(dataQa)}"]`, tag };
      }

      // Last resort: tag-only (may match multiple)
      return { selector: tag, tag };
    };

    return nodes
      .map((q) => {
        const text = (q.innerText || "").trim();
        if (!text) return null;

        // Try to find a reasonable container around the question
        const container =
          q.closest('[data-qa="question"]') ||
          q.closest(".question-container") ||
          q.closest("fieldset") ||
          q.closest("form") ||
          q.parentElement;

        const picked = pickField(container);

        return {
          text,
          fieldSelector: picked ? picked.selector : null,
          fieldTag: picked ? picked.tag : null,
        };
      })
      .filter(Boolean);
  });
}

async function safeClearAndType(page, selector, value, typingDelayMs) {
  await page.waitForSelector(selector, { visible: true, timeout: 5000 });

  // Scroll into view for reliability
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center" }));

  // Click 3x + backspace to clear (works across many sites)
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");

  if (value) {
    await page.type(selector, value, { delay: typingDelayMs });
  }
}

async function safeSelect(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 5000 });
  await page.$eval(selector, (el) => el.scrollIntoView({ block: "center" }));

  // Try to select by value; if it fails, try by label text
  const didSelect = await page.evaluate(
    ({ selector, value }) => {
      const el = document.querySelector(selector);
      if (!el || el.tagName.toLowerCase() !== "select") return false;

      // 1) Try direct value match
      const optByValue = Array.from(el.options).find((o) => o.value === value);
      if (optByValue) {
        el.value = optByValue.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      // 2) Try label text match (case-insensitive)
      const v = String(value || "").trim().toLowerCase();
      const optByLabel = Array.from(el.options).find(
        (o) => (o.textContent || "").trim().toLowerCase() === v
      );
      if (optByLabel) {
        el.value = optByLabel.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      return false;
    },
    { selector, value }
  );

  if (!didSelect) {
    throw new Error(`Unable to select option "${value}" for ${selector}`);
  }
}

/**
 * Fill the extracted questions using your matcher.
 * Won't crash the run if one question fails.
 */
async function populateAnswers(page, questions, options = {}) {
  const { typingDelayMs } = { ...DEFAULTS, ...options };

  for (const q of questions) {
    const label = (q.text || "").slice(0, 120);

    if (!q.fieldSelector) {
      logger.warn(`No field found for question: "${label}"`);
      continue;
    }

    try {
      const answer = await match_question(q.text);

      // Some matchers return structured objects; normalize to string if needed
      const answerText =
        typeof answer === "string" ? answer : (answer?.answer ?? "").toString();

      if (!answerText) {
        logger.warn(`Empty answer for question: "${label}"`);
        continue;
      }

      if (q.fieldTag === "select") {
        await safeSelect(page, q.fieldSelector, answerText);
      } else {
        await safeClearAndType(page, q.fieldSelector, answerText, typingDelayMs);
      }

      logger.info(`Answered: "${label}"`);
    } catch (err) {
      logger.error(`Failed answering: "${label}" -> ${err.message}`);
    }
  }
}

/**
 * Submit the application (optional).
 */
async function submitApplication(page, options = {}) {
  const { submitSelector, waitUntil } = { ...DEFAULTS, ...options };

  await page.waitForSelector(submitSelector, { visible: true, timeout: 15000 });
  await page.click(submitSelector);

  // Wait for some kind of navigation/settle
  try {
    await page.waitForNavigation({ waitUntil, timeout: 60000 });
  } catch (_) {
    // Some sites submit via XHR and don't navigate
  }
}

/**
 * Main flow.
 */
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
      logger.info("Dry run enabled: skipping submit");
      const fp = path.join(cfg.screenshotDir, `dryrun_${stamp()}.png`);
      await page.screenshot({ path: fp, fullPage: true });
      logger.info(`Saved dry-run screenshot: ${fp}`);
    } else {
      await submitApplication(page, cfg);
      logger.info("Application submitted (submit step executed)");
      const fp = path.join(cfg.screenshotDir, `submitted_${stamp()}.png`);
      await page.screenshot({ path: fp, fullPage: true });
      logger.info(`Saved submit screenshot: ${fp}`);
    }
  } catch (error) {
    logger.error(`Application flow failed: ${error.message}`);

    const fp = path.join(cfg.screenshotDir, `error_${stamp()}.png`);
    try {
      await page.screenshot({ path: fp, fullPage: true });
      logger.info(`Saved error screenshot: ${fp}`);
    } catch (_) {
      // ignore screenshot failures
    }

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
