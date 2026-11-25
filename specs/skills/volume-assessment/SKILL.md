---
name: volume-assessment
description: Assess a stock or ETF using the Advanced Volume v3.1 dashboard alongside daily price trend.
metadata:
  group: Markets
  required-data-tools: price_history
---

Get one year of daily OHLCV with price_history. Reference that result in advanced_volume and use the default CMF divergence oscillator unless the user specifies another. Report the data source, price basis, and latest completed date. Show the six votes, score and label, and the score without the VWAP vote because a daily session contains a single daily bar. Explain the current RVOL relative to its 20-bar baseline and describe estimated CVD as a close-position proxy. Give both pivot and confirmation dates for any recent divergences.

Run indicators on the same price_history evidence with through set to the date returned by advanced_volume. Use this indicators array exactly: [{"name":"sma","periods":[8,21]},{"name":"sma","periods":[100,200]},{"name":"rsi","periods":[14]},{"name":"macd","periods":[12,26,9]}]. Keep price and volume on that shared date. Report provider revision notes as data quality notes. Interpret the estimated CVD difference as a comparison of two individual bars five sessions apart with daily resets. Cite each claim to the output that supports it.
