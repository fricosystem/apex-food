'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, QrCode, Printer, Download, Trash2, Grid3x3, Users,
  Smartphone, Loader2, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { api, apiPost, apiPatch, apiDelete } from '@/lib/fetcher'
import { currency, elapsedMinutes, TABLE_STATUS_LABELS } from '@/lib/types'
import type { SessionUser } from '@/lib/auth'

type TableRow = {
  id: string; number: number; capacity: number; active: boolean; status: string; qrToken: string
  activeOrder: { id: string; code: string; status: string; total: number; itemCount: number; createdAt: string } | null
}

const STATUS_STYLE: Record<string, { dot: string; badge: string }> = {
  FREE: { dot: 'bg-emerald-500', badge: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  OCCUPIED: { dot: 'bg-amber-500', badge: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  AWAITING_PAYMENT: { dot: 'bg-red-500', badge: 'border-red-500/40 text-red-600 dark:text-red-400' },
}

export function TablesView({ user }: { user: SessionUser }) {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [qrTable, setQrTable] = useState<TableRow | null>(null)
  const [form, setForm] = useState({ number: '', capacity: '4' })

  const { data, isLoading } = useQuery<{ tables: TableRow[] }>({
    queryKey: ['tables'],
    queryFn: () => api('/api/tables'),
    refetchInterval: 5000,
  })

  const create = useMutation({
    mutationFn: () => apiPost('/api/tables', { number: Number(form.number), capacity: Number(form.capacity) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Mesa cadastrada')
      setCreating(false)
      setForm({ number: '', capacity: '4' })
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const toggle = useMutation({
    mutationFn: (t: TableRow) => apiPatch(`/api/tables/${t.id}`, { active: !t.active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tables'] }),
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/tables/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tables'] })
      toast.success('Mesa excluída')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const tables = data?.tables ?? []
  const counts = {
    free: tables.filter((t) => t.active && t.status === 'FREE').length,
    occupied: tables.filter((t) => t.status === 'OCCUPIED').length,
    awaiting: tables.filter((t) => t.status === 'AWAITING_PAYMENT').length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {counts.free} livres</Badge>
        <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> {counts.occupied} ocupadas</Badge>
        <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> {counts.awaiting} aguardando caixa</Badge>
        <Button size="sm" className="ml-auto apex-gradient text-white" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nova mesa
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((t) => {
            const style = STATUS_STYLE[t.status] ?? STATUS_STYLE.FREE
            return (
              <Card key={t.id} className={cn(!t.active && 'opacity-55')}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-lg apex-gradient-soft flex items-center justify-center">
                        <Grid3x3 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold leading-none">Mesa {String(t.number).padStart(2, '0')}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Users className="h-3 w-3" /> {t.capacity} lugares</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] gap-1', style.badge)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot, t.status !== 'FREE' && 'apex-live-dot')} />
                      {TABLE_STATUS_LABELS[t.status]}
                    </Badge>
                  </div>

                  {t.activeOrder ? (
                    <div className="apex-flash rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-[11px] space-y-0.5">
                      <p className="font-medium">{t.activeOrder.code} · {t.activeOrder.itemCount} item(ns)</p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> há {elapsedMinutes(t.activeOrder.createdAt)} min · {currency(t.activeOrder.total)}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-2.5 text-[11px] text-muted-foreground text-center">
                      Nenhuma comanda ativa
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setQrTable(t)}>
                      <QrCode className="h-3.5 w-3.5" /> QR Code
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { window.location.hash = `m/${t.qrToken}`; toast.info('Abrindo tela do cliente (simulação de escaneamento)') }}>
                      <Smartphone className="h-3.5 w-3.5" /> Simular
                    </Button>
                    <Switch checked={t.active} onCheckedChange={() => toggle.mutate(t)} aria-label="Ativar mesa" />
                    <button className="text-muted-foreground hover:text-red-500 ml-0.5" onClick={() => remove.mutate(t.id)} aria-label="Excluir mesa">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Nova mesa */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Nova mesa</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Número</Label><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value.replace(/\D/g, '') })} inputMode="numeric" /></div>
            <div className="space-y-1.5"><Label>Lugares</Label><Input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value.replace(/\D/g, '') })} inputMode="numeric" /></div>
          </div>
          <DialogFooter>
            <Button className="w-full apex-gradient text-white" disabled={!form.number || create.isPending} onClick={() => create.mutate()}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code */}
      <QrDialog key={qrTable?.id ?? 'qr-none'} table={qrTable} onClose={() => setQrTable(null)} />
    </div>
  )
}

function QrDialog({ table, onClose }: { table: TableRow | null; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!table) return
    let cancelled = false
    const link = `${window.location.origin}/#m/${table.qrToken}`
    QRCode.toDataURL(link, { width: 512, margin: 2, color: { dark: '#0E0E10', light: '#FFFFFF' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => toast.error('Falha ao gerar QR Code'))
    return () => {
      cancelled = true
    }
  }, [table])

  const download = () => {
    if (!dataUrl || !table) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `apex-food-qr-mesa-${table.number}.png`
    a.click()
    toast.success('QR Code baixado')
  }

  const print = () => {
    if (!dataUrl) return
    setTimeout(() => window.print(), 200)
  }

  return (
    <Dialog open={!!table} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            {table ? `QR Code — Mesa ${String(table.number).padStart(2, '0')}` : 'QR Code'}
          </DialogTitle>
        </DialogHeader>
        {table && (
          <div className="space-y-4">
            <div className="qr-print-area flex flex-col items-center gap-3 py-2">
              <div className="h-12 w-12 rounded-xl apex-gradient flex items-center justify-center">
                <img src="/apex-logo.png" alt="Logo APEX FOOD" className="h-8 w-8 object-contain" />
              </div>
              <p className="font-bold text-lg">APEX FOOD</p>
              <p className="text-sm">Mesa {String(table.number).padStart(2, '0')}</p>
              {!dataUrl ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando…
                </div>
              ) : (
                <img src={dataUrl} alt={`QR Code da mesa ${table.number}`} className="h-56 w-56 rounded-lg border bg-white p-2" />
              )}
              <p className="text-[11px] text-muted-foreground text-center">
                Aponte a câmera do celular para abrir o cardápio digital da mesa.
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground break-all text-center print-hide">
              {`${window.location.origin}/#m/${table.qrToken}`}
            </p>
            <div className="grid grid-cols-2 gap-2 print-hide">
              <Button variant="outline" onClick={download} disabled={!dataUrl}>
                <Download className="h-4 w-4" /> Baixar PNG
              </Button>
              <Button variant="outline" onClick={print} disabled={!dataUrl}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>
          </div>
        )}
        <DialogFooter className="print-hide">
          <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
