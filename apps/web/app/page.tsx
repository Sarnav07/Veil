'use client';

import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

export default function Home() {
  const account = useCurrentAccount();

  return (
    <main className="container">
      <h1 className="brand">VEIL</h1>
      <p className="tagline">Bids no one can see, size, or trace — until the auction closes.</p>

      <ConnectButton />

      {account ? (
        <p className="address">Connected: {account.address}</p>
      ) : (
        <p className="muted">Connect a Sui wallet to begin.</p>
      )}
    </main>
  );
}
