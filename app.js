// TradeYard - UK & Ireland Furniture Wholesale Catalogue
// Vanilla JS app that loads sources.json and renders a filterable catalogue.

const STORAGE_KEY = 'tradeyard_v1';

const state = {
  sources: [],
  search: '',
  filters: {
    country: new Set(),
    type: new Set(),
    deal: new Set(),
    price: new Set(),
    trade: new Set(),
    styles: new Set(),
    categories: new Set(),
  },
  onlyClearance: false,
  onlySaved: false,
  sort: 'deal',
  view: 'grid',
  saved: new Set(),
  notes: {},
};

const TYPE_LABEL = {
  Importer: 'Importer',
  Wholesaler: 'Wholesaler',
  TradeRetailer: 'Trade Retailer',
  Maker: 'Maker',
  Auction: 'Auction',
  AuctionPlatform: 'Auction Platform',
  Liquidator: 'Liquidator',
  Outlet: 'Outlet',
};

const STYLE_LABEL = {
  industrial: 'Industrial',
  reclaimed: 'Reclaimed',
  indian: 'Indian',
  indonesian: 'Indonesian',
  french_farmhouse: 'French Farmhouse',
  farmhouse: 'Farmhouse',
  oak: 'Oak',
  pine: 'Pine',
  vintage: 'Vintage',
  rustic: 'Rustic',
  live_edge: 'Live Edge',
  mid_century: 'Mid-Century',
  mango: 'Mango',
  teak: 'Teak',
  sheesham: 'Sheesham',
  acacia: 'Acacia',
  coastal: 'Coastal',
  scandi: 'Scandi',
  antique: 'Antique',
  oriental: 'Oriental',
  chunky: 'Chunky',
  sleeper: 'Sleeper',
  refectory: 'Refectory',
  painted: 'Painted',
  oak_beam: 'Oak Beam',
  modern: 'Modern',
  mixed: 'Mixed',
  modern_rustic: 'Modern Rustic',
};

const CATEGORY_LABEL = {
  kitchen_tables: 'Kitchen Tables',
  dining: 'Dining',
  sideboards: 'Sideboards',
  beds: 'Beds',
  chairs: 'Chairs',
  lighting: 'Lighting',
  accessories: 'Accessories',
  sofas: 'Sofas',
  bedroom: 'Bedroom',
  living: 'Living',
  storage: 'Storage',
  mirrors: 'Mirrors',
  rugs: 'Rugs',
  benches: 'Benches',
  mixed_furniture: 'Mixed Furniture',
  commercial_clearance: 'Commercial Clearance',
  home_returns: 'Home Returns',
  pallet_lots: 'Pallet Lots',
};

const DEAL_LABEL = { high: '★ High', medium: 'Medium', low: 'Low' };
const PRICE_LABEL = { budget: 'Budget', mid: 'Mid', premium: 'Premium' };
const TRADE_LABEL = { none: 'Public', low: 'Trade · Easy', medium: 'Trade · Medium', high: 'Trade · Strict' };

// ---------- init ----------
async function init() {
  try {
    const res = await fetch('./sources.json');
    state.sources = await res.json();
  } catch (e) {
    document.getElementById('grid').innerHTML = '<div class="col-span-full p-8 text-center text-red-600">Failed to load sources.json</div>';
    return;
  }
  loadPersisted();
  buildFilterUI();
  wireEvents();
  updateStats();
  render();
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.saved = new Set(data.saved || []);
      state.notes = data.notes || {};
    }
  } catch {}
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    saved: [...state.saved],
    notes: state.notes,
  }));
}

