"use client"

import { useSyncExternalStore } from "react"
import { isProductId, isSeriesId } from "@/lib/series-catalog"

const STORAGE_KEY = "reit-watchlist"
const CHANGE_EVENT = "reit-watchlist"

export type WatchItem = {
  id: string
  shown: boolean
  overlay: boolean
}

export type WatchState = {
  primaryId: string | null
  items: WatchItem[]
}

const EMPTY: WatchState = { primaryId: null, items: [] }

let cache = EMPTY
let loaded = false

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
      if (overlays > 4) item.overlay = false
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

function commit(next: WatchState) {
  cache = next
  loaded = true
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function getWatch(): WatchState {
  if (typeof window === "undefined") return EMPTY
  if (!loaded) {
    cache = readWatch()
    loaded = true
  }
  return cache
}

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    loaded = false
    onStoreChange()
  }
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStorage)
  }
}

export function useWatchlist(): WatchState {
  return useSyncExternalStore(subscribe, getWatch, () => EMPTY)
}

export function productWatchId(code: string): string {
  return `product:${code}`
}

export function rememberWatch(id: string) {
  if (!savable(id)) return
  const current = getWatch()
  const existing = current.items.find((item) => item.id === id)
  if (existing) {
    if (existing.shown) return
    commit({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, shown: true } : item)),
    })
    return
  }
  commit({ ...current, items: [...current.items, { id, shown: true, overlay: false }] })
}

export function saveProductOnce(code: string) {
  const id = productWatchId(code)
  if (!savable(id)) return
  const current = getWatch()
  if (current.items.some((item) => item.id === id)) return
  commit({ ...current, items: [...current.items, { id, shown: true, overlay: false }] })
}

export function removeWatch(id: string) {
  const current = getWatch()
  commit({
    primaryId: current.primaryId === id ? null : current.primaryId,
    items: current.items.filter((item) => item.id !== id),
  })
}

export function toggleWatchShown(id: string) {
  const current = getWatch()
  const item = current.items.find((entry) => entry.id === id)
  if (!item) return
  const shown = !item.shown
  commit({
    primaryId: !shown && current.primaryId === id ? null : current.primaryId,
    items: current.items.map((entry) =>
      entry.id === id ? { ...entry, shown, overlay: shown ? entry.overlay : false } : entry
    ),
  })
}

export function makeWatchPrimary(id: string) {
  const current = getWatch()
  if (!current.items.some((item) => item.id === id)) return
  commit({
    primaryId: id,
    items: current.items.map((item) =>
      item.id === id ? { ...item, shown: true, overlay: false } : item
    ),
  })
}

export function clearWatchPrimary() {
  const current = getWatch()
  if (current.primaryId == null) return
  commit({ ...current, primaryId: null })
}

export function setWatchOverlay(id: string, overlay: boolean) {
  const current = getWatch()
  if (!current.items.some((item) => item.id === id)) return
  commit({
    ...current,
    items: current.items.map((entry) => (entry.id === id ? { ...entry, overlay } : entry)),
  })
}
