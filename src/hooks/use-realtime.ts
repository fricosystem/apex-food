'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getSharedSocket } from '@/lib/socket-client'
import { playSound } from '@/lib/sound'

type Role = string | undefined

/**
 * Conecta o socket global, entra nas salas do papel do usuário e
 * dispara invalidações de queries + notificações + sons.
 */
export function useRealtime(role: Role, userId?: string) {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = getSharedSocket()
    const onConnect = () => {
      setConnected(true)
      const rooms =
        role === 'WAITER'
          ? ['waiters']
          : role === 'KITCHEN'
            ? ['kitchen']
            : role === 'CASHIER'
              ? ['cashier']
              : role === 'ADMIN'
                ? ['waiters', 'kitchen', 'cashier', 'dashboard', 'management']
                : role === 'MANAGER'
                  ? ['waiters', 'kitchen', 'cashier', 'dashboard', 'management']
                  : []
      if (rooms.length) socket.emit('join', { rooms })
    }
    const onDisconnect = () => setConnected(false)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (socket.connected) onConnect()

    type Handler = (data: Record<string, unknown>) => void
    const handlers: Record<string, { rooms: string[]; invalidates: string[][]; handler?: Handler }> = {
      'comanda:nova': {
        rooms: [],
        invalidates: [['orders'], ['tables'], ['metrics']],
        handler: (d) => {
          if (role === 'KITCHEN') return
          if (role === 'WAITER') {
            const mine = !d.waiterId || d.waiterId === userId
            playSound('new')
            toast.success(`Nova comanda — Mesa ${d.tableNumber ?? '?'}`, {
              description: mine ? 'Distribuída para você. Confirme para enviar à cozinha.' : 'Aberta por outro garçom.',
            })
          } else if (role === 'CASHIER') {
            // silencioso
          } else {
            playSound('new')
            toast.success(`Nova comanda — Mesa ${d.tableNumber ?? '?'}`, { description: 'Aguardando confirmação do garçom.' })
          }
        },
      },
      'comanda:confirmada': {
        rooms: [],
        invalidates: [['orders'], ['metrics']],
        handler: () => {
          if (role === 'KITCHEN') {
            playSound('new')
            toast.info('Comanda confirmada na cozinha', { description: 'Novos itens na fila de preparo.' })
          }
        },
      },
      'item:atualizado': {
        rooms: [],
        invalidates: [['orders']],
      },
      'comanda:pronta': {
        rooms: [],
        invalidates: [['orders'], ['metrics']],
        handler: (d) => {
          if (role === 'KITCHEN') return
          if (role === 'CASHIER') return
          playSound('ready')
          toast.success('Prato pronto para servir', {
            description: `${String(d.productName ?? 'Item')} — Mesa ${d.tableNumber ?? '?'}`,
          })
        },
      },
      'comanda:encaminhada': {
        rooms: [],
        invalidates: [['orders'], ['tables'], ['metrics']],
        handler: (d) => {
          if (role === 'CASHIER') {
            playSound('new')
            toast.info('Comanda encaminhada ao caixa', {
              description: `Mesa ${d.tableNumber ?? '?'} aguardando pagamento.`,
            })
          } else if (role === 'ADMIN' || role === 'MANAGER') {
            playSound('new')
            toast.info(`Mesa ${d.tableNumber ?? '?'} encaminhada ao caixa`)
          }
        },
      },
      'comanda:paga': {
        rooms: [],
        invalidates: [['orders'], ['tables'], ['metrics'], ['goals']],
        handler: (d) => {
          if (role === 'KITCHEN') return
          playSound('cash')
          toast.success(`Pagamento confirmado — Mesa ${d.tableNumber ?? '?'}`, {
            description: `Comanda ${String(d.code ?? '')} finalizada.`,
          })
        },
      },
      'mesa:atualizada': {
        rooms: [],
        invalidates: [['tables']],
      },
      'dados:alterados': {
        rooms: [],
        invalidates: [['products'], ['categories'], ['users'], ['goals'], ['settings'], ['tables'], ['orders']],
      },
    }

    const bound: Array<[string, Handler]> = []
    for (const [event, cfg] of Object.entries(handlers)) {
      const fn: Handler = (data) => {
        for (const key of cfg.invalidates) {
          void queryClient.invalidateQueries({ queryKey: key })
        }
        cfg.handler?.(data ?? {})
      }
      socket.on(event, fn)
      bound.push([event, fn])
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      for (const [event, fn] of bound) socket.off(event, fn)
    }
  }, [role, userId, queryClient])

  return { connected }
}
