"""Convierte las fotos PNG de public/img/ a WebP 3:2 (420x280, <=80 KB) en public/img/categorias/.
Uso: python scripts/convert_images.py <raiz-del-repo>
Si existe public/img/productos/<sku>.png se convierte igual a public/img/productos/<sku>.webp.
"""
import os
import sys
from PIL import Image

ROOT = sys.argv[1]
IMG = os.path.join(ROOT, 'public', 'img')
W, H = 420, 280
CATS = ['sofa', 'cama', 'colchon', 'mesa', 'silla', 'escritorio', 'silla_oficina', 'almacenaje', 'iluminacion', 'textil', 'accesorio']


def convert(src, dst):
    im = Image.open(src).convert('RGB')
    # recorte centrado a 3:2 y redimensionado
    w, h = im.size
    if w / h > W / H:
        nw = int(h * W / H)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w * H / W)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im = im.resize((W, H), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    for q in (82, 75, 65, 55, 45):
        im.save(dst, 'WEBP', quality=q, method=6)
        if os.path.getsize(dst) <= 80 * 1024:
            break
    print(os.path.relpath(dst, ROOT), os.path.getsize(dst) // 1024, 'KB')


for c in CATS:
    src = os.path.join(IMG, c + '.png')
    if os.path.exists(src):
        convert(src, os.path.join(IMG, 'categorias', c + '.webp'))
prod = os.path.join(IMG, 'productos')
if os.path.isdir(prod):
    for f in os.listdir(prod):
        if f.lower().endswith(('.png', '.jpg', '.jpeg')):
            convert(os.path.join(prod, f), os.path.join(prod, os.path.splitext(f)[0] + '.webp'))
