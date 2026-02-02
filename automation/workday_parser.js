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
   * Parse a Workday job application page and extract questions.
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

  /**
   * Extract Workday questions from the given section IDs.
   * Fixes:
   * - uses prefix match for question container: [data-automation-id^="question-"]
   * - null-safe access to closest() results to avoid crashes in page context
   */
  static async _extractQuestions(page, sectionIds, questionTextSelector) {
    const questions = [];

    for (const sectionId of sectionIds) {
      const sectionQuestions = await page.evaluate(
        ({ id, qSel }) => {
          const section = document.getElementById(id);
          if (!section) return [];

          const nodes = Array.from(section.querySelectorAll(qSel));

          return nodes
            .map((q) => {
              const text = (q?.innerText || "").trim();
              if (!text) return null;

              // IMPORTANT: prefix match, not equals match
              const container = q.closest('[data-automation-id^="question-"]');
              const aid = container?.dataset?.automationId || "";

              // Derive a "type" from the automation-id when possible
              // e.g. "question-text" -> "text"
              let type = "text";
              if (aid) {
                if (aid.includes("-")) {
                  type = aid.split("-").slice(1).join("-") || "text";
                } else {
                  // sometimes Workday uses non-hyphen ids
                  type = aid;
                }
              }

              return {
                text,
                type,
                containerId: container?.id || null,
              };
            })
            .filter(Boolean);
        },
        { id: sectionId, qSel: questionTextSelector }
      );

      questions.push(...sectionQuestions);
    }

    // Keep only entries that are usable
    return questions.filter((q) => q.text && q.containerId);
  }
}

module.exports = WorkdayParser;

