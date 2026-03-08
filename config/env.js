"use strict";

require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback = null) {
  return process.env[name] ?? fallback;
}

module.exports = {
  NODE_ENV: optional("NODE_ENV", "development"),

  // AI
  OPENAI_API_KEY: optional("OPENAI_API_KEY"),

  // Firestore
  GOOGLE_CLOUD_PROJECT: optional("GOOGLE_CLOUD_PROJECT"),
  GOOGLE_APPLICATION_CREDENTIALS: optional("GOOGLE_APPLICATION_CREDENTIALS"),

  // Automation
  PUPPETEER_HEADLESS: optional("PUPPETEER_HEADLESS", "true"),
};
