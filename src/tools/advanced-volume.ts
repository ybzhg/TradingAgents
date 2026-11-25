// Copyright 2026 Tauric Research
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";
import {
  advancedVolumeOf,
  MIN_VOLUME_BARS,
  VOLUME_OSCILLATORS,
  type VolumeBar,
} from "../compute/advanced-volume.js";
import { BARS } from "./price-history.js";
import { labelOf } from "./series.js";
import { defineTool, ToolRefusalError, wholeResult } from "./tool.js";

const output = z.object({
  symbol: z.string(),
  price_basis: z.string().nullable(),
  sessions: z.number(),
  notes: z.array(z.string()),
  date: z.string(),
  close: z.number(),
  volume: z.number(),
  average_volume_20: z.number(),
  cmf: z.number().nullable(),
  mfi: z.number().nullable(),
  volume_rsi: z.number().nullable(),
  rvol: z.number().nullable(),
  volume_oscillator: z.number().nullable(),
  daily_session_vwap_proxy: z.number(),
  estimated_cvd_delta_5: z.number(),
  volume_spike: z.boolean(),
  high_volume_doji: z.boolean(),
  votes: z.record(z.string(), z.number()),
  score: z.number(),
  label: z.string(),
  score_without_vwap: z.number(),
  label_without_vwap: z.string(),
  divergence_oscillator: z.enum(VOLUME_OSCILLATORS),
  divergences: z.array(
    z.object({
      direction: z.enum(["bullish", "bearish"]),
      previous_pivot: z.string(),
      pivot: z.string(),
      confirmed: z.string(),
      strength: z.number(),
    }),
  ),
});

export function advancedVolumeTool() {
  return defineTool({
    name: "advanced_volume",
    description:
      'Advanced Volume v3.1 dashboard using a whole daily price_history result ({"ref":"e7"}). ' +
      "Returns CMF, close-based MFI, volume RSI, relative volume, the volume oscillator, estimated CVD, " +
      "the six score votes and the score with the daily VWAP vote omitted. Dates divergences on confirmation. " +
      "Use about one year of daily history for warm-up and the existing indicators tool for price trend.",
    kind: "compute",
    parallelSafe: true,
    input: z.object({
      series: wholeResult("Daily price_history evidence with OHLCV"),
      oscillator: z.enum(VOLUME_OSCILLATORS).default("cmf"),
    }),
    output,
    label: ({ series }) => labelOf(series),
    async run({ series, oscillator }, { clock }) {
      const parsed = BARS.safeParse(series);
      if (!parsed.success || parsed.data.quoted_as !== "price") {
        throw new ToolRefusalError(
          "advanced_volume requires a whole daily price_history result with OHLCV prices",
        );
      }
      const history = parsed.data;
      const bars: VolumeBar[] = [];
      // This dashboard is for US stocks and ETFs. A previous exchange date has ended even if its
      // data can still be revised. Same-day bars require the provider to mark them final.
      const exchangeDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/New_York" }).format(
        clock?.() ?? new Date(),
      );
      const provisionalDates: string[] = [];
      let skipped = 0;
      for (const [i, date] of history.dates.entries()) {
        const provisional = history.states[i]?.startsWith("provisional");
        if (date > exchangeDate || (provisional && date === exchangeDate)) {
          skipped++;
          continue;
        }
        const open = history.opens[i];
        const high = history.highs[i];
        const low = history.lows[i];
        const close = history.closes[i];
        const volume = history.volumes[i];
        if (open == null || high == null || low == null || close == null || volume == null) {
          throw new ToolRefusalError(`${history.symbol}: incomplete OHLCV on ${date}`);
        }
        if (
          volume < 0 ||
          low <= 0 ||
          low > high ||
          open < low ||
          open > high ||
          close < low ||
          close > high
        ) {
          throw new ToolRefusalError(`${history.symbol}: invalid OHLCV on ${date}`);
        }
        const previous = bars.at(-1);
        if (previous && date <= previous.date) {
          throw new ToolRefusalError(
            `${history.symbol}: daily bars must have unique dates in ascending order`,
          );
        }
        bars.push({ date, open, high, low, close, volume });
        if (provisional) provisionalDates.push(date);
      }
      if (bars.length < MIN_VOLUME_BARS) {
        throw new ToolRefusalError(
          `${history.symbol}: advanced_volume needs at least ${MIN_VOLUME_BARS} completed daily bars`,
        );
      }
      if (!bars.some((bar) => bar.volume > 0)) {
        throw new ToolRefusalError(`${history.symbol}: no positive volume in the daily history`);
      }
      const result = advancedVolumeOf(bars, oscillator);
      return {
        payload: {
          ...result,
          symbol: history.symbol,
          price_basis: history.price_basis,
          sessions: bars.length,
          notes: [
            ...history.notes,
            ...(skipped ? [`Omitted ${skipped} same-day provisional or future daily bars`] : []),
            ...(provisionalDates.length
              ? [
                  `Completed sessions with provisional provider data, subject to revision: ${provisionalDates.join(", ")}`,
                ]
              : []),
            "Daily session VWAP is represented by the bar's typical price",
            "Estimated CVD difference uses daily resets and compares the two bars' close-weighted volume",
          ],
        },
        provenance: { source: "computed", syncs: true, as_of: result.date },
        summary: `${history.symbol}: ${result.label} (${result.score}), ex-VWAP ${result.label_without_vwap} (${result.score_without_vwap})`,
      };
    },
  });
}
