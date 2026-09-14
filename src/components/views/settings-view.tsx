'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import {
  Store, Palette, BellRing, ShieldCheck, Sun, Moon, Volume2, VolumeX, Save, Loader2,
  Play, Check, Info, AlertTriangle, XCircle, ArrowLeft, MonitorSmartphone, Vibrate,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { api, apiPatch } from '@/lib/fetcher'
import { ROLE_LABELS } from '@/lib/types'
import { useAppStore, DEFAULT_VIEW } from '@/lib/store'
import type { ViewKey } from '@/lib/types'
import {
  isSoundEnabled, setSoundEnabled, playSound,
  EVENT_SOUNDS, getVolume, setVolume,
  playEventSound, isEventSoundEnabled, setEventSoundEnabled,
} from '@/lib/sound'
import {
  NOTIF_KINDS, notificationPermission, requestNotificationPermission,
  isSystemNotifEnabled, setSystemNotifEnabled,
  isKindNotifEnabled, setKindNotifEnabled,
  pushSystemNotification, type NotifKind,
} from '@/lib/notification-service'
import type { SessionUser } from '@/lib/auth'

const EST_TYPES = [
  { key: 'RESTAURANTE', label: 'Restaurante', icon: '🍽️' },
  { key: 'PIZZARIA', label: 'Pizzaria', icon: '🍕' },
  { key: 'HAMBURGUERIA', label: 'Hamburgueria', icon: '🍔' },
  { key: 'CHURRASCARIA', label: 'Churrascaria', icon: '🥩' },
]

