"use strict";

jest.mock("../../ai/answer_generator", () => ({
  generate_answer: jest.fn(),
}));

const { match_question } = require("../../ai/question_matcher");
const { generate_answer } = require("../../ai/answer_generator");

describe("AI Question Matching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns generated answer text", async () => {
    generate_answer.mockResolvedValue({
      answer: "I have 3+ years of Python experience building APIs and automation.",
      confidence: 0.9,
    });

    const result = await match_question("What is your Python experience?");

    expect(result).toBe(
      "I have 3+ years of Python experience building APIs and automation."
    );
    expect(generate_answer).toHaveBeenCalledTimes(1);
  });

  it("returns fallback when generation fails", async () => {
    generate_answer.mockRejectedValue(new Error("OpenAI unavailable"));

    const result = await match_question("Some random question");

    expect(result).toBe("I couldn't generate an answer.");
  });

  it("returns empty string for blank question", async () => {
    const result = await match_question("   ");

    expect(result).toBe("");
    expect(generate_answer).not.toHaveBeenCalled();
  });

  it("returns fallback if generator response is invalid", async () => {
    generate_answer.mockResolvedValue("not-an-object");

    const result = await match_question("What frameworks do you know?");

    expect(result).toBe("I couldn't generate an answer.");
  });
});

/* Optional live test — skipped in CI */
describe.skip("AI Question Matching (live)", () => {
  it("generates a real answer", async () => {
    const result = await match_question("What is your Python experience?");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(5);
  });
});
