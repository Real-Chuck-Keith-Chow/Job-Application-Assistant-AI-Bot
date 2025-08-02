const { saveAnswer, findAnswer } = require('../../backend/gcp_functions');
const { match_question } = require('../../ai/question_matcher');
const { Firestore } = require('@google-cloud/firestore');

describe('GCP Functions Integration', () => {
  const testQuestion = "__test_question__";
  const testAnswer = "__test_answer__";

  beforeAll(async () => {
    await Firestore().collection('answers').doc(testQuestion).delete();
  });

  it('saves and retrieves AI-generated answers', async () => {
    const aiAnswer = await match_question(testQuestion);
    const { id } = await saveAnswer(testQuestion, aiAnswer);
    const dbAnswer = await findAnswer(testQuestion);
    
    expect(id).toBeDefined();
    expect(dbAnswer).toEqual(aiAnswer);
  });

  it('handles concurrent requests', async () => {
    const [res1, res2] = await Promise.all([
      saveAnswer(testQuestion, "answer1"),
      saveAnswer(testQuestion, "answer2")
    ]);
    
    expect(res1.id).not.toEqual(res2.id);
  });
});
