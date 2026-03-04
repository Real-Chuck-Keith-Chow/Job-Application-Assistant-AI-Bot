"use strict";

const Answer = require("../database/models/Answer");
const logger = require("../utils/logger");

function normalizeQuestion(q) {
  return String(q ?? "").trim();
}

function isValidAnswer(a) {
  return (
    (typeof a === "string" && a.trim().length > 0) ||
    (a && typeof a === "object")
  );
}

async function saveAnswer(question, answer) {
  const q = normalizeQuestion(question);

  if (!q) throw new Error("Question is required");
  if (!isValidAnswer(answer)) throw new Error("Valid answer is required");

  try {
    const docId = await Answer.create(q, answer);
    return { id: docId, question: q, answer };
  } catch (error) {
    logger.error("Failed to save answer", {
      message: error.message,
      stack: error.stack,
    });
    throw new Error("Failed to save answer to database");
  }
}

async function findAnswer(question, exactMatch = true) {
  const q = normalizeQuestion(question);

  if (!q) throw new Error("Question is required");

  try {
    const answers = await Answer.findByQuestion(q, exactMatch);

    if (!answers || answers.length === 0) return null;

    return answers[0]?.answer ?? null;
  } catch (error) {
    logger.error("Failed to find answer", {
      message: error.message,
      stack: error.stack,
    });
    throw new Error("Failed to retrieve answer from database");
  }
}

module.exports = {
  saveAnswer,
  findAnswer,
};
