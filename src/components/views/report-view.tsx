'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, Printer, Receipt, Wallet, Clock3, TrendingUp, TrendingDown,
  CreditCard, Users, Layers, ChefHat, Flame, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/fetcher'
import { currency, formatDuration, PAYMENT_LABELS, SECTOR_LABELS } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

type Granularity = 'hour' | 'day' | 'month'
type Metrics = {
  kpis: {
    occupiedTables: number; totalTables: number; openOrders: number
    avgService: number; avgTicket: number; periodRevenue: number; periodOrders: number
  }
  period: { key: string; granularity: Granularity; start: string; end: string }
  prev: { revenue: number; orders: number }
  revenueSeries: Array<{ key: string; label: string; revenue: number; orders: number }>
  byHour: Array<{ hour: number; label: string; revenue: number; orders: number }>
  byWeekday: Array<{ weekday: number; label: string; revenue: number; orders: number }>
  heatmap: Array<{ weekday: number; hour: number; orders: number; revenue: number }>
  byStation: Record<string, number>
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  waiterPerformance: Array<{ name: string; orders: number; revenue: number; avgResponse: number }>
  kitchenEfficiency: Array<{ product: string; registered: number; actual: number; count: number }>
  payments: Record<string, number>
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function pctFmt(v: number): string {
  return `${v.toFixed(1).replace('.', ',')}%`
}
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function minutesFmt(m: number): string {
  return `${m.toFixed(1).replace('.', ',')} min`
}

const TURN_LABELS: Record<string, string> = {
  all: 'Todos os turnos', morning: 'Turno da manhã', afternoon: 'Turno da tarde', night: 'Turno da noite',
}
const GRAN_LABELS: Record<Granularity, string> = { hour: 'por hora', day: 'por dia', month: 'por mês' }
const GRAN_NOUN: Record<Granularity, string> = { hour: 'hora', day: 'dia', month: 'mês' }

/** Variação vs. período anterior — mesma linguagem visual do DeltaBadge do Dashboard */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous <= 0) {
    if (current > 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="h-3 w-3" /> novo
        </span>
      )
    }
    return null
  }
  const pct = ((current - previous) / previous) * 100
  const up = pct >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        up
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{pct.toFixed(1).replace('.', ',')}%
    </span>
  )
}

/** Barra horizontal de participação (laranja da marca) */
function MiniBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full min-w-14 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary/80 transition-[width] duration-500"
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  )
}

const CARD_ICON = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary'

