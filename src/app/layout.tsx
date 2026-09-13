import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "APEX FOOD - EMPÓRIO RESTAURANTE",
  description:
    "Plataforma SaaS de gestão e operação para restaurantes: comandas em tempo real, distribuição inteligente, cozinha, caixa e métricas analíticas.",
  keywords: ["APEX FOOD", "restaurante", "gestão", "comanda digital", "cozinha", "SaaS"],
};

export const viewport: Viewport = {
  themeColor: "#0E0E10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {/*
          Guarda anti-extensão (ex.: "Translate Web Pages"): essa extensão sequestra o
          <div hidden> interno do Next (container de metadata) antes da hidratação — remove
          o atributo hidden e injeta classes (translate-tooltip-mtz / hidden_translate),
          derrubando a hidratação com "Hydration failed". Este script roda no parse do HTML
          (antes do document_idle das extensões e antes da hidratação) e reverte na hora as
          mutações em nós que nasceram com hidden — sem tocar nos elementos da própria extensão.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  try {
    var MARK = /(translate-tooltip-mtz|hidden_translate)/;
    var info = typeof WeakMap === 'function' ? new WeakMap() : null;
    var fallback = [];
    function findEntry(el) {
      if (info) return info.has(el) ? info.get(el) : undefined;
      for (var i = 0; i < fallback.length; i++) if (fallback[i][0] === el) return fallback[i][1];
      return undefined;
    }
    function guard(el) {
      var wasClassless = !el.getAttribute('class');
      if (info) info.set(el, wasClassless);
      else fallback.push([el, wasClassless]);
    }
    // Elementos já sequestrados pela extensão uma vez permanecem sob reversão permanente
    var tainted = typeof WeakSet === 'function' ? new WeakSet() : null;
    var taintedFallback = [];
    function isTainted(el) {
      if (tainted) return tainted.has(el);
      return taintedFallback.indexOf(el) !== -1;
    }
    function taint(el) {
      if (tainted) tainted.add(el);
      else if (taintedFallback.indexOf(el) === -1) taintedFallback.push(el);
    }
    // Marcador gravado pelo app no fim da hidratação (Providers) — antes disso,
    // qualquer remoção de hidden em elemento guardado só pode ser da extensão
    function isHydrated() {
      return document.documentElement.hasAttribute('data-apex-hydrated');
    }
    function scan(node) {
      if (!node || node.nodeType !== 1) return;
      try {
        if (node.hasAttribute && node.hasAttribute('hidden')) guard(node);
        if (node.querySelectorAll) {
          var kids = node.querySelectorAll('[hidden]');
          for (var i = 0; i < kids.length; i++) guard(kids[i]);
        }
      } catch (e) {}
    }
    function cleanClasses(el) {
      try {
        var tokens = String(el.className).split(/\\s+/).filter(function (t) { return t && !MARK.test(t); });
        var next = tokens.join(' ');
        if (!next) el.removeAttribute('class');
        else if (next !== el.className) el.className = next;
      } catch (e) {}
    }
    function revert(el) {
      var wasClassless = findEntry(el);
      if (wasClassless) {
        // Nasceu sem classe (ex.: container de metadata do Next): qualquer classe é
        // injeção da extensão — remove tudo para o DOM bater com o HTML do servidor
        try { el.removeAttribute('class'); } catch (e) {}
      } else {
        cleanClasses(el);
      }
      try {
        if (!el.hasAttribute('hidden')) el.setAttribute('hidden', '');
      } catch (e) {}
    }
    // Reverte só quando a mutação tem a assinatura da extensão (classes marcadoras).
    // Avalia em microtask — depois do lote inteiro de mutações — para enxergar classes
    // injetadas na mesma passada síncrona do sequestro. Mudanças legítimas do app
    // (ex.: Radix removendo hidden de uma aba ao ativá-la) não têm as marcas e passam.
    function maybeRevert(el) {
      queueMicrotask(function () {
        if (!el || !el.isConnected) return;
        if (el.hasAttribute('hidden')) return;
        // Assinatura direta, elemento já sequestrado antes, ou pré-hidratação
        if (MARK.test(String(el.className || '')) || isTainted(el) || !isHydrated()) revert(el);
      });
    }
    scan(document.documentElement);
    if (document.body) scan(document.body);
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var m = records[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
        } else if (m.type === 'attributes') {
          var el = m.target;
          var attr = m.attributeName;
          if (el === document.documentElement || el === document.body) {
            if (attr === 'class') cleanClasses(el);
            continue;
          }
          if (findEntry(el) === undefined) continue;
          if (attr === 'class') {
            // Registra a assinatura da extensão ANTES de limpar — o clean apaga a prova
            if (MARK.test(String(el.className || ''))) taint(el);
            cleanClasses(el);
          }
          else if (attr === 'hidden') maybeRevert(el);
        }
      }
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });
  } catch (e) {}
})();`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
