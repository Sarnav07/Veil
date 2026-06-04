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

  private async fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
      } catch (e) {
        if (attempt === retries - 1) throw e;
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
    return fetch(url, options);
  }

  /** Store a blob and return its Walrus blobId. `epochs` is the storage lifetime. */
  async store(data: Uint8Array, epochs = 1): Promise<string> {
    const res = await this.fetchWithRetry(`${this.config.publisherUrl}/v1/blobs?epochs=${epochs}`, {
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
    const res = await this.fetchWithRetry(`${this.config.aggregatorUrl}/v1/blobs/${blobId}`);
    if (!res.ok) {
      throw new Error(`Walrus aggregator error: ${res.status} ${res.statusText}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}
