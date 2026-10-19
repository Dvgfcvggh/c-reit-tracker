import raw from "@/data/daily-bars.json"

export type DailyBar = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type DailySeries = {
  volumeUnit: "份" | "万份"
  sourceLabel: string
  sourceUrl: string
  bars: DailyBar[]
}

type RawSeries = {
  volumeUnit: "份" | "万份"
  sourceLabel: string
  sourceUrl: string
  bars: number[][]
}

const file = raw as {
  asOf: string
  series: Record<string, RawSeries>
}

export const dailyBarsAsOf = file.asOf

function ymdToTime(ymd: number): string {
  const text = String(ymd)
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
}

export function dailySeries(code: string): DailySeries | null {
  const series = file.series[code]
  if (!series) return null
  const bars: DailyBar[] = []
  for (const row of series.bars) {
    const [ymd, open, high, low, close, volume] = row
    if (
      high + 1e-9 < Math.max(open, close) ||
      low - 1e-9 > Math.min(open, close) ||
      high < low ||
      close <= 0 ||
      volume < 0
    ) {
      continue
    }
    bars.push({
      time: ymdToTime(ymd),
      open,
      high,
      low,
      close,
      volume,
    })
  }
  if (bars.length === 0) return null
  return {
    volumeUnit: series.volumeUnit,
    sourceLabel: series.sourceLabel,
    sourceUrl: series.sourceUrl,
    bars,
  }
}
