'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Building2, Sparkles, AlertTriangle, Wallet, Search, Plus, Pencil,
  CreditCard, ShieldCheck, Trash2, MoreHorizontal, Loader2, Store,
  Users, ClipboardList, UtensilsCrossed, CalendarClock, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, apiPost, apiPatch, apiDelete } from '@/lib/fetcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { currency } from '@/lib/types'
import { PLAN_LABELS, BILLING_STATUS_LABELS } from '@/lib/types'
import { DEFAULT_VIEW_ROLES, hasPermissionOverrides } from '@/lib/permissions'
import type { ViewKey } from '@/lib/types'

type EstablishmentRow = {
  id: string
  name: string
  cnpj: string
  logo: string
  type: string
  phone: string
  address: string
  active: boolean
  plan: string
  billingStatus: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  lastPaymentAt: string | null
  notes: string
  permissions: string
  createdAt: string
  monthlyPrice: number
  counts: { users: number; orders: number; products: number; tables: number }
}

type PlanRow = {
  id: string
  key: string
  name: string
  price: number
  duration: number
  features: string
  sortOrder: number
  subscribers?: number
}

type PlatformData = {
  establishments: EstablishmentRow[]
  kpis: { total: number; active: number; paid: number; trialing: number; overdue: number; suspended: number; mrr: number }
  plans: PlanRow[]
}

const TENANT_ROLE_LIST = ['ADMIN', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'] as const
const TENANT_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', MANAGER: 'Gerente', WAITER: 'Garçom', KITCHEN: 'Cozinha', CASHIER: 'Caixa',
}
const MATRIX_VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'garcom', label: 'Garçom' },
  { key: 'cozinha', label: 'Cozinha' },
  { key: 'caixa', label: 'Caixa' },
  { key: 'gestao', label: 'Gestão' },
  { key: 'mesas', label: 'Mesas & QR' },
  { key: 'relatorio', label: 'Relatório Geral' },
  { key: 'administracao', label: 'Administração' },
  { key: 'configuracoes', label: 'Configurações' },
]

const day = 86_400_000

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function daysFromNow(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.ceil((new Date(iso).getTime() - Date.now()) / day)
}

/** Prazo amigável por status de cobrança */
function deadlineLabel(e: EstablishmentRow): { text: string; tone: 'ok' | 'warn' | 'bad' | 'muted' } {
  if (e.billingStatus === 'CANCELED') return { text: 'Cancelado', tone: 'muted' }
  if (e.billingStatus === 'TRIAL') {
    const d = daysFromNow(e.trialEndsAt)
    if (!e.trialEndsAt) return { text: 'Sem prazo de teste', tone: 'muted' }
    if (d > 0) return { text: `Teste até ${fmtDate(e.trialEndsAt)} · ${d}d`, tone: d <= 3 ? 'warn' : 'ok' }
    return { text: `Teste expirou em ${fmtDate(e.trialEndsAt)}`, tone: 'bad' }
  }
  const d = daysFromNow(e.currentPeriodEnd)
  if (!e.currentPeriodEnd) return { text: 'Sem vencimento', tone: 'muted' }
  if (d > 0) return { text: `Vence ${fmtDate(e.currentPeriodEnd)} · ${d}d`, tone: d <= 5 ? 'warn' : 'ok' }
  return { text: `Venceu ${fmtDate(e.currentPeriodEnd)}`, tone: 'bad' }
}

