import type { Transaction } from '@mysten/sui/transactions';

export const LaunchTxBuilder = {
  create(
    tx: Transaction,
    packageId: string,
    args: { supplyCoin: string; closeMs: bigint; deposit: bigint; coinType: string; clock?: string },
  ) {
    tx.moveCall({
      target: `${packageId}::veil_launch::create`,
      typeArguments: [args.coinType],
      arguments: [
        tx.object(args.supplyCoin),
        tx.pure.u64(args.closeMs),
        tx.pure.u64(args.deposit),
        tx.object(args.clock ?? '0x6'),
      ],
    });
  },

  submitBid(
    tx: Transaction,
    packageId: string,
    args: { sale: string; depositCoin: string; blobId: Uint8Array; commitment: Uint8Array; coinType: string; clock?: string },
  ) {
    tx.moveCall({
      target: `${packageId}::veil_launch::submit_bid`,
      typeArguments: [args.coinType],
      arguments: [
        tx.object(args.sale),
        tx.object(args.depositCoin),
        tx.pure.vector('u8', Array.from(args.blobId)),
        tx.pure.vector('u8', Array.from(args.commitment)),
        tx.object(args.clock ?? '0x6'),
      ],
    });
  },

  close(
    tx: Transaction,
    packageId: string,
    args: { sale: string; coinType: string; clock?: string },
  ) {
    tx.moveCall({
      target: `${packageId}::veil_launch::close`,
      typeArguments: [args.coinType],
      arguments: [tx.object(args.sale), tx.object(args.clock ?? '0x6')],
    });
  },

  settle(
    tx: Transaction,
    packageId: string,
    args: { sale: string; prices: bigint[]; quantities: bigint[]; nonces: Uint8Array[]; coinType: string },
  ) {
    tx.moveCall({
      target: `${packageId}::veil_launch::settle`,
      typeArguments: [args.coinType],
      arguments: [
        tx.object(args.sale),
        tx.pure.vector(
          'u64',
          args.prices.map((p) => p.toString()),
        ),
        tx.pure.vector(
          'u64',
          args.quantities.map((q) => q.toString()),
        ),
        tx.pure.vector(
          'vector<u8>',
          args.nonces.map((n) => Array.from(n)),
        ),
      ],
    });
  },
};

export const OtcTxBuilder = {
  create(
    tx: Transaction,
    packageId: string,
    args: { assetCoin: string; reserve: bigint; reserveNonce: Uint8Array; closeMs: bigint; deposit: bigint; coinType: string; clock?: string },
  ) {
    tx.moveCall({
      target: `${packageId}::veil_otc::create`,
      typeArguments: [args.coinType],
      arguments: [
        tx.object(args.assetCoin),
        tx.pure.u64(args.reserve),
        tx.pure.vector('u8', Array.from(args.reserveNonce)),
        tx.pure.u64(args.closeMs),
        tx.pure.u64(args.deposit),
        tx.object(args.clock ?? '0x6'),
      ],
    });
  },

  submitQuote(
    tx: Transaction,
    packageId: string,
    args: { rfq: string; depositCoin: string; blobId: Uint8Array; commitment: Uint8Array; coinType: string; clock?: string },
  ) {
    tx.moveCall({
      target: `${packageId}::veil_otc::submit_quote`,
      typeArguments: [args.coinType],
      arguments: [
        tx.object(args.rfq),
        tx.object(args.depositCoin),
        tx.pure.vector('u8', Array.from(args.blobId)),
        tx.pure.vector('u8', Array.from(args.commitment)),
        tx.object(args.clock ?? '0x6'),
      ],
    });
  },

  close(
    tx: Transaction,
    packageId: string,
    args: { rfq: string; coinType: string; clock?: string },
  ) {
    tx.moveCall({
      target: `${packageId}::veil_otc::close`,
      typeArguments: [args.coinType],
      arguments: [tx.object(args.rfq), tx.object(args.clock ?? '0x6')],
    });
  },

  settle(
    tx: Transaction,
    packageId: string,
    args: { rfq: string; prices: bigint[]; nonces: Uint8Array[]; reserve: bigint; reserveNonce: Uint8Array; coinType: string },
  ) {
    tx.moveCall({
      target: `${packageId}::veil_otc::settle`,
      typeArguments: [args.coinType],
      arguments: [
        tx.object(args.rfq),
        tx.pure.vector(
          'u64',
          args.prices.map((p) => p.toString()),
        ),
        tx.pure.vector(
          'vector<u8>',
          args.nonces.map((n) => Array.from(n)),
        ),
        tx.pure.u64(args.reserve),
        tx.pure.vector('u8', Array.from(args.reserveNonce)),
      ],
    });
  },
};
