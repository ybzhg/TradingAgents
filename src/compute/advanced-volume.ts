// Copyright 2026 Tauric Research
// Based on Advanced Volume v3.1, © DarkPoolCrypto.
// SPDX-License-Identifier: MPL-2.0
// https://mozilla.org/MPL/2.0/

import { rsi } from "./indicators.js";

export type VolumeBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const VOLUME_OSCILLATORS = ["cmf", "mfi", "volume_rsi", "rvol", "volume_oscillator"] as const;
export const MIN_VOLUME_BARS = 28;
type Oscillator = (typeof VOLUME_OSCILLATORS)[number];

export type VolumeDivergence = {
  direction: "bullish" | "bearish";
  previous_pivot: string;
  pivot: string;
  confirmed: string;
  strength: number;
};

function sumWindow(values: readonly number[], end: number, length: number): number {
  return values.slice(end + 1 - length, end + 1).reduce((total, value) => total + value, 0);
}

function divergencesOf(bars: readonly VolumeBar[], values: readonly (number | null)[]): VolumeDivergence[] {
  const lookback = 5;
  const previous = { bullish: -Infinity, bearish: -Infinity };
  const lastSignaledPivot = { bullish: -Infinity, bearish: -Infinity };
  const results: VolumeDivergence[] = [];
  for (let pivot = lookback; pivot + lookback < bars.length; pivot++) {
    const value = values[pivot];
    const window = values.slice(pivot - lookback, pivot + lookback + 1);
    if (value == null || !window.every((point) => point != null)) continue;
    const left = window.slice(0, lookback);
    const right = window.slice(lookback + 1);
    // Equal values to the right supersede an earlier candidate in a plateau.
    for (const direction of ["bullish", "bearish"] as const) {
      const bullish = direction === "bullish";
      const isPivot =
        left.every((point) => (bullish ? point >= value : point <= value)) &&
        right.every((point) => (bullish ? point > value : point < value));
      if (!isPivot) continue;
      const prior = previous[direction];
      previous[direction] = pivot;
      // Pine's barssince on the shifted pivot series gives the pivot gap minus one.
      if (pivot - prior > 21 || pivot - lastSignaledPivot[direction] < 10) continue;
      const priorBar = bars[prior];
      const bar = bars[pivot];
      const confirmation = bars[pivot + lookback];
      const priorValue = values[prior];
      if (!bar || !priorBar || !confirmation || priorValue == null) continue;
      const field = bullish ? "low" : "high";
      const priorPrice = priorBar[field];
      const move = bar[field] - priorPrice;
      const oscillatorMove = value - priorValue;
      if (bullish ? move >= 0 || oscillatorMove <= 0 : move <= 0 || oscillatorMove >= 0) continue;
      lastSignaledPivot[direction] = pivot;
      results.push({
        direction,
        previous_pivot: priorBar.date,
        pivot: bar.date,
        confirmed: confirmation.date,
        strength: priorPrice > 0 ? Math.abs((oscillatorMove * move * 100) / priorPrice) : 0,
      });
    }
  }
  return results;
}

function volumeLabel(score: number): string {
  if (score >= 5) return "STRONG BUY";
  if (score >= 2) return "BUY";
  if (score <= -5) return "STRONG SELL";
  if (score <= -2) return "SELL";
  return "NEUTRAL";
}

/** Advanced Volume v3.1 defaults applied to completed daily bars in ascending order. */
export function advancedVolumeOf(bars: readonly VolumeBar[], oscillator: Oscillator = "cmf") {
  if (bars.length < MIN_VOLUME_BARS) throw new RangeError("Advanced Volume requires at least 28 daily bars");
  const volumes = bars.map((bar) => bar.volume);
  const deltas = bars.map(({ high, low, close, volume }) =>
    high === low ? 0 : (volume * (2 * close - low - high)) / (high - low),
  );
  const changes = bars.map((bar, i) => bar.close - (bars[i - 1]?.close ?? bar.close));
  const positive = bars.map((bar, i) => ((changes[i] ?? 0) > 0 ? bar.close * bar.volume : 0));
  const negative = bars.map((bar, i) => ((changes[i] ?? 0) < 0 ? bar.close * bar.volume : 0));
  const volumeRsi = rsi(volumes, 14);
  const points = bars.map((bar, i) => {
    const volume20 = i >= 19 ? sumWindow(volumes, i, 20) : null;
    const longMean = i >= 27 ? sumWindow(volumes, i, 28) / 28 : null;
    const inflow = i >= 14 ? sumWindow(positive, i, 14) : 0;
    const outflow = i >= 14 ? sumWindow(negative, i, 14) : 0;
    return {
      cmf: volume20 === null ? null : volume20 ? sumWindow(deltas, i, 20) / volume20 : 0,
      mfi: inflow + outflow ? (100 * inflow) / (inflow + outflow) : null,
      volume_rsi: volumeRsi[i] ?? null,
      rvol: volume20 === null ? null : volume20 ? (20 * bar.volume) / volume20 : 0,
      volume_oscillator:
        longMean === null ? null : longMean ? 100 * (sumWindow(volumes, i, 14) / 14 / longMean - 1) : 0,
    };
  });
  const bar = bars.at(-1);
  const latest = points.at(-1);
  const currentDelta = deltas.at(-1);
  const earlierDelta = deltas.at(-6);
  if (!bar || !latest || currentDelta === undefined || earlierDelta === undefined) {
    throw new RangeError("Advanced Volume requires a current and prior daily bar");
  }
  const { cmf, mfi, volume_rsi, rvol, volume_oscillator: vo } = latest;
  if (cmf === null || rvol === null || vo === null) {
    throw new RangeError("Advanced Volume rolling windows are incomplete");
  }
  const typicalPrice = (bar.high + bar.low + bar.close) / 3;
  const averageVolume = sumWindow(volumes, bars.length - 1, 20) / 20;
  const votes = {
    cmf: cmf > 0.05 ? 2 : cmf < -0.05 ? -2 : 0,
    mfi: mfi === null ? -1 : mfi > 80 ? -1 : mfi < 20 ? 2 : mfi > 50 ? 1 : -1,
    volume_rsi: volume_rsi === null ? 0 : volume_rsi > 80 ? -1 : volume_rsi < 20 ? 1 : 0,
    volume_oscillator: vo > 5 ? 2 : vo > 0 ? 1 : vo < -5 ? -2 : -1,
    vwap: bar.close > typicalPrice ? 1 : -1,
    volume_trend: bar.volume > averageVolume ? 1 : -1,
  };
  const score = Object.values(votes).reduce<number>((total, vote) => total + vote, 0);
  const withoutVwap = score - votes.vwap;
  const spike = rvol > 2;
  const doji = Math.abs(bar.open - bar.close) <= (bar.high - bar.low) * 0.05;
  return {
    ...latest,
    date: bar.date,
    close: bar.close,
    volume: bar.volume,
    average_volume_20: averageVolume,
    daily_session_vwap_proxy: typicalPrice,
    estimated_cvd_delta_5: currentDelta - earlierDelta,
    volume_spike: spike && !doji,
    high_volume_doji: spike && doji,
    votes,
    score,
    label: volumeLabel(score),
    score_without_vwap: withoutVwap,
    label_without_vwap: volumeLabel(withoutVwap),
    divergence_oscillator: oscillator,
    divergences: divergencesOf(
      bars,
      points.map((point) => point[oscillator]),
    ),
  };
}
