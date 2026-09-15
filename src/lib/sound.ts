// Efeitos sonoros via Web Audio API (sem assets externos)
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.08) {
  const audio = getCtx()
  if (!audio) return
  const osc = audio.createOscillator()
  const g = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, audio.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, audio.currentTime + start + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + dur)
  osc.connect(g)
  g.connect(audio.destination)
  osc.start(audio.currentTime + start)
  osc.stop(audio.currentTime + start + dur + 0.05)
}

export type SoundKind = 'new' | 'ready' | 'cash' | 'success' | 'alert' | 'click'

/* ---------------------------------------------------------------------------
 * Sons personalizados por tipo de ação (arquivos WAV em /sounds)
 * Cada evento da operação tem um motif sonoro próprio, usado junto com as
 * notificações do sistema (barra de notificações em desktop/tablet/PWA).
 * ------------------------------------------------------------------------- */

export type EventSoundKind =
  | 'comanda-nova'
  | 'comanda-confirmada'
  | 'prato-pronto'
  | 'encaminhada'
  | 'pagamento'
  | 'alerta'
  | 'comanda-itens'
  | 'avaliacao'

export const EVENT_SOUNDS: Record<EventSoundKind, { file: string; label: string }> = {
  'comanda-nova': { file: '/sounds/comanda-nova.wav', label: 'Sino de porta, dois toques' },
  'comanda-confirmada': { file: '/sounds/comanda-confirmada.wav', label: 'Mallet, três notas subindo' },
  'prato-pronto': { file: '/sounds/prato-pronto.wav', label: 'Sino de balcão, duas batidas' },
  'encaminhada': { file: '/sounds/encaminhada.wav', label: 'Dois tons quentes descendo' },
  'pagamento': { file: '/sounds/pagamento.wav', label: 'Arpejo + brilho de moedas' },
  'alerta': { file: '/sounds/alerta.wav', label: 'Dois tons alternados' },
  'comanda-itens': { file: '/sounds/comanda-confirmada.wav', label: 'Itens adicionados à comanda' },
  'avaliacao': { file: '/sounds/prato-pronto.wav', label: 'Avaliação do cliente' },
}

const bufferCache = new Map<string, AudioBuffer>()

/** Volume master (0–1) persistido por dispositivo */
export function getVolume(): number {
  try {
    const raw = localStorage.getItem('apex-sound-volume')
    if (raw === null || raw === '') return 0.8
    const v = Number(raw)
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.8
  } catch {
    return 0.8
  }
}

export function setVolume(v: number) {
  try {
    localStorage.setItem('apex-sound-volume', String(Math.min(1, Math.max(0, v))))
  } catch {
    // ignore
  }
}

/** Som de ação habilitado? (por tipo; padrão ligado) */
export function isEventSoundEnabled(kind: EventSoundKind): boolean {
  try {
    return localStorage.getItem(`apex-es-${kind}`) !== 'off'
  } catch {
    return true
  }
}

export function setEventSoundEnabled(kind: EventSoundKind, on: boolean) {
  try {
    localStorage.setItem(`apex-es-${kind}`, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}

async function loadBuffer(file: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(file)
  if (cached) return cached
  const audio = getCtx()
  if (!audio) return null
  try {
    const res = await fetch(file)
    if (!res.ok) return null
    const buf = await audio.decodeAudioData(await res.arrayBuffer())
    bufferCache.set(file, buf)
    return buf
  } catch {
    return null
  }
}

/** Toca o som personalizado do evento (respeita mute master, volume e toggle por tipo) */
export async function playEventSound(kind: EventSoundKind, opts?: { force?: boolean }) {
  if (!opts?.force && (!isSoundEnabled() || !isEventSoundEnabled(kind))) return
  const audio = getCtx()
  if (!audio) return
  const buf = await loadBuffer(EVENT_SOUNDS[kind].file)
  if (!buf) return
  const src = audio.createBufferSource()
  const g = audio.createGain()
  g.gain.value = getVolume()
  src.buffer = buf
  src.connect(g)
  g.connect(audio.destination)
  src.start()
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem('apex-sound') !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem('apex-sound', on ? 'on' : 'off')
  } catch {
    // ignore
  }
}

export function playSound(kind: SoundKind) {
  if (!isSoundEnabled()) return
  switch (kind) {
    case 'new':
      tone(880, 0, 0.12, 'sine')
      tone(1174, 0.13, 0.16, 'sine')
      break
    case 'ready':
      tone(784, 0, 0.1, 'triangle')
      tone(988, 0.11, 0.1, 'triangle')
      tone(1318, 0.22, 0.18, 'triangle')
      break
    case 'cash':
      tone(1318, 0, 0.09, 'sine', 0.06)
      tone(1046, 0.1, 0.09, 'sine', 0.06)
      tone(1568, 0.2, 0.22, 'sine', 0.07)
      break
    case 'success':
      tone(659, 0, 0.1, 'sine')
      tone(987, 0.12, 0.2, 'sine')
      break
    case 'alert':
      tone(440, 0, 0.14, 'square', 0.05)
      tone(440, 0.2, 0.14, 'square', 0.05)
      break
    case 'click':
      tone(520, 0, 0.05, 'sine', 0.04)
      break
  }
}
