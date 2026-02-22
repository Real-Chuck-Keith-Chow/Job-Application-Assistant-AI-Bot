"use strict";

// Only run this when you intentionally provide a real Workday URL.
// Example:
//   WORKDAY_TEST_URL="https://company.wd5.myworkdayjobs.com/<job>" npm test
const TEST_URL = process.env.WORKDAY_TEST_URL;

jest.setTimeout(120000);

// Mock AI/matcher so integration tests don’t hit OpenAI/backend.
// If puppeteer_filler calls into match_question through some other module,
// mock THAT module instead.
jest.mock("../../ai/question_matcher", () => ({
  match_question: jest.fn(async () => "Test answer for integration"),
}));

const { fillApplication } = require("../../automation/puppeteer_filler");
const WorkdayParser = require("../../automation/workday_parser");
const { match_question } = require("../../ai/question_matcher");

const run = TEST_URL ? describe : describe.skip;

run("Workday Application Filler (integration)", () => {
  it("parses Workday questions without crashing", async () => {
    const result = await WorkdayParser.parse(TEST_URL);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.questions)).toBe(true);
  });

  it("fills application in dry-run mode without submitting", async () => {
    await expect(fillApplication(TEST_URL, { dryRun: true })).resolves.not.toThrow();
  });

  it("can generate an answer for the first parsed question (mocked)", async () => {
    const { questions } = await WorkdayParser.parse(TEST_URL);

    expect(questions.length).toBeGreaterThan(0);

    const ans = await match_question(questions[0].text);
    expect(typeof ans).toBe("string");
    expect(ans.length).toBeGreaterThan(5);
  });
});
