"use strict";

const crypto = require("crypto");
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const logger = require("../../utils/logger");

// Prefer ADC (Application Default Credentials) in GCP,
// but allow explicit env overrides for local dev.
const db = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEYFILE, // optional
});

function normalizeQuestion(q) {
  return String(q || "").trim();
}

function questionId(question) {
  // stable doc id so GET/POST cache lines up
  return crypto.createHash("sha256").update(question).digest("hex");
}

class Answer {
  static async create(question, answer) {
    const q = normalizeQuestion(question);
    if (!q) throw new Error("Question is required");

    try {
      const id = questionId(q);
      const ref = db.collection("answers").doc(id);

      await ref.set(
        {
          question: q,
          answer,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );

      return id;
    } catch (error) {
      logger.error("Failed to save answer", { message: error.message, stack: error.stack });
      throw new Error("Answer save failed");
    }
  }

  static async findByQuestion(question, exactMatch = true) {
    const q = normalizeQuestion(question);
    if (!q) throw new Error("Question is required");

    if (!exactMatch) {
      // Don’t pretend this works until you implement embeddings/vector search
      throw new Error("Non-exact match is not implemented");
    }

    try {
      const id = questionId(q);
      const doc = await db.collection("answers").doc(id).get();
      if (!doc.exists) return [];

      return [{ id: doc.id, ...doc.data() }];
    } catch (error) {
      logger.error("Answer lookup failed", { message: error.message, stack: error.stack });
      throw new Error("Answer retrieval failed");
    }
  }
}

module.exports = Answer;
