'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChefHat, Play, PackageCheck, Timer, Flame, Waves, Utensils, Martini, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, apiPatch } from '@/lib/fetcher'
import { clockTime, SECTOR_LABELS } from '@/lib/types'
import type { OrderDTO } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

type Column = { key: string; label: string; tone: string }

export function KdsView({ user }: { user: SessionUser }) {
  const [station, setStation] = useState<string>('ALL')
  const [tick, setTick] = useState(0)

  const { data, isLoading } = useQuery<{ orders: OrderDTO[] }>({
    queryKey: ['orders', 'kds'],
    queryFn: () => api('/api/orders?status=IN_KITCHEN,AWAITING_PAYMENT'),
    refetchInterval: 4000,
  })

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const qc = useQueryClient()
  const act = useMutation({
    mutationFn: ({ orderId, itemId, action }: { orderId: string; itemId: string; action: 'start' | 'ready' }) =>
      apiPatch(`/api/orders/${orderId}/items/${itemId}`, { action }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success(vars.action === 'start' ? 'Preparo iniciado' : 'Prato marcado como pronto — garçom notificado')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const orders = useMemo(() => data?.orders ?? [], [data])
  const stations = useMemo(() => {
    const set = new Set<string>()
    for (const o of orders) for (const i of o.items) set.add(i.station)
    return ['ALL', ...Array.from(set)]
  }, [orders])

  const inScope = (o: OrderDTO) =>
    station === 'ALL' || o.items.some((i) => i.station === station)

  const columns: Column[] = [
    { key: 'PENDING', label: 'Fila — Pendente', tone: 'border-t-amber-500' },
    { key: 'IN_PREPARATION', label: 'Em preparo', tone: 'border-t-primary' },
    { key: 'READY', label: 'Pronto — buscar', tone: 'border-t-emerald-500' },
  ]

  const byStatus = (status: string) =>
    orders
      .filter(inScope)
      .map((o) => ({ order: o, items: o.items.filter((i) => i.status === status && (station === 'ALL' || i.station === station)) }))
      .filter((g) => g.items.length > 0)

  const pending = byStatus('PENDING')
  const preparing = byStatus('IN_PREPARATION')
  const ready = byStatus('READY')

  const stationIcon = (s: string) =>
    s === 'GRILL' ? <Flame className="h-3.5 w-3.5" /> : s === 'PIZZERIA' ? <Waves className="h-3.5 w-3.5" /> : s === 'BAR' ? <Martini className="h-3.5 w-3.5" /> : <Utensils className="h-3.5 w-3.5" />

  return (
    <div className="space-y-4">
      {/* Filtros de estação */}
      <div className="flex flex-wrap items-center gap-2">
        {stations.map((s) => (
          <button
            key={s}
            onClick={() => setStation(s)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all',
              station === s ? 'border-primary/50 bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            {s === 'ALL' ? <LayoutGrid className="h-3.5 w-3.5" /> : stationIcon(s)}
            {s === 'ALL' ? 'Todas as estações' : SECTOR_LABELS[s] ?? s}
          </button>
        ))}
        <div className="ml-auto text-[11px] text-muted-foreground hidden md:block">
          Atualização automática · tempo de preparo por item
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 items-start">
          {columns.map((col) => {
            const groups = col.key === 'PENDING' ? pending : col.key === 'IN_PREPARATION' ? preparing : ready
            return (
              <div key={col.key} className={cn('rounded-xl border bg-card/40 border-t-[3px]', col.tone)}>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    {col.key === 'PENDING' && <Timer className="h-4 w-4 text-amber-500" />}
                    {col.key === 'IN_PREPARATION' && <ChefHat className="h-4 w-4 text-primary" />}
                    {col.key === 'READY' && <PackageCheck className="h-4 w-4 text-emerald-500" />}
                    {col.label}
                  </p>
                  <Badge variant="outline">{groups.length}</Badge>
                </div>
                <div className="p-3 space-y-3 max-h-[62vh] overflow-y-auto">
                  {groups.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-8">Nada por aqui</p>
                  )}
                  {groups.map(({ order, items }) => (
                    <TicketCard key={order.id + col.key} order={order} items={items} colKey={col.key} now={tick} act={act} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TicketCard({
  order, items, colKey, act,
}: {
  order: OrderDTO
  items: OrderDTO['items']
  colKey: string
  now: number
  act: { mutate: (v: { orderId: string; itemId: string; action: 'start' | 'ready' }) => void; isPending: boolean }
}) {
  const nowMs = Date.now()
  return (
    <Card className={cn('overflow-hidden', colKey === 'READY' && 'border-emerald-500/40')}>
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="font-bold text-sm">Mesa {String(order.tableNumber).padStart(2, '0')}</p>
          <span className="text-[10px] text-muted-foreground">{order.code} · {clockTime(order.createdAt)}</span>
        </div>
        {items.map((i) => {
          const started = i.startedAt ? new Date(i.startedAt).getTime() : null
          const elapsedMin = started ? (nowMs - started) / 60000 : 0
          const overdue = i.status === 'IN_PREPARATION' && elapsedMin > i.prepTime
          const remaining = Math.max(0, Math.ceil(i.prepTime - elapsedMin))
          const pct = Math.min(100, (elapsedMin / i.prepTime) * 100)

          return (
            <div key={i.id} className={cn('rounded-lg border p-2.5 space-y-2', overdue && 'border-red-500/60 bg-red-500/5')}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight flex items-start gap-1.5">
                  <span className="text-base">{i.emoji}</span>
                  <span>
                    {i.quantity}× {i.productName}
                    {i.notes && <span className="block text-[11px] text-amber-600 dark:text-amber-400 font-normal">“{i.notes}”</span>}
                  </span>
                </p>
                <Badge variant="outline" className="text-[9px] gap-1 shrink-0">
                  {i.station === 'GRILL' ? <Flame className="h-3 w-3" /> : i.station === 'BAR' ? <Martini className="h-3 w-3" /> : i.station === 'PIZZERIA' ? <Waves className="h-3 w-3" /> : <Utensils className="h-3 w-3" />}
                  {SECTOR_LABELS[i.station] ?? i.station}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', overdue ? 'bg-red-500' : i.status === 'IN_PREPARATION' ? 'bg-primary' : 'bg-emerald-500')}
                    style={{ width: i.status === 'PENDING' ? '4%' : `${pct}%` }}
                  />
                </div>
                <span className={cn('text-[11px] font-mono tabular-nums shrink-0', overdue ? 'apex-overdue' : 'text-muted-foreground')}>
                  {i.status === 'PENDING'
                    ? `${i.prepTime}min`
                    : i.status === 'IN_PREPARATION'
                      ? overdue
                        ? `+${Math.floor(elapsedMin - i.prepTime)}min atraso`
                        : `${remaining}min`
                      : `✓ ${i.prepTime}min`}
                </span>
              </div>

              <div className="flex gap-2">
                {i.status === 'PENDING' && (
                  <Button size="sm" className="flex-1 h-8 text-xs apex-gradient text-white" onClick={() => act.mutate({ orderId: order.id, itemId: i.id, action: 'start' })} disabled={act.isPending}>
                    <Play className="h-3 w-3" /> Iniciar preparo
                  </Button>
                )}
                {i.status === 'IN_PREPARATION' && (
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => act.mutate({ orderId: order.id, itemId: i.id, action: 'ready' })} disabled={act.isPending}>
                    <PackageCheck className="h-3.5 w-3.5" /> Prato pronto
                  </Button>
                )}
                {i.status === 'READY' && (
                  <p className="flex-1 text-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium py-1.5">
                    Aguardando garçom buscar
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
