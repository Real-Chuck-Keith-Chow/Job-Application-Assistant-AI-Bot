const BrowserLauncher = require('./browser_launcher');
const logger = require('../utils/logger');

class WorkdayParser {
  static async parse(jobUrl) {
    const browser = await BrowserLauncher.launch();
    const page = await BrowserLauncher.newPage(browser);
    
    try {
      await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      await this._dismissCookies(page);

      const sections = await this._extractFormSections(page);
      const questions = await this._extractQuestions(page, sections);

      return { success: true, questions };
    } catch (error) {
      logger.error(`Workday parsing failed: ${error.message}`);
      await page.screenshot({ path: 'workday-error.png' });
      return { success: false, error: error.message };
    } finally {
      await BrowserLauncher.close(browser);
    }
  }

  static async _dismissCookies(page) {
    try {
      await page.waitForSelector('[data-automation-id="cookieBannerAcceptButton"]', { timeout: 5000 });
      await page.click('[data-automation-id="cookieBannerAcceptButton"]');
    } catch {
      logger.debug('No cookie banner found');
    }
  }

  static async _extractFormSections(page) {
    return page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-automation-id="formSection"]'))
        .map(section => section.id);
    });
  }

  static async _extractQuestions(page, sectionIds) {
    const questions = [];
    
    for (const sectionId of sectionIds) {
      const sectionQuestions = await page.evaluate((id) => {
        const section = document.getElementById(id);
        return Array.from(section.querySelectorAll('[data-automation-id="questionText"]'))
          .map(q => ({
            text: q.innerText.trim(),
            type: q.closest('[data-automation-id*="question-"]')?.dataset.automationId.split('-')[1] || 'text',
            containerId: q.closest('[data-automation-id^="question-"]')?.id
          }));
      }, sectionId);

      questions.push(...sectionQuestions);
    }

    return questions.filter(q => q.text && q.containerId);
  }
}

module.exports = WorkdayParser;
