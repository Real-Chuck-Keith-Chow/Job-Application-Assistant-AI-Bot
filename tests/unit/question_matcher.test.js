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

  it("returns generated answer text when generation succeeds", async () => {
    generate_answer.mockResolvedValue({
      answer: "I have 3+ years of Python experience building APIs and automation.",
      confidence: 0.92,
      reasoning: "Directly answers a common experience question.",
    });

    const answer = await match_question("What is your Python experience?");
    expect(answer).toBe("I have 3+ years of Python experience building APIs and automation.");
    expect(generate_answer).toHaveBeenCalledTimes(1);
  });

  it("handles generation failure gracefully", async () => {
    generate_answer.mockRejectedValue(new Error("OpenAI down"));

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
    generate_answer.mockResolvedValue("not an object");

    const answer = await match_question("What frameworks do you know?");
    expect(answer).toBe("I couldn't generate an answer.");
  });
});

// Optional: keep a live/integration test, but skip by default so CI stays stable.
// Remove this block entirely if you don’t want any live tests.
describe.skip("AI Question Matching (integration)", () => {
  it("calls live generation and returns a real answer", async () => {
    const answer = await match_question("What is your Python experience?");
    expect(typeof answer).toBe("string");
    expect(answer.length).toBeGreaterThan(5);
  });
});
