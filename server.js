const express = require('express');
const cors = require('cors');
const WebScraper = require('./scraper');
const config = require('./config');

const app = express();
const scraper = new WebScraper();

// Middleware
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Scrape single URL with axios
app.post('/api/scrape/axios', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
    }

    const result = await scraper.scrapeWithAxios(url);
    res.json(result);
  } catch (error) {
    console.error('Axios scraping error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Scrape single URL with puppeteer
app.post('/api/scrape/puppeteer', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
    }

    const result = await scraper.scrapeWithPuppeteer(url);
    res.json(result);
  } catch (error) {
    console.error('Puppeteer scraping error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Scrape multiple URLs
app.post('/api/scrape/multiple', async (req, res) => {
  try {
    const { urls, method = 'axios' } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'URLs array is required' 
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 10 URLs allowed per request' 
      });
    }

    const results = await scraper.scrapeMultiple(urls, method);
    res.json({
      success: true,
      totalUrls: urls.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    });
  } catch (error) {
    console.error('Multiple scraping error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Extract specific data using selectors
app.post('/api/scrape/extract', async (req, res) => {
  try {
    const { url, selectors } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
    }

    if (!selectors || typeof selectors !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Selectors object is required' 
      });
    }

    const result = await scraper.extractData(url, selectors);
    res.json(result);
  } catch (error) {
    console.error('Data extraction error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Run demo scraping
app.get('/api/scrape/demo', async (req, res) => {
  try {
    const result = await scraper.runDemo();
    res.json(result);
  } catch (error) {
    console.error('Demo scraping error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Web Scraper Demo Service is running',
    config: {
      timeout: config.scraper.timeout,
      delay: config.scraper.delay,
      maxRetries: config.scraper.maxRetries,
      headless: config.puppeteer.headless
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// Start server
app.listen(config.server.port, () => {
  console.log(`Web Scraper Demo Service started successfully!`);
  console.log(`Server URL: http://localhost:${config.server.port}`);
  console.log(`API Documentation: http://localhost:${config.server.port}/api/health`);
}); 