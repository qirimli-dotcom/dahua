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
  const fmtPhone = p => { p = String(p || ''); return p.length === 11 ? `+${p[0]} (${p.slice(1, 4)}) ${p.slice(4, 7)}-${p.slice(7, 9)}-${p.slice(9)}` : p; };
  const ST = { pending: 'заявка', active: 'активен', disabled: 'отключён', rejected: 'отклонён' };
  const OS = { new: 'новый', work: 'в работе', done: 'выполнен', cancel: 'отменён' };
  const DESC = {}; if (typeof DATA !== 'undefined') Object.values(DATA).forEach(a => a.forEach(x => { if (x && x.s && !DESC[x.s]) DESC[x.s] = x.d; }));
  const app = $('#app');
  let SES = null; try { SES = JSON.parse(localStorage.getItem('dh-adm2') || 'null'); } catch (e) {}
  const S = { tab: 'req', q: '', inst: [], kps: [], orders: [], defDisc: Number(localStorage.getItem('dh-adm-def') || 55) };

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
      const [i, k, o] = await Promise.all([
        db('installers?select=*&order=created_at.desc&limit=2000'),
        db('kps?select=id,owner,total_rrp,total_client,created_at&limit=5000&created_at=gte.' + U(m.toISOString())),
        db('orders?select=*,installer:installers(name,company,phone,city,discount)&order=created_at.desc&limit=300')
      ]);
      S.inst = i; S.kps = k; S.orders = o;
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
  function draw() {
    const s = stats();
    document.title = (s.pend.length + s.oNew ? '(' + (s.pend.length + s.oNew) + ') ' : '') + 'Админка IT-Trade';
    const tabs = [['req', 'Заявки', s.pend.length, true], ['inst', 'Монтажники', s.act.length], ['orders', 'Заказы', s.oOpen.length, s.oNew > 0]];
    let body = '';
    const qv = S.q.toLowerCase();
    const match = x => !qv || [x.name, x.company, x.phone, x.city].join(' ').toLowerCase().includes(qv);
    if (S.tab === 'req') {
      body = `<div class="ad-sec">Новые заявки</div>` + (s.pend.filter(match).map(x => `<div class="ad-req" data-id="${x.id}"><div class="who"><b>${esc(x.name)}</b><span class="tag">${dt(x.created_at)}</span><div>${esc([x.company, fmtPhone(x.phone), x.city].filter(Boolean).join(' · '))}</div></div>
${discSel(x.id, S.defDisc)}<button class="b ok" data-approve="${x.id}">Одобрить</button><button class="b no" data-reject="${x.id}">Отклонить</button></div>`).join('') || '<div class="empty2">Новых заявок нет</div>');
      const rej = S.inst.filter(x => x.status === 'rejected').filter(match);
      if (rej.length) body += `<div class="ad-sec" style="margin-top:18px">Отклонённые</div>` + rej.map(x => `<div class="ad-req" style="border-left-color:#ccc"><div class="who"><b>${esc(x.name)}</b><div>${esc([x.company, fmtPhone(x.phone), x.city].filter(Boolean).join(' · '))}</div></div><button class="b no" data-restore="${x.id}">Вернуть в заявки</button></div>`).join('');
    } else if (S.tab === 'inst') {
      const kpBy = {}; S.kps.forEach(k => { kpBy[k.owner] = (kpBy[k.owner] || 0) + 1; });
      const oBy = {}; S.orders.forEach(o => { oBy[o.owner] = (oBy[o.owner] || 0) + 1; });
      const list = S.inst.filter(x => x.status === 'active' || x.status === 'disabled').filter(match);
      const opts = v => { const a = [30, 35, 40, 45, 50, 55, 60, 65, 70]; if (!a.includes(v)) a.push(v); return a.sort((p, q) => p - q).map(n => `<option value="${n}"${n === v ? ' selected' : ''}>${n} %</option>`).join(''); };
      body = `<div class="ad-top" style="margin:0 0 10px"><div class="ad-sec" style="flex:1;margin:0">Монтажники: ${list.length}</div><button class="b no sm" data-xls>Выгрузить в Excel</button></div>
<div class="tbl-w"><table class="tbl"><tr><th>Монтажник</th><th>Город</th><th>Скидка</th><th>Статус</th><th class="r">КП за месяц</th><th class="r">Заказы</th><th>Последний вход</th><th></th></tr>
${list.map(x => `<tr data-id="${x.id}"><td><b>${esc(x.name)}</b><small>${esc([x.company, fmtPhone(x.phone)].filter(Boolean).join(' · '))}</small>${x.note ? `<small>📝 ${esc(x.note)}</small>` : ''}</td><td>${esc(x.city || '')}</td>
<td><select data-disc="${x.id}">${opts(Number(x.discount) || 0)}</select></td><td><span class="pill p-${x.status}">${ST[x.status]}</span></td><td class="r">${kpBy[x.id] || 0}</td><td class="r">${oBy[x.id] || 0}</td><td>${dt(x.last_seen)}</td>
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
    const titles = { req: 'Заявки', inst: 'Монтажники', orders: 'Заказы' };
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
    const tab = t.closest('[data-tab]'); if (tab) { S.tab = tab.dataset.tab; draw(); return; }
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
