'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ClipboardList, CheckCircle2, XCircle, Hand, ChefHat, History, Users, Timer,
  BellRing, Loader2, Wallet, CircleAlert, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { api, apiDelete, apiPatch } from '@/lib/fetcher'
import { currency, elapsedMinutes, formatDuration, ORDER_STATUS_LABELS, clockTime, PAYMENT_LABELS } from '@/lib/types'
import type { OrderDTO } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

const ACTIVE = ['PENDING_CONFIRM', 'IN_KITCHEN', 'AWAITING_PAYMENT'].join(',')

/**
 * Remoção de item pelo garçom — sempre com modal de confirmação.
 * O cliente não consegue remover itens enviados à cozinha; este é o único caminho.
 */
function RemoveItemAction({ orderId, itemId, itemName }: { orderId: string; itemId: string; itemName: string }) {
  const qc = useQueryClient()

  const del = useMutation({
    mutationFn: () => apiDelete(`/api/orders/${orderId}/items/${itemId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success(`${itemName} removido da comanda`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="h-7 w-7 shrink-0 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 dark:text-red-400"
          disabled={del.isPending}
          aria-label={`Remover ${itemName} da comanda`}
        >
          {del.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover {itemName} da comanda?</AlertDialogTitle>
          <AlertDialogDescription>
            O item sai da comanda, o total é recalculado na hora e o cliente da mesa é avisado automaticamente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter item</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => del.mutate()}
            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40"
          >
            Sim, remover item
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function WaiterView({ user }: { user: SessionUser }) {
  // ADMIN/Gerente/Desenvolvedor cobrem o salão inteiro (mesmo padrão de acesso pleno
  // usado nas outras telas) — veem TODAS as comandas ativas, não só as atribuídas a
  // eles. Sem isso, uma comanda sem garçom designado (nenhum WAITER cadastrado ainda,
  // ou a distribuição automática não achou ninguém disponível) fica invisível pra
  // todo mundo e trava esperando alguém "buscar" um prato que ninguém vê na tela.
  const isManagement = user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'DESENVOLVEDOR'
  const { data, isLoading } = useQuery<{ orders: OrderDTO[] }>({
    queryKey: ['orders', 'waiter', isManagement ? 'all' : user.id],
    queryFn: () => api(`/api/orders?status=${ACTIVE}${isManagement ? '' : `&waiterId=${user.id}`}`),
    refetchInterval: 5000,
  })
  const { data: queueData, isLoading: queueLoading } = useQuery<{ orders: OrderDTO[] }>({
    queryKey: ['orders', 'waiter-queue'],
    queryFn: () => api('/api/orders?status=PENDING_CONFIRM'),
    refetchInterval: 5000,
  })

  const orders = data?.orders ?? []
  const queue = isManagement ? (queueData?.orders ?? []) : (queueData?.orders ?? []).filter((o) => !o.waiterId || o.waiterId === user.id)
  const readyOrders = orders.filter((o) => o.items.some((i) => i.status === 'READY'))
  const load = orders.filter((o) => o.status !== 'AWAITING_PAYMENT').length

  const stats = [
    { label: 'Minhas comandas', value: orders.length, icon: ClipboardList, tone: 'text-primary' },
    { label: 'Aguardando confirmação', value: queue.length, icon: CircleAlert, tone: 'text-amber-500' },
    { label: 'Pratos prontos', value: readyOrders.reduce((a, o) => a + o.items.filter((i) => i.status === 'READY').length, 0), icon: BellRing, tone: 'text-emerald-500' },
    { label: 'Carga ativa', value: load, icon: Users, tone: 'text-muted-foreground' },
  ]

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <s.icon className={cn('h-5 w-5', s.tone)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1 truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="fila" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60">
          <TabsTrigger value="fila" className="gap-1.5">
            Fila de entrada
            {queue.length > 0 && <Badge className="h-4.5 px-1.5 text-[10px] bg-amber-500 text-white hover:bg-amber-500">{queue.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="ativas" className="gap-1.5">
            Comandas ativas
            {orders.length > 0 && <Badge className="h-4.5 px-1.5 text-[10px] bg-primary text-white hover:bg-primary">{orders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="prontos" className="gap-1.5">
            Prontos para servir
            {readyOrders.length > 0 && <Badge className="h-4.5 px-1.5 text-[10px] bg-emerald-500 text-white hover:bg-emerald-500">{readyOrders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="fila">
          <QueueTab queue={queue} loading={queueLoading} />
        </TabsContent>
        <TabsContent value="ativas">
          <ActiveTab orders={orders} />
        </TabsContent>
        <TabsContent value="prontos">
          <ReadyTab orders={readyOrders} />
        </TabsContent>
        <TabsContent value="historico">
          <HistoryTab waiterId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ---------------- Fila de entrada ---------------- */
function QueueTab({ queue, loading }: { queue: OrderDTO[]; loading: boolean }) {
  const qc = useQueryClient()

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'assign' | 'confirm' }) => apiPatch(`/api/orders/${id}`, { action }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success(vars.action === 'confirm' ? 'Comanda confirmada — enviada à cozinha!' : 'Comanda assumida')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (loading) return <div className="grid gap-3 md:grid-cols-2">{[1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500/60" />
          <p className="font-semibold mt-3">Nenhuma comanda na fila</p>
          <p className="text-sm text-muted-foreground mt-1">Novas comandas dos clientes aparecem aqui automaticamente.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {queue.map((o) => (
        <Card key={o.id} className={cn('apex-enter', o.waiterId && 'border-amber-500/40')}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-lg leading-none">Mesa {String(o.tableNumber).padStart(2, '0')}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {o.code} · {clockTime(o.createdAt)} · há {elapsedMinutes(o.createdAt)} min
                </p>
              </div>
              <Badge className={cn(o.waiterId ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : 'bg-primary/10 text-primary border border-primary/30')}>
                {o.waiterId ? 'Distribuída' : 'Nova'}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-1">
              {o.items.map((i) => (
                <div key={i.id} className="flex items-center gap-2">
                  <p className="flex-1 truncate text-sm">
                    {i.quantity}× {i.productName}
                    {i.notes && <span title={i.notes} className="ml-1.5 text-[10px] text-amber-500">obs</span>}
                  </p>
                  <RemoveItemAction orderId={o.id} itemId={i.id} itemName={`${i.quantity}× ${i.productName}`} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {!o.waiterId && (
                <Button variant="outline" className="flex-1" onClick={() => act.mutate({ id: o.id, action: 'assign' })} disabled={act.isPending}>
                  <Hand className="h-4 w-4" /> Assumir
                </Button>
              )}
              <Button className="flex-1 apex-gradient text-white" onClick={() => act.mutate({ id: o.id, action: 'confirm' })} disabled={act.isPending}>
                <ChefHat className="h-4 w-4" /> Confirmar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ---------------- Comandas ativas ---------------- */
function ActiveTab({ orders }: { orders: OrderDTO[] }) {
  const qc = useQueryClient()

  const act = useMutation({
    mutationFn: ({ id, action, itemId }: { id: string; action: string; itemId?: string }) =>
      itemId ? apiPatch(`/api/orders/${id}/items/${itemId}`, { action }) : apiPatch(`/api/orders/${id}`, { action }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['tables'] })
      if (vars.action !== 'served') toast.success('Ação registrada')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="font-semibold mt-3">Sem comandas ativas</p>
          <p className="text-sm text-muted-foreground mt-1">Confirme comandas da fila para vê-las aqui.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {orders.map((o) => (
        <Card key={o.id} className="apex-enter">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold leading-none">Mesa {String(o.tableNumber).padStart(2, '0')}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {o.code} · {clockTime(o.createdAt)}
                </p>
              </div>
              <Badge variant="outline" className={cn('text-[11px]', o.status === 'IN_KITCHEN' ? 'border-amber-500/50 text-amber-600 dark:text-amber-400' : o.status === 'AWAITING_PAYMENT' ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : '')}>
                {ORDER_STATUS_LABELS[o.status]}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-1.5">
              {o.items.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">
                    {i.quantity}× {i.productName}
                  </span>
                  {i.status === 'READY' ? (
                    <Button size="sm" variant="outline" className="h-7 text-[11px] text-emerald-600 border-emerald-500/40" onClick={() => act.mutate({ id: o.id, action: 'served', itemId: i.id })}>
                      <CheckCircle2 className="h-3 w-3" /> Servir
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {i.status === 'PENDING' ? 'na fila' : i.status === 'IN_PREPARATION' ? 'em preparo' : 'servido'}
                    </Badge>
                  )}
                  {o.status !== 'AWAITING_PAYMENT' && (
                    <RemoveItemAction orderId={o.id} itemId={i.id} itemName={`${i.quantity}× ${i.productName}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {formatDuration(elapsedMinutes(o.createdAt))}</span>
              <span className="font-bold text-primary">{currency(o.total)}</span>
            </div>
            {o.status === 'AWAITING_PAYMENT' && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" /> Encaminhada ao caixa — aguardando pagamento
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ---------------- Prontos para servir ---------------- */
function ReadyTab({ orders }: { orders: OrderDTO[] }) {
  const qc = useQueryClient()
  const act = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      apiPatch(`/api/orders/${orderId}/items/${itemId}`, { action: 'served' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      toast.success('Item marcado como servido')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = orders.flatMap((o) => o.items.filter((i) => i.status === 'READY').map((i) => ({ order: o, item: i })))

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <BellRing className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="font-semibold mt-3">Nenhum prato aguardando</p>
          <p className="text-sm text-muted-foreground mt-1">Quando a cozinha finalizar um prato, ele aparece aqui com destaque.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ order, item }) => (
        <Card key={item.id} className="border-emerald-500/40 apex-flash apex-enter">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="font-bold">Mesa {String(order.tableNumber).padStart(2, '0')}</p>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40">Pronto</Badge>
            </div>
            <p className="text-sm">{item.quantity}× {item.productName}</p>
            <p className="text-[11px] text-muted-foreground">Comanda {order.code} · pronta às {item.readyAt ? clockTime(item.readyAt) : '--'}</p>
            <Button className="w-full" variant="outline" onClick={() => act.mutate({ orderId: order.id, itemId: item.id })}>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Marcar como servido
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ---------------- Histórico ---------------- */
function HistoryTab({ waiterId }: { waiterId: string }) {
  const { data, isLoading } = useQuery<{ orders: OrderDTO[] }>({
    queryKey: ['orders', 'waiter-history', waiterId],
    queryFn: () => api(`/api/orders?status=PAID&waiterId=${waiterId}&limit=50`),
    refetchInterval: 10000,
  })

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />
  const orders = data?.orders ?? []
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <History className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="font-semibold mt-3">Histórico vazio</p>
          <p className="text-sm text-muted-foreground mt-1">Comandas pagas no caixa aparecerão aqui.</p>
        </CardContent>
      </Card>
    )
  }

  const revenue = orders.reduce((a, o) => a + o.total, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <Badge variant="outline">{orders.length} comandas finalizadas</Badge>
        <Badge variant="outline" className="text-primary border-primary/40">R$ {revenue.toFixed(2)} em vendas</Badge>
      </div>
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[420px]">
            <div className="divide-y">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center gap-3 p-3.5">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
                    M{String(o.tableNumber).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      Mesa {o.tableNumber} · {o.items.reduce((a, i) => a + i.quantity, 0)} itens
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {o.paidAt ? new Date(o.paidAt).toLocaleDateString('pt-BR') : ''} às {o.paidAt ? clockTime(o.paidAt) : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{o.paymentMethod ? PAYMENT_LABELS[o.paymentMethod] : '—'}</Badge>
                  <p className="font-bold text-sm text-primary shrink-0">{currency(o.total)}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
