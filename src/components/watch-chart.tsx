"use client"

import { useEffect, useMemo, useState } from "react"
import { DailyChart, type OverlayLine } from "@/components/daily-chart"
import { overlayColor, useTheme } from "@/components/theme"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { checklist } from "@/lib/market"
import {
  closesFor,
  describeMain,
  isProductId,
  isSeriesId,
  labelFor,
  readySeries,
  unavailableSeries,
} from "@/lib/series-catalog"

const STORAGE_KEY = "reit-watchlist"
const MAX_OVERLAYS = 4

type WatchItem = {
  id: string
  shown: boolean
  overlay: boolean
}

type WatchState = {
  primaryId: string | null
  items: WatchItem[]
}

const EMPTY: WatchState = { primaryId: null, items: [] }

function savable(id: string): boolean {
  return isProductId(id) || isSeriesId(id)
}

function readWatch(): WatchState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "")
    if (!raw || !Array.isArray(raw.items)) return EMPTY
    const items: WatchItem[] = []
    for (const item of raw.items) {
      if (!item || typeof item.id !== "string" || !savable(item.id)) continue
      if (items.some((saved) => saved.id === item.id)) continue
      items.push({
        id: item.id,
        shown: item.shown !== false,
        overlay: Boolean(item.overlay) && item.shown !== false,
      })
    }
    let overlays = 0
    for (const item of items) {
      if (!item.overlay) continue
      overlays += 1
      if (overlays > MAX_OVERLAYS) item.overlay = false
    }
    const primaryId =
      typeof raw.primaryId === "string" && items.some((item) => item.id === raw.primaryId && item.shown)
        ? raw.primaryId
        : null
    return { primaryId, items }
  } catch {
    return EMPTY
  }
}

function Choice({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={
        pressed
          ? "bg-[var(--ink)] px-2 py-0.5 text-[var(--page)] disabled:opacity-40"
          : "px-2 py-0.5 text-[var(--muted-ink)] disabled:opacity-40"
      }
    >
      {children}
    </button>
  )
}

