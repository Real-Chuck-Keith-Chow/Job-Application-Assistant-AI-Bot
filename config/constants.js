"use strict";

module.exports = {
  // ---- Browser / Puppeteer ----
  BROWSER: {
    WINDOW_SIZE: process.env.WINDOW_SIZE || "1200,1000",
    NAV_TIMEOUT_MS: Number(process.env.NAV_TIMEOUT_MS) || 60000,
    ACTION_TIMEOUT_MS: Number(process.env.ACTION_TIMEOUT_MS) || 30000,
    HEADLESS: process.env.PUPPETEER_HEADLESS || "auto", // resolved later
  },

  // ---- Workday Parsing ----
  WORKDAY: {
    WAIT_UNTIL: "networkidle2",
    PAGE_TIMEOUT_MS: 45000,

    SELECTORS: {
      COOKIE_ACCEPT: '[data-automation-id="cookieBannerAcceptButton"]',
      FORM_SECTION: '[data-automation-id="formSection"]',
      QUESTION_TEXT: '[data-automation-id="questionText"]',
      FIELD_LABEL: '[data-automation-id="fieldLabel"]',
      QUESTION_CONTAINER_PREFIX: '[data-automation-id^="question-"]',
    },
  },

  // ---- Backend Cache ----
  CACHE: {
    COLLECTION: "answers",
  },

  // ---- Logging ----
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || "info",
  },

  // ---- Misc ----
  APP: {
    NAME: "job-application-assistant",
  },
};

