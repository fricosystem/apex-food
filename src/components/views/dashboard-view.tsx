'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Clock3, Grid3x3, Receipt, TrendingUp, TrendingDown, Target, ChefHat, Wallet,
  Users, Flame, History, PieChart as PieChartIcon,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis, RadarChart, PolarGrid, Radar,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  byStation: Record<string, number>
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  waiterPerformance: Array<{ name: string; orders: number; revenue: number; avgResponse: number }>
  kitchenEfficiency: Array<{ product: string; registered: number; actual: number; count: number }>
  payments: Record<string, number>
}
type GoalRow = { id: string; title: string; target: number; achieved: number; user: { id: string; name: string; role: string } }

const PERIOD_LABELS: Record<string, string> = {
  today: 'hoje', week: '7 dias', month: '30 dias', year: '12 meses', custom: 'personalizado',
}
/** Paleta da marca — mesma família do laranja #FF6B1A do Faturamento por período */
const ORANGE_SHADES = ['#FF6B1A', '#FF8A47', '#FFB27A', '#FFD1AE', '#E5550F', '#FF9E66']
const TOOLTIP_STYLE = { background: '#16161A', border: '1px solid #2E2E38', borderRadius: 10, fontSize: 12, color: '#F4F4F5' }

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Número com animação count-up (ease-out cúbico), respeitando prefers-reduced-motion */
function AnimatedNumber({ value, format }: { value: number; format?: (v: number) => string }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    prevRef.current = value
    if (from === to) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => setDisplay(to))
      return () => cancelAnimationFrame(id)
    }
    const duration = 900
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <>{format ? format(display) : Math.round(display).toLocaleString('pt-BR')}</>
}

/** Badge de variação vs. período anterior (verde ↑ / vermelho ↓) */
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous <= 0) return null
  const pct = ((current - previous) / previous) * 100
  const up = pct >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border',
        up
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