// ---------- filter UI ----------
function buildFilterUI() {
  const countries = uniq(state.sources.map(s => s.country)).sort();
  const types = uniq(state.sources.map(s => s.type)).sort();
  const allStyles = uniq(state.sources.flatMap(s => s.styles || [])).sort();
  const allCats = uniq(state.sources.flatMap(s => s.categories || [])).sort();

  renderChips('filter-country', countries, 'country', v => v);
  renderChips('filter-type', types, 'type', v => TYPE_LABEL[v] || v);
  renderChips('filter-deal', ['high','medium','low'], 'deal', v => DEAL_LABEL[v]);
  renderChips('filter-price', ['budget','mid','premium'], 'price', v => PRICE_LABEL[v]);
  renderChips('filter-trade', ['none','low','medium','high'], 'trade', v => TRADE_LABEL[v]);
  renderChips('filter-styles', allStyles, 'styles', v => STYLE_LABEL[v] || v);
  renderChips('filter-categories', allCats, 'categories', v => CATEGORY_LABEL[v] || v);
}

function renderChips(containerId, values, filterKey, labelFn) {
  const el = document.getElementById(containerId);
  el.innerHTML = values.map(v => {
    const active = state.filters[filterKey].has(v);
    return `<button class="chip chip-clickable ${active ? 'chip-active' : 'chip-inactive'}" data-filter="${filterKey}" data-value="${v}">${escapeHtml(labelFn(v))}</button>`;
  }).join('');
}

