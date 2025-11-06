"use client";

import { useRef, useEffect, useState, useMemo } from "react";

import { api } from "@/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { FaArrowRight } from "react-icons/fa6";

const CURRENCIES = {
  INR: { name: "Indian Rupees", symbol: "₹" },
  USD: { name: "American Dollars", symbol: "$" },
  EUR: { name: "Euro", symbol: "€" },
  GBP: { name: "British Pounds", symbol: "£" },
  AUD: { name: "Australian Dollars", symbol: "A$" },
  CAD: { name: "Canadian Dollars", symbol: "C$" },
  CHF: { name: "Swiss Francs", symbol: "CHF" },
  CNY: { name: "Chinese Yuan", symbol: "¥" },
  JPY: { name: "Japanese Yen", symbol: "¥" },
} as const;

type CurrencyCode = keyof typeof CURRENCIES;

/**
 * Format a timestamp to a relative time string (e.g., "3 hours ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000; // Convert to seconds
  const diff = now - timestamp;

  if (diff < 60) {
    return "just now";
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else {
    const days = Math.floor(diff / 86400);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
}

export default function MoneyConverter() {
  const [sourceCurrency, setSourceCurrency] = useState<CurrencyCode>("INR");
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>("USD");
  const [amount, setAmount] = useState(0);
  const [inputWidth, setInputWidth] = useState(60);
  const [inputWidth2, setInputWidth2] = useState(60);
  const measureRef = useRef<HTMLSpanElement>(null);
  const measureRef2 = useRef<HTMLSpanElement>(null);

  // Fetch conversion data using tRPC
  const { data: conversionData, isLoading } = api.exchangeRate.convert.useQuery(
    {
      amount,
      fromCurrency: sourceCurrency,
      toCurrency: targetCurrency,
    },
    {
      enabled: amount > 0 && sourceCurrency !== targetCurrency,
      // Refetch every 5 minutes to get updated rates
      refetchInterval: 5 * 60 * 1000,
    },
  );

  // Calculate converted amount
  const convertedAmount = useMemo(() => {
    if (sourceCurrency === targetCurrency) {
      return amount;
    }
    if (!conversionData) {
      return 0;
    }
    return conversionData.convertedAmount;
  }, [amount, sourceCurrency, targetCurrency, conversionData]);

  // Format last updated time
  const lastUpdatedText = useMemo(() => {
    if (!conversionData?.lastUpdateUnix) {
      return "Loading...";
    }
    return `Updated ${formatRelativeTime(conversionData.lastUpdateUnix)}`;
  }, [conversionData?.lastUpdateUnix]);

  useEffect(() => {
    if (measureRef.current) {
      setInputWidth(measureRef.current.offsetWidth || 20);
    }
  }, [amount]);

  // Calculate the displayed value for the target input
  const targetDisplayValue = useMemo(() => {
    if (
      typeof convertedAmount === "number" &&
      isFinite(convertedAmount) &&
      convertedAmount > 0
    ) {
      return convertedAmount.toFixed(2);
    }
    return "0";
  }, [convertedAmount]);

  useEffect(() => {
    if (measureRef2.current) {
      setInputWidth2(measureRef2.current.offsetWidth || 20);
    }
  }, [targetDisplayValue]);

  return (
    <div className="bg-card relative grid w-xl max-w-fit grid-cols-3 items-center gap-12 rounded-4xl border p-4 py-12">
      {/* Vertical line in the middle */}
      <div className="bg-border absolute top-0 left-1/2 h-9 w-[2px] rounded-b-full" />
      <div className="bg-border absolute bottom-0 left-1/2 h-9 w-[2px] rounded-t-full" />
      {/* Left Side - From Currency */}
      <div className="relative flex flex-col items-center gap-2 pl-4">
        <div className="relative flex items-center justify-center">
          <span
            ref={measureRef}
            className="text-foreground invisible absolute text-2xl font-medium whitespace-pre"
            style={{ visibility: "hidden", position: "absolute" }}
            aria-hidden="true"
          >
            {amount || "0"}
          </span>
          <div className="flex items-center gap-0.5">
            <span className="text-foreground text-2xl font-medium">
              {CURRENCIES[sourceCurrency].symbol}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              name="source-amount"
              id="source-amount"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              style={{
                width: `${Math.max(inputWidth, 20)}px`,
                minWidth: "20px",
              }}
              className="text-foreground border-none bg-transparent text-center text-2xl font-medium outline-none"
              placeholder="0"
            />
          </div>
        </div>

        <Select
          value={sourceCurrency}
          onValueChange={(value) => setSourceCurrency(value)}
        >
          <SelectTrigger className="w-fit border-none">
            <SelectValue>{CURRENCIES[sourceCurrency].name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CURRENCIES).map(([code, { name }]) => (
              <SelectItem key={code} value={code}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Middle Side - Arrow and timestamp (overlay on top of line) */}
      <div className="bg-card z-10 flex flex-col items-center justify-center gap-2 py-4">
        <FaArrowRight className="size-6" />
        <span className="text-muted-foreground text-sm">
          {isLoading ? "Loading..." : lastUpdatedText}
        </span>
      </div>

      {/* Right Side - To Currency */}
      <div className="relative flex flex-col items-center gap-2 pr-4">
        <div className="relative flex items-center justify-center">
          <span
            ref={measureRef2}
            className="text-foreground invisible absolute text-2xl font-medium whitespace-pre"
            style={{ visibility: "hidden", position: "absolute" }}
            aria-hidden="true"
          >
            {targetDisplayValue}
          </span>
          <div className="flex items-center gap-0.5">
            <span className="text-foreground text-2xl font-medium">
              {CURRENCIES[targetCurrency].symbol}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              name="target-amount"
              id="target-amount"
              value={targetDisplayValue || ""}
              readOnly
              style={{
                width: `${Math.max(inputWidth2, 20)}px`,
                minWidth: "20px",
              }}
              className="text-foreground border-none bg-transparent text-center text-2xl font-medium outline-none"
              placeholder="0"
            />
          </div>
        </div>

        <Select
          value={targetCurrency}
          onValueChange={(value) => setTargetCurrency(value)}
        >
          <SelectTrigger className="w-fit border-none">
            <SelectValue>{CURRENCIES[targetCurrency].name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CURRENCIES).map(([code, { name }]) => (
              <SelectItem key={code} value={code}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
