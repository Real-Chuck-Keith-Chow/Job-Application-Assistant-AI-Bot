"use strict";

const crypto = require("crypto");
const { FieldValue } = require("@google-cloud/firestore");
const { getFirestore } = require("./firestore_init");

const COLLECTION = "answers";

function normalizeQuestion(q) {
  return String(q ?? "").trim();
}

function questionId(question) {
  return crypto.createHash("sha256").update(question).digest("hex").slice(0, 32);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

class AnswerRepository {
  constructor() {
    this.db = getFirestore();
    this.collection = this.db.collection(COLLECTION);
  }

  async save(question, payload = {}) {
    const q = normalizeQuestion(question);
    if (!q) throw new Error("Question is required");
    if (!isPlainObject(payload)) throw new Error("Payload must be an object");

    const id = questionId(q);
    const docRef = this.collection.doc(id);

    const existing = await docRef.get();

    const data = {
      question: q,
      ...payload,
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    };

    await docRef.set(data, { merge: true });

    return { id, ...data };
  }

  async find(question) {
    const q = normalizeQuestion(question);
    if (!q) return null;

    const id = questionId(q);
    const doc = await this.collection.doc(id).get();

    if (!doc.exists) return null;

    const data = doc.data() || {};
    const { question: _question, ...rest } = data;
    return { id: doc.id, ...rest };
  }

  async delete(question) {
    const q = normalizeQuestion(question);
    if (!q) return false;

    const id = questionId(q);
    await this.collection.doc(id).delete();
    return true;
  }
}

module.exports = new AnswerRepository();
