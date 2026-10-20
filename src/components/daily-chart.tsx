"use client"

import { useEffect, useRef, useState } from "react"
import { chartPalette, useTheme } from "@/components/theme"
import { dailySeries } from "@/lib/daily-bars"
import { formatPrice, formatVolume } from "@/lib/market"

export type ChartPoint = {
  time: string
  close: number
  open?: number
  high?: number
  low?: number
  volume?: number
}

export type ChartSpec = {
  bars: ChartPoint[]
  volumeUnit?: string
  sourceLabel: string
  sourceUrl: string
  note?: string
  priceDigits?: number
}

export type OverlayLine = {
  id: string
  label: string
  color: string
  points: { time: string; value: number }[]
}

const NO_OVERLAYS: OverlayLine[] = []

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

function hasCandle(bars: ChartPoint[]): boolean {
  return bars.length > 0 && bars.every((bar) => bar.open != null && bar.high != null && bar.low != null)
}

function timeText(time: unknown): string {
  if (typeof time === "string") return time
  if (time && typeof time === "object" && "year" in time) {
    const value = time as { year: number; month: number; day: number }
    const month = String(value.month).padStart(2, "0")
    const day = String(value.day).padStart(2, "0")
    return `${value.year}-${month}-${day}`
  }
  return ""
}

