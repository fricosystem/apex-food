import { createServer } from 'http'
import { Server } from 'socket.io'

// ============ APEX FOOD — Realtime Service ============
// Salas: waiters | kitchen | cashier | dashboard | management | client:{orderId}
// As API routes do Next disparam eventos através de um socket interno emitindo 'broadcast'.

const httpServer = createServer()

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const VALID_ROOMS = new Set(['waiters', 'kitchen', 'cashier', 'dashboard', 'management'])

io.on('connection', (socket) => {
  socket.on('join', (data: { rooms?: string[]; clientRoom?: string }) => {
    const rooms = data?.rooms ?? []
    for (const r of rooms) {
      if (VALID_ROOMS.has(r)) socket.join(r)
    }
    if (data?.clientRoom && typeof data.clientRoom === 'string' && data.clientRoom.startsWith('client:')) {
      socket.join(data.clientRoom)
    }
  })

  socket.on('leave', (room: string) => {
    if (typeof room === 'string') socket.leave(room)
  })

  // Ponte interna: API routes emitem para cá e o service distribui
  socket.on('broadcast', (msg: { event?: string; data?: unknown; room?: string | null }) => {
    if (!msg?.event) return
    if (msg.room) {
      io.to(msg.room).emit(msg.event, msg.data)
    } else {
      io.emit(msg.event, msg.data)
    }
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[APEX FOOD] Realtime service on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
