"use strict";

const crypto = require("crypto");
const { getFirestore } = require("./firestore_init");

const COLLECTION = "answers";

function normalizeQuestion(q) {
  return String(q ?? "").trim();
}

function questionId(q) {
  // stable, short, Firestore-safe doc id
  return crypto.createHash("sha256").update(q).digest("hex").slice(0, 32);
}

class AnswerRepository {
  constructor() {
    this.db = getFirestore();
    this.collection = this.db.collection(COLLECTION);
  }

  async save(question, payload = {}) {
    const q = normalizeQuestion(question);
    if (!q) throw new Error("Question is required");

    const id = questionId(q);
    const docRef = this.collection.doc(id);

    const data = {
      question: q,
      ...payload,
      updatedAt: new Date(),
    };

    await docRef.set(data, { merge: true });

    // Set createdAt only if missing (no overwrite)
    await docRef.set({ createdAt: new Date() }, { merge: true });

    return { id, ...data };
  }

  async find(question) {
    const q = normalizeQuestion(question);
    if (!q) return null;

    const id = questionId(q);
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;

    const { question: _ignored, ...rest } = doc.data() || {};
    return rest;
  }

  async delete(question) {
    const q = normalizeQuestion(question);
    if (!q) return;

    const id = questionId(q);
    await this.collection.doc(id).delete();
  }
}

module.exports = new AnswerRepository();
