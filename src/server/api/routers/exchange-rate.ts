import { z } from "zod";

import {
  convertCurrency,
  isSuccessResponse,
} from "@/lib/exchange-rate/types";
import {
  getExchangeRate,
  getExchangeRates,
} from "@/lib/exchange-rate/service";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * Currency code validation schema
 * Matches ISO 4217 Three Letter Currency Codes
 */
const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Must be a valid 3-letter uppercase currency code");

/**
 * tRPC router for exchange rate operations
 */
export const exchangeRateRouter = createTRPCRouter({
  /**
   * Get exchange rates for a base currency
   * Returns all conversion rates from the base currency to all supported currencies
   */
  getRates: publicProcedure
    .input(
      z.object({
        baseCurrency: currencyCodeSchema,
      }),
    )
    .query(async ({ input }) => {
      const response = await getExchangeRates(input.baseCurrency);

      if (!isSuccessResponse(response)) {
        throw new Error(
          `ExchangeRate-API error: ${response["error-type"]}`,
        );
      }

      return {
        baseCode: response.base_code,
        conversionRates: response.conversion_rates,
        lastUpdateUnix: response.time_last_update_unix,
        lastUpdateUtc: response.time_last_update_utc,
        nextUpdateUnix: response.time_next_update_unix,
        nextUpdateUtc: response.time_next_update_utc,
      };
    }),

  /**
   * Get a single exchange rate between two currencies
   * Returns the multiplier to convert from fromCurrency to toCurrency
   */
  getRate: publicProcedure
    .input(
      z.object({
        fromCurrency: currencyCodeSchema,
        toCurrency: currencyCodeSchema,
        baseCurrency: currencyCodeSchema.optional(),
      }),
    )
    .query(async ({ input }) => {
      const rate = await getExchangeRate(
        input.fromCurrency,
        input.toCurrency,
        input.baseCurrency,
      );

      return {
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        rate,
      };
    }),

  /**
   * Convert an amount from one currency to another
   * Returns the converted amount and the exchange rate used
   */
  convert: publicProcedure
    .input(
      z.object({
        amount: z.number().min(0),
        fromCurrency: currencyCodeSchema,
        toCurrency: currencyCodeSchema,
        baseCurrency: currencyCodeSchema.optional(),
      }),
    )
    .query(async ({ input }) => {
      // Get rates for the base currency (default to fromCurrency)
      const baseCurrency = input.baseCurrency ?? input.fromCurrency;
      const response = await getExchangeRates(baseCurrency);

      if (!isSuccessResponse(response)) {
        throw new Error(
          `ExchangeRate-API error: ${response["error-type"]}`,
        );
      }

      // Convert the amount
      const convertedAmount = convertCurrency(
        input.amount,
        input.fromCurrency,
        input.toCurrency,
        response.conversion_rates,
      );

      // Calculate the rate used
      const rate = convertedAmount / input.amount;

      return {
        amount: input.amount,
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        convertedAmount,
        rate,
        lastUpdateUnix: response.time_last_update_unix,
        lastUpdateUtc: response.time_last_update_utc,
      };
    }),
});

