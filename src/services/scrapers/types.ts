export interface ScrapedOffer {
  storeName: string
  cashback: string   // e.g., "10.0% Cash Back" or "12.5% Back"
  rate: number       // numeric rate, e.g., 10.0
  url: string
  source: string     // e.g., "rakuten" | "capital_one_shopping"
}
