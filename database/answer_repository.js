"use strict";

const { getFirestore } = require("./firestore_init");

const COLLECTION = "answers";

class AnswerRepository {
  constructor() {
    this.db = getFirestore();
    this.collection = this.db.collection(COLLECTION);
  }

  async save(question, payload) {
    if (!question) throw new Error("Question is required");

    const docRef = this.collection.doc(question);

    const data = {
      question,
      ...payload,
      updatedAt: new Date(),
    };

    await docRef.set(data, { merge: true });
    return data;
  }

  async find(question) {
    if (!question) return null;

    const doc = await this.collection.doc(question).get();
    if (!doc.exists) return null;

    const { question: _, ...rest } = doc.data();
    return rest;
  }

  async delete(question) {
    if (!question) return;

    await this.collection.doc(question).delete();
  }
}

module.exports = new AnswerRepository();
