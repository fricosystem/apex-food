'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Minus, Plus, ChevronLeft, ClipboardList, Send, CheckCircle2,
  Clock, ChefHat, BellRing, CheckCheck, CreditCard, PartyPopper, Loader2,
  ArrowRight, ShoppingBag, PencilLine, Check, Download, Star, Lock,
  LockKeyhole, PlusCircle, Sparkles, Heart,
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
import { setupClientPwa, isStandalone } from '@/lib/pwa-client'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

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
  rating?: number | null
  items: Array<{
    id: string; productName: string; quantity: number; notes: string; unitPrice: number
    station: string; prepTime: number; status: string; startedAt: string | null
    readyAt: string | null; servedAt: string | null; emoji: string
  }>
}
type ClientData = {
  table: { id: string; number: number; capacity: number; status: string }
  order: ClientOrder | null
  lastPaid: { id: string; code: string; total: number; paidAt: string; rating: number | null; items: Array<{ id: string; productName: string; quantity: number; unitPrice: number; emoji: string }> } | null
}
type CartLine = { uid: string; productId: string; quantity: number; notes: string }

const STEPS = ['Boas-vindas', 'Cardápio', 'Revisão', 'Acompanhamento', 'Encerramento']
const ITEM_FLOW = ['PENDING', 'IN_PREPARATION', 'READY', 'SERVED']

// Fundo fixo escuro da tela do cliente — mesma assinatura visual do painel de marca da autenticação
const BG_DARK = 'linear-gradient(150deg, #121215 0%, #0A0A0C 55%, #0D0B09 100%)'

// Personalização rápida de itens (enviada como observação ao garçom/cozinha)
const REMOVAL_CHIPS = ['Sem cebola', 'Sem tomate', 'Sem alface', 'Sem picles', 'Sem maionese', 'Sem bacon', 'Sem queijo', 'Sem milho']
const COOKING_CHIPS = ['Mal passada', 'Ao ponto', 'Bem passada']

function toggleChip(notes: string, chip: string): string {
  const parts = notes.split(',').map((s) => s.trim()).filter(Boolean)
  const idx = parts.findIndex((p) => p.toLowerCase() === chip.toLowerCase())
  if (idx >= 0) parts.splice(idx, 1)
  else parts.push(chip)
  return parts.join(', ')
}

function hasChip(notes: string, chip: string): boolean {
  return notes.split(',').some((p) => p.trim().toLowerCase() === chip.toLowerCase())
}

function notesParts(notes: string): string[] {
  return notes.split(',').map((s) => s.trim()).filter(Boolean)
}

