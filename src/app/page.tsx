'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/fetcher'
import type { SessionUser } from '@/lib/auth'
import { LoginScreen } from '@/components/login-screen'
import { AppShell } from '@/components/app-shell'
import { ClientView } from '@/components/views/client-view'

type MeResponse = { user: SessionUser | null }

export default function Page() {
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)

  // Bootstrap: garante dados iniciais (idempotente)
  useEffect(() => {
    let cancelled = false
    void fetch('/api/bootstrap', { method: 'POST' })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setBootstrapped(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Modo cliente via hash do QR Code: #m/{token}
  const syncHash = useCallback(() => {
    const match = window.location.hash.match(/^#m\/([A-Za-z0-9]+)$/)
    setClientToken(match ? match[1] : null)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(syncHash, 0)
    window.addEventListener('hashchange', syncHash)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('hashchange', syncHash)
    }
  }, [syncHash])

  const me = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/auth/me'),
    enabled: bootstrapped && !clientToken,
    retry: 2,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  // Tela do cliente via QR Code
  if (clientToken) {
    return <ClientView token={clientToken} onExit={() => { window.location.hash = '' }} />
  }

  // Carregando sessão
  if (!bootstrapped || me.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-24 w-24 object-contain invert dark:invert-0" />
        <div className="flex flex-col items-center gap-2">
          <p className="text-3xl font-extrabold tracking-tight">APEX <span className="text-[#FF7B2E]">FOOD</span></p>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        </div>
      </div>
    )
  }

  // Sem sessão → login
  if (!me.data?.user) {
    return <LoginScreen onLogin={() => void me.refetch()} />
  }

  return <AppShell user={me.data.user} />
}
