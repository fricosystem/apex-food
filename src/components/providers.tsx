'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { getSharedSocket } from '@/lib/socket-client'

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
    if (mounted.current) return
    mounted.current = true
    getSharedSocket()
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
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
