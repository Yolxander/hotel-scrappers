import { NextResponse } from 'next/server';
const { wrap, configure } = require('agentql');
const { chromium } = require('playwright');

export async function POST(request: Request) {
  let browser;
  try {
    const { destination, checkIn, checkOut, travelers } = await request.json();

    // Configure AgentQL
    configure({
      apiKey: process.env.AGENTQL_API_KEY || 'LvB1kXDgNqditROfZ5MzavRZB0JC1BWNyUp6zwGojwUTFI2_bhGPPA',
    });

    // Launch browser
    browser = await chromium.launch({ headless: false });
    const page = await wrap(await browser.newPage());

    // Navigate to hotels.com
    await page.goto('https://www.hotels.com');

    // Define query for hotel results
    const QUERY = `
    {
      hotels[] {
        name
        price
        rating
        location
        image
        booking_url
      }
    }`;

    // Get hotel data
    const hotelData = await page.queryData(QUERY);
    console.log('Hotel data:', hotelData);

    return NextResponse.json({ hotels: hotelData.hotels || [] });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch hotel information' },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
} 