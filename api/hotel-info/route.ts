import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

export async function POST(request: Request) {
  try {
    const { destination } = await request.json();
    console.log('Scraping hotel info for:', destination);

    const browser = await puppeteer.launch({
      headless: true // Make browser visible
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

    // Wait for and click the About tab
    await page.waitForSelector('div[jsname="AznF2e"][aria-label="About"]', { timeout: 15000 });
    console.log('Found About tab');
    
    await page.click('div[jsname="AznF2e"][aria-label="About"]');
    console.log('Clicked About tab');

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
      const websiteLink = aboutSection.querySelector('a[aria-label="Website"]') as HTMLAnchorElement;
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
      return NextResponse.json({ error: 'Could not find hotel information' }, { status: 404 });
    }

    console.log('Returning hotel info:', hotelInfo);
    return NextResponse.json({ hotelInfo });
  } catch (error) {
    console.error('Error scraping hotel info:', error);
    return NextResponse.json(
      { error: 'Failed to scrape hotel information' },
      { status: 500 }
    );
  }
} 