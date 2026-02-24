"use strict";

/**
 * Centralized runtime configuration.
 * All environment-driven behavior should flow through here.
 */

const isCI = process.env.CI === "true";
const isTest = process.env.NODE_ENV === "test";

function num(env, fallback) {
  const parsed = Number(process.env[env]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(env, fallback) {
  const val = process.env[env];
  if (val === undefined) return fallback;
  return val === "true" || val === "1";
}

/**
 * Resolve Puppeteer headless mode safely.
 * "auto" = headless in CI, visible locally.
 */
function resolveHeadless() {
  const raw = process.env.PUPPETEER_HEADLESS || "auto";

  if (raw === "auto") return isCI;
  return raw === "true" || raw === "1";
}

module.exports = {
  // ---- App Metadata ----
  APP: {
    NAME: "job-application-assistant",
    ENV: process.env.NODE_ENV || "development",
    IS_CI: isCI,
    IS_TEST: isTest,
  },

  // ---- Browser / Automation ----
  BROWSER: {
    WINDOW_SIZE: process.env.WINDOW_SIZE || "1280,900",
    NAV_TIMEOUT_MS: num("NAV_TIMEOUT_MS", 60000),
    ACTION_TIMEOUT_MS: num("ACTION_TIMEOUT_MS", 15000),
    HEADLESS: resolveHeadless(),

    // Prevents flaky automation (huge for Workday)
    RETRY: {
      ATTEMPTS: num("AUTOMATION_RETRIES", 3),
      BACKOFF_MS: num("AUTOMATION_BACKOFF_MS", 750),
    },
  },

  // ---- Portal Parsing (extensible beyond Workday) ----
  PORTALS: {
    WORKDAY: {
      WAIT_UNTIL: "networkidle2",
      PAGE_TIMEOUT_MS: num("WORKDAY_PAGE_TIMEOUT_MS", 45000),

      SELECTORS: {
        COOKIE_ACCEPT: '[data-automation-id="cookieBannerAcceptButton"]',
        FORM_SECTION: '[data-automation-id="formSection"]',
        QUESTION_TEXT: '[data-automation-id="questionText"]',
        FIELD_LABEL: '[data-automation-id="fieldLabel"]',
        QUESTION_CONTAINER_PREFIX: '[data-automation-id^="question-"]',
      },
    },
  },

  // ---- AI Matching Behavior ----
  AI: {
    ENABLED: bool("AI_ENABLED", true),

    // Similarity threshold before we reuse an answer
    MATCH_THRESHOLD: Number(process.env.AI_MATCH_THRESHOLD || 0.82),

    // Helps prevent hallucinated reuse
    REQUIRE_CONFIDENCE: Number(process.env.AI_REQUIRE_CONFIDENCE || 0.65),
  },

  // ---- Firestore / Cache ----
  CACHE: {
    COLLECTION: process.env.ANSWER_COLLECTION || "answers",

    // Allows local emulator use
    USE_EMULATOR: bool("FIRESTORE_EMULATOR", false),

    // Optional namespace for tests
    TEST_PREFIX: "__itest__",
  },

  // ---- Logging ----
  LOGGING: {
    LEVEL: (process.env.LOG_LEVEL || "info").toLowerCase(),

    // Toggle verbose Puppeteer tracing when debugging
    DEBUG_AUTOMATION: bool("DEBUG_AUTOMATION", false),
  },
};