// ---------- events ----------
function wireEvents() {
  document.addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (chip) {
      const { filter, value } = chip.dataset;
      toggleFilter(filter, value);
      renderChips(`filter-${filter}`, uniq(collectFilterOptions(filter)), filter, labelFnFor(filter));
      render();
      return;
    }
    const preset = e.target.closest('[data-preset]');
    if (preset) { applyPreset(preset.dataset.preset); return; }
    const view = e.target.closest('[data-view]');
    if (view) { setView(view.dataset.view); return; }
  });
  document.getElementById('search').addEventListener('input', e => {
    state.search = e.target.value.toLowerCase().trim();
    render();
  });
  document.getElementById('sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  document.getElementById('only-clearance').addEventListener('change', e => { state.onlyClearance = e.target.checked; render(); });
  document.getElementById('only-saved').addEventListener('change', e => { state.onlySaved = e.target.checked; render(); });
  document.getElementById('reset-filters').addEventListener('click', resetFilters);
  document.getElementById('export-btn').addEventListener('click', e => { e.preventDefault(); exportJson(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function labelFnFor(filterKey) {
  if (filterKey === 'country') return v => v;
  if (filterKey === 'type') return v => TYPE_LABEL[v] || v;
  if (filterKey === 'deal') return v => DEAL_LABEL[v];
  if (filterKey === 'price') return v => PRICE_LABEL[v];
  if (filterKey === 'trade') return v => TRADE_LABEL[v];
  if (filterKey === 'styles') return v => STYLE_LABEL[v] || v;
  if (filterKey === 'categories') return v => CATEGORY_LABEL[v] || v;
  return v => v;
}

function collectFilterOptions(key) {
  if (key === 'country') return state.sources.map(s => s.country);
  if (key === 'type') return state.sources.map(s => s.type);
  if (key === 'deal') return ['high','medium','low'];
  if (key === 'price') return ['budget','mid','premium'];
  if (key === 'trade') return ['none','low','medium','high'];
  if (key === 'styles') return state.sources.flatMap(s => s.styles || []);
  if (key === 'categories') return state.sources.flatMap(s => s.categories || []);
  return [];
}

function toggleFilter(key, value) {
  const set = state.filters[key];
  if (set.has(value)) set.delete(value); else set.add(value);
}

function resetFilters() {
  Object.values(state.filters).forEach(s => s.clear());
  state.search = '';
  state.onlyClearance = false;
  state.onlySaved = false;
  document.getElementById('search').value = '';
  document.getElementById('only-clearance').checked = false;
  document.getElementById('only-saved').checked = false;
  buildFilterUI();
  render();
}

function applyPreset(name) {
  Object.values(state.filters).forEach(s => s.clear());
  state.onlyClearance = false;
  state.onlySaved = false;
  document.getElementById('only-clearance').checked = false;
  document.getElementById('only-saved').checked = false;
  if (name === 'uk') state.filters.country.add('UK');
  else if (name === 'ireland') state.filters.country.add('Ireland');
  else if (name === 'clearance') { state.onlyClearance = true; document.getElementById('only-clearance').checked = true; }
  else if (name === 'auctions') { state.filters.type.add('Auction'); state.filters.type.add('AuctionPlatform'); state.filters.type.add('Liquidator'); }
  else if (name === 'kitchen') state.filters.categories.add('kitchen_tables');
  else if (name === 'saved') { state.onlySaved = true; document.getElementById('only-saved').checked = true; }
  buildFilterUI();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setView(v) {
  state.view = v;
  document.querySelectorAll('[data-view]').forEach(b => {
    if (b.dataset.view === v) { b.classList.remove('bg-white','text-navy-700'); b.classList.add('bg-navy-900','text-white'); }
    else { b.classList.add('bg-white','text-navy-700'); b.classList.remove('bg-navy-900','text-white'); }
  });
  render();
}

// ---------- filtering + sorting ----------
function applyFilters() {
  const q = state.search;
  return state.sources.filter(s => {
    if (state.onlySaved && !state.saved.has(s.id)) return false;
    if (state.onlyClearance && !s.clearance_url) return false;
    if (state.filters.country.size && !state.filters.country.has(s.country)) return false;
    if (state.filters.type.size && !state.filters.type.has(s.type)) return false;
    if (state.filters.deal.size && !state.filters.deal.has(s.deal_potential)) return false;
    if (state.filters.price.size && !state.filters.price.has(s.price_tier)) return false;
    if (state.filters.trade.size) {
      const key = s.trade_only ? (s.trade_difficulty || 'low') : 'none';
      if (!state.filters.trade.has(key)) return false;
    }
    if (state.filters.styles.size && !(s.styles || []).some(x => state.filters.styles.has(x))) return false;
    if (state.filters.categories.size && !(s.categories || []).some(x => state.filters.categories.has(x))) return false;
    if (q) {
      const hay = [s.name, s.city, s.country, s.notes, (s.styles||[]).join(' '), (s.categories||[]).join(' ')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sortResults(list) {
  const dealRank = { high: 0, medium: 1, low: 2 };
  const typeRank = { Importer: 0, Wholesaler: 1, TradeRetailer: 2, Maker: 3, Outlet: 4, Auction: 5, AuctionPlatform: 6, Liquidator: 7 };
  const copy = [...list];
  if (state.sort === 'name') copy.sort((a,b) => a.name.localeCompare(b.name));
  else if (state.sort === 'type') copy.sort((a,b) => (typeRank[a.type]||9) - (typeRank[b.type]||9) || a.name.localeCompare(b.name));
  else if (state.sort === 'country') copy.sort((a,b) => a.country.localeCompare(b.country) || (typeRank[a.type]||9) - (typeRank[b.type]||9) || a.name.localeCompare(b.name));
  else copy.sort((a,b) => (dealRank[a.deal_potential]||9) - (dealRank[b.deal_potential]||9) || a.name.localeCompare(b.name));
  return copy;
}

// ---------- rendering ----------
function render() {
  const filtered = sortResults(applyFilters());
  document.getElementById('result-count').textContent = filtered.length;
  document.getElementById('empty-state').classList.toggle('hidden', filtered.length > 0);
  renderActivePills();
  const grid = document.getElementById('grid');
  grid.className = state.view === 'list'
    ? 'p-4 grid gap-2 grid-cols-1'
    : 'p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';
  grid.innerHTML = filtered.map(s => state.view === 'list' ? renderRow(s) : renderCard(s)).join('');
}

function renderCard(s) {
  const flag = s.country === 'UK' ? '🇬🇧' : '🇮🇪';
  const saved = state.saved.has(s.id);
  const styleChips = (s.styles || []).slice(0, 4).map(x => `<span class="chip chip-inactive">${escapeHtml(STYLE_LABEL[x] || x)}</span>`).join('');
  const catChips = (s.categories || []).filter(c => c === 'kitchen_tables').slice(0,1).map(x => `<span class="chip" style="background:#c8a24a;color:#0b1430;font-weight:600;">🍽 Kitchen Tables</span>`).join('');
  const dealCls = `deal-${s.deal_potential}`;
  return `
    <div class="card cursor-pointer fade-in" onclick="openDetail('${s.id}')">
      <div class="flex items-start justify-between gap-2 mb-1.5">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <h3 class="font-serif text-[1.02rem] leading-tight text-navy-900 truncate">${escapeHtml(s.name)}</h3>
          </div>
          <div class="text-[0.72rem] text-navy-500 mt-0.5 truncate">${flag} ${escapeHtml(s.city || '—')}</div>
        </div>
        <button onclick="event.stopPropagation(); toggleSave('${s.id}')" class="flex-shrink-0 text-lg leading-none ${saved ? 'saved-heart' : 'text-navy-200 hover:text-gold-400'}" title="Save">${saved ? '♥' : '♡'}</button>
      </div>
      <div class="flex flex-wrap gap-1 mb-2">
        <span class="chip type-${s.type}">${TYPE_LABEL[s.type] || s.type}</span>
        <span class="chip ${dealCls}">${DEAL_LABEL[s.deal_potential] || s.deal_potential}</span>
        ${s.trade_only ? `<span class="chip" style="background:#1e2a46;color:#c8a24a;">Trade · ${s.trade_difficulty || 'low'}</span>` : ''}
        ${s.clearance_url ? `<span class="chip" style="background:#fce7f3;color:#831843;">Clearance ↗</span>` : ''}
        ${catChips}
      </div>
      <div class="flex flex-wrap gap-1 mb-2">${styleChips}</div>
      <p class="text-[0.78rem] text-navy-600 leading-snug line-clamp-3">${escapeHtml(s.notes || '')}</p>
      <div class="mt-2 pt-2 border-t border-navy-100 flex items-center justify-between text-[0.7rem]">
        <span class="text-navy-500">${PRICE_LABEL[s.price_tier] || ''}</span>
        <a href="${s.website}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-gold-600 hover:text-gold-400 font-medium">Visit site →</a>
      </div>
    </div>
  `;
}

function renderRow(s) {
  const flag = s.country === 'UK' ? '🇬🇧' : '🇮🇪';
  const saved = state.saved.has(s.id);
  return `
    <div class="card cursor-pointer fade-in !p-3" onclick="openDetail('${s.id}')">
      <div class="flex items-center gap-3">
        <button onclick="event.stopPropagation(); toggleSave('${s.id}')" class="text-lg ${saved ? 'saved-heart' : 'text-navy-200 hover:text-gold-400'}">${saved ? '♥' : '♡'}</button>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-serif font-semibold text-navy-900 truncate">${escapeHtml(s.name)}</span>
            <span class="chip type-${s.type} text-[10px]">${TYPE_LABEL[s.type] || s.type}</span>
            <span class="chip deal-${s.deal_potential} text-[10px]">${DEAL_LABEL[s.deal_potential]}</span>
            ${s.clearance_url ? '<span class="chip text-[10px]" style="background:#fce7f3;color:#831843;">Clearance</span>' : ''}
            ${s.trade_only ? `<span class="chip text-[10px]" style="background:#1e2a46;color:#c8a24a;">Trade</span>` : ''}
          </div>
          <div class="text-xs text-navy-500 truncate">${flag} ${escapeHtml(s.city||'')} · ${escapeHtml(s.notes || '')}</div>
        </div>
        <a href="${s.website}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-gold-600 hover:text-gold-400 text-xs font-medium flex-shrink-0">Visit ↗</a>
      </div>
    </div>
  `;
}

function renderActivePills() {
  const pills = [];
  if (state.search) pills.push({ label: `"${state.search}"`, clear: () => { state.search = ''; document.getElementById('search').value = ''; } });
  if (state.onlyClearance) pills.push({ label: 'Clearance only', clear: () => { state.onlyClearance = false; document.getElementById('only-clearance').checked = false; } });
  if (state.onlySaved) pills.push({ label: '♥ Saved only', clear: () => { state.onlySaved = false; document.getElementById('only-saved').checked = false; } });
  for (const [k, set] of Object.entries(state.filters)) {
    for (const v of set) {
      pills.push({ label: `${k}: ${labelFnFor(k)(v)}`, clear: () => { set.delete(v); buildFilterUI(); } });
    }
  }
  document.getElementById('active-pills').innerHTML = pills.map((p, i) =>
    `<button class="chip" style="background:#c8a24a;color:#0b1430;cursor:pointer;" onclick="clearPill(${i})">${escapeHtml(p.label)} ✕</button>`
  ).join('');
  window.__pillClears = pills.map(p => p.clear);
}

window.clearPill = function(idx) {
  const fn = window.__pillClears[idx];
  if (fn) { fn(); render(); }
};

// ---------- detail modal ----------
function openDetail(id) {
  const s = state.sources.find(x => x.id === id);
  if (!s) return;
  const flag = s.country === 'UK' ? '🇬🇧 United Kingdom' : '🇮🇪 Ireland';
  const saved = state.saved.has(s.id);
  const note = state.notes[s.id] || '';
  const styles = (s.styles || []).map(x => `<span class="chip chip-inactive">${escapeHtml(STYLE_LABEL[x] || x)}</span>`).join(' ');
  const cats = (s.categories || []).map(x => `<span class="chip chip-inactive">${escapeHtml(CATEGORY_LABEL[x] || x)}</span>`).join(' ');
  const content = `
    <div class="p-6 md:p-8">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="chip type-${s.type}">${TYPE_LABEL[s.type] || s.type}</span>
            <span class="chip deal-${s.deal_potential}">${DEAL_LABEL[s.deal_potential]} deal potential</span>
            ${s.trade_only ? `<span class="chip" style="background:#1e2a46;color:#c8a24a;">Trade only · ${s.trade_difficulty || 'low'}</span>` : '<span class="chip chip-inactive">Open to public</span>'}
          </div>
          <h2 class="font-serif text-2xl md:text-3xl text-navy-900">${escapeHtml(s.name)}</h2>
          <div class="text-navy-500 text-sm mt-1">${flag}${s.city ? ' · ' + escapeHtml(s.city) : ''}</div>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="toggleSave('${s.id}'); openDetail('${s.id}')" class="w-10 h-10 rounded-full hover:bg-navy-50 flex items-center justify-center text-2xl ${saved ? 'saved-heart' : 'text-navy-300'}">${saved ? '♥' : '♡'}</button>
          <button onclick="closeModal()" class="w-10 h-10 rounded-full hover:bg-navy-50 flex items-center justify-center text-navy-500 text-xl">✕</button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <a href="${s.website}" target="_blank" rel="noopener" class="bg-navy-900 hover:bg-navy-800 text-white text-sm text-center font-semibold rounded-lg px-3 py-2.5">Visit website ↗</a>
        ${s.clearance_url ? `<a href="${s.clearance_url}" target="_blank" rel="noopener" class="bg-gold-400 hover:bg-gold-300 text-navy-900 text-sm text-center font-semibold rounded-lg px-3 py-2.5">Clearance page ↗</a>` : ''}
        ${s.upcoming_sales_url ? `<a href="${s.upcoming_sales_url}" target="_blank" rel="noopener" class="bg-gold-400 hover:bg-gold-300 text-navy-900 text-sm text-center font-semibold rounded-lg px-3 py-2.5">Upcoming sales ↗</a>` : ''}
        <button onclick="copyInfo('${s.id}')" class="bg-white border border-navy-200 hover:border-gold-400 text-navy-900 text-sm font-medium rounded-lg px-3 py-2.5">Copy info</button>
      </div>

      <div class="space-y-4 text-sm">
        <div>
          <div class="text-xs uppercase tracking-wider text-navy-500 mb-1.5 font-semibold">Styles</div>
          <div class="flex flex-wrap gap-1.5">${styles || '<span class="text-navy-400 text-xs">—</span>'}</div>
        </div>
        <div>
          <div class="text-xs uppercase tracking-wider text-navy-500 mb-1.5 font-semibold">Categories</div>
          <div class="flex flex-wrap gap-1.5">${cats || '<span class="text-navy-400 text-xs">—</span>'}</div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 border-y border-navy-100">
          <div><div class="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Price tier</div><div class="text-navy-900 mt-0.5">${PRICE_LABEL[s.price_tier] || '—'}</div></div>
          <div><div class="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Min order</div><div class="text-navy-900 mt-0.5">${escapeHtml(s.min_order || '—')}</div></div>
          ${s.buyers_premium ? `<div><div class="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Buyers premium</div><div class="text-navy-900 mt-0.5">${escapeHtml(s.buyers_premium)}</div></div>` : ''}
          ${s.typical_stock ? `<div><div class="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">Typical stock</div><div class="text-navy-900 mt-0.5">${escapeHtml(s.typical_stock.replace(/_/g,' '))}</div></div>` : ''}
        </div>

        <div>
          <div class="text-xs uppercase tracking-wider text-navy-500 mb-1.5 font-semibold">Notes</div>
          <p class="text-navy-700 leading-relaxed">${escapeHtml(s.notes || '—')}</p>
        </div>

        <div>
          <div class="text-xs uppercase tracking-wider text-navy-500 mb-1.5 font-semibold flex items-center justify-between">
            <span>My notes</span>
            <span class="text-navy-400 normal-case tracking-normal">saved locally</span>
          </div>
          <textarea id="user-note" rows="4" placeholder="Contacts, prices, notes from calls, deal terms…" class="w-full bg-navy-50 border border-navy-200 focus:border-gold-400 outline-none rounded-lg p-3 text-sm">${escapeHtml(note)}</textarea>
          <div class="flex justify-end mt-2 gap-2">
            <button onclick="saveNote('${s.id}')" class="bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold rounded-lg px-3 py-1.5">Save note</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-content').innerHTML = content;
  document.getElementById('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.body.style.overflow = '';
}

window.openDetail = openDetail;
window.closeModal = closeModal;
window.toggleSave = function(id) {
  if (state.saved.has(id)) state.saved.delete(id); else state.saved.add(id);
  persist();
  render();
};
window.saveNote = function(id) {
  const txt = document.getElementById('user-note').value;
  if (txt.trim()) state.notes[id] = txt;
  else delete state.notes[id];
  persist();
  const btn = event.target;
  const orig = btn.textContent;
  btn.textContent = '✓ Saved';
  setTimeout(() => { btn.textContent = orig; }, 1200);
};
window.copyInfo = function(id) {
  const s = state.sources.find(x => x.id === id);
  const info = `${s.name}\n${s.website}\n${s.type} · ${s.city || ''} · ${s.country}\n${s.notes || ''}${s.clearance_url ? '\nClearance: ' + s.clearance_url : ''}`;
  navigator.clipboard.writeText(info).then(() => {
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = orig; }, 1200);
  });
};

// ---------- stats ----------
function updateStats() {
  const total = state.sources.length;
  const uk = state.sources.filter(s => s.country === 'UK').length;
  const ie = state.sources.filter(s => s.country === 'Ireland').length;
  const ni = state.sources.filter(s => s.country === 'Ireland' && /Armagh|Antrim|Down|Belfast|Tyrone|Londonderry|Fermanagh/.test(s.city || '')).length;
  const clearance = state.sources.filter(s => s.clearance_url).length;
  const high = state.sources.filter(s => s.deal_potential === 'high').length;
  setText('stat-total', total);
  setText('stat-uk', uk);
  setText('stat-ireland', ie);
  setText('stat-ni', ni);
  setText('stat-clearance', clearance);
  setText('stat-high', high);
  setText('footer-count', total);
}

function exportJson() {
  const data = { generated: new Date().toISOString(), saved: [...state.saved], notes: state.notes, sources: state.sources };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tradeyard-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

// ---------- helpers ----------
function uniq(arr) { return [...new Set(arr)]; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function escapeHtml(s) { return (s ?? '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

window.resetFilters = resetFilters;
window.applyPreset = applyPreset;

init();
