'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2, Lock, Mail, ArrowRight, LayoutDashboard, ClipboardList,
  ChefHat, CreditCard, Settings2, QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPost } from '@/lib/fetcher'
import { playSound } from '@/lib/sound'
import { pushSystemNotification } from '@/lib/notification-service'
import { ROLE_LABELS } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

const DEMO_ACCOUNTS = [
  { email: 'admin@apexfood.com', label: 'Administrador', desc: 'Acesso total' },
  { email: 'gerente@apexfood.com', label: 'Gerente', desc: 'Operação e métricas' },
  { email: 'rafael@apexfood.com', label: 'Garçom', desc: 'Comandas e atendimento' },
  { email: 'cozinha@apexfood.com', label: 'Cozinha', desc: 'Fila de preparo' },
  { email: 'caixa@apexfood.com', label: 'Caixa', desc: 'Pagamentos' },
]

const MODULE_SECTIONS = [
  {
    icon: LayoutDashboard,
    tag: 'Módulo 01 · Dashboard',
    title: 'Decisões guiadas por dados, em tempo real',
    desc: 'Acompanhe faturamento, ticket médio, tempo médio de atendimento e ocupação das mesas em painéis que se atualizam sozinhos enquanto a operação acontece.',
    chips: ['Faturamento por período', 'Produtos mais vendidos', 'Desempenho por garçom'],
  },
  {
    icon: ClipboardList,
    tag: 'Módulo 02 · Garçom',
    title: 'Comandas digitais do atendimento à entrega',
    desc: 'Abra comandas, lance pedidos por mesa e acompanhe cada item até o cliente. O sistema atribui automaticamente um garçom disponível para cada comanda aberta pelo QR Code.',
    chips: ['Abertura e lançamento rápido', 'Atribuição automática', 'Controle de itens servidos'],
  },
  {
    icon: ChefHat,
    tag: 'Módulo 03 · Cozinha',
    title: 'Produção organizada por setor, sem papel',
    desc: 'Cada pedido cai direto na fila do setor certo — cozinha, churrascaria ou pizzaria — com cronômetro por item e fluxo claro: pendente, em preparo, pronto e servido.',
    chips: ['Filas em tempo real', 'Cronômetro por item', 'Alertas de atraso'],
  },
  {
    icon: CreditCard,
    tag: 'Módulo 04 · Caixa',
    title: 'Fechamento rápido, com recibo na hora',
    desc: 'Receba por múltiplas formas de pagamento, encerre comandas com dois toques e envie o recibo digital direto para a tela do cliente.',
    chips: ['Pagamentos flexíveis', 'Encerramento em 2 toques', 'Recibo digital'],
  },
  {
    icon: Settings2,
    tag: 'Módulo 05 · Gestão',
    title: 'Cardápio, equipe e permissões sob controle',
    desc: 'Cadastre produtos, categorias e preços, organize os setores de preparo e controle o acesso da equipe com perfis de administrador, gerente, garçom, cozinha e caixa.',
    chips: ['Produtos e categorias', 'Perfis de acesso', 'Setores de preparo'],
  },
  {
    icon: QrCode,
    tag: 'Módulo 06 · Mesas & QR',
    title: 'Autoatendimento que chega na mesa do cliente',
    desc: 'Cada mesa tem um QR Code exclusivo. O cliente escaneia, monta a comanda, personaliza os itens — como retirar ingredientes — e envia direto para o garçom e a cozinha, acompanhando o preparo em tempo real.',
    chips: ['QR exclusivo por mesa', 'Personalização de itens', 'Acompanhamento em 5 fases'],
  },
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Fade vinculado à posição de rolagem (sem transição CSS — o estilo é recalculado a cada frame):
 * - rolando para baixo: o que entra por baixo sofre fade in subindo (+44px → 0) e o que
 *   sai por cima sofre fade out (0 → -30px);
 * - rolando para cima (reverse): o mesmo cálculo posicional inverte o efeito — o conteúdo
 *   superior volta com fade in descendo e o inferior some com fade out.
 */
type FadeApi = { register: (el: HTMLDivElement | null) => void }
const FadeCtx = createContext<FadeApi | null>(null)

function useFadeController(): FadeApi {
  const items = useRef(new Set<HTMLDivElement>())
  const rafRef = useRef(0)

  const update = useCallback(() => {
    rafRef.current = 0
    const H = window.innerHeight || 1
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    items.current.forEach((el) => {
      if (!el.isConnected) {
        items.current.delete(el)
        return
      }
      if (reduced) {
        el.style.opacity = '1'
        el.style.transform = ''
        return
      }
      const rect = el.getBoundingClientRect()
      // Desconta o transform aplicado no frame anterior para medir a posição de layout
      const prevY = Number(el.dataset.fadeY ?? 0)
      const top = rect.top - prevY
      const bottom = rect.bottom - prevY
      // Entrada: topo percorrendo os 22% inferiores da viewport
      const tIn = clamp01((H - top) / (H * 0.22))
      // Saída: base adentrando os 28% superiores da viewport
      const tOut = clamp01(bottom / (H * 0.28))
      // Blocos ancorados na primeira dobra nascem visíveis e sofrem apenas o fade de saída
      const anchored = el.dataset.fadeAnchored === '1'
      const opacity = anchored ? tOut : Math.min(tIn, tOut)
      const y = (anchored ? 0 : (1 - tIn) * 44) - (1 - tOut) * 30
      el.dataset.fadeY = y.toFixed(1)
      el.style.opacity = opacity.toFixed(3)
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`
    })
  }, [])

  const schedule = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(update)
  }, [update])

  const register = useCallback((el: HTMLDivElement | null) => {
    if (el) items.current.add(el)
  }, [])

  useEffect(() => {
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // Recalcula após fontes/imagens estabilizarem o layout
    const t1 = window.setTimeout(schedule, 350)
    const t2 = window.setTimeout(schedule, 900)
    document.fonts?.ready.then(schedule).catch(() => {})
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [schedule])

  return { register }
}

/** Bloco que participa do fade de rolagem; startVisible mantém o bloco visível antes da hidratação e anchored desativa o fade de entrada (só sai por cima) */
function ScrollFade({ children, className, startVisible, anchored }: {
  children: React.ReactNode
  className?: string
  startVisible?: boolean
  anchored?: boolean
}) {
  const fade = useContext(FadeCtx)
  return (
    <div
      ref={fade?.register}
      className={cn('relative', className)}
      data-fade-anchored={anchored ? '1' : undefined}
      data-fade-y={startVisible ? undefined : '44'}
      style={{
        opacity: startVisible ? undefined : 0,
        transform: startVisible ? undefined : 'translate3d(0, 44px, 0)',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}

/** Notificação de teste exibida ao entrar — boas-vindas com a logo da APEX */
function WelcomeNotification({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-start gap-3 w-[min(92vw,360px)] rounded-xl border border-[#FF6B1A]/35 bg-[#141417] p-3.5 shadow-2xl">
      <div className="h-12 w-12 rounded-lg border border-[#FF6B1A]/25 bg-white/[0.04] flex items-center justify-center shrink-0 p-1.5">
        <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-full w-full object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white leading-tight">
          Bem-vindo(a) de volta, <span className="text-[#FF9A57]">{name}</span>!
        </p>
        <p className="text-[11px] text-white/60 mt-0.5">
          Você entrou como <span className="text-white/85 font-medium">{role}</span>
        </p>
        <span className="inline-flex items-center gap-1.5 mt-2 rounded-full border border-[#FF6B1A]/30 bg-[#FF6B1A]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#FF9A57]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B1A]" aria-hidden />
          Notificação de teste
        </span>
      </div>
    </div>
  )
}

export function LoginScreen({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const fade = useFadeController()
  const queryClient = useQueryClient()

  const login = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      apiPost<{ user: SessionUser }>('/api/auth/login', creds),
    onSuccess: (data) => {
      playSound('success')
      const firstName = data.user.name.split(' ')[0]
      const roleLabel = ROLE_LABELS[data.user.role] ?? data.user.role
      toast.custom(() => <WelcomeNotification name={firstName} role={roleLabel} />, { duration: 5000 })
      // Notificação de teste também na barra do sistema (quando permitido), com a logo da APEX
      void pushSystemNotification('alerta', {
        title: 'Bem-vindo(a) de volta!',
        body: `${data.user.name} — ${roleLabel} · APEX FOOD`,
        tag: 'apex-bem-vindo',
        icon: '/apex-logo.png',
      })
      queryClient.setQueryData(['me'], { user: data.user })
      onLogin(data.user)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('Preencha e-mail e senha')
      return
    }
    login.mutate({ email: email.trim(), password })
  }

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row text-white"
      style={{
        background: 'linear-gradient(150deg, #121215 0%, #0A0A0C 55%, #0D0B09 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Decoração fixa — brilho suave + marca de círculos animada acompanhando a viewport */}
      <div aria-hidden className="apex-login-decor pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 82% 94%, rgba(255,107,26,0.10) 0, transparent 42%)' }} />
        {/* Marca de círculos — centralizada na lateral de divisão entre a apresentação (esquerda) e o formulário (direita) */}
        <div className="hidden lg:block absolute inset-y-0 right-[480px] xl:right-[520px] w-px">
          {/* fio de luz sutil acompanhando a divisão */}
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[#FF6B1A]/20 to-transparent" />
          {/* halo de luz pulsante no centro da divisão */}
          <div
            className="apex-ring-halo absolute left-1/2 top-1/2 h-[640px] w-[640px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,107,26,0.11) 0%, rgba(255,107,26,0.04) 40%, transparent 68%)' }}
          />
          {/* anéis concêntricos: respiração + rotação lenta */}
          <div className="apex-ring-outer absolute left-1/2 top-1/2 h-[700px] w-[700px] rounded-full border border-[#FF6B1A]/12" />
          <div className="apex-ring-mid absolute left-1/2 top-1/2 h-[540px] w-[540px] rounded-full border border-dashed border-[#FF6B1A]/25" />
          <div className="apex-ring-inner absolute left-1/2 top-1/2 h-[380px] w-[380px] rounded-full border border-[#FF6B1A]/30" />
          {/* pulso radar + núcleo laranja */}
          <div className="apex-ring-pulse absolute left-1/2 top-1/2 h-[380px] w-[380px] rounded-full border border-[#FF6B1A]/45" />
          <div className="absolute left-1/2 top-1/2 -ml-[5px] -mt-[5px] h-2.5 w-2.5 rounded-full apex-gradient shadow-[0_0_18px_4px_rgba(255,107,26,0.55)] apex-live-dot" />
        </div>
      </div>

      <FadeCtx.Provider value={fade}>
      {/* Coluna de apresentação — scroll com seções por módulo */}
      <div className="relative z-10 hidden lg:flex lg:flex-col flex-1 px-14 pb-10">
        {/* Primeira dobra — ocupa exatamente a viewport inicial: só a abertura e a dica "role" ficam visíveis; os módulos começam abaixo do limite da tela */}
        <div className="flex min-h-screen flex-col">
          <ScrollFade startVisible className="max-w-xl pt-10">
            <div className="flex items-center gap-2">
              <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-16 w-auto drop-shadow-lg" />
              <p className="font-extrabold text-3xl xl:text-[2.4rem] tracking-tight leading-none">APEX <span className="text-[#FF7B2E]">FOOD</span></p>
            </div>
            <div className="pt-24">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[#FF6B1A]" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                  Gestão que acompanha o seu ritmo
                </p>
              </div>
              <h1 className="mt-6 text-[2.6rem] xl:text-[3.4rem] font-extrabold leading-[1.08] tracking-tight">
                Mais controle para uma operação <span className="text-[#FF7B2E]">mais inteligente.</span>
              </h1>
              <p className="mt-6 text-white/70 leading-relaxed max-w-lg">
                Centralize pedidos, salão, equipe e financeiro em uma experiência criada para deixar o
                seu restaurante mais eficiente todos os dias.
              </p>
              <div className="flex flex-wrap gap-3 mt-9">
                {['Operação em tempo real', 'Decisões mais rápidas', 'Visão do seu negócio'].map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/85 backdrop-blur"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B1A]" aria-hidden />
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </ScrollFade>

          {/* Dica de rolagem — ancorada na base da primeira dobra, acima do limite da tela */}
          <ScrollFade startVisible anchored className="max-w-xl mt-auto pb-9">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/35">
              Role para conhecer o sistema <ArrowRight className="h-3.5 w-3.5 rotate-90" aria-hidden />
            </p>
          </ScrollFade>
        </div>

        {/* Seções por módulo */}
        {MODULE_SECTIONS.map((m, i) => {
          const Icon = m.icon
          return (
            <ScrollFade key={m.tag} className={cn('max-w-xl', i === 0 ? 'pt-2' : 'pt-24', 'pb-16')}>
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl border border-[#FF6B1A]/30 bg-[#FF6B1A]/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-[#FF9A57]" aria-hidden />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">{m.tag}</p>
              </div>
              <h2 className="mt-5 text-[1.8rem] xl:text-[2.1rem] font-extrabold leading-tight tracking-tight">
                {m.title}
              </h2>
              <p className="mt-4 text-white/65 leading-relaxed max-w-lg">{m.desc}</p>
              <div className="flex flex-wrap gap-2.5 mt-7">
                {m.chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B1A]" aria-hidden />
                    {chip}
                  </span>
                ))}
              </div>
            </ScrollFade>
          )
        })}

        {/* Seção final — fechamento + rodapé */}
        <ScrollFade className="max-w-xl pt-24 pb-2">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#FF6B1A]" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">Tudo em um só lugar</p>
          </div>
          <h2 className="mt-5 text-[1.8rem] xl:text-[2.1rem] font-extrabold leading-tight tracking-tight">
            Do QR Code na mesa ao caixa, uma única plataforma.
          </h2>
          <p className="mt-4 text-white/65 leading-relaxed max-w-lg">
            Escaneie, peça, acompanhe o preparo e pague — com o salão, a cozinha e o caixa
            sincronizados no mesmo sistema, do primeiro pedido ao fechamento do dia.
          </p>
          {/* Rodapé na base da última seção */}
          <div className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/40">
            <span>© 2026 APEX Food</span>
            <span className="h-3 w-px bg-white/25" aria-hidden />
            <span className="uppercase tracking-[0.18em]">Desenvolvido por APEX HUB SYSTEM</span>
          </div>
        </ScrollFade>
      </div>
      </FadeCtx.Provider>

      {/* Formulário — continuação do mesmo fundo, sem caixa separada (tema claro fixo) */}
      <div className="relative z-10 w-full lg:w-[480px] xl:w-[520px] lg:sticky lg:top-0 lg:h-screen flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md apex-enter">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-12 w-auto drop-shadow-lg" />
            <span className="font-extrabold text-2xl tracking-tight leading-none">APEX <span className="text-[#FF7B2E]">FOOD</span></span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Acessar painel</h2>
          <p className="text-sm text-white/60 mt-1.5">Entre com suas credenciais da equipe.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-200">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@apexfood.com"
                  className="pl-9 h-11 bg-background text-foreground"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-200">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 h-11 bg-background text-foreground"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 apex-gradient text-white font-semibold hover:opacity-90 transition-opacity" disabled={login.isPending}>
              {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Entrar
            </Button>
          </form>

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/15" />
              <span className="text-xs text-white/50 uppercase tracking-wider">Acesso rápido da equipe</span>
              <div className="h-px flex-1 bg-white/15" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => login.mutate({ email: acc.email, password: 'apex123' })}
                  disabled={login.isPending}
                  className="text-left rounded-lg border border-input bg-background dark:bg-input/30 px-3 py-2.5 hover:border-[#FF6B1A]/70 hover:bg-orange-50 dark:hover:bg-[#FF6B1A]/10 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-semibold leading-tight text-foreground">{acc.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{acc.desc}</p>
                </button>
              ))}
              <div className="rounded-lg border border-dashed border-input px-3 py-2.5 flex items-center justify-center text-xs text-muted-foreground">
                senha: apex123
              </div>
            </div>
          </div>

          <p className="text-[11px] text-white/50 mt-8 text-center">
            Sessões seguras · Rotas protegidas por perfil · Tema dark/light
          </p>
        </div>
      </div>
    </div>
  )
}
