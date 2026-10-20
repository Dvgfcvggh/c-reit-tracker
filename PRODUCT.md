# Product

<!-- impeccable:product-schema 1 -->

The interview was not run. The user supplied the product context and said to use it instead of stopping to ask. Facts below that go past that sentence are marked inferred from the shipped page.

## Platform

web

## Users

Inferred: someone on a phone, reading Chinese, who needs to scan every listed mainland public REIT before opening one product or one fund manager. The page does not name a login, a role, or a second audience.

## Product Purpose

A phone-first Chinese page for mainland public REITs. It exists so that person can see the listed set, the day's end-of-day market fields, a daily candlestick with volume, the dividend and unlock calendars, and the products under each fund manager, on one page.

The live page is https://workspace-nu-amber-58.vercel.app.

Success is a page a phone can open that shows those parts from the checked list, and does not present itself as a realtime quote terminal.

## Positioning

One page holds the market table, the daily candlestick and volume, the dividend calendar, the unlock calendar, and the fund-manager groups. Prices are end-of-day public closes from the Shanghai and Shenzhen exchanges, labeled with the trade date. A neighboring board that forwards realtime quotes, or that only lists products without the manager grouping and those two calendars, is not this page.

## Operating Context

The page is a website. The checked list in the repo is the data the page reads. The production site is the Vercel deployment at the URL above. Locally the app is started with `npm run dev` and served on port 43123.

## Capabilities and Constraints

Confirmed on the page:

- Market table of listed products: code, short name, exchange, primary sector, close, change, volume, annualized distribution yield, fund manager, source link.
- Opening a product shows a daily candlestick with volume underneath.
- Dividend calendar and unlock calendar on the same page.
- Products can be grouped and collapsed by fund manager, with the trading fields still visible.
- Phone layout is part of the product, not a later adaptation.

Constraints:

- No realtime quotes, no intraday bars, no order book.
- Daily candlesticks only. Open, high, low, close, and volume come from Shanghai and Shenzhen exchange public daily bars.
- Do not copy or republish quotes or tables from ccreits.cn, 理杏仁, Wind, Choice, or iFinD.
- If the listed set does not match that day's exchange lists, the page shows 名单未齐 and does not show a half table.
- If a product has no close that day, the cell is 当日无收盘, not the previous close.
- Annualized distribution yield is announced cash distribution per unit over the last 12 months divided by that day's close. If there is no distribution announcement, the cell is 尚无分配. The formula is shown on the page.
- If a product has no compliant daily history, the chart says so and does not invent candles.
- Original equity holders, operating managers, and the two holder-ratio columns are not filled. Inferred from the current milestone: the data shape can hold more than one party later, and those fields stay empty until a later milestone fills them from filings.

## Evidence on Hand

- The running production page: https://workspace-nu-amber-58.vercel.app
- The page implementation under `src/`, including `src/components/reit-board.tsx` and `src/components/daily-chart.tsx`.
- The checked list `src/data/checklist.json` and the daily bars `src/data/daily-bars.json`.
- No customer quotes, press, or logos were supplied. Do not invent them.

## Product Principles

- The phone view is the primary way the page is used.
- The page shows exchange end-of-day facts and announced distributions, not a live tape.
- One page carries the table, the daily chart, both calendars, and the fund-manager groups.
- A missing close, a missing distribution, or a missing daily series stays empty and labeled. It is not filled with a guess or the previous day.
- The page must not be described as realtime.
