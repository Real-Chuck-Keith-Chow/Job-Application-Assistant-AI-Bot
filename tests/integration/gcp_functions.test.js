"use strict";

const { saveAnswer, findAnswer } = require("../../backend/gcp_functions");
const { Firestore } = require("@google-cloud/firestore");

// Use a unique test namespace so parallel runs don't collide
const TEST_PREFIX = "__itest__";
const makeTestQuestion = () =>
  `${TEST_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

describe("GCP Functions Integration (Firestore)", () => {
  let firestore;
  let testQuestion;

  const testAnswer = {
    answer: "This is a test answer",
    confidence: 0.8,
    reasoning: "Integration test",
  };

  beforeAll(() => {
    firestore = new Firestore();
    testQuestion = makeTestQuestion();
  });

  afterAll(async () => {
    // Hard cleanup so CI stays clean even if tests fail midway
    try {
      const snap = await firestore
        .collection("answers")
        .where("question", "==", testQuestion)
        .get();

      const deletions = snap.docs.map((doc) => doc.ref.delete());
      await Promise.allSettled(deletions);
    } catch (err) {
      console.warn("Firestore cleanup skipped:", err.message);
    }
  });

  describe("saveAnswer()", () => {
    it("persists a structured answer", async () => {
      const result = await saveAnswer(testQuestion, testAnswer);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("can be retrieved via findAnswer()", async () => {
      await saveAnswer(testQuestion, testAnswer);

      const dbAnswer = await findAnswer(testQuestion);

      expect(dbAnswer).toEqual(
        expect.objectContaining({
          answer: testAnswer.answer,
          confidence: testAnswer.confidence,
          reasoning: testAnswer.reasoning,
        })
      );
    });
  });

  describe("concurrency safety", () => {
    it("handles concurrent writes without crashing", async () => {
      const writes = await Promise.allSettled([
        saveAnswer(testQuestion, { answer: "answer1" }),
        saveAnswer(testQuestion, { answer: "answer2" }),
      ]);

      // Ensure no write rejected (race-condition detector)
      writes.forEach((res) => {
        expect(res.status).toBe("fulfilled");
      });
    });
  });
});
