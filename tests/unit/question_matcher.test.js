const { match_question } = require('../../ai/question_matcher');
const { generate_answer } = require('../../ai/answer_generator');

describe('AI Question Matching', () => {
  it('returns valid answer for known question', async () => {
    const answer = await match_question("What is your Python experience?");
    expect(typeof answer).toBe('string');
    expect(answer.length).toBeGreaterThan(10);
  });

  it('handles unknown questions', async () => {
    const answer = await match_question("__invalid_test_question__");
    expect(answer).toBeDefined();
  });
});

describe('Answer Generation', () => {
  it('generates context-aware responses', async () => {
    const answer = await generate_answer(
      "What frameworks do you know?", 
      "Python backend role"
    );
    expect(answer.toLowerCase()).toContain('python');
  });
});
