'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  UtensilsCrossed, Minus, Plus, ChevronLeft, ClipboardList, Send, CheckCircle2,
  Clock, ChefHat, BellRing, CheckCheck, CreditCard, PartyPopper, Loader2,
  ArrowRight, ShoppingBag, PencilLine,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { api, apiPost } from '@/lib/fetcher'
import { currency, ITEM_STATUS_LABELS } from '@/lib/types'
import { getSharedSocket } from '@/lib/socket-client'
import { playSound } from '@/lib/sound'

type Product = {
  id: string; name: string; description: string; emoji: string; image: string | null
  price: number; prepTime: number; categoryId: string
  category: { id: string; name: string; sector: string; icon: string }
}
type Category = { id: string; name: string; sector: string; icon: string; sortOrder: number }
type MenuResponse = { categories: Array<Category & { products: Product[] }> }
type ClientOrder = {
  id: string; code: string; status: string; total: number; createdAt: string
  waiterName: string | null
  items: Array<{
    id: string; productName: string; quantity: number; notes: string; unitPrice: number
    station: string; prepTime: number; status: string; startedAt: string | null
    readyAt: string | null; servedAt: string | null; emoji: string
  }>
}
type ClientData = {
  table: { id: string; number: number; capacity: number; status: string }
  order: ClientOrder | null
  lastPaid: { code: string; total: number; paidAt: string; items: Array<{ id: string; productName: string; quantity: number; emoji: string }> } | null
}
type CartLine = { productId: string; quantity: number; notes: string }

const STEPS = ['Boas-vindas', 'Cardápio', 'Revisão', 'Acompanhamento', 'Encerramento']
const ITEM_FLOW = ['PENDING', 'IN_PREPARATION', 'READY', 'SERVED']

