'use client';

import '@mysten/dapp-kit/dist/index.css';

import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Every Sui read and transaction execution from the browser is routed through our
// same-origin /api/rpc proxy, which forwards JSON-RPC to the Tatum Sui gateway with
// the server-side TATUM_API_KEY attached (see app/api/rpc/route.ts). This means 100%
// of the dApp's on-chain traffic flows through Tatum, while the key never ships to
// the browser (the proxy falls back to a public fullnode only if no key is set).
const { networkConfig } = createNetworkConfig({
  testnet: { url: '/api/rpc' },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
