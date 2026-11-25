import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BUILTIN_SKILLS } from "../src/agents/builtin.generated.js";
import { parseSkill } from "../src/agents/skill-file.js";
import { advancedVolumeOf, type VolumeBar } from "../src/compute/advanced-volume.js";
import { createEngine } from "../src/engine/factory.js";
import { computeTools } from "../src/tools/catalog.js";
import { EvidenceStore } from "../src/tools/evidence-store.js";
import { ToolRegistry } from "../src/tools/registry.js";

// SPY daily OHLCV from Stock Analysis (S&P Global Market Intelligence), through Nov. 24, 2026.
// https://stockanalysis.com/etf/spy/history/
const spy: VolumeBar[] = (
  [
    ["2026-09-17", 763.15, 763.57, 759.96, 762.6, 49652754],
    ["2026-09-18", 761.31, 762, 757.97, 761.69, 65395148],
    ["2026-09-21", 766.25, 774.89, 766.03, 773.5, 50484685],
    ["2026-09-22", 774.03, 775.14, 772.57, 773.38, 34802336],
    ["2026-09-23", 772.79, 773.05, 766.5, 767.81, 43595512],
    ["2026-09-24", 764.07, 768.95, 763.25, 767.18, 41448307],
    ["2026-09-25", 768.78, 772.28, 766.29, 771.35, 35014996],
    ["2026-09-28", 768.35, 769.54, 763.72, 765.61, 40784108],
    ["2026-09-29", 766.83, 766.98, 762.35, 764.2, 35518741],
    ["2026-09-30", 766.45, 769.41, 762.18, 762.63, 59922080],
    ["2026-10-01", 764.36, 765.65, 758.79, 763.99, 46226989],
    ["2026-10-02", 770.58, 772.65, 767.15, 769.64, 45459431],
    ["2026-10-05", 769.69, 776.61, 769.63, 774.83, 42584491],
    ["2026-10-06", 778.15, 781.62, 777.96, 779.09, 35222150],
    ["2026-10-07", 775.77, 779.1, 773.61, 777.22, 29838779],
    ["2026-10-08", 774.86, 777.09, 770.44, 773.93, 38430690],
    ["2026-10-09", 776.24, 779.42, 775.14, 778.57, 21435185],
    ["2026-10-12", 778.78, 779.4, 777.05, 778.1, 18227937],
    ["2026-10-13", 777.34, 778.75, 775.95, 778.01, 25205815],
    ["2026-10-14", 774.92, 776.35, 766.71, 769.6, 54448672],
    ["2026-10-15", 766.25, 772.87, 764.43, 771.79, 41465260],
    ["2026-10-16", 773.24, 773.25, 760.64, 763.25, 59554553],
    ["2026-10-19", 767.23, 770.46, 765.82, 766.48, 38680064],
    ["2026-10-20", 765.86, 772.29, 764.25, 769.05, 35048373],
    ["2026-10-21", 771.17, 774.44, 768.4, 773.09, 31943809],
    ["2026-10-22", 766.37, 767.71, 761.17, 763.96, 54117128],
    ["2026-10-23", 759.9, 763.47, 758.68, 759.97, 33423223],
    ["2026-10-26", 762.25, 767.73, 761.63, 765.37, 31737797],
    ["2026-10-27", 767.34, 771.14, 765.21, 769.66, 28631659],
    ["2026-10-28", 771.43, 773.36, 769.24, 772.31, 30133804],
    ["2026-10-29", 768.79, 770.76, 766.62, 769.36, 40299584],
    ["2026-10-30", 761.38, 761.46, 750.36, 755.72, 77696475],
    ["2026-11-02", 759.45, 763.86, 751.6, 752.1, 50804340],
    ["2026-11-03", 752.73, 757.07, 752.39, 754.35, 32891580],
    ["2026-11-04", 762.99, 775.64, 762.64, 766.81, 62126352],
    ["2026-11-05", 765.47, 765.97, 732.71, 733, 125892776],
    ["2026-11-06", 734.82, 742.21, 734.58, 735.29, 58978818],
    ["2026-11-09", 741.95, 755.42, 741.03, 752.69, 50281221],
    ["2026-11-10", 747.94, 752.14, 744.86, 749.92, 40698598],
    ["2026-11-11", 756.8, 762.51, 754.9, 759.81, 39150971],
    ["2026-11-12", 753.98, 763.04, 753.67, 757.12, 37460594],
    ["2026-11-13", 760.07, 760.12, 747.88, 754.37, 38720038],
    ["2026-11-16", 749.66, 749.82, 738.07, 739.95, 69207282],
    ["2026-11-17", 738.39, 739.76, 727, 732.44, 71636294],
    ["2026-11-18", 733.37, 735.06, 726.8, 730.2, 51804809],
    ["2026-11-19", 737.46, 739.9, 715.65, 715.87, 76702574],
    ["2026-11-20", 713.56, 718.29, 686.75, 689.81, 151413318],
    ["2026-11-23", 724.33, 727.98, 713.53, 722.29, 88283783],
    ["2026-11-24", 715.15, 720.93, 712.14, 718.78, 64343213],
  ] as const
).map(([date, open, high, low, close, volume]) => ({ date, open, high, low, close, volume }));

