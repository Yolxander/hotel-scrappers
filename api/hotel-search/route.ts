import { NextResponse } from 'next/server';
import main from '@/scripts/agentql/test';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);

    // Handle both parameter formats
    const destination = body.destination;
    const checkInDate = body.checkInDate || body.checkIn;
    const checkOutDate = body.checkOutDate || body.checkOut;

    if (!destination || !checkInDate || !checkOutDate) {
      console.error('Missing parameters:', { destination, checkInDate, checkOutDate });
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('Starting hotel search with parameters:', {
      destination,
      checkInDate,
      checkOutDate
    });

    const results = await main(destination, checkInDate, checkOutDate);
    console.log('Search completed, found results:', results.length);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in hotel search:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search for hotels' },
      { status: 500 }
    );
  }
} 