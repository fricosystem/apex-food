'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Package, Users, Target, FolderTree, SlidersHorizontal,
  Loader2, Image as ImageIcon, Clock,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { api, apiPost, apiPatch, apiDelete } from '@/lib/fetcher'
import { currency, SECTOR_LABELS, ROLE_LABELS } from '@/lib/types'
import { SuffixedEmailField, withApexSuffix } from '@/components/email-field'

/** Cargos atribuíveis dentro de um estabelecimento (DESENVOLVEDOR é exclusivo da plataforma) */
const TENANT_ROLE_ENTRIES = Object.entries(ROLE_LABELS).filter(([k]) => k !== 'DESENVOLVEDOR')
import type { SessionUser } from '@/lib/auth'

type Category = { id: string; name: string; sector: string; icon: string; sortOrder: number; active: boolean }
type Product = {
  id: string; name: string; description: string; emoji: string; image: string | null
  price: number; prepTime: number; active: boolean; categoryId: string
  category: Category
}
type UserRow = { id: string; name: string; email: string; role: string; status: string; active: boolean; activeLoad: number | null }
type GoalRow = { id: string; title: string; target: number; month: string; achieved: number; user: { id: string; name: string; role: string } }

export function ManagementView({ user }: { user: SessionUser }) {
  return (
    <Tabs defaultValue="produtos" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60">
        <TabsTrigger value="produtos" className="gap-1.5"><Package className="h-4 w-4" /> Produtos</TabsTrigger>
        <TabsTrigger value="categorias" className="gap-1.5"><FolderTree className="h-4 w-4" /> Categorias</TabsTrigger>
        <TabsTrigger value="equipe" className="gap-1.5"><Users className="h-4 w-4" /> Funcionários</TabsTrigger>
        <TabsTrigger value="metas" className="gap-1.5"><Target className="h-4 w-4" /> Metas</TabsTrigger>
        <TabsTrigger value="operacao" className="gap-1.5"><SlidersHorizontal className="h-4 w-4" /> Operação</TabsTrigger>
      </TabsList>

      <TabsContent value="produtos"><ProductsTab /></TabsContent>
      <TabsContent value="categorias"><CategoriesTab /></TabsContent>
      <TabsContent value="equipe"><UsersTab /></TabsContent>
      <TabsContent value="metas"><GoalsTab /></TabsContent>
      <TabsContent value="operacao"><OperationTab /></TabsContent>
    </Tabs>
  )
}