export function ClientView({ token, onExit }: { token: string; onExit: () => void }) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0)
  const [cart, setCart] = useState<CartLine[]>([])
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const menu = useQuery<MenuResponse>({ queryKey: ['categories'], queryFn: () => api<MenuResponse>('/api/categories') })
  const { data, isLoading, refetch, isError } = useQuery<ClientData>({
    queryKey: ['client', token, tick],
    queryFn: () => api<ClientData>(`/api/client/${token}`),
    refetchInterval: 3000,
    retry: 2,
  })

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>()
    for (const c of menu.data?.categories ?? []) for (const p of c.products) map.set(p.id, p)
    return map
  }, [menu.data])

  const orderId = data?.order?.id

  // Realtime — sala da comanda do cliente
  useEffect(() => {
    const socket = getSharedSocket()
    if (!orderId) return
    socket.emit('join', { clientRoom: `client:${orderId}` })
    const onChange = () => setTick((t) => t + 1)
    socket.on('item:atualizado', onChange)
    socket.on('comanda:paga', onChange)
    socket.on('comanda:confirmada', onChange)
    return () => {
      socket.off('item:atualizado', onChange)
      socket.off('comanda:paga', onChange)
      socket.off('comanda:confirmada', onChange)
    }
  }, [orderId])

  // Fase efetivamente exibida (deriva do estado real da comanda, sem efeitos)
  const liveOrder = data?.order ?? null
  const displayPhase: 0 | 1 | 2 | 3 | 4 =
    liveOrder?.status === 'AWAITING_PAYMENT'
      ? 4
      : !liveOrder && data?.lastPaid && phase >= 3
        ? 4
        : phase

  const finish = useMutation({
    mutationFn: () => apiPost(`/api/client/${token}`, { action: 'finish', orderId }),
    onSuccess: () => {
      playSound('success')
      toast.success('Comanda enviada ao caixa!')
      void refetch()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin" /> Conectando à mesa…
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-sm w-full text-center p-8">
          <p className="text-4xl">🚨</p>
          <p className="font-semibold mt-3">Mesa indisponível</p>
          <p className="text-sm text-muted-foreground mt-1">Não foi possível identificar o QR Code. Chame um funcionário.</p>
          <Button className="mt-6" variant="outline" onClick={onExit}>Painel da equipe</Button>
        </Card>
      </div>
    )
  }

  const cartCount = cart.reduce((a, c) => a + c.quantity, 0)
  const cartSum = cart.reduce((a, c) => a + (productsMap.get(c.productId)?.price ?? 0) * c.quantity, 0)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 apex-gradient text-white shadow-lg">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-none">Mesa {String(data.table.number).padStart(2, '0')}</p>
            <p className="text-[11px] text-white/75 mt-0.5">APEX FOOD</p>
          </div>
          {phase === 1 && cartCount > 0 && (
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/15 h-8" onClick={() => setPhase(2)}>
              <ShoppingBag className="h-4 w-4 mr-1" /> {cartCount}
            </Button>
          )}
        </div>
        <div className="max-w-md mx-auto px-4 pb-2.5">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i <= displayPhase ? 'bg-white' : 'bg-white/25')} />
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            {STEPS.map((s, i) => (
              <span key={s} className={cn('text-[9px] leading-none', i === displayPhase ? 'text-white font-semibold' : 'text-white/55')}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-32">
        {phase === 0 && (
          <WelcomePhase tableNumber={data.table.number} hasOpen={!!data.order} onStart={() => (data.order ? setPhase(3) : setPhase(1))} />
        )}
        {phase === 1 && (
          <MenuPhase
            productsMap={productsMap}
            menu={menu.data?.categories ?? []}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            cart={cart}
            onAdd={(line) => {
              setCart((prev) => {
                const existing = prev.find((c) => c.productId === line.productId)
                if (existing) {
                  return prev.map((c) => (c.productId === line.productId ? { ...line, quantity: c.quantity + line.quantity } : c))
                }
                return [...prev, line]
              })
            }}
          />
        )}
        {phase === 2 && (
          <ReviewPhase
            cart={cart}
            productsMap={productsMap}
            onCartChange={setCart}
            onBack={() => setPhase(1)}
            onSent={() => {
              setCart([])
              setPhase(3)
              void refetch()
            }}
            tableToken={token}
          />
        )}
        {displayPhase === 3 && liveOrder && (
          <TrackingPhase order={liveOrder} onFinish={() => finish.mutate()} finishing={finish.isPending} />
        )}
        {displayPhase === 4 && (
          <ClosingPhase data={data} tick={tick} onNew={() => { void refetch(); setPhase(1) }} />
        )}
      </main>

      {(phase === 1 || phase === 2) && (
        <div className="fixed bottom-0 inset-x-0 border-t bg-background/92 backdrop-blur p-3 z-20">
          <div className="max-w-md mx-auto flex items-center gap-2">
            {phase === 2 && (
              <Button variant="outline" onClick={() => setPhase(1)} className="h-11">
                <ChevronLeft className="h-4 w-4" /> Cardápio
              </Button>
            )}
            {phase === 1 && (
              <Button
                onClick={() => setPhase(2)}
                disabled={cart.length === 0}
                className="flex-1 h-11 apex-gradient text-white font-semibold"
              >
                <ClipboardList className="h-4 w-4" />
                Revisar comanda
                <span className="mx-1">·</span> {currency(cartSum)}
                {cartCount > 0 && <Badge className="ml-1 bg-white/20 text-white hover:bg-white/20">{cartCount}</Badge>}
              </Button>
            )}
          </div>
        </div>
      )}

      <p className="pb-4 text-center text-[10px] text-muted-foreground">
        <button className="underline" onClick={onExit}>Painel da equipe</button>
      </p>
    </div>
  )
}

/* ==================== FASE 1 — Boas-vindas ==================== */
function WelcomePhase({ tableNumber, hasOpen, onStart }: { tableNumber: number; hasOpen: boolean; onStart: () => void }) {
  return (
    <div className="apex-enter text-center pt-10">
      <div className="mx-auto h-20 w-20 rounded-3xl apex-gradient apex-glow flex items-center justify-center">
        <UtensilsCrossed className="h-10 w-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold mt-6 tracking-tight">
        Mesa {String(tableNumber).padStart(2, '0')} — Bem-vindo à APEX FOOD!
      </h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed px-4">
        Explore o cardápio, monte sua comanda e acompanhe cada prato em tempo real, do preparo à entrega.
      </p>
      <div className="grid grid-cols-3 gap-2 mt-8 px-2">
        {[
          { icon: ShoppingBag, label: 'Peça pelo celular' },
          { icon: ChefHat, label: 'Cozinha em foco' },
          { icon: BellRing, label: 'Avisos na hora' },
        ].map((f) => (
          <div key={f.label} className="rounded-xl border bg-card p-3">
            <f.icon className="h-5 w-5 mx-auto text-primary" />
            <p className="text-[11px] mt-1.5 text-muted-foreground leading-tight">{f.label}</p>
          </div>
        ))}
      </div>
      <Button onClick={onStart} className="mt-8 h-12 px-8 text-base apex-gradient text-white font-semibold apex-glow">
        {hasOpen ? 'Ver minha comanda' : 'Iniciar comanda'} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

/* ==================== FASE 2 — Cardápio ==================== */
function MenuPhase({
  menu, activeCat, setActiveCat, cart, onAdd, productsMap,
}: {
  menu: Array<Category & { products: Product[] }>
  activeCat: string | null
  setActiveCat: (c: string | null) => void
  cart: CartLine[]
  onAdd: (line: CartLine) => void
  productsMap: Map<string, Product>
}) {
  const current = useMemo(() => menu.find((c) => c.id === activeCat) ?? menu[0], [menu, activeCat])

  if (menu.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-16">Cardápio em atualização…</div>
  }

  const countInCart = (id: string) => cart.find((c) => c.productId === id)?.quantity ?? 0

  return (
    <div className="apex-enter">
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {menu.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-all flex items-center gap-1.5',
              current?.id === c.id
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{c.icon}</span> {c.name}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {current?.products.map((p) => (
          <ProductCard key={p.id} product={p} inCart={countInCart(p.id)} onAdd={onAdd} />
        ))}
        {current?.products.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">Sem itens disponíveis nesta categoria.</p>
        )}
      </div>

      <div className="text-center text-[10px] text-muted-foreground mt-6">
        {productsMap.size} itens no cardápio · preços em reais
      </div>
    </div>
  )
}

function ProductCard({ product, inCart, onAdd }: { product: Product; inCart: number; onAdd: (line: CartLine) => void }) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')

  const confirmAdd = () => {
    playSound('click')
    onAdd({ productId: product.id, quantity: qty, notes: notes.trim() })
    toast.success(`${product.name} adicionado à comanda`)
    setOpen(false)
  }

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-0 flex">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-24 w-24 object-cover shrink-0" />
        ) : (
          <div className="h-24 w-24 shrink-0 apex-gradient-soft flex items-center justify-center border-r">
            <span className="text-4xl" aria-hidden>{product.emoji}</span>
          </div>
        )}
        <div className="flex-1 min-w-0 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-tight">{product.name}</p>
            <Badge variant="outline" className="shrink-0 text-[10px] gap-1">
              <Clock className="h-3 w-3" /> {product.prepTime}min
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">{product.description}</p>
          <div className="flex items-center justify-between mt-2.5">
            <p className="font-bold text-primary">{currency(product.price)}</p>
            {inCart > 0 ? (
              <Badge className="apex-gradient text-white border-0 gap-1">
                <CheckCircle2 className="h-3 w-3" /> {inCart} na comanda
              </Badge>
            ) : (
              <Button size="sm" className="h-8 apex-gradient text-white" onClick={() => { setQty(1); setNotes(''); setOpen(true) }}>
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">{product.emoji}</span> {product.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{product.description}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm">Qtd.</span>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-6 text-center font-bold">{qty}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Mais">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="ml-auto font-bold text-primary">{currency(product.price * qty)}</p>
          </div>
          <Textarea
            placeholder="Observações (ex: sem cebola, ponto da carne…)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[70px] text-sm"
          />
          <DialogFooter>
            <Button className="w-full apex-gradient text-white font-semibold" onClick={confirmAdd}>
              <Plus className="h-4 w-4" /> Adicionar {qty} à comanda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* ==================== FASE 3 — Revisão ==================== */
function ReviewPhase({
  cart, productsMap, onCartChange, onBack, onSent, tableToken,
}: {
  cart: CartLine[]
  productsMap: Map<string, Product>
  onCartChange: (c: CartLine[]) => void
  onBack: () => void
  onSent: () => void
  tableToken: string
}) {
  const [editing, setEditing] = useState<CartLine | null>(null)
  const [editQty, setEditQty] = useState(1)
  const [editNotes, setEditNotes] = useState('')

  const subtotal = cart.reduce((a, c) => a + (productsMap.get(c.productId)?.price ?? 0) * c.quantity, 0)
  const estMinutes = Math.max(...cart.map((c) => productsMap.get(c.productId)?.prepTime ?? 15), 0)
  const itemCount = cart.reduce((a, c) => a + c.quantity, 0)

  const send = useMutation({
    mutationFn: () =>
      apiPost<{ order: ClientOrder }>('/api/orders', {
        tableToken,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, notes: c.notes })),
      }),
    onSuccess: () => {
      playSound('success')
      toast.success('Comanda enviada ao garçom!')
      onCartChange([])
      onSent()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const changeQty = (productId: string, delta: number) => {
    playSound('click')
    onCartChange(
      cart
        .map((c) => (c.productId === productId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    )
  }

  if (cart.length === 0) {
    return (
      <div className="text-center py-16 apex-enter">
        <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="font-semibold mt-4">Comanda vazia</p>
        <p className="text-sm text-muted-foreground mt-1">Adicione itens pelo cardápio.</p>
        <Button onClick={onBack} className="mt-6 apex-gradient text-white">Ir ao cardápio</Button>
      </div>
    )
  }

  return (
    <div className="apex-enter space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold tracking-tight">Revise sua comanda</h2>
        <Badge variant="outline">{itemCount} item(ns)</Badge>
      </div>

      {cart.map((line) => {
        const p = productsMap.get(line.productId)
        if (!p) return null
        return (
          <Card key={line.productId}>
            <CardContent className="p-3 flex gap-3 items-start">
              <div className="h-14 w-14 rounded-lg apex-gradient-soft flex items-center justify-center shrink-0 text-2xl">
                {p.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currency(p.price)} × {line.quantity}
                </p>
                {line.notes && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                    <PencilLine className="h-3 w-3 mt-0.5 shrink-0" /> {line.notes}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <p className="text-sm font-bold">{currency(p.price * line.quantity)}</p>
                <div className="flex items-center gap-1.5">
                  <Button size="icon" variant="outline" className="h-6.5 w-6.5" style={{ width: 26, height: 26 }} onClick={() => changeQty(line.productId, -1)} aria-label="Diminuir">
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="outline" style={{ width: 26, height: 26 }} className="h-6.5 w-6.5" onClick={() => changeQty(line.productId, 1)} aria-label="Aumentar">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <button
                  className="text-[10px] text-muted-foreground underline"
                  onClick={() => { setEditing(line); setEditQty(line.quantity); setEditNotes(line.notes) }}
                >
                  editar obs.
                </button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Card className="border-primary/30">
        <CardContent className="p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-bold">{currency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Tempo estimado de preparo</span>
            <span className="font-medium">{estMinutes} min</span>
          </div>
          <Separator />
          <p className="text-[11px] text-muted-foreground">
            Ao enviar, a comanda será direcionada automaticamente ao garçom disponível e confirmada para a cozinha.
          </p>
        </CardContent>
      </Card>

      <Button
        onClick={() => send.mutate()}
        disabled={send.isPending}
        className="w-full h-12 text-base apex-gradient text-white font-semibold apex-glow"
      >
        {send.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Enviar comanda para o garçom
      </Button>

      {/* Editar observação */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-base">Observações do item</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-sm">Qtd.</span>
            <Input
              value={editQty}
              type="number"
              min={1}
              max={20}
              onChange={(e) => setEditQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-20"
              aria-label="Quantidade"
            />
          </div>
          <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Ex: sem cebola" className="min-h-[70px] text-sm" />
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                if (!editing) return
                onCartChange(
                  cart.map((c) =>
                    c.productId === editing.productId ? { ...c, quantity: editQty, notes: editNotes.trim() } : c
                  )
                )
                setEditing(null)
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ==================== FASE 4 — Acompanhamento ==================== */
const STATUS_STEPS = [
  { key: 'PENDING_CONFIRM', label: 'Comanda enviada', icon: ClipboardList },
  { key: 'IN_KITCHEN', label: 'Na cozinha', icon: ChefHat },
  { key: 'READY', label: 'Pronto', icon: BellRing },
  { key: 'SERVED', label: 'Servido', icon: CheckCheck },
]

function itemProgress(status: string): number {
  const idx = ITEM_FLOW.indexOf(status)
  return ((idx + 1) / ITEM_FLOW.length) * 100
}

function TrackingPhase({ order, onFinish, finishing }: { order: ClientOrder; onFinish: () => void; finishing: boolean }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsedMin = Math.floor((now - new Date(order.createdAt).getTime()) / 60000)
  const servedCount = order.items.filter((i) => i.status === 'SERVED').length
  const readyCount = order.items.filter((i) => i.status === 'READY').length
  const allServed = servedCount === order.items.length

  return (
    <div className="apex-enter space-y-4">
      <Card className="border-primary/30 apex-gradient-soft">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Comanda {order.code}</p>
              <p className="font-bold text-lg">Garçom: {order.waiterName ?? 'Atribuindo…'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tempo total</p>
              <p className="font-bold text-lg text-primary">{elapsedMin} min</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {order.items.map((i) => (
              <div key={i.id} className="flex-1 flex gap-1">
                {Array.from({ length: i.quantity }).map((_, q) => (
                  <div key={q} className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', {
                        'bg-zinc-400 dark:bg-zinc-600': i.status === 'PENDING',
                        'bg-amber-500': i.status === 'IN_PREPARATION',
                        'bg-emerald-500': i.status === 'READY' || i.status === 'SERVED',
                      })}
                      style={{ width: i.status === 'PENDING' ? '25%' : i.status === 'IN_PREPARATION' ? '60%' : '100%' }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {readyCount > 0 && !allServed
              ? `${readyCount} prato(s) pronto(s) — o garçom já foi avisado!`
              : allServed
                ? 'Tudo servido. Bom apetite!'
                : 'Seus pratos estão em andamento na cozinha.'}
          </p>
        </CardContent>
      </Card>

      {order.items.map((item) => {
        const stepIdx = item.status === 'PENDING' ? 0 : item.status === 'IN_PREPARATION' ? 1 : item.status === 'READY' ? 2 : 3
        const started = item.startedAt ? new Date(item.startedAt).getTime() : null
        const elapsedSec = started ? Math.floor((now - started) / 1000) : 0
        const remaining = Math.max(0, item.prepTime * 60 - elapsedSec)
        const overdue = item.status === 'IN_PREPARATION' && remaining === 0
        const pct = itemProgress(item.status)

        return (
          <Card key={item.id} className={cn(overdue && 'border-red-500/50')}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {item.quantity}× {item.productName}
                    </p>
                    {item.notes && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">“{item.notes}”</p>}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[11px]', {
                    'border-zinc-400/50 text-muted-foreground': item.status === 'PENDING',
                    'border-amber-500/50 text-amber-600 dark:text-amber-400': item.status === 'IN_PREPARATION',
                    'border-emerald-500/50 text-emerald-600 dark:text-emerald-400': item.status === 'READY',
                    'border-primary/50 text-primary': item.status === 'SERVED',
                  })}
                >
                  {ITEM_STATUS_LABELS[item.status]}
                </Badge>
              </div>

              {/* Fluxo de status */}
              <div className="flex items-center justify-between px-0.5">
                {STATUS_STEPS.map((s, i) => {
                  const Icon = s.icon
                  const done = i <= stepIdx
                  return (
                    <div key={s.key} className="flex flex-col items-center gap-1 flex-1">
                      <div className="flex items-center w-full">
                        <div className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : done ? 'bg-primary' : 'bg-border')} />
                        <Icon className={cn('h-4 w-4 shrink-0 transition-colors', done ? 'text-primary' : 'text-muted-foreground/40')} />
                        <div className={cn('h-0.5 flex-1', i === STATUS_STEPS.length - 1 ? 'opacity-0' : i < stepIdx ? 'bg-primary' : 'bg-border')} />
                      </div>
                      <span className={cn('text-[9px] leading-none text-center', done ? 'text-foreground font-medium' : 'text-muted-foreground/50')}>
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-3">
                <Progress value={pct} className="h-1.5" />
                {item.status === 'PENDING' && (
                  <span className="text-[11px] text-muted-foreground shrink-0">aguardando cozinha</span>
                )}
                {item.status === 'IN_PREPARATION' && (
                  <span className={cn('text-[11px] shrink-0 font-mono tabular-nums', overdue ? 'text-red-500 font-bold' : 'text-amber-600 dark:text-amber-400 font-medium')}>
                    {overdue ? 'no ponto!' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}
                  </span>
                )}
                {(item.status === 'READY' || item.status === 'SERVED') && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0 font-medium">concluído</span>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Consumo até agora</span>
            <span className="font-bold text-primary">{currency(order.total)}</span>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={onFinish}
        disabled={finishing}
        className="w-full h-12 text-base apex-gradient text-white font-semibold"
      >
        {finishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
        Concluir consumo — enviar ao caixa
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        A comanda será finalizada e encaminhada ao caixa para pagamento.
      </p>
    </div>
  )
}

/* ==================== FASE 5 — Encerramento ==================== */
function ClosingPhase({ data, tick, onNew }: { data: ClientData; tick: number; onNew: () => void }) {
  const paid = !data.order && data.lastPaid
  const order = data.order ?? data.lastPaid

  return (
    <div className="apex-enter text-center pt-6">
      {paid ? (
        <>
          <div className="mx-auto h-20 w-20 rounded-3xl bg-emerald-500/15 flex items-center justify-center">
            <PartyPopper className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold mt-5 tracking-tight">Pagamento confirmado!</h2>
          <p className="text-sm text-muted-foreground mt-2">Obrigado pela visita — esperamos vê-lo novamente em breve.</p>
        </>
      ) : (
        <>
          <div className="mx-auto h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mt-5 tracking-tight">Comanda encaminhada ao caixa</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Quando o pagamento for confirmado, esta tela mostrará o recibo final. Obrigado!
          </p>
        </>
      )}

      {order && (
        <Card className="mt-6 text-left">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Resumo final · Comanda {order.code}</p>
              {tick > 0 && <span className="text-[10px] text-emerald-500 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 apex-live-dot" /> atualizando</span>}
            </div>
            <div className="mt-3 space-y-2">
              {order.items.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <span>{i.emoji}</span>
                  <span className="flex-1 truncate">{i.quantity}× {i.productName}</span>
                  <span className="font-medium">{currency(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-bold text-primary">{currency(order.total)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!paid && (
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Aguardando confirmação do pagamento pelo caixa…
        </div>
      )}
      {paid && (
        <Button onClick={onNew} className="mt-6 apex-gradient text-white font-semibold">
          Nova comanda <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
