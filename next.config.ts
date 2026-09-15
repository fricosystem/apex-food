import type { NextConfig } from "next";

/**
 * CSP intencionalmente com 'unsafe-inline' em script-src/style-src: o app usa
 * um script inline no <head> (guarda anti-extensão, ver src/app/layout.tsx) e
 * os próprios scripts de hidratação do Next também são inline — sem uma
 * integração de nonce por requisição (não configurada), bloquear inline
 * quebraria a hidratação. Mesmo assim, o restante da política reduz bastante
 * a superfície: nada de plugins/objetos, sem embutir o site em iframe de
 * terceiros, formulários só podem submeter para o próprio domínio, e conexões
 * de rede só para o próprio domínio (mais um serviço de tempo real externo,
 * se configurado via NEXT_PUBLIC_REALTIME_URL).
 *
 * 'unsafe-eval' e o WebSocket do HMR só entram em dev: o React usa eval() em
 * desenvolvimento (Fast Refresh) e o próprio `next dev` fala com o navegador
 * por WebSocket — bloquear isso derrubava a aplicação inteira em dev. Em
 * produção (Vercel) nada disso existe, então a política sai mais estrita.
 * "upgrade-insecure-requests" também só em produção — em http://localhost
 * essa diretiva tenta subir todo pedido para https e quebra o dev local.
 */
const isDev = process.env.NODE_ENV !== 'production'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' https: wss:${isDev ? ' ws:' : ''}`,
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig: NextConfig = {
  // Sem "output: standalone" — é para deploy self-hosted (Docker/VPS); a
  // Vercel tem o próprio pipeline de build serverless e recomenda não usar.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
