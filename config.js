require('dotenv').config();

const config = {
  server: {
    port: process.env.PORT || 3000,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },
  scraper: {
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    timeout: parseInt(process.env.TIMEOUT) || 10000,
    delay: parseInt(process.env.DELAY) || 1000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3
  },
  puppeteer: {
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO) || 100
  }
};

// 验证必要的配置
if (!config.scraper.userAgent) {
  console.error('错误: 请设置 USER_AGENT 环境变量');
  process.exit(1);
}

if (!config.scraper.timeout) {
  console.error('错误: 请设置 TIMEOUT 环境变量');
  process.exit(1);
}

if (!config.scraper.delay) {
  console.error('错误: 请设置 DELAY 环境变量');
  process.exit(1);
}

if (!config.scraper.maxRetries) {
  console.error('错误: 请设置 MAX_RETRIES 环境变量');
  process.exit(1);
}

if (!config.puppeteer.headless) {
  console.error('错误: 请设置 HEADLESS 环境变量');
  process.exit(1);
}

module.exports = config; 