"use client"

import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { DailyChart } from "@/components/daily-chart"
import { csi932047 } from "@/lib/csi-932047"
import {
  assess,
  checklist,
  exchangeLabel,
  formatPct,
  formatPerUnit,
  formatPrice,
  formatShares,
  formatVolume,
  groupByManager,
  missingMilestoneFields,
  relationCompleteCount,
  yieldView,
  type Product,
} from "@/lib/market"

function tone(value: number | null): string {
  if (value == null || value === 0) return "text-[#e7eaee]"
  return value > 0 ? "text-[#ff4d4f]" : "text-[#1dbf73]"
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
          <span className="mt-1 block text-[11px] font-normal text-[#9aa3ad]">{view.shortSpan}</span>
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

function ProductCards({
  products,
  onOpenChart,
}: {
  products: Product[]
  onOpenChart: (code: string) => void
}) {
  return (
    <div className="space-y-3 lg:hidden">
      {products.map((product) => {
        const quote = product.quote
        const noClose = quote.close == null
        return (
          <article key={product.code} className="border-b border-[#2a3340] bg-[#10161c] px-2 py-1.5">
            <div className="flex items-start justify-between gap-3">
              <div>
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
              <div className="text-right text-sm">
                <div>{exchangeLabel(product.exchange)}</div>
                <div className="text-muted-foreground">{product.sector ?? "业态未从公告读出"}</div>
              </div>
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
            <div className="mt-3 text-sm" onClick={(event) => event.stopPropagation()}>
              <div className="text-xs text-muted-foreground">年化分派率</div>
              <YieldCell product={product} />
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

function ProductTable({
  products,
  onOpenChart,
}: {
  products: Product[]
  onOpenChart: (code: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>代码</TableHead>
          <TableHead>简称</TableHead>
          <TableHead>交易所</TableHead>
          <TableHead>业态</TableHead>
          <TableHead className="text-right">收盘（元/份）</TableHead>
          <TableHead className="text-right">涨跌幅</TableHead>
          <TableHead className="text-right">成交量</TableHead>
          <TableHead>年化分派率</TableHead>
          <TableHead>基金管理人</TableHead>
          <TableHead>来源</TableHead>
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

  const products = useMemo(
    () => [...checklist.products].sort((a, b) => a.code.localeCompare(b.code)),
    []
  )
  const managers = useMemo(() => groupByManager(products), [products])
  const missingCount = products.filter((p) => missingMilestoneFields(p).length > 0).length
  const completeRelations = relationCompleteCount(products)
  const [chartCode, setChartCode] = useState<string | null>(null)
  const chartProduct = products.find((product) => product.code === chartCode) ?? null
  const dividends = useMemo(
    () =>
      products
        .flatMap((p) =>
          p.distributions.map((d) => ({
            ...d,
            name: p.expandedName,
            exchange: p.exchange,
          }))
        )
        .sort((a, b) => b.exDate?.localeCompare(a.exDate ?? "") || b.announcementDate.localeCompare(a.announcementDate)),
    [products]
  )

  return (
    <div className="min-h-screen bg-[#0c1014] text-[#e7eaee] tabular-nums">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-2 py-2 sm:px-3">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#2a3340] pb-2">
          <h1 className="text-sm font-semibold tracking-tight">内地公募 REITs</h1>
          <p className="text-[11px] text-[#9aa3ad]">日终收盘 · 不是实时行情</p>
          <nav className="flex flex-wrap gap-3 text-[11px]">
            <a className="underline-offset-2 hover:underline" href="#market">全市场</a>
            <a className="underline-offset-2 hover:underline" href="#index">932047</a>
            <a className="underline-offset-2 hover:underline" href="#calendars">分红与解禁</a>
            <a className="underline-offset-2 hover:underline" href="#managers">基金管理人</a>
          </nav>
        </header>
        <dl className="grid grid-cols-2 gap-px bg-[#2a3340] text-[11px] sm:grid-cols-5">
          <Stat label="已上市" value={`${products.length}`} detail={`沪 ${checklist.exchanges.SSE.listedCount} · 深 ${checklist.exchanges.SZSE.listedCount}`} />
          <Stat label="交易日" value={checklist.tradeDate} detail="收盘后" />
          <Stat label="三类关系已齐" value={`${completeRelations}`} detail="只填了管理人" />
          <Stat label="本步缺字段" value={`${missingCount}`} detail="只" />
          <Stat label="核对日" value={checklist.checkedOn} detail="名单已对" />
        </dl>

        <section id="index" className="border border-[#2a3340] bg-[#10161c] p-2">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-medium">
              {csi932047.name} {csi932047.code}
            </h2>
            <a className="text-[11px] text-[#9aa3ad] underline-offset-2 hover:underline" href={csi932047.sourceUrl} target="_blank" rel="noreferrer">
              {csi932047.publisher}
            </a>
          </div>
          <DailyChart spec={csi932047.spec} />
        </section>

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
              <ProductCards products={products} onOpenChart={setChartCode} />
              <div className="hidden border border-[#2a3340] bg-[#10161c] lg:block">
                <ProductTable products={products} onOpenChart={setChartCode} />
              </div>
            </section>

            <section id="calendars" className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-sm border-[#2a3340] bg-[#10161c]">
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
              <Card className="rounded-sm border-[#2a3340] bg-[#10161c]">
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
                <h2 className="text-xs font-medium">基金管理人</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  点开一家，名下产品都在，收盘、涨跌幅、成交量和分派率还在。原始权益人和运营管理机构本步未齐，切换留在这一页。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>基金管理人 · 可展开</Badge>
                <Badge variant="outline">原始权益人 · 未齐</Badge>
                <Badge variant="outline">运营管理机构 · 未齐</Badge>
              </div>
              <Alert>
                <AlertTitle>原始权益人、运营管理机构未齐</AlertTitle>
                <AlertDescription>
                  这两类主体，以及机构持有比例、原始权益人及关联方持有比例，这一步不填。数据结构按多名主体留着空位，不用前十大或新闻去补。
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                {managers.map((group) => (
                  <Collapsible key={group.name} className="border border-[#2a3340] bg-[#10161c]">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <span className="font-medium">{group.name}</span>
                      <span className="text-sm text-muted-foreground">{group.products.length} 只</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t">
                      <ProductCards products={group.products} onOpenChart={setChartCode} />
                      <div className="hidden lg:block">
                        <ProductTable products={group.products} onOpenChart={setChartCode} />
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

        <footer className="border-t border-[#2a3340] pt-2 text-[11px] leading-5 text-[#9aa3ad]">
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

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-[#10161c] px-2 py-1">
      <dt className="text-[10px] text-[#9aa3ad]">{label}</dt>
      <dd className="text-xs font-medium">{value}</dd>
      <p className="text-[10px] text-[#9aa3ad]">{detail}</p>
    </div>
  )
}
