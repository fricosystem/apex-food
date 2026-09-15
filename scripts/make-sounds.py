#!/usr/bin/env python3
"""APEX FOOD — Geração dos sons personalizados por tipo de ação (v2).

Reescrita para sons mais "reais": em vez de tons puros (seno/onda quadrada),
usa síntese FM (sinos metálicos, tipo sino de balcão de restaurante) e
"mallet" com parciais inarmônicos (tipo marimba/talher), mais um transiente
de ruído filtrado na pancada inicial e uma reverberação algorítmica simples
(early reflections por delay+ganho) para dar sensação de espaço em vez de
soarem "chapados"/sintéticos.

  - comanda-nova.wav       sino de porta quente, dois toques subindo (nova comanda)
  - comanda-confirmada.wav três notas de mallet subindo rápido (foi para a cozinha)
  - prato-pronto.wav       sino de balcão (campainha de restaurante), duas batidas brilhantes
  - pagamento.wav          arpejo ascendente + brilho de "moedas" (cha-ching moderno)
  - encaminhada.wav        dois tons quentes descendo, suaves (repasse ao caixa)
  - alerta.wav             dois tons alternados, arredondados (atenção, sem soar como buzina)

Formato: WAV PCM 16-bit, estéreo (reverb com leve diferença entre canais),
44.1 kHz, normalizado a 0.88 de pico.
"""
import os
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "sounds")

rng = np.random.default_rng(7)


# ---------------------------------------------------------------------------
# Primitivas de síntese
# ---------------------------------------------------------------------------

def fm_bell(freq, dur, t0, ratio=1.4, index=2.2, tau=None, gain=1.0):
    """Sino metálico via FM (algoritmo clássico de Chowning): soa muito mais
    "real" que um seno puro porque o espectro de um sino é inarmônico."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    if tau is None:
        tau = dur * 0.4
    mod_env = np.exp(-t / (tau * 0.55))
    mod = index * mod_env * np.sin(2 * np.pi * freq * ratio * t)
    carrier = np.sin(2 * np.pi * freq * t + mod)
    env = np.exp(-t / tau)
    atk = max(1, int(0.003 * SR))
    env[:atk] *= np.linspace(0, 1, atk)
    return t0, gain * carrier * env


def mallet(freq, dur, t0, tau=0.22, gain=1.0):
    """Nota tipo marimba/talher: parciais levemente inarmônicos + clique de
    ataque (a "pancada" do mallet), não só um tom liso."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = (
        1.0 * np.sin(2 * np.pi * freq * t)
        + 0.32 * np.sin(2 * np.pi * freq * 2.76 * t)
        + 0.14 * np.sin(2 * np.pi * freq * 5.40 * t)
    )
    env = np.exp(-t / tau)
    atk = max(1, int(0.002 * SR))
    env[:atk] *= np.linspace(0, 1, atk)
    sig *= env
    click_n = min(n, max(1, int(0.004 * SR)))
    click_env = np.exp(-np.arange(click_n) / (0.0012 * SR))
    sig[:click_n] += rng.standard_normal(click_n) * click_env * 0.22
    return t0, gain * sig


