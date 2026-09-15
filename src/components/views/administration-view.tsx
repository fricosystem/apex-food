'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Package, Users, UtensilsCrossed, SlidersHorizontal,
  Loader2, Image as ImageIcon, Clock, ShieldCheck, Search, KeyRound, Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { api, apiPost, apiPatch, apiDelete } from '@/lib/fetcher'
import { currency, SECTOR_LABELS, ROLE_LABELS, PRODUCT_KIND_LABELS } from '@/lib/types'
import type { ProductKind } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'
import { SuffixedEmailField, withApexSuffix } from '@/components/email-field'

type Category = { id: string; name: string; sector: string; icon: string; sortOrder: number; active: boolean }
type Product = {
  id: string; name: string; description: string; emoji: string; image: string | null
  price: number; prepTime: number; kind: ProductKind; active: boolean; categoryId: string
  category: Category
}
type UserRow = { id: string; name: string; email: string; role: string; status: string; active: boolean; activeLoad: number | null }

const STATUS_LABELS: Record<string, string> = { ONLINE: 'Online', BUSY: 'Ocupado', OFFLINE: 'Offline' }

/** Rótulos das áreas para a matriz de permissões (espelha NAV_ITEMS sem importar o app-shell) */
const AREA_LABELS: Record<string, string> = {
  dashboard: 'Dashboard analítico',
  garcom: 'Tela do garçom',
  cozinha: 'Cozinha (fila de preparo)',
  caixa: 'Caixa e pagamentos',
  gestao: 'Gestão (produtos, equipe, metas)',
  mesas: 'Mesas e QR Codes',
  relatorio: 'Relatório Geral',
  administracao: 'Administração (funcionários, gestão geral, catálogo)',
  configuracoes: 'Configurações e notificações',
  plataforma: 'Painel da plataforma (estabelecimentos, planos e cobranças)',
}

/** Cargos atribuíveis dentro de um estabelecimento (DESENVOLVEDOR é exclusivo da plataforma) */
const TENANT_ROLE_ENTRIES = Object.entries(ROLE_LABELS).filter(([k]) => k !== 'DESENVOLVEDOR')

/** Todos os acessos do sistema — inclui o Desenvolvedor CEO (dono da plataforma) */
const ALL_ROLE_ENTRIES = Object.entries(ROLE_LABELS)

export function AdministrationView({ user }: { user: SessionUser }) {
  return (
    <Tabs defaultValue="funcionarios" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60">
        <TabsTrigger value="funcionarios" className="gap-1.5"><Users className="h-4 w-4" /> Funcionários</TabsTrigger>
        <TabsTrigger value="geral" className="gap-1.5"><Building2 className="h-4 w-4" /> Gestão geral</TabsTrigger>
        <TabsTrigger value="produtos" className="gap-1.5"><Package className="h-4 w-4" /> Produtos</TabsTrigger>
        <TabsTrigger value="refeicoes" className="gap-1.5"><UtensilsCrossed className="h-4 w-4" /> Refeições</TabsTrigger>
      </TabsList>

      <TabsContent value="funcionarios"><StaffTab user={user} /></TabsContent>
      <TabsContent value="geral"><GeneralTab /></TabsContent>
      <TabsContent value="produtos"><CatalogTab key="produtos" kind="PRODUCT" /></TabsContent>
      <TabsContent value="refeicoes"><CatalogTab key="refeicoes" kind="MEAL" /></TabsContent>
    </Tabs>
  )
}

