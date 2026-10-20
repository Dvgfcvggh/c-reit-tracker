import raw from "@/data/csi-932047.json"
import type { ChartSpec } from "@/components/daily-chart"
import type { DailyBar } from "@/lib/daily-bars"

type Raw = {
  code: string
  name: string
  publisher: string
  sourceUrl: string
  volumeLabel: string
  start: string
  end: string
  skippedCloseOnly: { tradeDate: string; close: number }[]
  bars: number[][]
}

const file = raw as Raw

function ymd(value: number): string {
  const text = String(value)
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
}

const bars: DailyBar[] = file.bars.map((row) => ({
  time: ymd(row[0]),
  open: row[1],
  high: row[2],
  low: row[3],
  close: row[4],
  volume: row[5],
}))

export const csi932047 = {
  code: file.code,
  name: file.name,
  publisher: file.publisher,
  sourceUrl: file.sourceUrl,
  start: ymd(Number(file.start)),
  end: ymd(Number(file.end)),
  skippedCloseOnly: file.skippedCloseOnly.map((row) => row.tradeDate),
  spec: {
    bars,
    volumeUnit: file.volumeLabel,
    sourceLabel: file.publisher,
    sourceUrl: file.sourceUrl,
    note: "2020-01-01 与 2021-09-30 只有收盘，没有开高低，未画入",
  } satisfies ChartSpec,
}
