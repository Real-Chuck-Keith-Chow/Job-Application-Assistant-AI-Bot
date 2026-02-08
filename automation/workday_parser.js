
"use strict";

const BrowserLauncher = require("./browser_launcher");
const logger = require("../utils/logger");

const STAMP = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(
    d.getMinutes()
  )}-${pad(d.getSeconds())}`;
};

class WorkdayParser {
  static async parse(jobUrl, options = {}) {
    const {
      waitUntil = "networkidle2",
      timeoutMs = 45000,
      cookieAcceptSelector = '[data-automation-id="cookieBannerAcceptButton"]',
      sectionSelector = '[data-automation-id="formSection"]',
      questionTextSelector = '[data-automation-id="questionText"]',
      errorScreenshotPrefix = "workday-error",
      launchOptions = {},
    } = options;

    const browser = await BrowserLauncher.launch(launchOptions);
    const page = await BrowserLauncher.newPage(browser);

    try {
      await page.goto(jobUrl, { waitUntil, timeout: timeoutMs });

      await this._dismissCookies(page, cookieAcceptSelector);

      // best-effort: don’t fail if questions render late
      await page.waitForSelector(questionTextSelector, { timeout: 10000 }).catch(() => {});

      const sectionIds = await this._extractSectionIds(page, sectionSelector);
      const questions = await this._extractQuestions(page, sectionIds, questionTextSelector);

      return { success: true, questions };
    } catch (error) {
      logger.error(`Workday parsing failed: ${error.message}`);

      await page
        .screenshot({ path: `${errorScreenshotPrefix}-${STAMP()}.png`, fullPage: true })
        .catch(() => {});

      return { success: false, error: error.message };
    } finally {
      await BrowserLauncher.close(browser);
    }
  }

  static async _dismissCookies(page, selector) {
    await page
      .waitForSelector(selector, { timeout: 5000 })
      .then(() => page.click(selector))
      .catch(() => logger.debug("No cookie banner found"));
  }

  static async _extractSectionIds(page, selector) {
    return page.$$eval(selector, (sections) => sections.map((s) => s.id).filter(Boolean));
  }

  static async _extractQuestions(page, sectionIds, questionTextSelector) {
    const out = [];

    for (const id of sectionIds) {
      const rows = await page.evaluate(
        ({ id, qSel }) => {
          const section = document.getElementById(id);
          if (!section) return [];

          const buildSelector = (el) => {
            if (!el) return null;
            const tag = el.tagName.toLowerCase();

            if (el.id) return `#${CSS.escape(el.id)}`;

            const attrs = [
              ["name", "name"],
              ["aria-label", "aria-label"],
              ["data-qa", "data-qa"],
              ["data-automation-id", "data-automation-id"],
            ];

            for (const [attr, key] of attrs) {
              const val = el.getAttribute(attr);
              if (val) return `${tag}[${key}="${CSS.escape(val)}"]`;
            }

            return tag;
          };

          const pickField = (container) => {
            if (!container) return { fieldSelector: null, fieldTag: null };

            const field =
              container.querySelector("textarea") ||
              container.querySelector("input[type='text']") ||
              container.querySelector("input:not([type])") ||
              container.querySelector("select");

            return field
              ? { fieldSelector: buildSelector(field), fieldTag: field.tagName.toLowerCase() }
              : { fieldSelector: null, fieldTag: null };
          };

          return Array.from(section.querySelectorAll(qSel))
            .map((q) => {
              const text = (q?.innerText || "").trim();
              if (!text) return null;

              const container = q.closest('[data-automation-id^="question-"]');
              const aid = container?.dataset?.automationId || "";

              const type = aid
                ? aid.includes("-")
                  ? aid.split("-").slice(1).join("-") || "text"
                  : aid
                : "text";

              const label =
                (container?.querySelector('[data-automation-id="fieldLabel"]')?.innerText || "")
                  .trim() || null;

              const { fieldSelector, fieldTag } = pickField(container);

              return {
                text,
                label,
                type,
                containerId: container?.id || null,
                fieldSelector,
                fieldTag,
              };
            })
            .filter(Boolean);
        },
        { id, qSel: questionTextSelector }
      );

      out.push(...rows);
    }

    return out.filter((q) => q.text && q.containerId);
  }
}

module.exports = WorkdayParser;
