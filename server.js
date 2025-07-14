const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const WebScraper = require('./scraper');
const config = require('./config');

const app = express();
const scraper = new WebScraper();

// 設置 multer 用於文件上傳
const upload = multer({
  limits: {
    fileSize: config.imageClassifier.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (config.imageClassifier.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案類型'), false);
    }
  }
});

// 簡單的圖片分類器 - 基於圖片特徵分析
async function classifyImage(imageBuffer) {
  try {
    // 使用 sharp 分析圖片
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // 獲取圖片統計信息
    const stats = await image.stats();
    const channels = stats.channels;
    
    // 計算平均顏色
    const avgRed = channels[0].mean;
    const avgGreen = channels[1].mean;
    const avgBlue = channels[2].mean;
    
    // 計算亮度
    const brightness = (avgRed + avgGreen + avgBlue) / 3;
    
    // 計算對比度 (標準差)
    const contrast = Math.sqrt(
      (channels[0].stdev ** 2 + channels[1].stdev ** 2 + channels[2].stdev ** 2) / 3
    );
    
    // 基於圖片特徵進行分類
    const classifications = [];
    
    // 亮度分類
    if (brightness < 50) {
      classifications.push({
        class: 'dark_image',
        probability: 0.9,
        percentage: '90.00',
        description: '暗色圖片'
      });
    } else if (brightness > 200) {
      classifications.push({
        class: 'bright_image',
        probability: 0.9,
        percentage: '90.00',
        description: '亮色圖片'
      });
    } else {
      classifications.push({
        class: 'normal_brightness',
        probability: 0.8,
        percentage: '80.00',
        description: '正常亮度圖片'
      });
    }
    
    // 對比度分類
    if (contrast < 20) {
      classifications.push({
        class: 'low_contrast',
        probability: 0.85,
        percentage: '85.00',
        description: '低對比度圖片'
      });
    } else if (contrast > 60) {
      classifications.push({
        class: 'high_contrast',
        probability: 0.85,
        percentage: '85.00',
        description: '高對比度圖片'
      });
    } else {
      classifications.push({
        class: 'medium_contrast',
        probability: 0.8,
        percentage: '80.00',
        description: '中等對比度圖片'
      });
    }
    
    // 顏色分類
    const maxColor = Math.max(avgRed, avgGreen, avgBlue);
    if (avgRed > avgGreen * 1.5 && avgRed > avgBlue * 1.5) {
      classifications.push({
        class: 'red_dominant',
        probability: 0.9,
        percentage: '90.00',
        description: '紅色主導圖片'
      });
    } else if (avgGreen > avgRed * 1.5 && avgGreen > avgBlue * 1.5) {
      classifications.push({
        class: 'green_dominant',
        probability: 0.9,
        percentage: '90.00',
        description: '綠色主導圖片'
      });
    } else if (avgBlue > avgRed * 1.5 && avgBlue > avgGreen * 1.5) {
      classifications.push({
        class: 'blue_dominant',
        probability: 0.9,
        percentage: '90.00',
        description: '藍色主導圖片'
      });
    } else {
      classifications.push({
        class: 'balanced_colors',
        probability: 0.8,
        percentage: '80.00',
        description: '平衡色彩圖片'
      });
    }
    
    // 尺寸分類
    const aspectRatio = metadata.width / metadata.height;
    if (aspectRatio > 1.5) {
      classifications.push({
        class: 'landscape',
        probability: 0.95,
        percentage: '95.00',
        description: '橫向圖片'
      });
    } else if (aspectRatio < 0.7) {
      classifications.push({
        class: 'portrait',
        probability: 0.95,
        percentage: '95.00',
        description: '縱向圖片'
      });
    } else {
      classifications.push({
        class: 'square_like',
        probability: 0.9,
        percentage: '90.00',
        description: '方形圖片'
      });
    }
    
    // 圖片大小分類
    const totalPixels = metadata.width * metadata.height;
    if (totalPixels < 100000) {
      classifications.push({
        class: 'small_image',
        probability: 0.9,
        percentage: '90.00',
        description: '小尺寸圖片'
      });
    } else if (totalPixels > 1000000) {
      classifications.push({
        class: 'large_image',
        probability: 0.9,
        percentage: '90.00',
        description: '大尺寸圖片'
      });
    } else {
      classifications.push({
        class: 'medium_image',
        probability: 0.8,
        percentage: '80.00',
        description: '中等尺寸圖片'
      });
    }
    
    return classifications.slice(0, config.imageClassifier.topK);
  } catch (error) {
    throw new Error(`圖片分類失敗: ${error.message}`);
  }
}

// Middleware
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// 圖片分類 API 端點
app.post('/api/classify/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '請上傳圖片檔案'
      });
    }

    const results = await classifyImage(req.file.buffer);
    
    res.json({
      success: true,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      classifications: results
    });
  } catch (error) {
    console.error('圖片分類錯誤:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/classify/url', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: '請提供圖片URL'
      });
    }

    // 下載圖片
    const axios = require('axios');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const results = await classifyImage(Buffer.from(response.data));
    
    res.json({
      success: true,
      url: imageUrl,
      size: response.data.length,
      classifications: results
    });
  } catch (error) {
    console.error('URL圖片分類錯誤:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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
  console.log(`Image Classifier: Ready for image analysis`);
}); 