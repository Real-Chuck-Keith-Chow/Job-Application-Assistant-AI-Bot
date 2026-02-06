"use strict";

const BrowserLauncher = require("./browser_launcher");
const logger = require("../utils/logger");

class WorkdayParser {
  static _stamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
      d.getHours()
    )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  }

  /**
   * Parse a Workday job application page and extract questions + field selectors.
   *
   * @param {string} jobUrl
   * @param {object} options
   * @returns {Promise<{success: boolean, questions?: any[], error?: string}>}
   */
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

      // Workday pages sometimes render question content after initial load.
      // Waiting briefly for question text to appear improves reliability.
      try {
        await page.waitForSelector(questionTextSelector, { timeout: 10000 });
      } catch (_) {
        logger.debug("No question text selector found quickly; continuing anyway");
      }

      const sections = await this._extractFormSections(page, sectionSelector);
      const questions = await this._extractQuestions(page, sections, questionTextSelector);

      return { success: true, questions };
    } catch (error) {
      logger.error(`Workday parsing failed: ${error.message}`);

      try {
        await page.screenshot({
          path: `${errorScreenshotPrefix}-${this._stamp()}.png`,
          fullPage: true,
        });
      } catch (_) {
        // ignore screenshot failures
      }

      return { success: false, error: error.message };
    } finally {
      await BrowserLauncher.close(browser);
    }
  }

  static async _dismissCookies(page, cookieAcceptSelector) {
    try {
      await page.waitForSelector(cookieAcceptSelector, { timeout: 5000 });
      await page.click(cookieAcceptSelector);
    } catch (_) {
      logger.debug("No cookie banner found");
    }
  }

  static async _extractFormSections(page, sectionSelector) {
    return page.evaluate((selector) => {
      return Array.from(document.querySelectorAll(selector))
        .map((section) => section?.id)
        .filter(Boolean);
    }, sectionSelector);
  }

  static async _extractQuestions(page, sectionIds, questionTextSelector) {
    const questions = [];

    for (const sectionId of sectionIds) {
      const sectionQuestions = await page.evaluate(
        ({ id, qSel }) => {
          const section = document.getElementById(id);
          if (!section) return [];

          const buildSelector = (el) => {
            if (!el) return null;
            const tag = el.tagName.toLowerCase();

            // Prefer stable selectors
            if (el.id) return `#${CSS.escape(el.id)}`;

            const name = el.getAttribute("name");
            if (name) return `${tag}[name="${CSS.escape(name)}"]`;

            const aria = el.getAttribute("aria-label");
            if (aria) return `${tag}[aria-label="${CSS.escape(aria)}"]`;

            const dataQa = el.getAttribute("data-qa");
            if (dataQa) return `${tag}[data-qa="${CSS.escape(dataQa)}"]`;

            const dataAid = el.getAttribute("data-automation-id");
            if (dataAid) return `${tag}[data-automation-id="${CSS.escape(dataAid)}"]`;

            // Last resort: just the tag (may match multiple)
            return tag;
          };

          const pickField = (container) => {
            if (!container) return { fieldSelector: null, fieldTag: null };

            // Workday tends to use these fields in question containers
            const field =
              container.querySelector("textarea") ||
              container.querySelector("input[type='text']") ||
              container.querySelector("input:not([type])") ||
              container.querySelector("select");

            if (!field) return { fieldSelector: null, fieldTag: null };

            return {
              fieldSelector: buildSelector(field),
              fieldTag: field.tagName.toLowerCase(),
            };
          };

          const nodes = Array.from(section.querySelectorAll(qSel));

          return nodes
            .map((q) => {
              const text = (q?.innerText || "").trim();
              if (!text) return null;

              // IMPORTANT: prefix match, not equals match
              const container = q.closest('[data-automation-id^="question-"]');
              const aid = container?.dataset?.automationId || "";

              // Derive a "type" from the automation-id when possible
              let type = "text";
              if (aid) {
                type = aid.includes("-") ? aid.split("-").slice(1).join("-") || "text" : aid;
              }

              // Try to grab a stable label too (helps debugging)
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
        { id: sectionId, qSel: questionTextSelector }
      );

      questions.push(...sectionQuestions);
    }

    // Keep only entries that are usable (at least has question text + a container)
    return questions.filter((q) => q.text && q.containerId);
  }
}

module.exports = WorkdayParser;
