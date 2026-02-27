"use strict";

const { saveAnswer, findAnswer } = require("../../backend/gcp_functions");
const { getFirestore } = require("../../database/firestore_init");

describe("Firestore Utilities", () => {
  const db = getFirestore();

  // Use unique key per run to avoid collisions
  const testQuestion = `__unit_test_${Date.now()}__`;

  const testAnswer = {
    answer: "unit test answer",
    confidence: 1,
    reasoning: "unit test",
  };

  beforeAll(async () => {
    // Ensure clean state before test
    const snap = await db
      .collection("answers")
      .where("question", "==", testQuestion)
      .get();

    await Promise.allSettled(snap.docs.map((doc) => doc.ref.delete()));
  });

  afterAll(async () => {
    // Cleanup after ourselves (important when running locally)
    const snap = await db
      .collection("answers")
      .where("question", "==", testQuestion)
      .get();

    await Promise.allSettled(snap.docs.map((doc) => doc.ref.delete()));
  });

  it("saves answers to Firestore", async () => {
    const result = await saveAnswer(testQuestion, testAnswer);

    expect(result).toBeDefined();
  });

  it("retrieves saved answers", async () => {
    await saveAnswer(testQuestion, testAnswer);

    const answer = await findAnswer(testQuestion);

    expect(answer).toEqual(expect.objectContaining(testAnswer));
  });

  it("returns null for missing answers", async () => {
    const answer = await findAnswer("__nonexistent_question__");

    expect(answer).toBeNull();
  });
});
