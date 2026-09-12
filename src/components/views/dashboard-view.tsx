'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Clock3, Grid3x3, Receipt, TrendingUp, Target, ChefHat, Wallet,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/fetcher'
import { currency, formatDuration, PAYMENT_LABELS, SECTOR_LABELS } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

type Metrics = {
  kpis: {
    occupiedTables: number; totalTables: number; openOrders: number
    avgService: number; avgTicket: number; periodRevenue: number; periodOrders: number
  }
  revenueByDay: Array<{ date: string; label: string; revenue: number; orders: number }>
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  waiterPerformance: Array<{ name: string; orders: number; revenue: number; avgResponse: number }>
  kitchenEfficiency: Array<{ product: string; registered: number; actual: number; count: number }>
  payments: Record<string, number>
}
type GoalRow = { id: string; title: string; target: number; achieved: number; user: { id: string; name: string; role: string } }

export function DashboardView({ user }: { user: SessionUser }) {
  const [days, setDays] = useState('7')
  const [turn, setTurn] = useState('all')

  const { data, isLoading } = useQuery<Metrics>({
    queryKey: ['metrics', days, turn],
    queryFn: () => api(`/api/metrics?days=${days}&turn=${turn}`),
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
        <div className="grid lg:grid-cols-2 gap-3">{[1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
      </div>
    )
  }

  const { kpis } = data
  const kpiCards = [
    { label: 'Mesas ocupadas', value: `${kpis.occupiedTables}/${kpis.totalTables}`, icon: Grid3x3, hint: 'agora' },
    { label: 'Comandas abertas', value: String(kpis.openOrders), icon: Receipt, hint: 'ativas no momento' },
    { label: 'Tempo médio de atendimento', value: kpis.avgService ? formatDuration(kpis.avgService) : '—', icon: Clock3, hint: 'confirmação → pagamento' },
    { label: 'Ticket médio', value: currency(kpis.avgTicket), icon: Wallet, hint: `período: ${days}d` },
  ]

  const goals = (goalsData?.goals ?? []).filter((g) => g.user.role === 'WAITER')

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Tabs value={turn} onValueChange={setTurn}>
          <TabsList>
            <TabsTrigger value="all">Todos os turnos</TabsTrigger>
            <TabsTrigger value="morning">Manhã</TabsTrigger>
            <TabsTrigger value="afternoon">Tarde</TabsTrigger>
            <TabsTrigger value="night">Noite</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Último dia</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
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

      {/* Gráficos principais */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Faturamento por período
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {currency(kpis.periodRevenue)} em {kpis.periodOrders} comandas concluídas
            </p>
          </CardHeader>
          <CardContent className="h-[240px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                  contentStyle={{ background: '#16161A', border: '1px solid #2E2E38', borderRadius: 10, fontSize: 12, color: '#F4F4F5' }}
                  formatter={(v: number, name) => (name === 'revenue' ? [currency(v), 'Faturamento'] : [v, 'Comandas'])}
                  labelFormatter={(l) => `Dia ${l}`}
                />
                <Area type="monotone" dataKey="revenue" stroke="#FF6B1A" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
                    contentStyle={{ background: '#16161A', border: '1px solid #2E2E38', borderRadius: 10, fontSize: 12, color: '#F4F4F5' }}
                    formatter={(v: number, _n, p) => [`${v} un · ${currency(Number(p?.payload?.revenue ?? 0))}`, 'Vendido']}
                  />
                  <Bar dataKey="qty" fill="#FF6B1A" radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
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

function EmptyChart({ className }: { className?: string }) {
  return (
    <div className={cn('h-full flex items-center justify-center text-xs text-muted-foreground', className)}>
      Sem dados no período selecionado
    </div>
  )
}
