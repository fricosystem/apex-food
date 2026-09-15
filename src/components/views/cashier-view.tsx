'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Wallet, CreditCard, Banknote, QrCode, CheckCircle2, History, Loader2,
  Search, Timer, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, apiPatch } from '@/lib/fetcher'
import { currency, clockTime, elapsedMinutes, formatDuration, PAYMENT_LABELS, ORDER_STATUS_LABELS } from '@/lib/types'
import type { OrderDTO } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

const METHODS = [
  { key: 'CREDIT', label: 'Cartão de Crédito', icon: CreditCard },
  { key: 'DEBIT', label: 'Cartão de Débito', icon: CreditCard },
  { key: 'PIX', label: 'PIX', icon: QrCode },
  { key: 'CASH', label: 'Dinheiro Físico', icon: Banknote },
] as const

export function CashierView({ user }: { user: SessionUser }) {
  const [payOrder, setPayOrder] = useState<OrderDTO | null>(null)

  const { data, isLoading } = useQuery<{ orders: OrderDTO[] }>({
    queryKey: ['orders', 'cashier'],
    queryFn: () => api('/api/orders?status=AWAITING_PAYMENT'),
    refetchInterval: 4000,
  })

  const orders = data?.orders ?? []
  const revenueNow = orders.reduce((a, o) => a + o.total, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{orders.length}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Comandas a receber</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Timer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{orders.length ? formatDuration(Math.round(orders.reduce((a, o) => a + elapsedMinutes(o.createdAt), 0) / orders.length)) : '—'}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Tempo médio de permanência</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{currency(revenueNow)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Valor a receber</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="receber" className="space-y-4">
        <TabsList>
          <TabsTrigger value="receber" className="gap-1.5">
            A receber
            {orders.length > 0 && <Badge className="h-4.5 px-1.5 text-[10px] bg-amber-500 text-white hover:bg-amber-500">{orders.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="receber">
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500/60" />
                <p className="font-semibold mt-3">Nenhuma comanda pendente</p>
                <p className="text-sm text-muted-foreground mt-1">Comandas concluídas pelos clientes chegam aqui automaticamente.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {orders.map((o) => (
                <Card key={o.id} className="apex-enter border-amber-500/40">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-lg leading-none">Mesa {String(o.tableNumber).padStart(2, '0')}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {o.code} · {o.waiterName ?? '—'} · {formatDuration(elapsedMinutes(o.createdAt))} de consumo
                        </p>
                      </div>
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40">A receber</Badge>
                    </div>
                    <Separator />
                    <div className="space-y-1">
                      {o.items.map((i) => (
                        <div key={i.id} className="flex items-center gap-2 text-sm">
                          <span>{i.emoji}</span>
                          <span className="flex-1 truncate">{i.quantity}× {i.productName}</span>
                          <span className="text-muted-foreground text-xs">{currency(i.unitPrice * i.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-bold text-lg text-primary">{currency(o.total)}</span>
                    </div>
                    <Button className="w-full apex-gradient text-white font-semibold" onClick={() => setPayOrder(o)}>
                      <Wallet className="h-4 w-4" /> Receber pagamento
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <CashHistory />
        </TabsContent>
      </Tabs>

      {payOrder && (
        <PaymentDialog
          order={payOrder}
          operator={user.name}
          onClose={() => setPayOrder(null)}
        />
      )}
    </div>
  )
}

/* ---------- Modal de pagamento com dupla confirmação ---------- */
function PaymentDialog({ order, operator, onClose }: { order: OrderDTO; operator: string; onClose: () => void }) {
  const [method, setMethod] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const qc = useQueryClient()

  const pay = useMutation({
    mutationFn: () => apiPatch(`/api/orders/${order.id}`, { action: 'pay', method }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['tables'] })
      void qc.invalidateQueries({ queryKey: ['metrics'] })
      void qc.invalidateQueries({ queryKey: ['goals'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento — Mesa {order.tableNumber}</DialogTitle>
        </DialogHeader>

        {!confirming ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Comanda {order.code}</span>
                <span>{order.items.reduce((a, i) => a + i.quantity, 0)} itens</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Garçom</span>
                <span>{order.waiterName ?? '—'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total a pagar</span>
                <span className="font-bold text-xl text-primary">{currency(order.total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={cn(
                      'rounded-lg border p-3 flex flex-col items-center gap-1.5 text-xs font-medium transition-all',
                      method === m.key ? 'border-primary bg-primary/10 text-primary' : 'bg-card hover:border-primary/40'
                    )}
                  >
                    <m.icon className="h-5 w-5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button className="w-full h-11 apex-gradient text-white font-semibold" disabled={!method} onClick={() => setConfirming(true)}>
                Continuar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Wallet className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg">Confirmar pagamento?</p>
              <p className="text-sm text-muted-foreground mt-1">
                {currency(order.total)} · <span className="font-medium text-foreground">{PAYMENT_LABELS[method ?? ''] ?? ''}</span>
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-left text-sm space-y-1">
              <p className="flex justify-between"><span className="text-muted-foreground">Mesa</span><span>{order.tableNumber}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Comanda</span><span>{order.code}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Operador</span><span>{operator}</span></p>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>Voltar</Button>
              <Button className="flex-1 apex-gradient text-white font-semibold" disabled={pay.isPending} onClick={() => pay.mutate()}>
                {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar pagamento
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Histórico com filtros ---------- */
function CashHistory() {
  const [date, setDate] = useState<string>('')
  const [waiter, setWaiter] = useState<string>('all')
  const [method, setMethod] = useState<string>('all')
  const [table, setTable] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<{ orders: OrderDTO[] }>({
    queryKey: ['orders', 'cash-history', date, waiter],
    queryFn: () => api(`/api/orders?status=PAID${date ? `&from=${date}T00:00:00.000Z&to=${date}T23:59:59.999Z` : ''}${waiter !== 'all' ? `&waiterId=${waiter}` : ''}&limit=300`),
    refetchInterval: 10000,
  })
  const { data: usersData } = useQuery<{ users: Array<{ id: string; name: string; role: string }> }>({
    queryKey: ['users'],
    queryFn: () => api('/api/users'),
  })

  const orders = useMemo(() => {
    let rows = data?.orders ?? []
    if (method !== 'all') rows = rows.filter((o) => o.paymentMethod === method)
    if (table) rows = rows.filter((o) => String(o.tableNumber) === table)
    if (search) rows = rows.filter((o) => o.code.toLowerCase().includes(search.toLowerCase()))
    return rows
  }, [data, method, table, search])

  const total = orders.reduce((a, o) => a + o.total, 0)
  const byMethod = useMemo(() => {
    const agg = new Map<string, number>()
    for (const o of orders) {
      if (o.paymentMethod) agg.set(o.paymentMethod, (agg.get(o.paymentMethod) ?? 0) + o.total)
    }
    return agg
  }, [orders])

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px] h-9" aria-label="Filtrar por data" />
          <Select value={waiter} onValueChange={setWaiter}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Garçom" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os garçons</SelectItem>
              {(usersData?.users ?? []).filter((u) => u.role === 'WAITER').map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Pagamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os métodos</SelectItem>
              {METHODS.map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Mesa" value={table} onChange={(e) => setTable(e.target.value.replace(/\D/g, ''))} className="w-[80px] h-9" aria-label="Número da mesa" />
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar código" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{orders.length} comandas pagas</Badge>
        <Badge variant="outline" className="text-primary border-primary/40">Total: {currency(total)}</Badge>
        {[...byMethod.entries()].map(([m, v]) => (
          <Badge key={m} variant="outline" className="text-muted-foreground">{PAYMENT_LABELS[m] ?? m}: {currency(v)}</Badge>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <History className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="font-semibold mt-3">Nenhum resultado</p>
            <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros para ver comandas finalizadas.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[440px]">
              <div className="divide-y">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 p-3.5">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold shrink-0">
                      M{String(o.tableNumber).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {o.code} · {o.waiterName ?? '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {o.paidAt ? `${new Date(o.paidAt).toLocaleDateString('pt-BR')} às ${clockTime(o.paidAt)}` : ''} · {o.items.reduce((a, i) => a + i.quantity, 0)} itens
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
      )}
    </div>
  )
}
