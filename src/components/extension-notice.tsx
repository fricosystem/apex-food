'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Detecta extensões de navegador que reescrevem o DOM antes da hidratação
 * (ex.: "Translate Web Pages", que injeta as classes translate-tooltip-mtz /
 * hidden_translate e remove o atributo hidden do container de metadata do Next).
 *
 * Esse tipo de extensão dispara o aviso "Hydration failed" no dev overlay e
 * pode alterar textos da interface. O app continua funcionando (o React
 * regenera a árvore no cliente), mas avisamos o usuário uma vez por sessão
 * para que desative a extensão neste site.
 *
 * Não altera a árvore renderizada (retorna null) — zero risco de mismatch.
 */

const SELECTOR = '.translate-tooltip-mtz, .hidden_translate'
const SESSION_KEY = 'apexfood:ext-translation-notice'

export function ExtensionNotice() {
  useEffect(() => {
    let notified = false
    let observer: MutationObserver | null = null

    const alreadyNotified = () => {
      try {
        return sessionStorage.getItem(SESSION_KEY) === '1'
      } catch {
        return false
      }
    }

    const found = () => {
      if (notified || alreadyNotified()) return
      notified = true
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        /* storage bloqueado — segue o fluxo */
      }
      observer?.disconnect()
      toast.warning('Extensão de tradução detectada', {
        description:
          'Uma extensão do navegador (ex.: Translate Web Pages) está modificando a página e pode causar avisos técnicos de hidratação além de alterar textos da interface. Recomendamos desativá-la para este site.',
        duration: 12000,
      })
    }

    if (document.querySelector(SELECTOR)) {
      found()
      return
    }

    observer = new MutationObserver(() => {
      if (document.querySelector(SELECTOR)) found()
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })

    // Observador finito: extensões injetam seus elementos na carga da página
    const stop = setTimeout(() => observer?.disconnect(), 120_000)

    return () => {
      clearTimeout(stop)
      observer?.disconnect()
    }
  }, [])

  return null
}
