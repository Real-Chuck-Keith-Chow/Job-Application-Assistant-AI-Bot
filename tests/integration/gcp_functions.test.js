"use strict";

const { saveAnswer, findAnswer } = require("../../backend/gcp_functions");
const { Firestore } = require("@google-cloud/firestore");

const TEST_PREFIX = "__itest__";
const runId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
const testQuestion = `${TEST_PREFIX}_${runId}`;

describe("GCP Functions Integration (Firestore)", () => {
  let firestore;

  const testAnswer = {
    answer: "This is a test answer",
    confidence: 0.8,
    reasoning: "Integration test",
  };

  async function cleanup() {
    const snap = await firestore
      .collection("answers")
      .where("question", "==", testQuestion)
      .get();

    await Promise.allSettled(snap.docs.map((doc) => doc.ref.delete()));
  }

  beforeAll(async () => {
    firestore = new Firestore();
    await cleanup().catch(() => {}); // best-effort cleanup
  });

  afterAll(async () => {
    await cleanup().catch(() => {}); // best-effort cleanup
  });

  it("persists and retrieves a structured answer", async () => {
    const result = await saveAnswer(testQuestion, testAnswer);
    expect(result).toBeDefined();

    const dbAnswer = await findAnswer(testQuestion);
    expect(dbAnswer).toEqual(expect.objectContaining(testAnswer));
  });

  it("handles concurrent writes without crashing", async () => {
    const writes = await Promise.allSettled([
      saveAnswer(testQuestion, { answer: "answer1" }),
      saveAnswer(testQuestion, { answer: "answer2" }),
    ]);

    writes.forEach((res) => expect(res.status).toBe("fulfilled"));
  });
});
