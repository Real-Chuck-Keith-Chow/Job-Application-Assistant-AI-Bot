"use strict";

jest.mock("../../ai/answer_generator", () => ({
  generate_answer: jest.fn(),
}));

const { match_question } = require("../../ai/question_matcher");
const { generate_answer } = require("../../ai/answer_generator");

describe("AI Question Matching (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns generated answer text when generation succeeds", async () => {
    generate_answer.mockResolvedValue({
      answer: "I have 3+ years of Python experience building APIs and automation.",
      confidence: 0.9,
      reasoning: "Directly answers a common experience question.",
    });

    const answer = await match_question("What is your Python experience?");

    expect(answer).toBe(
      "I have 3+ years of Python experience building APIs and automation."
    );

    expect(generate_answer).toHaveBeenCalledTimes(1);

    // Don’t over-assume the 2nd arg type (could be undefined or a context string/object)
    expect(generate_answer).toHaveBeenCalledWith(
      "What is your Python experience?",
      expect.anything()
    );
  });

  it("handles generation failure gracefully", async () => {
    generate_answer.mockRejectedValue(new Error("OpenAI unavailable"));

    const answer = await match_question("Some random question");

    expect(answer).toBe("I couldn't generate an answer.");
    expect(generate_answer).toHaveBeenCalledTimes(1);
  });

  it("returns empty string for empty/whitespace question", async () => {
    const answer = await match_question("   ");

    expect(answer).toBe("");
    expect(generate_answer).not.toHaveBeenCalled();
  });

  it("returns fallback message if generator returns invalid shape", async () => {
    generate_answer.mockResolvedValue("not-an-object");

    const answer = await match_question("What frameworks do you know?");

    expect(answer).toBe("I couldn't generate an answer.");
  });
});

/**
 * Optional manual test — skipped by default so CI stays stable.
 * Run intentionally if you want to hit the real system.
 */
describe.skip("AI Question Matching (live integration)", () => {
  it("calls live generation and returns a real answer", async () => {
    const answer = await match_question("What is your Python experience?");
    expect(typeof answer).toBe("string");
    expect(answer.length).toBeGreaterThan(5);
  });
});
