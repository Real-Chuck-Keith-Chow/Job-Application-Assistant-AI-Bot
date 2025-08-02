const { fillApplication } = require('../../automation/puppeteer_filler');
const WorkdayParser = require('../../automation/workday_parser');
const { match_question } = require('../../ai/question_matcher');

jest.setTimeout(60000);

describe('Workday Application Filler', () => {
  const testUrl = 'https://example.wd1.myworkdayjobs.com/test';

  it('completes entire application flow', async () => {
    await expect(fillApplication(testUrl)).resolves.not.toThrow();
  });

  it('matches Workday questions to stored answers', async () => {
    const { questions } = await WorkdayParser.parse(testUrl);
    const answer = await match_question(questions[0].text);
    expect(answer.length).toBeGreaterThan(20);
  });

  it('handles empty question lists', async () => {
    jest.spyOn(WorkdayParser, 'parse').mockResolvedValue({ questions: [] });
    await expect(fillApplication(testUrl)).resolves.not.toThrow();
  });
});
