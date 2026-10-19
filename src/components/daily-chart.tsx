"use client"

import { useEffect, useRef, useState } from "react"
import { dailySeries, type DailyBar } from "@/lib/daily-bars"
import { formatPrice, formatVolume } from "@/lib/market"

const UP = "#b42318"
const DOWN = "#067647"

export function DailyChart({ code }: { code: string }) {
  const host = useRef<HTMLDivElement>(null)
  const series = dailySeries(code)
  const [active, setActive] = useState<DailyBar | null>(series?.bars.at(-1) ?? null)

  useEffect(() => {
    const nextSeries = dailySeries(code)
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
          background: { type: lc.ColorType.Solid, color: "#fffdf8" },
          textColor: "#3f3a33",
          fontFamily: "inherit",
        },
        grid: {
          vertLines: { color: "rgba(28,25,21,0.06)" },
          horzLines: { color: "rgba(28,25,21,0.06)" },
        },
        rightPriceScale: { borderColor: "rgba(28,25,21,0.12)" },
        timeScale: { borderColor: "rgba(28,25,21,0.12)", rightOffset: 2 },
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
          color: bar.close >= bar.open ? "rgba(180,35,24,0.45)" : "rgba(6,118,71,0.45)",
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
  }, [code])

  if (!series) {
    return (
      <p className="rounded-lg bg-[#f6f1e6] px-3 py-6 text-sm leading-6">
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
        日K，{first.time} 至 {last.time}，{series.bars.length} 根。涨红跌绿。成交量在图下，单位是{series.volumeUnit}。没有分时，没有盘口。
      </p>
      <dl className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
        <Readout label="日期" value={shown.time} />
        <Readout label="开" value={formatPrice(shown.open)} />
        <Readout label="高" value={formatPrice(shown.high)} />
        <Readout label="低" value={formatPrice(shown.low)} />
        <Readout label="收" value={formatPrice(shown.close)} />
        <Readout label="量" value={formatVolume(shown.volume, series.volumeUnit)} />
      </dl>
      <div ref={host} className="h-72 w-full sm:h-96" />
      <a className="text-xs underline underline-offset-2" href={series.sourceUrl} target="_blank" rel="noreferrer">
        {series.sourceLabel}
      </a>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
