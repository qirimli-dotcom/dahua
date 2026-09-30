Dahua — прайс IT-Trade (PWA)
============================

Что где
  index.html, app.css, app.js   — приложение
  data.js                       — прайс: PRICE (дата) и DATA (разделы и позиции)
  images.js, images/            — фото (формат прежний, папку images/ не трогал)
  thumbs/                       — превью 360px WebP для списков и офлайна
  sw.js, manifest.webmanifest   — офлайн-режим и установка на устройство
  assets/, vendor/              — логотипы, значки, шрифты для PDF, jsPDF и SheetJS
  tools/                        — скрипты для обновления

Установка
  Распаковать в корень репозитория поверх текущих файлов. Папка images/ остаётся как есть.
  Старый index.html заменяется: данные теперь живут в data.js, а не внутри страницы.

Обновление прайса
  1. Записать новый data.js (формат описан в tools/index_to_data.py).
     Если скрипт синхронизации по-прежнему собирает старый index.html:
       python3 tools/index_to_data.py старый_index.html 17.08.2026
  2. Если добавлялись фото: images/ + images.js как раньше, затем
       python3 tools/make_thumbs.py
  3. Залить на GitHub. Приложения у пользователей подтянут новый прайс при следующем
     запуске с интернетом, sw.js трогать не нужно.

Кабинет монтажников (Supabase, с версии 11)
  config.js      — адрес проекта Supabase и publishable-ключ. Пусто — кабинет выключен.
  admin.html     — твоя админка: https://dahua.it-trade.com.ru/admin.html
  Настройка Supabase — в архиве dahua_supabase_v11.zip (SQL + инструкция).
  Пока config.js пустой, каталог и КП работают как раньше.

Если менялся код приложения (app.js, app.css, sw.js) — поменять VERSION в sw.js.
