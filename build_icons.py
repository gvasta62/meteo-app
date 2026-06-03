#!/usr/bin/env python3
"""Genera le icone della PWA (sfondo gradiente azzurro + sole + nuvola).
Esegui: python3 build_icons.py  -> crea i file in src/icons/
"""
import os
from PIL import Image, ImageDraw

ICON_DIR = os.path.join(os.path.dirname(__file__), "src", "icons")
os.makedirs(ICON_DIR, exist_ok=True)

TOP = (79, 172, 254)    # #4facfe
BOT = (0, 242, 254)     # #00f2fe
SUN = (255, 206, 84)    # giallo sole
SUN2 = (255, 167, 38)   # arancio bordo raggi
CLOUD = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def disegna(size, padding_ratio=0.0, sfondo_pieno=True, radius_ratio=0.22):
    """Disegna l'icona su un canvas size x size.
    padding_ratio: margine interno (per le maskable, ~0.1).
    sfondo_pieno: True = sfondo a tutto bordo (maskable); False = riquadro arrotondato.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Sfondo a gradiente verticale
    bg = Image.new("RGB", (size, size))
    bgd = ImageDraw.Draw(bg)
    for y in range(size):
        bgd.line([(0, y), (size, y)], fill=lerp(TOP, BOT, y / size))

    if sfondo_pieno:
        img.paste(bg, (0, 0))
    else:
        # maschera arrotondata
        r = int(size * radius_ratio)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
        img.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(img)

    # Area di disegno tenendo conto del padding (safe zone per maskable)
    pad = int(size * padding_ratio)
    s = size - 2 * pad

    def px(fx):
        return int(pad + fx * s)

    # --- Sole (in alto a sinistra) con raggi ---
    cx, cy, rad = px(0.40), px(0.38), int(s * 0.16)
    # raggi
    import math
    for k in range(8):
        ang = k * math.pi / 4
        x1 = cx + math.cos(ang) * rad * 1.35
        y1 = cy + math.sin(ang) * rad * 1.35
        x2 = cx + math.cos(ang) * rad * 1.95
        y2 = cy + math.sin(ang) * rad * 1.95
        d.line([(x1, y1), (x2, y2)], fill=SUN2, width=max(3, int(s * 0.018)))
    d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=SUN, outline=SUN2,
              width=max(2, int(s * 0.012)))

    # --- Nuvola (in basso a destra), tre bolle + base ---
    def bolla(fx, fy, fr):
        x, y, r = px(fx), px(fy), int(s * fr)
        d.ellipse([x - r, y - r, x + r, y + r], fill=CLOUD)

    base_y = px(0.70)
    d.rounded_rectangle([px(0.30), base_y, px(0.82), px(0.80)],
                        radius=int(s * 0.06), fill=CLOUD)
    bolla(0.42, 0.62, 0.12)
    bolla(0.58, 0.56, 0.16)
    bolla(0.72, 0.64, 0.11)

    return img


def salva(img, nome, size):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(ICON_DIR, nome))
    print("creato", nome)


base = disegna(512, padding_ratio=0.0, sfondo_pieno=False)
salva(base, "icon-512.png", 512)
salva(base, "icon-192.png", 192)
salva(base, "apple-touch-icon.png", 180)
salva(base, "favicon-32.png", 32)

mask = disegna(512, padding_ratio=0.12, sfondo_pieno=True)
salva(mask, "maskable-512.png", 512)

print("Fatto.")
