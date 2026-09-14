'use client'

import { useMemo, useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  LayoutDashboard, ClipboardList, ChefHat, Wallet, Settings2,
  Grid3x3, PanelLeftClose, PanelLeft, Sun, Moon, LogOut, Volume2, VolumeX,
  Menu, Wifi, WifiOff, X, Bell, UserCircle2, ChevronRight, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore, DEFAULT_VIEW, VIEW_ROLES } from '@/lib/store'
import type { ViewKey } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { isSoundEnabled, setSoundEnabled, playSound } from '@/lib/sound'
import { onNotificationClick, type NotifKind } from '@/lib/notification-service'
import { apiPost } from '@/lib/fetcher'
import type { SessionUser } from '@/lib/auth'

import { DashboardView } from '@/components/views/dashboard-view'
import { WaiterView } from '@/components/views/waiter-view'
import { KdsView } from '@/components/views/kds-view'
import { CashierView } from '@/components/views/cashier-view'
import { ManagementView } from '@/components/views/management-view'
import { TablesView } from '@/components/views/tables-view'
import { ReportView } from '@/components/views/report-view'
import { SettingsView } from '@/components/views/settings-view'

const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard; description: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Visão geral da operação em tempo real' },
  { key: 'garcom', label: 'Garçom', icon: ClipboardList, description: 'Fila de comandas e atendimentos ativos' },
  { key: 'cozinha', label: 'Cozinha', icon: ChefHat, description: 'Fila de preparo, cronômetro e estações' },
  { key: 'caixa', label: 'Caixa', icon: Wallet, description: 'Pagamentos e fechamento de comandas' },
  { key: 'gestao', label: 'Gestão', icon: Settings2, description: 'Produtos, equipe, metas e operação' },
  { key: 'mesas', label: 'Mesas & QR', icon: Grid3x3, description: 'Mesas, QR Codes e status em tempo real' },
  { key: 'relatorio', label: 'Relatório Geral', icon: FileText, description: 'Relatório consolidado da operação por período e turno' },
  { key: 'configuracoes', label: 'Configurações', icon: Settings2, description: 'Preferências, notificações e estabelecimento' },
]

/** Clique numa notificação da barra do sistema leva à tela certa do tipo */
const NOTIF_VIEW: Record<NotifKind, ViewKey | null> = {
  'comanda-nova': 'garcom',
  'comanda-confirmada': 'cozinha',
  'prato-pronto': 'garcom',
  'encaminhada': 'caixa',
  'pagamento': 'caixa',
  'alerta': null,
}

