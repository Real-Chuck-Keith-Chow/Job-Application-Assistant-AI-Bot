const { saveAnswer, findAnswer } = require('../../backend/gcp_functions');
const { Firestore } = require('@google-cloud/firestore');

describe('Firestore Operations', () => {
  let testQuestion = "__test_question__";
  let testAnswer = "__test_answer__";

  beforeAll(async () => {
    await Firestore().collection('answers').doc('test').delete();
  });

  it('saves answers to Firestore', async () => {
    const result = await saveAnswer(testQuestion, testAnswer);
    expect(result.id).toBeDefined();
  });

  it('retrieves saved answers', async () => {
    await saveAnswer(testQuestion, testAnswer);
    const answer = await findAnswer(testQuestion);
    expect(answer).toEqual(testAnswer);
  });

  it('returns null for missing answers', async () => {
    const answer = await findAnswer("__non_existent_question__");
    expect(answer).toBeNull();
  });
});
