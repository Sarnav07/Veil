/**
 * Minimal Walrus client over the testnet/mainnet HTTP API (publisher + aggregator).
 * Stores and reads raw blobs; VEIL stores each (eventually Seal-encrypted) bid and
 * each settled-auction archive record this way.
 */
export interface WalrusConfig {
  publisherUrl: string;
  aggregatorUrl: string;
}

interface StoreResponse {
  newlyCreated?: { blobObject?: { blobId?: string } };
  alreadyCertified?: { blobId?: string };
}

export class WalrusClient {
  constructor(private readonly config: WalrusConfig) {}

  /** Store a blob and return its Walrus blobId. `epochs` is the storage lifetime. */
  async store(data: Uint8Array, epochs = 1): Promise<string> {
    const res = await fetch(`${this.config.publisherUrl}/v1/blobs?epochs=${epochs}`, {
      method: 'PUT',
      body: data,
    });
    if (!res.ok) {
      throw new Error(`Walrus publisher error: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as StoreResponse;
    const blobId = body.newlyCreated?.blobObject?.blobId ?? body.alreadyCertified?.blobId;
    if (blobId === undefined) {
      throw new Error(`Walrus publisher returned no blobId: ${JSON.stringify(body)}`);
    }
    return blobId;
  }

  /** Read a blob's bytes by its blobId. */
  async read(blobId: string): Promise<Uint8Array> {
    const res = await fetch(`${this.config.aggregatorUrl}/v1/blobs/${blobId}`);
    if (!res.ok) {
      throw new Error(`Walrus aggregator error: ${res.status} ${res.statusText}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}
