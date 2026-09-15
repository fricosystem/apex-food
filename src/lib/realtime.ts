import { io, Socket } from 'socket.io-client'

/**
 * Conexão singleton do servidor Next com o realtime service (socket.io).
 * Eventos disparados pelas API routes passam por aqui (emit 'broadcast').
 */
function getSocket(): Socket | null {
  try {
    const g = globalThis as unknown as { __apexRealtimeSocket?: Socket }
    if (!g.__apexRealtimeSocket) {
      // REALTIME_URL permite apontar para um mini-services hospedado à parte
      // (necessário na Vercel — serverless não roda um servidor persistente).
      // Sem a variável, mantém o endereço local de sempre (dev).
      g.__apexRealtimeSocket = io(process.env.REALTIME_URL || 'http://127.0.0.1:3003', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        timeout: 3000,
      })
    }
    return g.__apexRealtimeSocket
  } catch {
    return null
  }
}

/**
 * Envia um evento para o realtime service distribuir. Nunca lança erro.
 * Emits feitos antes da conexão são bufferizados pelo socket.io.
 */
export function broadcast(event: string, data: unknown, room?: string | null): void {
  try {
    const socket = getSocket()
    socket?.emit('broadcast', { event, data, room: room ?? null })
  } catch {
    // realtime indisponível — a UI continua funcionando via polling
  }
}
