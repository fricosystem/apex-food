import { io, Socket } from 'socket.io-client'

/**
 * Socket compartilhado do navegador (singleton por aba).
 * NEXT_PUBLIC_REALTIME_URL aponta para um mini-services hospedado à parte
 * (necessário em produção na Vercel). Sem a variável, cai no endereço do
 * sandbox original (proxy Caddy por XTransformPort) — comportamento de
 * sempre, preservado para não quebrar nada fora da Vercel.
 */
export function getSharedSocket(): Socket {
  const g = globalThis as unknown as { __apexClientSocket?: Socket }
  if (!g.__apexClientSocket) {
    g.__apexClientSocket = io(process.env.NEXT_PUBLIC_REALTIME_URL || '/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 1500,
      timeout: 10000,
    })
  }
  return g.__apexClientSocket
}
