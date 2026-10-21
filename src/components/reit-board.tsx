"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { DailyChart } from "@/components/daily-chart"
import { useTheme, type ThemeName } from "@/components/theme"
import { WatchChart } from "@/components/watch-chart"
import {
  applyDisclosures,
  assess,
  checklist,
  exchangeLabel,
  formatPct,
  formatPerUnit,
  formatPrice,
  formatShares,
  formatVolume,
  groupByRole,
  missingMilestoneFields,
  nextDividend,
  nextUnlock,
  relationCompleteCount,
  sortProducts,
  yieldView,
  type HoldingDisclosure,
  type Party,
  type Product,
  type RoleKey,
  type SortDir,
  type SortKey,
} from "@/lib/market"
import { productWatchId, saveProductOnce, useWatchlist } from "@/lib/watchlist"

function PartyNames({ parties, missing }: { parties: Party[]; missing: string }) {
  if (parties.length === 0) return <span className="text-[var(--up)]">{missing}</span>
  return (
    <span className="flex flex-col gap-1">
      {parties.map((party) => (
        <a
          key={`${party.note ?? ""}-${party.name}`}
          className="underline underline-offset-2"
          href={party.sourceUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
        >
          {party.name}
          {party.note ? `（${party.note}）` : ""}
        </a>
      ))}
    </span>
  )
}

function HoldingReadout({ holding }: { holding: HoldingDisclosure | null }) {
  if (!holding || holding.status === "undisclosed") return <span>尚未披露</span>
  if (holding.status === "unparsed") {
    return (
      <span>
        <span className="text-[var(--up)]">未从公告读出</span>
        <a className="mt-1 block underline underline-offset-2" href={holding.sourceUrl} target="_blank" rel="noreferrer">
          {holding.periodLabel}
        </a>
      </span>
    )
  }
  return (
    <span>
      {holding.approximate ? "约 " : ""}
      {holding.ratio.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
      <a className="mt-1 block text-[11px] font-normal text-[var(--muted-ink)] underline underline-offset-2" href={holding.sourceUrl} target="_blank" rel="noreferrer">
        {holding.periodLabel}
      </a>
    </span>
  )
}

function Upcoming({ code, product }: { code: string; product: Product }) {
  const dividend = nextDividend(product, checklist.tradeDate)
  const unlock = nextUnlock(code, checklist.unlocks, checklist.tradeDate)
  return (
    <div className="text-[11px] leading-5 text-[var(--muted-ink)]">
      <div>下一分红 {dividend ? `${dividend.kind} ${dividend.date}` : "无后续"}</div>
      <div>下一解禁 {unlock ? unlock.unlockDate : "无后续"}</div>
    </div>
  )
}

function tone(value: number | null): string {
  if (value == null || value === 0) return "text-[var(--ink)]"
  return value > 0 ? "text-[var(--up)]" : "text-[var(--down)]"
}

function YieldCell({ product }: { product: Product }) {
  const view = yieldView(
    product,
    checklist.tradeDate,
    checklist.distributionWindow.start
  )
  if (view.kind === "no-close") return <span>当日无收盘</span>
  if (view.kind === "none") {
    return (
      <div>
        <div>尚无分配</div>
        {view.shortSpan ? (
          <div className="mt-1 text-xs text-muted-foreground">{view.shortSpan}</div>
        ) : null}
      </div>
    )
  }
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="link" className="h-auto px-0 text-left font-medium tabular-nums" />
        }
      >
        {view.yieldPct!.toLocaleString("zh-CN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
        %
        {view.shortSpan ? (
          <span className="mt-1 block text-[11px] font-normal text-[var(--muted-ink)]">{view.shortSpan}</span>
        ) : null}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {product.code} {product.expandedName}
          </DialogTitle>
          <DialogDescription>已公告分配</DialogDescription>
        </DialogHeader>
        <YieldBreakdown product={product} />
      </DialogContent>
    </Dialog>
  )
}

function YieldBreakdown({ product }: { product: Product }) {
  const rows = product.distributions.filter(
    (d) =>
      d.announcementDate >= checklist.distributionWindow.start &&
      d.announcementDate <= checklist.tradeDate
  )
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={`${row.announcementDate}-${row.recordDate}`} className="border-b pb-2">
            <div className="tabular-nums">
              每份 {formatPerUnit(row.perUnit)} 元
              {row.divisor === 10 ? `（公告方案 ${row.scheme} 元/10 份）` : ""}
            </div>
            <div className="text-muted-foreground">
              公告 {row.announcementDate}
              {row.recordDate ? ` · 登记 ${row.recordDate}` : ""}
              {row.exDate ? ` · 除息 ${row.exDate}` : ""}
            </div>
            <a className="underline underline-offset-2" href={row.sourceUrl} target="_blank" rel="noreferrer">
              {row.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WatchPlus({ code }: { code: string }) {
  const saved = useWatchlist().items.some((item) => item.id === productWatchId(code))
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `${code} 已在自选` : `${code} 加入自选`}
      className={
        saved
          ? "inline-flex size-8 shrink-0 items-center justify-center bg-[var(--ink)] text-[var(--page)]"
          : "inline-flex size-8 shrink-0 items-center justify-center border border-[var(--line)] text-[var(--ink)]"
      }
      onClick={(event) => {
        event.stopPropagation()
        if (!saved) saveProductOnce(code)
      }}
    >
      <Plus aria-hidden="true" className="size-4" />
    </button>
  )
}

function ProductCards({
  products,
  onOpenChart,
  watchlist = false,
}: {
  products: Product[]
  onOpenChart: (code: string) => void
  watchlist?: boolean
}) {
  return (
    <div className="space-y-3 lg:hidden">
      {products.map((product) => {
        const quote = product.quote
        const noClose = quote.close == null
        return (
          <article key={product.code} className="border-b border-[var(--line)] bg-[var(--panel)] px-2 py-1.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs tabular-nums text-muted-foreground">{product.code}</div>
                <button
                  type="button"
                  className="text-left font-medium underline-offset-2 hover:underline"
                  onClick={() => onOpenChart(product.code)}
                >
                  {product.expandedName}
                </button>
                {product.shortName !== product.expandedName ? (
                  <p className="text-xs text-muted-foreground">场内简称 {product.shortName}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right text-sm">
                <div>{exchangeLabel(product.exchange)}</div>
                <div className="text-muted-foreground">{product.sector ?? "业态未从公告读出"}</div>
              </div>
              {watchlist ? <WatchPlus code={product.code} /> : null}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">收盘</dt>
                <dd className={`tabular-nums ${tone(quote.changePct)}`}>
                  {noClose ? "当日无收盘" : formatPrice(quote.close!)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">涨跌幅</dt>
                <dd className={`tabular-nums ${tone(quote.changePct)}`}>
                  {noClose || quote.changePct == null ? "当日无收盘" : formatPct(quote.changePct)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">成交量</dt>
                <dd className="tabular-nums">
                  {noClose || quote.volume == null
                    ? "当日无收盘"
                    : formatVolume(quote.volume, quote.volumeUnit)}
                </dd>
              </div>
            </dl>
            <div className="mt-3 space-y-2 text-sm" onClick={(event) => event.stopPropagation()}>
              <div>
                <div className="text-xs text-muted-foreground">年化分派率</div>
                <YieldCell product={product} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">原始权益人</div>
                <PartyNames parties={product.originalEquityHolders} missing="未从公告读出" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">运营管理机构</div>
                <PartyNames parties={product.operatingManagers} missing="未从公告读出" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">机构持有</div>
                  <HoldingReadout holding={product.institutionHolding} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">原始权益人及关联方</div>
                  <HoldingReadout holding={product.sponsorAffiliateHolding} />
                </div>
              </div>
              <Upcoming code={product.code} product={product} />
            </div>
            <button
              type="button"
              className="mt-3 text-sm underline underline-offset-2"
              onClick={() => onOpenChart(product.code)}
            >
              日K和成交量
            </button>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {product.manager?.sourceUrl ? (
                <a className="underline underline-offset-2" href={product.manager.sourceUrl} target="_blank" rel="noreferrer">
                  {product.manager.name}
                </a>
              ) : (
                <span>{product.manager?.name ?? "管理人未填"}</span>
              )}
              <a className="underline underline-offset-2" href={quote.sourceUrl} target="_blank" rel="noreferrer">
                {quote.sourceLabel}
              </a>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SortButton({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string
  column: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (column: SortKey) => void
  align?: "left" | "right"
}) {
  const active = sortKey === column
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 ${align === "right" ? "ml-auto" : ""}`}
      onClick={(event) => {
        event.stopPropagation()
        onSort(column)
      }}
    >
      {label}
      <span aria-hidden="true">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  )
}

function ProductTable({
  products,
  onOpenChart,
  watchlist = false,
  sortKey,
  sortDir,
  onSort,
}: {
  products: Product[]
  onOpenChart: (code: string) => void
  watchlist?: boolean
  sortKey: SortKey
  sortDir: SortDir
  onSort: (column: SortKey) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortButton label="代码" column="code" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </TableHead>
          <TableHead>
            <SortButton label="简称" column="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </TableHead>
          <TableHead>
            <SortButton label="交易所" column="exchange" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </TableHead>
          <TableHead>
            <SortButton label="业态" column="sector" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </TableHead>
          <TableHead className="text-right">
            <SortButton label="收盘（元/份）" column="close" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
          </TableHead>
          <TableHead className="text-right">
            <SortButton label="涨跌幅" column="change" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
          </TableHead>
          <TableHead className="text-right">
            <SortButton label="成交量" column="volume" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
          </TableHead>
          <TableHead className="text-right">
            <SortButton label="年化分派率" column="yield" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
          </TableHead>
          <TableHead>
            <SortButton label="基金管理人" column="manager" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </TableHead>
          <TableHead>来源</TableHead>
          <TableHead>原始权益人</TableHead>
          <TableHead>运营管理机构</TableHead>
          <TableHead>机构持有</TableHead>
          <TableHead>关联方持有</TableHead>
          <TableHead>下一分红 / 解禁</TableHead>
          {watchlist ? (
            <TableHead className="sticky right-0 z-10 w-12 bg-[var(--panel)] text-right">自选</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const quote = product.quote
          const noClose = quote.close == null
          return (
            <TableRow key={product.code} className="cursor-pointer" onClick={() => onOpenChart(product.code)}>
              <TableCell className="font-medium tabular-nums">{product.code}</TableCell>
              <TableCell>
                <div>{product.expandedName}</div>
                {product.shortName !== product.expandedName ? (
                  <div className="text-xs text-muted-foreground">场内简称 {product.shortName}</div>
                ) : null}
              </TableCell>
              <TableCell>{exchangeLabel(product.exchange)}</TableCell>
              <TableCell>
                <div>{product.sector ?? "业态未从公告读出"}</div>
                {product.sectorOthers.length > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    其他业态 {product.sectorOthers.join("、")}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${tone(quote.changePct)}`}>
                {noClose ? "当日无收盘" : formatPrice(quote.close!)}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${tone(quote.changePct)}`}>
                {noClose || quote.changePct == null ? "当日无收盘" : formatPct(quote.changePct)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {noClose || quote.volume == null
                  ? "当日无收盘"
                  : formatVolume(quote.volume, quote.volumeUnit)}
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <YieldCell product={product} />
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                {product.manager?.sourceUrl ? (
                  <a
                    className="underline underline-offset-2"
                    href={product.manager.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {product.manager.name}
                  </a>
                ) : (
                  (product.manager?.name ?? "未填")
                )}
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <a
                  className="underline underline-offset-2"
                  href={quote.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {quote.sourceLabel}
                </a>
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <PartyNames parties={product.originalEquityHolders} missing="未从公告读出" />
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <PartyNames parties={product.operatingManagers} missing="未从公告读出" />
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <HoldingReadout holding={product.institutionHolding} />
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <HoldingReadout holding={product.sponsorAffiliateHolding} />
              </TableCell>
              <TableCell>
                <Upcoming code={product.code} product={product} />
              </TableCell>
              {watchlist ? (
                <TableCell
                  className="sticky right-0 z-10 bg-[var(--panel)] text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <WatchPlus code={product.code} />
                </TableCell>
              ) : null}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function LoadingBoard() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted-foreground">正在核对交易所名单和当日收盘。</p>
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function Board() {
  const [status, setStatus] = useState<"loading" | "ready" | "unaligned" | "error">("loading")

  useEffect(() => {
    try {
      setStatus(assess(checklist))
    } catch {
      setStatus("error")
    }
  }, [])

  const [query, setQuery] = useState("")
  const [sector, setSector] = useState("all")
  const [exchange, setExchange] = useState<"all" | "SSE" | "SZSE">("all")
  const [manager, setManager] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("code")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [role, setRole] = useState<RoleKey>("manager")

  const allProducts = useMemo(() => checklist.products.map(applyDisclosures), [])
  const sectors = useMemo(
    () => [...new Set(allProducts.map((product) => product.sector ?? "业态未从公告读出"))].sort((a, b) => a.localeCompare(b, "zh")),
    [allProducts]
  )
  const managerNames = useMemo(
    () => [...new Set(allProducts.map((product) => product.manager?.name ?? "基金管理人未从公告读出"))].sort((a, b) => a.localeCompare(b, "zh")),
    [allProducts]
  )
  const listed = useMemo(() => {
    const text = query.trim()
    const filtered = allProducts.filter((product) => {
      if (
        text &&
        !product.code.includes(text) &&
        !product.shortName.includes(text) &&
        !product.expandedName.includes(text)
      ) {
        return false
      }
      if (sector !== "all" && (product.sector ?? "业态未从公告读出") !== sector) return false
      if (exchange !== "all" && product.exchange !== exchange) return false
      if (manager !== "all" && (product.manager?.name ?? "基金管理人未从公告读出") !== manager) return false
      return true
    })
    return sortProducts(filtered, sortKey, sortDir, checklist.tradeDate, checklist.distributionWindow.start)
  }, [allProducts, query, sector, exchange, manager, sortKey, sortDir])
  const groups = useMemo(() => groupByRole(listed, role), [listed, role])
  const missingCount = allProducts.filter((product) => missingMilestoneFields(product).length > 0).length
  const completeRelations = relationCompleteCount(allProducts)
  const [chartCode, setChartCode] = useState<string | null>(null)
  const chartProduct = allProducts.find((product) => product.code === chartCode) ?? null
  const dividends = useMemo(
    () =>
      allProducts
        .flatMap((product) =>
          product.distributions.map((row) => ({
            ...row,
            name: product.expandedName,
            exchange: product.exchange,
          }))
        )
        .sort((a, b) => b.exDate?.localeCompare(a.exDate ?? "") || b.announcementDate.localeCompare(a.announcementDate)),
    [allProducts]
  )

  function onSort(column: SortKey) {
    if (column === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(column)
    setSortDir(column === "change" || column === "yield" || column === "close" || column === "volume" ? "desc" : "asc")
  }

  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--ink)] tabular-nums">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-2 py-2 sm:px-3">
        <header className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-sm font-semibold tracking-tight">内地公募 REITs</h1>
            <p className="text-[11px] text-[var(--muted-ink)]">
              日终收盘 · 交易日 {checklist.tradeDate} · 核对日 {checklist.checkedOn} · 不是实时行情
            </p>
            <p className="text-[11px] text-[var(--muted-ink)]">作者 Dvgfcvggh</p>
            <nav className="flex flex-wrap gap-3 text-[11px]">
              <a className="underline-offset-2 hover:underline" href="#market">全市场</a>
              <a className="underline-offset-2 hover:underline" href="#index">主图</a>
              <a className="underline-offset-2 hover:underline" href="#calendars">分红与解禁</a>
              <a className="underline-offset-2 hover:underline" href="#managers">机构</a>
            </nav>
          </div>
          <ThemeSwitch />
        </header>
        <dl className="grid grid-cols-2 gap-px bg-[var(--line)] text-[11px] sm:grid-cols-5">
          <Stat label="已上市" value={`${allProducts.length}`} detail={`沪 ${checklist.exchanges.SSE.listedCount} · 深 ${checklist.exchanges.SZSE.listedCount}`} />
          <Stat label="交易日" value={checklist.tradeDate} detail="与日K同一天" />
          <Stat label="三类关系已齐" value={`${completeRelations}`} detail={`共 ${allProducts.length} 只`} />
          <Stat label="本步缺字段" value={`${missingCount}`} detail="只" />
          <Stat label="核对日" value={checklist.checkedOn} detail="名单与公告" />
        </dl>

        <WatchChart />

        {status === "loading" ? <LoadingBoard /> : null}
        {status === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>行情没有载入</AlertTitle>
            <AlertDescription>
              上次核对的交易日仍是 {checklist.tradeDate}。这一页不填占位价格，也不沿用上一交易日的收盘。
            </AlertDescription>
          </Alert>
        ) : null}
        {status === "unaligned" ? (
          <Alert variant="destructive">
            <AlertTitle>名单未齐</AlertTitle>
            <AlertDescription>
              页上的产品代码和当日上交所、深交所已上市名单对不上，所以不显示半张行情。上交所名单{" "}
              {checklist.exchanges.SSE.listedCount} 只，深交所名单 {checklist.exchanges.SZSE.listedCount} 只。
            </AlertDescription>
          </Alert>
        ) : null}

        {status === "ready" ? (
          <>
            <section id="market" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xs font-medium">全市场</h2>
                <p className="text-xs text-muted-foreground">
                  涨红跌绿。上交所成交量是份，深交所成交量是万份，跟各自公开行情的单位一致。
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="代码或简称"
                  aria-label="按代码或简称筛选"
                  className="h-8 text-xs"
                />
                <select
                  aria-label="按业态筛选"
                  value={sector}
                  onChange={(event) => setSector(event.target.value)}
                  className="h-8 border border-[var(--line)] bg-[var(--panel)] px-2 text-xs"
                >
                  <option value="all">全部业态</option>
                  {sectors.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select
                  aria-label="按交易所筛选"
                  value={exchange}
                  onChange={(event) => setExchange(event.target.value as "all" | "SSE" | "SZSE")}
                  className="h-8 border border-[var(--line)] bg-[var(--panel)] px-2 text-xs"
                >
                  <option value="all">全部交易所</option>
                  <option value="SSE">上交所</option>
                  <option value="SZSE">深交所</option>
                </select>
                <select
                  aria-label="按基金管理人筛选"
                  value={manager}
                  onChange={(event) => setManager(event.target.value)}
                  className="h-8 border border-[var(--line)] bg-[var(--panel)] px-2 text-xs"
                >
                  <option value="all">全部基金管理人</option>
                  {managerNames.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-[var(--muted-ink)]">筛出 {listed.length} 只。窄屏用下面的排序，宽屏点列名。</p>
              <select
                aria-label="排序"
                className="h-8 border border-[var(--line)] bg-[var(--panel)] px-2 text-xs lg:hidden"
                value={`${sortKey}:${sortDir}`}
                onChange={(event) => {
                  const [key, dir] = event.target.value.split(":")
                  setSortKey(key as SortKey)
                  setSortDir(dir as SortDir)
                }}
              >
                <option value="code:asc">代码升序</option>
                <option value="code:desc">代码降序</option>
                <option value="name:asc">简称升序</option>
                <option value="change:desc">涨跌幅从高到低</option>
                <option value="change:asc">涨跌幅从低到高</option>
                <option value="yield:desc">年化分派率从高到低</option>
                <option value="yield:asc">年化分派率从低到高</option>
                <option value="close:desc">收盘从高到低</option>
                <option value="volume:desc">成交量从高到低</option>
              </select>
              {listed.length === 0 ? <p className="text-sm">没有符合筛选的产品。</p> : null}
              <ProductCards products={listed} onOpenChart={setChartCode} watchlist />
              <div className="hidden border border-[var(--line)] bg-[var(--panel)] lg:block">
                <ProductTable
                  products={listed}
                  onOpenChart={setChartCode}
                  watchlist
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </div>
            </section>

            <section id="calendars" className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-sm border-[var(--line)] bg-[var(--panel)]">
                <CardHeader>
                  <CardTitle>分红日历</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    只收已公告的收益分配。登记日、除息日和每份金额都从公告里来。
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[28rem] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>代码</TableHead>
                          <TableHead>登记日</TableHead>
                          <TableHead>除息日</TableHead>
                          <TableHead className="text-right">每份</TableHead>
                          <TableHead>公告</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dividends.map((row) => (
                          <TableRow key={`${row.code}-${row.recordDate}-${row.announcementDate}`}>
                            <TableCell>
                              <div className="tabular-nums">{row.code}</div>
                              <div className="max-w-40 text-xs text-muted-foreground">{row.name}</div>
                            </TableCell>
                            <TableCell className="tabular-nums">{row.recordDate}</TableCell>
                            <TableCell className="tabular-nums">{row.exDate ?? "公告未写场内除息日"}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatPerUnit(row.perUnit)} 元</TableCell>
                            <TableCell>
                              <a className="underline underline-offset-2" href={row.sourceUrl} target="_blank" rel="noreferrer">
                                {row.announcementDate}
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-sm border-[var(--line)] bg-[var(--panel)]">
                <CardHeader>
                  <CardTitle>解禁日历</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    解禁日和份额以解除限售公告写明的数字为准。同一笔只留一条。
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[28rem] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>代码</TableHead>
                          <TableHead>解禁日</TableHead>
                          <TableHead className="text-right">份额</TableHead>
                          <TableHead>公告</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...checklist.unlocks]
                          .sort((a, b) => b.unlockDate.localeCompare(a.unlockDate))
                          .map((row) => (
                            <TableRow key={`${row.code}-${row.unlockDate}-${row.shares}`}>
                              <TableCell>
                                <div className="tabular-nums">{row.code}</div>
                                <div className="max-w-40 text-xs text-muted-foreground">{row.name}</div>
                              </TableCell>
                              <TableCell className="tabular-nums">{row.unlockDate}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatShares(row.shares)}</TableCell>
                              <TableCell>
                                <a className="underline underline-offset-2" href={row.sourceUrl} target="_blank" rel="noreferrer">
                                  {row.announcementDate}
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="managers" className="space-y-3">
              <div>
                <h2 className="text-xs font-medium">机构</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  按基金管理人、原始权益人或运营管理机构展开。一名主体下的产品仍带着收盘和分派率。没有从公告读出的名称单独成组。
                </p>
              </div>
              <div className="flex flex-wrap gap-1 text-[11px]" role="group" aria-label="机构分组">
                {(
                  [
                    ["manager", "基金管理人"],
                    ["sponsor", "原始权益人"],
                    ["operator", "运营管理机构"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={role === key}
                    className={
                      role === key
                        ? "bg-[var(--ink)] px-2 py-1 text-[var(--page)]"
                        : "border border-[var(--line)] px-2 py-1 text-[var(--muted-ink)]"
                    }
                    onClick={() => setRole(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {groups.map((group) => (
                  <Collapsible key={group.name} className="border border-[var(--line)] bg-[var(--panel)]">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <span className="font-medium">{group.name}</span>
                      <span className="text-sm text-muted-foreground">{group.products.length} 只</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t">
                      <ProductCards products={group.products} onOpenChart={setChartCode} />
                      <div className="hidden lg:block">
                        <ProductTable
                          products={group.products}
                          onOpenChart={setChartCode}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          onSort={onSort}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <Dialog open={chartProduct !== null} onOpenChange={(open) => { if (!open) setChartCode(null) }}>
          <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {chartProduct ? `${chartProduct.code} ${chartProduct.expandedName}` : "日K"}
              </DialogTitle>
              <DialogDescription>
                交易所日线。成交量画在K线下面。
              </DialogDescription>
            </DialogHeader>
            {chartProduct ? <DailyChart code={chartProduct.code} /> : null}
          </DialogContent>
        </Dialog>

        <footer className="border-t border-[var(--line)] pt-2 text-[11px] leading-5 text-[var(--muted-ink)]">
          <p>{checklist.exchanges.SSE.note}</p>
          <p className="mt-1">{checklist.exchanges.SZSE.note}</p>
          <p className="mt-1">
            名单：
            <a className="underline underline-offset-2" href={checklist.exchanges.SSE.listSourceUrl}>
              上交所 REITs 产品行情
            </a>
            （{checklist.exchanges.SSE.listAsOf}，{checklist.exchanges.SSE.listedCount} 只）；
            <a className="underline underline-offset-2" href={checklist.exchanges.SZSE.listSourceUrl}>
              深交所不动产基金列表
            </a>
            （{checklist.exchanges.SZSE.listAsOf}，{checklist.exchanges.SZSE.listedCount} 只）。
          </p>
        </footer>
      </div>
    </div>
  )
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="inline-flex shrink-0 border border-[var(--line)] text-[11px]" role="group" aria-label="日间或夜间">
      <ThemeChoice label="日间" value="day" current={theme} onSelect={setTheme} />
      <ThemeChoice label="夜间" value="night" current={theme} onSelect={setTheme} />
    </div>
  )
}

function ThemeChoice({
  label,
  value,
  current,
  onSelect,
}: {
  label: string
  value: ThemeName
  current: ThemeName
  onSelect: (theme: ThemeName) => void
}) {
  const selected = current === value
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(value)}
      className={
        selected
          ? "bg-[var(--ink)] px-2 py-0.5 text-[var(--page)]"
          : "px-2 py-0.5 text-[var(--muted-ink)]"
      }
    >
      {label}
    </button>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-[var(--panel)] px-2 py-1">
      <dt className="text-[10px] text-[var(--muted-ink)]">{label}</dt>
      <dd className="text-xs font-medium">{value}</dd>
      <p className="text-[10px] text-[var(--muted-ink)]">{detail}</p>
    </div>
  )
}
