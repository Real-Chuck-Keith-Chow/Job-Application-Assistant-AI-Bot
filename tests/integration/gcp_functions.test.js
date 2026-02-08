"use strict";

const { saveAnswer, findAnswer } = require("../../backend/gcp_functions");
const { Firestore } = require("@google-cloud/firestore");

describe("GCP Functions Integration (Firestore)", () => {
  const firestore = new Firestore();
  const testQuestion = "__test_question__";
  const testAnswer = {
    answer: "This is a test answer",
    confidence: 0.8,
    reasoning: "Integration test",
  };

  beforeAll(async () => {
    // Best-effort cleanup
    try {
      const snap = await firestore.collection("answers").where("question", "==", testQuestion).get();
      const deletes = snap.docs.map((d) => d.ref.delete());
      await Promise.all(deletes);
    } catch (_) {
      // ignore cleanup failures
    }
  });

  it("saves and retrieves a structured answer", async () => {
    const result = await saveAnswer(testQuestion, testAnswer);
    expect(result).toBeDefined();

    const dbAnswer = await findAnswer(testQuestion);
    expect(dbAnswer).toEqual(testAnswer);
  });

  it("allows multiple writes without crashing", async () => {
    const [res1, res2] = await Promise.all([
      saveAnswer(testQuestion, { answer: "answer1" }),
      saveAnswer(testQuestion, { answer: "answer2" }),
    ]);

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();
  });
});
