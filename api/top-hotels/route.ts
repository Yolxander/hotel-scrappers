import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    // Get top 3 hotels by rating and reviews
    const { data: topHotels, error } = await supabase
      .from('daily_hotel_deals')
      .select('*')
      .order('rating', { ascending: false })
      .order('reviews', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Error fetching top hotels:', error);
      return NextResponse.json(
        { error: 'Failed to fetch top hotels' },
        { status: 500 }
      );
    }

    // Get remaining hotels for the 5-star section
    const { data: remainingHotels, error: remainingError } = await supabase
      .from('daily_hotel_deals')
      .select('*')
      .order('rating', { ascending: false })
      .order('reviews', { ascending: false })
      .range(3, 8); // Get 6 more hotels for the 5-star section

    if (remainingError) {
      console.error('Error fetching remaining hotels:', remainingError);
      return NextResponse.json(
        { error: 'Failed to fetch remaining hotels' },
        { status: 500 }
      );
    }

    // Get the destination from the first hotel (they should all have the same destination)
    const destination = topHotels[0]?.destination || '';

    return NextResponse.json({
      topHotels,
      remainingHotels,
      destination
    });
  } catch (error) {
    console.error('Error in top-hotels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hotels' },
      { status: 500 }
    );
  }
} 