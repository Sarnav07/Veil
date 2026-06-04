export class TatumClient {
  constructor(private readonly apiKey: string) {}

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

  /**
   * Fetch the current fiat price of SUI (or any supported coin) using Tatum's Exchange Rate API.
   * This serves as our "Data" half of the DeFi + Data requirement.
   */
  async getExchangeRate(coin: string = 'SUI', basePair: string = 'USD'): Promise<number> {
    let res: Response;
    try {
      res = await this.fetchWithRetry(`https://api.tatum.io/v3/tatum/rate/${coin}?basePair=${basePair}`, {
        headers: { 'x-api-key': this.apiKey },
      });
    } catch (err: any) {
      // Prevent leaking request headers (which contain the API key) in error logs
      throw new Error(`Tatum Data API network error: ${err.name || 'Unknown'}`);
    }
    
    if (!res.ok) {
      throw new Error(`Tatum Data API error: ${res.status} ${res.statusText}`);
    }
    
    const data = (await res.json()) as { value?: string } | null;
    if (!data?.value) {
      throw new Error(`Tatum Data API returned unexpected format.`);
    }

    return parseFloat(data.value);
  }
}
