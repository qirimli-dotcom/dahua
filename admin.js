'use strict';
/* Админка IT-Trade: заявки монтажников, скидки, заказы. Работает через API из config.js */
(function () {
  const SBC = window.DAHUA_SB || {};
  const API = SBC.url && SBC.key ? String(SBC.url).replace(/\/+$/, '') : '';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => n == null || n === '' ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0₽';
  const U = encodeURIComponent;
  const pad = n => String(n).padStart(2, '0');
  const dt = s => { if (!s) return '—'; const d = new Date(String(s).replace(' ', 'T')); if (isNaN(d)) return '—'; const now = new Date(); const day = 864e5; const diff = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / day); return diff === 0 ? 'сегодня ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : diff === 1 ? 'вчера ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2); };
  const dtA = s => { if (!s) return ''; const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? '' : pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); };
  const fmtPhone = p => { p = String(p || ''); return p.length === 11 ? `+${p[0]} (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9)}` : p; };
  const ST = { pending: 'заявка', active: 'активен', disabled: 'отключён', rejected: 'отклонён' };
  const OS = { new: 'новый', work: 'в работе', done: 'выполнен', cancel: 'отменён' };
  const KST = { draft: 'черновик', sent: 'отправлено', agreed: 'согласовано', ordered: 'заказано', done: 'смонтировано', cancel: 'отменено' };
  const DESC = {}; if (typeof DATA !== 'undefined') Object.values(DATA).forEach(a => a.forEach(x => { if (x && x.s && !DESC[x.s]) DESC[x.s] = x.d; }));
  const app = $('#app');
  let SES = null; try { SES = JSON.parse(localStorage.getItem('dh-adm2') || 'null'); } catch (e) {}
  const S = { open: new Set(), card: null, ctab: 'o', cf: '', clients: [], kpsAll: [], tab: 'req', q: '', inst: [], kps: [], orders: [], defDisc: Number(localStorage.getItem('dh-adm-def') || 55) };

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2800); }
  async function req(path, opt) {
    opt = opt || {};
    if (!API) throw new Error('В config.js не указан Supabase');
    const h = { apikey: SBC.key, 'Content-Type': 'application/json' };
    if (opt.token) h.Authorization = 'Bearer ' + opt.token;
    if (opt.prefer) h.Prefer = opt.prefer;
    let r; try { r = await fetch(API + path, { method: opt.method || 'GET', headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined, cache: 'no-store' }); }
    catch (e) { throw new Error('Сервер недоступен'); }
    const tx = await r.text(); let j = null; try { j = tx ? JSON.parse(tx) : null; } catch (e) {}
    if (!r.ok) {
      const m = String((j && (j.msg || j.message || j.error_description)) || '');
      const e = new Error(/invalid login|invalid_credentials/i.test(m + (j && j.error_code)) ? 'Неверный email или пароль' : r.status === 401 || r.status === 403 ? 'Нужно войти заново' : /too short/i.test(m) ? 'Пароль — не короче 8 символов' : 'Ошибка сервера (' + r.status + ')');
      e.status = r.status; throw e;
    }
    return j;
  }
  function setSes(j) { SES = { at: j.access_token, rt: j.refresh_token, exp: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600) }; localStorage.setItem('dh-adm2', JSON.stringify(SES)); }
  async function tok() {
    if (!SES) { const e = new Error('Нужно войти'); e.status = 401; throw e; }
    if (SES.exp - 60 < Date.now() / 1000) { try { setSes(await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: SES.rt } })); } catch (e) { e.status = 401; throw e; } }
    return SES.at;
  }
  async function db(path, opt) { opt = opt || {}; const m = opt.method || 'GET'; return req('/rest/v1/' + path, Object.assign({}, opt, { token: await tok(), prefer: /^rpc\//.test(path) ? undefined : (m === 'POST' || m === 'PATCH') ? 'return=representation' : undefined })); }

  function loginView(msg) {
    app.innerHTML = `<div class="login"><img src="assets/logo-it.png" alt="IT-Trade"><h1>Админка монтажников</h1><p>${msg ? esc(msg) : 'Вход администратора IT-Trade'}</p>
<label class="fl"><span>Email</span><input id="lgE" type="email" autocomplete="username"></label>
<label class="fl"><span>Пароль</span><input id="lgP" type="password" autocomplete="current-password"></label>
<button class="btn wide" id="lgB">Войти</button></div>`;
    const go = async () => {
      const b = $('#lgB'); b.disabled = true;
      try {
        setSes(await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: $('#lgE').value.trim(), password: $('#lgP').value } }));
        if (!(await db('rpc/is_admin', { method: 'POST', body: {} }))) { SES = null; localStorage.removeItem('dh-adm2'); throw new Error('Этот email не записан как администратор (см. инструкцию, таблица admins)'); }
        await loadAll();
      }
      catch (e) { toast(e.message); b.disabled = false; }
    };
    $('#lgB').onclick = go; $('#lgP').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  function logout() { SES = null; localStorage.removeItem('dh-adm2'); loginView(); }

  async function loadAll(quiet) {
    try {
      const m = new Date(); m.setDate(1); m.setHours(0, 0, 0, 0);
      const [i, k, o, c] = await Promise.all([
        db('installers?select=*&order=created_at.desc&limit=2000'),
        db('kps?select=id,owner,client,num,status,total_rrp,total_client,total_buy,created_at,updated_at,data&order=created_at.desc&limit=10000'),
        db('orders?select=*,installer:installers(name,company,phone,city,discount)&order=created_at.desc&limit=2000'),
        db('clients?select=*&order=updated_at.desc&limit=10000')
      ]);
      S.inst = i; S.kpsAll = k; S.kps = k.filter(x => new Date(x.created_at) >= m); S.orders = o; S.clients = c;
      S.iById = {}; i.forEach(x => { S.iById[x.id] = x; });
      S.cById = {}; c.forEach(x => { S.cById[x.id] = x; });
      S.kById = {}; S.kByC = {}; k.forEach(x => { S.kById[x.id] = x; if (x.client) (S.kByC[x.client] = S.kByC[x.client] || []).push(x); });
      S.oByKp = {}; o.forEach(x => { if (x.kp && !S.oByKp[x.kp]) S.oByKp[x.kp] = x; });
      draw();
    } catch (e) {
      if (e.status === 401 || e.status === 403) return loginView('Сессия истекла, войдите снова');
      if (!quiet) toast(e.message);
      if (!app.innerHTML) loginView(e.message);
    }
  }

  function stats() {
    const pend = S.inst.filter(x => x.status === 'pending'), act = S.inst.filter(x => x.status === 'active');
    const m = new Date(); m.setDate(1); m.setHours(0, 0, 0, 0);
    const newM = act.filter(x => new Date(String(x.created_at).replace(' ', 'T')) >= m).length;
    const kpRrp = S.kps.reduce((a, k) => a + (k.total_rrp || 0), 0);
    const oOpen = S.orders.filter(o => o.status === 'new' || o.status === 'work');
    return { pend, act, newM, kpN: S.kps.length, kpRrp, oOpen, oNew: S.orders.filter(o => o.status === 'new').length };
  }
  function discSel(id, val) {
    return `<div class="dsel" data-dsel="${id}">${[45, 50, 55, 60].map(n => `<button type="button" data-dv="${n}"${val === n ? ' class="on"' : ''}>${n}%</button>`).join('')}<input type="number" min="0" max="90" value="${[45, 50, 55, 60].includes(val) ? '' : val}" placeholder="…" aria-label="Своя скидка"></div>`;
  }
  const kst = k => `<span class="pill k-${k}">${KST[k] || k}</span>`;
  const ost = k => `<span class="pill o-${k}">${OS[k] || k}</span>`;
  const itemsOf = arr => (Array.isArray(arr) ? arr : []).map(r => Array.isArray(r) ? { s: r[0], q: r[1] } : r);
  const itemsHtml = arr => { const a = itemsOf(arr); return a.length ? `<div class="its">${a.map(it => `<div><span><b>${esc(it.s)}</b> <i>${esc(it.d || DESC[it.s] || '')}</i></span><em>${it.q} шт</em>${it.buy != null ? `<b>${money(it.buy * it.q)}</b>` : ''}</div>`).join('')}</div>` : '<div class="its mut">позиций нет</div>'; };
  function clientRows(c) {
    const ks = (S.kByC[c.id] || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (!ks.length) return '<div class="its mut">КП и заказов пока нет</div>';
    return ks.map(k => { const o = S.oByKp[k.id]; return `<div class="kpx"><div class="kph2"><b>КП № ${k.num}</b><small>${dt(k.created_at)}</small>${kst(k.status)}${o ? `<span class="mut">IT-Trade:</span>${ost(o.status)}` : ''}<span class="sp"></span><b>${money(k.total_client)}</b></div>${itemsHtml(o ? o.items : (k.data || {}).items)}</div>`; }).join('');
  }
  function clientsTab(qv) {
    let list = S.clients.slice();
    if (S.cf) list = list.filter(c => c.owner === S.cf);
    if (qv) list = list.filter(c => { const w = S.iById[c.owner] || {}; return [c.name, c.phone, c.address, c.note, w.name, w.company].join(' ').toLowerCase().includes(qv); });
    const owners = S.inst.filter(x => S.clients.some(c => c.owner === x.id));
    const agg = c => { const ks = (S.kByC[c.id] || []).filter(k => k.status !== 'cancel'); const last = ks.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0]; return { n: ks.length, sum: ks.reduce((a, k) => a + (k.total_client || 0), 0), last }; };
    return `<div class="ad-top" style="margin:0 0 10px"><select class="sel2" data-cf><option value="">Все монтажники</option>${owners.map(x => `<option value="${x.id}"${S.cf === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select><div class="ad-sec" style="flex:1;margin:0">Клиентов: ${list.length}</div><button class="b no sm" data-cxls>Выгрузить в Excel</button></div>
<div class="tbl-w"><table class="tbl"><tr><th>Клиент</th><th>Адрес объекта</th><th>Монтажник</th><th class="r">КП</th><th class="r">Сумма КП</th><th>Последний статус</th><th>Обновлён</th></tr>
${list.map(c => { const w = S.iById[c.owner] || {}, g = agg(c), op = S.open.has('c' + c.id); return `<tr class="xr${op ? ' op' : ''}" data-x="c${c.id}"><td><span class="ar">${op ? '▾' : '▸'}</span><b>${esc(c.name)}</b><small>${esc(c.phone || '—')}</small></td><td class="mutc">${esc(c.address || '—')}${c.note ? `<small>📝 ${esc(c.note)}</small>` : ''}</td><td><b class="lk2" data-icard="${w.id || ''}">${esc(w.name || '—')}</b><small>${esc(fmtPhone(w.phone))}</small></td><td class="r">${g.n}</td><td class="r"><b>${money(g.sum)}</b></td><td>${g.last ? kst(g.last.status) : '—'}</td><td>${dt(g.last ? g.last.updated_at : c.updated_at)}</td></tr>${op ? `<tr class="xd"><td colspan="7">${clientRows(c)}</td></tr>` : ''}`; }).join('') || '<tr><td colspan="7">Клиентов пока нет — их заводят монтажники в приложении</td></tr>'}</table></div>`;
  }
  function instCard(x) {
    const os = S.orders.filter(o => o.owner === x.id), cls = S.clients.filter(c => c.owner === x.id);
    const buy = os.filter(o => o.status !== 'cancel').reduce((a, o) => a + (o.total_buy || 0), 0);
    const opts = v => { const a = [30, 35, 40, 45, 50, 55, 60, 65, 70]; if (!a.includes(v)) a.push(v); return a.sort((p, q) => p - q).map(n => `<option value="${n}"${n === v ? ' selected' : ''}>${n} %</option>`).join(''); };
    const head = `<div class="ic-h"><span class="lk2" data-cardback>‹ Все монтажники</span><div class="ic-t"><div><h2>${esc(x.name)}</h2><small>${esc([x.company, fmtPhone(x.phone), x.city].filter(Boolean).join(' · '))} · с нами с ${dt(x.created_at)} · вход ${dt(x.last_seen)}</small></div><span class="sp"></span><label class="disc2">закуп <select data-disc="${x.id}">${opts(Number(x.discount) || 0)}</select></label><span class="pill p-${x.status}">${ST[x.status]}</span></div>
<div class="ic-n"><div class="g"><span>Заказал у IT-Trade</span><b>${money(buy)}</b></div><div><span>Заказов</span><b>${os.length}</b></div><div><span>Клиентов</span><b>${cls.length}</b></div></div>
<div class="ic-tabs"><a data-ctab="o"${S.ctab === 'o' ? ' class="on"' : ''}>Заказы у IT-Trade <em>${os.length}</em></a><a data-ctab="c"${S.ctab === 'c' ? ' class="on"' : ''}>Его клиенты <em>${cls.length}</em></a><span class="sp"></span><button class="b no sm" data-icxls="${x.id}">Excel</button></div></div>`;
    let list;
    if (S.ctab === 'o') {
      list = os.map(o => { const k = S.kById[o.kp], c = k && S.cById[k.client], op = S.open.has('o' + o.id); return `<div class="xl${op ? ' op' : ''}"><div class="xh" data-x="o${o.id}"><span class="ar">${op ? '▾' : '▸'}</span><b>${dt(o.created_at)}</b><span class="mut">${c ? 'для ' + esc(c.name) : k ? 'КП № ' + k.num : ''}</span>${ost(o.status)}<span class="sp"></span><b>${money(o.total_buy)}</b></div>${op ? itemsHtml(o.items) + (o.comment ? `<div class="its mut">💬 ${esc(o.comment)}</div>` : '') : ''}</div>`; }).join('') || '<div class="empty2">Заказов у IT-Trade пока нет</div>';
    } else {
      list = cls.map(c => { const op = S.open.has('c' + c.id); const ks = S.kByC[c.id] || []; const got = []; ks.forEach(k => { const o = S.oByKp[k.id]; if (o && o.status !== 'cancel') itemsOf(o.items).forEach(it => { const g = got.find(z => z.s === it.s); if (g) g.q += it.q; else got.push({ s: it.s, q: it.q }); }); }); const pcs = got.reduce((a, z) => a + z.q, 0);
        return `<div class="xl${op ? ' op' : ''}"><div class="xh" data-x="c${c.id}"><span class="ar">${op ? '▾' : '▸'}</span><b>${esc(c.name)}</b><span class="mut">${esc([c.address, c.phone].filter(Boolean).join(' · '))}</span><span class="sp"></span><b>${pcs ? pcs + ' шт поставлено' : '<span class="mut">пока ничего не заказано</span>'}</b></div>${op ? (got.length ? '<div class="its mut" style="margin-bottom:0">Поставлено через IT-Trade:</div>' + itemsHtml(got) : '') + '<div class="its mut" style="margin-bottom:0">КП:</div>' + clientRows(c) : ''}</div>`; }).join('') || '<div class="empty2">Клиентов пока нет</div>';
    }
    return head + `<div class="xlist">${list}</div>`;
  }
  function draw() {
    const s = stats();
    document.title = (s.pend.length + s.oNew ? '(' + (s.pend.length + s.oNew) + ') ' : '') + 'Админка IT-Trade';
    const tabs = [['req', 'Заявки', s.pend.length, true], ['inst', 'Монтажники', s.act.length], ['clients', 'Клиенты', S.clients.length], ['orders', 'Заказы', s.oOpen.length, s.oNew > 0]];
    let body = '';
    const qv = S.q.toLowerCase();
    const match = x => !qv || [x.name, x.company, x.phone, x.city].join(' ').toLowerCase().includes(qv);
    if (S.tab === 'req') {
      body = `<div class="ad-sec">Новые заявки</div>` + (s.pend.filter(match).map(x => `<div class="ad-req" data-id="${x.id}"><div class="who"><b>${esc(x.name)}</b><span class="tag">${dt(x.created_at)}</span><div>${esc([x.company, fmtPhone(x.phone), x.city].filter(Boolean).join(' · '))}</div></div>
${discSel(x.id, S.defDisc)}<button class="b ok" data-approve="${x.id}">Одобрить</button><button class="b no" data-reject="${x.id}">Отклонить</button></div>`).join('') || '<div class="empty2">Новых заявок нет</div>');
      const rej = S.inst.filter(x => x.status === 'rejected').filter(match);
      if (rej.length) body += `<div class="ad-sec" style="margin-top:18px">Отклонённые</div>` + rej.map(x => `<div class="ad-req" style="border-left-color:#ccc"><div class="who"><b>${esc(x.name)}</b><div>${esc([x.company, fmtPhone(x.phone), x.city].filter(Boolean).join(' · '))}</div></div><button class="b no" data-restore="${x.id}">Вернуть в заявки</button></div>`).join('');
    } else if (S.tab === 'inst' && S.card && S.iById[S.card]) {
      body = instCard(S.iById[S.card]);
    } else if (S.tab === 'clients') {
      body = clientsTab(qv);
    } else if (S.tab === 'inst') {
      const buyBy = {}; S.orders.forEach(o => { if (o.status !== 'cancel') buyBy[o.owner] = (buyBy[o.owner] || 0) + (o.total_buy || 0); });
      const clBy = {}; S.clients.forEach(c => { clBy[c.owner] = (clBy[c.owner] || 0) + 1; });
      const kpBy = {}; S.kps.forEach(k => { kpBy[k.owner] = (kpBy[k.owner] || 0) + 1; });
      const oBy = {}; S.orders.forEach(o => { oBy[o.owner] = (oBy[o.owner] || 0) + 1; });
      const list = S.inst.filter(x => x.status === 'active' || x.status === 'disabled').filter(match);
      const opts = v => { const a = [30, 35, 40, 45, 50, 55, 60, 65, 70]; if (!a.includes(v)) a.push(v); return a.sort((p, q) => p - q).map(n => `<option value="${n}"${n === v ? ' selected' : ''}>${n} %</option>`).join(''); };
      body = `<div class="ad-top" style="margin:0 0 10px"><div class="ad-sec" style="flex:1;margin:0">Монтажники: ${list.length}</div><button class="b no sm" data-xls>Выгрузить в Excel</button></div>
<div class="tbl-w"><table class="tbl"><tr><th>Монтажник</th><th>Город</th><th>Скидка</th><th>Статус</th><th class="r">Заказал у нас</th><th class="r">Клиентов</th><th class="r">КП за месяц</th><th>Последний вход</th><th></th></tr>
${list.map(x => `<tr data-id="${x.id}"><td><b class="lk2" data-icard="${x.id}">${esc(x.name)}</b><small>${esc([x.company, fmtPhone(x.phone)].filter(Boolean).join(' · '))}</small>${x.note ? `<small>📝 ${esc(x.note)}</small>` : ''}</td><td>${esc(x.city || '')}</td>
<td><select data-disc="${x.id}">${opts(Number(x.discount) || 0)}</select></td><td><span class="pill p-${x.status}">${ST[x.status]}</span></td><td class="r"><b>${money(buyBy[x.id] || 0)}</b></td><td class="r">${clBy[x.id] || 0}</td><td class="r">${kpBy[x.id] || 0}</td><td>${dt(x.last_seen)}</td>
<td><span class="lk" data-toggle="${x.id}">${x.status === 'active' ? 'Отключить' : 'Включить'}</span><span class="lk" data-pass="${x.id}">Пароль</span><span class="lk" data-note="${x.id}">Заметка</span></td></tr>`).join('') || '<tr><td colspan="8">Пока нет одобренных монтажников</td></tr>'}</table></div>`;
    } else {
      const list = S.orders.filter(o => !qv || JSON.stringify([o.installer, o.comment, o.items]).toLowerCase().includes(qv));
      body = list.map(o => { const w = o.installer || {}; const items = Array.isArray(o.items) ? o.items : []; return `<div class="ord" data-id="${o.id}"><div class="ord-h"><b>Заказ от ${dt(o.created_at)}</b><span class="pill o-${o.status}">${OS[o.status] || o.status}</span><span class="sp"></span>
<select data-ost="${o.id}">${Object.keys(OS).map(k => `<option value="${k}"${o.status === k ? ' selected' : ''}>${OS[k]}</option>`).join('')}</select><button class="b no sm" data-oxls="${o.id}">Excel</button></div>
<div class="ord-c"><b>${esc(w.name || '—')}</b>${w.company ? ', ' + esc(w.company) : ''} · ${esc(fmtPhone(w.phone))}${w.city ? ' · ' + esc(w.city) : ''} · скидка ${w.discount || 0} %</div>
${o.comment ? `<div class="ord-c">💬 ${esc(o.comment)}</div>` : ''}
<table><tr><th>Артикул</th><th>Описание</th><th class="r">Кол-во</th><th class="r">РРЦ</th><th class="r">Закуп</th><th class="r">Сумма</th></tr>
${items.map(it => `<tr><td><b>${esc(it.s)}</b></td><td>${esc(it.d || DESC[it.s] || '')}</td><td class="r">${it.q}</td><td class="r">${money(it.rrp)}</td><td class="r">${money(it.buy)}</td><td class="r"><b>${it.buy == null ? '—' : money(it.buy * it.q)}</b></td></tr>`).join('')}
<tr><td colspan="5" class="r"><b>Итого по закупу</b></td><td class="r"><b>${money(o.total_buy)}</b></td></tr></table>
<textarea data-onote="${o.id}" rows="2" placeholder="Заметка менеджера (видна только в админке)">${esc(o.admin_note || '')}</textarea></div>`; }).join('') || '<div class="empty2">Заказов пока нет</div>';
    }
    const titles = { req: 'Заявки', inst: S.card ? 'Монтажник' : 'Монтажники', clients: 'Клиенты монтажников', orders: 'Заказы' };
    const focused = document.activeElement && document.activeElement.id === 'adQ';
    app.innerHTML = `<div class="ad"><nav class="ad-nav"><div class="ad-lg"><img src="assets/logo-it.png" alt=""><b>Админка</b></div>
${tabs.map(([k, l, n, hot]) => `<a data-tab="${k}"${S.tab === k ? ' class="on"' : ''}>${l}<em${hot && n ? ' class="hot"' : ''}>${n}</em></a>`).join('')}<span class="ad-out" data-out>Выйти</span></nav>
<main class="ad-main"><div class="ad-top"><h1>${titles[S.tab]}</h1><input id="adQ" placeholder="Поиск: имя, телефон, компания" value="${esc(S.q)}"><button class="b no" data-reload>Обновить</button></div>
<div class="ad-stats"><div class="ad-st"><span>Новые заявки</span><b>${s.pend.length}</b></div><div class="ad-st"><span>Активных монтажников</span><b>${s.act.length}</b>${s.newM ? `<small>+${s.newM} за месяц</small>` : ''}</div>
<div class="ad-st"><span>КП за месяц</span><b>${s.kpN}</b><small>${money(s.kpRrp)} по РРЦ</small></div><div class="ad-st"><span>Заказы в работе</span><b>${s.oOpen.length}</b>${s.oNew ? `<small style="color:#C0392B">новых: ${s.oNew}</small>` : ''}</div></div>
${body}</main></div>`;
    if (focused) { const i = $('#adQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }

  async function patch(coll, id, body, okMsg) {
    try { await db(`${coll}?id=eq.${U(id)}`, { method: 'PATCH', body }); if (okMsg) toast(okMsg); await loadAll(true); }
    catch (e) { toast(e.message); }
  }
  const byId = id => S.inst.find(x => x.id === id) || {};
  document.addEventListener('click', async e => {
    const t = e.target;
    const tab = t.closest('[data-tab]'); if (tab) { S.tab = tab.dataset.tab; S.card = null; draw(); return; }
    const ic = t.closest('[data-icard]'); if (ic && ic.dataset.icard) { S.tab = 'inst'; S.card = ic.dataset.icard; S.ctab = 'o'; draw(); scrollTo(0, 0); return; }
    if (t.closest('[data-cardback]')) { S.card = null; draw(); return; }
    const ct = t.closest('[data-ctab]'); if (ct) { S.ctab = ct.dataset.ctab; draw(); return; }
    const xr = t.closest('[data-x]'); if (xr && !t.closest('select,button,[data-icard]')) { const k = xr.dataset.x; S.open.has(k) ? S.open.delete(k) : S.open.add(k); draw(); return; }
    if (t.closest('[data-cxls]')) return exportClients();
    const icx = t.closest('[data-icxls]'); if (icx) return exportInstCard(S.iById[icx.dataset.icxls]);
    if (t.closest('[data-out]')) return logout();
    if (t.closest('[data-reload]')) { await loadAll(); toast('Обновлено'); return; }
    const dv = t.closest('[data-dv]'); if (dv) { const w = dv.closest('[data-dsel]'); $$('[data-dv]', w).forEach(b => b.classList.toggle('on', b === dv)); $('input', w).value = ''; return; }
    const ap = t.closest('[data-approve]'); if (ap) {
      const w = $(`[data-dsel="${ap.dataset.approve}"]`), inp = $('input', w), on = $('[data-dv].on', w);
      const d = inp.value !== '' ? Number(inp.value) : on ? Number(on.dataset.dv) : NaN;
      if (!(d >= 0 && d <= 90)) return toast('Выберите скидку');
      S.defDisc = d; localStorage.setItem('dh-adm-def', d);
      ap.disabled = true; await patch('installers', ap.dataset.approve, { status: 'active', discount: d }, byId(ap.dataset.approve).name + ': одобрен, скидка ' + d + ' %'); return;
    }
    const rj = t.closest('[data-reject]'); if (rj) { if (confirm('Отклонить заявку ' + byId(rj.dataset.reject).name + '?')) await patch('installers', rj.dataset.reject, { status: 'rejected' }, 'Заявка отклонена'); return; }
    const rs = t.closest('[data-restore]'); if (rs) { await patch('installers', rs.dataset.restore, { status: 'pending' }, 'Возвращено в заявки'); return; }
    const tg = t.closest('[data-toggle]'); if (tg) {
      const x = byId(tg.dataset.toggle), nx = x.status === 'active' ? 'disabled' : 'active';
      if (nx === 'disabled' && !confirm('Отключить ' + x.name + '? Он сразу потеряет доступ к закупу и клиентам.')) return;
      await patch('installers', x.id, { status: nx }, nx === 'active' ? 'Включён' : 'Отключён'); return;
    }
    const ps = t.closest('[data-pass]'); if (ps) {
      const x = byId(ps.dataset.pass), p = prompt('Новый пароль для ' + x.name + ' (не короче 8 символов):');
      if (p == null) return; if (p.length < 8) return toast('Пароль — не короче 8 символов');
      try { await db('rpc/admin_set_password', { method: 'POST', body: { uid: x.id, pass: p } }); toast('Пароль изменён. Сообщите его монтажнику.'); } catch (err) { toast(err.message); } return;
    }
    const nt = t.closest('[data-note]'); if (nt) { const x = byId(nt.dataset.note), n = prompt('Заметка о монтажнике (видна только вам):', x.note || ''); if (n != null) await patch('installers', x.id, { note: n.trim() }, 'Заметка сохранена'); return; }
    if (t.closest('[data-xls]')) return exportInst();
    const ox = t.closest('[data-oxls]'); if (ox) return exportOrder(S.orders.find(o => o.id === ox.dataset.oxls));
  });
  document.addEventListener('change', async e => {
    if (e.target.closest('[data-cf]')) { S.cf = e.target.value; draw(); return; }
    const d = e.target.closest('[data-disc]'); if (d) { const x = byId(d.dataset.disc); await patch('installers', x.id, { discount: Number(d.value) }, x.name + ': скидка ' + d.value + ' %'); return; }
    const os = e.target.closest('[data-ost]'); if (os) { await patch('orders', os.dataset.ost, { status: os.value }, 'Статус заказа: ' + OS[os.value]); return; }
    const on = e.target.closest('[data-onote]'); if (on) { await patch('orders', on.dataset.onote, { admin_note: on.value.trim() }, 'Заметка сохранена'); }
  });
  document.addEventListener('input', e => { if (e.target.id === 'adQ') { S.q = e.target.value; clearTimeout(S.qt); S.qt = setTimeout(draw, 200); } });

  function loadXlsx() { return window.XLSX ? Promise.resolve() : new Promise((ok, err) => { const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js'; s.onload = ok; s.onerror = () => err(new Error('Не загрузился Excel-модуль')); document.head.appendChild(s); }); }
  function saveBlob(wb, name) { const b = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/octet-stream' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  async function exportInst() {
    try {
      await loadXlsx();
      const rows = [['ФИО', 'Компания', 'Телефон', 'Город', 'Скидка, %', 'Статус', 'Зарегистрирован', 'Последний вход', 'Заметка']];
      S.inst.forEach(x => rows.push([x.name, x.company, fmtPhone(x.phone), x.city, x.discount, ST[x.status], dt(x.created_at), dt(x.last_seen), x.note]));
      const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 30 }, { wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 9 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Монтажники'); saveBlob(wb, 'Монтажники_Dahua.xlsx');
    } catch (e) { toast(e.message); }
  }
  async function exportClients() {
    try {
      await loadXlsx();
      const rows = [['Клиент', 'Телефон', 'Адрес объекта', 'Заметка', 'Монтажник', 'Телефон монтажника', 'КП', 'Сумма КП, ₽', 'Последний статус', 'Обновлён', 'Поставлено (артикул × шт)']];
      S.clients.forEach(c => { const w = S.iById[c.owner] || {}, ks = (S.kByC[c.id] || []).filter(k => k.status !== 'cancel'); const last = ks.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
        const got = []; ks.forEach(k => { const o = S.oByKp[k.id]; if (o && o.status !== 'cancel') itemsOf(o.items).forEach(it => got.push(it.s + ' × ' + it.q)); });
        rows.push([c.name, c.phone, c.address, c.note, w.name, fmtPhone(w.phone), ks.length, ks.reduce((a, k) => a + (k.total_client || 0), 0), last ? KST[last.status] : '', dtA(last ? last.updated_at : c.updated_at), got.join('; ')]); });
      const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 36 }, { wch: 30 }, { wch: 28 }, { wch: 18 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 60 }];
      ws['!autofilter'] = { ref: 'A1:K' + rows.length };
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Клиенты'); saveBlob(wb, 'Клиенты_монтажников_Dahua.xlsx');
    } catch (e) { toast(e.message); }
  }
  async function exportInstCard(x) {
    try {
      await loadXlsx();
      const r1 = [['Дата', 'Клиент', 'Статус', 'Артикул', 'Описание', 'Кол-во', 'Закуп, ₽', 'Сумма, ₽', 'Комментарий']];
      S.orders.filter(o => o.owner === x.id).forEach(o => { const k = S.kById[o.kp], c = k && S.cById[k.client]; itemsOf(o.items).forEach(it => r1.push([dtA(o.created_at), c ? c.name : '', OS[o.status], it.s, it.d || DESC[it.s] || '', it.q, it.buy, it.buy == null ? '' : it.buy * it.q, o.comment || ''])); });
      const r2 = [['Клиент', 'Телефон', 'Адрес', 'Заметка', 'КП', 'Сумма КП, ₽']];
      S.clients.filter(c => c.owner === x.id).forEach(c => { const ks = (S.kByC[c.id] || []).filter(k => k.status !== 'cancel'); r2.push([c.name, c.phone, c.address, c.note, ks.length, ks.reduce((a, k) => a + (k.total_client || 0), 0)]); });
      const wb = XLSX.utils.book_new();
      const w1 = XLSX.utils.aoa_to_sheet(r1); w1['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 11 }, { wch: 30 }, { wch: 45 }, { wch: 7 }, { wch: 11 }, { wch: 12 }, { wch: 30 }]; XLSX.utils.book_append_sheet(wb, w1, 'Заказы у IT-Trade');
      const w2 = XLSX.utils.aoa_to_sheet(r2); w2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 36 }, { wch: 30 }, { wch: 6 }, { wch: 14 }]; XLSX.utils.book_append_sheet(wb, w2, 'Клиенты');
      saveBlob(wb, 'Монтажник_' + (x.name || '').replace(/[\\/:*?"<>|\s]+/g, '_') + '.xlsx');
    } catch (e) { toast(e.message); }
  }
  async function exportOrder(o) {
    try {
      await loadXlsx();
      const w = o.installer || {};
      const rows = [['Заказ монтажника от ' + dt(o.created_at)], [[w.name, w.company, fmtPhone(w.phone), w.city].filter(Boolean).join(', ')], [o.comment || ''], [], ['Артикул', 'Описание', 'Кол-во', 'РРЦ, ₽', 'Закуп, ₽', 'Сумма, ₽']];
      (o.items || []).forEach(it => rows.push([it.s, it.d || DESC[it.s] || '', it.q, it.rrp, it.buy, it.buy == null ? '' : it.buy * it.q]));
      rows.push([], ['', '', '', '', 'Итого', o.total_buy]);
      const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 32 }, { wch: 50 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Заказ'); saveBlob(wb, 'Заказ_' + (w.name || 'монтажник').replace(/[\\/:*?"<>|\s]+/g, '_') + '.xlsx');
    } catch (e) { toast(e.message); }
  }

  if (!API) { app.innerHTML = '<div class="login"><h1>Supabase не подключён</h1><p>Впишите адрес проекта и ключ в config.js</p></div>'; return; }
  if (!SES) loginView(); else loadAll();
  setInterval(() => { if (SES && document.visibilityState === 'visible' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName)) loadAll(true); }, 60000);
})();
