# ExchangeRate-API Integration

This directory contains the integration with [ExchangeRate-API](https://www.exchangerate-api.com/) for fetching real-time exchange rates.

## Setup

1. Add your API key to your `.env` file:
```env
EXCHANGE_RATE_API_KEY=your-api-key-here
```

2. The API key is automatically validated through `src/env.js` using `@t3-oss/env-nextjs`.

## Usage

### Server-Side (Service Functions)

```typescript
import { getExchangeRates, convertCurrency, isSuccessResponse } from "@/lib/exchange-rate/service";

// Get all exchange rates for a base currency
const response = await getExchangeRates("USD");
if (isSuccessResponse(response)) {
  console.log(response.conversion_rates.EUR); // 0.9013
}

// Convert currency
const converted = convertCurrency(100, "USD", "EUR", response.conversion_rates);
console.log(converted); // 90.13
```

### Client-Side (tRPC)

```typescript
import { api } from "@/trpc/react";

// Get all rates
const { data } = api.exchangeRate.getRates.useQuery({
  baseCurrency: "USD",
});

// Get a single rate
const { data } = api.exchangeRate.getRate.useQuery({
  fromCurrency: "USD",
  toCurrency: "EUR",
});

// Convert an amount
const { data } = api.exchangeRate.convert.useQuery({
  amount: 100,
  fromCurrency: "USD",
  toCurrency: "EUR",
});
```

## API Endpoints

The tRPC router provides three endpoints:

1. **`getRates`** - Get all conversion rates for a base currency
2. **`getRate`** - Get a single exchange rate between two currencies
3. **`convert`** - Convert an amount from one currency to another

## Types

All types are exported from `src/lib/exchange-rate/types.ts`:

- `CurrencyCode` - ISO 4217 currency code (e.g., "USD", "EUR")
- `ExchangeRateSuccessResponse` - Successful API response
- `ExchangeRateErrorResponse` - Error API response
- `ExchangeRateResponse` - Union type for all responses

## Error Handling

The API can return the following error types:

- `"unsupported-code"` - Currency code not supported
- `"malformed-request"` - Request structure is invalid
- `"invalid-key"` - API key is not valid
- `"inactive-account"` - Email address not confirmed
- `"quota-reached"` - Account has reached request limit

All errors are automatically handled and thrown as exceptions with descriptive messages.

## Caching

- Server-side requests are cached for 1 hour (3600 seconds) using Next.js `fetch` cache
- Client-side queries can be configured with `refetchInterval` for automatic updates

## Example Component

See `src/components/playground/money-converter.tsx` for a complete example of using the exchange rate API in a React component.


