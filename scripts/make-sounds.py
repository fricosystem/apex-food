#!/usr/bin/env python3
"""APEX FOOD — Geração dos sons personalizados por tipo de ação.

Cada evento do sistema tem um motif sonoro distinto (Web Notifications +
toasts in-app usam o mesmo áudio):
  - comanda-nova.wav       sino duplo ascendente (nova comanda)
  - comanda-confirmada.wav três toques rápidos subindo (fila da cozinha)
  - prato-pronto.wav       arpejo de campanha (prato pronto para servir)
  - pagamento.wav          cha-ching de caixa (pagamento confirmado)
  - encaminhada.wav        dois tons suaves descendentes (encaminhada ao caixa)
  - alerta.wav             buzina dupla grave (atenção/atraso)

Formato: WAV PCM 16-bit mono 44.1 kHz, normalizado a 0.85 de pico.
"""
import os
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "sounds")


def note(freq, dur, t0, partials, tau, gain=1.0, vib_hz=0.0, vib_depth=0.0):
    """Nota com attack curto, decaimento exponencial e parciais harmônicas."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq.copy() if isinstance(freq, np.ndarray) else np.full(n, freq, dtype=float)
    if vib_hz > 0:
        f = f * (1 + vib_depth * np.sin(2 * np.pi * vib_hz * t))
    phase = 2 * np.pi * np.cumsum(f) / SR
    sig = np.zeros(n)
    for amp, mult in partials:
        sig += amp * np.sin(mult * phase)
    env = np.exp(-t / tau)
    atk = int(0.006 * SR)
    if atk > 0:
        env[:atk] *= np.linspace(0, 1, atk)
    rel = int(0.005 * SR)
    if rel > 0:
        env[-rel:] *= np.linspace(1, 0, rel)
    return t0, gain * sig * env


def render(name, notes, total):
    buf = np.zeros(int(total * SR))
    for t0, sig in notes:
        i = int(t0 * SR)
        j = min(i + len(sig), len(buf))
        buf[i:j] += sig[: j - i]
    peak = np.max(np.abs(buf))
    if peak > 0:
        buf = buf / peak * 0.85
    pcm = (buf * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{name}: {total:.2f}s pico {np.max(np.abs(buf)):.2f}")


# 1) Nova comanda — sino duplo ascendente A5 -> E6
bell = [(1.0, 1.0), (0.4, 2.0), (0.15, 3.0)]
render(
    "comanda-nova.wav",
    [
        note(880.0, 0.30, 0.0, bell, 0.12, 0.9),
        note(1318.5, 0.45, 0.13, bell, 0.16, 1.0),
    ],
    0.62,
)

# 2) Comanda confirmada — três toques rápidos subindo (C6 D6 E6)
tick = [(1.0, 1.0), (0.25, 3.0)]
render(
    "comanda-confirmada.wav",
    [
        note(1046.5, 0.12, 0.00, tick, 0.05, 0.85),
        note(1174.7, 0.12, 0.105, tick, 0.05, 0.92),
        note(1318.5, 0.20, 0.21, tick, 0.08, 1.0),
    ],
    0.46,
)

# 3) Prato pronto — arpejo de campanha G5 B5 D6 G6
chime = [(1.0, 1.0), (0.3, 2.0)]
render(
    "prato-pronto.wav",
    [
        note(783.99, 0.28, 0.00, chime, 0.13, 0.8),
        note(987.77, 0.28, 0.10, chime, 0.13, 0.87),
        note(1174.66, 0.30, 0.20, chime, 0.14, 0.94),
        note(1567.98, 0.55, 0.31, chime, 0.20, 1.0),
    ],
    0.92,
)

# 4) Pagamento — cha-ching de caixa (blips + brilho de moedas + ding final)
coin = [(1.0, 1.0), (0.2, 2.7), (0.12, 4.1)]
render(
    "pagamento.wav",
    [
        note(1318.5, 0.09, 0.00, [(1.0, 1.0)], 0.035, 0.8),
        note(1760.0, 0.09, 0.10, [(1.0, 1.0)], 0.035, 0.9),
        note(1975.5, 0.38, 0.22, coin, 0.11, 0.55),
        note(2093.0, 0.45, 0.24, [(1.0, 1.0), (0.25, 2.0)], 0.15, 1.0),
    ],
    0.74,
)

# 5) Encaminhada ao caixa — dois tons suaves descendentes D6 -> A5
mellow = [(1.0, 1.0), (0.2, 2.0)]
render(
    "encaminhada.wav",
    [
        note(1174.66, 0.24, 0.0, mellow, 0.10, 0.9),
        note(880.0, 0.40, 0.16, mellow, 0.15, 1.0),
    ],
    0.62,
)

# 6) Alerta — buzina dupla grave A#4 com vibrato
horn = [(1.0, 1.0), (0.35, 3.0), (0.2, 5.0)]
render(
    "alerta.wav",
    [
        note(466.16, 0.15, 0.00, horn, 0.06, 0.95, vib_hz=6, vib_depth=0.012),
        note(466.16, 0.22, 0.23, horn, 0.08, 1.0, vib_hz=6, vib_depth=0.012),
    ],
    0.52,
)

print("OK — sons gerados em public/sounds/")
