export class TatumClient {
  constructor(private readonly apiKey: string) {}

  /**
   * Fetch the current fiat price of SUI (or any supported coin) using Tatum's Exchange Rate API.
   * This serves as our "Data" half of the DeFi + Data requirement.
   */
  async getExchangeRate(coin: string = 'SUI', basePair: string = 'USD'): Promise<number> {
    const res = await fetch(`https://api.tatum.io/v3/tatum/rate/${coin}?basePair=${basePair}`, {
      headers: { 'x-api-key': this.apiKey },
    });
    
    if (!res.ok) {
      throw new Error(`Tatum Data API error: ${res.status} ${res.statusText}`);
    }
    
    const data = (await res.json()) as { value?: string } | null;
    if (!data?.value) {
      throw new Error(`Tatum Data API returned unexpected format: ${JSON.stringify(data)}`);
    }

    return parseFloat(data.value);
  }
}