function BillingBadge({ status }: { status: string }) {
  const cls =
    status === 'PAID'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : status === 'TRIAL'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : status === 'OVERDUE'
          ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
          : 'border-zinc-500/40 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400'
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold', cls)}>
      {BILLING_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <Badge variant="outline" className="text-[10px] font-semibold border-primary/40 bg-primary/10 text-primary">
      {PLAN_LABELS[plan] ?? plan}
    </Badge>
  )
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** ---------- Diálogo: dados cadastrais ---------- */
function EditDataDialog({ est, onClose }: { est: EstablishmentRow | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', cnpj: '', logo: '', phone: '', address: '', type: 'RESTAURANTE' })
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (est && loadedFor !== est.id) {
    setLoadedFor(est.id)
    setForm({ name: est.name, cnpj: est.cnpj, logo: est.logo, phone: est.phone, address: est.address, type: est.type })
  }

  const save = useMutation({
    mutationFn: () => apiPatch(`/api/platform/establishments/${est!.id}`, form),
    onSuccess: () => {
      toast.success('Dados do estabelecimento atualizados')
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={!!est} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4 text-primary" /> Editar estabelecimento</DialogTitle>
          <DialogDescription>Dados cadastrais exibidos no sistema do restaurante.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-[1fr_88px] gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} className="text-center" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="RESTAURANTE" />
            </div>
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** ---------- Diálogo: plano e cobrança ---------- */
function BillingDialog({ est, plans, onClose }: { est: EstablishmentRow | null; plans: PlanRow[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ plan: 'TRIAL', billingStatus: 'TRIAL', trialEndsAt: '', currentPeriodEnd: '', notes: '' })
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (est && loadedFor !== est.id) {
    setLoadedFor(est.id)
    setForm({
      plan: est.plan,
      billingStatus: est.billingStatus,
      trialEndsAt: toInputDate(est.trialEndsAt),
      currentPeriodEnd: toInputDate(est.currentPeriodEnd),
      notes: est.notes,
    })
  }

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPatch(`/api/platform/establishments/${est!.id}`, payload),
    onSuccess: (_d, payload) => {
      toast.success(
        payload.markPaidNow
          ? 'Pagamento registrado — período renovado'
          : payload.extendDays
            ? 'Vencimento estendido'
            : 'Cobrança atualizada'
      )
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={!!est} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Plano e cobrança</DialogTitle>
          <DialogDescription>{est?.name} · último pagamento: {fmtDate(est?.lastPaymentAt)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name} {p.price > 0 ? `· ${currency(p.price)}/mês` : '· grátis'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status da cobrança</Label>
              <Select value={form.billingStatus} onValueChange={(v) => setForm({ ...form, billingStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BILLING_STATUS_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-amber-500" /> Teste até</Label>
              <Input type="date" value={form.trialEndsAt} onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-primary" /> Vencimento</Label>
              <Input type="date" value={form.currentPeriodEnd} onChange={(e) => setForm({ ...form, currentPeriodEnd: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas internas</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: negociação de renovação, contato financeiro…" />
          </div>
          <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/40 p-2.5">
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              disabled={save.isPending}
              onClick={() => save.mutate({ plan: form.plan, markPaidNow: true })}
            >
              <Wallet className="h-3.5 w-3.5" /> Registrar pagamento agora
            </Button>
            <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ extendDays: 30 })}>
              <RefreshCw className="h-3.5 w-3.5" /> Estender 30 dias
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() =>
              save.mutate({
                plan: form.plan,
                billingStatus: form.billingStatus,
                trialEndsAt: form.trialEndsAt || null,
                currentPeriodEnd: form.currentPeriodEnd || null,
                notes: form.notes,
              })
            }
            disabled={save.isPending}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** ---------- Diálogo: permissões por tela × cargo ---------- */
function PermissionsDialog({ est, onClose }: { est: EstablishmentRow | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [matrix, setMatrix] = useState<Record<string, string[]>>({})
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (est && loadedFor !== est.id) {
    setLoadedFor(est.id)
    // Efetivo = padrão + overrides salvos
    let overrides: Record<string, string[]> = {}
    try { overrides = JSON.parse(est.permissions || '{}') } catch { /* ignora */ }
    const effective: Record<string, string[]> = {}
    for (const v of MATRIX_VIEWS) {
      effective[v.key] = overrides[v.key] ?? DEFAULT_VIEW_ROLES[v.key]
    }
    setMatrix(effective)
  }

  const save = useMutation({
    mutationFn: (permissions: Record<string, string[]>) =>
      apiPatch(`/api/platform/establishments/${est!.id}`, { permissions }),
    onSuccess: () => {
      toast.success('Permissões atualizadas — sessões dos usuários aplicam no próximo carregamento')
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggle = (view: string, role: string) => {
    setMatrix((m) => {
      const cur = m[view] ?? []
      return { ...m, [view]: cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role] }
    })
  }

  const customized = est ? hasPermissionOverrides(est.permissions) : false

  return (
    <Dialog open={!!est} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Permissões · {est?.name}
            {customized && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Customizado</Badge>}
          </DialogTitle>
          <DialogDescription>
            Define quais cargos acessam cada tela deste estabelecimento. Deixe igual ao padrão para herdar a configuração base.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto max-h-[52vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-1">Tela</TableHead>
                {TENANT_ROLE_LIST.map((r) => (
                  <TableHead key={r} className="text-center text-[11px]">{TENANT_ROLE_LABELS[r]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MATRIX_VIEWS.map((v) => (
                <TableRow key={v.key}>
                  <TableCell className="pl-1 font-medium text-xs">{v.label}</TableCell>
                  {TENANT_ROLE_LIST.map((r) => (
                    <TableCell key={r} className="text-center">
                      <Checkbox
                        checked={(matrix[v.key] ?? []).includes(r)}
                        onCheckedChange={() => toggle(v.key, r)}
                        aria-label={`${v.label} para ${TENANT_ROLE_LABELS[r]}`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const defaults: Record<string, string[]> = {}
              for (const v of MATRIX_VIEWS) defaults[v.key] = [...DEFAULT_VIEW_ROLES[v.key]]
              setMatrix(defaults)
              save.mutate({}) // limpa overrides → volta a herdar o padrão
            }}
            disabled={save.isPending}
          >
            Restaurar padrão
          </Button>
          <Button onClick={() => save.mutate(matrix)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar permissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** ---------- Diálogo: novo estabelecimento ---------- */
function CreateDialog({ open, plans, onClose }: { open: boolean; plans: PlanRow[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', cnpj: '', logo: '🍴', plan: 'TRIAL', trialDays: 14 })

  const create = useMutation({
    mutationFn: () => apiPost('/api/platform/establishments', { ...form, trialDays: Number(form.trialDays) || 14 }),
    onSuccess: () => {
      toast.success('Estabelecimento criado')
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
      setForm({ name: '', cnpj: '', logo: '🍴', plan: 'TRIAL', trialDays: 14 })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Novo estabelecimento</DialogTitle>
          <DialogDescription>Criado manualmente pela equipe APEX. O primeiro usuário pode ser cadastrado pelo próprio restaurante.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-[1fr_72px] gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome comercial" />
            </div>
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} className="text-center" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CNPJ (opcional)</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Plano inicial</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.plan === 'TRIAL' && (
            <div className="space-y-1.5">
              <Label>Dias de teste</Label>
              <Input type="number" min={1} max={90} value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || form.name.trim().length < 2}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar estabelecimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** ---------- Diálogo: excluir ---------- */
function DeleteDialog({ est, onClose }: { est: EstablishmentRow | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const del = useMutation({
    mutationFn: () => apiDelete(`/api/platform/establishments/${est!.id}`),
    onSuccess: () => {
      toast.success(`Estabelecimento "${est?.name}" removido da plataforma`)
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Dialog open={!!est} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> Remover estabelecimento
          </DialogTitle>
          <DialogDescription>
            Isso exclui <span className="font-semibold text-foreground">{est?.name}</span> e todos os dados vinculados:
            funcionários, comandas, produtos, mesas e configurações. A ação é irreversível.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
            {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir permanentemente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** ---------- Tela principal: Plataforma ---------- */
export function PlatformView() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [tab, setTab] = useState('establishments')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EstablishmentRow | null>(null)
  const [billingTarget, setBillingTarget] = useState<EstablishmentRow | null>(null)
  const [permTarget, setPermTarget] = useState<EstablishmentRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EstablishmentRow | null>(null)
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan: PlanRow | null }>({ open: false, plan: null })

  const { data, isLoading } = useQuery<PlatformData>({
    queryKey: ['platform'],
    queryFn: () => api<PlatformData>('/api/platform/establishments'),
    refetchInterval: 15_000,
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => apiPatch(`/api/platform/establishments/${id}`, { active }),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? 'Estabelecimento reativado' : 'Estabelecimento suspenso — logins bloqueados')
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = useMemo(() => {
    const list = data?.establishments ?? []
    const q = search.trim().toLowerCase()
    return list.filter((e) => {
      const matchQ = !q || e.name.toLowerCase().includes(q) || e.cnpj.toLowerCase().includes(q)
      const matchS =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && e.active) ||
        (statusFilter === 'SUSPENDED' && !e.active) ||
        e.billingStatus === statusFilter
      return matchQ && matchS
    })
  }, [data, search, statusFilter])

  const kpis = data?.kpis
  const plans = data?.plans ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Plataforma
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão dos estabelecimentos, planos e cobranças do APEX FOOD · painel do desenvolvedor
          </p>
        </div>
        <Button className="apex-gradient text-white hover:opacity-90" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo estabelecimento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { icon: Building2, label: 'Restaurantes ativos', value: kpis ? `${kpis.active}` : '—', hint: kpis ? `${kpis.total} no total · ${kpis.suspended} suspensos` : '', tone: 'text-primary' },
          { icon: Sparkles, label: 'Em teste (trial)', value: kpis ? `${kpis.trialing}` : '—', hint: 'período gratuito em andamento', tone: 'text-amber-500' },
          { icon: AlertTriangle, label: 'Vencidos / inadimplentes', value: kpis ? `${kpis.overdue}` : '—', hint: 'requerem cobrança', tone: 'text-red-500' },
          { icon: Wallet, label: 'Receita recorrente', value: kpis ? currency(kpis.mrr) : '—', hint: kpis ? `${kpis.paid} assinantes pagantes` : '', tone: 'text-emerald-500' },
        ].map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className={cn('h-4 w-4', k.tone)} />
                  <p className="text-xs font-medium">{k.label}</p>
                </div>
                <p className="text-2xl font-bold tracking-tight mt-1.5">{k.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{k.hint}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="establishments"><Store className="h-3.5 w-3.5 mr-1.5" /> Estabelecimentos</TabsTrigger>
          <TabsTrigger value="plans"><Wallet className="h-3.5 w-3.5 mr-1.5" /> Planos</TabsTrigger>
        </TabsList>

        {/* ---------- Estabelecimentos ---------- */}
        <TabsContent value="establishments" className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou CNPJ…" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                <SelectItem value="ACTIVE">Somente ativos</SelectItem>
                <SelectItem value="SUSPENDED">Suspensos</SelectItem>
                <SelectItem value="PAID">Pagos</SelectItem>
                <SelectItem value="TRIAL">Em teste</SelectItem>
                <SelectItem value="OVERDUE">Vencidos</SelectItem>
                <SelectItem value="CANCELED">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-14 flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando estabelecimentos…
                </div>
              ) : rows.length === 0 ? (
                <p className="py-14 text-center text-sm text-muted-foreground">Nenhum estabelecimento encontrado para o filtro atual.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Estabelecimento</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Cobrança</TableHead>
                      <TableHead className="text-right">Equipe</TableHead>
                      <TableHead className="text-right">Comandas</TableHead>
                      <TableHead className="text-right">Catálogo</TableHead>
                      <TableHead className="text-center">Ativo</TableHead>
                      <TableHead className="pr-4 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((e) => {
                      const dl = deadlineLabel(e)
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-3">
                              <span className="h-9 w-9 rounded-lg border bg-muted/40 flex items-center justify-center text-lg shrink-0" aria-hidden>{e.logo}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight truncate max-w-56">{e.name}</p>
                                <p className="text-[11px] text-muted-foreground">{e.cnpj || 'sem CNPJ'} · desde {fmtDate(e.createdAt)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <PlanBadge plan={e.plan} />
                            {e.monthlyPrice > 0 && <p className="text-[11px] text-muted-foreground mt-1">{currency(e.monthlyPrice)}/mês</p>}
                          </TableCell>
                          <TableCell>
                            <BillingBadge status={e.billingStatus} />
                            <p className={cn(
                              'text-[11px] mt-1',
                              dl.tone === 'ok' && 'text-emerald-600 dark:text-emerald-400',
                              dl.tone === 'warn' && 'text-amber-600 dark:text-amber-400',
                              dl.tone === 'bad' && 'text-red-600 dark:text-red-400',
                              dl.tone === 'muted' && 'text-muted-foreground',
                            )}>{dl.text}</p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="inline-flex items-center gap-1 text-sm"><Users className="h-3.5 w-3.5 text-muted-foreground" /> {e.counts.users}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="inline-flex items-center gap-1 text-sm"><ClipboardList className="h-3.5 w-3.5 text-muted-foreground" /> {e.counts.orders}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="inline-flex items-center gap-1 text-sm"><UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" /> {e.counts.products}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={e.active}
                              onCheckedChange={(v) => toggleActive.mutate({ id: e.id, active: v })}
                              disabled={toggleActive.isPending}
                              aria-label={`Ativar ${e.name}`}
                            />
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações para ${e.name}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => setEditTarget(e)}>
                                  <Pencil className="h-4 w-4" /> Editar dados
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setBillingTarget(e)}>
                                  <CreditCard className="h-4 w-4" /> Plano e cobrança
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setPermTarget(e)}>
                                  <ShieldCheck className="h-4 w-4" /> Permissões
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteTarget(e)} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                                  <Trash2 className="h-4 w-4" /> Excluir estabelecimento
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Planos ---------- */}
        <TabsContent value="plans" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {plans.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <CardContent className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{p.key}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                      {p.subscribers ?? 0} assinante(s)
                    </Badge>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold tracking-tight">
                    {p.price > 0 ? currency(p.price) : 'Grátis'}
                    {p.price > 0 && <span className="text-xs font-medium text-muted-foreground">/{p.duration} dias</span>}
                  </p>
                  <ul className="mt-3 space-y-1.5 flex-1">
                    {p.features.split('\n').filter(Boolean).map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" aria-hidden /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setPlanDialog({ open: true, plan: p })}>
                    <Pencil className="h-3.5 w-3.5" /> Editar plano
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogos */}
      <CreateDialog open={createOpen} plans={plans} onClose={() => setCreateOpen(false)} />
      <EditDataDialog est={editTarget} onClose={() => setEditTarget(null)} />
      <BillingDialog est={billingTarget} plans={plans} onClose={() => setBillingTarget(null)} />
      <PermissionsDialog est={permTarget} onClose={() => setPermTarget(null)} />
      <DeleteDialog est={deleteTarget} onClose={() => setDeleteTarget(null)} />
      <PlanEditDialog
        target={planDialog}
        onClose={() => setPlanDialog({ open: false, plan: null })}
      />
    </div>
  )
}

/** ---------- Diálogo: criar/editar plano ---------- */
function PlanEditDialog({ target, onClose }: { target: { open: boolean; plan: PlanRow | null }; onClose: () => void }) {
  const queryClient = useQueryClient()
  const isNew = !target.plan
  const [form, setForm] = useState({ key: '', name: '', price: 0, duration: 30, features: '', sortOrder: 99 })
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const p = target.plan
  if (target.open && (p ? p.id : '__new__') !== loadedFor) {
    setLoadedFor(p ? p.id : '__new__')
    setForm({
      key: p?.key ?? '',
      name: p?.name ?? '',
      price: p?.price ?? 0,
      duration: p?.duration ?? 30,
      features: p?.features ?? '',
      sortOrder: p?.sortOrder ?? 99,
    })
  }

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? apiPost('/api/platform/plans', form)
        : apiPatch(`/api/platform/plans/${p!.id}`, { name: form.name, price: Number(form.price), duration: Number(form.duration), features: form.features, sortOrder: Number(form.sortOrder) }),
    onSuccess: () => {
      toast.success(isNew ? 'Plano criado' : 'Plano atualizado')
      void queryClient.invalidateQueries({ queryKey: ['platform'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={target.open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> {isNew ? 'Novo plano' : `Editar plano ${p?.name}`}</DialogTitle>
          <DialogDescription>Planos definem mensalidade, duração do período e recursos exibidos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Chave</Label>
              <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })} disabled={!isNew} placeholder="EX: STARTER" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Duração (d)</Label>
              <Input type="number" min={1} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ordem</Label>
              <Input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Recursos (um por linha)</Label>
            <Textarea rows={4} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder={'Comandas ilimitadas\nRelatórios avançados'} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim() || (isNew && !form.key.trim())}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isNew ? 'Criar plano' : 'Salvar plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