/* ==================== FUNCIONÁRIOS ==================== */
function StaffTab({ user }: { user: SessionUser }) {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [removing, setRemoving] = useState<UserRow | null>(null)

  const { data, isLoading } = useQuery<{ users: UserRow[] }>({ queryKey: ['users'], queryFn: () => api('/api/users') })
  const users = data?.users ?? []
  const activeCount = users.filter((u) => u.active).length

  const toggle = useMutation({
    mutationFn: (u: UserRow) => apiPatch(`/api/users/${u.id}`, { active: !u.active }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Status do funcionário atualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/users/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Funcionário removido (ou desativado, se possui histórico de comandas)')
      setRemoving(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => apiPatch(`/api/users/${id}`, { role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Cargo e permissões atualizados')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {users.length} funcionário(s) · {activeCount} ativo(s) · o cargo define as permissões de acesso
        </p>
        <Button onClick={() => setCreating(true)} className="apex-gradient text-white shrink-0">
          <Plus className="h-4 w-4" /> Novo funcionário
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
          {/* Lista de funcionários */}
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-3.5">
                    <div className={cn('h-9 w-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0', u.active ? 'apex-gradient' : 'bg-muted text-muted-foreground')}>
                      {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                        <span className="truncate">{u.name}</span>
                        {!u.active && <Badge variant="outline" className="text-[9px] shrink-0">inativo</Badge>}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{u.email}</p>
                      {u.activeLoad !== null && (
                        <Badge variant="outline" className="md:hidden text-[9px] mt-1">{u.activeLoad} comanda(s) ativa(s)</Badge>
                      )}
                    </div>
                    {u.activeLoad !== null && (
                      <Badge variant="outline" className="hidden md:inline-flex text-[10px] shrink-0">{u.activeLoad} comanda(s)</Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        'hidden sm:inline-flex text-[10px] shrink-0',
                        u.status === 'ONLINE' && 'text-emerald-600 dark:text-emerald-400',
                        u.status === 'BUSY' && 'text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {STATUS_LABELS[u.status] ?? u.status}
                    </Badge>
                    {u.role === 'DESENVOLVEDOR' ? (
                      <Badge variant="outline" className="w-[128px] justify-center text-[10px] shrink-0 border-primary/40 text-primary">
                        {ROLE_LABELS.DESENVOLVEDOR}
                      </Badge>
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={(v) => changeRole.mutate({ id: u.id, role: v })}
                        disabled={changeRole.isPending}
                      >
                        <SelectTrigger className="w-[128px] h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TENANT_ROLE_ENTRIES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {u.role === 'DESENVOLVEDOR' ? (
                      // Conta do dono da plataforma: não é gerenciável por esta tela (nem pelo
                      // próprio) — a API bloqueia qualquer PATCH/DELETE sobre ela de propósito.
                      <div className="w-[68px] shrink-0" />
                    ) : (
                      <>
                        <Switch checked={u.active} onCheckedChange={() => toggle.mutate(u)} aria-label="Ativar funcionário" />
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditing(u)} aria-label={`Editar ${u.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {(user.role === 'ADMIN' || user.role === 'DESENVOLVEDOR') && u.id !== user.id && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setRemoving(u)} aria-label={`Excluir ${u.name}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Matriz de permissões por cargo */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Permissões por cargo</p>
              </div>
              <p className="text-[11px] text-muted-foreground">Áreas que cada cargo acessa no sistema. Desenvolvedor CEO tem acesso total à plataforma; Administrador e Gerente têm acesso completo às telas do estabelecimento</p>
              <div className="space-y-2.5">
                {ALL_ROLE_ENTRIES.map(([role, roleLabel]) => {
                  const areas = role === 'DESENVOLVEDOR'
                    ? ['Todas as áreas do sistema — plataforma e restaurante, sem restrições']
                    : Object.entries(user.permissions).filter(([, roles]) => roles.includes(role)).map(([key]) => AREA_LABELS[key] ?? key)
                  return (
                    <div key={role} className={cn('rounded-lg border p-2.5', role === 'DESENVOLVEDOR' && 'border-dashed border-primary/40 bg-primary/5')}>
                      <Badge variant="outline" className={cn('text-[10px] mb-1.5', role === 'DESENVOLVEDOR' && 'border-primary/40 text-primary')}>{roleLabel}</Badge>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{areas.length > 0 ? areas.join(' · ') : 'Sem acessos configurados'}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <UserDialog open={creating} onClose={() => setCreating(false)} />
      {editing && (
        <EditUserDialog user={editing} onClose={() => setEditing(null)} />
      )}

      {/* Confirmação de exclusão */}
      <Dialog open={!!removing} onOpenChange={(v) => !v && setRemoving(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir funcionário</DialogTitle>
            <DialogDescription>
              Remover {removing?.name}? Se houver histórico de comandas, o acesso será apenas desativado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => removing && remove.mutate(removing.id)} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ==================== DIÁLOGOS DE FUNCIONÁRIO ==================== */
function UserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'WAITER' })

  const save = useMutation({
    mutationFn: () => apiPost('/api/users', { ...form, email: withApexSuffix(form.email) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Funcionário cadastrado')
      onClose()
      setForm({ name: '', email: '', password: '', role: 'WAITER' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <SuffixedEmailField value={form.email} onChange={(local) => setForm({ ...form, email: local })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Senha inicial</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TENANT_ROLE_ENTRIES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full apex-gradient text-white" onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.email || form.password.length < 4}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const qc = useQueryClient()
  // Montado condicionalmente (só existe enquanto editing != null): estado inicial já é o do usuário
  const [form, setForm] = useState({ name: user.name, role: user.role, status: user.status, password: '' })

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = { name: form.name, role: form.role, status: form.status }
      if (form.password) payload.password = form.password
      return apiPatch(`/api/users/${user.id}`, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Funcionário atualizado')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar funcionário</DialogTitle>
          <DialogDescription>{user.email} · o e-mail de acesso não pode ser alterado</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              {form.role === 'DESENVOLVEDOR' ? (
                <div className="h-9 flex items-center px-3 rounded-md border text-sm text-primary">{ROLE_LABELS.DESENVOLVEDOR}</div>
              ) : (
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TENANT_ROLE_ENTRIES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Nova senha (opcional)</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 4 caracteres" />
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full apex-gradient text-white" onClick={() => save.mutate()} disabled={save.isPending || !form.name || (form.password.length > 0 && form.password.length < 4)}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ==================== GESTÃO GERAL ==================== */
const EST_TYPES = [
  { key: 'RESTAURANTE', label: 'Restaurante', icon: '🍽️' },
  { key: 'PIZZARIA', label: 'Pizzaria', icon: '🍕' },
  { key: 'HAMBURGUERIA', label: 'Hamburgueria', icon: '🍔' },
  { key: 'CHURRASCARIA', label: 'Churrascaria', icon: '🥩' },
]

function GeneralTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<{ settings: Record<string, string> }>({ queryKey: ['settings'], queryFn: () => api('/api/settings') })
  const s = data?.settings ?? {}

  const [form, setForm] = useState({ name: '', type: 'RESTAURANTE', logo: '🍴' })
  const [loaded, setLoaded] = useState(false)
  // Recarga no render (padrão das outras views): trava o form com os dados carregados uma única vez
  if (!loaded && s.establishmentName !== undefined) {
    setLoaded(true)
    setForm({ name: s.establishmentName ?? '', type: s.establishmentType ?? 'RESTAURANTE', logo: s.establishmentLogo ?? '🍴' })
  }

  const saveSettings = useMutation({
    mutationFn: (payload: Record<string, string>) => apiPatch('/api/settings', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Configuração salva')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="grid gap-4 md:grid-cols-2 items-start">
      {/* Estabelecimento */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="font-semibold text-sm">Estabelecimento</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Identidade exibida no sistema, no cardápio QR e nas comandas</p>
          </div>
          <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value.slice(0, 2) })} className="text-center text-lg" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: APEX FOOD" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de operação</Label>
            <div className="grid grid-cols-2 gap-2">
              {EST_TYPES.map((t) => {
                const active = form.type === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setForm({ ...form, type: t.key })}
                    className={cn(
                      'rounded-lg border p-3 flex items-center gap-2 text-sm font-medium transition-all min-w-0',
                      active ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40'
                    )}
                  >
                    <span className="text-base shrink-0">{t.icon}</span>
                    <span className="truncate">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <Button
            className="w-full apex-gradient text-white font-semibold"
            onClick={() => saveSettings.mutate({ establishmentName: form.name, establishmentType: form.type, establishmentLogo: form.logo })}
            disabled={saveSettings.isPending || !form.name}
          >
            {saveSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar estabelecimento
          </Button>
        </CardContent>
      </Card>

      {/* Operação */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <p className="font-semibold text-sm">Operação</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Distribuição de comandas e tempos de alerta</p>
            </div>
            <div className="space-y-1.5">
              <Label>Distribuição de comandas</Label>
              <Select value={s.distributionRule ?? 'least_active'} onValueChange={(v) => saveSettings.mutate({ distributionRule: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="least_active">Menor carga ativa (comandas abertas)</SelectItem>
                  <SelectItem value="least_load">Menor demanda acumulada do dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Confirmação (min)</Label>
                <Input defaultValue={s.confirmTimeout ?? '5'} onBlur={(e) => saveSettings.mutate({ confirmTimeout: e.target.value.replace(/\D/g, '') || '5' })} inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label>Alerta (min)</Label>
                <Input defaultValue={s.alertThreshold ?? '20'} onBlur={(e) => saveSettings.mutate({ alertThreshold: e.target.value.replace(/\D/g, '') || '20' })} inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label>Meta padrão</Label>
                <Input defaultValue={s.defaultGoal ?? '50'} onBlur={(e) => saveSettings.mutate({ defaultGoal: e.target.value.replace(/\D/g, '') || '50' })} inputMode="numeric" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-semibold text-sm">Métodos de pagamento aceitos</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Exibidos no caixa durante o fechamento</p>
            </div>
            {[
              { key: 'acceptCredit', label: 'Cartão de Crédito' },
              { key: 'acceptDebit', label: 'Cartão de Débito' },
              { key: 'acceptPix', label: 'PIX' },
              { key: 'acceptCash', label: 'Dinheiro Físico' },
            ].map((m) => (
              <div key={m.key} className="flex items-center justify-between rounded-lg border p-2.5">
                <span className="text-sm">{m.label}</span>
                <Switch checked={(s[m.key] ?? 'true') === 'true'} onCheckedChange={(v) => saveSettings.mutate({ [m.key]: String(v) })} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ==================== CATÁLOGO: PRODUTOS & REFEIÇÕES ==================== */
function CatalogTab({ kind }: { kind: ProductKind }) {
  const qc = useQueryClient()
  const isMeal = kind === 'MEAL'
  const noun = isMeal ? 'refeição' : 'produto'
  const nounPlural = isMeal ? 'refeições' : 'produtos'

  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['products', 'admin', kind],
    queryFn: () => api(`/api/products?all=1&kind=${kind}`),
  })
  const items = (data?.products ?? []).filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const activeCount = (data?.products ?? []).filter((p) => p.active).length

  const toggle = useMutation({
    mutationFn: (p: Product) => apiPatch(`/api/products/${p.id}`, { active: !p.active }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Item atualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/products/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Item removido (ou desativado, se já possui histórico de comandas)')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {items.length} {nounPlural} · {activeCount} ativo(s) · o tempo de preparo alimenta a cozinha e o cliente
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Buscar ${noun}…`} className="h-9 w-44 pl-8 text-sm" />
          </div>
          <Button onClick={() => setCreating(true)} className="apex-gradient text-white shrink-0">
            <Plus className="h-4 w-4" /> {isMeal ? 'Nova refeição' : 'Novo produto'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          {search ? `Nenhum ${noun} encontrado para "${search}".` : `Nenhuma ${noun} cadastrada ainda.`}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id} className={cn(!p.active && 'opacity-55')}>
              <CardContent className="p-4 flex gap-3">
                {p.image && (
                  <img src={p.image} alt={p.name} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-tight truncate">{p.name}</p>
                    <Switch checked={p.active} onCheckedChange={() => toggle.mutate(p)} aria-label="Ativar item" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{p.category.icon} {p.category.name} · {SECTOR_LABELS[p.category.sector] ?? p.category.sector}</p>
                  <p className="text-sm font-bold text-primary mt-1">{currency(p.price)}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px] gap-1"><Clock className="h-3 w-3" /> {p.prepTime} min</Badge>
                    <button className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => setEditing(p)}>
                      <Pencil className="h-3 w-3" /> editar
                    </button>
                    <button className="text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1" onClick={() => remove.mutate(p.id)}>
                      <Trash2 className="h-3 w-3" /> excluir
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CatalogDialog open={creating || !!editing} item={editing} onClose={() => { setCreating(false); setEditing(null) }} />
    </div>
  )
}

function CatalogDialog({ open, item, onClose }: { open: boolean; item: Product | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery<{ categories: Category[] }>({
    queryKey: ['categories', 'all'],
    queryFn: () => api('/api/categories?all=1'),
    enabled: open,
  })

  const [form, setForm] = useState({ name: '', description: '', price: '', prepTime: '15', emoji: '🍽️', image: '', categoryId: '', kind: 'MEAL' as ProductKind })

  // Recarga no render (padrão das outras views): monta o form quando abre para um item
  const [loadedFor, setLoadedFor] = useState<Product | null>(null)
  if (open && item && loadedFor !== item) {
    setLoadedFor(item)
    setForm({
      name: item.name, description: item.description, price: String(item.price),
      prepTime: String(item.prepTime), emoji: item.emoji, image: item.image ?? '',
      categoryId: item.categoryId, kind: item.kind,
    })
  }
  if (open && !item && loadedFor !== null) {
    setLoadedFor(null)
    setForm({ name: '', description: '', price: '', prepTime: '15', emoji: '🍽️', image: '', categoryId: '', kind: 'MEAL' })
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price.replace(',', '.')),
        prepTime: Number(form.prepTime),
        emoji: form.emoji || '🍽️',
        image: form.image || null,
        categoryId: form.categoryId,
        kind: form.kind,
      }
      return item ? apiPatch(`/api/products/${item.id}`, payload) : apiPost('/api/products', payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(item ? 'Item atualizado' : 'Item criado')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar item' : form.kind === 'MEAL' ? 'Nova refeição' : 'Novo produto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as ProductKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_KIND_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(data?.categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pizza Margherita" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[60px] text-sm" placeholder="Ingredientes e diferenciais" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="49.90" inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label>Preparo (min)</Label>
              <Input value={form.prepTime} onChange={(e) => setForm({ ...form, prepTime: e.target.value.replace(/\D/g, '') })} inputMode="numeric" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> URL da imagem (opcional)</Label>
            <Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" />
          </div>
        </div>
        <DialogFooter>
          <Button className="w-full apex-gradient text-white font-semibold" onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.categoryId}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

