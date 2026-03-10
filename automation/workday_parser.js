"use strict";

const BrowserLauncher = require("./browser_launcher");
const logger = require("../utils/logger");

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
      await this._waitForQuestions(page, questionTextSelector);

      const sectionIds = await this._extractSectionIds(page, sectionSelector);
      const questions = await this._extractQuestions(page, sectionIds, questionTextSelector);

      return { success: true, questions };
    } catch (error) {
      logger.error(`Workday parsing failed: ${error.message}`);

      await page
        .screenshot({
          path: `${errorScreenshotPrefix}-${Date.now()}.png`,
          fullPage: true,
        })
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
      .catch(() => {});
  }

  static async _waitForQuestions(page, selector) {
    await page.waitForSelector(selector, { timeout: 10000 }).catch(() => {});
  }

  static async _extractSectionIds(page, selector) {
    return page.$$eval(selector, (sections) =>
      sections.map((section) => section.id).filter(Boolean)
    );
  }

  static async _extractQuestions(page, sectionIds, questionTextSelector) {
    const questions = [];

    for (const sectionId of sectionIds) {
      const rows = await page.evaluate(
        ({ sectionId, questionSelector }) => {
          const section = document.getElementById(sectionId);
          if (!section) return [];

          const buildSelector = (element) => {
            if (!element) return null;

            const tag = element.tagName.toLowerCase();

            if (element.id) {
              return `#${CSS.escape(element.id)}`;
            }

            const automationId = element.getAttribute("data-automation-id");
            if (automationId) {
              return `${tag}[data-automation-id="${CSS.escape(automationId)}"]`;
            }

            const name = element.getAttribute("name");
            if (name) {
              return `${tag}[name="${CSS.escape(name)}"]`;
            }

            return tag;
          };

          const pickField = (container) => {
            const field =
              container?.querySelector("textarea") ||
              container?.querySelector("input[type='text']") ||
              container?.querySelector("input:not([type])") ||
              container?.querySelector("select");

            if (!field) {
              return { fieldSelector: null, fieldTag: null };
            }

            return {
              fieldSelector: buildSelector(field),
              fieldTag: field.tagName.toLowerCase(),
            };
          };

          const deriveType = (automationId) => {
            if (!automationId) return "text";

            const parts = automationId.split("-");
            return parts.length > 1 ? parts.slice(1).join("-") : automationId;
          };

          return Array.from(section.querySelectorAll(questionSelector))
            .map((questionNode) => {
              const text = (questionNode?.innerText || "").trim();
              if (!text) return null;

              const container = questionNode.closest('[data-automation-id^="question-"]');
              if (!container?.id) return null;

              const automationId = container.dataset?.automationId || "";
              const labelNode = container.querySelector(
                '[data-automation-id="fieldLabel"]'
              );
              const label = labelNode?.innerText?.trim() || null;

              const { fieldSelector, fieldTag } = pickField(container);

              return {
                text,
                label,
                type: deriveType(automationId),
                containerId: container.id,
                fieldSelector,
                fieldTag,
              };
            })
            .filter(Boolean);
        },
        { sectionId, questionSelector: questionTextSelector }
      );

      questions.push(...rows);
    }

    return questions;
  }
}

module.exports = WorkdayParser;