/* ==================== PRODUTOS ==================== */
function ProductsTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery<{ categories: Array<Category & { products: Product[] }> }>({
    queryKey: ['categories', 'all'],
    queryFn: () => api('/api/categories?all=1'),
  })

  const toggle = useMutation({
    mutationFn: (p: Product) => apiPatch(`/api/products/${p.id}`, { active: !p.active }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Produto atualizado')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/products/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Produto removido (ou desativado, se já possui histórico)')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const allProducts = (data?.categories ?? []).flatMap((c) => c.products)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{allProducts.filter((p) => p.active).length} produtos ativos · o tempo de preparo alimenta a cozinha e o cliente</p>
        <Button onClick={() => setCreating(true)} className="apex-gradient text-white">
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {allProducts.map((p) => (
            <Card key={p.id} className={cn(!p.active && 'opacity-55')}>
              <CardContent className="p-4 flex gap-3">
                {p.image && (
                  <img src={p.image} alt={p.name} className="h-16 w-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-tight truncate">{p.name}</p>
                    <Switch checked={p.active} onCheckedChange={() => toggle.mutate(p)} aria-label="Ativar produto" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{p.category.name}</p>
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

      <ProductDialog open={creating || !!editing} product={editing} onClose={() => { setCreating(false); setEditing(null) }} />
    </div>
  )
}

function ProductDialog({ open, product, onClose }: { open: boolean; product: Product | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useQuery<{ categories: Category[] }>({
    queryKey: ['categories', 'all'],
    queryFn: () => api('/api/categories?all=1'),
    enabled: open,
  })

  const [form, setForm] = useState({ name: '', description: '', price: '', prepTime: '15', emoji: '🍽️', image: '', categoryId: '' })
  const [loadedFor, setLoadedFor] = useState<Product | null>(null)

  if (open && product && loadedFor !== product) {
    setLoadedFor(product)
    setForm({
      name: product.name, description: product.description, price: String(product.price),
      prepTime: String(product.prepTime), emoji: product.emoji, image: product.image ?? '', categoryId: product.categoryId,
    })
  }
  if (open && !product && loadedFor !== null) {
    setLoadedFor(null)
    setForm({ name: '', description: '', price: '', prepTime: '15', emoji: '🍽️', image: '', categoryId: '' })
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
      }
      return product ? apiPatch(`/api/products/${product.id}`, payload) : apiPost('/api/products', payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(product ? 'Produto atualizado' : 'Produto criado')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pizza Margherita" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(data?.categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar produto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ==================== CATEGORIAS ==================== */
function CategoriesTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', sector: 'KITCHEN' })

  const { data, isLoading } = useQuery<{ categories: Array<Category & { products: Product[] }> }>({
    queryKey: ['categories', 'all'],
    queryFn: () => api('/api/categories?all=1'),
  })

  const save = useMutation({
    mutationFn: () => apiPost('/api/categories', form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoria criada')
      setOpen(false)
      setForm({ name: '', sector: 'KITCHEN' })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const toggle = useMutation({
    mutationFn: (c: Category) => apiPatch(`/api/categories/${c.id}`, { active: !c.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Setores direcionam os itens às estações da cozinha</p>
        <Button onClick={() => setOpen(true)} className="apex-gradient text-white"><Plus className="h-4 w-4" /> Nova categoria</Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.categories ?? []).map((c) => (
            <Card key={c.id} className={cn(!c.active && 'opacity-55')}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {SECTOR_LABELS[c.sector]} · {c.products.length} produto(s)
                  </p>
                </div>
                <Switch checked={c.active} onCheckedChange={() => toggle.mutate(c)} aria-label="Ativar categoria" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Sobremesas" /></div>
            <div className="space-y-1.5">
              <Label>Estação</Label>
              <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SECTOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full apex-gradient text-white" onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Criar categoria</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ==================== FUNCIONÁRIOS ==================== */
function UsersTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'WAITER' })

  const { data, isLoading } = useQuery<{ users: UserRow[] }>({ queryKey: ['users'], queryFn: () => api('/api/users') })

  const save = useMutation({
    mutationFn: () => apiPost('/api/users', { ...form, email: withApexSuffix(form.email) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Funcionário cadastrado')
      setOpen(false)
      setForm({ name: '', email: '', password: '', role: 'WAITER' })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const toggle = useMutation({
    mutationFn: (u: UserRow) => apiPatch(`/api/users/${u.id}`, { active: !u.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Perfis definem o acesso às telas do sistema</p>
        <Button onClick={() => setOpen(true)} className="apex-gradient text-white"><Plus className="h-4 w-4" /> Novo funcionário</Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(data?.users ?? []).map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3.5">
                  <div className={cn('h-9 w-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0', u.active ? 'apex-gradient' : 'bg-muted text-muted-foreground')}>
                    {u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{u.name} {!u.active && <Badge variant="outline" className="ml-1 text-[9px]">inativo</Badge>}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{u.email}</p>
                  </div>
                  {u.activeLoad !== null && (
                    <Badge variant="outline" className="hidden md:inline-flex text-[10px]">{u.activeLoad} comanda(s) ativa(s)</Badge>
                  )}
                  <Select value={u.role} onValueChange={(v) => apiPatch(`/api/users/${u.id}`, { role: v }).then(() => { void qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Cargo atualizado') })}>
                    <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TENANT_ROLE_ENTRIES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Switch checked={u.active} onCheckedChange={() => toggle.mutate(u)} aria-label="Ativar usuário" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <SuffixedEmailField value={form.email} onChange={(local) => setForm({ ...form, email: local })} />
            </div>
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
          <DialogFooter>
            <Button className="w-full apex-gradient text-white" onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.email || form.password.length < 4}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ==================== METAS ==================== */
function GoalsTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ userId: '', target: '50', title: 'Comandas atendidas no mês' })

  const { data, isLoading } = useQuery<{ goals: GoalRow[] }>({ queryKey: ['goals'], queryFn: () => api('/api/goals') })
  const { data: usersData } = useQuery<{ users: UserRow[] }>({ queryKey: ['users'], queryFn: () => api('/api/users') })

  const save = useMutation({
    mutationFn: () => apiPost('/api/goals', { userId: form.userId, target: Number(form.target), title: form.title }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Meta criada')
      setOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/goals/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['goals'] })
      toast.success('Meta removida')
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Metas mensais de comandas por funcionário</p>
        <Button onClick={() => setOpen(true)} className="apex-gradient text-white"><Plus className="h-4 w-4" /> Nova meta</Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (data?.goals ?? []).length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nenhuma meta cadastrada para o mês atual.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.goals ?? []).map((g) => {
            const pct = Math.min(100, Math.round((g.achieved / Math.max(g.target, 1)) * 100))
            return (
              <Card key={g.id}>
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{g.user.name}</p>
                    <button className="text-muted-foreground hover:text-red-500" onClick={() => remove.mutate(g.id)} aria-label="Excluir meta"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{g.title} · {g.month}</p>
                  <Progress value={pct} className="h-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{g.achieved}/{g.target} comandas</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova meta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Funcionário</Label>
              <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(usersData?.users ?? []).filter((u) => u.role === 'WAITER').map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Descrição</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Alvo (comandas/mês)</Label><Input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value.replace(/\D/g, '') })} inputMode="numeric" /></div>
          </div>
          <DialogFooter>
            <Button className="w-full apex-gradient text-white" onClick={() => save.mutate()} disabled={!form.userId || save.isPending}>Criar meta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ==================== OPERAÇÃO ==================== */
function OperationTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<{ settings: Record<string, string> }>({ queryKey: ['settings'], queryFn: () => api('/api/settings') })
  const s = data?.settings ?? {}

  const save = useMutation({
    mutationFn: (payload: Record<string, string>) => apiPatch('/api/settings', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Configuração salva')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <p className="font-semibold text-sm">Distribuição de comandas</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Regra automática de direcionamento aos garçons</p>
          </div>
          <div className="space-y-1.5">
            <Label>Regra</Label>
            <Select value={s.distributionRule ?? 'least_active'} onValueChange={(v) => save.mutate({ distributionRule: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="least_active">Menor carga ativa (comandas abertas)</SelectItem>
                <SelectItem value="least_load">Menor demanda acumulada do dia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div>
            <p className="font-semibold text-sm">Tempos operacionais</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Limites para alertas operacionais</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Confirmação (min)</Label>
              <Input
                defaultValue={s.confirmTimeout ?? '5'}
                onBlur={(e) => save.mutate({ confirmTimeout: e.target.value.replace(/\D/g, '') || '5' })}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Alerta de atraso (min)</Label>
              <Input
                defaultValue={s.alertThreshold ?? '20'}
                onBlur={(e) => save.mutate({ alertThreshold: e.target.value.replace(/\D/g, '') || '20' })}
                inputMode="numeric"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
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
            <div key={m.key} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{m.label}</span>
              <Switch checked={(s[m.key] ?? 'true') === 'true'} onCheckedChange={(v) => save.mutate({ [m.key]: String(v) })} />
            </div>
          ))}
          <Separator />
          <div className="space-y-1.5">
            <Label>Meta padrão (comandas/mês)</Label>
            <Input
              defaultValue={s.defaultGoal ?? '50'}
              onBlur={(e) => save.mutate({ defaultGoal: e.target.value.replace(/\D/g, '') || '50' })}
              inputMode="numeric"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
