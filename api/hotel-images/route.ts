import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    return response.ok && contentType !== null && contentType.startsWith('image/');
  } catch (error) {
    console.error('Error validating image URL:', url, error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { destination } = await request.json();
    console.log('Scraping hotel images for:', destination);

    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to Google Travel search
    const searchUrl = `https://www.google.com/travel/search?q=${encodeURIComponent(destination)}`;
    console.log('Navigating to:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'networkidle0' });
    console.log('Page loaded');

    // First check if Photos tab is already visible
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
      return NextResponse.json({ error: 'Could not find hotel images' }, { status: 404 });
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
    const validImages = validatedImages.filter((image): image is typeof image => image !== null);

    if (validImages.length === 0) {
      console.log('No valid hotel images found after validation');
      return NextResponse.json({ error: 'Could not find valid hotel images' }, { status: 404 });
    }

    console.log('Returning validated hotel images:', validImages);
    return NextResponse.json({ hotelImages: validImages });
  } catch (error) {
    console.error('Error scraping hotel images:', error);
    return NextResponse.json(
      { error: 'Failed to scrape hotel images' },
      { status: 500 }
    );
  }
} 