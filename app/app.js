'use strict';

const CAT = { protein: '蛋白', veg: '蔬菜', staple: '主食', other: '其他' };
const CAT_ORDER = ['protein', 'veg', 'staple', 'other'];
const KIND_CN = { meat: '荤', veg: '素', staple: '主食' };
const STORE = 'meal.v2';

let DATA = { dishes: [] };
let MENU = { days: [], rice: 70, fruit: 1, halfRiceDays: [] };
let state = { overrides: {}, checked: {} };

try { Object.assign(state, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) {}
const save = () => localStorage.setItem(STORE, JSON.stringify(state));

const dish = id => DATA.dishes.find(d => d.id === id);
const dayIdx = () => (new Date().getDay() + 6) % 7;      // 0 = 周一
const md = s => String(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const kcalOf = d => (d ? d.kcal : 0);
const protOf = d => (d ? d.protein : 0);
const RICE_KCAL = 3.46;                                   // 生米每克
const RICE_PROT = 0.077;
const FRUIT_KCAL = 90;

function fmtDate() {
  const d = new Date();
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${['周一','周二','周三','周四','周五','周六','周日'][dayIdx()]}`;
}

function planOf(i) {
  const base = MENU.days[i];
  const ov = state.overrides || {};
  return {
    meat: ov[i + '.meat'] || base.meat,
    veg: ov[i + '.veg'] || base.veg
  };
}

function riceOf(i) {
  const half = (MENU.halfRiceDays || []).includes(i);
  return half ? Math.round(MENU.rice / 2) : MENU.rice;
}

/* ---------- 菜卡 ---------- */
function cardFor(d, idx, slot) {
  if (!d) return '';
  const ings = d.ingredients
    .filter(x => x.cat !== 'pantry')
    .map(x => `<b>${x.item}</b> ${x.qty}${x.unit}`)
    .join(' · ');
  const steps = d.steps.map(s => `<li>${md(s)}</li>`).join('');
  return `
  <article class="dish" data-kind="${d.kind}">
    <div class="dh">
      <div>
        <div class="dn">${d.name}</div>
        <div class="dm">${KIND_CN[d.kind] || ''} · <b>${d.kcal} 大卡</b> · 蛋白 ${d.protein} g</div>
      </div>
      <button class="swap" data-swap="${slot}" data-idx="${idx}">换</button>
    </div>
    <div class="ing-line">${ings}</div>
    <ol class="steps">${steps}</ol>
    ${d.tips ? `<div class="tips">${d.tips}</div>` : ''}
  </article>`;
}

/* ---------- 今晚 ---------- */
function renderNow() {
  const i = dayIdx();
  const p = planOf(i);
  const meat = dish(p.meat), veg = dish(p.veg);
  const rice = riceOf(i);
  const kcal = kcalOf(meat) + kcalOf(veg) + Math.round(rice * RICE_KCAL) + FRUIT_KCAL;
  const prot = Math.round(protOf(meat) + protOf(veg) + rice * RICE_PROT + 2);
  const half = (MENU.halfRiceDays || []).includes(i);

  document.getElementById('view-now').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="k">这一顿</div><div class="v">${kcal}<small>kcal</small></div></div>
      <div class="stat"><div class="k">蛋白</div><div class="v">${prot}<small>g</small></div></div>
      <div class="stat"><div class="k">份量</div><div class="v">2<small>份</small></div></div>
    </div>
    <div class="note">做两份，食材都 ×2。一锅炒：先下肉滑到变色盛出，再炒菜，最后倒回肉翻匀。</div>
    <div class="grid2">
      ${cardFor(meat, i, 'meat')}
      ${cardFor(veg, i, 'veg')}
    </div>
    <div class="mini-row" style="margin-top:10px">
      <div class="mini">
        <div class="k">主食</div>
        <div class="v">生米 ${rice} g<small>${half ? '今天有土豆，饭减半' : '约一碗'}</small></div>
      </div>
      <div class="mini">
        <div class="k">水果</div>
        <div class="v">1 个<small>晚上吃</small></div>
      </div>
    </div>
    <p class="hint">一份盛出来装盒，摊开晾凉再盖，明天中午微波中火 1 分半。</p>`;
}

/* ---------- 这周买 ---------- */
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

  let riceTotal = 0;
  MENU.days.forEach((_, i) => { riceTotal += riceOf(i) * 2; });
  map.set('大米|g', { item: '大米', unit: 'g', qty: Math.round(riceTotal / 100) * 100, cat: 'staple' });

  return Array.from(map.values());
}

function fmtQty(q, u) {
  if (u === 'g' && q >= 1000) return (q / 1000).toFixed(1).replace('.0', '') + ' kg';
  return Math.round(q) + ' ' + u;
}

function renderShop() {
  const items = buildList();
  const done = items.filter(x => state.checked[x.item]).length;
  const pct = items.length ? (done / items.length) * 100 : 0;

  const groups = CAT_ORDER.map(c => {
    const list = items.filter(x => x.cat === c);
    if (!list.length) return '';
    return `
      <div class="group">
        <h3>${CAT[c]}<em>${list.length}</em></h3>
        ${list.map(x => `
          <div class="item ${state.checked[x.item] ? 'done' : ''}" data-item="${x.item}">
            <span class="box">${state.checked[x.item] ? '✓' : ''}</span>
            <span class="nm">${x.item}</span>
            <span class="qt">${fmtQty(x.qty, x.unit)}</span>
          </div>`).join('')}
      </div>`;
  }).join('');

  document.getElementById('view-shop').innerHTML = `
    <div class="shop-top">
      <div class="row">
        <span class="t" id="shop-title">${done === items.length && items.length ? '都买齐了' : '一周采购'}</span>
        <span class="n" id="shop-count">${done} / ${items.length}</span>
      </div>
      <div class="prog"><i id="shop-bar" style="width:${pct}%"></i></div>
    </div>
    <div class="shop-groups">${groups}</div>
    <button class="reset" id="reset-check">清空勾选</button>
    <p class="hint">含早餐的鸡蛋牛奶，午晚两顿按做两份算。<br>调料不用买，盐、生抽、醋、料酒家里有。</p>`;
}

function updateShopProgress() {
  const items = buildList();
  const done = items.filter(x => state.checked[x.item]).length;
  const pct = items.length ? (done / items.length) * 100 : 0;
  const t = document.getElementById('shop-title');
  const c = document.getElementById('shop-count');
  const b = document.getElementById('shop-bar');
  if (c) c.textContent = `${done} / ${items.length}`;
  if (b) b.style.width = pct + '%';
  if (t) t.textContent = (items.length && done === items.length) ? '都买齐了' : '一周采购';
}

/* ---------- 这周 ---------- */
function renderWeek() {
  const today = dayIdx();
  const rows = MENU.days.map((d, i) => {
    const p = planOf(i);
    const m = dish(p.meat), v = dish(p.veg);
    const kcal = kcalOf(m) + kcalOf(v) + Math.round(riceOf(i) * RICE_KCAL);
    const isToday = i === today;
    return `
      <div class="wrow ${isToday ? 'today' : ''}" data-day="${i}">
        <span class="wd">${d.name.slice(1)}</span>
        <span class="wc">
          <b>${m ? m.name : '—'}</b><i>＋</i>${v ? v.name : '—'}
        </span>
        <span class="wk">${kcal}<small>kcal</small></span>
      </div>`;
  }).join('');

  const avg = Math.round(MENU.days.reduce((s, _, i) => {
    const p = planOf(i);
    return s + kcalOf(dish(p.meat)) + kcalOf(dish(p.veg)) + Math.round(riceOf(i) * RICE_KCAL);
  }, 0) / MENU.days.length);
  const dayTotal = avg * 2 + 283 + 90;

  document.getElementById('view-week').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="k">一顿平均</div><div class="v">${avg}<small>kcal</small></div></div>
      <div class="stat"><div class="k">一天合计</div><div class="v">${dayTotal}<small>kcal</small></div></div>
    </div>
    <div class="wlist">${rows}</div>
    <p class="hint">一顿的数字不含早餐和水果。<br>右上是一天三顿加一个水果的总量，按这个算正好。</p>`;
}

/* ---------- 换菜 ---------- */
const sheet = document.getElementById('sheet');
const sheetBody = document.getElementById('sheet-body');
const sheetTitle = document.getElementById('sheet-title');

function openSwap(slot, idx) {
  const kind = slot === 'meat' ? 'meat' : 'veg';
  const pool = DATA.dishes.filter(d => d.kind === kind);
  const cur = planOf(idx)[kind];

  sheetTitle.textContent = slot === 'meat' ? '换一道荤的' : '换一道素的';
  sheetBody.innerHTML = pool.map(d => `
    <button class="opt ${d.id === cur ? 'cur' : ''}"
            data-pick="${d.id}" data-slot="${slot}" data-idx="${idx}">
      ${d.id === cur ? '<span class="tick">✓</span>' : ''}
      <span class="on-nm">${d.name}</span>
      <span class="on-mt">${d.kcal} 大卡 · ${d.protein}g 蛋白</span>
    </button>`).join('');

  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('in'));
}

function closeSheet() {
  sheet.classList.remove('in');
  setTimeout(() => { sheet.hidden = true; }, 220);
}

function renderAll() {
  renderNow();
  renderWeek();
  renderShop();
}

/* ---------- 事件 ---------- */
document.addEventListener('click', e => {
  const tab = e.target.closest('.tabs button');
  if (tab) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b === tab));
    document.querySelectorAll('.view').forEach(v =>
      v.classList.toggle('on', v.id === 'view-' + tab.dataset.view));
    window.scrollTo({ top: 0, behavior: 'instant' });
    return;
  }

  const sw = e.target.closest('[data-swap]');
  if (sw) { openSwap(sw.dataset.swap, Number(sw.dataset.idx || 0)); return; }

  const pick = e.target.closest('[data-pick]');
  if (pick) {
    state.overrides[pick.dataset.idx + '.' + pick.dataset.slot] = pick.dataset.pick;
    save();
    closeSheet();
    renderAll();
    return;
  }

  if (e.target.closest('[data-close]')) { closeSheet(); return; }

  const item = e.target.closest('.item');
  if (item) {
    const k = item.dataset.item;
    const on = !state.checked[k];
    if (on) state.checked[k] = 1; else delete state.checked[k];
    save();
    item.classList.toggle('done', on);
    const box = item.querySelector('.box');
    if (box) box.textContent = on ? '✓' : '';
    updateShopProgress();
    return;
  }

  if (e.target.id === 'reset-check') {
    state.checked = {};
    save();
    renderShop();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !sheet.hidden) closeSheet();
});

/* ---------- 启动 ---------- */
(async function boot() {
  document.getElementById('today-label').textContent = fmtDate();

  const bust = '?v=' + Date.now();
  try {
    const [d1, d2] = await Promise.all([
      fetch('data/dishes.json' + bust).then(r => r.json()),
      fetch('data/menu.json' + bust).then(r => r.json())
    ]);
    DATA = d1; MENU = d2;
  } catch (err) {
    document.getElementById('view-now').innerHTML =
      '<p class="hint">数据没加载出来。用本地服务器或线上地址访问，别直接双击打开文件。</p>';
    return;
  }
  renderAll();
})();
