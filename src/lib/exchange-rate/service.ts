"use server";

import { env } from "@/env";
import {
  convertCurrency,
  isSuccessResponse,
  type CurrencyCode,
  type ExchangeRateErrorResponse,
  type ExchangeRateResponse,
  type ExchangeRateSuccessResponse,
} from "./types";

/**
 * Base URL for the ExchangeRate-API v6 Standard endpoint
 */
const EXCHANGE_RATE_API_BASE_URL =
  "https://v6.exchangerate-api.com/v6" as const;

/**
 * Fetches exchange rates from ExchangeRate-API Standard endpoint
 *
 * @param baseCurrency - ISO 4217 currency code to use as base (e.g., "USD", "EUR")
 * @returns Promise resolving to exchange rate response
 * @throws Error if API key is missing or request fails
 *
 * @example
 * ```ts
 * const rates = await getExchangeRates("USD");
 * if (isSuccessResponse(rates)) {
 *   console.log(rates.conversion_rates.EUR); // 0.9013
 * }
 * ```
 */
export async function getExchangeRates(
  baseCurrency: CurrencyCode,
): Promise<ExchangeRateResponse> {
  const apiKey = env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) {
    throw new Error("EXCHANGE_RATE_API_KEY is not configured");
  }

  const url = `${EXCHANGE_RATE_API_BASE_URL}/${apiKey}/latest/${baseCurrency}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      // Cache for 1 hour to reduce API calls
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(
        `ExchangeRate-API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as ExchangeRateResponse;

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch exchange rates: ${error.message}`);
    }
    throw new Error("Failed to fetch exchange rates: Unknown error");
  }
}

/**
 * Gets a single exchange rate between two currencies
 *
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @param baseCurrency - Base currency used to fetch rates (defaults to fromCurrency)
 * @returns Exchange rate (multiplier to convert from fromCurrency to toCurrency)
 *
 * @example
 * ```ts
 * const rate = await getExchangeRate("USD", "EUR");
 * console.log(rate); // 0.9013
 * ```
 */
export async function getExchangeRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  baseCurrency: CurrencyCode = fromCurrency,
): Promise<number> {
  const response = await getExchangeRates(baseCurrency);

  if (!isSuccessResponse(response)) {
    const errorResponse = response as ExchangeRateErrorResponse;
    throw new Error(
      `ExchangeRate-API error: ${errorResponse["error-type"]}`,
    );
  }

  return convertCurrency(1, fromCurrency, toCurrency, response.conversion_rates);
}

// Re-export types for convenience
// Note: Non-async functions cannot be exported from "use server" files
// Import isErrorResponse directly from "./types" if needed
export type {
  CurrencyCode,
  ExchangeRateResponse,
  ExchangeRateSuccessResponse,
  ExchangeRateErrorResponse,
} from "./types";

