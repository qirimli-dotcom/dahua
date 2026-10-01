'use strict';
/* Dahua прайс IT-Trade — PWA. Данные: data.js (PRICE, DATA), images.js (IMAGES). */
(function () {
  const APP_VER = '13';
  const VAT = 22;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const mqPhone = matchMedia('(max-width:600px)');
  const mqDesk = matchMedia('(min-width:1201px)');
  const coarse = matchMedia('(pointer:coarse)').matches;

  /* ---------- данные ---------- */
  const PR = typeof PRICE !== 'undefined' ? PRICE : { date: '' };
  const IMG = typeof IMAGES !== 'undefined' ? IMAGES : {};
  const SHEETS = Object.keys(DATA);
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
  const compact = s => norm(s).replace(/[\s\-_\/]+/g, '');
  const cleanG = g => String(g || '').replace(/\s*_\s*/g, ' / ').replace(/C(?=ерия)/g, 'С').trim();
  const parsePrice = p => { const n = parseFloat(String(p == null ? '' : p).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n > 0 ? Math.round(n) : null; };
  const fmtW = w => { w = String(w || '').trim(); return !w || w === '-' || w === 'nan' ? '' : w.replace(/месяц(ев|а)?/, 'мес.'); };
  const money = (n, cur) => n == null ? 'По запросу' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + (cur === false ? '' : '\u00a0₽');

  const ITEMS = [], BYSKU = new Map();
  const CATS = SHEETS.map((name, ci) => {
    const items = [], groups = [];
    (DATA[name] || []).forEach(x => {
      if (!x || !x.s) return;
      const it = { s: String(x.s).trim(), g: x.g || '', d: x.d || '', sp: x.sp || '', w: x.w, m: x.m, ci, sheet: name, price: parsePrice(x.p) };
      it.hay = compact([it.s, it.d, it.sp, it.g, name].join(' '));
      it.sc = compact(it.s);
      items.push(it); ITEMS.push(it);
      if (!BYSKU.has(it.s)) BYSKU.set(it.s, it);
      if (it.g && groups.indexOf(it.g) < 0) groups.push(it.g);
    });
    return { name, items, groups };
  });

  const thumb = s => IMG[s] ? encodeURI(IMG[s].replace(/^images\//, 'thumbs/').replace(/\.[a-z0-9]+$/i, '.webp')) : '';
  const full = s => IMG[s] ? encodeURI(IMG[s]) : '';
  const imgTag = (s, cls) => { const t = thumb(s); return t ? `<img class="${cls}" loading="lazy" decoding="async" src="${t}" data-fb="${full(s)}" alt="">` : '<span class="noimg"></span>'; };
  document.addEventListener('error', e => {
    const im = e.target;
    if (im && im.tagName === 'IMG' && im.dataset.fb) { const f = im.dataset.fb; im.dataset.fb = ''; im.src = f; }
  }, true);

  /* ---------- состояние ---------- */
  const st = { sort: load('dh-sort', 'def'), q: '', base: '#/', rendered: '', limit: 120 };
  let KP = load('dh-kp', null) || {};
  function normKP(k) {
    k = k && typeof k === 'object' ? k : {};
    const items = Array.isArray(k.items) ? k.items : [];
    return {
      items: items.filter(r => Array.isArray(r) && BYSKU.has(r[0])).map(r => [r[0], Math.max(1, parseInt(r[1]) || 1), r[2] == null || r[2] === '' ? null : Number(r[2])]),
      client: k.client || '', gd: Number(k.gd) || (Number(k.adj) < 0 ? -Number(k.adj) : 0), srv: k.srv || null
    };
  }
  KP = normKP(KP);
  const FAV = new Set(load('dh-fav', []).filter(s => BYSKU.has(s)));
  const saveKP = () => save('dh-kp', KP);
  const saveFav = () => save('dh-fav', Array.from(FAV));
  const kpQty = s => { const r = KP.items.find(r => r[0] === s); return r ? r[1] : 0; };
  const lineDisc = r => r && r[2] != null ? r[2] : (Number(KP.gd) || 0);
  const discPrice = (it, d) => it.price == null ? null : Math.round(it.price * (1 - (Number(d) || 0) / 100));
  const unitPrice = it => discPrice(it, lineDisc(KP.items.find(x => x[0] === it.s)));

  /* ---------- монтажник: вход, закуп ---------- */
  let AUTH = load('dh-auth', null);
  if (AUTH && !AUTH.rt) AUTH = null;
  let showBuy = load('dh-buy', true);
  const inst = () => AUTH && AUTH.rec && AUTH.rec.status === 'active' ? AUTH.rec : null;
  const instDisc = () => { const i = inst(); return i ? Math.max(0, Math.min(90, Number(i.discount) || 0)) : 0; };
  const buyPrice = it => inst() && it.price != null ? Math.round(it.price * (1 - instDisc() / 100)) : null;
  const seeBuy = () => !!inst() && showBuy;
  const normPhone = v => { let d = String(v || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); if (d.length === 10) d = '7' + d; return d; };
  const fmtPhone = p => { p = String(p || ''); return p.length === 11 ? `+${p[0]} (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9)}` : p; };
  const SBC = window.DAHUA_SB || {};
  const API = SBC.url && SBC.key ? String(SBC.url).replace(/\/+$/, '') : '';
  const emailOf = phone => 'm' + phone + '@' + (SBC.domain || 'it-trade.com.ru');
  function sbMsg(j, code) {
    const c = String((j && (j.error_code || j.code)) || ''), m = String((j && (j.msg || j.message || j.error_description)) || '');
    if (c === 'user_already_exists' || /already registered/i.test(m)) return 'Этот телефон уже зарегистрирован';
    if (c === 'invalid_credentials' || /invalid login/i.test(m)) return 'Неверный телефон или пароль';
    if (c === 'email_not_confirmed' || /not confirmed/i.test(m)) return 'В Supabase включено подтверждение email — его нужно выключить';
    if (c === 'weak_password' || /password/i.test(m) && code === 422) return 'Пароль слишком простой — не короче 8 символов';
    if (/signups? not allowed|signup.*disabled/i.test(m)) return 'Регистрация сейчас закрыта';
    if (code === 429 || c === 'over_request_rate_limit') return 'Слишком много попыток, подождите минуту';
    if (/Database error saving new user/i.test(m)) return 'Проверьте номер телефона';
    if (code === 401 || code === 403 || c === '42501') return 'Нет доступа';
    return 'Ошибка сервера (' + code + ')';
  }
  async function sbReq(path, opt) {
    opt = opt || {};
    if (!API) throw new Error('Сервер ещё не подключён');
    const h = { apikey: SBC.key, 'Content-Type': 'application/json' };
    if (opt.token) h.Authorization = 'Bearer ' + opt.token;
    if (opt.prefer) h.Prefer = opt.prefer;
    let r;
    try { r = await fetch(API + path, { method: opt.method || 'GET', headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined, cache: 'no-store' }); }
    catch (e) { throw new Error(navigator.onLine ? 'Сервер недоступен, попробуйте позже' : 'Нет интернета'); }
    const tx = await r.text(); let j = null; try { j = tx ? JSON.parse(tx) : null; } catch (e) {}
    if (!r.ok) { const err = new Error(sbMsg(j, r.status)); err.status = r.status; throw err; }
    return j;
  }
  function setSession(j) {
    AUTH = Object.assign({}, AUTH || {}, { at: j.access_token, rt: j.refresh_token, exp: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), uid: (j.user && j.user.id) || (AUTH && AUTH.uid) });
    save('dh-auth', AUTH);
  }
  async function token() {
    if (!AUTH || !AUTH.rt) { const e = new Error('Войдите заново'); e.status = 401; throw e; }
    if ((AUTH.exp || 0) - 60 < Date.now() / 1000) {
      try { setSession(await sbReq('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: AUTH.rt } })); }
      catch (e) { if (e.status === 400) e.status = 401; throw e; }
    }
    return AUTH.at;
  }
  async function db(path, opt) {
    opt = opt || {};
    const m = opt.method || 'GET';
    return sbReq('/rest/v1/' + path, Object.assign({}, opt, { token: await token(), prefer: /^rpc\//.test(path) ? undefined : (m === 'POST' || m === 'PATCH') ? 'return=representation' : undefined }));
  }
  async function loadMe() {
    const r = await db('installers?select=*&id=eq.' + U(AUTH.uid));
    if (!r || !r.length) { const e = new Error('Профиль монтажника не найден'); e.status = 404; throw e; }
    return r[0];
  }
  const U = s => encodeURIComponent(s);

  function setQty(s, q) {
    q = Math.max(0, Math.min(99999, Math.floor(Number(q) || 0)));
    const i = KP.items.findIndex(r => r[0] === s);
    if (q === 0) { if (i >= 0) KP.items.splice(i, 1); }
    else if (i >= 0) KP.items[i][1] = q; else KP.items.push([s, q, null]);
    saveKP(); renderKP(); refreshAdds();
  }

  /* ---------- элементы ---------- */
  const view = $('#view'), side = $('#side'), kpEl = $('#kp'), sheet = $('#sheet'), qIn = $('#q');
  $('#priceDate').textContent = PR.date ? 'прайс от ' + PR.date : '';
  document.title = 'Dahua — прайс IT-Trade' + (PR.date ? ' от ' + PR.date : '');

  const top = $('#top');
  const setHH = () => document.documentElement.style.setProperty('--hh', top.offsetHeight + 'px');
  setHH(); if (window.ResizeObserver) new ResizeObserver(setHH).observe(top); else addEventListener('resize', setHH);


  /* блокировка прокрутки под шторками (в т.ч. iOS Safari) */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const lk = { on: false, y: 0, reset: false };
  function syncLock() {
    const b = document.body;
    const need = !sheet.hidden || !$('#modal').hidden || b.classList.contains('dd-open') || b.classList.contains('qs-open') || (b.classList.contains('kp-open') && !mqDesk.matches);
    if (need && !lk.on) { lk.on = true; lk.y = scrollY; b.style.top = -lk.y + 'px'; b.classList.add('locked'); }
    else if (!need && lk.on) { lk.on = false; b.classList.remove('locked'); b.style.top = ''; window.scrollTo(0, lk.reset ? 0 : lk.y); lk.reset = false; }
  }
  new MutationObserver(syncLock).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(syncLock).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(syncLock).observe($('#modal'), { attributes: true, attributeFilter: ['hidden'] });
  /* ---------- боковое меню ---------- */
  function renderSide(activeCi) {
    side.innerHTML = '<a href="#/"' + (activeCi === 'home' ? ' class="on"' : '') + '><span>Все разделы</span><em>' + ITEMS.length + '</em></a>' +
      '<a href="#/fav"' + (activeCi === 'fav' ? ' class="on"' : '') + '><span>Избранное</span><em>' + FAV.size + '</em></a>' +
      (inst() ? '<div class="sh">Кабинет</div>' + [['orders', 'Заказы'], ['clients', 'Клиенты'], ['report', 'Отчёт'], ['me', 'Профиль']].map(([k, l]) => `<a href="#/${k}"${activeCi === k ? ' class="on"' : ''}><span>${l}</span><em>›</em></a>`).join('') + '<div class="sh">Каталог</div>'
        : (API ? '<a href="#/me"' + (activeCi === 'me' ? ' class="on"' : '') + '><span>' + (AUTH ? 'Кабинет монтажника' : 'Я монтажник') + '</span><em>›</em></a>' : '') + '<div class="sep"></div>') +
      CATS.map((c, i) => `<a href="#/c/${i}"${activeCi === i ? ' class="on"' : ''}><span>${esc(c.name)}</span><em>${c.items.length}</em></a>`).join('');
    const on = $('.on', side); if (on && on.scrollIntoView && typeof activeCi === 'number') on.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- карточки ---------- */
  function card(it, showSheet, hl) {
    const q = kpQty(it.s);
    return `<article class="card" data-s="${esc(it.s)}">
<button class="ph" data-open aria-label="Открыть ${esc(it.s)}">${imgTag(it.s, 'im')}</button>
${showSheet ? `<div class="shn">${esc(it.sheet)}</div>` : ''}<button class="sku" data-open title="${esc(it.s)}">${hl ? hl(it.s) : esc(it.s)}</button>
<div class="ds">${hl ? hl(it.d) : esc(it.d)}</div>
<div class="bt"><div><b${it.price == null ? ' class="req"' : ''}>${money(it.price)}</b>${seeBuy() && it.price != null ? `<span class="buy">закуп ${money(buyPrice(it))}</span>` : `<span>${esc(fmtW(it.w))}</span>`}</div>
<div class="cb">${it.sp ? '<button class="inf" data-info aria-label="Характеристики" title="Характеристики">i</button>' : ''}<button class="add${q ? ' on' : ''}" data-add aria-label="${q ? 'В КП: ' + q + ' шт' : 'Добавить в КП'}">${q ? q : '+'}</button></div></div></article>`;
  }
  function refreshAdds() {
    $$('.card', view).forEach(c => {
      const q = kpQty(c.dataset.s), b = $('.add', c); if (!b) return;
      b.classList.toggle('on', !!q); b.textContent = q ? q : '+';
      b.setAttribute('aria-label', q ? 'В КП: ' + q + ' шт' : 'Добавить в КП');
    });
  }
  function sortItems(list) {
    if (st.sort === 'def') return list;
    const k = st.sort === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => (a.price == null) - (b.price == null) || k * ((a.price || 0) - (b.price || 0)));
  }
  const sortSel = () => { const sh = mqPhone.matches, p = sh ? '' : 'Сортировка: ';
    return `<select class="sort" id="sortSel" aria-label="Сортировка">
<option value="def"${st.sort === 'def' ? ' selected' : ''}>${p}${sh ? 'Как в прайсе' : 'как в прайсе'}</option>
<option value="asc"${st.sort === 'asc' ? ' selected' : ''}>${p}${sh ? 'Цена ↑' : 'цена ↑'}</option>
<option value="desc"${st.sort === 'desc' ? ' selected' : ''}>${p}${sh ? 'Цена ↓' : 'цена ↓'}</option></select>`; };

  /* ---------- экраны ---------- */
  function vHome() {
    renderSide('home');
    view.innerHTML = `<div class="hero"><h1>Прайс Dahua</h1><p>${ITEMS.length.toLocaleString('ru-RU')} позиций, ${CATS.length} разделов${PR.date ? ', от ' + esc(PR.date) : ''}</p></div>
<div class="cats">${CATS.map((c, i) => {
      const f = c.items.find(x => IMG[x.s]);
      return `<a class="catc" href="#/c/${i}"><b>${esc(c.name)}</b><span>${c.items.length} поз.</span>${f ? `<img loading="lazy" src="${thumb(f.s)}" data-fb="${full(f.s)}" alt="">` : ''}</a>`;
    }).join('')}</div>`;
  }
  /* группы раздела для фильтра «Серия»: «Тип _ Серия» -> заголовок типа + серии */
  function splitG(g) {
    g = String(g || '').replace(/C(?=ерия)/g, 'С');
    const i = g.indexOf('_');
    if (i < 0) return [g.trim().replace(/\s+/g, ' '), ''];
    return [g.slice(0, i).trim().replace(/\s+/g, ' '), g.slice(i + 1).replace(/\s*Серия\s*/g, ' ').trim()];
  }
  function groupModel(c) {
    if (c.model) return c.model;
    const cnt = g => c.items.filter(x => x.g === g).length, rows = [];
    if (!c.groups.some(g => g.indexOf('_') >= 0)) {
      c.groups.forEach((g, gi) => rows.push({ t: 'i', gi: [gi], label: cleanG(g), tag: cleanG(g), n: cnt(g) }));
    } else {
      const order = [], map = {};
      c.groups.forEach((g, gi) => { const [tp, sr] = splitG(g); if (!map[tp]) { map[tp] = []; order.push(tp); } map[tp].push({ gi, sr, n: cnt(g) }); });
      const labels = {}; order.forEach(tp => map[tp].forEach(a => { const l = a.sr || tp; labels[l] = (labels[l] || 0) + 1; }));
      order.forEach(tp => {
        const arr = map[tp];
        if (arr.length === 1 && !arr[0].sr) { rows.push({ t: 'i', gi: [arr[0].gi], label: tp, tag: tp, n: arr[0].n }); return; }
        rows.push({ t: 'h', gi: arr.map(a => a.gi), label: tp, n: arr.reduce((s, a) => s + a.n, 0) });
        arr.forEach(a => { const l = a.sr || tp; rows.push({ t: 'i', gi: [a.gi], label: l, tag: labels[l] > 1 ? tp + ' ' + l : l, n: a.n, sub: true }); });
      });
    }
    c.model = rows; c.tagOf = {}; rows.forEach(r => { if (r.t === 'i') c.tagOf[r.gi[0]] = r.tag; });
    return rows;
  }
  const parseSel = (c, str) => new Set(String(str || '').split(',').filter(x => x !== '' && !isNaN(x)).map(Number).filter(n => n >= 0 && n < c.groups.length));
  const selHash = (ci, set) => '#/c/' + ci + (set.size ? '/' + Array.from(set).sort((a, b) => a - b).join(',') : '');
  const dd = { open: false, ci: null, pending: null, sel: null };

  function vCat(ci, selStr) {
    const c = CATS[ci]; if (!c) return vHome();
    renderSide(ci);
    const sel = parseSel(c, selStr), hasF = c.groups.length > 1;
    if (hasF) groupModel(c);
    let list = sel.size ? c.items.filter(x => sel.has(c.groups.indexOf(x.g))) : c.items;
    list = sortItems(list);
    let body = '', lastG = null;
    const withHeads = st.sort === 'def' && new Set(list.map(x => x.g)).size > 1;
    list.forEach(it => {
      if (withHeads && it.g !== lastG) { lastG = it.g; body += `<div class="gh">${esc(cleanG(it.g))}</div>`; }
      body += card(it);
    });
    const btnLab = !sel.size ? 'Серия' : sel.size === 1 ? 'Серия: ' + esc(c.tagOf[Array.from(sel)[0]]) : (mqPhone.matches ? 'Серия (' + sel.size + ')' : 'Серия: выбрано ' + sel.size);
    const fbar = `<div class="fbar">${hasF ? `<div class="ddw" id="ddw"><button type="button" class="dd${sel.size ? ' act' : ''}" id="ddBtn" aria-haspopup="true" aria-expanded="false"><span>${btnLab}</span><b>▾</b></button><div class="pop" id="ddPop" hidden></div></div>` : ''}${sortSel()}</div>`;
    const tags = sel.size ? `<div class="ftags">${Array.from(sel).sort((a, b) => a - b).map(gi => `<button type="button" data-untag="${gi}">${esc(c.tagOf[gi])} <i>✕</i></button>`).join('')}<button type="button" class="lnk" data-clearall>Сбросить всё</button></div>` : '';
    view.innerHTML = `<div class="ttl"><a class="back" href="#/" aria-label="Все разделы">‹</a><h1>${esc(c.name)}</h1><span class="n">${sel.size ? list.length + ' из ' + c.items.length : list.length} поз.</span>${fbar}</div>${tags}<div class="grid">${body}</div>`;
    dd.open = false; dd.ci = ci; dd.sel = sel; document.body.classList.remove('dd-open');
  }
  function ddRender() {
    const c = CATS[dd.ci], rows = groupModel(c), P = dd.pending;
    const n = P.size ? c.items.filter(x => P.has(c.groups.indexOf(x.g))).length : c.items.length;
    $('#ddPop').innerHTML = `<div class="pop-h"><b>Серия</b><button type="button" class="pop-x" data-ddclose aria-label="Закрыть">✕</button></div><div class="pop-l">${rows.map(r => {
      if (r.t === 'h') { const all = r.gi.every(g => P.has(g)), some = r.gi.some(g => P.has(g)); return `<button type="button" class="ckh${all ? ' on' : some ? ' part' : ''}" data-h="${r.gi.join(',')}"><i></i><span>${esc(r.label)}</span><em>${r.n}</em></button>`; }
      const on = P.has(r.gi[0]); return `<button type="button" class="ck${on ? ' on' : ''}${r.sub ? ' sub' : ''}" data-gi="${r.gi[0]}" role="menuitemcheckbox" aria-checked="${on}"><i></i><span>${esc(r.label)}</span><em>${r.n}</em></button>`;
    }).join('')}</div><div class="pf"><button type="button" class="lnk" data-reset>Сбросить</button><button type="button" class="ok" data-apply>Показать ${n}</button></div>`;
  }
  function ddOpen() { if (!$('#ddPop')) return; dd.pending = new Set(dd.sel); dd.open = true; ddRender(); $('#ddPop').hidden = false; $('#ddBtn').setAttribute('aria-expanded', 'true'); $('#ddw').classList.add('open'); if (mqPhone.matches) document.body.classList.add('dd-open'); }
  function ddClose() { if (!dd.open) return; dd.open = false; const p = $('#ddPop'); if (p) p.hidden = true; const b = $('#ddBtn'); if (b) b.setAttribute('aria-expanded', 'false'); const w = $('#ddw'); if (w) w.classList.remove('open'); document.body.classList.remove('dd-open'); }
  function ddApply(set) { const h = selHash(dd.ci, set); ddClose(); if (location.hash !== h) location.hash = h; }

  const RU = 'йцукенгшщзхъфывапролджэячсмитьбю', EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
  const swapLayout = s => s.replace(/[а-я]/g, ch => { const i = RU.indexOf(ch); return i >= 0 ? EN[i] : ch; });
  function search(q) {
    let n = norm(q).replace(/(\d)[\s,.]*(?=(мп|mp|мм|mm|тб|tb|гб|gb|порт|кан|ch|дюйм|вт\b|w\b))/g, '$1');
    const run = str => {
      const toks = str.split(/\s+/).map(compact).filter(Boolean);
      if (!toks.length) return [];
      const joined = toks.join(''), seen = new Set(), res = [];
      ITEMS.forEach(it => {
        if (seen.has(it.s)) return;
        let ok = toks.every(t => it.hay.indexOf(t) >= 0) || (toks.length > 1 && it.sc.indexOf(joined) >= 0);
        if (!ok) return;
        seen.add(it.s);
        const r = it.sc === joined ? 0 : it.sc.indexOf(joined) === 0 ? 1 : it.sc.indexOf(joined) >= 0 ? 2 : it.sc.indexOf(toks[0]) >= 0 ? 3 : 4;
        res.push([r, it]);
      });
      return res.sort((a, b) => a[0] - b[0]).map(x => x[1]);
    };
    let res = run(n);
    if (!res.length && /[а-я]/.test(n)) res = run(swapLayout(n));
    return res;
  }
  function highlighter(q) {
    const toks = norm(q).split(/\s+/).filter(t => t.length > 1).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!toks.length) return null;
    const re = new RegExp('(' + toks.join('|') + ')', 'gi');
    return s => esc(s).replace(re, '<mark>$1</mark>');
  }
  function vSearch(q) {
    renderSide(null);
    const res = sortItems(search(q)), hl = highlighter(q);
    $('#qn').textContent = res.length + ' найдено';
    if (!res.length) { view.innerHTML = `<div class="empty"><b>Ничего не нашлось по «${esc(q)}»</b>Попробуйте часть артикула, например «2249» или «HFW», или слова «купол 4 мп».</div>`; return; }
    const shown = res.slice(0, st.limit);
    view.innerHTML = `<div class="ttl"><h1>Поиск: «${esc(q)}»</h1><span class="n">${res.length} поз.</span><div class="fbar">${sortSel()}</div></div>
<div class="grid">${shown.map(it => card(it, true, hl)).join('')}</div>${res.length > shown.length ? `<button class="more-btn" id="moreBtn">Показать ещё ${Math.min(120, res.length - shown.length)} из ${res.length - shown.length}</button>` : ''}`;
  }
  function vFav() {
    renderSide('fav');
    const list = sortItems(Array.from(FAV).map(s => BYSKU.get(s)).filter(Boolean));
    view.innerHTML = `<div class="ttl"><a class="back" href="#/" aria-label="Все разделы">‹</a><h1>Избранное</h1><span class="n">${list.length} поз.</span>${list.length ? '<div class="fbar">' + sortSel() + '</div>' : ''}</div>` +
      (list.length ? `<div class="grid">${list.map(it => card(it, true)).join('')}</div>` : '<div class="empty"><b>Пока пусто</b>Отмечайте товары сердечком в карточке, чтобы быстро к ним возвращаться.</div>');
  }

  /* ---------- роутер ---------- */
  function parse(h) { return (h || '#/').replace(/^#\/?/, '').split('/').map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } }); }
  function renderBase(h, force) {
    closeQP();
    if (!force && st.rendered === h) return;
    const p = parse(h);
    if (p[0] !== 's') { st.q = ''; if (qIn.value && document.activeElement !== qIn) qIn.value = ''; $('#qx').hidden = !qIn.value; $('#qn').textContent = ITEMS.length.toLocaleString('ru-RU'); }
    if (p[0] === 'c') vCat(+p[1], p[2]);
    else if (p[0] === 's' && p[1]) { st.q = p[1]; if (qIn.value !== p[1] && document.activeElement !== qIn) qIn.value = p[1]; $('#qx').hidden = false; vSearch(p[1]); }
    else if (p[0] === 'fav') vFav();
    else if (p[0] === 'me') vMe();
    else if (p[0] === 'clients') vClients();
    else if (p[0] === 'orders' || p[0] === 'cab') vOrders();
    else if (p[0] === 'report') vReport();
    else if (p[0] === 'kpw') vKPW();
    else if (p[0] === 'client' && p[1]) vClient(p[1]);
    else vHome();
    document.body.classList.toggle('cab-wide', ['orders', 'cab', 'clients', 'client', 'report', 'kpw'].includes(p[0]));
    const scrollTop = st.rendered !== h; st.rendered = h; st.base = h;
    if (scrollTop) { if (lk.on) lk.reset = true; else window.scrollTo(0, 0); }
    setTab(p[0] === 'fav' ? 'fav' : p[0] === 's' ? 'search' : ['clients', 'client', 'me', 'orders', 'cab', 'report'].includes(p[0]) ? 'fav' : p[0] === 'kpw' ? 'kp' : 'cat');
  }
  let sheetPushed = false, kpPushed = false;
  function route() {
    const h = location.hash || '#/', p = parse(h);
    closeSheetUI();
    if (p[0] === 'p' && p[1]) { if (!st.rendered) renderBase('#/'); openSheet(p[1]); return; }
    if (p[0] === 'kp') {
      if (!st.rendered) renderBase('#/');
      if (mqDesk.matches) { kpEl.scrollTop = 0; const f = $('#kpClient'); if (f) f.focus(); return; }
      document.body.classList.add('kp-open'); setTab('kp'); return;
    }
    document.body.classList.remove('kp-open'); kpPushed = false;
    renderBase(h);
  }
  function goBackOr(fallback, pushedFlag) { if (pushedFlag && history.length > 1) history.back(); else location.replace(fallback || '#/'); }
  addEventListener('hashchange', route);
  function setTab(t) { $$('#tabbar [data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === t)); }

  /* ---------- поиск ---------- */
  let qt;
  qIn.addEventListener('input', () => {
    $('#qx').hidden = !qIn.value;
    clearTimeout(qt);
    qt = setTimeout(() => {
      const v = qIn.value.trim(); st.limit = 120;
      if (v.length >= 2) { const h = '#/s/' + encodeURIComponent(v); if (/^#\/s\//.test(location.hash)) history.replaceState(null, '', h); else history.pushState(null, '', h); renderBase(h, true); }
      else if (!v && /^#\/s\//.test(location.hash)) location.replace('#/');
    }, 220);
  });
  qIn.addEventListener('keydown', e => { if (e.key === 'Enter') { qIn.blur(); } if (e.key === 'Escape') { qIn.value = ''; qIn.dispatchEvent(new Event('input')); } });
  $('#qx').addEventListener('click', () => { qIn.value = ''; qIn.dispatchEvent(new Event('input')); qIn.focus(); });
  $('#tabSearch').addEventListener('click', () => { window.scrollTo(0, 0); qIn.focus(); });
  addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); qIn.focus(); qIn.select(); }
    if (e.key === 'Escape') {
      if (!$('#zoom').hidden) { $('#zoom').hidden = true; return; }
      if (!$('#modal').hidden) { closeModal(); return; }
      if (!$('#menu').hidden) { closeMenu(); return; }
      if (dd.open) { ddClose(); return; }
      if ($('.spv', view)) { closeInfo(); return; }
      if (qp) { closeQP(); return; }
      if (!sheet.hidden) { closeSheet(); return; }
      if (document.body.classList.contains('kp-open')) closeKP();
    }
  });

  /* ---------- клики в списках ---------- */
  function openProduct(s) { sheetPushed = true; location.hash = '#/p/' + encodeURIComponent(s); }
  view.addEventListener('click', e => {
    if (dd.open && e.target.id === 'ddw') { ddClose(); return; }
    if (e.target.closest('#ddBtn')) { dd.open ? ddClose() : ddOpen(); return; }
    if (dd.open && e.target.closest('#ddPop')) {
      const P = dd.pending, t = e.target;
      if (t.closest('[data-ddclose]')) return ddClose();
      if (t.closest('[data-apply]')) return ddApply(P);
      if (t.closest('[data-reset]')) { P.clear(); return ddRender(); }
      const h = t.closest('[data-h]');
      if (h) { const gs = h.dataset.h.split(',').map(Number), all = gs.every(g => P.has(g)); gs.forEach(g => all ? P.delete(g) : P.add(g)); return ddRender(); }
      const it = t.closest('[data-gi]');
      if (it) { const g = +it.dataset.gi; P.has(g) ? P.delete(g) : P.add(g); return ddRender(); }
      return;
    }
    const ut = e.target.closest('[data-untag]');
    if (ut) { const s2 = new Set(dd.sel); s2.delete(+ut.dataset.untag); location.hash = selHash(dd.ci, s2); return; }
    if (e.target.closest('[data-clearall]')) { location.hash = selHash(dd.ci, new Set()); return; }
    if (e.target.closest('.qp')) { qpClick(e); return; }
    const c = e.target.closest('.card');
    if (e.target.closest('#moreBtn')) { st.limit += 120; const y = scrollY; vSearch(st.q); scrollTo(0, y); return; }
    if (!c) return;
    if (e.target.closest('[data-infox]')) { closeInfo(); return; }
    if (e.target.closest('[data-info]')) { toggleInfo(c); return; }
    if (e.target.closest('.spv') && !e.target.closest('[data-open]')) return;
    if (e.target.closest('[data-add]')) { openQP(c); return; }
    if (e.target.closest('[data-open]')) openProduct(c.dataset.s);
  });
  function closeInfo() { $$('.spv', view).forEach(x => x.remove()); $$('.inf.on', view).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); }); }
  function toggleInfo(c) {
    const open = $('.spv', c); closeInfo(); if (open) return;
    const it = BYSKU.get(c.dataset.s); if (!it) return;
    const specs = String(it.sp || '').split(';').map(x => x.trim()).filter(Boolean);
    c.insertAdjacentHTML('beforeend', `<div class="spv" role="dialog" aria-label="Характеристики ${esc(it.s)}"><div class="spv-h"><b>${esc(it.s)}</b><button type="button" data-infox aria-label="Закрыть">✕</button></div>
<div class="spv-d">${esc(it.d)}</div><ul>${specs.map(x => `<li>${esc(x)}</li>`).join('')}</ul><button type="button" class="spv-more" data-open>Подробнее и в КП</button></div>`);
    const b = $('.inf', c); b.classList.add('on'); b.setAttribute('aria-expanded', 'true');
  }
  document.addEventListener('click', e => { if ($('.spv', view) && !e.target.closest('.spv') && !e.target.closest('[data-info]')) closeInfo(); });

  /* ---------- выбор количества по «+» ---------- */
  let qp = null;
  function qpChips(it) {
    const m = parseInt(it.m) || 0, base = [1, 5, 10];
    if (m > 0 && base.indexOf(m) < 0) base.push(m); else base.push(20);
    return base.map(n => ({ n, pk: n === m }));
  }
  function qpInner() {
    const it = BYSKU.get(qp.s), u = unitPrice(it), inKp = kpQty(qp.s), q = qp.q;
    const sum = u != null && q > 0 ? ' · ' + money(u * q) : '';
    return `${qp.phone ? `<button type="button" class="x" data-qx aria-label="Закрыть">✕</button><div class="it">${imgTag(qp.s, '')}<div><b>${esc(qp.s)}</b><span>${u != null ? money(u) + ' за шт' : 'цена по запросу'}${parseInt(it.m) > 0 ? ', упаковка ' + parseInt(it.m) + ' шт' : ''}</span></div></div>`
      : `<div class="qp-h"><b>${esc(qp.s)}</b><button type="button" data-qx aria-label="Закрыть">✕</button></div>`}
<div class="stp"><button type="button" data-qdec aria-label="Меньше">−</button><input id="qpIn" inputmode="numeric" pattern="[0-9]*" value="${q || ''}" aria-label="Количество"><button type="button" data-qinc aria-label="Больше">+</button></div>
<div class="qp-q">${qpChips(it).map(c => `<button type="button" data-qset="${c.n}"${c.n === q ? ' class="on"' : ''}>${c.n}${c.pk ? '<small>упак.</small>' : ''}</button>`).join('')}</div>
<button type="button" class="qp-go" data-qgo${q > 0 ? '' : ' disabled'}>${inKp ? 'Обновить' : 'В КП'} <span>${q > 0 ? q + ' шт' + sum : ''}</span></button>${inKp ? '<button type="button" class="qp-del" data-qdel>Убрать из КП</button>' : ''}`;
  }
  function qpUpdate(keepInput) {
    const root = qp.el, it = BYSKU.get(qp.s), u = unitPrice(it), q = qp.q, inKp = kpQty(qp.s);
    if (!keepInput) $('#qpIn', root).value = q || '';
    $$('[data-qset]', root).forEach(b => b.classList.toggle('on', +b.dataset.qset === q));
    const g = $('[data-qgo]', root); g.disabled = !(q > 0);
    g.innerHTML = `${inKp ? 'Обновить' : 'В КП'} <span>${q > 0 ? q + ' шт' + (u != null ? ' · ' + money(u * q) : '') : ''}</span>`;
  }
  function openQP(card) {
    const s = card.dataset.s;
    if (qp && qp.s === s && !qp.phone) { closeQP(); return; }
    closeQP(); closeInfo();
    if (!BYSKU.has(s)) return;
    qp = { s, q: kpQty(s) || 1, phone: mqPhone.matches };
    if (qp.phone) {
      const w = document.createElement('div'); w.id = 'qs';
      w.innerHTML = '<div class="qs-bg" data-qx></div><div class="qs" role="dialog" aria-label="Количество"></div>';
      document.body.appendChild(w); qp.el = $('.qs', w); qp.el.innerHTML = qpInner(); document.body.classList.add('qs-open');
    } else {
      card.insertAdjacentHTML('beforeend', '<div class="qp" role="dialog" aria-label="Количество"></div>');
      qp.el = $('.qp', card); qp.el.innerHTML = qpInner();
      const i = $('#qpIn', qp.el); i.focus(); i.select();
    }
  }
  function closeQP() {
    if (!qp) return;
    if (qp.phone) { const w = $('#qs'); if (w) w.remove(); document.body.classList.remove('qs-open'); }
    else if (qp.el) qp.el.remove();
    qp = null;
  }
  function qpGo() {
    if (!qp || !(qp.q > 0)) return;
    const s = qp.s, q = qp.q, had = kpQty(s);
    setQty(s, q); closeQP();
    toast((had ? 'Обновлено в КП: ' : 'Добавлено в КП: ') + s + ', ' + q + ' шт', 'Открыть', () => { location.hash = '#/kp'; });
  }
  function qpClick(e) {
    if (!qp) return;
    const t = e.target;
    if (t.closest('[data-qx]')) return closeQP();
    if (t.closest('[data-qdec]')) { qp.q = Math.max(1, (qp.q || 1) - 1); return qpUpdate(); }
    if (t.closest('[data-qinc]')) { qp.q = Math.min(99999, (qp.q || 0) + 1); return qpUpdate(); }
    const st = t.closest('[data-qset]'); if (st) { qp.q = +st.dataset.qset; return qpUpdate(); }
    if (t.closest('[data-qgo]')) return qpGo();
    if (t.closest('[data-qdel]')) { const s = qp.s; setQty(s, 0); closeQP(); toast('Убрано из КП: ' + s); }
  }
  document.addEventListener('click', e => {
    if (!qp) return;
    if (qp.phone) { if (e.target.closest('#qs')) qpClick(e); return; }
    if (!e.composedPath().some(n => n.classList && (n.classList.contains('qp') || n.classList.contains('add')))) closeQP();
  });
  document.addEventListener('input', e => {
    if (!qp || e.target.id !== 'qpIn') return;
    const v = e.target.value.replace(/\D/g, '').slice(0, 5); if (v !== e.target.value) e.target.value = v;
    qp.q = parseInt(v) || 0; qpUpdate(true);
  });
  document.addEventListener('keydown', e => { if (qp && e.target.id === 'qpIn' && e.key === 'Enter') { e.preventDefault(); qpGo(); } });
  view.addEventListener('change', e => {
    if (e.target.id === 'sortSel') { st.sort = e.target.value; save('dh-sort', st.sort); renderBase(st.base, true); }
  });

  /* ---------- карточка товара ---------- */
  function openSheet(s) {
    const it = BYSKU.get(s);
    if (!it) { location.replace(st.base || '#/'); return; }
    const inKp = kpQty(s), q = inKp || 1;
    const specs = String(it.sp || '').split(';').map(x => x.trim()).filter(Boolean);
    const f = full(s), t = thumb(s);
    sheet.innerHTML = `<div class="sh-bg" data-close></div>
<div class="sh-box" role="dialog" aria-modal="true" aria-label="${esc(s)}">
<button class="sh-x" data-close aria-label="Закрыть">✕</button>
<div class="sh-ph" data-zoom>${f ? `<img src="${f}" data-fb="${t}" alt="${esc(s)}">` : '<span class="noimg"></span>'}</div>
<div class="sh-in">
<div class="sh-g">${esc(it.sheet)}${it.g ? ' / ' + esc(cleanG(it.g)) : ''}</div>
<h2><span>${esc(s)}</span><button class="icon" data-copy title="Скопировать артикул" aria-label="Скопировать артикул">⧉</button><button class="icon" data-share title="Поделиться ссылкой" aria-label="Поделиться ссылкой">↗</button></h2>
<p class="sh-d">${esc(it.d)}</p>
${specs.length ? `<div class="tags">${specs.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
<dl class="meta">${fmtW(it.w) ? `<div><dt>Гарантия</dt><dd>${esc(it.w)}</dd></div>` : ''}${it.m ? `<div><dt>В упаковке (MPQ)</dt><dd>${esc(it.m)} шт</dd></div>` : ''}</dl>
</div>
<div class="sh-buy"><div class="pp"><b>${money(it.price)}</b><span>${it.price != null ? 'РРЦ' : 'цена уточняется'}${seeBuy() && it.price != null ? ` · <em class="buy">закуп ${money(buyPrice(it))}</em>` : ''}</span></div>
<button class="fav${FAV.has(s) ? ' on' : ''}" data-fav aria-label="Избранное">${FAV.has(s) ? '♥' : '♡'}</button>
<div class="stp"><button data-dec aria-label="Меньше">−</button><input id="shQ" inputmode="numeric" pattern="[0-9]*" value="${q}" aria-label="Количество"><button data-inc aria-label="Больше">+</button></div>
<button class="btn" data-tokp>${inKp ? 'Обновить' : 'В КП'}</button></div></div>`;
    sheet.hidden = false; sheet.dataset.s = s;
    setTimeout(() => { const b = $('[data-tokp]', sheet); if (b && !coarse) b.focus(); }, 30);
  }
  function closeSheetUI() { if (!sheet.hidden) { sheet.hidden = true; sheet.innerHTML = ''; } }
  function closeSheet() { const f = sheetPushed; sheetPushed = false; goBackOr(st.base, f); }
  sheet.addEventListener('click', e => {
    const s = sheet.dataset.s, qi = $('#shQ', sheet);
    if (e.target.closest('[data-close]')) return closeSheet();
    if (e.target.closest('[data-zoom]')) { const im = $('.sh-ph img', sheet); if (im) { $('#zoom img').src = im.currentSrc || im.src; $('#zoom').hidden = false; } return; }
    if (e.target.closest('[data-dec]')) { qi.value = Math.max(1, (parseInt(qi.value) || 1) - 1); return; }
    if (e.target.closest('[data-inc]')) { qi.value = (parseInt(qi.value) || 0) + 1; return; }
    if (e.target.closest('[data-copy]')) { copy(s).then(() => toast('Артикул скопирован')); return; }
    if (e.target.closest('[data-share]')) { shareLink(s); return; }
    if (e.target.closest('[data-fav]')) {
      FAV.has(s) ? FAV.delete(s) : FAV.add(s); saveFav(); updateBadges();
      const b = e.target.closest('[data-fav]'); b.classList.toggle('on', FAV.has(s)); b.textContent = FAV.has(s) ? '♥' : '♡';
      if (/^#\/?fav/.test(st.base)) st.rendered = '';
      return;
    }
    if (e.target.closest('[data-tokp]')) {
      const had = kpQty(s); setQty(s, parseInt(qi.value) || 1);
      toast((had ? 'Обновлено в КП: ' : 'Добавлено в КП: ') + s, 'Открыть', () => { location.hash = '#/kp'; });
      closeSheet();
    }
  });
  $('#zoom').addEventListener('click', () => { $('#zoom').hidden = true; });
  function copy(t) { if (navigator.clipboard) return navigator.clipboard.writeText(t).catch(() => fallbackCopy(t)); fallbackCopy(t); return Promise.resolve(); }
  function fallbackCopy(t) { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }
  function shareLink(s) {
    const url = location.href.split('#')[0] + '#/p/' + encodeURIComponent(s), it = BYSKU.get(s);
    if (navigator.share) navigator.share({ title: s, text: s + ' — ' + it.d + (it.price != null ? ', ' + money(it.price) : ''), url }).catch(() => {});
    else copy(url).then(() => toast('Ссылка скопирована'));
  }

  /* ---------- КП ---------- */
  const KST = { draft: 'черновик', sent: 'отправлено', agreed: 'согласовано', ordered: 'заказано', done: 'смонтировано', cancel: 'отменено' };
  function kpTotals() {
    let sum = 0, rrp = 0, buy = 0, pcs = 0, unknown = 0, anyDisc = false;
    KP.items.forEach(r => {
      const it = BYSKU.get(r[0]), qn = r[1], d = lineDisc(r), u = discPrice(it, d);
      pcs += qn; if (d) anyDisc = true;
      if (u == null) unknown++; else { sum += u * qn; rrp += it.price * qn; const bp = buyPrice(it); if (bp != null) buy += bp * qn; }
    });
    return { sum, rrp, buy, pcs, unknown, anyDisc, disc: rrp - sum, profit: sum - buy, n: KP.items.length, vat: Math.round(sum * VAT / (100 + VAT)) };
  }
  function renderKP() {
    const t = kpTotals(), gd = Number(KP.gd) || 0, sb = seeBuy(), me = inst();
    const active = document.activeElement, activeId = active && active.id, activeS = active && active.closest && active.closest('.kr') ? active.closest('.kr').dataset.s : null;
    const srv = KP.srv && KP.srv.id ? KP.srv : null;
    kpEl.innerHTML = `<div class="kp-h"><h2>${srv ? 'КП № ' + srv.num : 'Коммерческое предложение'}</h2>${t.n || KP.srv ? '<button class="lnk" data-clear>' + (KP.srv ? 'Новое' : 'Очистить') + '</button>' : ''}${t.n ? '<a class="lnk kp-wide" href="#/kpw">Развернуть</a>' : ''}<button class="kp-x" data-kpclose aria-label="Закрыть">✕</button></div>
${srv ? `<div class="kp-srv"><span>${esc(KP.srv.clientName || 'без клиента')}</span><select id="kpStatus" aria-label="Статус КП">${Object.keys(KST).map(k => `<option value="${k}"${srv.status === k ? ' selected' : ''}>${KST[k]}</option>`).join('')}</select></div>` : ''}
<div class="kp-f"><label class="fld"><small>Клиент</small><input id="kpClient" value="${esc(KP.client)}" placeholder="название или имя" autocomplete="off"></label>
<label class="fld"><small>Скидка клиенту на всё</small><input id="kpGd" type="number" inputmode="decimal" step="1" min="0" max="90" value="${gd || ''}" placeholder="0"><small>%</small></label></div>
<div class="kp-list">${t.n ? KP.items.map(r => {
      const [s, qn] = r, it = BYSKU.get(s), d = lineDisc(r), u = discPrice(it, d), bp = buyPrice(it);
      return `<div class="kr" data-s="${esc(s)}"><button class="kph" data-open aria-label="Открыть ${esc(s)}">${imgTag(s, '')}</button>
<div class="kb"><button class="sku" data-open>${esc(s)}</button><div class="kd">${esc(it.d)}</div>
<div class="kq"><div class="stp sm"><button data-dec aria-label="Меньше">−</button><input inputmode="numeric" pattern="[0-9]*" value="${qn}" aria-label="Количество"><button data-inc aria-label="Больше">+</button></div>
<button class="kdisc${r[2] != null ? ' own' : d ? ' on' : ''}" data-ldisc title="Скидка на позицию">${d ? '−' + d + ' %' : 'скидка'}</button><b>${u == null ? '—' : money(u * qn)}</b></div>
<div class="ku">${u == null ? 'цена по запросу' : (d ? `<s>${money(it.price)}</s> ` : '') + money(u) + ' за шт'}${sb && bp != null ? ` <em class="buy">закуп ${money(bp * qn)}</em>` : ''}</div></div>
<button class="kx" data-del aria-label="Удалить">✕</button></div>`;
    }).join('') : '<div class="kp-empty">КП пока пустое.<br>Добавляйте товары кнопкой «+» в каталоге.</div>'}</div>
<div class="kp-s"><div><span>Позиций / штук</span><span>${t.n} / ${t.pcs}</span></div>${t.anyDisc ? `<div><span>По РРЦ</span><span>${money(t.rrp)}</span></div><div><span>Скидка клиенту</span><span class="red">−${money(t.disc)}</span></div>` : ''}<div><span>в т.ч. НДС ${VAT} %</span><span>${money(t.vat)}</span></div><div class="t"><span>Итого</span><span>${money(t.sum)}</span></div>
${sb && t.n ? `<div class="bz"><span>Ваш закуп (−${instDisc()} %)</span><span>${money(t.buy)}</span></div><div class="bz pr"><span>Ваша прибыль</span><span>${money(t.profit)}${t.sum ? ' · ' + Math.round(t.profit / t.sum * 100) + ' %' : ''}</span></div>` : ''}
${t.unknown ? `<span class="note">Без учёта позиций «по запросу»: ${t.unknown}</span>` : ''}</div>
<div class="kp-a"><button data-pdf${t.n ? '' : ' disabled'}>PDF</button><button data-xlsx${t.n ? '' : ' disabled'}>Excel</button><button class="p" data-send${t.n ? '' : ' disabled'}>Отправить</button></div>
${me ? `<div class="kp-a kp-a2"><button data-save${t.n ? '' : ' disabled'}>${srv ? 'Сохранить' : 'В мои клиенты'}</button><button class="g" data-order${t.n ? '' : ' disabled'}>Заказать у IT-Trade</button></div>` : ''}`;
    if (activeId === 'kpClient' || activeId === 'kpGd') { const el = $('#' + activeId); el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    else if (activeS) { const el = $(`.kr[data-s="${CSS.escape(activeS)}"] input`, kpEl); if (el && active.tagName === 'INPUT') el.focus(); }
    updateBadges(t);
    if (/^#\/kpw/.test(location.hash) && booted) drawKPW();
  }
  function updateBadges(t) {
    t = t || kpTotals();
    $('#kpN').textContent = t.n;
    $('#kpSum').textContent = t.n ? money(t.sum) : '';
    const tb = $('#tabKpN'); tb.hidden = !t.n; tb.textContent = t.n;
    $('#favN').textContent = FAV.size;
    const bar = $('#kpbar');
    if (t.n) { bar.hidden = false; bar.innerHTML = `<span>КП: ${t.n} поз., ${t.pcs} шт</span><b>${money(t.sum)}</b><button data-open-kp>Открыть КП</button>`; }
    else bar.hidden = true;
    const sf = $('#side a[href="#/fav"] em'); if (sf) sf.textContent = FAV.size;
  }
  $('#kpbar').addEventListener('click', e => { if (e.target.closest('[data-open-kp]')) { kpPushed = true; location.hash = '#/kp'; } });
  $('#kpBtn').addEventListener('click', () => { kpPushed = true; });
  $('#tabbar a[data-tab="kp"]').addEventListener('click', () => { kpPushed = !/^#\/kp/.test(location.hash); });
  function closeKP() { document.body.classList.remove('kp-open'); if (/^#\/kp/.test(location.hash)) { const f = kpPushed; kpPushed = false; goBackOr(st.base, f); } }
  $('#scrim').addEventListener('click', closeKP);
  function lineDiscPrompt(s) {
    const r = KP.items.find(x => x[0] === s); if (!r) return;
    const it = BYSKU.get(s);
    openModal(`<h2>Скидка на позицию</h2><p class="mp">${esc(s)}<br>РРЦ ${money(it.price)}${seeBuy() && it.price != null ? ', ваш закуп ' + money(buyPrice(it)) : ''}</p>
<div class="md-q">${[0, 5, 10, 15, 20].map(n => `<button type="button" data-ld="${n}"${lineDisc(r) === n ? ' class="on"' : ''}>${n ? '−' + n + ' %' : 'без'}</button>`).join('')}</div>
<label class="fld"><small>Своя скидка</small><input id="ldIn" type="number" inputmode="decimal" min="0" max="90" value="${r[2] != null ? r[2] : ''}" placeholder="${Number(KP.gd) || 0}"><small>%</small></label>
<div class="md-a">${r[2] != null ? '<button type="button" class="lnk" data-ldreset>Как у всего КП</button>' : '<span></span>'}<button type="button" class="btn" data-ldok>Применить</button></div>`, e => {
      const set = v => { r[2] = v; saveKP(); renderKP(); closeModal(); };
      const b = e.target.closest('[data-ld]'); if (b) return set(Number(b.dataset.ld));
      if (e.target.closest('[data-ldreset]')) return set(null);
      if (e.target.closest('[data-ldok]')) { const v = parseFloat(String($('#ldIn').value).replace(',', '.')); set(isFinite(v) ? Math.max(0, Math.min(90, Math.round(v * 10) / 10)) : null); }
    });
  }
  kpEl.addEventListener('click', e => {
    const r = e.target.closest('.kr'), s = r && r.dataset.s;
    if (e.target.closest('[data-kpclose]')) return closeKP();
    if (e.target.closest('[data-clear]')) { if (!KP.items.length || confirm(KP.srv ? 'Начать новое КП? Сохранённое останется в «Моих клиентах».' : 'Очистить КП?')) { KP = normKP({}); saveKP(); renderKP(); refreshAdds(); } return; }
    if (e.target.closest('[data-pdf]')) return run(e.target.closest('button'), () => exportPDF(false));
    if (e.target.closest('[data-xlsx]')) return run(e.target.closest('button'), exportXLSX);
    if (e.target.closest('[data-send]')) return run(e.target.closest('button'), () => exportPDF(true));
    if (e.target.closest('[data-save]')) return run(e.target.closest('button'), saveKPServer);
    if (e.target.closest('[data-order]')) return orderDialog();
    if (!s) return;
    if (e.target.closest('[data-ldisc]')) return lineDiscPrompt(s);
    if (e.target.closest('[data-del]')) return setQty(s, 0);
    if (e.target.closest('[data-dec]')) return setQty(s, kpQty(s) - 1);
    if (e.target.closest('[data-inc]')) return setQty(s, kpQty(s) + 1);
    if (e.target.closest('[data-open]')) { sheetPushed = true; location.hash = '#/p/' + encodeURIComponent(s); }
  });
  kpEl.addEventListener('input', e => { if (e.target.id === 'kpClient') { KP.client = e.target.value; saveKP(); } });
  kpEl.addEventListener('change', e => {
    if (e.target.id === 'kpGd') { const v = parseFloat(String(e.target.value).replace(',', '.')) || 0; KP.gd = Math.max(0, Math.min(90, Math.round(v * 10) / 10)); saveKP(); renderKP(); return; }
    if (e.target.id === 'kpStatus') { const v = e.target.value; db('kps?id=eq.' + U(KP.srv.id), { method: 'PATCH', body: { status: v } }).then(() => { KP.srv.status = v; saveKP(); toast('Статус: ' + KST[v]); }).catch(err => toast(err.message)); return; }
    const r = e.target.closest('.kr'); if (r && e.target.tagName === 'INPUT') setQty(r.dataset.s, e.target.value);
  });
  async function run(btn, fn) {
    if (btn.disabled) return; const t = btn.textContent; btn.disabled = true; btn.textContent = '…';
    try { await fn(); } catch (err) { console.error(err); toast(err && err.message && !/^[A-Za-z]/.test(err.message) ? err.message : (navigator.onLine ? 'Не получилось: ' + (err.message || err) : 'Нужен интернет')); }
    btn.disabled = false; btn.textContent = t;
  }

  /* ---------- выгрузки ---------- */
  const libs = {};
  function loadScript(src) { return new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => err(new Error('не загрузился ' + src)); document.head.appendChild(s); }); }
  function b64(ab) { let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  async function needPdf() {
    if (!window.jspdf) await loadScript('vendor/jspdf.umd.min.js');
    if (!libs.fonts) {
      const [r, b] = await Promise.all(['Regular', 'Bold'].map(n => fetch('assets/fonts/LiberationSans-' + n + '.ttf').then(x => { if (!x.ok) throw new Error('шрифт'); return x.arrayBuffer(); }).then(b64)));
      libs.fonts = { r, b };
    }
  }
  function imgData(src, max, fmt) {
    return new Promise(ok => {
      if (!src) return ok(null);
      const im = new Image();
      im.onload = () => {
        const sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * sc)); c.height = Math.max(1, Math.round(im.naturalHeight * sc));
        const x = c.getContext('2d'); if (fmt === 'JPEG') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
        x.drawImage(im, 0, 0, c.width, c.height);
        ok({ d: c.toDataURL(fmt === 'PNG' ? 'image/png' : 'image/jpeg', 0.85), w: c.width, h: c.height });
      };
      im.onerror = () => ok(null); im.src = src;
    });
  }
  const pad = n => String(n).padStart(2, '0');
  function kpMeta() {
    const d = new Date();
    return { date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`, num: KP.srv && KP.srv.num ? String(KP.srv.num) : `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`,
      file: 'КП_Dahua' + (KP.client ? '_' + KP.client.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 40) : '') + `_${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` };
  }
  const pmoney = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const seller = () => { const i = inst(); if (!i) return null; return { org: (i.company || i.name || '').trim(), line: [i.company, i.company && i.name !== i.company ? i.name : '', fmtPhone(i.phone), i.city].filter(Boolean).join(', ') }; };
  async function buildPDF() {
    await needPdf();
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'pt', format: 'a4' }), m = kpMeta(), t = kpTotals(), sl = seller();
    doc.addFileToVFS('LS-R.ttf', libs.fonts.r); doc.addFont('LS-R.ttf', 'LS', 'normal');
    doc.addFileToVFS('LS-B.ttf', libs.fonts.b); doc.addFont('LS-B.ttf', 'LS', 'bold');
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 36;
    const ink = [22, 50, 63], steel = [122, 140, 150], acc = [27, 168, 216], line = [220, 230, 235], red = [192, 57, 43];
    const [lIt, lDh] = await Promise.all([sl ? null : imgData('assets/logo-it.png', 240, 'PNG'), imgData('assets/logo-dahua.png', 500, 'PNG')]);
    let y = M;
    let x = M; if (lIt) { const w = 28 * lIt.w / lIt.h; doc.addImage(lIt.d, 'PNG', x, y, w, 28); x += w + 12; }
    if (lDh) { const w = 21 * lDh.w / lDh.h; doc.addImage(lDh.d, 'PNG', x, y + 4, w, 21); x += w + 12; }
    if (sl && sl.org) { doc.setTextColor(...ink); doc.setFont('LS', 'bold'); doc.setFontSize(11); doc.text(doc.splitTextToSize(sl.org, 170).slice(0, 2), x, y + 13); }
    doc.setTextColor(...ink); doc.setFont('LS', 'bold'); doc.setFontSize(15); doc.text('Коммерческое предложение', W - M, y + 12, { align: 'right' });
    doc.setFont('LS', 'normal'); doc.setFontSize(9); doc.setTextColor(...steel); doc.text(`№ ${m.num} от ${m.date}`, W - M, y + 26, { align: 'right' });
    y += 42; doc.setDrawColor(...acc); doc.setLineWidth(2); doc.line(M, y, W - M, y); y += 20;
    if (KP.client.trim()) { doc.setTextColor(...ink); doc.setFontSize(10.5); doc.text('Клиент: ' + KP.client.trim(), M, y); y += 18; }
    const D = t.anyDisc;
    const rSum = W - M, rPr = rSum - 72, rDc = D ? rPr - 58 : rPr, rRrp = D ? rDc - 44 : rPr, rQty = (D ? rRrp : rPr) - 66;
    const cN = M, cPh = M + 20, cTx = M + 66, txW = rQty - 34 - cTx;
    const head = () => {
      doc.setFillColor(242, 246, 248); doc.rect(M, y - 11, W - 2 * M, 18, 'F');
      doc.setFont('LS', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...ink);
      doc.text('№', cN + 2, y + 1); doc.text('Фото', cPh, y + 1); doc.text('Артикул и описание', cTx, y + 1);
      doc.text('Кол-во', rQty, y + 1, { align: 'right' });
      if (D) { doc.text('РРЦ, руб.', rRrp, y + 1, { align: 'right' }); doc.text('Скидка', rDc, y + 1, { align: 'right' }); }
      doc.text('Цена, руб.', rPr, y + 1, { align: 'right' }); doc.text('Сумма, руб.', rSum, y + 1, { align: 'right' });
      y += 18;
    };
    head();
    const thumbs = await Promise.all(KP.items.map(([s]) => imgData(thumb(s), 140, 'JPEG')));
    KP.items.forEach((r, i) => {
      const [s, qn] = r, it = BYSKU.get(s), d = lineDisc(r), u = discPrice(it, d);
      doc.setFontSize(8.3); doc.setFont('LS', 'normal');
      const dl = doc.splitTextToSize(it.d || '', txW).slice(0, 3);
      const rowH = Math.max(46, 14 + dl.length * 10.5 + 8);
      if (y + rowH > H - 70) { doc.addPage(); y = M + 10; head(); }
      const im = thumbs[i];
      if (im) { const k = Math.min(38 / im.w, 38 / im.h); doc.addImage(im.d, 'JPEG', cPh + (38 - im.w * k) / 2, y - 4 + (38 - im.h * k) / 2, im.w * k, im.h * k); }
      doc.setTextColor(...steel); doc.text(String(i + 1), cN + 2, y + 6);
      doc.setTextColor(...ink); doc.setFont('LS', 'bold'); doc.setFontSize(9); doc.text(s, cTx, y + 6);
      doc.setFont('LS', 'normal'); doc.setFontSize(8.3); doc.setTextColor(62, 86, 99); doc.text(dl, cTx, y + 18);
      doc.setTextColor(...ink); doc.setFontSize(9);
      doc.text(qn + ' шт', rQty, y + 6, { align: 'right' });
      if (D) {
        doc.setTextColor(...steel); doc.text(it.price == null ? '—' : pmoney(it.price), rRrp, y + 6, { align: 'right' });
        doc.setTextColor(...(d ? red : steel)); doc.text(d ? '−' + d + ' %' : '—', rDc, y + 6, { align: 'right' }); doc.setTextColor(...ink);
      }
      doc.text(u == null ? 'по запросу' : pmoney(u), rPr, y + 6, { align: 'right' });
      doc.setFont('LS', 'bold'); doc.text(u == null ? '—' : pmoney(u * qn), rSum, y + 6, { align: 'right' });
      y += rowH; doc.setDrawColor(...line); doc.setLineWidth(0.6); doc.line(M, y - 8, W - M, y - 8);
    });
    if (y > H - 130) { doc.addPage(); y = M + 10; }
    y += 8;
    doc.setFont('LS', 'normal'); doc.setFontSize(9.5); doc.setTextColor(62, 86, 99);
    doc.text(`Позиций: ${t.n}, штук: ${t.pcs}`, M, y);
    const lab = W - M - 110;
    if (D) {
      doc.text('Сумма по РРЦ:', lab, y, { align: 'right' }); doc.text(pmoney(t.rrp) + ' руб.', rSum, y, { align: 'right' }); y += 15;
      doc.setTextColor(...red); doc.setFont('LS', 'bold'); doc.text('Ваша скидка:', lab, y, { align: 'right' }); doc.text('−' + pmoney(t.disc) + ' руб.', rSum, y, { align: 'right' }); y += 15;
      doc.setFont('LS', 'normal'); doc.setTextColor(62, 86, 99);
    }
    doc.text('в т.ч. НДС ' + VAT + ' %:', lab, y, { align: 'right' }); doc.text(pmoney(t.vat) + ' руб.', rSum, y, { align: 'right' });
    y += 18; doc.setFont('LS', 'bold'); doc.setFontSize(13); doc.setTextColor(...ink);
    doc.text('Итого:', lab, y, { align: 'right' }); doc.text(pmoney(t.sum) + ' руб.', rSum, y, { align: 'right' });
    if (t.unknown) { y += 16; doc.setFont('LS', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...steel); doc.text(`Позиции «по запросу» (${t.unknown}) не включены в сумму, цена уточняется.`, M, y); }
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFont('LS', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...steel);
      doc.text(sl ? sl.line : 'Цены по прайс-листу Dahua' + (PR.date ? ' от ' + PR.date : '') + '. IT-Trade, it-trade.com.ru', M, H - 24);
      doc.text(`стр. ${p} из ${pages}`, W - M, H - 24, { align: 'right' });
    }
    return { blob: doc.output('blob'), name: m.file + '.pdf', meta: m, t };
  }
  function kpText(m, t) {
    const sl = seller();
    const lines = [`Коммерческое предложение Dahua от ${m.date}`]; if (KP.client.trim()) lines.push('Клиент: ' + KP.client.trim()); lines.push('');
    KP.items.forEach((r, i) => { const it = BYSKU.get(r[0]), d = lineDisc(r), u = discPrice(it, d); lines.push(`${i + 1}. ${r[0]} — ${r[1]} шт × ${u == null ? 'по запросу' : pmoney(u) + ' ₽'}${d ? ' (скидка ' + d + ' %)' : ''}${u == null ? '' : ' = ' + pmoney(u * r[1]) + ' ₽'}`); });
    lines.push('');
    if (t.anyDisc) lines.push(`По РРЦ: ${pmoney(t.rrp)} ₽, ваша скидка: ${pmoney(t.disc)} ₽`);
    lines.push(`Итого: ${pmoney(t.sum)} ₽ (в т.ч. НДС ${VAT} %: ${pmoney(t.vat)} ₽)`);
    if (sl) lines.push('', sl.line);
    return lines.join('\n');
  }
  async function deliver(blob, name, share, text) {
    const file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null;
    if ((share || coarse) && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name, text: share ? text : undefined }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (share && navigator.share && text) { try { await navigator.share({ title: name, text }); } catch (e) { if (e && e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    if (share && text) { await copy(text); toast('Файл сохранён, текст КП скопирован'); }
  }
  async function exportPDF(share) { const r = await buildPDF(); await deliver(r.blob, r.name, share, kpText(r.meta, r.t)); }
  async function needXlsx() { if (!window.XLSX) await loadScript('vendor/xlsx.full.min.js'); }
  const xlsxBlob = wb => new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  async function exportXLSX() {
    await needXlsx();
    const m = kpMeta(), t = kpTotals(), X = XLSX.utils, sl = seller();
    const rows = [[`Коммерческое предложение № ${m.num} от ${m.date}`], [KP.client.trim() ? 'Клиент: ' + KP.client.trim() : ''], [sl ? sl.line : ''], ['№', 'Артикул', 'Описание', 'Характеристики', 'Кол-во, шт', 'РРЦ, ₽', 'Скидка, %', 'Цена, ₽', 'Сумма, ₽']];
    KP.items.forEach((r, i) => { const it = BYSKU.get(r[0]), d = lineDisc(r), u = discPrice(it, d); rows.push([i + 1, r[0], it.d, it.sp, r[1], it.price == null ? 'по запросу' : it.price, d || 0, u == null ? 'по запросу' : u, u == null ? '' : u * r[1]]); });
    const first = 5, last = 4 + KP.items.length;
    rows.push([], ['', '', '', '', '', '', '', 'Итого', t.sum], ['', '', '', '', '', '', '', `в т.ч. НДС ${VAT} %`, t.vat]);
    const ws = X.aoa_to_sheet(rows);
    for (let r = first; r <= last; r++) {
      const f = ws['F' + r], h = ws['H' + r], g = ws['I' + r];
      if (f && f.t === 'n') { f.z = '#,##0'; if (h) { h.f = `ROUND(F${r}*(1-G${r}/100),0)`; h.z = '#,##0'; } if (g) { g.f = `E${r}*H${r}`; g.z = '#,##0'; } }
    }
    const tr = last + 2; ws['I' + tr].f = `SUM(I${first}:I${last})`; ws['I' + tr].z = '#,##0'; ws['I' + (tr + 1)].f = `ROUND(I${tr}*${VAT}/${100 + VAT},0)`; ws['I' + (tr + 1)].z = '#,##0';
    ws['!cols'] = [{ wch: 4 }, { wch: 32 }, { wch: 50 }, { wch: 60 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
    const wb = X.book_new(); X.book_append_sheet(wb, ws, 'КП');
    await deliver(xlsxBlob(wb), m.file + '.xlsx', false);
  }
  async function exportAll() {
    await needXlsx();
    const rows = [['Раздел', 'Группа', 'Артикул', 'Описание', 'Характеристики', 'РРЦ, ₽', 'Гарантия', 'MPQ, шт']];
    ITEMS.forEach(it => rows.push([it.sheet, cleanG(it.g), it.s, it.d, it.sp, it.price == null ? 'по запросу' : it.price, fmtW(it.w) ? it.w : '', it.m || '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 34 }, { wch: 32 }, { wch: 50 }, { wch: 80 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
    ws['!autofilter'] = { ref: 'A1:H' + rows.length };
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Прайс Dahua');
    await deliver(xlsxBlob(wb), 'Прайс_Dahua' + (PR.date ? '_' + PR.date : '') + '.xlsx', false);
  }

  /* ---------- меню ---------- */
  let deferredInstall = null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const UA = navigator.userAgent;
  const isAndroid = /android/i.test(UA);
  const inApp = /FBAN|FBAV|Instagram|Telegram|WhatsApp|Line\/|VKClient|; wv\)/i.test(UA);
  const iosOther = isIOS && /CriOS|FxiOS|EdgiOS|YaBrowser|OPiOS/i.test(UA);
  const isIPad = isIOS && !/iphone|ipod/i.test(UA);
  const ibState = load('dh-ib', { n: 0, until: 0 });
  const SVG_SH = '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M8 11H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18 11h-2"/></svg>';
  const SVG_ADD = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>';
  let ibShown = false, ibTimer = null, relInstalled = null, bipSeen = false;
  if (navigator.getInstalledRelatedApps) navigator.getInstalledRelatedApps().then(a => { relInstalled = !!(a && a.length); }).catch(() => {});
  function ibKind() {
    if (standalone) return null;
    if (inApp) return 'inapp';
    if (isIOS) return (iosOther || isIPad) ? 'ios-top' : 'ios-safari';
    if (deferredInstall) return 'prompt';
    if (isAndroid && relInstalled !== true) return 'android-menu';
    return null;
  }
  function ibHTML(k) {
    const ic = '<img class="ib-ic" src="assets/icons/icon-192.png" alt="">';
    const x = '<button type="button" class="ib-x" data-ibx aria-label="Закрыть">✕</button>';
    const head = (t, sub) => `<div class="ib-r">${ic}<div class="ib-t"><b>${t}</b><span>${sub}</span></div></div>`;
    const sub = 'Прайс на рабочем столе, работает без интернета';
    if (k === 'prompt') return `<div class="ib ibb" role="dialog" aria-label="Установка приложения">${x}${head('Приложение «Dahua»', sub)}<div class="ib-go"><button type="button" class="s" data-ibx>Не сейчас</button><button type="button" class="p" data-ibinstall>Установить</button></div></div>`;
    if (k === 'android-menu') return `<div class="ib ibt" role="dialog" aria-label="Установка приложения">${x}${head('Установите на телефон', sub)}<div class="ib-st"><div><i>1</i>Откройте меню браузера <b>⋮</b> ${/SamsungBrowser/i.test(UA) ? 'внизу' : 'вверху'}</div><div><i>2</i><span>Выберите <b>Установить приложение</b> или <b>Добавить на главный экран</b></span></div></div>${/SamsungBrowser/i.test(UA) ? '' : '<span class="ib-ar r"></span>'}</div>`;
    if (k === 'inapp') return `<div class="ib ibt" role="dialog" aria-label="Открыть в браузере">${x}${head('Откройте в браузере', 'Из мессенджера установить приложение нельзя')}<div class="ib-st"><div><i>1</i>Нажмите <b>⋯</b> вверху справа</div><div><i>2</i><b>${isIOS ? 'Открыть в Safari' : 'Открыть в браузере'}</b></div></div><div class="ib-go"><button type="button" class="s" data-ibcopy>Скопировать ссылку</button></div><span class="ib-ar r"></span></div>`;
    const top = k === 'ios-top';
    return `<div class="ib ${top ? 'ibt' : 'ibb'}" role="dialog" aria-label="Установка приложения">${x}${head('Установите на ' + (isIPad ? 'iPad' : 'iPhone'), 'Значок на экране «Домой», работает без интернета')}<div class="ib-st"><div><i>1</i>Нажмите ${SVG_SH}<b>Поделиться</b> ${top ? 'вверху' : 'внизу'}</div><div><i>2</i>Выберите ${SVG_ADD}<b>На экран «Домой»</b></div><div><i>3</i>Нажмите <b>Добавить</b></div></div><span class="ib-ar${top ? ' r' : ''}"></span></div>`;
  }
  function ibAllowed() { return ibState.n < 3 && Date.now() > (ibState.until || 0); }
  function ibBusy() { return !sheet.hidden || document.body.classList.contains('kp-open') || document.body.classList.contains('dd-open') || !$('#menu').hidden || document.activeElement === qIn; }
  function showIB(force) {
    const k = ibKind(); if (!k || ibShown) return;
    if (!force && (!ibAllowed() || !coarse)) return;
    if (!force && ibBusy()) { clearTimeout(ibTimer); ibTimer = setTimeout(() => showIB(false), 5000); return; }
    const w = document.createElement('div'); w.id = 'ib'; w.innerHTML = ibHTML(k); document.body.appendChild(w); ibShown = true;
  }
  function hideIB() { const w = $('#ib'); if (w) w.remove(); ibShown = false; }
  function dismissIB() { hideIB(); ibState.n = (ibState.n || 0) + 1; ibState.until = Date.now() + 14 * 864e5; save('dh-ib', ibState); }
  document.addEventListener('click', async e => {
    if (!e.target.closest('#ib')) return;
    if (e.target.closest('[data-ibx]')) return dismissIB();
    if (e.target.closest('[data-ibcopy]')) { await copy(location.href.split('#')[0]); toast('Ссылка скопирована, вставьте её в браузер'); return; }
    if (e.target.closest('[data-ibinstall]') && deferredInstall) {
      const d = deferredInstall; hideIB(); d.prompt();
      const r = await d.userChoice.catch(() => ({}));
      deferredInstall = null; $('#installBtn').hidden = true;
      if (!r || r.outcome !== 'accepted') dismissIB();
    }
  });
  function ibSchedule() { clearTimeout(ibTimer); ibTimer = setTimeout(() => showIB(false), 18000); }
  let ibActs = 0;
  addEventListener('hashchange', () => { if (++ibActs === 2 && !ibShown) { clearTimeout(ibTimer); ibTimer = setTimeout(() => showIB(false), 1500); } });
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; bipSeen = true; if (ibShown && $('#ib .ibt')) { hideIB(); showIB(true); } $('#installBtn').hidden = false; });
  addEventListener('appinstalled', () => { deferredInstall = null; $('#installBtn').hidden = true; ibState.n = 99; save('dh-ib', ibState); hideIB(); toast('Приложение установлено'); });
  async function doInstall() {
    if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice.catch(() => {}); deferredInstall = null; $('#installBtn').hidden = true; }
    else if (isIOS || inApp || isAndroid) showIB(true);
    else toast('Меню браузера → «Установить приложение»');
  }
  $('#installBtn').addEventListener('click', doInstall);
  function openMenu() {
    const m = $('#menu'), photos = load('dh-photos', 0);
    m.innerHTML = `${standalone ? '' : `<button data-act="install">Установить приложение<small>${isIOS ? 'Safari: «Поделиться» → «На экран Домой»' : 'Значок на рабочий стол, работает без интернета'}</small></button>`}
${API ? `<button data-act="me">${AUTH ? 'Кабинет монтажника' : 'Я монтажник'}<small>${inst() ? 'Закуп −' + instDisc() + ' %, мои клиенты' : AUTH ? 'Заявка на проверке' : 'Закупочные цены, скидки клиентам, мои клиенты'}</small></button>` : ''}${inst() ? '<button data-act="fav">Избранное<small>' + FAV.size + ' товаров</small></button>' : ''}<button data-act="photos">Скачать фото для офлайна<small id="phInfo">${photos ? 'Уже скачаны, можно обновить' : 'Около 10 МБ, превью всех товаров'}</small><div class="prog" id="phProg" hidden><i></i></div></button>
<button data-act="all">Весь прайс в Excel<small>${ITEMS.length.toLocaleString('ru-RU')} позиций</small></button>
<button data-act="reload">Обновить данные<small>Подтянуть свежий прайс с сайта</small></button>
<div class="mi">Прайс${PR.date ? ' от ' + esc(PR.date) : ''}, версия ${APP_VER}. Цены РРЦ, НДС ${VAT} % включён. <button type="button" class="lnk" data-act="diag">Диагностика</button></div>`;
    m.hidden = false;
  }
  function closeMenu() { $('#menu').hidden = true; }
  $('#menuBtn').addEventListener('click', e => { e.stopPropagation(); $('#menu').hidden ? openMenu() : closeMenu(); });
  document.addEventListener('click', e => { if (dd.open && !e.composedPath().some(n => n.id === 'ddw')) ddClose(); });
  document.addEventListener('click', e => { if (!$('#menu').hidden && !e.target.closest('#menu') && !e.target.closest('#menuBtn')) closeMenu(); });
  $('#menu').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'install') { closeMenu(); doInstall(); }
    if (a === 'photos') cachePhotos();
    if (a === 'all') { closeMenu(); exportAll().catch(err => toast('Не получилось: ' + err.message)); }
    if (a === 'reload') { closeMenu(); hardReload(); }
    if (a === 'diag') { closeMenu(); showDiag(); }
    if (a === 'me') { closeMenu(); location.hash = '#/me'; }
    if (a === 'fav') { closeMenu(); location.hash = '#/fav'; }
  });
  let photoBusy = false;
  async function cachePhotos() {
    if (photoBusy) return;
    if (!('caches' in window)) { toast('Браузер не поддерживает офлайн-хранилище'); return; }
    if (!navigator.onLine) { toast('Нужен интернет'); return; }
    photoBusy = true;
    const urls = Array.from(new Set(Object.keys(IMG).map(thumb).filter(Boolean)));
    const c = await caches.open('dahua-img');
    let done = 0, fail = 0; const q = urls.slice();
    const info = () => { const i = $('#phInfo'), p = $('#phProg'); if (i) i.textContent = `Скачано ${done} из ${urls.length}${fail ? ', ошибок ' + fail : ''}`; if (p) { p.hidden = false; p.firstChild.style.width = (done / urls.length * 100) + '%'; } };
    const worker = async () => { while (q.length) { const u = q.shift(); try { const req = new Request(u); if (!(await c.match(req))) { const r = await fetch(req); if (r.ok) await c.put(req, r); else fail++; } } catch (e) { fail++; } done++; if (done % 10 === 0 || done === urls.length) info(); } };
    info(); await Promise.all(Array.from({ length: 6 }, worker));
    save('dh-photos', 1); photoBusy = false;
    toast(fail ? `Фото скачаны, не удалось: ${fail}` : 'Все фото доступны без интернета');
  }
  async function hardReload() {
    try { if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.filter(k => k !== 'dahua-img').map(k => caches.delete(k))); } } catch (e) {}
    location.reload();
  }


  /* ---------- диагностика установки: меню «⋯» → Диагностика или ?diag ---------- */
  async function showDiag() {
    let sw = 'нет';
    try { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); sw = r && r.active ? 'активен' : r ? 'устанавливается' : 'не зарегистрирован'; } catch (e) {}
    const br = inApp ? 'встроенный браузер мессенджера' : isIOS ? (iosOther ? 'iOS, Chrome/Edge/Firefox' : isIPad ? 'iPad, Safari' : 'iPhone, Safari') : isAndroid ? (/SamsungBrowser/i.test(UA) ? 'Android, Samsung Internet' : /YaBrowser/i.test(UA) ? 'Android, Яндекс' : /Firefox/i.test(UA) ? 'Android, Firefox' : 'Android, Chrome') : 'компьютер';
    const rows = [
      ['Версия приложения', APP_VER], ['Браузер', br], ['Открыто как', standalone ? 'установленное приложение' : 'сайт в браузере'],
      ['Офлайн-режим (SW)', sw], ['HTTPS', location.protocol === 'https:' ? 'да' : 'нет'],
      ['Окно установки Android', isAndroid ? (bipSeen ? 'браузер разрешил' : 'браузер пока не разрешил') : '—'],
      ['Уже установлено (Android)', relInstalled === null ? 'не определить' : relInstalled ? 'да' : 'нет'],
      ['Подсказку закрывали', (ibState.n >= 99 ? 'установлено' : (ibState.n || 0) + ' раз') + (ibState.until > Date.now() ? ', скрыта до ' + new Date(ibState.until).toLocaleDateString('ru-RU') : '')],
      ['Какая подсказка', { 'inapp': 'открыть в браузере', 'ios-top': 'iOS, «Поделиться» вверху', 'ios-safari': 'iOS, «Поделиться» внизу', 'prompt': 'Android, кнопка «Установить»', 'android-menu': 'Android, через меню ⋮' }[ibKind()] || 'не нужна']
    ];
    sheet.innerHTML = `<div class="sh-bg" data-close></div><div class="sh-box diag" role="dialog" aria-label="Диагностика"><button class="sh-x" data-close aria-label="Закрыть">✕</button><div class="sh-in"><h2>Диагностика</h2>
<table>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>
<div class="dg-a"><button type="button" class="btn" data-dgshow>Показать подсказку</button><button type="button" class="lnk" data-dgreset>Сбросить счётчик</button></div></div></div>`;
    sheet.hidden = false; sheet.dataset.s = '';
  }
  sheet.addEventListener('click', e => {
    if (e.target.closest('[data-dgshow]')) { e.stopPropagation(); sheet.hidden = true; sheet.innerHTML = ''; hideIB(); showIB(true); if (!ibShown) toast(standalone ? 'Уже открыто как приложение' : 'Для этого браузера подсказка не нужна'); }
    if (e.target.closest('[data-dgreset]')) { e.stopPropagation(); ibState.n = 0; ibState.until = 0; save('dh-ib', ibState); sheet.hidden = true; sheet.innerHTML = ''; toast('Счётчик сброшен'); }
    if (e.target.closest('.diag [data-close]')) { e.stopPropagation(); sheet.hidden = true; sheet.innerHTML = ''; }
  }, true);

  /* ---------- модальные окна ---------- */
  const modal = $('#modal');
  function openModal(html, handler) {
    modal.innerHTML = `<div class="sh-bg" data-mclose></div><div class="sh-box md" role="dialog" aria-modal="true"><button class="sh-x" data-mclose aria-label="Закрыть">✕</button><div class="sh-in">${html}</div></div>`;
    modal.hidden = false; modal._h = handler || null;
    const f = $('input,textarea,select', modal); if (f && !coarse) setTimeout(() => f.focus(), 30);
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; modal._h = null; }
  modal.addEventListener('click', e => { if (e.target.closest('[data-mclose]')) return closeModal(); if (modal._h) modal._h(e); });
  modal.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const b = $('.btn', modal); if (b) { e.preventDefault(); b.click(); } } });

  /* ---------- монтажник: UI ---------- */
  function setAuth(a) { AUTH = a; save('dh-auth', AUTH); applyInstUI(); }
  function setRec(rec) { AUTH.rec = rec; save('dh-auth', AUTH); applyInstUI(); }
  let booted = false;
  function applyInstUI() {
    const me = inst();
    document.body.classList.toggle('is-inst', !!me);
    const bb = $('#buyBtn');
    if (bb) { bb.hidden = !me; bb.classList.toggle('on', showBuy); bb.setAttribute('aria-pressed', String(showBuy)); bb.title = showBuy ? 'Скрыть закупочные цены' : 'Показать закупочные цены'; }
    const fav = $('#tabbar [data-tab="fav"]');
    if (fav) {
      fav.href = me ? '#/orders' : '#/fav';
      fav.innerHTML = me ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/></svg>Кабинет'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/></svg>Избранное';
    }
    if (booted) { renderKP(); if (st.rendered) renderBase(st.base, true); }
  }
  function toggleBuy() { showBuy = !showBuy; save('dh-buy', showBuy); applyInstUI(); toast(showBuy ? 'Закупочные цены видны' : 'Закупочные цены скрыты'); }
  async function refreshAuth(quiet) {
    if (!AUTH || !AUTH.rt || !API || !navigator.onLine) return;
    const was = AUTH.rec && AUTH.rec.status;
    try {
      const rec = await loadMe();
      setRec(rec);
      db('rpc/touch', { method: 'POST', body: {} }).catch(() => {});
      if (was !== 'active' && rec.status === 'active') toast('Режим монтажника включён: закуп −' + rec.discount + ' %');
      if (was === 'active' && rec.status !== 'active') toast('Доступ монтажника приостановлен');
      if (/^#\/me/.test(location.hash) && st.rendered) renderBase(st.base, true);
    } catch (e) {
      if (e.status === 401 || e.status === 403 || e.status === 404) { setAuth(null); if (!quiet) toast('Войдите в кабинет монтажника заново'); }
    }
  }
  function logout() { if (!confirm('Выйти из кабинета монтажника?')) return; setAuth(null); if (KP.srv) { KP.srv = null; saveKP(); } location.hash = '#/me'; renderBase('#/me', true); }

  const loading = t => `<div class="empty"><b>${t || 'Загрузка…'}</b></div>`;
  const fmtDate = s => { if (!s) return ''; const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? '' : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`; };

  function vMe() {
    renderSide('me');
    if (!API) { view.innerHTML = '<div class="ttl"><h1>Кабинет монтажника</h1></div><div class="empty"><b>Скоро</b>Регистрация монтажников появится после подключения сервера.</div>'; return; }
    const r = AUTH && AUTH.rec;
    if (!r) {
      const tab = st.meTab || 'login';
      view.innerHTML = `<div class="ttl"><a class="back" href="#/" aria-label="Назад">‹</a><h1>Кабинет монтажника</h1></div>
<div class="me-box"><div class="seg"><button type="button" data-metab="login"${tab === 'login' ? ' class="on"' : ''}>Вход</button><button type="button" data-metab="reg"${tab === 'reg' ? ' class="on"' : ''}>Регистрация</button></div>
${tab === 'login' ? `<p class="mp">Войдите по телефону и паролю, указанным при регистрации.</p>
<label class="fl"><span>Телефон</span><input id="mePhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 978 123-45-67"></label>
<label class="fl"><span>Пароль</span><input id="mePass" type="password" autocomplete="current-password"></label>
<button type="button" class="btn wide" data-melogin>Войти</button><p class="mp sm">Забыли пароль? Позвоните менеджеру IT-Trade — он поставит новый.</p>`
: `<p class="mp">После проверки менеджер IT-Trade откроет вам закупочные цены, скидки для клиентов и кабинет «Мои клиенты».</p>
<label class="fl"><span>ФИО</span><input id="rgName" autocomplete="name" placeholder="Петров Сергей Викторович"></label>
<label class="fl"><span>Компания / ИП</span><input id="rgCompany" autocomplete="organization" placeholder="ИП Петров С.В."></label>
<label class="fl"><span>Телефон</span><input id="rgPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 978 123-45-67"></label>
<label class="fl"><span>Город</span><input id="rgCity" placeholder="Симферополь"></label>
<label class="fl"><span>Пароль (не короче 8 символов)</span><input id="rgPass" type="password" autocomplete="new-password"></label>
<button type="button" class="btn wide" data-mereg>Отправить заявку</button>`}</div>`;
      return;
    }
    const stt = r.status;
    const box = stt === 'active' ? `<div class="me-ok"><div class="me-ic ok">✓</div><h2>${esc(r.name)}</h2><p class="mp">${esc(r.company || '')}${r.city ? ', ' + esc(r.city) : ''}<br>${esc(fmtPhone(r.phone))}</p><div class="pill-buy">закуп: РРЦ −${instDisc()} %</div>
<div class="me-a"><a class="btn wide" href="#/clients">Мои клиенты</a><button type="button" class="btn2 wide" data-mebuy>${showBuy ? 'Скрыть закупочные цены' : 'Показать закупочные цены'}</button><button type="button" class="lnk" data-melogout>Выйти</button></div></div>`
      : stt === 'pending' ? `<div class="me-ok"><div class="me-ic wait">⏳</div><h2>Заявка на проверке</h2><p class="mp">${esc(r.name)}, ${esc(fmtPhone(r.phone))}<br>Обычно в течение рабочего дня. Как только одобрят — закупочные цены появятся сами.</p><p class="mp note-box">Пока можно пользоваться каталогом и делать КП по РРЦ.</p><div class="me-a"><button type="button" class="btn wide" data-mecheck>Проверить статус</button><button type="button" class="lnk" data-melogout>Выйти</button></div></div>`
      : `<div class="me-ok"><div class="me-ic no">!</div><h2>${stt === 'rejected' ? 'Заявка отклонена' : 'Доступ приостановлен'}</h2><p class="mp">Свяжитесь с менеджером IT-Trade.</p><div class="me-a"><button type="button" class="btn wide" data-mecheck>Проверить ещё раз</button><button type="button" class="lnk" data-melogout>Выйти</button></div></div>`;
    view.innerHTML = `<div class="ttl"><a class="back" href="#/" aria-label="Назад">‹</a><h1>Кабинет монтажника</h1></div><div class="me-box">${box}</div>`;
  }
  async function doLogin(phone, pass) {
    const j = await sbReq('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: emailOf(phone), password: pass } });
    AUTH = null; setSession(j);
    const rec = await loadMe(); setRec(rec);
    db('rpc/touch', { method: 'POST', body: {} }).catch(() => {});
    return rec;
  }
  view.addEventListener('click', async e => {
    const t = e.target;
    const tb = t.closest('[data-metab]'); if (tb) { st.meTab = tb.dataset.metab; vMe(); return; }
    if (t.closest('[data-melogout]')) return logout();
    if (t.closest('[data-mebuy]')) { toggleBuy(); return; }
    if (t.closest('[data-mecheck]')) { const b = t.closest('button'); b.disabled = true; await refreshAuth(); b.disabled = false; renderBase('#/me', true); if (AUTH && AUTH.rec.status === 'pending') toast('Пока на проверке'); return; }
    if (t.closest('[data-melogin]')) {
      const b = t.closest('button'), ph = normPhone($('#mePhone').value), pw = $('#mePass').value;
      if (ph.length !== 11) return toast('Проверьте номер телефона');
      if (!pw) return toast('Введите пароль');
      b.disabled = true;
      try { const r = await doLogin(ph, pw); renderBase('#/me', true); toast(r.status === 'active' ? 'Добро пожаловать, ' + r.name : 'Вы вошли'); } catch (err) { toast(err.message); }
      b.disabled = false; return;
    }
    if (t.closest('[data-mereg]')) {
      const b = t.closest('button'), body = { name: $('#rgName').value.trim(), company: $('#rgCompany').value.trim(), phone: normPhone($('#rgPhone').value), city: $('#rgCity').value.trim(), password: $('#rgPass').value };
      if (body.name.length < 3) return toast('Укажите ФИО');
      if (body.phone.length !== 11 || body.phone[0] !== '7') return toast('Проверьте номер телефона');
      if (body.password.length < 8) return toast('Пароль — не короче 8 символов');
      b.disabled = true;
      try {
        const j = await sbReq('/auth/v1/signup', { method: 'POST', body: { email: emailOf(body.phone), password: body.password, data: { app: 'dahua', name: body.name, company: body.company, phone: body.phone, city: body.city } } });
        if (j && j.access_token) { AUTH = null; setSession(j); setRec(await loadMe()); } else await doLogin(body.phone, body.password);
        renderBase('#/me', true); toast('Заявка отправлена');
      }
      catch (err) { toast(err.message); }
      b.disabled = false; return;
    }
  });

  /* ---------- мои клиенты ---------- */
  const CL = { list: null, kps: null, at: 0 };
  async function loadClients(force) {
    if (!force && CL.list && Date.now() - CL.at < 20000) return;
    const [c, k, o] = await Promise.all([
      db('clients?select=*&order=updated_at.desc&limit=1000'),
      db('kps?select=id,client,num,status,total_client,total_buy,total_rrp,created_at,updated_at,items:data->items&order=num.desc&limit=2000'),
      db('orders?select=id,kp,status,created_at&order=created_at.desc&limit=1000')
    ]);
    CL.list = c; CL.kps = k; CL.orders = o; CL.at = Date.now();
    CL.cById = {}; c.forEach(x => { CL.cById[x.id] = x; });
    CL.oByKp = {}; o.forEach(x => { if (x.kp && !CL.oByKp[x.kp]) CL.oByKp[x.kp] = x; });
  }
  const kpRow = k => `<div class="kpl" data-kpopen="${k.id}"><span class="stt s-${k.status}">${KST[k.status] || k.status}</span><span class="kn">№ ${k.num} · ${fmtDate(k.updated_at)}</span><b>${money(k.total_client)}</b>${seeBuy() ? `<span class="pf">+${money((k.total_client || 0) - (k.total_buy || 0))}</span>` : ''}</div>`;
  const OST = { new: ['новый', 'o-new'], work: ['в работе', 'o-work'], done: ['выполнен', 'o-done'], cancel: ['отменён', 'o-cancel'] };
  const cabTabs = on => `<div class="cab-t">${[['orders', 'Заказы'], ['clients', 'Клиенты'], ['report', 'Отчёт']].map(([k, l]) => `<a href="#/${k}"${on === k ? ' class="on"' : ''}>${l}</a>`).join('')}<span class="cab-who">${esc(inst() ? inst().name : '')} · закуп −${instDisc()} %</span></div>`;
  async function cabLoad(name, draw) {
    renderSide(name);
    if (!inst()) { location.replace('#/me'); return; }
    const h = location.hash;
    if (!CL.list) view.innerHTML = cabTabs(name) + loading();
    else draw();
    try { await loadClients(true); } catch (err) { view.innerHTML = cabTabs(name) + `<div class="empty"><b>${esc(err.message)}</b>Проверьте интернет и попробуйте снова.</div>`; return; }
    if (location.hash !== h) return;
    draw();
  }
  const profit = k => (k.total_client || 0) - (k.total_buy || 0);
  function vOrders() { cabLoad('orders', drawOrders); }
  function drawOrders() {
    const f = st.of || 'all', qv = norm(st.oq || ''), sb = seeBuy();
    const cnt = k => CL.kps.filter(x => k === 'all' || x.status === k).length;
    let list = CL.kps.filter(x => f === 'all' || x.status === f);
    if (qv) list = list.filter(x => norm(['№' + x.num, x.num, (CL.cById[x.client] || {}).name].join(' ')).includes(qv));
    view.innerHTML = cabTabs('orders') + `<div class="ttl"><h1>Заказы</h1><span class="n">${CL.kps.length}</span><div class="fbar"><input class="cl-q" id="oQ" placeholder="Поиск: клиент, №" value="${esc(st.oq || '')}"><button type="button" class="btn sm" data-neworder>+ Новый заказ</button></div></div>
<div class="chips2">${[['all', 'Все']].concat(Object.keys(KST).map(k => [k, KST[k]])).map(([k, l]) => `<button type="button" data-of="${k}"${f === k ? ' class="on"' : ''}>${l[0].toUpperCase() + l.slice(1)} <em>${cnt(k)}</em></button>`).join('')}</div>
${list.length && mqPhone.matches ? `<div class="mc">${list.map(k => { const c = CL.cById[k.client], o = CL.oByKp[k.id]; return `<div class="mci" data-kpopen="${k.id}"><div class="l"><b>${esc(c ? c.name : 'без клиента')}</b><small>№ ${k.num} · ${fmtDate(k.created_at)} · ${Array.isArray(k.items) ? k.items.length : 0} поз.</small><div class="ps"><span class="stt s-${k.status}">${KST[k.status] || k.status}</span>${o ? `<span class="stt ${OST[o.status][1]}">IT-Trade: ${OST[o.status][0]}</span>` : ''}</div></div><div class="rr"><b>${money(k.total_client)}</b>${sb ? `<span class="g">+${money(profit(k))}</span>` : ''}</div></div>`; }).join('')}</div>`
      : list.length ? `<div class="tw"><table class="ct"><thead><tr><th>№ / дата</th><th>Клиент</th><th class="r">Позиций</th><th class="r">Клиенту</th>${sb ? '<th class="r">Закуп</th><th class="r">Прибыль</th>' : ''}<th>Статус</th><th>IT-Trade</th></tr></thead><tbody>
${list.map(k => { const c = CL.cById[k.client], o = CL.oByKp[k.id]; return `<tr data-kpopen="${k.id}"><td><b>№ ${k.num}</b><small>${fmtDate(k.created_at)}</small></td><td><b>${esc(c ? c.name : 'без клиента')}</b></td><td class="r">${Array.isArray(k.items) ? k.items.length : '—'}</td><td class="r"><b>${money(k.total_client)}</b></td>${sb ? `<td class="r mut">${money(k.total_buy)}</td><td class="r g">+${money(profit(k))}</td>` : ''}<td><span class="stt s-${k.status}">${KST[k.status] || k.status}</span></td><td>${o ? `<span class="stt ${OST[o.status][1]}">${OST[o.status][0]}</span>` : '<span class="mut">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty"><b>${CL.kps.length ? 'Ничего не найдено' : 'Заказов пока нет'}</b>${CL.kps.length ? '' : 'Соберите КП из каталога и нажмите «В мои клиенты» — заказ появится здесь.'}</div>`}`;
  }
  function vClients() { cabLoad('clients', drawClients); }
  function drawClients() {
    const qv = norm(st.clq || ''), sb = seeBuy();
    const byC = {}; CL.kps.forEach(k => { (byC[k.client || ''] = byC[k.client || ''] || []).push(k); });
    let list = CL.list.slice();
    if (qv) list = list.filter(c => norm([c.name, c.phone, c.address, c.note].join(' ')).includes(qv));
    const agg = c => { const ks = (byC[c.id] || []).filter(k => k.status !== 'cancel'); return { n: ks.length, sum: ks.reduce((a, k) => a + (k.total_client || 0), 0), pr: ks.filter(k => k.status === 'done').reduce((a, k) => a + profit(k), 0), last: ks.length ? ks.map(k => k.updated_at).sort().pop() : c.updated_at }; };
    view.innerHTML = cabTabs('clients') + `<div class="ttl"><h1>Клиенты</h1><span class="n">${CL.list.length}</span><div class="fbar"><input class="cl-q" id="clQ" placeholder="Поиск: имя, телефон, адрес" value="${esc(st.clq || '')}"><button type="button" class="btn sm" data-newclient>+ Клиент</button></div></div>
${list.length && mqPhone.matches ? `<div class="mc">${list.map(c => { const g = agg(c); return `<div class="mci" data-cl="${c.id}"><div class="l"><b>${esc(c.name)}</b><small>${esc([c.phone, c.address].filter(Boolean).join(' · ') || '—')}</small><small>Заказов: ${g.n} · последний ${fmtDate(g.last)}</small></div><div class="rr"><b>${money(g.sum)}</b>${sb && g.pr ? `<span class="g">+${money(g.pr)}</span>` : ''}</div></div>`; }).join('')}</div>`
      : list.length ? `<div class="tw"><table class="ct"><thead><tr><th>Клиент</th><th>Адрес объекта</th><th class="r">Заказов</th><th class="r">Сумма</th>${sb ? '<th class="r">Заработано</th>' : ''}<th>Последний</th></tr></thead><tbody>
${list.map(c => { const g = agg(c); return `<tr data-cl="${c.id}"><td><b>${esc(c.name)}</b><small>${esc(c.phone || '')}</small></td><td class="mut">${esc(c.address || '—')}</td><td class="r">${g.n}</td><td class="r"><b>${money(g.sum)}</b></td>${sb ? `<td class="r g">${g.pr ? '+' + money(g.pr) : '—'}</td>` : ''}<td>${fmtDate(g.last)}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty"><b>${CL.list.length ? 'Ничего не найдено' : 'Пока нет клиентов'}</b>${CL.list.length ? '' : 'Добавьте клиента кнопкой «+ Клиент» или сохраните КП «В мои клиенты».'}</div>`}`;
  }
  function vReport() { cabLoad('report', drawReport); }
  function drawReport() {
    const per = st.rp || 'q', now = new Date();
    const start = per === 'm' ? new Date(now.getFullYear(), now.getMonth(), 1) : per === 'q' ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1) : new Date(now.getFullYear(), 0, 1);
    const D = x => new Date(String(x).replace(' ', 'T'));
    const inP = x => D(x) >= start;
    const done = CL.kps.filter(k => k.status === 'done' && inP(k.updated_at));
    const earned = done.reduce((a, k) => a + profit(k), 0), turn = done.reduce((a, k) => a + (k.total_client || 0), 0), buy = done.reduce((a, k) => a + (k.total_buy || 0), 0);
    const work = CL.kps.filter(k => k.status === 'agreed' || k.status === 'ordered');
    const workP = work.reduce((a, k) => a + profit(k), 0);
    const created = CL.kps.filter(k => inP(k.created_at));
    const fn = [['Создано КП', created.length], ['Отправлено клиенту', created.filter(k => ['sent', 'agreed', 'ordered', 'done'].includes(k.status)).length], ['Согласовано', created.filter(k => ['agreed', 'ordered', 'done'].includes(k.status)).length], ['Смонтировано', created.filter(k => k.status === 'done').length]];
    const months = []; for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ d, n: 0 }); }
    CL.kps.filter(k => k.status === 'done').forEach(k => { const d = D(k.updated_at); const m = months.find(x => x.d.getFullYear() === d.getFullYear() && x.d.getMonth() === d.getMonth()); if (m) m.n += profit(k); });
    const mx = Math.max(1, ...months.map(m => m.n));
    const MN = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const byC = {}; done.forEach(k => { byC[k.client || ''] = (byC[k.client || ''] || 0) + profit(k); });
    const top = Object.entries(byC).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const fmtK = n => n >= 1000 ? Math.round(n / 1000) + ' т' : Math.round(n) + '';
    const perName = per === 'm' ? 'месяц' : per === 'q' ? 'квартал' : 'год';
    view.innerHTML = cabTabs('report') + `<div class="ttl"><h1>Отчёт</h1><div class="fbar"><div class="seg2">${[['m', 'Месяц'], ['q', 'Квартал'], ['y', 'Год']].map(([k, l]) => `<button type="button" data-rp="${k}"${per === k ? ' class="on"' : ''}>${l}</button>`).join('')}</div></div></div>
<div class="rp-cards"><div class="rc g"><span>Заработано за ${perName}</span><b>${money(earned)}</b><small>прибыль по смонтированным: ${done.length}</small></div><div class="rc"><span>Оборот с клиентами</span><b>${money(turn)}</b><small>смонтировано за ${perName}</small></div><div class="rc"><span>Закуплено у IT-Trade</span><b>${money(buy)}</b><small>по вашей цене −${instDisc()} %</small></div><div class="rc b"><span>В работе</span><b>+${money(workP)}</b><small>ожидаемая прибыль: согласовано и заказано (${work.length})</small></div></div>
<div class="rp-two"><div class="rbox"><h3>Прибыль по месяцам</h3><div class="chart">${months.map(m => `<div class="bc"><span class="bv">${m.n ? fmtK(m.n) : ''}</span><div class="bar" style="height:${Math.max(m.n ? 4 : 0, m.n / mx * 150)}px"></div><span class="bl">${MN[m.d.getMonth()]}</span></div>`).join('')}</div></div>
<div class="rbox"><h3>Воронка за ${perName}</h3><div class="fn">${fn.map(([l, n]) => `<div><span>${l}</span><i style="width:${fn[0][1] ? Math.max(3, n / fn[0][1] * 100) : 0}%"></i><b>${n}</b></div>`).join('')}</div>
<p class="mut sm">${fn[0][1] ? `Конверсия КП → монтаж: <b>${Math.round(fn[3][1] / fn[0][1] * 100)} %</b>. ` : ''}${turn ? `Средняя маржа: <b>${Math.round(earned / turn * 100)} %</b>. Средний чек: <b>${money(turn / done.length)}</b>.` : ''}</p>
<h3 class="mt">Лучшие клиенты</h3>${top.length ? `<div class="rtop">${top.map(([c, v]) => `<div><span>${esc((CL.cById[c] || {}).name || 'без клиента')}</span><b>+${money(v)}</b></div>`).join('')}</div>` : '<p class="mut sm">Появятся после первых смонтированных заказов.</p>'}</div></div>
<p class="mut sm">«Заработано» — сумма клиенту минус закуп по заказам в статусе «смонтировано». Меняйте статус в заказе, когда объект сдан.</p>`;
  }

  /* ---------- широкое КП (компьютер и планшет) ---------- */
  function vKPW() {
    renderSide(inst() ? 'orders' : null);
    if (mqPhone.matches) { location.replace('#/kp'); return; }
    drawKPW();
  }
  function drawKPW() {
    const t = kpTotals(), gd = Number(KP.gd) || 0, sb = seeBuy(), me = inst(), srv = KP.srv && KP.srv.id ? KP.srv : null;
    const ae = document.activeElement, aeId = ae && ae.id;
    view.innerHTML = (me ? cabTabs('orders') : '') + `<div class="ttl"><a class="back" href="${me ? '#/orders' : '#/'}" aria-label="Назад">‹</a><h1>${srv ? 'КП № ' + srv.num : 'Новое КП'}</h1>
<div class="fbar"><label class="fld w-cl"><small>Клиент</small><input id="wClient" value="${esc(KP.client)}" placeholder="название или имя"></label>
${srv ? `<select id="wStatus" class="sort" aria-label="Статус">${Object.keys(KST).map(k => `<option value="${k}"${srv.status === k ? ' selected' : ''}>${KST[k]}</option>`).join('')}</select>` : ''}
${me ? `<button type="button" class="hbtn buyb${showBuy ? ' on' : ''}" data-wbuy>👁 закуп</button>` : ''}</div></div>
${t.n ? `<div class="tw"><table class="ct kpw"><thead><tr><th></th><th>Товар</th><th class="c">Кол-во</th><th class="r">РРЦ</th><th class="c">Скидка</th><th class="r">Цена клиенту</th><th class="r">Сумма</th>${sb ? '<th class="r bu">Закуп</th>' : ''}<th></th></tr></thead><tbody>
${KP.items.map(r => { const [s, qn] = r, it = BYSKU.get(s), d = lineDisc(r), u = discPrice(it, d), bp = buyPrice(it); return `<tr class="wr" data-s="${esc(s)}"><td class="ph">${imgTag(s, '')}</td><td><button class="sku" data-open>${esc(s)}</button><small>${esc(it.d)}</small></td>
<td class="c"><div class="stp sm"><button data-dec aria-label="Меньше">−</button><input inputmode="numeric" value="${qn}" aria-label="Количество"><button data-inc aria-label="Больше">+</button></div></td>
<td class="r mut">${money(it.price)}</td><td class="c"><button class="kdisc${r[2] != null ? ' own' : d ? ' on' : ''}" data-ldisc>${d ? '−' + d + ' %' : '—'}</button></td>
<td class="r"><b>${u == null ? '—' : money(u)}</b></td><td class="r"><b>${u == null ? '—' : money(u * qn)}</b></td>${sb ? `<td class="r bu">${bp == null ? '—' : money(bp * qn)}</td>` : ''}<td><button class="kx" data-del aria-label="Удалить">✕</button></td></tr>`; }).join('')}</tbody></table></div>`
      : '<div class="empty"><b>КП пустое</b>Добавьте товары из каталога кнопкой «+».</div>'}
<div class="w-tools"><label class="fld"><small>Скидка клиенту на всё</small><input id="wGd" type="number" inputmode="decimal" min="0" max="90" value="${gd || ''}" placeholder="0"><small>%</small></label><a class="btn2" href="#/">+ Товары из каталога</a>${t.n ? '<button type="button" class="lnk" data-wclear>Очистить</button>' : ''}</div>
<div class="w-tot"><div class="tb"><span>По РРЦ</span><b>${money(t.rrp)}</b></div><div class="tb cl"><span>Клиенту${t.anyDisc ? ' со скидкой' : ''}</span><b>${money(t.sum)}</b><small>${t.anyDisc ? 'скидка ' + money(t.disc) + ', ' : ''}в т.ч. НДС ${VAT} % ${money(t.vat)}</small></div>
${sb ? `<div class="tb"><span>Ваш закуп (−${instDisc()} %)</span><b>${money(t.buy)}</b></div><div class="tb pr"><span>Ваша прибыль</span><b>${money(t.profit)}</b><small>${t.sum ? Math.round(t.profit / t.sum * 100) + ' % от суммы клиента' : ''}</small></div>` : ''}</div>
<div class="w-act"><button data-wpdf${t.n ? '' : ' disabled'}>PDF клиенту</button><button data-wxlsx${t.n ? '' : ' disabled'}>Excel</button><button class="p" data-wsend${t.n ? '' : ' disabled'}>Отправить</button>${me ? `<span class="sp"></span><button data-wsave${t.n ? '' : ' disabled'}>${srv ? 'Сохранить' : 'Сохранить в клиента'}</button><button class="g" data-worder${t.n ? '' : ' disabled'}>Заказать у IT-Trade</button>` : ''}</div>`;
    if (aeId === 'wClient' || aeId === 'wGd') { const el = $('#' + aeId); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } }
  }
  view.addEventListener('click', e => {
    const t = e.target;
    const of = t.closest('[data-of]'); if (of) { st.of = of.dataset.of; drawOrders(); return; }
    const rp = t.closest('[data-rp]'); if (rp) { st.rp = rp.dataset.rp; drawReport(); return; }
    if (t.closest('[data-neworder]')) {
      if (KP.items.length && !(KP.srv && KP.srv.id) && !confirm('Текущее КП не сохранено и будет очищено. Начать новый заказ?')) return;
      KP = normKP({}); saveKP(); renderKP(); refreshAdds(); location.hash = '#/'; toast('Новый заказ: добавляйте товары кнопкой «+»'); return;
    }
    if (!$('.kpw', view) && !$('.w-act', view)) return;
    if (t.closest('[data-wbuy]')) return toggleBuy();
    if (t.closest('[data-wclear]')) { if (confirm('Очистить КП?')) { KP = normKP({}); saveKP(); renderKP(); refreshAdds(); } return; }
    if (t.closest('[data-wpdf]')) return run(t.closest('button'), () => exportPDF(false));
    if (t.closest('[data-wxlsx]')) return run(t.closest('button'), exportXLSX);
    if (t.closest('[data-wsend]')) return run(t.closest('button'), () => exportPDF(true));
    if (t.closest('[data-wsave]')) return run(t.closest('button'), saveKPServer);
    if (t.closest('[data-worder]')) return orderDialog();
    const r = t.closest('tr.wr'), s = r && r.dataset.s; if (!s) return;
    if (t.closest('[data-ldisc]')) return lineDiscPrompt(s);
    if (t.closest('[data-del]')) return setQty(s, 0);
    if (t.closest('[data-dec]')) return setQty(s, kpQty(s) - 1);
    if (t.closest('[data-inc]')) return setQty(s, kpQty(s) + 1);
    if (t.closest('[data-open]')) { sheetPushed = true; location.hash = '#/p/' + encodeURIComponent(s); }
  });
  view.addEventListener('input', e => {
    if (e.target.id === 'wClient') { KP.client = e.target.value; saveKP(); const k = $('#kpClient'); if (k) k.value = KP.client; }
    if (e.target.id === 'oQ') { st.oq = e.target.value; clearTimeout(st.oqt); st.oqt = setTimeout(() => { const p = e.target.selectionStart; drawOrders(); const i = $('#oQ'); if (i) { i.focus(); try { i.setSelectionRange(p, p); } catch (x) {} } }, 200); }
  });
  view.addEventListener('change', e => {
    if (e.target.id === 'wGd') { const v = parseFloat(String(e.target.value).replace(',', '.')) || 0; KP.gd = Math.max(0, Math.min(90, Math.round(v * 10) / 10)); saveKP(); renderKP(); return; }
    if (e.target.id === 'wStatus') { const v = e.target.value; db('kps?id=eq.' + U(KP.srv.id), { method: 'PATCH', body: { status: v } }).then(() => { KP.srv.status = v; saveKP(); CL.at = 0; renderKP(); toast('Статус: ' + KST[v]); }).catch(err => toast(err.message)); return; }
    const r = e.target.closest('tr.wr'); if (r && e.target.tagName === 'INPUT') setQty(r.dataset.s, e.target.value);
  });
  async function vClient(id) {
    renderSide('clients');
    if (!inst()) { location.replace('#/me'); return; }
    view.innerHTML = cabTabs('clients') + `<div class="ttl"><a class="back" href="#/clients" aria-label="Назад">‹</a><h1>Клиент</h1></div>` + loading();
    let c, ks;
    try { [c, ks] = await Promise.all([db('clients?select=*&id=eq.' + U(id)), db('kps?select=id,client,num,status,total_client,total_buy,total_rrp,updated_at&order=updated_at.desc&limit=200&client=eq.' + U(id))]); c = c[0]; if (!c) throw new Error('Клиент не найден'); }
    catch (err) { view.innerHTML = cabTabs('clients') + `<div class="ttl"><a class="back" href="#/clients">‹</a><h1>Клиент</h1></div><div class="empty"><b>${esc(err.message)}</b></div>`; return; }
    const sum = ks.filter(k => k.status !== 'cancel').reduce((a, k) => a + (k.total_client || 0), 0), pr = ks.filter(k => ['agreed', 'ordered', 'done'].includes(k.status)).reduce((a, k) => a + (k.total_client || 0) - (k.total_buy || 0), 0);
    view.innerHTML = cabTabs('clients') + `<div class="ttl"><a class="back" href="#/clients" aria-label="Назад">‹</a><h1>${esc(c.name)}</h1><div class="fbar"><button type="button" class="btn sm" data-newkp="${c.id}">+ Новое КП</button></div></div>
<div class="cl-grid"><div class="cl-card"><h3>Данные клиента</h3>
<label class="fl"><span>Название / имя</span><input id="ceName" value="${esc(c.name)}"></label>
<label class="fl"><span>Телефон</span><input id="cePhone" type="tel" value="${esc(c.phone || '')}"></label>
<label class="fl"><span>Адрес объекта</span><input id="ceAddr" value="${esc(c.address || '')}"></label>
<label class="fl"><span>Заметка</span><textarea id="ceNote" rows="3">${esc(c.note || '')}</textarea></label>
<div class="md-a"><button type="button" class="lnk red" data-cedel="${c.id}">Удалить клиента</button><button type="button" class="btn" data-cesave="${c.id}">Сохранить</button></div></div>
<div class="cl-card"><h3>КП клиента <em>${ks.length}</em></h3>${ks.length ? `<div class="cl-sum"><span>Сумма КП: <b>${money(sum)}</b></span>${seeBuy() ? `<span>Прибыль (согласованные): <b class="g">${money(pr)}</b></span>` : ''}</div>` : ''}
${ks.map(k => `<div class="kpc"><div class="kpl" data-kpopen="${k.id}"><span class="stt s-${k.status}">${KST[k.status] || k.status}</span><span class="kn">№ ${k.num} · ${fmtDate(k.updated_at)}</span><b>${money(k.total_client)}</b>${seeBuy() ? `<span class="pf">+${money((k.total_client || 0) - (k.total_buy || 0))}</span>` : ''}</div>
<div class="kpc-a"><button type="button" data-kpopen="${k.id}">Открыть</button><button type="button" data-kpcopy="${k.id}">Копия</button><button type="button" class="red" data-kpdel="${k.id}">Удалить</button></div></div>`).join('') || '<p class="mp">КП пока нет.</p>'}</div></div>`;
    view.dataset.cname = c.name;
  }
  async function openServerKP(id, asCopy) {
    try {
      const k = (await db('kps?select=*,cl:clients(name)&id=eq.' + U(id)))[0];
      if (!k) throw new Error('КП не найдено');
      const cname = k.cl ? k.cl.name : '';
      const nk = normKP(Object.assign({}, k.data || {}, { client: (k.data && k.data.client) || cname }));
      nk.srv = asCopy ? (k.client ? { client: k.client, clientName: cname } : null) : { id: k.id, num: k.num, status: k.status, client: k.client || '', clientName: cname };
      if (KP.items.length && !(KP.srv && KP.srv.id === k.id) && !confirm('Заменить текущее КП на ' + (asCopy ? 'копию ' : '') + 'КП № ' + k.num + '?')) return;
      KP = nk; saveKP(); renderKP(); refreshAdds();
      if (mqPhone.matches) { kpPushed = true; location.hash = '#/kp'; } else location.hash = '#/kpw';
      toast(asCopy ? 'Копия КП № ' + k.num + ' — сохраните как новое' : 'Открыто КП № ' + k.num);
    } catch (err) { toast(err.message); }
  }
  function clientForm(title, c, onSave) {
    openModal(`<h2>${title}</h2><label class="fl"><span>Название / имя</span><input id="ncName" value="${esc((c && c.name) || '')}" placeholder="ООО «Стройдом» или Иванов А.П."></label>
<label class="fl"><span>Телефон</span><input id="ncPhone" type="tel" value="${esc((c && c.phone) || '')}"></label>
<label class="fl"><span>Адрес объекта</span><input id="ncAddr" value="${esc((c && c.address) || '')}"></label>
<div class="md-a"><span></span><button type="button" class="btn" data-ncsave>Сохранить</button></div>`, async e => {
      if (!e.target.closest('[data-ncsave]')) return;
      const body = { name: $('#ncName').value.trim(), phone: $('#ncPhone').value.trim(), address: $('#ncAddr').value.trim() };
      if (!body.name) return toast('Укажите название клиента');
      const b = e.target.closest('button'); b.disabled = true;
      try { await onSave(body); } catch (err) { toast(err.message); b.disabled = false; }
    });
  }
  view.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-newclient]')) {
      clientForm('Новый клиент', null, async body => { const c = (await db('clients', { method: 'POST', body }))[0]; closeModal(); CL.at = 0; location.hash = '#/client/' + c.id; });
      return;
    }
    const kc = t.closest('[data-kpcopy]'); if (kc) { openServerKP(kc.dataset.kpcopy, true); return; }
    const kd = t.closest('[data-kpdel]'); if (kd) {
      if (!confirm('Удалить КП?')) return;
      try { await db('kps?id=eq.' + U(kd.dataset.kpdel), { method: 'DELETE' }); if (KP.srv && KP.srv.id === kd.dataset.kpdel) { KP.srv = null; saveKP(); renderKP(); } CL.at = 0; renderBase(st.base, true); toast('КП удалено'); } catch (err) { toast(err.message); }
      return;
    }
    const ko = t.closest('[data-kpopen]'); if (ko) { openServerKP(ko.dataset.kpopen, false); return; }
    const nk = t.closest('[data-newkp]'); if (nk) {
      if (KP.items.length && !confirm('Начать новое КП для клиента? Текущее КП ' + (KP.srv && KP.srv.id ? 'сохранено в клиентах.' : 'не сохранено и будет очищено.'))) return;
      KP = normKP({ client: view.dataset.cname || '' }); KP.srv = { client: nk.dataset.newkp, clientName: view.dataset.cname || '' }; saveKP(); renderKP(); refreshAdds();
      location.hash = '#/'; toast('Новое КП для ' + (view.dataset.cname || 'клиента') + ': добавляйте товары');
      return;
    }
    const cs = t.closest('[data-cesave]'); if (cs) {
      const body = { name: $('#ceName').value.trim(), phone: $('#cePhone').value.trim(), address: $('#ceAddr').value.trim(), note: $('#ceNote').value.trim() };
      if (!body.name) return toast('Укажите название клиента');
      cs.disabled = true; try { await db('clients?id=eq.' + U(cs.dataset.cesave), { method: 'PATCH', body }); CL.at = 0; toast('Сохранено'); view.dataset.cname = body.name; $('.ttl h1', view).textContent = body.name; } catch (err) { toast(err.message); }
      cs.disabled = false; return;
    }
    const cd = t.closest('[data-cedel]'); if (cd) {
      if (!confirm('Удалить клиента? Его КП останутся в списке «Без клиента».')) return;
      try { await db('clients?id=eq.' + U(cd.dataset.cedel), { method: 'DELETE' }); CL.at = 0; location.hash = '#/clients'; toast('Клиент удалён'); } catch (err) { toast(err.message); }
      return;
    }
    const cl = t.closest('[data-cl]'); if (cl && !t.closest('[data-kpopen]')) { location.hash = '#/client/' + cl.dataset.cl; return; }
  });
  view.addEventListener('input', e => { if (e.target.id === 'clQ') { st.clq = e.target.value; clearTimeout(st.clqt); st.clqt = setTimeout(() => { const p = e.target.selectionStart; drawClients(); const i = $('#clQ'); if (i) { i.focus(); try { i.setSelectionRange(p, p); } catch (x) {} } }, 200); } });

  /* ---------- сохранить КП / заказ ---------- */
  function kpPayload() { const t = kpTotals(); return { data: { items: KP.items, gd: Number(KP.gd) || 0, client: KP.client }, total_rrp: t.rrp, total_client: t.sum, total_buy: t.buy }; }
  async function saveKPServer() {
    const me = inst(); if (!me) throw new Error('Войдите как монтажник');
    if (KP.srv && KP.srv.id) {
      await db('kps?id=eq.' + U(KP.srv.id), { method: 'PATCH', body: Object.assign(kpPayload(), KP.srv.client ? { client: KP.srv.client } : {}) });
      CL.at = 0; toast('КП № ' + KP.srv.num + ' сохранено'); return;
    }
    if (KP.srv && KP.srv.client) return createKP(KP.srv.client, KP.srv.clientName);
    await loadClients();
    const nm = KP.client.trim(), match = CL.list.find(c => norm(c.name) === norm(nm));
    openModal(`<h2>Сохранить КП в клиента</h2><p class="mp">Выберите клиента или создайте нового.</p>
<label class="fl"><span>Новый клиент</span><input id="skNew" value="${esc(match ? '' : nm)}" placeholder="Название или имя"></label>
${CL.list.length ? `<div class="sk-list">${CL.list.slice(0, 50).map(c => `<button type="button" data-skc="${c.id}"${match && match.id === c.id ? ' class="on"' : ''}>${esc(c.name)}</button>`).join('')}</div>` : ''}
<div class="md-a"><span></span><button type="button" class="btn" data-sksave>Сохранить</button></div>`, async e => {
      const pick = e.target.closest('[data-skc]');
      if (pick) { $$('[data-skc]', modal).forEach(b => b.classList.toggle('on', b === pick)); $('#skNew').value = ''; return; }
      if (!e.target.closest('[data-sksave]')) return;
      const b = e.target.closest('button'); b.disabled = true;
      try {
        const sel = $('[data-skc].on', modal); let cid, cname;
        if (sel) { cid = sel.dataset.skc; cname = sel.textContent; }
        else { cname = $('#skNew').value.trim(); if (!cname) { b.disabled = false; return toast('Укажите клиента'); } const c = (await db('clients', { method: 'POST', body: { name: cname } }))[0]; cid = c.id; }
        await createKP(cid, cname); closeModal();
      } catch (err) { toast(err.message); b.disabled = false; }
    });
  }
  async function createKP(cid, cname) {
    const me = inst();
    if (!KP.client.trim()) KP.client = cname || '';
    const k = (await db('kps', { method: 'POST', body: Object.assign({ client: cid, status: 'draft' }, kpPayload()) }))[0];
    KP.srv = { id: k.id, num: k.num, status: k.status, client: cid, clientName: cname }; saveKP(); renderKP(); CL.at = 0;
    toast('Сохранено: КП № ' + k.num + ' для ' + cname);
  }
  function orderDialog() {
    const me = inst(); if (!me) return;
    const t = kpTotals();
    openModal(`<h2>Заказать у IT-Trade</h2><p class="mp">Заказ уйдёт менеджеру IT-Trade по вашим закупочным ценам.</p>
<div class="od"><div><span>Позиций / штук</span><b>${t.n} / ${t.pcs}</b></div><div><span>Сумма по вашему закупу (−${instDisc()} %)</span><b class="g">${money(t.buy)}</b></div>${t.unknown ? `<div><span>Позиции «по запросу»</span><b>${t.unknown}</b></div>` : ''}</div>
<label class="fl"><span>Комментарий к заказу</span><textarea id="odCom" rows="3" placeholder="Сроки, доставка, счёт на…"></textarea></label>
<div class="md-a"><span></span><button type="button" class="btn g" data-odsend>Отправить заказ</button></div>`, async e => {
      if (!e.target.closest('[data-odsend]')) return;
      const b = e.target.closest('button'); b.disabled = true;
      try {
        const items = KP.items.map(r => { const it = BYSKU.get(r[0]); return { s: r[0], d: it.d, q: r[1], rrp: it.price, buy: buyPrice(it) }; });
        await db('orders', { method: 'POST', body: { kp: KP.srv && KP.srv.id ? KP.srv.id : null, items, total_buy: t.buy, total_rrp: t.rrp, comment: $('#odCom').value.trim() } });
        if (KP.srv && KP.srv.id) { try { await db('kps?id=eq.' + U(KP.srv.id), { method: 'PATCH', body: { status: 'ordered' } }); KP.srv.status = 'ordered'; saveKP(); renderKP(); } catch (x) {} }
        closeModal(); CL.at = 0; toast('Заказ отправлен в IT-Trade. Менеджер свяжется с вами.');
      } catch (err) { toast(err.message); b.disabled = false; }
    });
  }
  /* ---------- тост ---------- */
  let tt;
  function toast(msg, act, fn) {
    const t = $('#toast'); clearTimeout(tt);
    t.innerHTML = `<span>${esc(msg)}</span>${act ? `<button>${esc(act)}</button>` : ''}`; t.hidden = false;
    if (act) $('button', t).onclick = () => { t.hidden = true; fn(); };
    tt = setTimeout(() => { t.hidden = true; }, act ? 4000 : 2600);
  }

  /* ---------- сеть, SW ---------- */
  const net = () => { $('#net').hidden = navigator.onLine; };
  addEventListener('online', net); addEventListener('offline', net); net();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing; if (!w) return;
          w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Доступно обновление приложения', 'Обновить', () => location.reload()); });
        });
      }).catch(() => {});
    });
  }

  /* ---------- старт ---------- */
  mqDesk.addEventListener && mqDesk.addEventListener('change', () => { if (mqDesk.matches) document.body.classList.remove('kp-open'); });
  mqPhone.addEventListener && mqPhone.addEventListener('change', () => { if (st.rendered) renderBase(st.base, true); });
  $('#buyBtn').addEventListener('click', toggleBuy);
  applyInstUI();
  renderKP();
  route();
  booted = true;
  ibSchedule();
  refreshAuth(true);
  setInterval(() => refreshAuth(true), 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshAuth(true); });
  if (/[?&]diag\b/.test(location.search)) setTimeout(showDiag, 800);
  if (/[?&]install\b/.test(location.search)) setTimeout(() => showIB(true), 800);
})();
