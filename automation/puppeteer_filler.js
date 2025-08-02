const puppeteer = require('puppeteer');
const { match_question } = require('../ai/question_matcher');
const logger = require('../utils/logger');

const DEFAULT_OPTIONS = {
  headless: false,
  defaultViewport: null,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

async function fillApplication(jobUrl, options = {}) {
  const browser = await puppeteer.launch({ ...DEFAULT_OPTIONS, ...options });
  const page = await browser.newPage();
  
  try {
    await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const questions = await extractQuestions(page);
    await populateAnswers(page, questions);

    await submitApplication(page);
    logger.info('Application submitted successfully');
  } catch (error) {
    logger.error(`Application failed: ${error.message}`);
    await page.screenshot({ path: 'error.png' });
    throw error;
  } finally {
    await browser.close();
  }
}

async function extractQuestions(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-qa="question-text"]'))
      .map(el => ({
        text: el.innerText.trim(),
        id: el.closest('.question-container')?.id
      }));
  });
}

async function populateAnswers(page, questions) {
  for (const { text, id } of questions) {
    const answer = await match_question(text);
    await page.type(`#${id} textarea`, answer, { delay: 50 });
  }
}

async function submitApplication(page) {
  await page.waitForSelector('#submit-application', { visible: true });
  await page.click('#submit-application');
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
}

module.exports = {
  fillApplication,
  extractQuestions,
  populateAnswers
};