export function WatchChart() {
  const { theme } = useTheme()
  const [state, setState] = useState<WatchState>(EMPTY)
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    setState(readWatch())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [ready, state])

  const mainId = state.primaryId ?? "series:932047"
  const main = describeMain(state.primaryId) ?? describeMain(null)
  const overlayCount = state.items.filter((item) => item.overlay && item.shown && item.id !== mainId).length

  const matches = useMemo(() => {
    const text = query.trim()
    if (!text) return []
    return checklist.products
      .filter(
        (product) =>
          product.code.includes(text) ||
          product.shortName.includes(text) ||
          product.expandedName.includes(text)
      )
      .slice(0, 6)
  }, [query])

  const overlays = useMemo(() => {
    const lines: OverlayLine[] = []
    for (const item of state.items) {
      if (!item.shown || !item.overlay || item.id === mainId) continue
      const closes = closesFor(item.id)
      const base = closes[0]?.close
      if (!base) continue
      lines.push({
        id: item.id,
        label: labelFor(item.id),
        color: overlayColor(theme, lines.length),
        points: closes.map((point) => ({ time: point.time, value: (point.close / base) * 100 })),
      })
      if (lines.length >= MAX_OVERLAYS) break
    }
    return lines
  }, [mainId, state.items, theme])

  function add(id: string) {
    if (!savable(id)) return
    setNotice("")
    setState((current) => {
      const existing = current.items.find((item) => item.id === id)
      if (existing) {
        return {
          ...current,
          items: current.items.map((item) => (item.id === id ? { ...item, shown: true } : item)),
        }
      }
      return { ...current, items: [...current.items, { id, shown: true, overlay: false }] }
    })
    setQuery("")
  }

  function remove(id: string) {
    setState((current) => ({
      primaryId: current.primaryId === id ? null : current.primaryId,
      items: current.items.filter((item) => item.id !== id),
    }))
  }

  function toggleShown(id: string) {
    setState((current) => {
      const item = current.items.find((entry) => entry.id === id)
      if (!item) return current
      const shown = !item.shown
      return {
        primaryId: !shown && current.primaryId === id ? null : current.primaryId,
        items: current.items.map((entry) =>
          entry.id === id ? { ...entry, shown, overlay: shown ? entry.overlay : false } : entry
        ),
      }
    })
  }

  function makePrimary(id: string) {
    setNotice("")
    setState((current) => ({
      primaryId: id,
      items: current.items.map((item) =>
        item.id === id ? { ...item, shown: true, overlay: false } : item
      ),
    }))
  }

  function toggleOverlay(id: string) {
    if (id === mainId) return
    const item = state.items.find((entry) => entry.id === id)
    if (!item || !item.shown) return
    if (!item.overlay && overlayCount >= MAX_OVERLAYS) {
      setNotice("最多叠加 4 条。")
      return
    }
    setNotice("")
    setState((current) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.id === id ? { ...entry, overlay: !entry.overlay } : entry
      ),
    }))
  }

  if (!main) {
    return (
      <section id="index" className="border border-[var(--line)] bg-[var(--panel)] p-2">
        <p className="text-xs text-[var(--muted-ink)]">主图没有可画的官方日线，不补数。</p>
      </section>
    )
  }

  return (
    <section id="index" className="border border-[var(--line)] bg-[var(--panel)] p-2">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium">
          主图 {main.name} {main.code}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {main.code !== "932047" ? (
            <Button size="xs" variant="outline" onClick={() => setState((current) => ({ ...current, primaryId: null }))}>
              改回 932047
            </Button>
          ) : null}
          <a
            className="text-[11px] text-[var(--muted-ink)] underline-offset-2 hover:underline"
            href={main.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {main.publisher}
          </a>
        </div>
      </div>
      <p className="mb-2 text-[11px] leading-5 text-[var(--muted-ink)]">
        自选只留在这台浏览器。显示决定这条出不出现，主图把它换到上面，叠加把别的收盘画到左轴。
      </p>
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            const exact = checklist.products.find((product) => product.code === query.trim())
            if (exact) add(`product:${exact.code}`)
          }}
          placeholder="代码或简称，加入自选"
          aria-label="加入自选"
          className="h-7 max-w-xs text-xs"
        />
      </div>
      {matches.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1">
          {matches.map((product) => (
            <li key={product.code}>
              <Button size="xs" variant="outline" onClick={() => add(`product:${product.code}`)}>
                {product.code} {product.shortName} 加入
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {state.items.length === 0 ? (
        <p className="mb-2 text-[11px] text-[var(--muted-ink)]">还没有自选。主图仍是 932047。</p>
      ) : (
        <ul className="mb-2">
          {state.items.map((item) => {
            const primary = state.primaryId === item.id
            return (
              <li
                key={item.id}
                className={`flex flex-wrap items-center gap-1 border-b border-[var(--line)] py-1 text-[11px] ${item.shown ? "" : "opacity-50"}`}
              >
                <span className="min-w-0 flex-1">{labelFor(item.id)}</span>
                <div className="inline-flex border border-[var(--line)]">
                  <Choice pressed={item.shown} onClick={() => toggleShown(item.id)}>
                    显示
                  </Choice>
                  <Choice pressed={primary} disabled={!item.shown} onClick={() => makePrimary(item.id)}>
                    主图
                  </Choice>
                  <Choice
                    pressed={item.overlay}
                    disabled={!item.shown || item.id === mainId}
                    onClick={() => toggleOverlay(item.id)}
                  >
                    叠加
                  </Choice>
                </div>
                <button type="button" className="px-1 text-[var(--muted-ink)] underline-offset-2 hover:underline" onClick={() => remove(item.id)}>
                  移除
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {notice ? <p className="mb-2 text-[11px] text-[var(--muted-ink)]">{notice}</p> : null}
      <p className="text-[11px] text-[var(--muted-ink)]">
        已叠加 {overlayCount}/{MAX_OVERLAYS}
      </p>
      <Collapsible className="mb-2">
        <CollapsibleTrigger className="py-1 text-[11px] underline-offset-2 hover:underline">
          指数与宏观，{readySeries.length} 条可加入
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y divide-[var(--line)]">
            {readySeries.map((series) => {
              const saved = state.items.some((item) => item.id === series.id)
              return (
                <li key={series.id} className="flex flex-wrap items-center gap-2 py-1 text-[11px]">
                  <span className="min-w-0 flex-1">
                    {series.region} · {series.name} {series.code} · {series.ohlc ? "日K" : "收盘"} · {series.unit} ·{" "}
                    {series.start}–{series.end}
                  </span>
                  <Button size="xs" variant="outline" onClick={() => add(series.id)}>
                    {saved ? "显示" : "加入自选"}
                  </Button>
                </li>
              )
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
      <div className="mb-2">
        <p className="text-[11px] text-[var(--muted-ink)]">没有合规日线，不能加入</p>
        <ul>
          {unavailableSeries.map((series) => (
            <li key={series.code} className="py-0.5 text-[11px] leading-5 text-[var(--muted-ink)]">
              {series.region} · {series.name} {series.code} · 不可用。{series.reason}
            </li>
          ))}
        </ul>
      </div>
      <DailyChart spec={main.spec} overlays={overlays} />
    </section>
  )
}