const PERMISSION_MATRIX = [
  { area: 'Painel da plataforma (gestão dos estabelecimentos)', roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  { area: 'Dashboard analítico', roles: ['ADMIN', 'MANAGER'] },
  { area: 'Tela do garçom', roles: ['ADMIN', 'MANAGER', 'WAITER'] },
  { area: 'Cozinha', roles: ['ADMIN', 'MANAGER', 'KITCHEN'] },
  { area: 'Caixa e pagamentos', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { area: 'Gestão (produtos, equipe, metas)', roles: ['ADMIN', 'MANAGER'] },
  { area: 'Mesas e QR Codes', roles: ['ADMIN', 'MANAGER'] },
  { area: 'Relatório Geral', roles: ['ADMIN', 'MANAGER'] },
  { area: 'Administração (funcionários, gestão geral, catálogo)', roles: ['ADMIN', 'MANAGER'] },
  { area: 'Configurações e notificações', roles: ['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'] },
]

/** Aviso de exemplo usado no botão de teste de cada tipo de ação */
function sampleFor(kind: NotifKind): { title: string; body: string } {
  switch (kind) {
    case 'comanda-nova':
      return { title: 'Nova comanda — Mesa 12', body: 'Teste de notificação: cliente abriu a comanda pelo QR Code.' }
    case 'comanda-confirmada':
      return { title: 'Comanda confirmada na cozinha', body: 'Teste de notificação: 3 itens entraram na fila de preparo.' }
    case 'prato-pronto':
      return { title: 'Prato pronto para servir', body: 'Teste de notificação: Pizza Margherita — Mesa 07.' }
    case 'encaminhada':
      return { title: 'Mesa 07 encaminhada ao caixa', body: 'Teste de notificação: comanda aguardando pagamento.' }
    case 'pagamento':
      return { title: 'Pagamento confirmado — Mesa 07', body: 'Teste de notificação: comanda #A31 finalizada via PIX.' }
    case 'alerta':
      return { title: 'Alerta de operação', body: 'Teste de notificação: comanda da Mesa 03 acima de 45 min sem itens servidos.' }
    case 'comanda-itens':
      return { title: 'Itens adicionados — Mesa 12', body: 'Teste de notificação: 2 novos itens somados à comanda aberta.' }
    case 'avaliacao':
      return { title: 'Nova avaliação — Mesa 07', body: 'Teste de notificação: cliente avaliou a experiência com 5 estrelas.' }
  }
}

export function SettingsView({ user }: { user: SessionUser }) {
  const qc = useQueryClient()
  const { theme, setTheme } = useTheme()
  const { setActiveView } = useAppStore()

  const isCompact = user.role === 'WAITER' || user.role === 'KITCHEN' || user.role === 'CASHIER'
  const isAdminish = user.role === 'ADMIN' || user.role === 'MANAGER'

  const [formEdits, setFormEdits] = useState<{ name?: string; type?: string; logo?: string }>({})

  // Preferências do dispositivo — a view só monta no cliente (após o login),
  // então inicializadores lazy podem ler localStorage sem mismatch de hidratação
  const [permState, setPermState] = useState<NotificationPermission | 'unsupported'>(() => notificationPermission())
  const [notifMaster, setNotifMaster] = useState(() => isSystemNotifEnabled())
  const [sound, setSound] = useState(() => isSoundEnabled())
  const [vol, setVol] = useState(() => getVolume())
  const [kindNotif, setKindNotif] = useState<Record<string, boolean>>(() => {
    const kn: Record<string, boolean> = {}
    for (const k of Object.keys(NOTIF_KINDS) as NotifKind[]) kn[k] = isKindNotifEnabled(k)
    return kn
  })
  const [kindSound, setKindSound] = useState<Record<string, boolean>>(() => {
    const ks: Record<string, boolean> = {}
    for (const k of Object.keys(NOTIF_KINDS) as NotifKind[]) ks[k] = isEventSoundEnabled(k)
    return ks
  })

  // Acompanha o usuário liberar/bloquear a permissão pelo navegador
  useEffect(() => {
    let st: PermissionStatus | null = null
    const onChange = () => setPermState(notificationPermission())
    navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((s) => {
        st = s
        s.onchange = onChange
      })
      .catch(() => {})
    return () => {
      if (st) st.onchange = null
    }
  }, [])

  const { data, isLoading } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ['settings'],
    queryFn: () => api('/api/settings'),
  })
  const { data: usersData } = useQuery<{ users: Array<{ id: string; name: string; email: string; role: string; active: boolean; status: string }> }>({
    queryKey: ['users'],
    queryFn: () => api('/api/users'),
    enabled: isAdminish,
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

  const updateForm = (patch: Partial<{ name: string; type: string; logo: string }>) =>
    setFormEdits((prev) => ({ ...prev, ...patch }))

  const askPermission = async () => {
    const p = await requestNotificationPermission()
    setPermState(p)
    if (p === 'granted') {
      toast.success('Notificações permitidas neste dispositivo')
      void pushSystemNotification('prato-pronto', {
        title: 'Notificações ativas — APEX FOOD',
        body: 'Você receberá aqui os avisos da operação, com som para cada tipo de ação.',
      })
    } else if (p === 'denied') {
      toast.warning('Permissão negada', {
        description: 'Para receber avisos, libere as notificações deste site nas configurações do navegador.',
      })
    }
  }

  const testKind = async (kind: NotifKind) => {
    void playEventSound(kind, { force: true })
    let p = permState
    if (p === 'default') {
      p = await requestNotificationPermission()
      setPermState(p)
    }
    if (p === 'granted') {
      const sample = sampleFor(kind)
      const ok = await pushSystemNotification(kind, { title: sample.title, body: sample.body })
      if (ok) {
        toast.success(`Aviso "${NOTIF_KINDS[kind].label}" enviado à barra do sistema`, {
          description: 'Veja o popup no canto da tela (ou na barra de notificações no celular).',
        })
      } else {
        toast.warning('Notificação do sistema desligada para este tipo', {
          description: 'Ative o interruptor do tipo de ação para receber o popup.',
        })
      }
    } else if (p === 'denied') {
      toast.warning('Notificações bloqueadas neste navegador', {
        description: 'Clique no ícone à esquerda da barra de endereço e permita notificações para este site.',
      })
    } else {
      toast.info('Som de teste tocado', {
        description: 'Este navegador não suporta notificações do sistema (em iPhone/iPad, instale o app pela tela do cliente).',
      })
    }
  }

  const toggleKind = (kind: NotifKind, on: boolean) => {
    setKindNotif((prev) => ({ ...prev, [kind]: on }))
    setKindSound((prev) => ({ ...prev, [kind]: on }))
    setKindNotifEnabled(kind, on)
    setEventSoundEnabled(kind, on)
    if (on) void playEventSound(kind, { force: true })
  }

  const goBack = () => {
    playSound('click')
    setActiveView((DEFAULT_VIEW[user.role] ?? 'dashboard') as ViewKey)
  }

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />

  const kindList = Object.keys(NOTIF_KINDS) as NotifKind[]
  const permBadge =
    permState === 'granted'
      ? { label: 'Permitidas', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
      : permState === 'denied'
        ? { label: 'Bloqueadas', cls: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400' }
        : permState === 'unsupported'
          ? { label: 'Sem suporte', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' }
          : { label: 'Pendente', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' }

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start [&>*]:min-w-0">
      {/* Banner do estabelecimento */}
      <div className="lg:col-span-2 rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="h-16 w-16 rounded-2xl apex-gradient text-white text-3xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          {form.establishmentLogo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold tracking-tight truncate">{form.establishmentName}</h2>
            <Badge className="apex-gradient text-white border-0 text-[10px]">Sistema ativo</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {EST_TYPES.find((t) => t.key === form.establishmentType)?.label ?? 'Restaurante'} · 10 módulos · 5 perfis de acesso · operação em tempo real
          </p>
        </div>
        {isCompact && (
          <Button variant="outline" onClick={goBack} className="shrink-0 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar ao atendimento
          </Button>
        )}
      </div>

      {/* Notificações do dispositivo — desktop, tablet e mobile PWA */}
      <Card className="lg:col-span-2 border-primary/25">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <BellRing className="text-primary" style={{ width: 18, height: 18 }} />
              <p className="font-semibold">Notificações do dispositivo</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-[10px]', permBadge.cls)}>
                {permBadge.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border gap-1">
                <MonitorSmartphone className="h-3 w-3" /> Desktop · Tablet · PWA
              </Badge>
            </div>
          </div>

          {/* Estado da permissão */}
          {permState === 'unsupported' ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Este navegador não suporta notificações do sistema. No iPhone/iPad, instale o app pela tela do
                cliente (Compartilhar → Adicionar à Tela de Início) e abra pelo ícone para receber os avisos.
              </p>
            </div>
          ) : permState === 'denied' ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Notificações bloqueadas para este site. Clique no ícone à esquerda da barra de endereço e permita
                notificações para voltar a receber os avisos na barra do sistema.
              </p>
            </div>
          ) : permState === 'default' ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start gap-2.5 flex-1">
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Permita as notificações para que os avisos apareçam na barra do sistema — com popup na tela,
                  som personalizado por ação e vibração no celular — mesmo com o app em outra aba.
                </p>
              </div>
              <Button size="sm" className="apex-gradient text-white font-semibold shrink-0" onClick={askPermission}>
                <BellRing className="h-4 w-4" /> Ativar notificações
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                Notificações permitidas neste dispositivo. Os avisos aparecem na barra do sistema com o som de cada ação.
              </p>
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => testKind('prato-pronto')}>
                <Play className="h-3.5 w-3.5" /> Testar agora
              </Button>
            </div>
          )}

          {/* Master das notificações do sistema */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2.5">
              <MonitorSmartphone className="h-4 w-4" />
              <div>
                <p className="text-sm font-medium">Avisos na barra do sistema</p>
                <p className="text-[11px] text-muted-foreground">
                  Popup na tela e na central de notificações (desktop, tablet e PWA no celular)
                </p>
              </div>
            </div>
            <Switch
              checked={notifMaster}
              onCheckedChange={(v) => {
                setNotifMaster(v)
                setSystemNotifEnabled(v)
                playSound('click')
                toast.success(v ? 'Notificações do sistema ativadas' : 'Notificações do sistema desativadas')
              }}
              aria-label="Notificações do sistema"
            />
          </div>

          <Separator />

          {/* Tipos de ação: som + popup por tipo */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Tipos de ação — som personalizado e popup para cada um
            </p>
            <div className="rounded-lg border divide-y">
              {kindList.map((kind) => {
                const meta = NOTIF_KINDS[kind]
                const on = kindNotif[kind] !== false
                return (
                  <div key={kind} className="flex items-center gap-3 p-2.5">
                    <div className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center text-base shrink-0 border',
                      on ? 'bg-primary/10 border-primary/25' : 'bg-muted/50 border-border opacity-60'
                    )}>
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold leading-tight">{meta.label}</p>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-border max-w-full">
                          <span className="truncate">{EVENT_SOUNDS[kind].label}</span>
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                      onClick={() => testKind(kind)}
                      aria-label={`Testar ${meta.label}`}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Switch
                      checked={on}
                      onCheckedChange={(v) => toggleKind(kind, v)}
                      aria-label={`${on ? 'Desativar' : 'Ativar'} ${meta.label}`}
                    />
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
              <Vibrate className="h-3 w-3" /> No celular (PWA instalado), os avisos vibram com padrão próprio por tipo de ação.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="text-primary" style={{ width: 18, height: 18 }} />
            <p className="font-semibold">Aparência</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'light', label: 'Claro', icon: Sun },
              { key: 'dark', label: 'Escuro', icon: Moon },
            ] as const).map((t) => {
              const Icon = t.icon
              const active = theme === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => { setTheme(t.key); playSound('click') }}
                  className={cn(
                    'rounded-lg border p-3 flex items-center gap-2 text-sm font-medium transition-all',
                    active ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40'
                  )}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                  {active && <Check className="h-3.5 w-3.5 ml-auto" />}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-md apex-gradient shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-medium">Acento laranja APEX</p>
                <p className="text-[11px] text-muted-foreground">Identidade da marca em botões, filas e destaques</p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">#FF6B1A</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sons e volume */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            {sound ? <Volume2 className="text-primary" style={{ width: 18, height: 18 }} /> : <VolumeX className="text-muted-foreground" style={{ width: 18, height: 18 }} />}
            <p className="font-semibold">Sons e volume</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2.5">
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <div>
                <p className="text-sm font-medium">Sons de alerta</p>
                <p className="text-[11px] text-muted-foreground">Comandas, pratos prontos, pagamentos e cliques</p>
              </div>
            </div>
            <Switch
              checked={sound}
              onCheckedChange={(v) => {
                setSound(v)
                setSoundEnabled(v)
                if (v) void playEventSound('comanda-nova', { force: true })
              }}
              aria-label="Sons"
            />
          </div>
          <div className="rounded-lg border p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Volume master</p>
              <span className="text-xs font-semibold text-primary">{Math.round(vol * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <VolumeX className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Slider
                value={[vol]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([v]) => { setVol(v); setVolume(v) }}
                onValueCommit={() => void playEventSound('pagamento', { force: true })}
                aria-label="Volume master"
                disabled={!sound}
              />
              <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Arraste e solte para ouvir uma amostra. Aplica-se aos sons das ações e das notificações.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Estabelecimento (administrador e gerente) */}
      {isAdminish && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Store className="text-primary" style={{ width: 18, height: 18 }} />
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
                {EST_TYPES.map((t) => {
                  const active = form.establishmentType === t.key
                  return (
                    <button
                      key={t.key}
                      onClick={() => updateForm({ type: t.key })}
                      className={cn(
                        'rounded-lg border p-3 flex items-center gap-2 text-sm font-medium transition-all min-w-0',
                        active ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40'
                      )}
                    >
                      <span className="text-lg shrink-0">{t.icon}</span> <span className="truncate">{t.label}</span>
                      {active && <Check className="h-3.5 w-3.5 ml-auto" />}
                    </button>
                  )
                })}
              </div>
            </div>
            <Button className="w-full apex-gradient text-white font-semibold" onClick={() => saveSettings.mutate({ ...form })} disabled={saveSettings.isPending}>
              {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar dados
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Usuários e permissões (administrador e gerente) */}
      {isAdminish && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary" style={{ width: 18, height: 18 }} />
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
                <div key={p.area} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[11px] rounded-md bg-muted/40 px-2.5 py-1.5">
                  <span className="text-muted-foreground">{p.area}</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {p.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[9px] px-1.5">{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}</Badge>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessão */}
      <Card className={cn(!isAdminish && 'lg:col-span-2')}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full apex-gradient text-white text-xs font-bold flex items-center justify-center">
            {user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email} · sessão ativa por 12h</p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
