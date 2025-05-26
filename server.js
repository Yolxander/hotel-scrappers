const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fetch = require('node-fetch');
const { chromium } = require('playwright');

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(cors());

// Root route handler
app.get('/', (req, res) => {
  res.redirect('/api/hotel-info');
});

// Helper function to validate image URLs
async function validateImageUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    return response.ok && contentType !== null && contentType.startsWith('image/');
  } catch (error) {
    console.error('Error validating image URL:', url, error);
    return false;
  }
}

// Documentation endpoint
app.get('/api/hotel-info', (req, res) => {
  res.json({
    message: 'Welcome to the Hotel Info API Scrapper',
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
      curl: 'curl -X POST http://localhost:3002/api/hotel-info -H "Content-Type: application/json" -d \'{"destination": "Hilton New York"}\'',
      fetch: `fetch('http://localhost:3002/api/hotel-info', {
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

// Hotel images endpoint
app.post('/api/hotel-images', async (req, res) => {
  try {
    const { destination } = req.body;
    
    if (!destination) {
      return res.status(400).json({ 
        error: 'Missing required parameter: destination',
        example: { destination: 'Hilton New York' }
      });
    }

    console.log('Scraping hotel images for:', destination);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to Google Travel search
    const searchUrl = `https://www.google.com/travel/search?q=${encodeURIComponent(destination)}`;
    console.log('Navigating to:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'networkidle0' });
    console.log('Page loaded');

    // First check if there's an entity link
    const entityLinkExists = await page.evaluate(() => {
      const entityLink = document.querySelector('a[data-href^="/entity/Ch"]');
      console.log('Found entity link:', entityLink);
      return !!entityLink;
    });

    console.log('Entity link exists:', entityLinkExists);

    if (entityLinkExists) {
      console.log('Attempting to click entity link...');
      
      // Wait for the element to be visible and clickable
      await page.waitForSelector('a[data-href^="/entity/Ch"]', { 
        visible: true,
        timeout: 10000 
      });
      
      // Try clicking with different methods
      try {
        // Method 1: Direct click
        await page.click('a[data-href^="/entity/Ch"]');
        console.log('Direct click successful');
      } catch (error) {
        console.log('Direct click failed, trying alternative method...');
        try {
          // Method 2: Click using evaluate
          await page.evaluate(() => {
            const link = document.querySelector('a[data-href^="/entity/Ch"]');
            if (link) {
              console.log('Found link in evaluate:', link);
              link.click();
            }
          });
          console.log('Evaluate click successful');
        } catch (error) {
          console.log('Evaluate click failed:', error);
          // Method 3: Click using mouse events
          const element = await page.$('a[data-href^="/entity/Ch"]');
          if (element) {
            await element.click({ delay: 100 });
            console.log('Mouse event click successful');
          }
        }
      }

      console.log('Waiting for navigation after click...');
      // Wait for the hotel page to load
      await page.waitForNavigation({ 
        waitUntil: 'networkidle0',
        timeout: 15000 
      }).catch(error => {
        console.log('Navigation timeout, but continuing...', error);
      });
      console.log('Hotel page loaded');
    }

    // Then check if Photos tab is already visible
    const photosTabExists = await page.evaluate(() => {
      const photosTab = document.querySelector('[aria-label="Photos"][id="photos"]');
      return !!photosTab;
    });

    if (photosTabExists) {
      console.log('Photos tab already exists, clicking it directly');
      await page.click('[aria-label="Photos"][id="photos"]');
    } else {
      // If Photos tab is not visible, click the hotel entity link first
      await page.waitForSelector('a[data-href^="/entity/C"][href^="/travel/search?"]', { timeout: 15000 });
      console.log('Found hotel entity link');
      
      await page.click('a[data-href^="/entity/C"][href^="/travel/search?"]');
      console.log('Clicked hotel entity link');

      // Wait for the hotel page to load
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      console.log('Hotel page loaded');

      // Now wait for and click the Photos tab
      await page.waitForSelector('[aria-label="Photos"][id="photos"]', { timeout: 15000 });
      console.log('Found Photos tab');
      
      await page.click('[aria-label="Photos"][id="photos"]');
      console.log('Clicked Photos tab');
    }

    // Wait for the photos section to load
    await page.waitForSelector('[data-hotel-feature-id]', { timeout: 15000 });
    console.log('Photos section loaded');

    // Extract hotel images
    const hotelImages = await page.evaluate(() => {
      const imageElements = document.querySelectorAll('img[alt^="Photo "]');
      const images = Array.from(imageElements)
        .map(img => {
          const url = img.getAttribute('src') || '';
          return {
            url: url,
            alt: img.getAttribute('alt') || '',
            caption: img.closest('[data-hotel-feature-id]')?.textContent || ''
          };
        })
        .slice(0, 10); // Take the first 10 images

      console.log('Found images:', images);
      return images;
    });

    // Wait a bit before closing to see the results
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await browser.close();
    console.log('Browser closed');

    if (!hotelImages || hotelImages.length === 0) {
      console.log('No hotel images found');
      return res.status(404).json({ 
        error: 'Could not find hotel images',
        message: 'No images were found for the specified hotel. Please try a different hotel name or location.'
      });
    }

    // Validate image URLs
    console.log('Validating image URLs...');
    const validatedImages = await Promise.all(
      hotelImages.map(async (image) => {
        const isValid = await validateImageUrl(image.url);
        return isValid ? image : null;
      })
    );

    // Filter out invalid images
    const validImages = validatedImages.filter(image => image !== null);

    if (validImages.length === 0) {
      console.log('No valid hotel images found after validation');
      return res.status(404).json({ 
        error: 'Could not find valid hotel images',
        message: 'No valid images were found after validation. Please try a different hotel name or location.'
      });
    }

    console.log('Returning validated hotel images:', validImages);
    res.json({ hotelImages: validImages });
  } catch (error) {
    console.error('Error scraping hotel images:', error);
    res.status(500).json({ 
      error: 'Failed to scrape hotel images',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Hotel prices endpoint
app.post('/api/hotel-prices', async (req, res) => {
  try {
    const { hotelName, location, checkInDate, checkOutDate } = req.body;

    if (!hotelName || !location || !checkInDate || !checkOutDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: {
          hotelName: 'Name of the hotel',
          location: 'City or location',
          checkInDate: 'Check-in date (YYYY-MM-DD)',
          checkOutDate: 'Check-out date (YYYY-MM-DD)'
        }
      });
    }

    console.log('Scraping hotel prices for:', { hotelName, location, checkInDate, checkOutDate });

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    });

    await context.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    const page = await context.newPage();

    // Navigate directly to Google Travel search with both hotel name and location
    const searchQuery = `${hotelName} ${location}`;
    const searchUrl = `https://www.google.com/travel/search?q=${encodeURIComponent(searchQuery)}`;
    console.log('Navigating to:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'networkidle' });

    // Wait for search results
    await page.waitForTimeout(3000);

    // First check if there's an entity link
    const entityLinkExists = await page.evaluate(() => {
      const entityLink = document.querySelector('a[data-href^="/entity/Ch"]');
      console.log('Found entity link:', entityLink);
      return !!entityLink;
    });

    console.log('Entity link exists:', entityLinkExists);

    if (entityLinkExists) {
      console.log('Attempting to click entity link...');
      
      // Wait for the element to be visible and clickable
      await page.waitForSelector('a[data-href^="/entity/Ch"]', { 
        visible: true,
        timeout: 10000 
      });
      
      // Try clicking with different methods
      try {
        // Method 1: Direct click
        await page.click('a[data-href^="/entity/Ch"]');
        console.log('Direct click successful');
      } catch (error) {
        console.log('Direct click failed, trying alternative method...');
        try {
          // Method 2: Click using evaluate
          await page.evaluate(() => {
            const link = document.querySelector('a[data-href^="/entity/Ch"]');
            if (link) {
              console.log('Found link in evaluate:', link);
              link.click();
            }
          });
          console.log('Evaluate click successful');
        } catch (error) {
          console.log('Evaluate click failed:', error);
          // Method 3: Click using mouse events
          const element = await page.$('a[data-href^="/entity/Ch"]');
          if (element) {
            await element.click({ delay: 100 });
            console.log('Mouse event click successful');
          }
        }
      }

      console.log('Waiting for navigation after click...');
      // Wait for the hotel page to load
      await page.waitForNavigation({ 
        waitUntil: 'networkidle0',
        timeout: 15000 
      }).catch(error => {
        console.log('Navigation timeout, but continuing...', error);
      });
      console.log('Hotel page loaded');

      // Now wait for and click the Prices tab
      try {
        console.log('Looking for Prices tab...');
        const pricesTab = await page.waitForSelector('[aria-label="Prices"][id="prices"]', { timeout: 5000 });
        if (pricesTab) {
          console.log('Found Prices tab, clicking...');
          await pricesTab.click();
        }
      } catch (error) {
        console.error('Error clicking prices tab:', error);
      }

      // Wait for prices to load
      await page.waitForTimeout(3000);
    } else {
      console.log('No entity link found, trying to find Prices tab directly...');
      // Try to find Prices tab directly if no entity link
      try {
        console.log('Looking for Prices tab...');
        const pricesTab = await page.waitForSelector('[aria-label="Prices"][id="prices"]', { timeout: 5000 });
        if (pricesTab) {
          console.log('Found Prices tab, clicking...');
          await pricesTab.click();
        }
      } catch (error) {
        console.error('Error clicking prices tab:', error);
      }

      // Wait for prices to load
      await page.waitForTimeout(3000);
    }

    // Get price listings
    console.log('Scraping price listings...');
    const priceListings = await page.evaluate(() => {
      // Find the first div that contains at least one 'a' with href starting with "/aclk?"
      const providerSection = Array.from(document.querySelectorAll('div')).find(div =>
        div.querySelector('a[href^="/aclk?"]')
      );
      
      if (!providerSection) {
        console.log('No provider section found');
        return [];
      }

      // Get provider name using text-based identification
      const providerName = Array.from(providerSection.querySelectorAll('span'))
        .map(s => s.textContent?.trim())
        .find(t => t && (
          t.toLowerCase().includes('.com') ||
          t.toLowerCase().includes('booking') ||
          t.toLowerCase().includes('expedia') ||
          t.toLowerCase().includes('priceline')
        )) || 'Unknown Provider';

      // Get provider logo from first img tag
      const providerLogo = providerSection.querySelector('img')?.getAttribute('src') || '';
      console.log('Found provider:', providerName);
      console.log('Provider logo:', providerLogo);

      // Get provider features and info
      const features = [];
      const support = [];
      let memberDeals;

      Array.from(providerSection.querySelectorAll('span')).forEach(span => {
        const text = span.textContent?.trim() || '';
        if (!text) return;
      
        if (text.includes('Customer support:')) {
          const supportItems = text.replace('Customer support:', '')
            .split('·')
            .map(item => item.trim())
            .filter(Boolean);
          support.push(...supportItems);
          console.log('Found support options:', supportItems);
        } else if (
          text.toLowerCase().includes('member deal') ||
          text.toLowerCase().includes('member price')
        ) {
          memberDeals = text;
          console.log('Found member deals:', text);
        } else {
          // Optionally filter out price spans (starts with "$" or "nightly")
          if (/^\$/.test(text) || text.toLowerCase().includes('nightly')) return;
          features.push(text);
          console.log('Found feature:', text);
        }
      });
      
      // Get all room listings using the correct selector
      const rooms = Array.from(providerSection.querySelectorAll('a[href^="/aclk?"]')).map(room => {
        // Get room type using structural selectors
        let type = null;
        try {
          type = room.children[0]?.children[0]?.querySelector('div')?.textContent?.trim() ||
                 room.querySelector('div > div > div')?.textContent?.trim() ||
                 'Unknown Room Type';
        } catch (e) {
          type = 'Unknown Room Type';
        }
        console.log('\nProcessing room:', type);
        
        // Get prices using text-based identification
        const allSpans = Array.from(room.querySelectorAll('span'));
        const basePrice = allSpans
          .map(s => s.textContent?.trim())
          .find(t => t && t.includes('$') && !t.toLowerCase().includes('taxes')) || '';
        
        const totalPrice = allSpans
          .map(s => s.textContent?.trim())
          .find(t => t && t.includes('$') && t.toLowerCase().includes('taxes')) || basePrice;
        
        console.log('Base price:', basePrice);
        console.log('Total price:', totalPrice);

        // Get cancellation policy and features
        const roomFeatures = [];
        let cancellationPolicy;

        Array.from(providerSection.querySelectorAll('span')).forEach(span => {
          const text = span.textContent?.trim() || '';
          if (!text) return;

          if (text.includes('Customer support:')) {
            const supportItems = text.replace('Customer support:', '')
              .split('·')
              .map(item => item.trim())
              .filter(Boolean);
            support.push(...supportItems);
            console.log('Found support options:', supportItems);
          } else if (
            text.toLowerCase().includes('member deal') ||
            text.toLowerCase().includes('member price')
          ) {
            memberDeals = text;
            console.log('Found member deals:', text);
          } else {
            // Optionally filter out price spans (starts with "$" or "nightly")
            if (/^\$/.test(text) || text.toLowerCase().includes('nightly')) return;
            features.push(text);
            console.log('Found feature:', text);
          }
        });

        // Get the full URL
        const relativeUrl = room.getAttribute('href') || '';
        const url = relativeUrl.startsWith('http') ? relativeUrl : `https://www.google.com/travel${relativeUrl}`;

        const roomData = {
          type,
          basePrice,
          totalPrice,
          url,
          cancellationPolicy,
          features: roomFeatures.length > 0 ? roomFeatures : undefined
        };
        console.log('Room data:', JSON.stringify(roomData, null, 2));
        return roomData;
      });

      const result = [{
        rooms
      }];

      console.log('Final result:', JSON.stringify(result, null, 2));
      return result;
    });

    console.log('Found price listings:', JSON.stringify(priceListings, null, 2));
    await browser.close();

    if (!priceListings || priceListings.length === 0) {
      return res.status(404).json({ 
        error: 'Could not find hotel prices',
        message: 'No price listings were found for the specified hotel. Please try a different hotel name or location.'
      });
    }

    res.json({ prices: priceListings });
  } catch (error) {
    console.error('Scraper error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch hotel prices',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Hotel suggestions endpoint
app.post('/api/hotel-suggestions', async (req, res) => {
  try {
    const { destination, checkIn, checkOut, travelers } = req.body;
    console.log('Starting scraper with parameters:', { destination, checkIn, checkOut, travelers });

    // Format dates to "Month Day" format
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', { month: 'long', day: 'numeric' });
    };

    const browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--hide-scrollbars',
        '--disable-notifications',
        '--disable-extensions',
        '--force-color-profile=srgb',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-blink-features=AutomationControlled',
        '--incognito'
      ]
    });
    console.log('Browser launched successfully in incognito mode');

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      geolocation: { longitude: -74.006, latitude: 40.7128 },
      permissions: ['geolocation'],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"'
      }
    });
    console.log('Browser context created with custom settings');

    // Add random delays between actions with more human-like timing
    const randomDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

    const page = await context.newPage();
    console.log('New page created');

    // Override navigator.webdriver to prevent detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });
    console.log('Webdriver detection disabled');

    // Enable request interception with more selective blocking
    await page.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      
      // Only block certain resources that aren't essential
      if (['media', 'font'].includes(resourceType)) {
        await route.abort();
      } else {
        await route.continue();
      }
    });
    console.log('Request interception enabled');

    // First visit Google homepage and wait
    console.log('Navigating to Google homepage...');
    await page.goto('https://www.google.com', { waitUntil: 'networkidle' });
    await randomDelay();
    console.log('Successfully loaded Google homepage');

    // Simulate human-like mouse movements
    await page.mouse.move(Math.random() * 500, Math.random() * 500);
    await randomDelay();
    console.log('Simulated mouse movement');

    // Type the search query with human-like delays
    const formattedCheckIn = formatDate(checkIn);
    const formattedCheckOut = formatDate(checkOut);
    const searchQuery = `best hotel deals in ${destination} ${formattedCheckIn} to ${formattedCheckOut}`;
    console.log('Preparing to search for:', searchQuery);
    
    const searchInput = await page.waitForSelector('textarea[name="q"]');
    console.log('Found search input field');
    
    // Type each character with random delays
    for (const char of searchQuery) {
      await searchInput.type(char, { delay: Math.random() * 100 + 50 });
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
    console.log('Finished typing search query');
    
    await randomDelay();
    await page.keyboard.press('Enter');
    await randomDelay();
    console.log('Search submitted');

    // Wait for the guest selection component
    console.log('Waiting for guest selection component...');
    await page.waitForSelector('div[jsname="FtsEs"]', { timeout: 30000 });
    console.log('Found guest selection component');

    // Click the guest selection component
    await page.click('div[jsname="FtsEs"]');
    console.log('Clicked guest selection component');

    // Wait for the guest dropdown menu
    await page.waitForSelector('ul[jsname="xl07Ob"][aria-live="polite"]', { timeout: 10000 });
    console.log('Guest dropdown menu appeared');

    // Find and click the desired guest count
    const guestOptions = await page.$$('li[role="menuitemradio"]');
    for (const option of guestOptions) {
      const text = await option.textContent();
      if (text?.includes(`${travelers} guests`)) {
        await option.click();
        console.log(`Selected ${travelers} guests`);
        break;
      }
    }

    // Wait for the page to update with new guest count
    await page.waitForTimeout(3000);
    console.log('Page updated with new guest count');

    // Wait for the hotel suggestions to load
    console.log('Waiting for hotel suggestions to load...');
    try {
      await page.waitForSelector('div[class*="uaTTDe"]', { timeout: 30000 });
      console.log('Hotel suggestions container found');
    } catch (error) {
      console.error('Hotel suggestions not found:', error);
      await browser.close();
      return res.status(404).json({
        error: 'No hotel suggestions found. The search might have been blocked.'
      });
    }

    // Extract hotel suggestions
    console.log('Extracting hotel suggestions...');
    const hotelSuggestions = await page.evaluate(() => {
      const suggestions = [];
      const hotelElements = document.querySelectorAll('div[class*="uaTTDe"]');
      console.log(`Found ${hotelElements.length} hotel elements`);
      
      // Limit to 10 results
      const limitedElements = Array.from(hotelElements).slice(0, 10);
      
      limitedElements.forEach((element, index) => {
        // Extract hotel name
        const nameElement = element.querySelector('h2.BgYkof');
        const name = nameElement?.textContent || '';

        // Extract price
        const priceElement = element.querySelector('.W9vOvb.nDkDDb');
        const price = priceElement?.textContent || '';

        // Extract rating
        const ratingElement = element.querySelector('.KFi5wf');
        const rating = ratingElement?.textContent || '';

        // Extract reviews
        const reviewsElement = element.querySelector('.jdzyld');
        const reviews = reviewsElement?.textContent?.replace(/[()]/g, '') || '';

        // Extract deal
        const dealElement = element.querySelector('.PymDFe.YAMDU');
        const deal = dealElement?.textContent || '';

        // Extract URL
        const urlElement = element.querySelector('a.PVOOXe');
        const url = urlElement?.getAttribute('href') || '';

        // Extract image
        const imgElement = element.querySelector('img.x7VXS');
        const image = imgElement?.getAttribute('src') || '';

        // Extract location
        const locationElement = element.querySelector('.uTUoTb.pWBec');
        const location = locationElement?.textContent || '';

        // Extract amenities
        const amenitiesElements = element.querySelectorAll('.LtjZ2d.sSHqwe.ogfYpf.QYEgn');
        const amenities = Array.from(amenitiesElements).map(el => el.textContent || '');

        // Extract description
        const descriptionElement = element.querySelector('.lXJaOd');
        const description = descriptionElement?.textContent || '';

        const hotelData = {
          name,
          price,
          rating,
          reviews,
          deal,
          url,
          image,
          location,
          amenities,
          description
        };
        console.log(`Hotel ${index + 1}:`, hotelData);
        suggestions.push(hotelData);
      });

      return suggestions;
    });

    console.log('Found hotel suggestions:', hotelSuggestions);
    await browser.close();
    console.log('Browser closed');

    if (!hotelSuggestions || hotelSuggestions.length === 0) {
      console.log('No hotel suggestions found in the results');
      return res.status(404).json({
        error: 'No hotel suggestions found'
      });
    }

    console.log(`Successfully scraped ${hotelSuggestions.length} hotel suggestions`);
    res.json({ hotelSuggestions });
  } catch (error) {
    console.error('Error scraping hotel deals:', error);
    res.status(500).json({
      error: 'Failed to scrape hotel deals',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Start server with error handling
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please try a different port by setting the PORT environment variable.`);
    process.exit(1);
  } else {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}); 