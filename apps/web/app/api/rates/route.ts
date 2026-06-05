import { NextResponse } from 'next/server';

/**
 * SUI/USD exchange rate via Tatum's Data API — the "Data" half of the
 * Tatum integration. The rate drives live USD conversions in the bid UI.
 *
 * The endpoint is demo-resilient: if the key is missing or Tatum is briefly
 * unreachable, we return the last-known good rate flagged `stale: true` instead
 * of a 500, so the UI never shows a broken "$0.00" or a raw error on camera.
 */
const FALLBACK_RATE = 3.45; // last-known SUI/USD, used only if Tatum is unreachable

function ok(rate: number, stale = false) {
  return NextResponse.json({ rate, stale });
}

export async function GET() {
  const TATUM_API_KEY = process.env.TATUM_API_KEY;

  if (!TATUM_API_KEY) {
    return ok(FALLBACK_RATE, true);
  }

  try {
    const response = await fetch(
      'https://api.tatum.io/v3/tatum/rate/SUI?basePair=USD',
      {
        headers: { 'x-api-key': TATUM_API_KEY },
        next: { revalidate: 60 }, // cache for 60s
      }
    );

    if (!response.ok) {
      return ok(FALLBACK_RATE, true);
    }

    const data = (await response.json()) as { value?: string } | null;
    const rate = Number(data?.value);

    if (!Number.isFinite(rate) || rate <= 0) {
      return ok(FALLBACK_RATE, true);
    }

    return ok(rate);
  } catch {
    return ok(FALLBACK_RATE, true);
  }
}