export function AppShell({ user }: { user: SessionUser }) {
  const { activeView, setActiveView, sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen } = useAppStore()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const [profileOpen, setProfileOpen] = useState(false)
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

  // Clique numa notificação da barra do sistema: foca a tela correspondente
  // ao tipo de ação (respeitando as permissões do perfil)
  useEffect(() => {
    const off = onNotificationClick((kind) => {
      const view = kind ? NOTIF_VIEW[kind] : null
      if (view && VIEW_ROLES[view].includes(user.role)) {
        playSound('click')
        setActiveView(view)
      }
    })
    return off
  }, [user.role, setActiveView])

  // Perfis operacionais (garçom, cozinha, caixa): sem sidebar — apenas header + body,
  // com a marca (logo + APEX FOOD) no canto esquerdo do header. Admin/gerente mantêm sidebar.
  const isCompact = user.role === 'WAITER' || user.role === 'KITCHEN' || user.role === 'CASHIER'

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-sidebar-border shrink-0">
        <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-11 w-auto shrink-0 invert dark:invert-0" />
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-bold tracking-tight leading-none text-sidebar-foreground">APEX <span className="text-[#FF7B2E]">FOOD</span></p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">EMPÓRIO RESTAURANTE</p>
            <p className="text-[9px] font-semibold text-primary mt-0.5 truncate tracking-wide">CNPJ 12.345.678/0001-90</p>
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

      {/* Rodapé do sidebar: apenas o perfil, sem card, separado por divisor (tema e sons vivem nas Configurações) */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div
          className={cn(
            'flex items-center gap-2.5',
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
      {/* Sidebar desktop — oculta para perfis operacionais */}
      {!isCompact && (
        <>
          <aside
            className={cn(
              'hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-200 sticky top-0 h-screen',
              sidebarCollapsed ? 'w-[68px]' : 'w-60'
            )}
          >
            {SidebarContent}
            <button
              onClick={toggleSidebar}
              className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {sidebarCollapsed ? <PanelLeft className="h-3 w-3" /> : <PanelLeftClose className="h-3 w-3" />}
            </button>
          </aside>

          {/* Sidebar mobile (drawer) — modal={false} evita o scroll-lock do Radix,
              que removia a scrollbar e alterava a largura de todos os cards ao abrir */}
          <Sheet modal={false} open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              {SidebarContent}
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className={cn(
            'h-16 sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md items-center px-3 sm:px-4 lg:px-6 relative',
            isCompact ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)] gap-2' : 'flex gap-3'
          )}
        >
          {isCompact ? (
            <>
              {/* Marca — coluna esquerda do grid, com logo ampliada nestas telas */}
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-11 sm:h-14 w-auto shrink-0 invert dark:invert-0" />
                <div className="min-w-0 hidden lg:block">
                  <p className="font-bold tracking-tight leading-none text-sm">APEX <span className="text-[#FF7B2E]">FOOD</span></p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">EMPÓRIO RESTAURANTE</p>
                  <p className="text-[9px] font-semibold text-primary mt-0.5 truncate tracking-wide">CNPJ 12.345.678/0001-90</p>
                </div>
              </div>

              {/* Estabelecimento como título + descrição da tela — coluna central */}
              <div className="w-full min-w-0 justify-self-center text-center px-1">
                <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight leading-tight truncate text-primary">
                  EMPÓRIO RESTAURANTE
                </h1>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                  {currentMeta?.description}
                </p>
              </div>

              {/* Bolinha do perfil — coluna direita, colada no canto do header */}
              <div className="justify-self-end -mr-1.5 sm:-mr-2 lg:-mr-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full apex-gradient flex items-center justify-center text-white text-[10px] sm:text-xs font-bold transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Abrir menu do perfil"
                      aria-haspopup="menu"
                    >
                      {initials(user.name)}
                      <span
                        className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background', user.status === 'BUSY' ? 'bg-amber-500' : 'bg-emerald-500')}
                        aria-hidden
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={10} className="w-[min(92vw,320px)] p-0">
                    {/* Identidade */}
                    <div className="flex items-center gap-3 p-3.5 pb-2.5">
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-full apex-gradient flex items-center justify-center text-white text-xs font-bold">
                          {initials(user.name)}
                        </div>
                        <span
                          className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background', user.status === 'BUSY' ? 'bg-amber-500' : 'bg-emerald-500')}
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</p>
                      </div>
                    </div>

                    {/* Status de conexão (informativo) */}
                    <div className="mx-3 mb-2 flex items-center justify-between rounded-lg border bg-muted/30 px-2.5 py-1.5 text-[11px]">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        Conexão
                      </span>
                      <span className={cn('font-semibold', connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                        {connected ? 'Tempo real' : 'Offline'}
                      </span>
                    </div>

                    {/* Opções com ícones */}
                    <div className="p-1.5 pt-0">
                      <DropdownMenuItem
                        onClick={() => { playSound('click'); setActiveView('configuracoes') }}
                        className="gap-2.5 py-2.5"
                      >
                        <Bell className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1">Configurações e avisos</span>
                        <ChevronRightHint />
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={toggleSound} className="gap-2.5 py-2.5">
                        {isSoundEnabled() ? <Volume2 className="h-4 w-4 text-primary shrink-0" /> : <VolumeX className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="flex-1">Sons de alerta</span>
                        <span className="text-[10px] text-muted-foreground">{isSoundEnabled() ? 'ativados' : 'desativados'}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={toggleTheme} className="gap-2.5 py-2.5">
                        {theme === 'dark' ? <Sun className="h-4 w-4 text-primary shrink-0" /> : <Moon className="h-4 w-4 text-primary shrink-0" />}
                        <span className="flex-1">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
                      </DropdownMenuItem>
                    </div>

                    <DropdownMenuSeparator className="my-1" />

                    <div className="p-1.5 pt-1.5">
                      <DropdownMenuItem onClick={() => setProfileOpen(true)} className="gap-2.5 py-2.5">
                        <UserCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1">Perfil do usuário</span>
                        <ChevronRightHint />
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => logout.mutate()}
                        className="gap-2.5 py-2.5 text-destructive focus:text-destructive"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span className="flex-1">Sair</span>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="font-bold tracking-tight leading-tight truncate">{currentMeta?.label}</h1>
                <p className="text-xs text-muted-foreground truncate hidden sm:block">{currentMeta?.description}</p>
              </div>
              {/* Badge "Tempo real" removido a pedido — status de conexão segue disponível no menu do perfil */}
              <Badge variant="outline" className="hidden lg:inline-flex text-[11px] text-muted-foreground border-border">
                {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
              </Badge>
            </>
          )}
        </header>

        {/* Dialog: Perfil do usuário (apenas telas operacionais) */}
        {isCompact && (
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="w-[min(92vw,400px)] rounded-xl gap-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserCircle2 className="h-5 w-5 text-primary" /> Perfil do usuário
                </DialogTitle>
                <DialogDescription>Seus dados de acesso no EMPÓRIO RESTAURANTE.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3.5">
                <div className="relative shrink-0">
                  <div className="h-14 w-14 rounded-full apex-gradient flex items-center justify-center text-white text-base font-bold">
                    {initials(user.name)}
                  </div>
                  <span
                    className={cn('absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background', user.status === 'BUSY' ? 'bg-amber-500' : 'bg-emerald-500')}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate leading-tight">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              <div className="rounded-lg border divide-y text-sm">
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-muted-foreground text-xs">Cargo</span>
                  <span className="font-medium">{ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-muted-foreground text-xs">Status</span>
                  <span className={cn('font-medium', user.status === 'BUSY' ? 'text-amber-500' : 'text-emerald-500')}>
                    {user.status === 'BUSY' ? 'Ocupado' : 'Online'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-muted-foreground text-xs">Estabelecimento</span>
                  <span className="font-medium">EMPÓRIO RESTAURANTE</span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          <div className="apex-enter" key={current}>
            {current === 'dashboard' && <DashboardView user={user} />}
            {current === 'garcom' && <WaiterView user={user} />}
            {current === 'cozinha' && <KdsView user={user} />}
            {current === 'caixa' && <CashierView user={user} />}
            {current === 'gestao' && <ManagementView user={user} />}
            {current === 'mesas' && <TablesView user={user} />}
            {current === 'relatorio' && <ReportView user={user} />}
            {current === 'configuracoes' && <SettingsView user={user} />}
          </div>
        </main>

        <footer className="mt-auto border-t py-3 px-6 text-center text-[11px] text-muted-foreground">
          SISTEMA APEX FOOD
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

/** Setinha de "abrir" usada nos itens do menu do perfil */
function ChevronRightHint() {
  return <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" aria-hidden />
}
