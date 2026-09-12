#!/usr/bin/env python3
"""Processa a logo APEX FOOD: fundo preto -> transparente (extração por luminância),
recorte com margem e geração de favicon (icon.png / apple-icon.png)."""
import numpy as np
from PIL import Image

SRC = '/home/z/my-project/upload/LOGO APEX FOOD.png'
OUT_LOGO = '/home/z/my-project/public/apex-logo.png'
OUT_ICON = '/home/z/my-project/src/app/icon.png'
OUT_APPLE = '/home/z/my-project/src/app/apple-icon.png'

src = Image.open(SRC).convert('RGB')
arr = np.asarray(src).astype(np.float32)

# Alpha = canal máximo (fundo preto -> 0; chapéu branco -> 255; fumaça cinza -> alpha parcial)
lum = arr.max(axis=2)
alpha = np.clip(lum, 0, 255).astype(np.uint8)
alpha[alpha < 10] = 0  # remove ruído

h, w = alpha.shape
rgba = np.zeros((h, w, 4), np.uint8)
rgba[..., 0:3] = 255  # logo branca
rgba[..., 3] = alpha
img = Image.fromarray(rgba, 'RGBA')

# Recorte no conteúdo com margem proporcional
ys, xs = np.where(alpha > 12)
pad = int(0.05 * max(xs.max() - xs.min(), ys.max() - ys.min()))
img = img.crop((max(0, xs.min() - pad), max(0, ys.min() - pad),
                min(w, xs.max() + pad), min(h, ys.max() + pad)))
img.thumbnail((600, 600), Image.LANCZOS)
img.save(OUT_LOGO)
print(f'logo: {img.size} -> {OUT_LOGO}')


def make_icon(size: int, path: str):
    base = Image.new('RGB', (size, size), (14, 14, 16))  # #0E0E10
    logo = img.copy()
    logo.thumbnail((int(size * 0.70), int(size * 0.70)), Image.LANCZOS)
    base.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
    base.save(path)
    print(f'icon {size}px -> {path}')


make_icon(128, OUT_ICON)
make_icon(180, OUT_APPLE)
