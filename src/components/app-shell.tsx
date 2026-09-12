'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  LayoutDashboard, ClipboardList, ChefHat, Wallet, Settings2,
  Grid3x3, PanelLeftClose, PanelLeft, Sun, Moon, LogOut, Volume2, VolumeX,
  Menu, Wifi, WifiOff, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useAppStore, DEFAULT_VIEW, VIEW_ROLES } from '@/lib/store'
import type { ViewKey } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { isSoundEnabled, setSoundEnabled, playSound } from '@/lib/sound'
import { apiPost } from '@/lib/fetcher'
import type { SessionUser } from '@/lib/auth'

import { DashboardView } from '@/components/views/dashboard-view'
import { WaiterView } from '@/components/views/waiter-view'
import { KdsView } from '@/components/views/kds-view'
import { CashierView } from '@/components/views/cashier-view'
import { ManagementView } from '@/components/views/management-view'
import { TablesView } from '@/components/views/tables-view'
import { SettingsView } from '@/components/views/settings-view'

const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard; description: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Visão geral da operação em tempo real' },
  { key: 'garcom', label: 'Garçom', icon: ClipboardList, description: 'Fila de comandas e atendimento ativo' },
  { key: 'cozinha', label: 'Cozinha (KDS)', icon: ChefHat, description: 'Fila de preparo, cronômetro e estações' },
  { key: 'caixa', label: 'Caixa', icon: Wallet, description: 'Pagamentos e fechamento de comandas' },
  { key: 'gestao', label: 'Gestão', icon: Settings2, description: 'Produtos, equipe, metas e operação' },
  { key: 'mesas', label: 'Mesas & QR', icon: Grid3x3, description: 'Mesas, QR Codes e status em tempo real' },
  { key: 'configuracoes', label: 'Configurações', icon: Settings2, description: 'Preferências e estabelecimento' },
]

export function AppShell({ user }: { user: SessionUser }) {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useAppStore()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const { connected } = useRealtime(user.role, user.id)

  const allowedViews = useMemo(
    () => NAV_ITEMS.filter((n) => VIEW_ROLES[n.key].includes(user.role)),
    [user.role]
  )
  const current: ViewKey = useMemo(() => {
    const target = activeView ?? DEFAULT_VIEW[user.role] ?? 'dashboard'
    if (!VIEW_ROLES[target].includes(user.role)) {
      return (allowedViews[0]?.key ?? 'dashboard') as ViewKey
    }
    return target
  }, [activeView, user.role, allowedViews])

  const logout = useMutation({
    mutationFn: () => apiPost('/api/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['me'], { user: null })
      toast.success('Sessão encerrada')
    },
  })

  const toggleTheme = () => {
    playSound('click')
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const toggleSound = () => {
    const next = !isSoundEnabled()
    setSoundEnabled(next)
    if (next) playSound('click')
    toast.success(next ? 'Sons de alerta ativados' : 'Sons de alerta desativados')
  }

  const navigate = (v: ViewKey) => {
    playSound('click')
    setActiveView(v)
    setMobileNavOpen(false)
  }

  const currentMeta = NAV_ITEMS.find((n) => n.key === current)

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-sidebar-border shrink-0">
        <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-11 w-auto shrink-0 invert dark:invert-0" />
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-bold tracking-tight leading-none text-sidebar-foreground">APEX FOOD</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Operação premium</p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto p-2.5 space-y-1" aria-label="Navegação principal">
        {allowedViews.map((item) => {
          const Icon = item.icon
          const active = current === item.key
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative',
                active
                  ? 'bg-primary/10 text-primary apex-ring-subtle'
                  : 'text-sidebar-foreground/75 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60'
              )}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" aria-hidden />}
              <Icon className={cn('h-4.5 w-4.5 shrink-0', active && 'drop-shadow')} style={{ width: 18, height: 18 }} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Rodapé do sidebar: tema + usuário */}
      <div className="border-t border-sidebar-border p-3 space-y-2.5 shrink-0">
        <div className={cn('flex gap-1.5', sidebarCollapsed && 'flex-col items-center')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className={cn('flex-1 justify-center gap-2', sidebarCollapsed && 'px-0')}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!sidebarCollapsed && <span className="text-xs">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSound}
            className={cn(sidebarCollapsed && 'px-0')}
            aria-label="Alternar sons"
          >
            {isSoundEnabled() ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>

        <div
          className={cn(
            'rounded-lg border bg-card p-2.5 flex items-center gap-2.5',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <div className="relative shrink-0">
            <div className="h-9 w-9 rounded-full apex-gradient flex items-center justify-center text-white text-xs font-bold">
              {initials(user.name)}
            </div>
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar',
                user.status === 'BUSY' ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              aria-label={user.status === 'BUSY' ? 'Ocupado' : 'Online'}
            />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</p>
            </div>
          )}
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => logout.mutate()}
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-200 sticky top-0 h-screen',
          sidebarCollapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        {SidebarContent}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {sidebarCollapsed ? <PanelLeft className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
        </button>
      </aside>

      {/* Sidebar mobile (drawer) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          {SidebarContent}
        </SheetContent>
      </Sheet>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md flex items-center gap-3 px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold tracking-tight leading-tight truncate">{currentMeta?.label}</h1>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{currentMeta?.description}</p>
          </div>
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium rounded-full border px-2.5 py-1',
              connected ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'text-muted-foreground border-border'
            )}
            title={connected ? 'Conectado em tempo real' : 'Reconectando...'}
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            <span className="hidden sm:inline">{connected ? 'Tempo real' : 'Offline'}</span>
            <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500 apex-live-dot' : 'bg-muted-foreground')} />
          </div>
          <Badge variant="outline" className="hidden lg:inline-flex text-[11px] text-muted-foreground border-border">
            {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
          </Badge>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <div className="apex-enter" key={current}>
            {current === 'dashboard' && <DashboardView user={user} />}
            {current === 'garcom' && <WaiterView user={user} />}
            {current === 'cozinha' && <KdsView user={user} />}
            {current === 'caixa' && <CashierView user={user} />}
            {current === 'gestao' && <ManagementView user={user} />}
            {current === 'mesas' && <TablesView user={user} />}
            {current === 'configuracoes' && <SettingsView user={user} />}
          </div>
        </main>

        <footer className="mt-auto border-t py-3 px-6 text-center text-[11px] text-muted-foreground">
          APEX FOOD · Operação em tempo real da mesa ao caixa
        </footer>
      </div>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export { NAV_ITEMS }
export function MobileNavClose() {
  return <X className="h-4 w-4" />
}
