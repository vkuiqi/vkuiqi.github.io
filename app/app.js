'use strict';

const CAT = { protein: '蛋白', veg: '蔬菜', staple: '主食', other: '其他' };
const CAT_ORDER = ['protein', 'veg', 'staple', 'other'];
const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const STORE = 'meal.v4';

let DATA = { dishes: [] };
let MENU = { days: [], rice: 70, fruit: 1, halfRiceDays: [] };
let state = { overrides: {}, checked: {}, offset: 0 };

try { Object.assign(state, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
const save = () => localStorage.setItem(STORE, JSON.stringify(state));

const dish = id => DATA.dishes.find(d => d.id === id);
const todayIdx = () => (new Date().getDay() + 6) % 7;
const md = s => String(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const RICE_KCAL = 3.46, RICE_PROT = 0.077;
const $ = id => document.getElementById(id);

function dateOf(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}
const idxOf = offset => ((todayIdx() + offset) % 7 + 7) % 7;

function planOf(i) {
  const base = MENU.days[i];
  const ov = state.overrides || {};
  return { meat: ov[i + '.meat'] || base.meat, veg: ov[i + '.veg'] || base.veg };
}
const riceOf = i => (MENU.halfRiceDays || []).includes(i) ? Math.round(MENU.rice / 2) : MENU.rice;

function mealKcal(i) {
  const p = planOf(i), m = dish(p.meat), v = dish(p.veg);
  return (m ? m.kcal : 0) + (v ? v.kcal : 0) + Math.round(riceOf(i) * RICE_KCAL);
}
function mealProt(i) {
  const p = planOf(i), m = dish(p.meat), v = dish(p.veg);
  return Math.round((m ? m.protein : 0) + (v ? v.protein : 0) + riceOf(i) * RICE_PROT);
}

/* 主料：蛋白类里第一个食材，用来代替“荤/素”这种说法 */
function mainOf(d) {
  const p = d.ingredients.find(x => x.cat === 'protein');
  return p ? p.item : '';
}

/* ---------- 今天 ---------- */
function dishBlock(d, i, slot) {
  if (!d) return '';
  const ings = d.ingredients
    .filter(x => x.cat !== 'pantry')
    .map(x => `<b>${x.item}</b> ${x.qty}${x.unit}`)
    .join(' · ');
  const steps = d.steps.map(s => `<li>${md(s)}</li>`).join('');
  const main = mainOf(d);
  return `
  <article class="dish" data-kind="${d.kind}">
    <div class="dish-top">
      <div>
        <h2>${d.name}</h2>
        <div class="dish-meta">${main}${main ? ' · ' : ''}${d.kcal} 大卡 · ${d.protein} g 蛋白</div>
      </div>
      <button class="swap" data-swap="${slot}" data-idx="${i}">换</button>
    </div>
    <p class="ings">${ings}</p>
    <ol class="steps">${steps}</ol>
    ${d.tips ? `<p class="tips">${d.tips}</p>` : ''}
  </article>`;
}

function renderToday() {
  const off = state.offset || 0;
  const i = idxOf(off);
  const d = dateOf(off);
  const p = planOf(i);
  const m = dish(p.meat), v = dish(p.veg);
  const rice = riceOf(i);
  const half = (MENU.halfRiceDays || []).includes(i);
  const keep = off === 0 ? '明天中午' : '第二天中午';

  $('today-title').textContent = off === 0 ? '今天' : WEEK[i];
  $('today-sub').innerHTML =
    `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEK[i]} · 做两份，一份留着${keep}` +
    (off !== 0 ? '　<button class="backtoday" data-back="1">回到今天</button>' : '');

  $('today-body').innerHTML = `
    <div class="sum">
      <b>${mealKcal(i)}<small>kcal</small></b>
      <span>蛋白 ${mealProt(i)} g · 两顿的量</span>
    </div>
    ${dishBlock(m, i, 'meat')}
    ${dishBlock(v, i, 'veg')}
    <div class="side">
      <div><div class="k">主食</div><div class="v">生米 ${rice} g<small>${half ? '今天有土豆，饭减半' : '约一碗'}</small></div></div>
      <div><div class="k">水果</div><div class="v">1 个<small>晚上吃</small></div></div>
    </div>`;

  $('today-foot').innerHTML =
    '一锅炒：先下肉滑到变色盛出，再炒菜，最后倒回肉翻匀。<br>' +
    '做两份食材都 ×2，油喷 30–35 下。装盒的摊开晾凉再盖。';
}

/* ---------- 这周 ---------- */
function renderWeek() {
  const ti = todayIdx();
  $('week-list').innerHTML = MENU.days.map((d, i) => {
    const p = planOf(i);
    const m = dish(p.meat), v = dish(p.veg);
    return `
      <div class="wrow ${i === ti ? 'today' : ''}" data-day="${i}">
        <span class="wd">${WEEK[i].slice(1)}</span>
        <span class="wc"><b>${m ? m.name : '—'}</b><i>＋</i>${v ? v.name : '—'}</span>
        <span class="wk">${mealKcal(i)}<small>kcal</small></span>
      </div>`;
  }).join('');
}

/* ---------- 买菜 ---------- */
function buildList() {
  const map = new Map();
  const n = MENU.days.length;

  map.set('鸡蛋|个', { item: '鸡蛋', unit: '个', qty: n * 3, cat: 'protein' });
  map.set('牛奶|盒', { item: '牛奶', unit: '盒', qty: n, cat: 'protein' });
  map.set('水果|个', { item: '水果', unit: '个', qty: n, cat: 'other' });

  MENU.days.forEach((_, i) => {
    const p = planOf(i);
    [p.meat, p.veg].forEach(id => {
      const d = dish(id);
      if (!d) return;
      d.ingredients.forEach(x => {
        if (x.cat === 'pantry') return;
        const key = x.item + '|' + x.unit;
        if (!map.has(key)) map.set(key, { item: x.item, unit: x.unit, qty: 0, cat: x.cat });
        map.get(key).qty += x.qty * 2;
      });
    });
  });

  let rice = 0;
  MENU.days.forEach((_, i) => { rice += riceOf(i) * 2; });
  map.set('大米|g', { item: '大米', unit: 'g', qty: Math.round(rice / 100) * 100, cat: 'staple' });

  return Array.from(map.values());
}

function fmtQty(q, u) {
  if (u === 'g' && q >= 1000) return (q / 1000).toFixed(1).replace('.0', '') + ' kg';
  return Math.round(q) + ' ' + u;
}

function renderShop() {
  const items = buildList();
  $('shop-list').innerHTML = CAT_ORDER.map(c => {
    const list = items.filter(x => x.cat === c);
    if (!list.length) return '';
    return `<div class="sgroup">${CAT[c]}</div>` + list.map(x => `
      <div class="sitem ${state.checked[x.item] ? 'done' : ''}" data-item="${x.item}">
        <span class="box">${state.checked[x.item] ? '✓' : ''}</span>
        <span class="nm">${x.item}</span>
        <span class="qt">${fmtQty(x.qty, x.unit)}</span>
      </div>`).join('');
  }).join('');
  updateShopTop();
}

function updateShopTop() {
  const items = buildList();
  const done = items.filter(x => state.checked[x.item]).length;
  const label = (items.length && done === items.length) ? '都买齐了' : `共 ${items.length} 样`;
  $('shop-top').innerHTML = `<span>${label}</span><b>${done} / ${items.length}</b>`;
}

/* ---------- 换菜 ---------- */
function showSheet(title, html) {
  $('sheet-title').textContent = title;
  $('sheet-body').innerHTML = html;
  const s = $('sheet');
  s.hidden = false;
  requestAnimationFrame(() => s.classList.add('in'));
}

function openDaySheet() {
  const cur = state.offset || 0;
  let html = '';
  for (let off = -3; off <= 3; off++) {
    const d = dateOf(off), i = idxOf(off);
    const mark = off === 0 ? '今天' : off === 1 ? '明天' : off === -1 ? '昨天' : '';
    html += `
      <button class="opt ${off === cur ? 'cur' : ''}" data-day-off="${off}">
        ${off === cur ? '<span class="tick">✓</span>' : ''}
        <span class="on-nm">${WEEK[i]}</span>
        <span class="on-mt">${d.getMonth() + 1}/${d.getDate()}${mark ? ' · ' + mark : ''}</span>
      </button>`;
  }
  showSheet('跳到哪天', html);
}

function openSheet(slot, i) {
  const kind = slot === 'meat' ? 'meat' : 'veg';
  const pool = DATA.dishes.filter(d => d.kind === kind);
  const cur = planOf(i)[kind];

  showSheet(
    slot === 'meat' ? '换成哪道主菜' : '换成哪道蔬菜',
    pool.map(d => `
      <button class="opt ${d.id === cur ? 'cur' : ''}" data-pick="${d.id}" data-slot="${slot}" data-idx="${i}">
        ${d.id === cur ? '<span class="tick">✓</span>' : ''}
        <span class="on-nm">${d.name}</span>
        <span class="on-mt">${d.kcal} 大卡 · ${d.protein}g 蛋白</span>
      </button>`).join('')
  );
}

function closeSheet() {
  const s = $('sheet');
  s.classList.remove('in');
  setTimeout(() => { s.hidden = true; }, 240);
}

/* ---------- 锚点高亮 ---------- */
function initJump() {
  const links = Array.from(document.querySelectorAll('.jump a'));
  const secs = links.map(a => document.querySelector(a.getAttribute('href')));
  const setOn = i => links.forEach((a, k) => a.classList.toggle('on', k === i));

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) setOn(secs.indexOf(e.target));
    });
  }, { rootMargin: '-72px 0px -55% 0px', threshold: 0 });
  secs.forEach(s => s && io.observe(s));

  links.forEach((a, k) => a.addEventListener('click', ev => {
    ev.preventDefault();
    const t = secs[k];
    if (!t) return;
    setOn(k);
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

/* ---------- 事件 ---------- */
document.addEventListener('click', e => {
  if (e.target.closest('#today-title')) { openDaySheet(); return; }

  const dayOpt = e.target.closest('[data-day-off]');
  if (dayOpt) {
    state.offset = Number(dayOpt.dataset.dayOff);
    save(); closeSheet(); renderToday();
    document.getElementById('s-today').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (e.target.closest('[data-back]')) {
    state.offset = 0;
    save(); renderToday();
    return;
  }

  if (e.target.closest('.brand')) {
    state.offset = 0;
    save(); renderToday();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const dn = e.target.closest('[data-step]');
  if (dn) {
    state.offset = Math.max(-3, Math.min(3, (state.offset || 0) + Number(dn.dataset.step)));
    save(); renderToday();
    return;
  }

  const sw = e.target.closest('[data-swap]');
  if (sw) { openSheet(sw.dataset.swap, Number(sw.dataset.idx)); return; }

  const pick = e.target.closest('[data-pick]');
  if (pick) {
    state.overrides[pick.dataset.idx + '.' + pick.dataset.slot] = pick.dataset.pick;
    save(); closeSheet(); renderToday(); renderWeek(); renderShop();
    return;
  }

  if (e.target.closest('[data-close]')) { closeSheet(); return; }

  const row = e.target.closest('.wrow');
  if (row) {
    const i = Number(row.dataset.day);
    let off = ((i - todayIdx()) % 7 + 7) % 7;
    if (off > 3) off -= 7;
    state.offset = off;
    save(); renderToday();
    document.getElementById('s-today').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const si = e.target.closest('.sitem');
  if (si) {
    const k = si.dataset.item;
    const on = !state.checked[k];
    if (on) state.checked[k] = 1; else delete state.checked[k];
    save();
    si.classList.toggle('done', on);
    si.querySelector('.box').textContent = on ? '✓' : '';
    updateShopTop();
    return;
  }

  if (e.target.closest('#reset-check')) {
    state.checked = {};
    save(); renderShop();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
});

/* ---------- 启动 ---------- */
(async function boot() {
  const bust = '?v=' + Math.floor(Date.now() / 60000);
  try {
    const [d1, d2] = await Promise.all([
      fetch('data/dishes.json' + bust).then(r => r.json()),
      fetch('data/menu.json' + bust).then(r => r.json())
    ]);
    DATA = d1; MENU = d2;
  } catch (err) {
    $('today-body').innerHTML = '<p class="note">数据没加载出来。用本地服务器或线上地址打开，别直接双击 html 文件。</p>';
    return;
  }
  renderToday();
  renderWeek();
  renderShop();
  initJump();

  if (location.hash) {
    const el = document.querySelector(location.hash);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 240);
  }
})();
