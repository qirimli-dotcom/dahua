#!/usr/bin/env python3
"""Достаёт DATA из index.html старого формата (const DATA={...}) и пишет data.js для приложения.
Пример: python3 tools/index_to_data.py old_index.html 17.08.2026
Если твой скрипт синхронизации умеет писать сразу data.js — этот шаг не нужен.
Формат data.js:
  const PRICE={"date":"17.08.2026"};
  const DATA={"Раздел":[{"g":группа,"s":артикул,"d":описание,"sp":характеристики,"p":цена,"w":гарантия,"m":MPQ},...],...};
"""
import json, sys, os
src, date = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
i = s.index('const DATA=') + len('const DATA=')
data, _ = json.JSONDecoder().raw_decode(s[i:])
for items in data.values():
    for x in items:
        x.pop('img', None)
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('const PRICE=' + json.dumps({'date': date}, ensure_ascii=False) + ';\n')
    f.write('const DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('data.js:', sum(len(v) for v in data.values()), 'позиций,', len(data), 'разделов')
