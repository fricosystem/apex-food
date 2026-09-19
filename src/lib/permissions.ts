import type { ViewKey } from '@/lib/types'

/**
 * Cargo exclusivo do dono da plataforma (Desenvolvedor CEO) — acesso de servidor
 * ao painel da plataforma (`/api/platform/**`). Nenhum outro cargo, nem ADMIN nem
 * MANAGER de um estabelecimento, tem acesso a essas rotas: só existe um jeito de
 * entrar nelas, é sendo DESENVOLVEDOR. Ver também PLATFORM_VIEW_ROLES abaixo.
 */
export const PLATFORM_ROLES = ['DESENVOLVEDOR'] as const

/**
 * Cargos de gestão de estabelecimento com acesso pleno às telas do restaurante
 * (Administrador e Gerente). Não são filtrados pelas permissões por tela — veem
 * todas as opções do sidebar do estabelecimento. NÃO inclui o painel da
 * plataforma: esse é exclusivo de DESENVOLVEDOR (ver PLATFORM_ROLES).
 */
export const MANAGEMENT_ROLES = ['ADMIN', 'MANAGER'] as const

/** Papéis padrão autorizados por tela (sem override do estabelecimento) */
export const DEFAULT_VIEW_ROLES: Record<ViewKey, string[]> = {
  dashboard: ['ADMIN', 'MANAGER'],
  garcom: ['ADMIN', 'MANAGER', 'WAITER'],
  cozinha: ['ADMIN', 'MANAGER', 'KITCHEN'],
  caixa: ['ADMIN', 'MANAGER', 'CASHIER'],
  mesas: ['ADMIN', 'MANAGER'],
  relatorio: ['ADMIN', 'MANAGER'],
  administracao: ['ADMIN', 'MANAGER'],
  configuracoes: ['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'],
}

/**
 * Tela do painel do desenvolvedor — exclusiva de DESENVOLVEDOR. Fica fora de
 * DEFAULT_VIEW_ROLES de propósito: o loop de overrides em resolveViewRoles só
 * aplica overrides para chaves presentes em DEFAULT_VIEW_ROLES, então mesmo um
 * ADMIN com acesso ao painel da plataforma nunca consegue liberar 'plataforma'
 * para si via override de permissões — está hardcoded aqui, sem exceção.
 */
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