let uidSeq = 0
const newUid = () => `l${Date.now().toString(36)}-${(++uidSeq).toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Contador animado do total acumulado — conta de R$ 0 até o valor atual na entrada
 * e sobe/desce como um odômetro sempre que a soma inteligente da comanda muda
 * (novos itens somam; itens removidos pelo garçom subtraem).
 */
function useAnimatedMoney(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    // Diferença irrelevante → conclui em um frame, sem cascata de renders
    const dur = Math.abs(target - from) < 0.004 ? 0 : duration
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = dur === 0 ? 1 : Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic — desacelera no fim, estilo caixa registradora
      const v = from + (target - from) * eased
      fromRef.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(step)
      else {
        fromRef.current = target
        setValue(target)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

/** Cartão-herói do total acumulado — soma inteligente de todos os itens da comanda */
function AccumulatedTotalCard({ order }: { order: ClientOrder }) {
  const animated = useAnimatedMoney(order.total)
  const itemCount = order.items.reduce((a, i) => a + i.quantity, 0)

  return (
    <div className="apex-shine relative overflow-hidden rounded-3xl border border-[#FF6B1A]/25 bg-gradient-to-br from-[#FF6B1A]/[0.16] via-white/[0.05] to-transparent p-5">
      <div aria-hidden className="apex-orb pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#FF8A3D]/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#FF9A57]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FF9A57]">Total acumulado</p>
        </div>
        <p
          key={order.total}
          className="apex-count-pop mt-1.5 text-[34px] font-extrabold leading-none tracking-tight tabular-nums apex-text-gradient"
          aria-live="polite"
          aria-label={`Total acumulado de ${currency(order.total)}`}
        >
          {currency(animated)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> {itemCount} {itemCount === 1 ? 'item somado' : 'itens somados'}</span>
          <span className="text-zinc-600">·</span>
          <span>Comanda {order.code}</span>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-500">
          Soma inteligente de todos os itens da comanda — atualiza sozinha a cada pedido e a cada remoção feita pelo garçom.
        </p>
      </div>
    </div>
  )
}

/** Banner animado da penúltima etapa — celebra o momento e convida a pedir mais */
function OrderMoreBanner({ onOrderMore }: { onOrderMore: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#FF6B1A]/30 bg-gradient-to-br from-[#FF6B1A]/[0.14] via-white/[0.04] to-transparent p-5 text-center">
      <div aria-hidden className="apex-orb pointer-events-none absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-[#FF6B1A]/15 blur-2xl" />
      <div className="relative">
        {/* Anéis pulsando + ícone em gradiente — animação de convite */}
        <div className="relative mx-auto h-14 w-14">
          <span aria-hidden className="apex-ring-pulse absolute inset-0 rounded-2xl border border-[#FF6B1A]/50" />
          <span aria-hidden className="apex-ring-pulse absolute inset-0 rounded-2xl border border-[#FF6B1A]/35" style={{ animationDelay: '0.7s' }} />
          <span className="apex-gradient apex-glow absolute inset-0 flex items-center justify-center rounded-2xl">
            <Sparkles className="h-6 w-6 text-white" />
          </span>
        </div>
        <p className="mt-3.5 text-base font-bold tracking-tight">Quer mais alguma coisa?</p>
        <p className="mx-auto mt-1 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
          Peça quando quiser — os novos itens entram na mesma comanda e o total acumulado soma na hora.
        </p>
        <Button
          onClick={onOrderMore}
          className="apex-gradient apex-glow mt-4 h-11 px-7 font-semibold text-white transition-transform active:scale-[0.96]"
        >
          <PlusCircle className="h-4.5 w-4.5" /> Pedir mais
        </Button>
      </div>
    </div>
  )
}

/** Selo de proteção do item — enviado à cozinha, só o garçom pode remover */
function ItemLockChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-medium text-zinc-400">
      <Lock className="h-2.5 w-2.5" /> Somente o garçom pode remover
    </span>
  )
}

export function ClientView({ token, onExit }: { token: string; onExit: () => void }) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0)
  const [cart, setCart] = useState<CartLine[]>([])
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null)

  // Tela do cliente sempre em tema escuro (igual à autenticação), independentemente do tema do app
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.add('dark')
    return () => {
      if (!wasDark) root.classList.remove('dark')
    }
  }, [])

  // PWA da mesa: manifest por mesa + metas de instalação + service worker — apenas no modo cliente.
  // Em navegadores sem beforeinstallprompt (ex.: iOS), o cliente usa "Adicionar à Tela de Início".
  useEffect(() => {
    const cleanupPwa = setupClientPwa(token)
    if (isStandalone()) return cleanupPwa
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstallEvt(null)
      toast.success('APEX FOOD instalado no seu celular!')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      cleanupPwa()
    }
  }, [token])

  const menu = useQuery<MenuResponse>({ queryKey: ['client-menu', token], queryFn: () => api<MenuResponse>(`/api/client/${token}/menu`) })
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
      <div className="min-h-screen flex items-center justify-center text-zinc-300" style={{ background: BG_DARK }}>
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" /> Conectando à mesa…
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG_DARK }}>
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
    <div className="apex-client-decor relative flex min-h-screen flex-col overflow-x-hidden text-zinc-100" style={{ background: BG_DARK }}>
      {/* Luzes ambiente — assinatura premium da mesa (sem interferir nos toques) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="apex-orb absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[#FF6B1A]/[0.13] blur-3xl" />
        <div className="apex-orb absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-[#FF8A3D]/[0.09] blur-3xl" style={{ animationDelay: '1.6s' }} />
        <div className="apex-orb absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-emerald-500/[0.05] blur-3xl" style={{ animationDelay: '3.2s' }} />
      </div>
      <main className="relative mx-auto w-full max-w-md flex-1 p-4 pb-32">
        <PhaseRail phase={displayPhase} tableNumber={data.table.number} />
        {phase === 0 && (
          <WelcomePhase
            tableNumber={data.table.number}
            hasOpen={!!data.order}
            onStart={() => (data.order ? setPhase(3) : setPhase(1))}
            installAvailable={!!installEvt}
            onInstall={() => {
              void installEvt?.prompt()
              setInstallEvt(null)
            }}
          />
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
                const existing = prev.find((c) => c.productId === line.productId && c.notes === line.notes)
                if (existing) {
                  return prev.map((c) => (c.uid === existing.uid ? { ...c, quantity: c.quantity + line.quantity } : c))
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
            hasOpenOrder={!!liveOrder}
            openTotal={liveOrder?.total ?? 0}
          />
        )}
        {displayPhase === 3 && liveOrder && (
          <TrackingPhase order={liveOrder} onOrderMore={() => setPhase(1)} />
        )}
        {displayPhase === 4 && (
          <ClosingPhase data={data} tick={tick} token={token} onNew={() => { void refetch(); setPhase(1) }} onRated={() => void refetch()} />
        )}
      </main>

      {(phase === 1 || phase === 2) && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-[#0B0B0F]/85 p-3 backdrop-blur-xl">
          <div className="max-w-md mx-auto flex items-center gap-2">
            {phase === 2 && (
              <Button variant="outline" onClick={() => setPhase(1)} className="h-11 border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-white">
                <ChevronLeft className="h-4 w-4" /> Cardápio
              </Button>
            )}
            {phase === 1 && (
              <Button
                onClick={() => setPhase(2)}
                disabled={cart.length === 0}
                className="apex-gradient flex h-11 flex-1 items-center justify-center font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <ClipboardList className="h-4 w-4" />
                Revisar comanda
                <span className="mx-1">·</span> <span className="tabular-nums">{currency(cartSum)}</span>
                {cartCount > 0 && <Badge className="ml-1 bg-white/20 text-white hover:bg-white/20">{cartCount}</Badge>}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Enviar ao caixa — mesmo tratamento de barra fixa e destaque das outras
          ações principais (antes vinha como botão discreto perdido no fim da rolagem) */}
      {displayPhase === 3 && liveOrder && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-[#0B0B0F]/85 p-3 backdrop-blur-xl">
          <div className="max-w-md mx-auto space-y-1.5">
            <Button
              onClick={() => finish.mutate()}
              disabled={finish.isPending}
              className="apex-gradient apex-glow flex h-12 w-full items-center justify-center text-base font-semibold text-white transition-transform active:scale-[0.98]"
            >
              {finish.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              Concluir consumo — enviar ao caixa
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              A comanda será finalizada e encaminhada ao caixa para pagamento.
            </p>
          </div>
        </div>
      )}

      <p className="relative pb-4 text-center text-[10px] text-muted-foreground">
        <button className="underline" onClick={onExit}>Painel da equipe</button>
      </p>
    </div>
  )
}

/* ==================== Trilha de fases (sem header) ==================== */
function PhaseRail({ phase, tableNumber }: { phase: number; tableNumber: number }) {
  return (
    <div className="mb-6 pt-3">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-3.5 py-3 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-9 w-auto drop-shadow" />
          <p className="text-[15px] font-extrabold tracking-tight leading-none">
            APEX <span className="text-[#FF7B2E]">FOOD</span>
          </p>
        </div>
        <span className="rounded-full border border-[#FF6B1A]/40 bg-[#FF6B1A]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#FF9A57]">
          Mesa {String(tableNumber).padStart(2, '0')}
        </span>
      </div>
      <div className="mt-4 flex gap-1.5" aria-label={`Etapa ${phase + 1} de ${STEPS.length}: ${STEPS[phase]}`}>
        {STEPS.map((s, i) => (
          <div key={s} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= phase ? 'apex-gradient' : 'bg-white/10')} />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{STEPS[phase]}</p>
    </div>
  )
}

/* ==================== FASE 1 — Boas-vindas ==================== */
function WelcomePhase({
  tableNumber, hasOpen, onStart, installAvailable, onInstall,
}: {
  tableNumber: number
  hasOpen: boolean
  onStart: () => void
  installAvailable: boolean
  onInstall: () => void
}) {
  return (
    <div className="apex-enter pt-2 text-center">
      <div className="relative flex flex-col items-center">
        <div aria-hidden className="apex-orb absolute -top-6 h-40 w-40 rounded-full bg-[#FF6B1A]/20 blur-3xl" />
        <img src="/apex-logo.png" alt="Logo APEX FOOD" className="relative h-24 w-auto drop-shadow-xl" />
        <p className="relative mt-3 text-3xl font-extrabold tracking-tight leading-none">
          APEX <span className="text-[#FF7B2E]">FOOD</span>
        </p>
      </div>
      <h2 className="mt-6 text-xl font-bold tracking-tight">
        Mesa {String(tableNumber).padStart(2, '0')} — Bem-vindo!
      </h2>
      <p className="mt-2 px-4 text-sm leading-relaxed text-muted-foreground">
        Explore o cardápio, monte sua comanda e acompanhe cada prato em tempo real, do preparo à entrega.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-2 px-2">
        {[
          { icon: ShoppingBag, label: 'Peça pelo celular' },
          { icon: ChefHat, label: 'Cozinha em foco' },
          { icon: BellRing, label: 'Avisos na hora' },
        ].map((f) => (
          <div key={f.label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur transition-colors hover:border-[#FF6B1A]/30">
            <div className="apex-gradient-soft mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-[#FF6B1A]/20">
              <f.icon className="h-4 w-4 text-[#FF9A57]" />
            </div>
            <p className="mt-1.5 text-[11px] leading-tight text-zinc-300">{f.label}</p>
          </div>
        ))}
      </div>
      <Button onClick={onStart} className="apex-gradient apex-glow mt-8 h-12 px-8 text-base font-semibold text-white transition-transform active:scale-[0.97]">
        {hasOpen ? 'Ver minha comanda' : 'Iniciar comanda'} <ArrowRight className="h-4 w-4" />
      </Button>
      {installAvailable && (
        <div>
          <Button
            variant="outline"
            onClick={onInstall}
            className="mt-3 h-11 px-6 border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] hover:text-white"
          >
            <Download className="h-4 w-4" /> Instalar aplicativo
          </Button>
          <p className="mt-2 text-[11px] text-zinc-500">Acesso rápido ao cardápio da mesa pela tela inicial do celular</p>
        </div>
      )}
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
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
        {menu.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all',
              current?.id === c.id
                ? 'border-[#FF6B1A]/50 bg-[#FF6B1A]/15 text-[#FF9A57] shadow-sm shadow-[#FF6B1A]/20'
                : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/25 hover:text-zinc-200'
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
          <p className="py-10 text-center text-sm text-muted-foreground">Sem itens disponíveis nesta categoria.</p>
        )}
      </div>

      <div className="mt-6 text-center text-[10px] text-muted-foreground">
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
    onAdd({ uid: newUid(), productId: product.id, quantity: qty, notes: notes.trim() })
    toast.success(`${product.name} adicionado à comanda`)
    setOpen(false)
  }

  return (
    <Card className="group overflow-hidden border-white/10 bg-white/[0.04] backdrop-blur transition-all duration-300 hover:border-[#FF6B1A]/40 hover:shadow-lg hover:shadow-[#FF6B1A]/10">
      <CardContent className="flex p-0">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-24 w-24 shrink-0 object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="apex-gradient-soft flex h-24 w-24 shrink-0 items-center justify-center border-r border-white/10">
            <span className="text-4xl transition-transform duration-500 group-hover:scale-110" aria-hidden>{product.emoji}</span>
          </div>
        )}
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-tight">{product.name}</p>
            <Badge variant="outline" className="shrink-0 gap-1 border-white/15 text-[10px] text-zinc-400">
              <Clock className="h-3 w-3" /> {product.prepTime}min
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{product.description}</p>
          <div className="mt-2.5 flex items-center justify-between">
            <p className="font-bold text-[#FF9A57]">{currency(product.price)}</p>
            {inCart > 0 ? (
              <Badge className="apex-gradient gap-1 border-0 text-white hover:opacity-90">
                <CheckCircle2 className="h-3 w-3" /> {inCart} na comanda
              </Badge>
            ) : (
              <Button size="sm" className="apex-gradient h-8 text-white transition-transform active:scale-95" onClick={() => { setQty(1); setNotes(''); setOpen(true) }}>
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
          <NotesField notes={notes} onChange={setNotes} />
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

/* ==================== Personalização do item (observações) ==================== */
function NotesField({ notes, onChange }: { notes: string; onChange: (n: string) => void }) {
  const renderChip = (label: string) => {
    const active = hasChip(notes, label)
    return (
      <button
        key={label}
        type="button"
        onClick={() => onChange(toggleChip(notes, label))}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
          active
            ? 'border-[#FF6B1A]/60 bg-[#FF6B1A]/15 text-[#FF9A57]'
            : 'border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/25 hover:text-zinc-200'
        )}
      >
        {active && <Check className="h-3 w-3" />}
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-3.5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Retirar ingredientes</p>
        <div className="flex flex-wrap gap-1.5">{REMOVAL_CHIPS.map(renderChip)}</div>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Ponto da carne</p>
        <div className="flex flex-wrap gap-1.5">{COOKING_CHIPS.map(renderChip)}</div>
      </div>
      <Textarea
        placeholder="Algum outro detalhe? (ex: sem cebola roxa, cortar em pedaços…)"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[60px] text-sm"
      />
    </div>
  )
}

/* ==================== FASE 3 — Revisão ==================== */
function ReviewPhase({
  cart, productsMap, onCartChange, onBack, onSent, tableToken, hasOpenOrder, openTotal,
}: {
  cart: CartLine[]
  productsMap: Map<string, Product>
  onCartChange: (c: CartLine[]) => void
  onBack: () => void
  onSent: () => void
  tableToken: string
  hasOpenOrder: boolean
  openTotal: number
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
      toast.success(hasOpenOrder ? 'Itens somados à comanda!' : 'Comanda enviada ao garçom!')
      onCartChange([])
      onSent()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const changeQty = (uid: string, delta: number) => {
    playSound('click')
    onCartChange(
      cart
        .map((c) => (c.uid === uid ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    )
  }

  if (cart.length === 0) {
    return (
      <div className="apex-enter py-16 text-center">
        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <p className="mt-4 font-semibold">Comanda vazia</p>
        <p className="mt-1 text-sm text-muted-foreground">Adicione itens pelo cardápio.</p>
        <Button onClick={onBack} className="apex-gradient mt-6 text-white">Ir ao cardápio</Button>
      </div>
    )
  }

  return (
    <div className="apex-enter space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold tracking-tight">Revise sua comanda</h2>
        <Badge variant="outline" className="border-white/15 text-zinc-300">{itemCount} item(ns)</Badge>
      </div>
      {hasOpenOrder && (
        <div className="flex items-start gap-2 rounded-2xl border border-[#FF6B1A]/30 bg-[#FF6B1A]/[0.08] p-3">
          <PlusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF9A57]" />
          <p className="text-[11px] leading-relaxed text-zinc-300">
            A mesa já tem uma comanda aberta — ao enviar, estes itens são <span className="font-semibold text-[#FF9A57]">somados à mesma comanda</span> e o total acumulado sobe na hora.
          </p>
        </div>
      )}

      {cart.map((line) => {
        const p = productsMap.get(line.productId)
        if (!p) return null
        return (
          <Card key={line.uid} className="border-white/10 bg-white/[0.04] backdrop-blur">
            <CardContent className="flex items-start gap-3 p-3">
              <div className="apex-gradient-soft flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#FF6B1A]/20 text-2xl">
                {p.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {currency(p.price)} × {line.quantity}
                </p>
                {line.notes && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {notesParts(line.notes).map((n) => (
                      <span key={n} className="inline-flex items-center gap-1 rounded-full border border-[#FF6B1A]/40 bg-[#FF6B1A]/10 px-2 py-0.5 text-[10px] font-medium text-[#FF9A57]">
                        <PencilLine className="h-2.5 w-2.5 shrink-0" /> {n}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <p className="text-sm font-bold tabular-nums">{currency(p.price * line.quantity)}</p>
                <div className="flex items-center gap-1.5">
                  <Button size="icon" variant="outline" className="h-6.5 w-6.5 rounded-full border-white/15 bg-white/[0.04] hover:bg-white/[0.1]" style={{ width: 26, height: 26 }} onClick={() => changeQty(line.uid, -1)} aria-label="Diminuir">
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="outline" style={{ width: 26, height: 26 }} className="h-6.5 w-6.5 rounded-full border-white/15 bg-white/[0.04] hover:bg-white/[0.1]" onClick={() => changeQty(line.uid, 1)} aria-label="Aumentar">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <button
                  className="text-[10px] text-muted-foreground underline transition-colors hover:text-[#FF9A57]"
                  onClick={() => { setEditing(line); setEditQty(line.quantity); setEditNotes(line.notes) }}
                >
                  personalizar
                </button>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Card className="border-white/10 bg-white/[0.04] backdrop-blur">
        <CardContent className="space-y-2.5 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal destes itens</span>
            <span className="font-bold tabular-nums">{currency(subtotal)}</span>
          </div>
          {hasOpenOrder && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Já na comanda</span>
                <span className="font-medium tabular-nums text-zinc-300">{currency(openTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2.5 text-sm">
                <span className="font-semibold">Total acumulado após enviar</span>
                <span className="apex-text-gradient font-extrabold tabular-nums">{currency(openTotal + subtotal)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Tempo estimado de preparo</span>
            <span className="font-medium">{estMinutes} min</span>
          </div>
          <Separator className="bg-white/10" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {hasOpenOrder
              ? 'Os itens entram direto na comanda aberta da mesa e o garçom é avisado na hora.'
              : 'Ao enviar, a comanda será direcionada automaticamente ao garçom disponível e confirmada para a cozinha.'}
          </p>
        </CardContent>
      </Card>

      <Button
        onClick={() => send.mutate()}
        disabled={send.isPending}
        className="apex-gradient apex-glow h-12 w-full text-base font-semibold text-white transition-transform active:scale-[0.98]"
      >
        {send.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : hasOpenOrder ? <PlusCircle className="h-5 w-5" /> : <Send className="h-5 w-5" />}
        {hasOpenOrder ? 'Adicionar à comanda aberta' : 'Enviar comanda para o garçom'}
      </Button>

      {/* Editar observação */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-[320px]">
          <DialogHeader>
            <DialogTitle className="text-base">Personalizar item</DialogTitle>
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
          <NotesField notes={editNotes} onChange={setEditNotes} />
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

/* ==================== FASE 4 — Acompanhamento (penúltima etapa do fluxo) ==================== */
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

function TrackingPhase({ order, onOrderMore }: { order: ClientOrder; onOrderMore: () => void }) {
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
      {/* Total acumulado — contagem animada da soma inteligente de todos os itens */}
      <AccumulatedTotalCard order={order} />

      <Card className="border-white/10 bg-white/[0.04] backdrop-blur">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Acompanhamento em tempo real</p>
              <p className="font-bold text-lg">Garçom: {order.waiterName ?? 'Atribuindo…'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tempo total</p>
              <p className="font-bold text-lg tabular-nums text-[#FF9A57]">{elapsedMin} min</p>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
            {order.items.map((i) => (
              <div key={i.id} className="flex-1 flex gap-1">
                {Array.from({ length: i.quantity }).map((_, q) => (
                  <div key={q} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', {
                        'bg-zinc-500': i.status === 'PENDING',
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
          <p className="mt-2 text-[11px] text-muted-foreground">
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
          <Card key={item.id} className={cn('border-white/10 bg-white/[0.04] backdrop-blur', overdue && 'border-red-500/50')}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {item.quantity}× {item.productName}
                    </p>
                    {item.notes && <p className="mt-0.5 text-[11px] text-amber-400">“{item.notes}”</p>}
                    <div className="mt-1.5">
                      <ItemLockChip />
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[11px]', {
                    'border-zinc-500/50 text-zinc-400': item.status === 'PENDING',
                    'border-amber-500/50 text-amber-400': item.status === 'IN_PREPARATION',
                    'border-emerald-500/50 text-emerald-400': item.status === 'READY',
                    'border-[#FF6B1A]/50 text-[#FF9A57]': item.status === 'SERVED',
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
                    <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full items-center">
                        <div className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : done ? 'bg-[#FF6B1A]' : 'bg-white/10')} />
                        <Icon className={cn('h-4 w-4 shrink-0 transition-colors', done ? 'text-[#FF9A57]' : 'text-zinc-600')} />
                        <div className={cn('h-0.5 flex-1', i === STATUS_STEPS.length - 1 ? 'opacity-0' : i < stepIdx ? 'bg-[#FF6B1A]' : 'bg-white/10')} />
                      </div>
                      <span className={cn('text-center text-[9px] leading-none', done ? 'font-medium text-zinc-200' : 'text-zinc-600')}>
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-3">
                <Progress value={pct} className="h-1.5" />
                {item.status === 'PENDING' && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">aguardando cozinha</span>
                )}
                {item.status === 'IN_PREPARATION' && (
                  <span className={cn('shrink-0 font-mono text-[11px] tabular-nums', overdue ? 'font-bold text-red-400' : 'font-medium text-amber-400')}>
                    {overdue ? 'no ponto!' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}
                  </span>
                )}
                {(item.status === 'READY' || item.status === 'SERVED') && (
                  <span className="shrink-0 text-[11px] font-medium text-emerald-400">concluído</span>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Proteção da comanda — itens enviados só saem pelo garçom */}
      <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Itens enviados para a cozinha ficam <span className="font-medium text-zinc-200">protegidos</span> e não podem ser removidos por aqui.
          Precisa cancelar algo? Fale com o garçom — somente ele pode remover, com confirmação no sistema.
        </p>
      </div>

      {/* Animação de convite — penúltima etapa com atalho para pedir mais */}
      <OrderMoreBanner onOrderMore={onOrderMore} />
    </div>
  )
}

/* ==================== FASE 5 — Encerramento ==================== */
function ClosingPhase({ data, tick, token, onNew, onRated }: { data: ClientData; tick: number; token: string; onNew: () => void; onRated: () => void }) {
  const paid = !data.order && data.lastPaid
  const order = data.order ?? data.lastPaid
  const rated = paid ? data.lastPaid?.rating ?? 0 : 0
  const animatedTotal = useAnimatedMoney(order?.total ?? 0)

  return (
    <div className="apex-enter pt-6 text-center">
      {paid ? (
        rated > 0 ? (
          <>
            {/* Agradecimento final após a avaliação — Volte sempre! */}
            <div className="relative mx-auto h-20 w-20">
              <span aria-hidden className="apex-ring-pulse absolute inset-0 rounded-3xl border border-emerald-400/40" />
              <span aria-hidden className="apex-ring-pulse absolute inset-0 rounded-3xl border border-[#FF6B1A]/40" style={{ animationDelay: '0.7s' }} />
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-emerald-500/15">
                <Heart className="h-10 w-10 fill-emerald-400 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
              </div>
            </div>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight">
              Volte sempre<span className="apex-text-gradient">!</span>
            </h2>
            <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              Muito obrigado pela sua visita e pela sua avaliação! Foi um prazer receber você — a equipe APEX FOOD espera vê-lo em breve.
            </p>
            <div className="mt-3 flex items-center justify-center gap-1">
              {Array.from({ length: rated }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-[#FF6B1A] text-[#FF6B1A]" style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="relative mx-auto h-20 w-20">
              <span aria-hidden className="apex-ring-pulse absolute inset-0 rounded-3xl border border-emerald-400/40" />
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-emerald-500/15">
                <PartyPopper className="h-10 w-10 text-emerald-400" />
              </div>
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight">Pagamento confirmado!</h2>
            <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
              Sua comanda foi fechada com sucesso. Que tal avaliar a experiência? É rapidinho!
            </p>
          </>
        )
      ) : (
        <>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#FF6B1A]/10">
            <CreditCard className="h-10 w-10 text-[#FF9A57]" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight">Comanda encaminhada ao caixa</h2>
          <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
            Quando o pagamento for confirmado, esta tela mostrará o recibo final. Obrigado!
          </p>
        </>
      )}

      {order && (
        <Card className="mt-6 border-white/10 bg-white/[0.04] text-left backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Recibo · Comanda {order.code}</p>
              {tick > 0 && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><span className="apex-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> atualizando</span>}
            </div>
            <div className="mt-3 space-y-2">
              {order.items.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <span>{i.emoji}</span>
                  <span className="flex-1 truncate">{i.quantity}× {i.productName}</span>
                  <span className="font-medium tabular-nums">{currency(i.unitPrice * i.quantity)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-3 bg-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="apex-text-gradient font-extrabold tabular-nums">{currency(animatedTotal)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {paid && rated === 0 && (
        <StarRating token={token} orderId={data.lastPaid!.id} onRated={onRated} />
      )}

      {!paid && (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Aguardando confirmação do pagamento pelo caixa…
        </div>
      )}
      {paid && rated > 0 && (
        <Button onClick={onNew} className="apex-gradient mt-6 font-semibold text-white transition-transform active:scale-[0.97]">
          Nova comanda <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

/** Avaliação da experiência — liberada somente depois do pagamento no caixa */
function StarRating({ token, orderId, onRated }: { token: string; orderId: string; onRated: () => void }) {
  const [hover, setHover] = useState(0)
  const [sel, setSel] = useState(0)

  const rate = useMutation({
    mutationFn: () => apiPost(`/api/client/${token}`, { action: 'rate', orderId, rating: sel }),
    onSuccess: () => {
      playSound('success')
      toast.success('Avaliação enviada — muito obrigado!')
      onRated()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mt-6 rounded-3xl border border-[#FF6B1A]/25 bg-gradient-to-br from-[#FF6B1A]/[0.12] via-white/[0.04] to-transparent p-5">
      <p className="font-bold tracking-tight">Como foi sua experiência?</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Sua avaliação ajuda a equipe a servir você cada vez melhor.</p>
      <div className="mt-4 flex justify-center gap-2" role="radiogroup" aria-label="Avalie de 1 a 5 estrelas">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= (hover || sel)
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={sel === n}
              aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => { setSel(n); playSound('click') }}
              className={cn('p-0.5 transition-transform active:scale-90', n === sel && 'apex-star-pop')}
            >
              <Star className={cn('h-9 w-9 transition-colors', active ? 'fill-[#FF6B1A] text-[#FF6B1A] drop-shadow-[0_0_10px_rgba(255,107,26,0.45)]' : 'text-zinc-600')} />
            </button>
          )
        })}
      </div>
      <Button
        disabled={sel === 0 || rate.isPending}
        onClick={() => rate.mutate()}
        className="apex-gradient mt-4 h-11 px-8 font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-40"
      >
        {rate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
        Enviar avaliação
      </Button>
    </div>
  )
}