test("reproduces the SPY dashboard and both scores", () => {
  const result = advancedVolumeOf(spy);
  assert.equal(result.date, "2026-11-24");
  assert.deepEqual(result.votes, {
    cmf: -2,
    mfi: -1,
    volume_rsi: 0,
    volume_oscillator: 2,
    vwap: 1,
    volume_trend: 1,
  });
  assert.equal(result.score, 1);
  assert.equal(result.label, "NEUTRAL");
  assert.equal(result.score_without_vwap, 0);
  assert.equal(result.label_without_vwap, "NEUTRAL");
  assert.equal(result.cmf?.toFixed(3), "-0.304");
  assert.equal(result.mfi?.toFixed(1), "24.9");
  assert.equal(result.volume_rsi?.toFixed(1), "50.4");
  assert.equal(result.rvol?.toFixed(2), "1.02");
  assert.equal(result.volume_oscillator?.toFixed(2), "22.75");
  assert.equal(result.estimated_cvd_delta_5.toFixed(0), "43421575");
  assert.equal(result.volume_spike, false);
  assert.equal(
    result.divergences.some((event) => event.confirmed === result.date),
    false,
  );
});

test("does not expose a bullish divergence until the fifth right-hand bar", () => {
  const bars = Array.from({ length: 40 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    open: 100,
    high: 101,
    close: 100,
    low: i === 34 ? 95 : 99,
    volume: i === 25 ? 10 : i === 34 ? 20 : 100,
  }));
  assert.deepEqual(advancedVolumeOf(bars.slice(0, 39), "rvol").divergences, []);
  const events = advancedVolumeOf(bars, "rvol").divergences;
  assert.equal(events.length, 1);
  assert.deepEqual(
    events.map(({ direction, previous_pivot, pivot, confirmed }) => ({
      direction,
      previous_pivot,
      pivot,
      confirmed,
    })),
    [{ direction: "bullish", previous_pivot: "2026-01-26", pivot: "2026-02-04", confirmed: "2026-02-09" }],
  );
  assert.ok((events[0]?.strength ?? 0) > 0);
});

function payload(bars: VolumeBar[]) {
  return {
    symbol: "SPY",
    instrument: "SPY",
    currency: "USD",
    interval: "daily",
    price_basis: "split-adjusted",
    from: bars[0]?.date ?? null,
    through: bars.at(-1)?.date ?? null,
    complete: true,
    notes: [],
    quoted_as: "price",
    dates: bars.map((bar) => bar.date),
    opens: bars.map((bar) => bar.open),
    highs: bars.map((bar) => bar.high),
    lows: bars.map((bar) => bar.low),
    closes: bars.map((bar) => bar.close),
    volumes: bars.map<number | null>((bar) => bar.volume),
    states: bars.map<string | null>(() => null),
  };
}

async function execute(history: ReturnType<typeof payload>, indicatorsThrough?: string) {
  const signal = new AbortController().signal;
  const store = new EvidenceStore();
  const source = store.scope("turn", "main", 1, signal).publish({
    tool: "price_history",
    label: "SPY",
    payload: history,
    provenance: { source: "test fixture", syncs: true },
    inputs: [],
  });
  assert.ok(source);
  const registry = new ToolRegistry(computeTools());
  const clock = () => new Date("2026-11-25T16:00:00Z");
  const outcome = await registry.execute(
    { name: "advanced_volume", callId: "volume", args: { series: { ref: source.id } } },
    new Set(["advanced_volume"]),
    { signal, clock, evidence: store.scope("turn", "main", 2, signal) },
  );
  const indicators = indicatorsThrough
    ? await registry.execute(
        {
          name: "indicators",
          callId: "trend",
          args: {
            series: { ref: source.id },
            through: indicatorsThrough,
            indicators: [{ name: "sma", periods: [8, 21] }],
          },
        },
        new Set(["indicators"]),
        { signal, clock, evidence: store.scope("turn", "main", 3, signal) },
      )
    : undefined;
  return { outcome, indicators, result: outcome.evidence ? store.get(outcome.evidence) : undefined };
}

test("both tools use the same history and cutoff, retaining closed provisional sessions", async () => {
  const last = spy.at(-1);
  assert.ok(last);
  const history = payload([...spy, { ...last, date: "2026-11-25", volume: 1 }]);
  history.states[history.states.length - 1] = "provisional";
  history.states[history.states.length - 2] = "provisional";
  history.states[history.states.length - 3] = "provisional";
  const { outcome, result, indicators } = await execute(history, "2026-11-24");
  assert.equal(outcome.failure, undefined, outcome.output);
  assert.match(outcome.summary, /NEUTRAL \(1\)/);
  assert.equal(result?.provenance.as_of, "2026-11-24");
  assert.deepEqual(result?.inputs, ["e1"]);
  assert.match(outcome.output, /subject to revision: 2026-11-23, 2026-11-24/);
  assert.ok(indicators);
  assert.equal(indicators.failure, undefined, indicators.output);
  assert.equal(indicators.asOf, outcome.asOf);
});

test("rejects short or incomplete OHLCV with a useful error", async () => {
  const short = await execute(payload(spy.slice(0, 27)));
  assert.equal(short.outcome.failure, "refused");
  assert.match(short.outcome.output, /28 completed/);
  const incomplete = payload(spy);
  incomplete.volumes[incomplete.volumes.length - 1] = null;
  const missing = await execute(incomplete);
  assert.equal(missing.outcome.failure, "refused");
  assert.match(missing.outcome.output, /incomplete OHLCV on 2026-11-24/);
});

test("offers the built-in volume skill with Yahoo-only pricing", () => {
  const source = readFileSync(new URL("../specs/skills/volume-assessment/SKILL.md", import.meta.url), "utf8");
  const { skill } = parseSkill("SKILL.md", source, { dir: "volume-assessment", strict: true, resources: {} });
  assert.deepEqual(
    BUILTIN_SKILLS.find((entry) => entry.name === skill.name),
    skill,
  );
  const engine = createEngine({
    version: "test",
    model: { provider: "openai", model: "test", apiKey: "test" },
  });
  assert.deepEqual(engine.offered().agents, []);
  assert.ok(engine.offered().skills.includes("volume-assessment"));
});
