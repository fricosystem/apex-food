import { io, Socket } from 'socket.io-client'

/**
 * Socket compartilhado do navegador (singleton por aba).
 * Nunca use porta na URL — sempre XTransformPort para o gateway.
 */
export function getSharedSocket(): Socket {
  const g = globalThis as unknown as { __apexClientSocket?: Socket }
  if (!g.__apexClientSocket) {
    g.__apexClientSocket = io('/?XTransformPort=3003', {
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
