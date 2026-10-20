import raw from "@/data/macro-series.json"
import type { ChartPoint, ChartSpec } from "@/components/daily-chart"
import { csi932047 } from "@/lib/csi-932047"
import { dailySeries } from "@/lib/daily-bars"
import { checklist } from "@/lib/market"

type Mode = "ohlcv" | "ohlc" | "cv" | "c"

type RawSeries = {
  code: string
  name: string
  publisher: string
  sourceUrl: string
  region: string
  unit: string
  precision: number
  mode: Mode
  volumeLabel: string | null
  note: string
  start: string
  end: string
  count: number
  bars: (number | null)[][]
}

type RawFile = {
  checkedOn: string
  ready: RawSeries[]
}

const file = raw as RawFile

export type ReadySeries = {
  id: string
  code: string
  name: string
  publisher: string
  sourceUrl: string
  region: string
  unit: string
  precision: number
  ohlc: boolean
  hasVolume: boolean
  note: string
  start: string
  end: string
}

function ymd(value: number): string {
  const text = String(value)
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
}

function pointsFor(series: RawSeries): ChartPoint[] {
  const points: ChartPoint[] = []
  for (const row of series.bars) {
    const date = row[0]
    if (typeof date !== "number") continue
    if (series.mode === "ohlcv" || series.mode === "ohlc") {
      const open = row[1]
      const high = row[2]
      const low = row[3]
      const close = row[4]
      if (open == null || high == null || low == null || close == null) continue
      const volume = series.mode === "ohlcv" && typeof row[5] === "number" ? row[5] : undefined
      points.push({ time: ymd(date), open, high, low, close, volume })
      continue
    }
    const close = row[1]
    if (close == null) continue
    const volume = series.mode === "cv" && typeof row[2] === "number" ? row[2] : undefined
    points.push({ time: ymd(date), close, volume })
  }
  return points
}

const macroPoints = new Map<string, ChartPoint[]>()
const macroMeta = new Map<string, RawSeries>()
for (const series of file.ready) {
  macroMeta.set(series.code, series)
  macroPoints.set(series.code, pointsFor(series))
}

function iso(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
}

const macroReady: ReadySeries[] = file.ready.map((series) => {
  const points = macroPoints.get(series.code) ?? []
  return {
    id: `series:${series.code}`,
    code: series.code,
    name: series.name,
    publisher: series.publisher,
    sourceUrl: series.sourceUrl,
    region: series.region,
    unit: series.unit,
    precision: series.precision,
    ohlc: series.mode === "ohlcv" || series.mode === "ohlc",
    hasVolume: points.some((point) => point.volume != null),
    note: series.note,
    start: iso(series.start),
    end: iso(series.end),
  }
})

const reitReady: ReadySeries = {
  id: "series:932047",
  code: csi932047.code,
  name: csi932047.name,
  publisher: csi932047.publisher,
  sourceUrl: csi932047.sourceUrl,
  region: "中国",
  unit: "点",
  precision: 2,
  ohlc: true,
  hasVolume: true,
  note: csi932047.spec.note ?? "",
  start: csi932047.start,
  end: csi932047.end,
}

export const readySeries: ReadySeries[] = [reitReady, ...macroReady]

export function chartSpecForSeries(code: string): ChartSpec | null {
  if (code === "932047") {
    return { ...csi932047.spec, priceDigits: 2 }
  }
  const series = macroMeta.get(code)
  const bars = macroPoints.get(code)
  if (!series || !bars || bars.length === 0) return null
  return {
    bars,
    volumeUnit: series.volumeLabel ?? undefined,
    sourceLabel: series.publisher,
    sourceUrl: series.sourceUrl,
    note: series.note || undefined,
    priceDigits: series.precision,
  }
}

export function isSeriesId(id: string): boolean {
  return id.startsWith("series:") && readySeries.some((series) => series.id === id)
}

export function isProductId(id: string): boolean {
  if (!id.startsWith("product:")) return false
  const code = id.slice("product:".length)
  return checklist.products.some((product) => product.code === code) && dailySeries(code) != null
}

export function closesFor(id: string): { time: string; close: number }[] {
  if (id.startsWith("product:")) {
    const series = dailySeries(id.slice("product:".length))
    return series ? series.bars.map((bar) => ({ time: bar.time, close: bar.close })) : []
  }
  if (!id.startsWith("series:")) return []
  const spec = chartSpecForSeries(id.slice("series:".length))
  return spec ? spec.bars.map((bar) => ({ time: bar.time, close: bar.close })) : []
}

export function labelFor(id: string): string {
  if (id.startsWith("product:")) {
    const code = id.slice("product:".length)
    const product = checklist.products.find((item) => item.code === code)
    return product ? `${code} ${product.shortName}` : code
  }
  const code = id.startsWith("series:") ? id.slice("series:".length) : id
  const series = readySeries.find((item) => item.code === code)
  return series ? `${series.name} ${series.code}` : code
}

export function describeMain(id: string | null): {
  code: string
  name: string
  publisher: string
  sourceUrl: string
  spec: ChartSpec
} | null {
  if (!id || id === "series:932047") {
    return {
      code: csi932047.code,
      name: csi932047.name,
      publisher: csi932047.publisher,
      sourceUrl: csi932047.sourceUrl,
      spec: chartSpecForSeries("932047")!,
    }
  }
  if (id.startsWith("product:")) {
    const code = id.slice("product:".length)
    const product = checklist.products.find((item) => item.code === code)
    const series = dailySeries(code)
    if (!product || !series) return null
    return {
      code,
      name: product.shortName,
      publisher: series.sourceLabel,
      sourceUrl: series.sourceUrl,
      spec: {
        bars: series.bars,
        volumeUnit: series.volumeUnit,
        sourceLabel: series.sourceLabel,
        sourceUrl: series.sourceUrl,
      },
    }
  }
  if (id.startsWith("series:")) {
    const code = id.slice("series:".length)
    const series = readySeries.find((item) => item.code === code)
    const spec = chartSpecForSeries(code)
    if (!series || !spec) return null
    return {
      code: series.code,
      name: series.name,
      publisher: series.publisher,
      sourceUrl: series.sourceUrl,
      spec,
    }
  }
  return null
}
