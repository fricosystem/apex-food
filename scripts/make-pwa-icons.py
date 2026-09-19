#!/usr/bin/env python3
"""Gera os ícones do PWA da tela do cliente (APEX FOOD) a partir da logo oficial.

Saída em public/icons/:
- icon-192.png / icon-512.png            (purpose: any)
- icon-maskable-192.png / -512.png       (purpose: maskable, logo dentro da zona segura)
- apple-touch-icon.png (180x180)         (iOS Add to Home Screen)
Fundo #0E0E10 (mesma assinatura do favicon), logo branca centralizada.
"""
from PIL import Image
import os

SRC = "/home/z/my-project/public/apex-logo.png"
OUT = "/home/z/my-project/public/icons"
BG = (14, 14, 16, 255)  # #0E0E10

os.makedirs(OUT, exist_ok=True)
logo = Image.open(SRC).convert("RGBA")


def make(size: int, name: str, scale: float) -> None:
    canvas = Image.new("RGBA", (size, size), BG)
    h = int(size * scale)
    w = int(h * logo.width / logo.height)
    if w > size:
        w = size
        h = int(w * logo.height / logo.width)
    im = logo.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(im, ((size - w) // 2, (size - h) // 2))
    canvas.save(os.path.join(OUT, name), "PNG", optimize=True)
    print(f"ok {name} {size}x{size} (logo {w}x{h})")


# 'any': logo maior (72% da altura)
make(192, "icon-192.png", 1)
make(512, "icon-512.png", 1)
# 'maskable': zona segura circular (raio 40%) — logo a 62% da altura passa no círculo
make(192, "icon-maskable-192.png", 0.62)
make(512, "icon-maskable-512.png", 0.62)
# iOS
make(180, "apple-touch-icon.png", 0.72)

print("ícones gerados em", OUT)
