const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Documentation endpoint
app.get('/api/hotel-info', (req, res) => {
  res.json({
    message: 'Welcome to the Hotel Info API',
    usage: {
      method: 'POST',
      endpoint: '/api/hotel-info',
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        destination: 'Hotel name or location (e.g., "Hilton New York")'
      }
    },
    example: {
      curl: 'curl -X POST http://localhost:3001/api/hotel-info -H "Content-Type: application/json" -d \'{"destination": "Hilton New York"}\'',
      fetch: `fetch('http://localhost:3001/api/hotel-info', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    destination: 'Hilton New York'
  })
})`
    }
  });
});

// Hotel info endpoint
app.post('/api/hotel-info', async (req, res) => {
  try {
    const { destination } = req.body;
    
    if (!destination) {
      return res.status(400).json({ 
        error: 'Missing required parameter: destination',
        example: { destination: 'Hilton New York' }
      });
    }

    console.log('Scraping hotel info for:', destination);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate directly to Google Travel search
    const searchUrl = `https://www.google.com/travel/search?q=${encodeURIComponent(destination)}`;
    
    console.log('Navigating to:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'networkidle0' });
    console.log('Page loaded');

    // First check if About tab is already visible
    const aboutTabExists = await page.evaluate(() => {
      const aboutTab = document.querySelector('div[aria-label="About"]');
      return !!aboutTab;
    });

    if (aboutTabExists) {
      console.log('About tab already exists, clicking it directly');
      await page.click('div[aria-label="About"]');
    } else {
      // If About tab is not visible, click the hotel entity link first
      await page.waitForSelector('a[data-href^="/entity/C"][href^="/travel/search?"]', { timeout: 15000 });
      console.log('Found hotel entity link');
      
      await page.click('a[data-href^="/entity/C"][href^="/travel/search?"]');
      console.log('Clicked hotel entity link');

      // Wait for the hotel page to load
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      console.log('Hotel page loaded');

      // Now wait for and click the About tab
      await page.waitForSelector('div[aria-label="About"]', { timeout: 15000 });
      console.log('Found About tab');
      
      await page.click('div[aria-label="About"]');
      console.log('Clicked About tab');
    }

    // Wait for the About section to load
    await page.waitForSelector('section.mEKuwe', { timeout: 15000 });
    console.log('About section loaded');

    // Extract hotel information
    const hotelInfo = await page.evaluate(() => {
      const aboutSection = document.querySelector('section.mEKuwe');
      if (!aboutSection) {
        console.log('About section not found');
        return null;
      }

      // Get hotel description
      const description = Array.from(aboutSection.querySelectorAll('.GtAk2e'))
        .map(el => el.textContent)
        .filter(Boolean)
        .join('\n\n');
      console.log('Found description:', description);

      // Get check-in/out times
      const checkInTime = aboutSection.querySelector('.b9tWsd:nth-child(1) .IIl29e')?.textContent || '';
      const checkOutTime = aboutSection.querySelector('.b9tWsd:nth-child(2) .IIl29e')?.textContent || '';
      console.log('Found check-in/out times:', { checkInTime, checkOutTime });

      // Get address and contact
      const address = aboutSection.querySelector('.XGa8fd[aria-label*="hotel address"]')?.textContent || '';
      const phone = aboutSection.querySelector('.XGa8fd[aria-label*="call this hotel"]')?.textContent || '';
      console.log('Found address and phone:', { address, phone });

      // Get website URL
      const websiteLink = aboutSection.querySelector('a[aria-label="Website"]');
      const websiteUrl = websiteLink?.href || '';
      console.log('Found website URL:', websiteUrl);

      return {
        description,
        checkInTime,
        checkOutTime,
        address,
        phone,
        websiteUrl
      };
    });

    // Wait a bit before closing to see the results
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await browser.close();
    console.log('Browser closed');

    if (!hotelInfo) {
      console.log('No hotel info found');
      return res.status(404).json({ 
        error: 'Could not find hotel information',
        message: 'The hotel information could not be found. Please try a different hotel name or location.'
      });
    }

    console.log('Returning hotel info:', hotelInfo);
    res.json({ hotelInfo });
  } catch (error) {
    console.error('Error scraping hotel info:', error);
    res.status(500).json({ 
      error: 'Failed to scrape hotel information',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Start server with error handling
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`API Documentation: http://localhost:${port}/api/hotel-info`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please try a different port by setting the PORT environment variable.`);
    process.exit(1);
  } else {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}); 