export function ReportView({ user }: { user: SessionUser }) {
  const [period, setPeriod] = useState('week')
  const [turn, setTurn] = useState('all')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return isoDate(d)
  })
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()))

  // Timestamp do recorte: (re)gerado quando o filtro periódico muda
  const generatedAt = useMemo(() => new Date(), [period, customFrom, customTo, turn])

  // Mesma query do Dashboard — filtro periódico idêntico, cache compartilhado
  const { data, isLoading } = useQuery<Metrics>({
    queryKey: ['metrics', period, customFrom, customTo, turn],
    queryFn: () => api(`/api/metrics?period=${period}&from=${customFrom}&to=${customTo}&turn=${turn}`),
    refetchInterval: 8000,
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-96 rounded-lg" />
          <Skeleton className="ml-auto h-9 w-72 rounded-lg" />
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <div className="grid lg:grid-cols-2 gap-3 [&>*]:min-w-0">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
      </div>
    )
  }

  const { kpis } = data
  const granularity = data.period.granularity

  const summaryCards: Array<{ label: string; icon: typeof Wallet; value: string; hint: string; delta?: React.ReactNode }> = [
    {
      label: 'Faturamento do período',
      icon: Wallet,
      value: currency(kpis.periodRevenue),
      delta: <Delta current={kpis.periodRevenue} previous={data.prev.revenue} />,
      hint: `período anterior: ${currency(data.prev.revenue)}`,
    },
    {
      label: 'Comandas concluídas',
      icon: Receipt,
      value: kpis.periodOrders.toLocaleString('pt-BR'),
      delta: <Delta current={kpis.periodOrders} previous={data.prev.orders} />,
      hint: `período anterior: ${data.prev.orders.toLocaleString('pt-BR')}`,
    },
    {
      label: 'Ticket médio',
      icon: CreditCard,
      value: currency(kpis.avgTicket),
      hint: 'faturamento ÷ comandas concluídas',
    },
    {
      label: 'Tempo médio de atendimento',
      icon: Clock3,
      value: kpis.avgService ? formatDuration(kpis.avgService) : '—',
      hint: 'confirmação do garçom → pagamento',
    },
  ]

  const series = data.revenueSeries
  const seriesTotal = series.reduce((a, b) => a + b.revenue, 0) || 1
  const bestBucket = [...series].sort((a, b) => b.revenue - a.revenue)[0]

  const weekdayRows = data.byWeekday ?? []
  const weekdayTotal = weekdayRows.reduce((a, w) => a + w.revenue, 0) || 1
  const bestWeekday = [...weekdayRows].sort((a, b) => b.revenue - a.revenue)[0]

  const paymentRows = Object.entries(data.payments)
    .map(([key, value]) => ({ key, label: PAYMENT_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value)
  const paymentTotal = paymentRows.reduce((a, p) => a + p.value, 0) || 1

  const stationRows = Object.entries(data.byStation)
    .map(([key, value]) => ({ key, label: SECTOR_LABELS[key] ?? key, value }))
    .sort((a, b) => b.value - a.value)
  const stationTotal = stationRows.reduce((a, s) => a + s.value, 0) || 1

  const productTotal = kpis.periodRevenue || 1
  const empty = kpis.periodOrders === 0

  return (
    <div className="space-y-4">
      {/* Filtro periódico — idêntico ao da tela Dashboard */}
      <div className="flex flex-col gap-2 report-print-hide">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="year">Ano</TabsTrigger>
              <TabsTrigger value="custom">Personalizado</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={turn} onValueChange={setTurn}>
              <TabsList className="max-w-full overflow-x-auto">
                <TabsTrigger value="all">Todos os turnos</TabsTrigger>
                <TabsTrigger value="morning">Manhã</TabsTrigger>
                <TabsTrigger value="afternoon">Tarde</TabsTrigger>
                <TabsTrigger value="night">Noite</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              aria-label="Data inicial"
            />
            <span className="text-xs">até</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={isoDate(new Date())}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              aria-label="Data final"
            />
          </div>
        )}
      </div>

      <div className="report-print-area space-y-4">
        {/* Cabeçalho do relatório */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.07] via-transparent to-transparent">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={cn(CARD_ICON, 'h-11 w-11 rounded-xl')}>
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base xl:text-lg font-bold tracking-tight">Relatório geral da operação</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {shortDate(data.period.start)} a {shortDate(data.period.end)} · {TURN_LABELS[turn] ?? 'Todos os turnos'} · {GRAN_LABELS[granularity]}
                  </p>
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gerado em</p>
                <p className="text-xs font-medium">
                  {generatedAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="mt-1 flex items-center gap-1.5 sm:justify-end">
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">{user.establishment?.name ?? 'APEX FOOD'}</Badge>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">por {user.name}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {empty ? (
          <Card>
            <CardContent className="py-14 text-center">
              <Receipt className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">Nenhuma comanda concluída no período selecionado</p>
              <p className="mt-1 text-xs text-muted-foreground">Ajuste o período ou o turno nos filtros acima para gerar o relatório.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Resumo executivo */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 [&>*]:min-w-0">
              {summaryCards.map((k) => (
                <Card key={k.label} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <k.icon className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    </div>
                    <p className="mt-2 text-2xl font-bold tracking-tight">{k.value}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {k.delta}
                      <p className="text-[10px] text-muted-foreground">{k.hint}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detalhamento por hora/dia/mês */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" /> Detalhamento {GRAN_LABELS[granularity]}
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  comandas concluídas, faturamento e ticket médio em cada {GRAN_NOUN[granularity]} do período
                  {bestBucket && bestBucket.revenue > 0 && (
                    <> · melhor {GRAN_NOUN[granularity]}: <span className="font-semibold text-primary">{bestBucket.label}</span> ({currency(bestBucket.revenue)})</>
                  )}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[340px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="pl-4">{GRAN_NOUN[granularity][0].toUpperCase() + GRAN_NOUN[granularity].slice(1)}</TableHead>
                        <TableHead className="text-right">Comandas</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead className="text-right">Ticket médio</TableHead>
                        <TableHead className="pr-4 text-right">Participação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {series.map((b) => (
                        <TableRow key={b.key}>
                          <TableCell className="pl-4 font-medium">{b.label}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.orders}</TableCell>
                          <TableCell className="text-right tabular-nums">{currency(b.revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.orders > 0 ? currency(b.revenue / b.orders) : '—'}</TableCell>
                          <TableCell className="pr-4">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20"><MiniBar value={(b.revenue / seriesTotal) * 100} /></div>
                              <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{pctFmt((b.revenue / seriesTotal) * 100)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell className="pl-4">Total do período</TableCell>
                        <TableCell className="text-right tabular-nums">{kpis.periodOrders}</TableCell>
                        <TableCell className="text-right tabular-nums">{currency(kpis.periodRevenue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{currency(kpis.avgTicket)}</TableCell>
                        <TableCell className="pr-4 text-right">100%</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Dias da semana + formas de pagamento */}
            <div className="grid lg:grid-cols-2 gap-3 [&>*]:min-w-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> Comandas por dia da semana
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    {bestWeekday && bestWeekday.revenue > 0
                      ? <>melhor dia: <span className="font-semibold text-primary">{bestWeekday.label}</span> · {currency(bestWeekday.revenue)}</>
                      : 'sem comandas concluídas no período'}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {weekdayRows.map((w) => (
                    <div key={w.weekday} className="flex items-center gap-3 text-sm">
                      <span className="w-8 shrink-0 text-xs font-semibold uppercase text-muted-foreground">{w.label}</span>
                      <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{w.orders} cmd</span>
                      <div className="min-w-0 flex-1"><MiniBar value={(w.revenue / weekdayTotal) * 100} /></div>
                      <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">{currency(w.revenue)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> Formas de pagamento
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">distribuição do faturamento por método</p>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {paymentRows.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">sem pagamentos registrados no período</p>
                  )}
                  {paymentRows.map((p) => (
                    <div key={p.key} className="flex items-center gap-3 text-sm">
                      <span className="w-32 shrink-0 truncate text-xs font-medium">{p.label}</span>
                      <div className="min-w-0 flex-1"><MiniBar value={(p.value / paymentTotal) * 100} /></div>
                      <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">{currency(p.value)}</span>
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pctFmt((p.value / paymentTotal) * 100)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Produtos + estações */}
            <div className="grid lg:grid-cols-2 gap-3 [&>*]:min-w-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Flame className="h-4 w-4 text-primary" /> Produtos mais vendidos
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">quantidade vendida e participação no faturamento do período</p>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4 w-8">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="pr-4 text-right">% total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts.map((p, i) => (
                        <TableRow key={p.name}>
                          <TableCell className="pl-4 text-xs font-bold text-primary">{i + 1}º</TableCell>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.qty}</TableCell>
                          <TableCell className="text-right tabular-nums">{currency(p.revenue)}</TableCell>
                          <TableCell className="pr-4 text-right text-xs tabular-nums text-muted-foreground">{pctFmt((p.revenue / productTotal) * 100)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" /> Faturamento por estação
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">cozinha, churrasqueira, pizzaria e bar</p>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {stationRows.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">sem itens faturados no período</p>
                  )}
                  {stationRows.map((s) => (
                    <div key={s.key} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate text-xs font-medium">{s.label}</span>
                      <div className="min-w-0 flex-1"><MiniBar value={(s.value / stationTotal) * 100} /></div>
                      <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums">{currency(s.value)}</span>
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pctFmt((s.value / stationTotal) * 100)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Equipe + cozinha */}
            <div className="grid lg:grid-cols-2 gap-3 [&>*]:min-w-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Desempenho da equipe
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">comandas fechadas por garçom no recorte selecionado</p>
                </CardHeader>
                <CardContent className="p-0">
                  {data.waiterPerformance.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">sem atendimentos concluídos no período</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Garçom</TableHead>
                          <TableHead className="text-right">Comandas</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                          <TableHead className="text-right">Ticket médio</TableHead>
                          <TableHead className="pr-4 text-right">Resposta média</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.waiterPerformance.map((w) => (
                          <TableRow key={w.name}>
                            <TableCell className="pl-4 font-medium">{w.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{w.orders}</TableCell>
                            <TableCell className="text-right tabular-nums">{currency(w.revenue)}</TableCell>
                            <TableCell className="text-right tabular-nums">{w.orders > 0 ? currency(w.revenue / w.orders) : '—'}</TableCell>
                            <TableCell className="pr-4 text-right tabular-nums text-muted-foreground">{w.avgResponse > 0 ? minutesFmt(w.avgResponse) : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-primary" /> Eficiência da cozinha
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">tempo registrado vs. tempo real médio de preparo</p>
                </CardHeader>
                <CardContent className="p-0">
                  {data.kitchenEfficiency.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">sem preparos concluídos no período</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Produto</TableHead>
                          <TableHead className="text-right">Registrado</TableHead>
                          <TableHead className="text-right">Real médio</TableHead>
                          <TableHead className="pr-4 text-right">Desvio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.kitchenEfficiency.map((k) => {
                          const diff = k.actual - k.registered
                          const late = diff > 0.5
                          return (
                            <TableRow key={k.product}>
                              <TableCell className="pl-4 font-medium">{k.product}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">{formatDuration(k.registered)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatDuration(k.actual)}</TableCell>
                              <TableCell className={cn('pr-4 text-right tabular-nums font-medium', late ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
                                {diff >= 0 ? '+' : '−'}{minutesFmt(Math.abs(diff))}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Fecho do relatório */}
            <div className="border-t pt-3 text-center text-[11px] text-muted-foreground">
              Relatório gerado automaticamente pelo SISTEMA APEX FOOD · {user.establishment?.name ?? 'APEX FOOD'} · distribuição interna
            </div>
          </>
        )}
      </div>
    </div>
  )
}
