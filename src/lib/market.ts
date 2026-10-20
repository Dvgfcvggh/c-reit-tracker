import checklistJson from "@/data/checklist.json"
import partiesJson from "@/data/parties.json"

export type Distribution = {
  code: string
  perUnit: string
  scheme: string
  divisor: number
  recordDate: string
  exDate: string | null
  announcementDate: string
  sourceUrl: string
  title: string
}

export type Party = {
  name: string
  sourceUrl: string | null
  sourceTitle: string | null
  asOf: string | null
  listName?: string
  note?: string
}

export type HoldingDisclosure =
  | {
      status: "value"
      ratio: number
      approximate?: boolean
      periodEnd: string
      periodLabel: string
      sourceUrl: string
      sourceTitle: string
    }
  | {
      status: "undisclosed"
    }
  | {
      status: "unparsed"
      periodEnd: string
      periodLabel: string
      sourceUrl: string
      sourceTitle: string
    }

export type Product = {
  code: string
  shortName: string
  expandedName: string
  exchange: "SSE" | "SZSE"
  sector: string | null
  sectorOthers: string[]
  sectorSourceUrl: string | null
  sectorSourceTitle: string | null
  listingDate: string | null
  listingSourceUrl?: string
  manager: Party | null
  originalEquityHolders: Party[]
  operatingManagers: Party[]
  institutionHolding: HoldingDisclosure | null
  sponsorAffiliateHolding: HoldingDisclosure | null
  quote: {
    tradeDate: string
    close: number | null
    prevClose: number | null
    changePct: number | null
    changeAmt: number | null
    volume: number | null
    volumeUnit: "份" | "万份"
    sourceUrl: string
    sourceLabel: string
  }
  distributions: Distribution[]
}

export type UnlockEvent = {
  code: string
  name: string
  exchange: "SSE" | "SZSE"
  unlockDate: string
  shares: number
  announcementDate: string | null
  sourceUrl: string
  title: string
}

export type Checklist = {
  checkedOn: string
  tradeDate: string
  distributionWindow: { start: string; end: string; basis: string }
  exchanges: {
    SSE: ExchangeList
    SZSE: ExchangeList
  }
  products: Product[]
  unlocks: UnlockEvent[]
}

type ExchangeList = {
  label: string
  listedCount: number
  codes: string[]
  listSourceUrl: string
  listAsOf: string
  volumeUnit: string
  note: string
  quoteSourceUrl?: string
}

export const checklist = checklistJson as Checklist

export type BoardStatus = "ready" | "unaligned" | "error"

export function assess(data: Checklist): BoardStatus {
  if (!data.tradeDate || !data.products || !data.exchanges) return "error"
  for (const key of ["SSE", "SZSE"] as const) {
    const listed = data.exchanges[key]
    const rows = data.products.filter((p) => p.exchange === key)
    const codes = new Set(rows.map((p) => p.code))
    const official = new Set(listed.codes)
    if (listed.listedCount !== official.size) return "unaligned"
    if (codes.size !== official.size) return "unaligned"
    for (const code of official) {
      if (!codes.has(code)) return "unaligned"
    }
    if (rows.some((p) => p.quote.tradeDate !== data.tradeDate && p.quote.close != null)) {
      return "error"
    }
  }
  return "ready"
}

export function missingMilestoneFields(product: Product): string[] {
  const missing: string[] = []
  if (!product.sector) missing.push("业态")
  if (!product.manager?.name) missing.push("基金管理人")
  if (!product.manager?.sourceUrl) missing.push("管理人来源")
  if (!product.sectorSourceUrl) missing.push("业态来源")
  if (!product.quote.sourceUrl) missing.push("行情来源")
  if (product.quote.close == null) missing.push("收盘")
  if (product.originalEquityHolders.length === 0) missing.push("原始权益人")
  if (product.operatingManagers.length === 0) missing.push("运营管理机构")
  return missing
}

export function relationCompleteCount(products: Product[]): number {
  return products.filter(
    (p) =>
      Boolean(p.manager?.name) &&
      p.originalEquityHolders.length > 0 &&
      p.operatingManagers.length > 0
  ).length
}

const WINDOW_MONTHS = 12

