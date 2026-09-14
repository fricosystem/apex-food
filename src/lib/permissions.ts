import type { ViewKey } from '@/lib/types'

/**
 * Cargos de gestão com acesso pleno: Desenvolvedor CEO, Administrador e Gerente.
 * Não são filtrados pelas permissões por tela — veem todas as opções do sidebar
 * e acessam inclusive o painel da plataforma.
 */
export const PLATFORM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const

/** Papéis padrão autorizados por tela (sem override do estabelecimento) */
export const DEFAULT_VIEW_ROLES: Record<ViewKey, string[]> = {
  dashboard: ['ADMIN', 'MANAGER'],
  garcom: ['ADMIN', 'MANAGER', 'WAITER'],
  cozinha: ['ADMIN', 'MANAGER', 'KITCHEN'],
  caixa: ['ADMIN', 'MANAGER', 'CASHIER'],
  gestao: ['ADMIN', 'MANAGER'],
  mesas: ['ADMIN', 'MANAGER'],
  relatorio: ['ADMIN', 'MANAGER'],
  administracao: ['ADMIN', 'MANAGER'],
  configuracoes: ['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'],
}

/** Tela do painel do desenvolvedor — aberta aos cargos de gestão (PLATFORM_ROLES) */
export const PLATFORM_VIEW_ROLES: Record<string, string[]> = {
  plataforma: [...PLATFORM_ROLES],
}

/** Cargos que podem ser atribuídos dentro de um estabelecimento */
export const TENANT_ROLES = ['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'] as const

/**
 * Mescla os overrides de permissão do estabelecimento (JSON) sobre os padrões.
 * Chaves presentes no override substituem o padrão; o restante é herdado.
 */
export function resolveViewRoles(permissionsJson: string | null | undefined): Record<string, string[]> {
  const effective: Record<string, string[]> = { ...DEFAULT_VIEW_ROLES, ...PLATFORM_VIEW_ROLES }
  if (!permissionsJson) return effective
  try {
    const parsed = JSON.parse(permissionsJson) as Record<string, string[]>
    if (parsed && typeof parsed === 'object') {
      for (const [key, roles] of Object.entries(parsed)) {
        if (Array.isArray(roles) && key in DEFAULT_VIEW_ROLES) {
          effective[key] = roles.filter((r) => typeof r === 'string')
        }
      }
    }
  } catch {
    // JSON inválido → usa padrões
  }
  return effective
}

/** Indica se o estabelecimento possui overrides customizados de permissão */
export function hasPermissionOverrides(permissionsJson: string | null | undefined): boolean {
  if (!permissionsJson) return false
  try {
    const parsed = JSON.parse(permissionsJson) as Record<string, unknown>
    return !!parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0
  } catch {
    return false
  }
}
