'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { getSharedSocket } from '@/lib/socket-client'
import { ExtensionNotice } from '@/components/extension-notice'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 4000, retry: 1, refetchOnWindowFocus: true },
        },
      })
  )
  const mounted = useRef(false)
  useEffect(() => {
    // Marcador de fim de hidratação — consumido pela guarda anti-extensão no layout
    // (antes dele, remoção de hidden em elementos nativos só pode vir de extensão)
    document.documentElement.setAttribute('data-apex-hydrated', '1')
    if (mounted.current) return
    mounted.current = true
    getSharedSocket()
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <ExtensionNotice />
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#16161A',
              border: '1px solid #2E2E38',
              color: '#F4F4F5',
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
