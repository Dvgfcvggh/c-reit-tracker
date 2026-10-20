"use client"

import { useEffect, useRef, useState } from "react"
import { dailySeries, type DailyBar } from "@/lib/daily-bars"
import { formatPrice, formatVolume } from "@/lib/market"

const UP = "#ff4d4f"
const DOWN = "#1dbf73"

export type ChartSpec = {
  bars: DailyBar[]
  volumeUnit: string
  sourceLabel: string
  sourceUrl: string
  note?: string
}

function specFromCode(code: string): ChartSpec | null {
  const series = dailySeries(code)
  if (!series) return null
  return {
    bars: series.bars,
    volumeUnit: series.volumeUnit,
    sourceLabel: series.sourceLabel,
    sourceUrl: series.sourceUrl,
  }
}

export function DailyChart({ code, spec }: { code?: string; spec?: ChartSpec }) {
  const host = useRef<HTMLDivElement>(null)
  const series = spec ?? (code ? specFromCode(code) : null)
  const [active, setActive] = useState<DailyBar | null>(series?.bars.at(-1) ?? null)

  useEffect(() => {
    const nextSeries = spec ?? (code ? specFromCode(code) : null)
    setActive(nextSeries?.bars.at(-1) ?? null)
    const el = host.current
    if (!el || !nextSeries) return
    let chart: { remove: () => void } | null = null
    let disposed = false

    ;(async () => {
      const lc = await import("lightweight-charts")
      if (disposed || !host.current) return
      const width = host.current.clientWidth
      const next = lc.createChart(host.current, {
        width,
        height: host.current.clientHeight,
        layout: {
          background: { type: lc.ColorType.Solid, color: "#10161c" },
          textColor: "#c5ced6",
          fontFamily: "inherit",
        },
        grid: {
          vertLines: { color: "rgba(197,206,214,0.08)" },
          horzLines: { color: "rgba(197,206,214,0.08)" },
        },
        rightPriceScale: { borderColor: "rgba(197,206,214,0.16)" },
        timeScale: { borderColor: "rgba(197,206,214,0.16)", rightOffset: 2 },
        crosshair: { mode: lc.CrosshairMode.Normal },
        handleScroll: { vertTouchDrag: false },
      })
      const candles = next.addSeries(lc.CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
      })
      const volume = next.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      })
      candles.setData(
        nextSeries.bars.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }))
      )
      volume.setData(
        nextSeries.bars.map((bar) => ({
          time: bar.time,
          value: bar.volume,
          color: bar.close >= bar.open ? "rgba(255,77,79,0.45)" : "rgba(29,191,115,0.45)",
        }))
      )
      candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } })
      next.priceScale("volume").applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })
      next.timeScale().fitContent()
      next.subscribeCrosshairMove((param) => {
        const row = param.seriesData.get(candles)
        if (!row || !("open" in row)) {
          setActive(nextSeries.bars.at(-1) ?? null)
          return
        }
        const match = nextSeries.bars.find((bar) => bar.time === param.time)
        if (match) setActive(match)
      })
      const observer = new ResizeObserver(() => {
        if (!host.current) return
        next.applyOptions({ width: host.current.clientWidth, height: host.current.clientHeight })
      })
      observer.observe(host.current)
      chart = {
        remove: () => {
          observer.disconnect()
          next.remove()
        },
      }
    })()

    return () => {
      disposed = true
      chart?.remove()
    }
  }, [code, spec])

  if (!series) {
    return (
      <p className="bg-[#10161c] px-2 py-4 text-xs leading-5 text-[#9aa3ad]">
        没有可核对的交易所日K，不补画。
      </p>
    )
  }

  const first = series.bars[0]
  const last = series.bars[series.bars.length - 1]
  const shown = active ?? last

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-muted-foreground">
        日K {first.time}–{last.time} · {series.bars.length} 根 · 成交量（{series.volumeUnit}）在下方 · 无分时无盘口
        {series.note ? ` · ${series.note}` : ""}
      </p>
      <dl className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
        <Readout label="日期" value={shown.time} />
        <Readout label="开" value={formatPrice(shown.open)} />
        <Readout label="高" value={formatPrice(shown.high)} />
        <Readout label="低" value={formatPrice(shown.low)} />
        <Readout label="收" value={formatPrice(shown.close)} />
        <Readout label="量" value={formatBarVolume(shown.volume, series.volumeUnit)} />
      </dl>
      <div ref={host} className="h-64 w-full sm:h-80" />
      <a className="text-xs underline underline-offset-2" href={series.sourceUrl} target="_blank" rel="noreferrer">
        {series.sourceLabel}
      </a>
    </div>
  )
}

function formatBarVolume(value: number, unit: string): string {
  if (unit === "份" || unit === "万份") return formatVolume(value, unit)
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
