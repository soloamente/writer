/**
 * Type definitions for ExchangeRate-API responses
 * @see https://www.exchangerate-api.com/docs
 */

/**
 * ISO 4217 Three Letter Currency Code
 * @example "USD", "EUR", "GBP"
 */
export type CurrencyCode = string;

/**
 * Successful response from the ExchangeRate-API Standard endpoint
 */
export interface ExchangeRateSuccessResponse {
  result: "success";
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  base_code: CurrencyCode;
  conversion_rates: Record<CurrencyCode, number>;
}

/**
 * Error response from the ExchangeRate-API
 */
export interface ExchangeRateErrorResponse {
  result: "error";
  "error-type":
    | "unsupported-code"
    | "malformed-request"
    | "invalid-key"
    | "inactive-account"
    | "quota-reached"
    | "unknown-code";
}

/**
 * Union type for all possible API responses
 */
export type ExchangeRateResponse =
  | ExchangeRateSuccessResponse
  | ExchangeRateErrorResponse;

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse(
  response: ExchangeRateResponse,
): response is ExchangeRateSuccessResponse {
  return response.result === "success";
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(
  response: ExchangeRateResponse,
): response is ExchangeRateErrorResponse {
  return response.result === "error";
}

/**
 * Converts an amount from one currency to another using exchange rates
 *
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @param rates - Conversion rates object (from getExchangeRates response)
 * @returns Converted amount
 *
 * @example
 * ```ts
 * const rates = await getExchangeRates("USD");
 * if (isSuccessResponse(rates)) {
 *   const converted = convertCurrency(100, "USD", "EUR", rates.conversion_rates);
 *   console.log(converted); // 90.13
 * }
 * ```
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rates: Record<CurrencyCode, number>,
): number {
  // If same currency, return as-is
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Get rates for both currencies
  // Note: rates are relative to the base currency (e.g., if base is USD, rates show how many units of each currency = 1 USD)
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (fromRate === undefined) {
    throw new Error(`Currency code "${fromCurrency}" not found in rates`);
  }

  if (toRate === undefined) {
    throw new Error(`Currency code "${toCurrency}" not found in rates`);
  }

  // Convert through base currency:
  // 1. Convert fromCurrency to base: amount / fromRate
  // 2. Convert base to toCurrency: (amount / fromRate) * toRate
  // Simplified: amount * (toRate / fromRate)
  //
  // Example with base = USD:
  // - USD: 1, EUR: 0.9013, GBP: 0.7679
  // - Convert 100 USD to EUR: 100 * (0.9013 / 1) = 90.13 EUR
  // - Convert 100 EUR to USD: 100 * (1 / 0.9013) = 110.95 USD
  // - Convert 100 EUR to GBP: 100 * (0.7679 / 0.9013) = 85.20 GBP
  return amount * (toRate / fromRate);
}