export function DailyChart({
  code,
  spec,
  overlays = NO_OVERLAYS,
}: {
  code?: string
  spec?: ChartSpec
  overlays?: OverlayLine[]
}) {
  const { theme } = useTheme()
  const host = useRef<HTMLDivElement>(null)
  const series = spec ?? (code ? specFromCode(code) : null)
  const [active, setActive] = useState<ChartPoint | null>(series?.bars.at(-1) ?? null)

  useEffect(() => {
    const palette = chartPalette(theme)
    const nextSeries = spec ?? (code ? specFromCode(code) : null)
    setActive(nextSeries?.bars.at(-1) ?? null)
    const el = host.current
    if (!el || !nextSeries || nextSeries.bars.length === 0) return
    let chart: { remove: () => void } | null = null
    let disposed = false
    const candles = hasCandle(nextSeries.bars)
    const volumeBars = nextSeries.bars.filter((bar) => typeof bar.volume === "number")
    const drawVolume = Boolean(nextSeries.volumeUnit) && volumeBars.length > 0
    const priceFormat =
      nextSeries.priceDigits == null
        ? undefined
        : {
            type: "price" as const,
            precision: nextSeries.priceDigits,
            minMove: Number((1 / 10 ** nextSeries.priceDigits).toFixed(nextSeries.priceDigits)),
          }

    ;(async () => {
      const lc = await import("lightweight-charts")
      if (disposed || !host.current) return
      const next = lc.createChart(host.current, {
        width: host.current.clientWidth,
        height: host.current.clientHeight,
        layout: {
          background: { type: lc.ColorType.Solid, color: palette.background },
          textColor: palette.text,
          fontFamily: "inherit",
        },
        grid: {
          vertLines: { color: palette.grid },
          horzLines: { color: palette.grid },
        },
        rightPriceScale: { borderColor: palette.border },
        leftPriceScale: { visible: overlays.length > 0, borderColor: palette.border },
        timeScale: { borderColor: palette.border, rightOffset: 2 },
        crosshair: { mode: lc.CrosshairMode.Normal },
        handleScroll: { vertTouchDrag: false },
      })
      const main = candles
        ? next.addSeries(lc.CandlestickSeries, {
            upColor: palette.up,
            downColor: palette.down,
            borderUpColor: palette.up,
            borderDownColor: palette.down,
            wickUpColor: palette.up,
            wickDownColor: palette.down,
            priceFormat,
          })
        : next.addSeries(lc.LineSeries, {
            color: palette.text,
            lineWidth: 2,
            priceFormat,
          })
      if (candles) {
        main.setData(
          nextSeries.bars.map((bar) => ({
            time: bar.time,
            open: bar.open as number,
            high: bar.high as number,
            low: bar.low as number,
            close: bar.close,
          }))
        )
      } else {
        main.setData(nextSeries.bars.map((bar) => ({ time: bar.time, value: bar.close })))
      }
      if (drawVolume) {
        const volume = next.addSeries(lc.HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
        })
        volume.setData(
          volumeBars.map((bar) => ({
            time: bar.time,
            value: bar.volume as number,
            color:
              bar.open == null
                ? palette.volumeNeutral
                : bar.close >= bar.open
                  ? palette.volumeUp
                  : palette.volumeDown,
          }))
        )
        next.priceScale("volume").applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } })
      }
      main.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: drawVolume ? 0.28 : 0.08 } })
      for (const line of overlays) {
        const overlay = next.addSeries(lc.LineSeries, {
          color: line.color,
          lineWidth: 2,
          priceScaleId: "left",
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        })
        overlay.setData(line.points)
      }
      next.timeScale().fitContent()
      next.subscribeCrosshairMove((param) => {
        const time = timeText(param.time)
        const match = time ? nextSeries.bars.find((bar) => bar.time === time) : undefined
        setActive(match ?? nextSeries.bars.at(-1) ?? null)
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
  }, [code, spec, theme, overlays])

  if (!series || series.bars.length === 0) {
    return (
      <p className="bg-[var(--panel)] px-2 py-4 text-xs leading-5 text-[var(--muted-ink)]">
        {code ? "没有可核对的交易所日K，不补画。" : "没有可画的官方日线，不补数。"}
      </p>
    )
  }

  const first = series.bars[0]
  const last = series.bars[series.bars.length - 1]
  const shown = active ?? last
  const candle = hasCandle(series.bars)
  const drawVolume = Boolean(series.volumeUnit) && series.bars.some((bar) => typeof bar.volume === "number")

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-muted-foreground">
        {candle ? "日K" : "收盘"} {first.time}–{last.time} · {series.bars.length}{" "}
        {candle ? "根" : "个"}
        {drawVolume
          ? series.volumeUnit === "份" || series.volumeUnit === "万份"
            ? ` · 成交量（${series.volumeUnit}）在下方`
            : " · 成交量在下方"
          : " · 不画成交量"}
        {candle ? "" : " · 没有开高低，不补K线"}
        {overlays.length > 0 ? " · 叠加线在左轴，各自第一条收盘记为 100" : ""}
        {" · 无分时无盘口"}
        {series.note ? ` · ${series.note}` : ""}
      </p>
      <dl className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
        <Readout label="日期" value={shown.time} />
        {candle ? <Readout label="开" value={formatLevel(shown.open, series.priceDigits)} /> : null}
        {candle ? <Readout label="高" value={formatLevel(shown.high, series.priceDigits)} /> : null}
        {candle ? <Readout label="低" value={formatLevel(shown.low, series.priceDigits)} /> : null}
        <Readout label="收" value={formatLevel(shown.close, series.priceDigits)} />
        {drawVolume ? (
          <Readout
            label="量"
            value={
              shown.volume == null ? "—" : formatBarVolume(shown.volume, series.volumeUnit ?? "")
            }
          />
        ) : null}
      </dl>
      {overlays.length > 0 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {overlays.map((line) => {
            const point = line.points.find((item) => item.time === shown.time)
            return (
              <li key={line.id} className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2" style={{ background: line.color }} />
                <span>{line.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {point ? point.value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div ref={host} className="h-64 w-full bg-[var(--panel)] sm:h-80" />
      <a className="text-xs underline underline-offset-2" href={series.sourceUrl} target="_blank" rel="noreferrer">
        {series.sourceLabel}
      </a>
    </div>
  )
}

function formatLevel(value: number | undefined, digits?: number): string {
  if (value == null) return "—"
  if (digits == null) return formatPrice(value)
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
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
