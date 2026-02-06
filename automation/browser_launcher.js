const puppeteer = require("puppeteer");
const logger = require("../utils/logger");

class BrowserLauncher {
  static async launch(config = {}) {
    const defaults = {
      headless:
        process.env.NODE_ENV === "production"
          ? (process.env.PUPPETEER_HEADLESS || "new")
          : false,
      ignoreHTTPSErrors: true,
      executablePath: process.env.CHROME_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        `--window-size=${process.env.WINDOW_SIZE || "1200,1000"}`,
      ],
    };

    try {
      const browser = await puppeteer.launch({ ...defaults, ...config });
      logger.info("Browser launched successfully");
      return browser;
    } catch (error) {
      logger.error(`Browser launch failed: ${error.message}`);
      throw new Error("Failed to launch browser");
    }
  }

  static async newPage(browser) {
    if (!browser) {
      throw new Error("Browser instance is required to create a new page");
    }

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(
      Number(process.env.NAV_TIMEOUT_MS) || 60000
    );
    await page.setDefaultTimeout(
      Number(process.env.ACTION_TIMEOUT_MS) || 30000
    );
    return page;
  }

  static async close(browser) {
    try {
      if (browser && browser.isConnected()) {
        await browser.close();
        logger.info("Browser closed successfully");
      }
    } catch (error) {
      logger.error(`Browser close failed: ${error.message}`);
    }
  }
}

module.exports = BrowserLauncher;