export function DashboardView({ user }: { user: SessionUser }) {
  const [period, setPeriod] = useState('week')
  const [turn, setTurn] = useState('all')
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); return isoDate(d)
  })
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()))

  const { data, isLoading } = useQuery<Metrics>({
    queryKey: ['metrics', period, customFrom, customTo, turn],
    queryFn: () => api(`/api/metrics?period=${period}&from=${customFrom}&to=${customTo}&turn=${turn}`),
    refetchInterval: 8000,
  })
  const { data: goalsData } = useQuery<{ goals: GoalRow[] }>({
    queryKey: ['goals'],
    queryFn: () => api('/api/goals'),
    refetchInterval: 15000,
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <div className="grid lg:grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
      </div>
    )
  }

  const { kpis } = data
  const granularity = data.period.granularity
  const periodLabel = PERIOD_LABELS[data.period.key] ?? '7 dias'

  const kpiCards: Array<{ label: string; icon: typeof Grid3x3; hint: string; value: React.ReactNode }> = [
    {
      label: 'Mesas ocupadas',
      value: <><AnimatedNumber value={kpis.occupiedTables} />/{kpis.totalTables}</>,
      icon: Grid3x3, hint: 'agora',
    },
    {
      label: 'Comandas abertas',
      value: <AnimatedNumber value={kpis.openOrders} />,
      icon: Receipt, hint: 'ativas no momento',
    },
    {
      label: 'Tempo médio de atendimento',
      value: kpis.avgService ? formatDuration(kpis.avgService) : '—',
      icon: Clock3, hint: 'confirmação → pagamento',
    },
    {
      label: 'Ticket médio',
      value: <AnimatedNumber value={kpis.avgTicket} format={currency} />,
      icon: Wallet, hint: `período: ${periodLabel}`,
    },
  ]

  const goals = (goalsData?.goals ?? []).filter((g) => g.user.role === 'WAITER')

  // ---- Derivados dos novos gráficos ----
  const peakHour = [...data.byHour].sort((a, b) => b.orders - a.orders)[0]
  const stationData = Object.entries(data.byStation)
    .map(([key, v]) => ({ key, name: SECTOR_LABELS[key] ?? key, value: Math.round(v * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
  const stationTotal = stationData.reduce((a, s) => a + s.value, 0)

  const maxWOrders = Math.max(1, ...data.waiterPerformance.map((w) => w.orders))
  const maxWRevenue = Math.max(1, ...data.waiterPerformance.map((w) => w.revenue))
  const radarData = data.waiterPerformance.slice(0, 6).map((w) => ({
    name: w.name,
    comandas: Math.round((w.orders / maxWOrders) * 100),
    receita: Math.round((w.revenue / maxWRevenue) * 100),
  }))

  const prevRevenue = data.prev.revenue
  const goalPct = prevRevenue > 0 ? Math.min(100, (kpis.periodRevenue / prevRevenue) * 100) : 100
  const revLabelFmt = granularity === 'day' ? (l: string) => `Dia ${l}` : (l: string) => l

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="year">Ano</TabsTrigger>
              <TabsTrigger value="custom">Personalizado</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={turn} onValueChange={setTurn}>
            <TabsList>
              <TabsTrigger value="all">Todos os turnos</TabsTrigger>
              <TabsTrigger value="morning">Manhã</TabsTrigger>
              <TabsTrigger value="afternoon">Tarde</TabsTrigger>
              <TabsTrigger value="night">Noite</TabsTrigger>
            </TabsList>
          </Tabs>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpiCards.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <k.icon className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="text-2xl font-bold mt-2 tracking-tight">{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Faturamento + comandas por hora */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Faturamento por período
            </CardTitle>
            <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
              <span><AnimatedNumber value={kpis.periodRevenue} format={currency} /> em {kpis.periodOrders} comandas concluídas</span>
              <DeltaBadge current={kpis.periodRevenue} previous={data.prev.revenue} />
            </p>
          </CardHeader>
          <CardContent className="h-[240px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B1A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#FF6B1A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,138,0.15)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="rgba(128,128,138,0.6)" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="rgba(128,128,138,0.6)" tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, name) => (name === 'revenue' ? [currency(v), 'Faturamento'] : [v, 'Comandas'])}
                  labelFormatter={revLabelFmt}
                />
                <Area type="monotone" dataKey="revenue" stroke="#FF6B1A" strokeWidth={2} fill="url(#rev)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-primary" /> Comandas por hora
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {peakHour && peakHour.orders > 0
                ? <>pico às <span className="font-semibold text-primary">{peakHour.label}</span> · {peakHour.orders} comandas</>
                : 'sem comandas concluídas no período'}
            </p>
          </CardHeader>
          <CardContent className="h-[240px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF8A47" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#FF6B1A" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,138,0.15)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="rgba(128,128,138,0.6)" tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10 }} stroke="rgba(128,128,138,0.6)" tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,107,26,0.06)' }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v} comandas`, 'Concluídas']}
                />
                <Bar dataKey="orders" fill="url(#revBar)" radius={[5, 5, 0, 0]} barSize={10} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Produtos + faturamento por estação */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Produtos mais vendidos
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">quantidade no período</p>
          </CardHeader>
          <CardContent className="h-[240px] p-2">
            {data.topProducts.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,138,0.15)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="rgba(128,128,138,0.6)" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} stroke="rgba(128,128,138,0.9)" tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,107,26,0.06)' }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, _n, p) => [`${v} un · ${currency(Number(p?.payload?.revenue ?? 0))}`, 'Vendido']}
                  />
                  <Bar dataKey="qty" fill="#FF6B1A" radius={[0, 6, 6, 0]} barSize={14} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" /> Faturamento por estação
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">distribuição da receita por setor de produção</p>
          </CardHeader>
          <CardContent className="p-2">
            {stationData.length === 0 ? (
              <EmptyChart className="h-[228px]" />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2 h-[228px]">
                <div className="relative h-[180px] w-full sm:w-[46%] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: number, _n, p) => [currency(v), String(p?.payload?.name ?? '')]}
                      />
                      <Pie
                        data={stationData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="62%"
                        outerRadius="92%"
                        paddingAngle={4}
                        cornerRadius={6}
                        animationDuration={900}
                        stroke="none"
                      >
                        {stationData.map((s, i) => (
                          <Cell key={s.key} fill={ORANGE_SHADES[i % ORANGE_SHADES.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">total</p>
                    <p className="text-sm font-bold leading-tight"><AnimatedNumber value={stationTotal} format={currency} /></p>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-1.5 overflow-y-auto max-h-[228px] pr-1">
                  {stationData.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: ORANGE_SHADES[i % ORANGE_SHADES.length] }} />
                      <span className="flex-1 truncate text-foreground">{s.name}</span>
                      <span className="font-semibold text-primary shrink-0">
                        {stationTotal ? `${Math.round((s.value / stationTotal) * 100)}%` : '0%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Radar da equipe + comparativo com período anterior */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Radar de desempenho da equipe
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">comandas e receita vs. liderança do período</p>
          </CardHeader>
          <CardContent className="h-[260px] p-2">
            {radarData.length < 3 ? (
              <EmptyChart label="Necessário pelo menos 3 garçons com comandas no período" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="rgba(128,128,138,0.2)" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(128,128,138,0.9)' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n) => [`${Math.round(v)}%`, String(n)]} />
                  <Radar name="Comandas" dataKey="comandas" stroke="#FF6B1A" fill="#FF6B1A" fillOpacity={0.28} animationDuration={900} />
                  <Radar name="Receita" dataKey="receita" stroke="#FFB27A" fill="#FFB27A" fillOpacity={0.16} animationDuration={900} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Comparativo com o período anterior
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {prevRevenue > 0
                ? <>meta implícita: <span className="font-semibold">{currency(prevRevenue)}</span> (período anterior)</>
                : 'sem base de comparação'}
            </p>
          </CardHeader>
          <CardContent className="p-4">
            <div className="relative h-[168px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="76%" outerRadius="100%" startAngle={90} endAngle={-270} data={[{ name: 'meta', value: prevRevenue > 0 ? goalPct : 0 }]}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                  <RadialBar
                    dataKey="value"
                    cornerRadius={14}
                    fill="#FF6B1A"
                    background={{ fill: 'rgba(128,128,138,0.15)' }}
                    animationDuration={900}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-bold tracking-tight text-primary">
                  {prevRevenue > 0 ? <AnimatedNumber value={goalPct} format={(v) => `${Math.round(v)}%`} /> : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground">{prevRevenue > 0 ? 'da meta atingida' : 'sem base de comparação'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">Faturamento</p>
                  <DeltaBadge current={kpis.periodRevenue} previous={prevRevenue} />
                </div>
                <p className="text-sm font-bold mt-1">{currency(kpis.periodRevenue)}</p>
                <p className="text-[10px] text-muted-foreground">anterior: {currency(prevRevenue)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">Comandas</p>
                  <DeltaBadge current={kpis.periodOrders} previous={data.prev.orders} />
                </div>
                <p className="text-sm font-bold mt-1">{kpis.periodOrders}</p>
                <p className="text-[10px] text-muted-foreground">anterior: {data.prev.orders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Garçons + cozinha */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Desempenho por garçom
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">comandas concluídas, resposta e receita</p>
          </CardHeader>
          <CardContent className="p-0">
            {data.waiterPerformance.length === 0 ? (
              <EmptyChart className="h-[220px]" />
            ) : (
              <div className="divide-y">
                {data.waiterPerformance.map((w, idx) => (
                  <div key={w.name + idx} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-9 w-9 rounded-full apex-gradient text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {w.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{w.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {w.orders} comandas · resposta média {w.avgResponse.toFixed(1)} min
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{currency(w.revenue)}</p>
                      {idx === 0 && <Badge className="mt-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40 text-[9px]">destaque</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-primary" /> Eficiência da cozinha
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">tempo real de preparo vs. tempo cadastrado</p>
          </CardHeader>
          <CardContent className="p-0">
            {data.kitchenEfficiency.length === 0 ? (
              <EmptyChart className="h-[220px]" />
            ) : (
              <div className="divide-y max-h-[260px] overflow-y-auto">
                {data.kitchenEfficiency.map((k) => {
                  const diff = k.actual - k.registered
                  const ok = diff <= 2
                  return (
                    <div key={k.product} className="px-4 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <p className="font-medium truncate">{k.product}</p>
                        <span className={cn('text-xs font-semibold shrink-0', ok ? 'text-emerald-500' : 'text-amber-500')}>
                          {k.actual.toFixed(1)}min / {k.registered}min
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden flex">
                        <div className={cn('h-full', ok ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${Math.min(100, (k.actual / Math.max(k.registered, 1)) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{k.count} preparo(s) no período</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metas + pagamentos */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Metas por funcionário — mês atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma meta cadastrada. Defina em Gestão → Metas.</p>
            ) : (
              goals.map((g) => {
                const pct = Math.min(100, Math.round((g.achieved / Math.max(g.target, 1)) * 100))
                const done = g.achieved >= g.target
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <p className="font-medium">{g.user.name}</p>
                      <span className={cn('text-xs font-semibold', done ? 'text-emerald-500' : 'text-muted-foreground')}>
                        {g.achieved}/{g.target} comandas
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <p className="text-[10px] text-muted-foreground mt-1">{pct}% da meta {done && '— concluída! 🎉'}</p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Receita por forma de pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {Object.keys(PAYMENT_LABELS).map((m) => {
              const v = data.payments[m] ?? 0
              return (
                <div key={m} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">{PAYMENT_LABELS[m]}</p>
                  <p className="font-bold mt-0.5">{currency(v)}</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full apex-gradient" style={{ width: `${kpis.periodRevenue ? Math.min(100, (v / kpis.periodRevenue) * 100) : 0}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EmptyChart({ className, label = 'Sem dados no período selecionado' }: { className?: string; label?: string }) {
  return (
    <div className={cn('h-full flex items-center justify-center text-xs text-muted-foreground text-center px-4', className)}>
      {label}
    </div>
  )
}
