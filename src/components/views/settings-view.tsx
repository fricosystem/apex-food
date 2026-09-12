'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import {
  Store, Palette, BellRing, ShieldCheck, Sun, Moon, Volume2, VolumeX, Save, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { api, apiPatch } from '@/lib/fetcher'
import { ROLE_LABELS } from '@/lib/types'
import { isSoundEnabled, setSoundEnabled, playSound } from '@/lib/sound'
import type { SessionUser } from '@/lib/auth'

const EST_TYPES = [
  { key: 'RESTAURANTE', label: 'Restaurante', icon: '🍽️' },
  { key: 'PIZZARIA', label: 'Pizzaria', icon: '🍕' },
  { key: 'HAMBURGUERIA', label: 'Hamburgueria', icon: '🍔' },
  { key: 'CHURRASCARIA', label: 'Churrascaria', icon: '🥩' },
]

const PERMISSION_MATRIX = [
  { area: 'Dashboard analítico', roles: ['ADMIN', 'MANAGER'] },
  { area: 'Tela do garçom', roles: ['ADMIN', 'MANAGER', 'WAITER'] },
  { area: 'Cozinha (KDS)', roles: ['ADMIN', 'MANAGER', 'KITCHEN'] },
  { area: 'Caixa e pagamentos', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { area: 'Gestão (produtos, equipe, metas)', roles: ['ADMIN', 'MANAGER'] },
  { area: 'Mesas e QR Codes', roles: ['ADMIN', 'MANAGER'] },
  { area: 'Configurações do sistema', roles: ['ADMIN', 'MANAGER'] },
]

export function SettingsView({ user }: { user: SessionUser }) {
  const qc = useQueryClient()
  const { theme, setTheme } = useTheme()
  const [sound, setSound] = useState(() => isSoundEnabled())
  const [formEdits, setFormEdits] = useState<{ name?: string; type?: string; logo?: string }>({})

  const { data, isLoading } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ['settings'],
    queryFn: () => api('/api/settings'),
  })
  const { data: usersData } = useQuery<{ users: Array<{ id: string; name: string; email: string; role: string; active: boolean; status: string }> }>({
    queryKey: ['users'],
    queryFn: () => api('/api/users'),
  })

  const s = data?.settings ?? {}
  const form = {
    establishmentName: formEdits.name ?? s.establishmentName ?? 'APEX FOOD',
    establishmentType: formEdits.type ?? s.establishmentType ?? 'RESTAURANTE',
    establishmentLogo: formEdits.logo ?? s.establishmentLogo ?? '🍴',
  }

  const saveSettings = useMutation({
    mutationFn: (payload: Record<string, string>) => apiPatch('/api/settings', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Configurações salvas')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />

  const updateForm = (patch: Partial<{ name: string; type: string; logo: string }>) =>
    setFormEdits((prev) => ({ ...prev, ...patch }))

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      {/* Estabelecimento */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Store className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
            <p className="font-semibold">Estabelecimento</p>
          </div>
          <div className="grid grid-cols-[70px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <Input value={form.establishmentLogo} onChange={(e) => updateForm({ logo: e.target.value.slice(0, 2) })} className="text-center text-lg" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.establishmentName} onChange={(e) => updateForm({ name: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de operação</Label>
            <div className="grid grid-cols-2 gap-2">
              {EST_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => updateForm({ type: t.key })}
                  className={cn(
                    'rounded-lg border p-3 flex items-center gap-2 text-sm font-medium transition-all',
                    form.establishmentType === t.key ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40'
                  )}
                >
                  <span className="text-lg">{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full apex-gradient text-white font-semibold" onClick={() => saveSettings.mutate({ ...form })} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar dados
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {/* Preferências */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
              <p className="font-semibold">Preferências do sistema</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2.5">
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <div>
                  <p className="text-sm font-medium">Tema {theme === 'dark' ? 'escuro' : 'claro'}</p>
                  <p className="text-[11px] text-muted-foreground">Alternador também disponível no sidebar</p>
                </div>
              </div>
              <Switch checked={theme === 'dark'} onCheckedChange={(v) => { setTheme(v ? 'dark' : 'light'); playSound('click') }} aria-label="Alternar tema" />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2.5">
                {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <div>
                  <p className="text-sm font-medium">Sons de alerta</p>
                  <p className="text-[11px] text-muted-foreground">Novas comandas, pratos prontos e pagamentos</p>
                </div>
              </div>
              <Switch
                checked={sound}
                onCheckedChange={(v) => {
                  setSound(v)
                  setSoundEnabled(v)
                  if (v) playSound('ready')
                }}
                aria-label="Sons"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2.5">
                <BellRing className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">Notificações in-app</p>
                  <p className="text-[11px] text-muted-foreground">Toasts em tempo real por perfil — sempre ativas</p>
                </div>
              </div>
              <Switch checked disabled aria-label="Notificações sempre ativas" />
            </div>
          </CardContent>
        </Card>

        {/* Usuários e permissões */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-primary" style={{ width: 18, height: 18 }} />
              <p className="font-semibold">Usuários e permissões</p>
            </div>
            <div className="max-h-[190px] overflow-y-auto rounded-lg border">
              <div className="divide-y">
                {(usersData?.users ?? []).map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5 p-2.5">
                    <div className={cn('h-7 w-7 rounded-full text-[10px] font-bold text-white flex items-center justify-center', u.active ? 'apex-gradient' : 'bg-muted')}>
                      {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}</Badge>
                    <span className={cn('h-2 w-2 rounded-full shrink-0', u.active ? 'bg-emerald-500' : 'bg-zinc-400')} />
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Matriz de acesso por perfil</p>
            <div className="space-y-1.5">
              {PERMISSION_MATRIX.map((p) => (
                <div key={p.area} className="flex items-center justify-between text-[11px] rounded-md bg-muted/40 px-2.5 py-1.5">
                  <span className="text-muted-foreground">{p.area}</span>
                  <span className="flex gap-1">
                    {p.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[9px] px-1.5">{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}</Badge>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sessão */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full apex-gradient text-white text-xs font-bold flex items-center justify-center">
              {user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{user.email} · sessão ativa por 12h</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
