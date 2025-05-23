import { NextResponse } from 'next/server';
import main from '@/scripts/agentql/test';

export async function POST(request: Request) {
  try {
    const { destination, checkInDate, checkOutDate, originalPrice } = await request.json();

    if (!destination || !checkInDate || !checkOutDate || !originalPrice) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('Executing scraper with params:', { destination, checkInDate, checkOutDate, originalPrice });

    // Call the main function directly
    const results = await main(destination, checkInDate, checkOutDate);
    
    // Return the results
    return NextResponse.json({ rawData: JSON.stringify(results) });
  } catch (error) {
    console.error('Error in scrape route:', error);
    return NextResponse.json(
      { error: 'Failed to scrape hotel data' },
      { status: 500 }
    );
  }
} 