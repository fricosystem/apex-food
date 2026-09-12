'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Lock, Mail, ArrowRight } from 'lucide-react'
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Painel de apresentação da marca */}
      <div
        className="relative lg:flex-1 overflow-hidden flex flex-col justify-between p-8 lg:p-14 min-h-[220px] lg:min-h-screen text-white"
        style={{ background: 'linear-gradient(150deg, #121215 0%, #0A0A0C 55%, #0D0B09 100%)' }}
      >
        {/* Decoração — brilho e arcos laranja */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 80% 96%, rgba(255,107,26,0.16) 0, transparent 44%)' }}
        />
        <div aria-hidden className="absolute -bottom-44 -right-20 h-[460px] w-[460px] rounded-full border border-[#FF6B1A]/30" />
        <div aria-hidden className="absolute -bottom-64 -right-36 h-[640px] w-[640px] rounded-full border border-[#FF6B1A]/12" />

        {/* Topo — logo */}
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl apex-gradient flex items-center justify-center ring-1 ring-white/20 shadow-lg shrink-0">
            { }
            <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-8 w-8 object-contain" />
          </div>
          <p className="font-bold text-xl tracking-tight leading-none">APEX Food</p>
        </div>

        {/* Apresentação */}
        <div className="relative hidden lg:block max-w-xl">
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

        <p className="relative text-white/40 text-xs">© 2026 APEX Food</p>
      </div>

      {/* Formulário */}
      <div className="lg:w-[480px] xl:w-[520px] flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md apex-enter">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-9 w-9 rounded-lg apex-gradient flex items-center justify-center shrink-0">
              { }
              <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-6 w-6 object-contain" />
            </div>
            <span className="font-bold tracking-tight">APEX FOOD</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Acessar painel</h2>
          <p className="text-sm text-muted-foreground mt-1.5">Entre com suas credenciais da equipe.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@apexfood.com"
                  className="pl-9 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 h-11"
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
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Acesso rápido da equipe</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => login.mutate({ email: acc.email, password: 'apex123' })}
                  disabled={login.isPending}
                  className="text-left rounded-lg border bg-card px-3 py-2.5 hover:border-primary/60 hover:bg-accent/40 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-semibold leading-tight">{acc.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{acc.desc}</p>
                </button>
              ))}
              <div className="rounded-lg border border-dashed px-3 py-2.5 flex items-center justify-center text-xs text-muted-foreground">
                senha: apex123
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-8 text-center">
            Sessões seguras · Rotas protegidas por perfil · Tema dark/light
          </p>
        </div>
      </div>
    </div>
  )
}
