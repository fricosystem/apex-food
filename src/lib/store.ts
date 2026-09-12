import { create } from 'zustand'
import type { ViewKey } from '@/lib/types'

export type AppState = {
  activeView: ViewKey | null // null = usar default do papel
  setActiveView: (v: ViewKey | null) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeView: null,
  setActiveView: (v) => set({ activeView: v }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  mobileNavOpen: false,
  setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
}))

export const DEFAULT_VIEW: Record<string, ViewKey> = {
  ADMIN: 'dashboard',
  MANAGER: 'dashboard',
  WAITER: 'garcom',
  KITCHEN: 'cozinha',
  CASHIER: 'caixa',
}

/** Papéis autorizados por tela */
export const VIEW_ROLES: Record<ViewKey, string[]> = {
  dashboard: ['ADMIN', 'MANAGER'],
  garcom: ['ADMIN', 'MANAGER', 'WAITER'],
  cozinha: ['ADMIN', 'MANAGER', 'KITCHEN'],
  caixa: ['ADMIN', 'MANAGER', 'CASHIER'],
  gestao: ['ADMIN', 'MANAGER'],
  mesas: ['ADMIN', 'MANAGER'],
  configuracoes: ['ADMIN', 'MANAGER'],
}
