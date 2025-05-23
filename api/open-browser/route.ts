import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

export async function POST(request: Request) {
  try {
    const { destination, location, checkInDate, checkOutDate, roomType } = await request.json();
    console.log('Opening browser with parameters:', { destination, location, checkInDate, checkOutDate, roomType });

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

    const page = await context.newPage();

    // Override navigator.webdriver to prevent detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });

    // Navigate to Google
    await page.goto('https://www.google.com', { waitUntil: 'networkidle' });

    // Search for the hotel
    const searchQuery = `${destination} ${location} hotel`;
    await page.fill('textarea[name="q"]', searchQuery);
    await page.press('textarea[name="q"]', 'Enter');

    // Wait for search results
    await page.waitForTimeout(3000);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error opening browser:', error);
    return NextResponse.json(
      { error: 'Failed to open browser' },
      { status: 500 }
    );
  }
} 