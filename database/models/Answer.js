"use strict";

const crypto = require("crypto");
const { FieldValue } = require("@google-cloud/firestore");
const { getFirestore } = require("../firestore_init");
const logger = require("../../utils/logger");

const db = getFirestore();
const COLLECTION = "answers";

function normalizeQuestion(q) {
  return String(q ?? "").trim();
}

function questionId(question) {
  return crypto.createHash("sha256").update(question).digest("hex");
}

class Answer {
  static async create(question, answer) {
    const q = normalizeQuestion(question);
    if (!q) throw new Error("Question is required");

    const id = questionId(q);
    const ref = db.collection(COLLECTION).doc(id);

    try {
      const doc = await ref.get();

      const payload = {
        question: q,
        answer,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (!doc.exists) {
        payload.createdAt = FieldValue.serverTimestamp();
      }

      await ref.set(payload, { merge: true });

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
      throw new Error("Non-exact match search is not implemented");
    }

    try {
      const id = questionId(q);
      const doc = await db.collection(COLLECTION).doc(id).get();

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
