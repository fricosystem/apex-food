/**
 * Notificações do dispositivo (desktop, tablet e mobile PWA) — APEX FOOD
 *
 * Exibe avisos na barra de notificações do sistema operacional usando a
 * Web Notifications API:
 *  - Desktop/tablet (Chrome/Edge/Firefox/Safari): notificação nativa com
 *    ícone, som personalizado do evento e clique que traz a janela ao foco.
 *  - Mobile PWA (Android instalado / iOS 16.4+ instalado): usa o service
 *    worker quando disponível (registration.showNotification), o que exibe
 *    o aviso na barra/central de notificações mesmo com o app em segundo plano.
 *  - Cada tipo de ação tem som, vibração e tag próprios (dedupe por tipo/mesa).
 *
 * Permissão e preferências são persistidas por dispositivo (localStorage):
 *  - apex-sysnotif        master on/off das notificações do sistema
 *  - apex-nt-{kind}       toggle por tipo de ação
 *  - apex-sound*          sons (ver lib/sound.ts)
 */
import {
  isEventSoundEnabled,
  isSoundEnabled,
  playEventSound,
  type EventSoundKind,
} from './sound'

export type NotifKind = EventSoundKind

export type NotifMeta = {
  /** Nome amigável do tipo de ação */
  label: string
  /** Descrição do que dispara o aviso */
  description: string
  /** Padrão de vibração (mobile PWA), em ms */
  vibrate: number[]
  /** Emoji usado como fallback visual nos toasts */
  emoji: string
}

export const NOTIF_KINDS: Record<NotifKind, NotifMeta> = {
  'comanda-nova': {
    label: 'Nova comanda',
    description: 'Comanda aberta pelo cliente na mesa',
    vibrate: [120, 60, 120],
    emoji: '🧾',
  },
  'comanda-confirmada': {
    label: 'Comanda na cozinha',
    description: 'Garçom confirmou — itens entraram na fila de preparo',
    vibrate: [90, 50, 90, 50, 90],
    emoji: '👨‍🍳',
  },
  'prato-pronto': {
    label: 'Prato pronto',
    description: 'Item saiu para servir',
    vibrate: [100, 60, 100, 60, 160],
    emoji: '🍽️',
  },
  'encaminhada': {
    label: 'Comanda encaminhada',
    description: 'Mesa aguardando pagamento no caixa',
    vibrate: [140, 70, 140],
    emoji: '📨',
  },
  'pagamento': {
    label: 'Pagamento confirmado',
    description: 'Comanda paga e mesa liberada',
    vibrate: [60, 40, 60, 40, 140],
    emoji: '💰',
  },
  'alerta': {
    label: 'Alerta de operação',
    description: 'Avisos importantes que exigem atenção',
    vibrate: [220, 90, 220, 90, 220],
    emoji: '🔔',
  },
}

const MASTER_KEY = 'apex-sysnotif'

type PermissionState = NotificationPermission | 'unsupported'

export function notificationPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/** Pede permissão ao usuário (precisa ser chamado de um gesto do usuário) */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** Master: notificações do sistema habilitadas (padrão: sim) */
export function isSystemNotifEnabled(): boolean {
  try {
    return localStorage.getItem(MASTER_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSystemNotifEnabled(on: boolean) {
  try {
    localStorage.setItem(MASTER_KEY, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}

/** Toggle por tipo de ação (padrão: ligado) */
export function isKindNotifEnabled(kind: NotifKind): boolean {
  try {
    return localStorage.getItem(`apex-nt-${kind}`) !== 'off'
  } catch {
    return true
  }
}

export function setKindNotifEnabled(kind: NotifKind, on: boolean) {
  try {
    localStorage.setItem(`apex-nt-${kind}`, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}

function vibrateIfPossible(pattern: number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    // ignore
  }
}

async function showNotification(title: string, options: NotificationOptions): Promise<boolean> {
  // 1) Preferir o service worker (PWA instalado: aparece na barra mesmo em
  //    segundo plano e sobrevive à página em background)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, options)
        return true
      }
    }
  } catch {
    // cai para o construtor abaixo
  }
  // 2) Fallback: construtor direto (desktop/tablet no navegador)
  try {
    if (!('Notification' in window)) return false
    const n = new Notification(title, options)
    n.onclick = () => {
      try {
        window.focus()
        const kind = (options.data as { kind?: NotifKind } | undefined)?.kind ?? null
        window.dispatchEvent(new CustomEvent('apex:notification-click', { detail: { kind } }))
      } catch {
        // ignore
      }
    }
    return true
  } catch {
    return false
  }
}

/**
 * Roteamento de clique nas notificações (barra do sistema → tela certa):
 * escuta o CustomEvent do fallback e as mensagens do service worker.
 * Retorna a função de cleanup.
 */
export function onNotificationClick(handler: (kind: NotifKind | null) => void): () => void {
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ kind?: NotifKind }>).detail
    handler(detail?.kind ?? null)
  }
  const onMessage = (e: MessageEvent) => {
    const d = e.data as { type?: string; kind?: NotifKind } | null
    if (d?.type === 'apex-notification-click') handler(d.kind ?? null)
  }
  window.addEventListener('apex:notification-click', onCustom)
  try {
    navigator.serviceWorker?.addEventListener('message', onMessage)
  } catch {
    // ignore
  }
  return () => {
    window.removeEventListener('apex:notification-click', onCustom)
    try {
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    } catch {
      // ignore
    }
  }
}

/**
 * Dispara o aviso completo de um tipo de ação:
 * som personalizado do evento + notificação na barra do sistema + vibração.
 * Retorna false quando algo está desligado/sem permissão (silencioso).
 */
export async function pushSystemNotification(
  kind: NotifKind,
  data: { title: string; body?: string; tag?: string; icon?: string }
): Promise<boolean> {
  if (!isSystemNotifEnabled() || !isKindNotifEnabled(kind)) return false
  const perm = notificationPermission()
  if (perm !== 'granted') return false

  // Som personalizado do tipo de ação (respeita toggles de som)
  void playEventSound(kind)
  vibrateIfPossible(NOTIF_KINDS[kind].vibrate)

  return showNotification(data.title, {
    body: data.body,
    tag: data.tag ?? `apex-${kind}`,
    renotify: true,
    silent: true, // o som é o nosso, personalizado por ação
    icon: data.icon ?? '/icons/icon-192.png',
    badge: data.icon ?? '/icons/icon-192.png',
    data: { kind },
  })
}

/**
 * API única usada pelo tempo real: toca o som do evento e mostra a
 * notificação do sistema. Diferente do push "puro", respeita também o mute
 * master de sons para não tocar áudio com o aparelho silenciado pelo app.
 */
export function notifyStaff(kind: NotifKind, data: { title: string; body?: string; tag?: string }) {
  void pushSystemNotification(kind, data)
}

/** Estado resumido para a tela de Configurações */
export function notificationStatusSummary(): {
  permission: PermissionState
  master: boolean
  soundMaster: boolean
} {
  return {
    permission: notificationPermission(),
    master: isSystemNotifEnabled(),
    soundMaster: isSoundEnabled(),
  }
}
