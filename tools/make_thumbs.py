#!/usr/bin/env python3
"""Превью 360px WebP для приложения: images/X.png -> thumbs/X.webp.
Запускать из корня сайта после обновления фото: python3 tools/make_thumbs.py
Делает только недостающие/устаревшие превью. Нужен Pillow."""
import os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DST, MAX = os.path.join(ROOT, 'images'), os.path.join(ROOT, 'thumbs'), 360
os.makedirs(DST, exist_ok=True)
made = 0
for f in sorted(os.listdir(SRC)):
    base, ext = os.path.splitext(f)
    if ext.lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.gif'):
        continue
    src, dst = os.path.join(SRC, f), os.path.join(DST, base + '.webp')
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        continue
    try:
        im = Image.open(src)
        im = im.convert('RGBA') if im.mode in ('P', 'LA', 'RGBA') or 'transparency' in im.info else im.convert('RGB')
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=80, method=4)
        made += 1
    except Exception as e:
        print('skip', f, e, file=sys.stderr)
print('готово, новых превью:', made)
