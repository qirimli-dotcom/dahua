'use strict';
/* Dahua прайс IT-Trade — PWA. Данные: data.js (PRICE, DATA), images.js (IMAGES). */
(function () {
  const APP_VER = '1.1';
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
  let KP = load('dh-kp', { items: [], client: '', adj: 0 });
  if (!Array.isArray(KP.items)) KP = { items: [], client: '', adj: 0 };
  KP.items = KP.items.filter(r => BYSKU.has(r[0]));
  const FAV = new Set(load('dh-fav', []).filter(s => BYSKU.has(s)));
  const saveKP = () => save('dh-kp', KP);
  const saveFav = () => save('dh-fav', Array.from(FAV));
  const kpQty = s => { const r = KP.items.find(r => r[0] === s); return r ? r[1] : 0; };
  const unitPrice = it => it.price == null ? null : Math.round(it.price * (1 + (Number(KP.adj) || 0) / 100));

  function setQty(s, q) {
    q = Math.max(0, Math.min(99999, Math.floor(Number(q) || 0)));
    const i = KP.items.findIndex(r => r[0] === s);
    if (q === 0) { if (i >= 0) KP.items.splice(i, 1); }
    else if (i >= 0) KP.items[i][1] = q; else KP.items.push([s, q]);
    saveKP(); renderKP(); refreshAdds();
  }

  /* ---------- элементы ---------- */
  const view = $('#view'), side = $('#side'), kpEl = $('#kp'), sheet = $('#sheet'), qIn = $('#q');
  $('#priceDate').textContent = PR.date ? 'прайс от ' + PR.date : '';
  document.title = 'Dahua — прайс IT-Trade' + (PR.date ? ' от ' + PR.date : '');

  const top = $('#top');
  const setHH = () => document.documentElement.style.setProperty('--hh', top.offsetHeight + 'px');
  setHH(); if (window.ResizeObserver) new ResizeObserver(setHH).observe(top); else addEventListener('resize', setHH);

  /* ---------- боковое меню ---------- */
  function renderSide(activeCi) {
    side.innerHTML = '<a href="#/"' + (activeCi === 'home' ? ' class="on"' : '') + '><span>Все разделы</span><em>' + ITEMS.length + '</em></a>' +
      '<a href="#/fav"' + (activeCi === 'fav' ? ' class="on"' : '') + '><span>Избранное</span><em>' + FAV.size + '</em></a><div class="sep"></div>' +
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
<div class="bt"><div><b${it.price == null ? ' class="req"' : ''}>${money(it.price)}</b><span>${esc(fmtW(it.w))}</span></div>
<button class="add${q ? ' on' : ''}" data-add aria-label="${q ? 'В КП: ' + q + ' шт' : 'Добавить в КП'}">${q ? q : '+'}</button></div></article>`;
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
  const sortSel = () => `<select class="sort" id="sortSel" aria-label="Сортировка">
<option value="def"${st.sort === 'def' ? ' selected' : ''}>Как в прайсе</option>
<option value="asc"${st.sort === 'asc' ? ' selected' : ''}>Цена ↑</option>
<option value="desc"${st.sort === 'desc' ? ' selected' : ''}>Цена ↓</option></select>`;

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
    const btnLab = !sel.size ? 'Серия' : sel.size === 1 ? 'Серия: ' + esc(c.tagOf[Array.from(sel)[0]]) : 'Серия: выбрано ' + sel.size;
    const fbar = `<div class="fbar">${hasF ? `<div class="ddw" id="ddw"><button type="button" class="dd${sel.size ? ' act' : ''}" id="ddBtn" aria-haspopup="true" aria-expanded="false"><span>${btnLab}</span><b>▾</b></button><div class="pop" id="ddPop" hidden></div></div>` : ''}<span class="sp"></span>${sortSel()}</div>`;
    const tags = sel.size ? `<div class="ftags">${Array.from(sel).sort((a, b) => a - b).map(gi => `<button type="button" data-untag="${gi}">${esc(c.tagOf[gi])} <i>✕</i></button>`).join('')}<button type="button" class="lnk" data-clearall>Сбросить всё</button></div>` : '';
    view.innerHTML = `<div class="ttl"><a class="back" href="#/" aria-label="Все разделы">‹</a><h1>${esc(c.name)}</h1><span class="n">${sel.size ? list.length + ' из ' + c.items.length : list.length} поз.</span></div>${fbar}${tags}<div class="grid">${body}</div>`;
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
  function ddOpen() { if (!$('#ddPop')) return; dd.pending = new Set(dd.sel); dd.open = true; ddRender(); $('#ddPop').hidden = false; $('#ddBtn').setAttribute('aria-expanded', 'true'); $('#ddw').classList.add('open'); if (mqPhone.matches) document.body.classList.add('dd-open', 'noscroll'); }
  function ddClose() { if (!dd.open) return; dd.open = false; const p = $('#ddPop'); if (p) p.hidden = true; const b = $('#ddBtn'); if (b) b.setAttribute('aria-expanded', 'false'); const w = $('#ddw'); if (w) w.classList.remove('open'); document.body.classList.remove('dd-open'); if (sheet.hidden && !document.body.classList.contains('kp-open')) document.body.classList.remove('noscroll'); }
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
    view.innerHTML = `<div class="ttl"><h1>Поиск: «${esc(q)}»</h1><span class="n">${res.length} поз.</span>${sortSel()}</div>
<div class="grid">${shown.map(it => card(it, true, hl)).join('')}</div>${res.length > shown.length ? `<button class="more-btn" id="moreBtn">Показать ещё ${Math.min(120, res.length - shown.length)} из ${res.length - shown.length}</button>` : ''}`;
  }
  function vFav() {
    renderSide('fav');
    const list = sortItems(Array.from(FAV).map(s => BYSKU.get(s)).filter(Boolean));
    view.innerHTML = `<div class="ttl"><a class="back" href="#/" aria-label="Все разделы">‹</a><h1>Избранное</h1><span class="n">${list.length} поз.</span>${list.length ? sortSel() : ''}</div>` +
      (list.length ? `<div class="grid">${list.map(it => card(it, true)).join('')}</div>` : '<div class="empty"><b>Пока пусто</b>Отмечайте товары сердечком в карточке, чтобы быстро к ним возвращаться.</div>');
  }

  /* ---------- роутер ---------- */
  function parse(h) { return (h || '#/').replace(/^#\/?/, '').split('/').map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } }); }
  function renderBase(h, force) {
    if (!force && st.rendered === h) return;
    const p = parse(h);
    if (p[0] !== 's') { st.q = ''; if (qIn.value && document.activeElement !== qIn) qIn.value = ''; $('#qx').hidden = !qIn.value; $('#qn').textContent = ITEMS.length.toLocaleString('ru-RU'); }
    if (p[0] === 'c') vCat(+p[1], p[2]);
    else if (p[0] === 's' && p[1]) { st.q = p[1]; if (qIn.value !== p[1] && document.activeElement !== qIn) qIn.value = p[1]; $('#qx').hidden = false; vSearch(p[1]); }
    else if (p[0] === 'fav') vFav();
    else vHome();
    const scrollTop = st.rendered !== h; st.rendered = h; st.base = h;
    if (scrollTop) window.scrollTo(0, 0);
    setTab(p[0] === 'fav' ? 'fav' : p[0] === 's' ? 'search' : 'cat');
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
      if (!$('#menu').hidden) { closeMenu(); return; }
      if (dd.open) { ddClose(); return; }
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
    const c = e.target.closest('.card');
    if (e.target.closest('#moreBtn')) { st.limit += 120; const y = scrollY; vSearch(st.q); scrollTo(0, y); return; }
    if (!c) return;
    if (e.target.closest('[data-add]')) {
      if (kpQty(c.dataset.s)) openProduct(c.dataset.s);
      else { setQty(c.dataset.s, 1); toast('Добавлено в КП: ' + c.dataset.s, 'Открыть', () => { location.hash = '#/kp'; }); }
      return;
    }
    if (e.target.closest('[data-open]')) openProduct(c.dataset.s);
  });
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
<div class="sh-buy"><div class="pp"><b>${money(it.price)}</b><span>${it.price != null ? 'РРЦ' : 'цена уточняется'}</span></div>
<button class="fav${FAV.has(s) ? ' on' : ''}" data-fav aria-label="Избранное">${FAV.has(s) ? '♥' : '♡'}</button>
<div class="stp"><button data-dec aria-label="Меньше">−</button><input id="shQ" inputmode="numeric" pattern="[0-9]*" value="${q}" aria-label="Количество"><button data-inc aria-label="Больше">+</button></div>
<button class="btn" data-tokp>${inKp ? 'Обновить' : 'В КП'}</button></div></div>`;
    sheet.hidden = false; sheet.dataset.s = s; document.body.classList.add('noscroll');
    setTimeout(() => { const b = $('[data-tokp]', sheet); if (b && !coarse) b.focus(); }, 30);
  }
  function closeSheetUI() { if (!sheet.hidden) { sheet.hidden = true; sheet.innerHTML = ''; } if (!document.body.classList.contains('kp-open')) document.body.classList.remove('noscroll'); }
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
  function kpTotals() {
    let sum = 0, pcs = 0, unknown = 0;
    KP.items.forEach(([s, q]) => { const it = BYSKU.get(s), u = unitPrice(it); pcs += q; if (u == null) unknown++; else sum += u * q; });
    return { sum, pcs, unknown, n: KP.items.length, vat: Math.round(sum * VAT / (100 + VAT)) };
  }
  function renderKP() {
    const t = kpTotals(), adj = Number(KP.adj) || 0;
    const active = document.activeElement, activeId = active && active.id, activeS = active && active.closest && active.closest('.kr') ? active.closest('.kr').dataset.s : null;
    kpEl.innerHTML = `<div class="kp-h"><h2>Коммерческое предложение</h2>${t.n ? '<button class="lnk" data-clear>Очистить</button>' : ''}<button class="kp-x" data-kpclose aria-label="Закрыть">✕</button></div>
<div class="kp-f"><label class="fld"><small>Клиент</small><input id="kpClient" value="${esc(KP.client)}" placeholder="название или имя" autocomplete="off"></label>
<label class="fld"><small>Корректировка цен</small><input id="kpAdj" type="number" inputmode="decimal" step="1" value="${adj}"><small>%</small></label></div>
<div class="kp-list">${t.n ? KP.items.map(([s, q]) => {
      const it = BYSKU.get(s), u = unitPrice(it);
      return `<div class="kr" data-s="${esc(s)}"><button class="kph" data-open aria-label="Открыть ${esc(s)}">${imgTag(s, '')}</button>
<div class="kb"><button class="sku" data-open>${esc(s)}</button><div class="kd">${esc(it.d)}</div>
<div class="kq"><div class="stp sm"><button data-dec aria-label="Меньше">−</button><input inputmode="numeric" pattern="[0-9]*" value="${q}" aria-label="Количество"><button data-inc aria-label="Больше">+</button></div><span class="u">× ${u == null ? 'по запросу' : money(u)}</span><b>${u == null ? '—' : money(u * q)}</b></div></div>
<button class="kx" data-del aria-label="Удалить">✕</button></div>`;
    }).join('') : '<div class="kp-empty">КП пока пустое.<br>Добавляйте товары кнопкой «+» в каталоге.</div>'}</div>
<div class="kp-s"><div><span>Позиций / штук</span><span>${t.n} / ${t.pcs}</span></div><div><span>в т.ч. НДС ${VAT} %</span><span>${money(t.vat)}</span></div><div class="t"><span>Итого</span><span>${money(t.sum)}</span></div>${t.unknown ? `<span class="note">Без учёта позиций «по запросу»: ${t.unknown}</span>` : ''}${adj ? `<span class="note">Цены ${adj > 0 ? 'выше' : 'ниже'} РРЦ на ${Math.abs(adj)} %</span>` : ''}</div>
<div class="kp-a"><button data-pdf${t.n ? '' : ' disabled'}>PDF</button><button data-xlsx${t.n ? '' : ' disabled'}>Excel</button><button class="p" data-send${t.n ? '' : ' disabled'}>Отправить</button></div>`;
    if (activeId === 'kpClient' || activeId === 'kpAdj') { const el = $('#' + activeId); el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    else if (activeS) { const el = $(`.kr[data-s="${CSS.escape(activeS)}"] input`, kpEl); if (el && active.tagName === 'INPUT') el.focus(); }
    updateBadges(t);
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
  kpEl.addEventListener('click', e => {
    const r = e.target.closest('.kr'), s = r && r.dataset.s;
    if (e.target.closest('[data-kpclose]')) return closeKP();
    if (e.target.closest('[data-clear]')) { if (confirm('Очистить КП?')) { KP.items = []; saveKP(); renderKP(); refreshAdds(); } return; }
    if (e.target.closest('[data-pdf]')) return run(e.target.closest('button'), () => exportPDF(false));
    if (e.target.closest('[data-xlsx]')) return run(e.target.closest('button'), exportXLSX);
    if (e.target.closest('[data-send]')) return run(e.target.closest('button'), () => exportPDF(true));
    if (!s) return;
    if (e.target.closest('[data-del]')) return setQty(s, 0);
    if (e.target.closest('[data-dec]')) return setQty(s, kpQty(s) - 1);
    if (e.target.closest('[data-inc]')) return setQty(s, kpQty(s) + 1);
    if (e.target.closest('[data-open]')) { sheetPushed = true; location.hash = '#/p/' + encodeURIComponent(s); }
  });
  kpEl.addEventListener('input', e => { if (e.target.id === 'kpClient') { KP.client = e.target.value; saveKP(); } });
  kpEl.addEventListener('change', e => {
    if (e.target.id === 'kpAdj') { let v = parseFloat(String(e.target.value).replace(',', '.')) || 0; KP.adj = Math.max(-90, Math.min(300, Math.round(v * 10) / 10)); saveKP(); renderKP(); return; }
    const r = e.target.closest('.kr'); if (r && e.target.tagName === 'INPUT') setQty(r.dataset.s, e.target.value);
  });
  async function run(btn, fn) {
    if (btn.disabled) return; const t = btn.textContent; btn.disabled = true; btn.textContent = '…';
    try { await fn(); } catch (err) { console.error(err); toast(navigator.onLine ? 'Не получилось: ' + (err.message || err) : 'Нужен интернет для первой выгрузки файла'); }
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
    return { date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`, num: `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`,
      file: 'КП_Dahua' + (KP.client ? '_' + KP.client.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 40) : '') + `_${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` };
  }
  const pmoney = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  async function buildPDF() {
    await needPdf();
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'pt', format: 'a4' }), m = kpMeta(), t = kpTotals();
    doc.addFileToVFS('LS-R.ttf', libs.fonts.r); doc.addFont('LS-R.ttf', 'LS', 'normal');
    doc.addFileToVFS('LS-B.ttf', libs.fonts.b); doc.addFont('LS-B.ttf', 'LS', 'bold');
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 36;
    const ink = [22, 50, 63], steel = [122, 140, 150], acc = [27, 168, 216], line = [220, 230, 235];
    const [lIt, lDh] = await Promise.all([imgData('assets/logo-it.png', 240, 'PNG'), imgData('assets/logo-dahua.png', 500, 'PNG')]);
    let y = M;
    let x = M; if (lIt) { const w = 28 * lIt.w / lIt.h; doc.addImage(lIt.d, 'PNG', x, y, w, 28); x += w + 12; }
    if (lDh) doc.addImage(lDh.d, 'PNG', x, y + 4, 21 * lDh.w / lDh.h, 21);
    doc.setTextColor(...ink); doc.setFont('LS', 'bold'); doc.setFontSize(15); doc.text('Коммерческое предложение', W - M, y + 12, { align: 'right' });
    doc.setFont('LS', 'normal'); doc.setFontSize(9); doc.setTextColor(...steel); doc.text(`№ ${m.num} от ${m.date}`, W - M, y + 26, { align: 'right' });
    y += 42; doc.setDrawColor(...acc); doc.setLineWidth(2); doc.line(M, y, W - M, y); y += 20;
    if (KP.client.trim()) { doc.setTextColor(...ink); doc.setFontSize(10.5); doc.text('Клиент: ' + KP.client.trim(), M, y); y += 18; }
    const cN = M, cPh = M + 20, cTx = M + 66, rQty = W - M - 158, rPr = W - M - 78, rSum = W - M, txW = rQty - 34 - cTx;
    const head = () => {
      doc.setFillColor(242, 246, 248); doc.rect(M, y - 11, W - 2 * M, 18, 'F');
      doc.setFont('LS', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...ink);
      doc.text('№', cN + 2, y + 1); doc.text('Фото', cPh, y + 1); doc.text('Артикул и описание', cTx, y + 1);
      doc.text('Кол-во', rQty, y + 1, { align: 'right' }); doc.text('Цена, руб.', rPr, y + 1, { align: 'right' }); doc.text('Сумма, руб.', rSum, y + 1, { align: 'right' });
      y += 18;
    };
    head();
    const thumbs = await Promise.all(KP.items.map(([s]) => imgData(thumb(s), 140, 'JPEG')));
    KP.items.forEach(([s, q], i) => {
      const it = BYSKU.get(s), u = unitPrice(it);
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
      doc.text(q + ' шт', rQty, y + 6, { align: 'right' });
      doc.text(u == null ? 'по запросу' : pmoney(u), rPr, y + 6, { align: 'right' });
      doc.setFont('LS', 'bold'); doc.text(u == null ? '—' : pmoney(u * q), rSum, y + 6, { align: 'right' });
      y += rowH; doc.setDrawColor(...line); doc.setLineWidth(0.6); doc.line(M, y - 8, W - M, y - 8);
    });
    if (y > H - 110) { doc.addPage(); y = M + 10; }
    y += 8;
    doc.setFont('LS', 'normal'); doc.setFontSize(9.5); doc.setTextColor(62, 86, 99);
    doc.text(`Позиций: ${t.n}, штук: ${t.pcs}`, M, y);
    doc.text('в т.ч. НДС ' + VAT + ' %:', rPr, y, { align: 'right' }); doc.text(pmoney(t.vat) + ' руб.', rSum, y, { align: 'right' });
    y += 18; doc.setFont('LS', 'bold'); doc.setFontSize(13); doc.setTextColor(...ink);
    doc.text('Итого:', rPr, y, { align: 'right' }); doc.text(pmoney(t.sum) + ' руб.', rSum, y, { align: 'right' });
    if (t.unknown) { y += 16; doc.setFont('LS', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...steel); doc.text(`Позиции «по запросу» (${t.unknown}) не включены в сумму, цена уточняется.`, M, y); }
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFont('LS', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...steel);
      doc.text('Цены по прайс-листу Dahua' + (PR.date ? ' от ' + PR.date : '') + '. IT-Trade, it-trade.com.ru', M, H - 24);
      doc.text(`стр. ${p} из ${pages}`, W - M, H - 24, { align: 'right' });
    }
    return { blob: doc.output('blob'), name: m.file + '.pdf', meta: m, t };
  }
  function kpText(m, t) {
    const lines = [`Коммерческое предложение Dahua от ${m.date}`]; if (KP.client.trim()) lines.push('Клиент: ' + KP.client.trim()); lines.push('');
    KP.items.forEach(([s, q], i) => { const u = unitPrice(BYSKU.get(s)); lines.push(`${i + 1}. ${s} — ${q} шт × ${u == null ? 'по запросу' : pmoney(u) + ' ₽'}${u == null ? '' : ' = ' + pmoney(u * q) + ' ₽'}`); });
    lines.push('', `Итого: ${pmoney(t.sum)} ₽ (в т.ч. НДС ${VAT} %: ${pmoney(t.vat)} ₽)`);
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
    const m = kpMeta(), t = kpTotals(), X = XLSX.utils;
    const rows = [[`Коммерческое предложение № ${m.num} от ${m.date}`], [KP.client.trim() ? 'Клиент: ' + KP.client.trim() : ''], [], ['№', 'Артикул', 'Описание', 'Характеристики', 'Кол-во, шт', 'Цена, ₽', 'Сумма, ₽']];
    KP.items.forEach(([s, q], i) => { const it = BYSKU.get(s), u = unitPrice(it); rows.push([i + 1, s, it.d, it.sp, q, u == null ? 'по запросу' : u, u == null ? '' : u * q]); });
    const first = 5, last = 4 + KP.items.length;
    rows.push([], ['', '', '', '', '', 'Итого', t.sum], ['', '', '', '', '', `в т.ч. НДС ${VAT} %`, t.vat]);
    const ws = X.aoa_to_sheet(rows);
    for (let r = first; r <= last; r++) {
      const f = ws['F' + r], g = ws['G' + r];
      if (f && f.t === 'n') { f.z = '#,##0'; if (g) { g.f = `E${r}*F${r}`; g.z = '#,##0'; } }
    }
    const tr = last + 2; ws['G' + tr].f = `SUM(G${first}:G${last})`; ws['G' + tr].z = '#,##0'; ws['G' + (tr + 1)].f = `ROUND(G${tr}*${VAT}/${100 + VAT},0)`; ws['G' + (tr + 1)].z = '#,##0';
    ws['!cols'] = [{ wch: 4 }, { wch: 32 }, { wch: 50 }, { wch: 70 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
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
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('#installBtn').hidden = false; });
  addEventListener('appinstalled', () => { deferredInstall = null; $('#installBtn').hidden = true; toast('Приложение установлено'); });
  async function doInstall() {
    if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice.catch(() => {}); deferredInstall = null; $('#installBtn').hidden = true; }
    else if (isIOS) toast('Safari: кнопка «Поделиться» → «На экран Домой»');
    else toast('Меню браузера → «Установить приложение»');
  }
  $('#installBtn').addEventListener('click', doInstall);
  function openMenu() {
    const m = $('#menu'), photos = load('dh-photos', 0);
    m.innerHTML = `${standalone ? '' : `<button data-act="install">Установить приложение<small>${isIOS ? 'Safari: «Поделиться» → «На экран Домой»' : 'Значок на рабочий стол, работает без интернета'}</small></button>`}
<button data-act="photos">Скачать фото для офлайна<small id="phInfo">${photos ? 'Уже скачаны, можно обновить' : 'Около 10 МБ, превью всех товаров'}</small><div class="prog" id="phProg" hidden><i></i></div></button>
<button data-act="all">Весь прайс в Excel<small>${ITEMS.length.toLocaleString('ru-RU')} позиций</small></button>
<button data-act="reload">Обновить данные<small>Подтянуть свежий прайс с сайта</small></button>
<div class="inf">Прайс${PR.date ? ' от ' + esc(PR.date) : ''}, версия ${APP_VER}. Цены РРЦ, НДС ${VAT} % включён.</div>`;
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
  renderKP();
  route();
})();
