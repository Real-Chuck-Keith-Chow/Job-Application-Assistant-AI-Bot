"use strict";

const crypto = require("crypto");
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const logger = require("../../utils/logger");

// Uses ADC automatically in GCP, env vars for local dev.
const db = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEYFILE, // optional
});

function normalizeQuestion(input) {
  return String(input || "").trim();
}

function questionId(question) {
  // Stable ID ensures cache GET/POST hit the same document.
  return crypto.createHash("sha256").update(question).digest("hex");
}

class Answer {
  static async create(question, answer) {
    const q = normalizeQuestion(question);
    if (!q) throw new Error("Question is required");

    const id = questionId(q);
    const ref = db.collection("answers").doc(id);

    try {
      const doc = await ref.get();

      await ref.set(
        {
          question: q,
          answer,
          updatedAt: FieldValue.serverTimestamp(),
          ...(doc.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true } // update without clobbering
      );

      return id;
    } catch (error) {
      logger.error("Failed to save answer", {
        message: error.message,
        stack: error.stack,
      });
      throw new Error("Answer save failed");
    }
  }

  static async findByQuestion(question, exactMatch = true) {
    const q = normalizeQuestion(question);
    if (!q) throw new Error("Question is required");

    if (!exactMatch) {
      // Future hook for embeddings/vector search.
      throw new Error("Non-exact match is not implemented");
    }

    try {
      const id = questionId(q);
      const doc = await db.collection("answers").doc(id).get();

      if (!doc.exists) return [];

      return [{ id: doc.id, ...doc.data() }];
    } catch (error) {
      logger.error("Answer lookup failed", {
        message: error.message,
        stack: error.stack,
      });
      throw new Error("Answer retrieval failed");
    }
  }
}

module.exports = Answer;
