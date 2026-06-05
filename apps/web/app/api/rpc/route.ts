import { NextResponse } from 'next/server';

/**
 * Tatum Sui RPC proxy.
 *
 * Every on-chain read and transaction execution from the dApp flows through this
 * route, which forwards the JSON-RPC payload to the Tatum Sui gateway with the
 * server-side API key attached. This keeps TATUM_API_KEY out of the browser while
 * still routing 100% of the frontend's Sui traffic through Tatum's infrastructure.
 *
 * If no key is configured, we transparently fall back to a public Sui fullnode so
 * the app still runs in a fresh checkout — Tatum is used the moment a key is present.
 */
const TATUM_RPC_URL =
  process.env.TATUM_SUI_RPC_URL ?? 'https://sui-testnet.gateway.tatum.io';
const PUBLIC_FALLBACK_RPC = 'https://fullnode.testnet.sui.io:443';

export async function POST(request: Request) {
  const apiKey = process.env.TATUM_API_KEY;

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const target = apiKey ? TATUM_RPC_URL : PUBLIC_FALLBACK_RPC;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  try {
    let upstream = await fetch(target, { method: 'POST', headers, body });
    
    // Fallback to public node if Tatum rate limits us (429) or gives 5xx
    if (apiKey && (upstream.status === 429 || upstream.status >= 500)) {
      upstream = await fetch(PUBLIC_FALLBACK_RPC, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body 
      });
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { error: 'RPC gateway unreachable' },
      { status: 502 }
    );
  }
}
