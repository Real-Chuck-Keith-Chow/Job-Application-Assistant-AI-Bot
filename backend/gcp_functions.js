const Answer = require('../database/models/Answer');
const logger = require('../utils/logger');

const saveAnswer = async (question, answer) => {
  try {
    const docId = await Answer.create(question, answer);
    return { id: docId, question, answer };
  } catch (error) {
    logger.error(`Failed to save answer: ${error}`);
    throw new Error('Failed to save answer to database');
  }
};

const findAnswer = async (question, exactMatch = true) => {
  try {
    const answers = await Answer.findByQuestion(question, exactMatch);
    return answers.length > 0 ? answers[0].answer : null;
  } catch (error) {
    logger.error(`Failed to find answer: ${error}`);
    throw new Error('Failed to retrieve answer from database');
  }
};

module.exports = {
  saveAnswer,
  findAnswer
};
