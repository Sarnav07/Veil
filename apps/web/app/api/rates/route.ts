import { NextResponse } from 'next/server';

export async function GET() {
  const TATUM_API_KEY = process.env.TATUM_API_KEY;

  if (!TATUM_API_KEY) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      'https://api.tatum.io/v3/tatum/rate/SUI?basePair=USD',
      {
        headers: {
          'x-api-key': TATUM_API_KEY,
        },
        next: {
          revalidate: 60, // Cache for 60 seconds
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch exchange rate' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ rate: Number(data.value) });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