export function monthsSinceListing(listingDate: string | null, tradeDate: string): number | null {
  if (!listingDate) return null
  const start = new Date(`${listingDate}T00:00:00Z`)
  const end = new Date(`${tradeDate}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  if (end.getUTCDate() < start.getUTCDate()) months -= 1
  return Math.max(months, 0)
}

export type YieldView = {
  kind: "value" | "none" | "no-close"
  sumPerUnit: number | null
  yieldPct: number | null
  shortSpan: string | null
}

export function yieldView(product: Product, tradeDate: string, windowStart: string): YieldView {
  if (product.quote.close == null) {
    return { kind: "no-close", sumPerUnit: null, yieldPct: null, shortSpan: null }
  }
  const rows = product.distributions.filter(
    (d) => d.announcementDate >= windowStart && d.announcementDate <= tradeDate
  )
  const months = monthsSinceListing(product.listingDate, tradeDate)
  const shortSpan =
    months != null && months < WINDOW_MONTHS
      ? months < 1
        ? `上市未满 12 个月，实际区间 ${product.listingDate} 至 ${tradeDate}（不足 1 个月）`
        : `上市未满 12 个月，实际区间 ${product.listingDate} 至 ${tradeDate}（约 ${months} 个月）`
      : null
  if (rows.length === 0) {
    return { kind: "none", sumPerUnit: null, yieldPct: null, shortSpan }
  }
  const sum = rows.reduce((acc, row) => acc + Number(row.perUnit), 0)
  return {
    kind: "value",
    sumPerUnit: sum,
    yieldPct: (sum / product.quote.close) * 100,
    shortSpan,
  }
}

export function formatPrice(value: number): string {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  })
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

export function formatVolume(value: number, unit: "份" | "万份"): string {
  if (unit === "份") {
    return `${Math.round(value).toLocaleString("zh-CN")} 份`
  }
  return `${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} 万份`
}

export function formatShares(value: number): string {
  return `${value.toLocaleString("zh-CN")} 份`
}

export function formatPerUnit(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value)
  return n.toLocaleString("zh-CN", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })
}

export function exchangeLabel(exchange: "SSE" | "SZSE"): string {
  return exchange === "SSE" ? "上交所" : "深交所"
}

export function groupByManager(products: Product[]): { name: string; products: Product[] }[] {
  const map = new Map<string, Product[]>()
  for (const product of products) {
    const name = product.manager?.name ?? "管理人未填"
    const list = map.get(name) ?? []
    list.push(product)
    map.set(name, list)
  }
  return [...map.entries()]
    .map(([name, rows]) => ({
      name,
      products: [...rows].sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => b.products.length - a.products.length || a.name.localeCompare(b.name, "zh"))
}

type PartiesFile = {
  checkedOn: string
  products: Record<
    string,
    {
      originalEquityHolders?: Party[]
      operatingManagers?: Party[]
      institutionHolding?: HoldingDisclosure | null
      sponsorAffiliateHolding?: HoldingDisclosure | null
    }
  >
}

const parties = partiesJson as PartiesFile

export function applyDisclosures(product: Product): Product {
  const extra = parties.products[product.code]
  if (!extra) {
    return {
      ...product,
      institutionHolding: product.institutionHolding ?? { status: "undisclosed" },
      sponsorAffiliateHolding: product.sponsorAffiliateHolding ?? { status: "undisclosed" },
    }
  }
  return {
    ...product,
    originalEquityHolders: extra.originalEquityHolders ?? [],
    operatingManagers: extra.operatingManagers ?? [],
    institutionHolding: extra.institutionHolding ?? { status: "undisclosed" },
    sponsorAffiliateHolding: extra.sponsorAffiliateHolding ?? { status: "undisclosed" },
  }
}

export type RoleKey = "manager" | "sponsor" | "operator"

export function groupByRole(products: Product[], role: RoleKey): { name: string; products: Product[] }[] {
  const map = new Map<string, Product[]>()
  const missing =
    role === "manager"
      ? "基金管理人未从公告读出"
      : role === "sponsor"
        ? "原始权益人未从公告读出"
        : "运营管理机构未从公告读出"
  for (const product of products) {
    const partiesForProduct =
      role === "manager"
        ? product.manager
          ? [product.manager]
          : []
        : role === "sponsor"
          ? product.originalEquityHolders
          : product.operatingManagers
    const labels = partiesForProduct.length
      ? partiesForProduct.map((party) => (party.note ? `${party.name}（${party.note}）` : party.name))
      : [missing]
    for (const label of labels) {
      const list = map.get(label) ?? []
      if (!list.includes(product)) list.push(product)
      map.set(label, list)
    }
  }
  return [...map.entries()]
    .map(([name, rows]) => ({
      name,
      products: [...rows].sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => b.products.length - a.products.length || a.name.localeCompare(b.name, "zh"))
}

export function nextDividend(
  product: Product,
  tradeDate: string
): { kind: "登记" | "除息"; date: string } | null {
  const upcoming: { kind: "登记" | "除息"; date: string }[] = []
  for (const row of product.distributions) {
    if (row.recordDate && row.recordDate >= tradeDate) upcoming.push({ kind: "登记", date: row.recordDate })
    if (row.exDate && row.exDate >= tradeDate) upcoming.push({ kind: "除息", date: row.exDate })
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind, "zh"))
  return upcoming[0] ?? null
}

export function nextUnlock(code: string, unlocks: UnlockEvent[], tradeDate: string): UnlockEvent | null {
  return (
    unlocks
      .filter((row) => row.code === code && row.unlockDate >= tradeDate)
      .sort((a, b) => a.unlockDate.localeCompare(b.unlockDate))[0] ?? null
  )
}

export type SortKey = "code" | "name" | "exchange" | "sector" | "close" | "change" | "volume" | "yield" | "manager"
export type SortDir = "asc" | "desc"

function yieldNumber(product: Product, tradeDate: string, windowStart: string): number | null {
  const view = yieldView(product, tradeDate, windowStart)
  return view.kind === "value" ? view.yieldPct : null
}

function compareNullable(a: number | null, b: number | null, dir: SortDir): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return dir === "asc" ? a - b : b - a
}

export function sortProducts(
  products: Product[],
  key: SortKey,
  dir: SortDir,
  tradeDate: string,
  windowStart: string
): Product[] {
  const sign = dir === "asc" ? 1 : -1
  return [...products].sort((a, b) => {
    if (key === "code") return a.code.localeCompare(b.code) * sign
    if (key === "name") return a.shortName.localeCompare(b.shortName, "zh") * sign
    if (key === "exchange") return a.exchange.localeCompare(b.exchange) * sign
    if (key === "sector") return (a.sector ?? "").localeCompare(b.sector ?? "", "zh") * sign
    if (key === "manager") return (a.manager?.name ?? "").localeCompare(b.manager?.name ?? "", "zh") * sign
    if (key === "close") return compareNullable(a.quote.close, b.quote.close, dir)
    if (key === "change") return compareNullable(a.quote.changePct, b.quote.changePct, dir)
    if (key === "volume") return compareNullable(a.quote.volume, b.quote.volume, dir)
    return compareNullable(yieldNumber(a, tradeDate, windowStart), yieldNumber(b, tradeDate, windowStart), dir)
  })
}
