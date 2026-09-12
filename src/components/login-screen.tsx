'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Lock, Mail, ArrowRight, UtensilsCrossed, ShieldCheck, Clock3, BarChart3 } from 'lucide-react'
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
      {/* Painel de marca */}
      <div className="relative lg:flex-1 apex-gradient overflow-hidden flex flex-col justify-between p-8 lg:p-14 min-h-[240px] lg:min-h-screen">
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.25) 0, transparent 45%)',
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/30">
            <UtensilsCrossed className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg tracking-tight leading-none">APEX FOOD</p>
            <p className="text-white/75 text-xs mt-1">Gestão premium para restaurantes</p>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight max-w-xl">
            Da mesa ao caixa,{' '}
            <span className="underline decoration-white/40 underline-offset-4">em tempo real</span>.
          </h1>
          <p className="text-white/85 mt-4 max-w-md text-sm lg:text-base leading-relaxed">
            Comandas digitais, distribuição inteligente entre garçons, KDS com cronômetro, caixa integrado e métricas por funcionário.
          </p>
          <div className="flex flex-wrap gap-6 mt-10 text-white">
            {[
              { icon: ShieldCheck, label: 'Perfis e permissões' },
              { icon: Clock3, label: 'Acompanhamento em tempo real' },
              { icon: BarChart3, label: 'Métricas por funcionário' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-sm font-medium">
                <f.icon className="h-4 w-4" />
                {f.label}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-white/60 text-xs hidden lg:block">© 2026 APEX FOOD — Todos os direitos reservados</p>
      </div>

      {/* Formulário */}
      <div className="lg:w-[480px] xl:w-[520px] flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md apex-enter">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg apex-gradient flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-white" />
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
