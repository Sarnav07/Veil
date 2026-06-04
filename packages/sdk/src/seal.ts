import { SealClient, type SessionKey } from '@mysten/seal';
import { bcs } from '@mysten/sui/bcs';
import type { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toHex } from './bid';

export interface SealConfig {
  suiClient: SuiClient;
  keyServerObjectIds: string[];
  // Published veil package id (the one defining seal_policy::seal_approve).
  packageId: string;
  threshold?: number;
}

// bcs(u64) little-endian — must match veil::seal_policy::time_lock_id.
export function timeLockId(closeMs: bigint): Uint8Array {
  return bcs.u64().serialize(closeMs).toBytes();
}

// Wraps Seal so a bid can be sealed to an auction's close time and later
// unsealed once that time has passed.
export class SealVault {
  private readonly client: SealClient;
  private readonly threshold: number;

  constructor(private readonly config: SealConfig) {
    this.client = new SealClient({
      suiClient: config.suiClient,
      serverConfigs: config.keyServerObjectIds.map((objectId) => ({ objectId, weight: 1 })),
      verifyKeyServers: false,
    });
    this.threshold = config.threshold ?? config.keyServerObjectIds.length;
  }

  // Encrypt a bid payload; the returned ciphertext is what gets stored on Walrus.
  async sealBid(payload: Uint8Array, closeMs: bigint): Promise<Uint8Array> {
    const { encryptedObject } = await this.client.encrypt({
      threshold: this.threshold,
      packageId: this.config.packageId,
      id: `0x${toHex(timeLockId(closeMs))}`,
      data: payload,
    });
    return encryptedObject;
  }

  // Decrypt a sealed bid after close. Key servers run seal_approve against the
  // built transaction and only release a key if the close time has passed.
  async unsealBid(
    ciphertext: Uint8Array,
    closeMs: bigint,
    sessionKey: SessionKey,
  ): Promise<Uint8Array> {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::seal_policy::seal_approve`,
      arguments: [
        tx.pure.vector('u8', Array.from(timeLockId(closeMs))),
        tx.object('0x6'),
      ],
    });
    const txBytes = await tx.build({ client: this.config.suiClient, onlyTransactionKind: true });
    return this.client.decrypt({ data: ciphertext, sessionKey, txBytes });
  }
}