def sparkle(freq, dur, t0, gain=1.0):
    """Ping bem curto e agudo — usado em cluster para efeito de "brilho"."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.0 * t)
    tau = dur * 0.3
    env = np.exp(-t / tau)
    atk = max(1, int(0.001 * SR))
    env[:atk] *= np.linspace(0, 1, atk)
    return t0, gain * sig * env


def lowpass(x, cutoff, sr=SR):
    """Filtro passa-baixa de um polo (RC simples) — arredonda transientes
    duros sem depender de scipy."""
    rc = 1.0 / (2 * np.pi * cutoff)
    dt = 1.0 / sr
    alpha = dt / (rc + dt)
    y = np.empty_like(x)
    acc = x[0]
    for i in range(len(x)):
        acc = acc + alpha * (x[i] - acc)
        y[i] = acc
    return y


def render_mono(notes, total, tail=0.6):
    n = int((total + tail) * SR)
    buf = np.zeros(n)
    for t0, sig in notes:
        i = int(t0 * SR)
        j = min(i + len(sig), n)
        if j > i:
            buf[i:j] += sig[: j - i]
    return buf


def early_reflections(sig, sr, taps):
    """Reverb simples (sem feedback, sem risco de instabilidade): soma cópias
    atrasadas e atenuadas do próprio sinal — dá sensação de espaço/corpo."""
    out = sig.copy()
    for delay, g in taps:
        d = int(delay * sr)
        if d <= 0 or d >= len(sig):
            continue
        delayed = np.zeros_like(sig)
        delayed[d:] = sig[: len(sig) - d] * g
        out = out + delayed
    return out


def to_stereo(sig, sr, taps_l, taps_r, width=1.0):
    left = early_reflections(sig, sr, taps_l)
    right = early_reflections(sig, sr, taps_r)
    mid = (left + right) / 2
    left = mid + (left - mid) * width
    right = mid + (right - mid) * width
    return left, right


def normalize_stereo(left, right, peak=0.88):
    m = max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-9)
    return left / m * peak, right / m * peak


def write_wav_stereo(name, left, right):
    pcm = np.empty(len(left) * 2, dtype=np.int16)
    pcm[0::2] = (left * 32767).astype(np.int16)
    pcm[1::2] = (right * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  {name}  ({len(left) / SR:.2f}s)")


# Conjuntos de delays levemente diferentes por canal → largura estéreo natural
TAPS_WARM_L = [(0.021, 0.32), (0.045, 0.20), (0.074, 0.11), (0.112, 0.06)]
TAPS_WARM_R = [(0.026, 0.30), (0.052, 0.19), (0.081, 0.10), (0.121, 0.06)]
TAPS_SHORT_L = [(0.014, 0.24), (0.031, 0.13)]
TAPS_SHORT_R = [(0.017, 0.22), (0.036, 0.12)]
TAPS_LONG_L = [(0.028, 0.36), (0.058, 0.24), (0.093, 0.16), (0.140, 0.09), (0.190, 0.05)]
TAPS_LONG_R = [(0.033, 0.34), (0.064, 0.23), (0.101, 0.15), (0.150, 0.08), (0.205, 0.05)]


def finish(name, notes, total, taps_l, taps_r, width=1.05):
    mono = render_mono(notes, total)
    left, right = to_stereo(mono, SR, taps_l, taps_r, width=width)
    left, right = normalize_stereo(left, right)
    write_wav_stereo(name, left, right)


# ---------------------------------------------------------------------------
# comanda-nova.wav — sino de porta quente, dois toques subindo
# ---------------------------------------------------------------------------
def make_comanda_nova():
    notes = [
        fm_bell(659.25, 0.55, 0.00, ratio=1.5, index=1.8, tau=0.42, gain=0.9),   # E5
        fm_bell(880.00, 0.60, 0.16, ratio=1.5, index=2.0, tau=0.46, gain=1.0),   # A5
    ]
    finish("comanda-nova.wav", notes, 0.85, TAPS_WARM_L, TAPS_WARM_R)


# ---------------------------------------------------------------------------
# comanda-confirmada.wav — três notas de mallet subindo (foi para a cozinha)
# ---------------------------------------------------------------------------
def make_comanda_confirmada():
    notes = [
        mallet(523.25, 0.24, 0.00, tau=0.16, gain=0.85),  # C5
        mallet(659.25, 0.24, 0.09, tau=0.17, gain=0.9),   # E5
        mallet(783.99, 0.30, 0.18, tau=0.22, gain=1.0),   # G5
    ]
    finish("comanda-confirmada.wav", notes, 0.55, TAPS_SHORT_L, TAPS_SHORT_R, width=1.0)


# ---------------------------------------------------------------------------
# prato-pronto.wav — sino de balcão (campainha de restaurante), duas batidas
# ---------------------------------------------------------------------------
def make_prato_pronto():
    notes = [
        fm_bell(1318.51, 0.42, 0.00, ratio=2.0, index=3.6, tau=0.30, gain=1.0),  # E6 brilhante
        fm_bell(1318.51, 0.42, 0.22, ratio=2.0, index=3.6, tau=0.30, gain=0.85),
    ]
    finish("prato-pronto.wav", notes, 0.70, TAPS_LONG_L, TAPS_LONG_R, width=1.1)


# ---------------------------------------------------------------------------
# pagamento.wav — arpejo ascendente + brilho de moedas (cha-ching moderno)
# ---------------------------------------------------------------------------
def make_pagamento():
    notes = [
        mallet(523.25, 0.22, 0.00, tau=0.15, gain=0.75),   # C5
        mallet(659.25, 0.22, 0.07, tau=0.15, gain=0.8),    # E5
        mallet(783.99, 0.22, 0.14, tau=0.16, gain=0.85),   # G5
        fm_bell(1046.50, 0.55, 0.21, ratio=1.8, index=2.4, tau=0.4, gain=1.0),  # C6 resolve
    ]
    sparkle_freqs = [1567.98, 1864.66, 2093.00, 2349.32, 2793.83]
    t = 0.30
    for f in sparkle_freqs:
        t += float(rng.uniform(0.03, 0.07))
        notes.append(sparkle(f, 0.18, t, gain=0.28))
    finish("pagamento.wav", notes, 0.95, TAPS_LONG_L, TAPS_LONG_R, width=1.15)


# ---------------------------------------------------------------------------
# encaminhada.wav — dois tons quentes descendo, suaves (repasse ao caixa)
# ---------------------------------------------------------------------------
def make_encaminhada():
    notes = [
        fm_bell(783.99, 0.42, 0.00, ratio=1.3, index=1.2, tau=0.34, gain=0.75),  # G5
        fm_bell(587.33, 0.48, 0.14, ratio=1.3, index=1.2, tau=0.38, gain=0.85),  # D5
    ]
    finish("encaminhada.wav", notes, 0.75, TAPS_WARM_L, TAPS_WARM_R, width=0.9)


# ---------------------------------------------------------------------------
# alerta.wav — dois tons alternados, arredondados (atenção sem soar a buzina)
# ---------------------------------------------------------------------------
def make_alerta():
    n1 = int(0.16 * SR)
    t1 = np.arange(n1) / SR
    tone_a = np.sign(np.sin(2 * np.pi * 660 * t1)) * np.exp(-t1 / 0.5)
    tone_a = lowpass(tone_a, 1800)
    env_a = np.ones(n1)
    atk = int(0.006 * SR)
    env_a[:atk] *= np.linspace(0, 1, atk)
    env_a[-atk:] *= np.linspace(1, 0, atk)
    tone_a *= env_a

    n2 = int(0.16 * SR)
    t2 = np.arange(n2) / SR
    tone_b = np.sign(np.sin(2 * np.pi * 523.25 * t2)) * np.exp(-t2 / 0.5)
    tone_b = lowpass(tone_b, 1800)
    env_b = np.ones(n2)
    env_b[:atk] *= np.linspace(0, 1, atk)
    env_b[-atk:] *= np.linspace(1, 0, atk)
    tone_b *= env_b

    notes = [
        (0.00, tone_a * 0.55),
        (0.24, tone_b * 0.55),
        (0.48, tone_a * 0.6),
        (0.72, tone_b * 0.6),
    ]
    finish("alerta.wav", notes, 0.95, TAPS_SHORT_L, TAPS_SHORT_R, width=0.85)


if __name__ == "__main__":
    print("Gerando sons v2 (mais reais: FM/mallet + reverb) em", os.path.normpath(OUT))
    make_comanda_nova()
    make_comanda_confirmada()
    make_prato_pronto()
    make_pagamento()
    make_encaminhada()
    make_alerta()
    print("Concluído.")
