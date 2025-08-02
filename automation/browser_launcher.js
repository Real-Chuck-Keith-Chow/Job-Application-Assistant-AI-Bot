const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class BrowserLauncher {
  static async launch(config = {}) {
    const defaults = {
      headless: process.env.NODE_ENV === 'production',
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ]
    };

    try {
      const browser = await puppeteer.launch({ ...defaults, ...config });
      logger.info('Browser launched successfully');
      return browser;
    } catch (error) {
      logger.error(`Browser launch failed: ${error.message}`);
      throw new Error('Failed to launch browser');
    }
  }

  static async newPage(browser) {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(30000);
    return page;
  }

  static async close(browser) {
    try {
      await browser.close();
      logger.info('Browser closed successfully');
    } catch (error) {
      logger.error(`Browser close failed: ${error.message}`);
    }
  }
}

module.exports = BrowserLauncher;
