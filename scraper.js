const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const config = require('./config');

class WebScraper {
  constructor() {
    this.config = config.scraper;
    this.puppeteerConfig = config.puppeteer;
  }

  // Simple HTTP request scraper using axios and cheerio
  async scrapeWithAxios(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: this.config.timeout
      });

      const $ = cheerio.load(response.data);
      return {
        success: true,
        url: url,
        title: $('title').text().trim(),
        content: $('body').text().trim().substring(0, 500) + '...',
        links: $('a').map((i, el) => $(el).attr('href')).get().slice(0, 10),
        images: $('img').map((i, el) => $(el).attr('src')).get().slice(0, 10)
      };
    } catch (error) {
      return {
        success: false,
        url: url,
        error: error.message
      };
    }
  }

  // Advanced scraper using Puppeteer for JavaScript-heavy sites
  async scrapeWithPuppeteer(url) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: this.puppeteerConfig.headless,
        slowMo: this.puppeteerConfig.slowMo,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set user agent
      await page.setUserAgent(this.config.userAgent);
      
      // Set viewport
      await page.setViewport({ width: 1280, height: 720 });
      
      // Navigate to URL
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: this.config.timeout 
      });

      // Wait for content to load
      await page.waitForTimeout(this.config.delay);

      // Extract data
      const data = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          content: document.body.innerText.substring(0, 500) + '...',
          links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => a.href),
          images: Array.from(document.querySelectorAll('img')).slice(0, 10).map(img => img.src),
          meta: {
            description: document.querySelector('meta[name="description"]')?.content || '',
            keywords: document.querySelector('meta[name="keywords"]')?.content || ''
          }
        };
      });

      await browser.close();
      
      return {
        success: true,
        ...data
      };
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      return {
        success: false,
        url: url,
        error: error.message
      };
    }
  }

  // Scrape multiple URLs with delay
  async scrapeMultiple(urls, method = 'axios') {
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`Scraping ${i + 1}/${urls.length}: ${url}`);
      
      let result;
      if (method === 'puppeteer') {
        result = await this.scrapeWithPuppeteer(url);
      } else {
        result = await this.scrapeWithAxios(url);
      }
      
      results.push(result);
      
      // Add delay between requests
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.config.delay));
      }
    }
    
    return results;
  }

  // Extract specific data using CSS selectors
  async extractData(url, selectors) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.config.userAgent
        },
        timeout: this.config.timeout
      });

      const $ = cheerio.load(response.data);
      const extractedData = {};

      for (const [key, selector] of Object.entries(selectors)) {
        extractedData[key] = $(selector).text().trim();
      }

      return {
        success: true,
        url: url,
        data: extractedData
      };
    } catch (error) {
      return {
        success: false,
        url: url,
        error: error.message
      };
    }
  }

  // Test scraping with common demo URLs
  async runDemo() {
    const demoUrls = [
      'https://httpbin.org/html',
      'https://example.com',
      'https://jsonplaceholder.typicode.com/posts/1'
    ];

    console.log('Running demo scraping...');
    const results = await this.scrapeMultiple(demoUrls, 'axios');
    
    return {
      timestamp: new Date().toISOString(),
      totalUrls: demoUrls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }
}

module.exports = WebScraper; 