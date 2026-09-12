'use client'

import { useEffect, useRef, useState } from 'react'
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
import type { SessionUser } from '@/lib/auth'

const DEMO_ACCOUNTS = [
  { email: 'admin@apexfood.com', label: 'Administrador', desc: 'Acesso total' },
  { email: 'gerente@apexfood.com', label: 'Gerente', desc: 'Operação e métricas' },
  { email: 'rafael@apexfood.com', label: 'Garçom', desc: 'Comandas e atendimento' },
  { email: 'cozinha@apexfood.com', label: 'Cozinha', desc: 'KDS — preparo' },
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
    tag: 'Módulo 03 · Cozinha (KDS)',
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

/** Seção com fade in ao entrar na viewport e fade out reversível ao sair (rolando para baixo ou para cima) */
function FadeSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out will-change-[opacity,transform]',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-7',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function LoginScreen({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const queryClient = useQueryClient()

  const login = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      apiPost<{ user: SessionUser }>('/api/auth/login', creds),
    onSuccess: (data) => {
      playSound('success')
      toast.success(`Bem-vindo(a), ${data.user.name.split(' ')[0]}!`)
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
      {/* Decoração fixa — brilho e arcos laranja acompanhando a viewport */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 82% 94%, rgba(255,107,26,0.14) 0, transparent 42%)' }} />
        <div className="absolute -bottom-44 -right-20 h-[460px] w-[460px] rounded-full border border-[#FF6B1A]/30" />
        <div className="absolute -bottom-64 -right-36 h-[640px] w-[640px] rounded-full border border-[#FF6B1A]/12" />
      </div>

      {/* Coluna de apresentação — scroll com seções por módulo */}
      <div className="relative z-10 hidden lg:flex lg:flex-col flex-1 px-14 pt-10 pb-14">
        {/* Topo — logo sólida */}
        <div className="relative flex items-center gap-2">
          <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-16 w-auto drop-shadow-lg" />
          <p className="font-extrabold text-3xl xl:text-[2.4rem] tracking-tight leading-none">APEX <span className="text-[#FF7B2E]">FOOD</span></p>
        </div>

        {/* Abertura */}
        <FadeSection className="relative max-w-xl pt-24 pb-24">
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
          <p className="mt-10 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/35">
            Role para conhecer o sistema <ArrowRight className="h-3.5 w-3.5 rotate-90" aria-hidden />
          </p>
        </FadeSection>

        {/* Seções por módulo */}
        {MODULE_SECTIONS.map((m, i) => {
          const Icon = m.icon
          return (
            <FadeSection key={m.tag} className={cn('relative max-w-xl', i === 0 ? 'pt-10' : 'pt-24', 'pb-16')}>
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
            </FadeSection>
          )
        })}

        {/* Seção final — fechamento + rodapé */}
        <FadeSection className="relative max-w-xl pt-24 pb-2">
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
        </FadeSection>
      </div>

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
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" aria-hidden />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@apexfood.com"
                  className="pl-9 h-11 bg-white dark:bg-white border-white/15 text-zinc-900 placeholder:text-zinc-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-200">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" aria-hidden />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 h-11 bg-white dark:bg-white border-white/15 text-zinc-900 placeholder:text-zinc-400"
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
                  className="text-left rounded-lg border border-white/15 bg-white px-3 py-2.5 hover:border-[#FF6B1A]/70 hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-semibold leading-tight text-zinc-900">{acc.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{acc.desc}</p>
                </button>
              ))}
              <div className="rounded-lg border border-dashed border-white/20 px-3 py-2.5 flex items-center justify-center text-xs text-white/55">
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
