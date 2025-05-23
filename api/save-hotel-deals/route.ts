import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const { hotelDeals, destination, checkIn, checkOut, travelers } = await request.json();

    // Prepare the data for insertion
    const dealsToInsert = hotelDeals.map((deal: any) => ({
      name: deal.name,
      price: deal.price,
      rating: deal.rating,
      reviews: deal.reviews,
      deal: deal.deal,
      url: deal.url,
      image: deal.image,
      location: deal.location,
      amenities: deal.amenities,
      description: deal.description,
      destination,
      check_in_date: checkIn,
      check_out_date: checkOut,
      travelers: parseInt(travelers)
    }));

    // Insert the deals into the database
    const { data, error } = await supabase
      .from('daily_hotel_deals')
      .insert(dealsToInsert);

    if (error) {
      console.error('Error saving hotel deals:', error);
      return NextResponse.json(
        { error: 'Failed to save hotel deals' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Hotel deals saved successfully',
      count: dealsToInsert.length 
    });
  } catch (error) {
    console.error('Error in save-hotel-deals:', error);
    return NextResponse.json(
      { error: 'Failed to save hotel deals' },
      { status: 500 }
    );
  }
} 