'use client'

import { Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

/** ---------- E-mail com sufixo fixo @apexfood.com ----------
 * O usuário digita apenas o nome (ex.: bruno.bm3051) e o domínio fixo do sistema
 * aparece como sufixo assim que algo é digitado. Qualquer "@dominio" digitado ou
 * colado é descartado — o único sufixo aceito é o próprio @apexfood.com.
 *
 * Compartilhado entre a tela de autenticação (login/cadastro) e todo cadastro de
 * funcionário (Administração, Gestão) — mesmo comportamento em qualquer lugar do
 * sistema onde se digita um e-mail de acesso.
 */
export function toEmailLocal(raw: string): string {
  return (raw.trim().split('@')[0] ?? '').replace(/\s+/g, '')
}

/** Monta o e-mail completo a partir do que o usuário digitou no campo (parte local) */
export function withApexSuffix(local: string): string {
  return local.trim() ? `${toEmailLocal(local)}@apexfood.com` : ''
}

/** Campo de e-mail APEX: digita-se só o nome; sufixo @apexfood.com fixo (não editável).
 *  <Input> real do sistema dentro de div.relative, ícone Mail absoluto à esquerda,
 *  classes pl-9 h-11 bg-background text-foreground. O sufixo fica absoluto à
 *  direita e o pr-32 é aplicado somente enquanto ele aparece — o texto digitado
 *  nunca invade a área do sufixo.
 */
export function SuffixedEmailField({ id, value, onChange, autoComplete, required, className }: {
  id?: string
  value: string
  onChange: (local: string) => void
  autoComplete?: string
  required?: boolean
  className?: string
}) {
  const hasValue = value.trim() !== ''
  return (
    <div className="relative">
      <Mail className="absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
      <Input
        id={id}
        type="text"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete={autoComplete}
        placeholder="Digite o e-mail"
        required={required}
        className={cn('pl-9 h-11 bg-background text-foreground', hasValue && 'pr-32', className)}
        value={value}
        onChange={(e) => onChange(toEmailLocal(e.target.value))}
      />
      {hasValue && (
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground"
          aria-hidden
        >
          @apexfood.com
        </span>
      )}
    </div>
  )
}
