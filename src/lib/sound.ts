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
