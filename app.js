(() => {
  'use strict';

  // ---------- Constants ----------
  const USER_STORE_KEY = 'bingo.userThemes';
  const USER_ID_PREFIX = 'user:';
  const MIN_ITEMS = 30;
  const DEFAULT_PALETTE = { ink: '#0b1b3b', gold: '#c9a24a', paper: '#fdfaf2' };
  const PRESETS = [
    { name: 'Navy & Gold',      palette: { ink: '#0b1b3b', gold: '#c9a24a', paper: '#fdfaf2' } },
    { name: 'Highway Retro',    palette: { ink: '#8a1e1e', gold: '#1f3f7a', paper: '#fff4da' } },
    { name: 'Leafy Green',      palette: { ink: '#1f4d2a', gold: '#c88a2b', paper: '#f5efdd' } },
    { name: 'Coastal',          palette: { ink: '#1a5a6b', gold: '#e2784f', paper: '#fff3dc' } },
    { name: 'Holiday',          palette: { ink: '#6b1a2b', gold: '#2d5a3a', paper: '#fdf7e8' } },
    { name: 'Graphite',         palette: { ink: '#2b2b2b', gold: '#8a7a3c', paper: '#f6f5f1' } }
  ];

  // ---------- State ----------
  const state = {
    themeIndex: [],          // bundled theme summaries from themes/index.json
    themeCache: {},          // id -> full theme
    userThemes: [],          // from localStorage
    currentTheme: null,
    seed: null,
    count: 4,
  };

  // ---------- Utilities ----------
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function slugify(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'theme';
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // Base64URL for share links (unicode-safe)
  function encodeTheme(theme) {
    const json = JSON.stringify(theme);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeTheme(str) {
    const pad = '='.repeat((4 - (str.length % 4)) % 4);
    const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  }

  // ---------- Seeded PRNG ----------
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr) {
    return mulberry32(hashStr(seedStr));
  }
  function shuffled(arr, rng) {
    const a = arr.slice();
    const rand = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function newSeed() {
    // short, friendly
    const n = Math.floor(Math.random() * 0xfff) + 1;
    return n.toString(16).padStart(3, '0');
  }

  // ---------- LocalStorage for user themes ----------
  function getUserThemes() {
    try {
      const raw = localStorage.getItem(USER_STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('bingo: user themes corrupted, resetting', e);
      try { localStorage.removeItem(USER_STORE_KEY); } catch (_) {}
      return [];
    }
  }
  function setUserThemes(arr) {
    localStorage.setItem(USER_STORE_KEY, JSON.stringify(arr));
    state.userThemes = arr;
  }
  function saveUserTheme(theme) {
    const all = getUserThemes();
    const i = all.findIndex(t => t.id === theme.id);
    if (i >= 0) all[i] = theme; else all.push(theme);
    setUserThemes(all);
  }
  function deleteUserThemeById(id) {
    const all = getUserThemes().filter(t => t.id !== id);
    setUserThemes(all);
  }
  function getUserTheme(id) {
    return getUserThemes().find(t => t.id === id) || null;
  }

  // ---------- Theme loading ----------
  async function loadThemeIndex() {
    try {
      const res = await fetch('themes/index.json', { cache: 'no-cache' });
      const data = await res.json();
      state.themeIndex = data.themes || [];
    } catch (e) {
      console.error('Failed to load themes/index.json', e);
      state.themeIndex = [];
    }
    state.userThemes = getUserThemes();
  }
  async function loadTheme(id) {
    if (id.startsWith(USER_ID_PREFIX)) {
      const plainId = id.slice(USER_ID_PREFIX.length);
      const t = getUserTheme(plainId);
      if (!t) throw new Error('User theme not found: ' + plainId);
      return withDefaults(t);
    }
    if (state.themeCache[id]) return state.themeCache[id];
    const res = await fetch(`themes/${id}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Theme not found: ' + id);
    const theme = withDefaults(await res.json());
    state.themeCache[id] = theme;
    return theme;
  }
  function withDefaults(t) {
    return {
      id: t.id,
      name: t.name || 'Untitled',
      emoji: t.emoji || '🎲',
      description: t.description || '',
      eyebrow: t.eyebrow || t.name || '',
      title: t.title || 'B · I · N · G · O',
      subtitle: t.subtitle || 'First to five in a row wins!',
      footer: t.footer || '',
      freeSquare: {
        line1: (t.freeSquare && t.freeSquare.line1) || 'FREE',
        line2: (t.freeSquare && t.freeSquare.line2) || 'SPACE',
      },
      palette: {
        ink: (t.palette && t.palette.ink) || DEFAULT_PALETTE.ink,
        gold: (t.palette && t.palette.gold) || DEFAULT_PALETTE.gold,
        paper: (t.palette && t.palette.paper) || DEFAULT_PALETTE.paper,
      },
      items: Array.isArray(t.items) ? t.items.filter(Boolean) : []
    };
  }

  // ---------- Card rendering ----------
  function makeCard(theme, cardIndex, baseSeed) {
    const p = theme.palette;
    const seed = `${baseSeed}-${String(cardIndex).padStart(2, '0')}`;
    const rng = makeRng(`${theme.id || theme.name}|${seed}`);
    const picks = shuffled(theme.items, rng).slice(0, 24);
    const cells = [];
    for (let i = 0; i < 25; i++) {
      if (i === 12) {
        cells.push(`<div class="cell free">${esc(theme.freeSquare.line1)}<br>${esc(theme.freeSquare.line2)}</div>`);
      } else {
        const idx = i < 12 ? i : i - 1;
        cells.push(`<div class="cell">${esc(picks[idx] || '')}</div>`);
      }
    }
    const styleVars = `--ink:${esc(p.ink)}; --gold:${esc(p.gold)}; --paper:${esc(p.paper)}; --rule:${esc(p.ink)};`;
    return `
      <div class="sheet" style="${styleVars}">
        <div class="header">
          ${theme.eyebrow ? `<div class="eyebrow">${esc(theme.eyebrow)}</div>` : ''}
          <h1>${esc(theme.title)}</h1>
          ${theme.subtitle ? `<div class="sub">${esc(theme.subtitle)}</div>` : ''}
        </div>
        <div class="player-line">
          <span>Player: </span>
          <span>Date: </span>
        </div>
        <div class="bingo-row">
          <div class="letter">B</div>
          <div class="letter">I</div>
          <div class="letter">N</div>
          <div class="letter">G</div>
          <div class="letter">O</div>
        </div>
        <div class="grid">${cells.join('')}</div>
        <div class="footer">
          Card #${cardIndex + 1}${theme.footer ? ` &middot; ${esc(theme.footer)}` : ''} &middot; Seed ${esc(seed)}
        </div>
      </div>
    `;
  }

  // ---------- Views ----------
  function show(viewName) {
    qsa('.view').forEach(el => el.classList.toggle('active', el.dataset.view === viewName));
    if (viewName !== 'builder') {
      const br = qs('#builder-root'); if (br) br.innerHTML = '';
    }
    if (viewName !== 'import') {
      const ir = qs('#import-root'); if (ir) ir.innerHTML = '';
    }
    if (viewName !== 'generator') {
      const cards = qs('#cards'); if (cards) cards.innerHTML = '';
    }
  }

  function renderPicker() {
    show('picker');
    state.userThemes = getUserThemes();
    const host = qs('#picker-grid');
    const bundled = state.themeIndex.map(t => ({ ...t, _kind: 'bundled' }));
    const user = state.userThemes.map(t => ({
      id: USER_ID_PREFIX + t.id,
      name: t.name,
      emoji: t.emoji || '🎲',
      description: t.description || '',
      palette: t.palette || DEFAULT_PALETTE,
      _kind: 'user'
    }));
    const all = [...bundled, ...user];

    host.innerHTML = all.map(t => `
      <button class="tile" data-href="#/theme/${esc(t.id)}">
        ${t._kind === 'user' ? '<span class="badge">Custom</span>' : ''}
        <div class="emoji">${esc(t.emoji)}</div>
        <h3>${esc(t.name)}</h3>
        <p>${esc(t.description)}</p>
        <div class="palette-chip" aria-hidden="true">
          <span style="background:${esc(t.palette.ink)}"></span>
          <span style="background:${esc(t.palette.gold)}"></span>
          <span style="background:${esc(t.palette.paper)}"></span>
        </div>
      </button>
    `).join('') + `
      <button class="tile create" data-href="#/new">
        <div class="plus">+</div>
        <h3>Create your own</h3>
        <p>Make a theme and save it in your browser.</p>
      </button>
    `;

    qsa('#picker-grid .tile').forEach(el => {
      el.addEventListener('click', () => {
        const href = el.dataset.href;
        if (href) location.hash = href;
      });
    });

    const surprise = qs('#surprise-btn');
    surprise.disabled = all.length === 0;
  }

  async function renderGenerator(id) {
    let theme;
    try {
      theme = await loadTheme(id);
    } catch (e) {
      alert('Could not load theme: ' + e.message);
      location.hash = '#/';
      return;
    }
    state.currentTheme = theme;
    if (!state.seed) state.seed = newSeed();

    show('generator');

    const isUser = id.startsWith(USER_ID_PREFIX);
    qs('#gen-edit-btn').style.display = isUser ? '' : 'none';
    qs('#gen-share-btn').style.display = isUser ? '' : 'none';

    qs('#count').value = state.count;
    qs('#seed').value = state.seed;

    renderCards();
  }

  function renderCards() {
    const theme = state.currentTheme;
    if (!theme) return;
    const n = Math.max(1, Math.min(12, parseInt(qs('#count').value, 10) || 1));
    state.count = n;
    const host = qs('#cards');
    if (theme.items.length < 24) {
      host.innerHTML = `<div class="import-wrap"><h2>Not enough items</h2>
        <p>This theme has only ${theme.items.length} items — you need at least 24 for a card.</p></div>`;
      return;
    }
    let html = '';
    for (let i = 0; i < n; i++) html += makeCard(theme, i, state.seed);
    host.innerHTML = html;
  }

  function renderBuilder(editingId) {
    show('builder');
    const existing = editingId ? getUserTheme(editingId) : null;
    const seed = existing || {
      id: '',
      name: '',
      emoji: '🎲',
      description: '',
      eyebrow: '',
      subtitle: 'First to five in a row wins!',
      footer: '',
      freeSquare: { line1: 'FREE', line2: 'SPACE' },
      palette: { ...DEFAULT_PALETTE },
      items: []
    };

    const host = qs('#builder-root');
    host.innerHTML = `
      <div class="builder-form">
        <h2>${editingId ? 'Edit theme' : 'Create a theme'}</h2>
        <div class="builder-warning" id="builder-warning"></div>

        <div class="row-inline">
          <div class="form-row">
            <label for="f-name">Theme name</label>
            <input id="f-name" type="text" maxlength="60" value="${esc(seed.name)}" placeholder="e.g. Beach Day" />
          </div>
          <div class="form-row">
            <label for="f-emoji">Emoji</label>
            <input id="f-emoji" type="text" maxlength="4" value="${esc(seed.emoji)}" />
          </div>
        </div>

        <div class="form-row">
          <label for="f-desc">Short description</label>
          <input id="f-desc" type="text" maxlength="120" value="${esc(seed.description)}" placeholder="Shown on the theme picker" />
        </div>

        <div class="row-inline">
          <div class="form-row">
            <label for="f-eyebrow">Eyebrow (small top text)</label>
            <input id="f-eyebrow" type="text" maxlength="60" value="${esc(seed.eyebrow)}" />
          </div>
          <div class="form-row">
            <label for="f-subtitle">Subtitle (under the title)</label>
            <input id="f-subtitle" type="text" maxlength="120" value="${esc(seed.subtitle)}" />
          </div>
        </div>

        <div class="row-inline">
          <div class="form-row">
            <label for="f-free-1">Free square line 1</label>
            <input id="f-free-1" type="text" maxlength="20" value="${esc(seed.freeSquare.line1)}" />
          </div>
          <div class="form-row">
            <label for="f-free-2">Free square line 2</label>
            <input id="f-free-2" type="text" maxlength="20" value="${esc(seed.freeSquare.line2)}" />
          </div>
        </div>

        <div class="form-row">
          <label for="f-footer">Footer text (optional)</label>
          <input id="f-footer" type="text" maxlength="120" value="${esc(seed.footer)}" />
        </div>

        <div class="form-row">
          <label>Palette</label>
          <div class="row-inline-3">
            ${['ink','gold','paper'].map(k => `
              <div class="color-picker">
                <input type="color" id="f-color-${k}" value="${esc(seed.palette[k])}" />
                <input type="text" id="f-color-${k}-hex" value="${esc(seed.palette[k])}" maxlength="7" />
              </div>
              <div class="hint" style="margin-top:-0.5rem">${k}</div>
            `).join('')}
          </div>
          <div class="presets" id="palette-presets">
            ${PRESETS.map((p, i) => `
              <button type="button" class="preset-swatch" data-preset="${i}">
                <span class="dots">
                  <span style="background:${esc(p.palette.ink)}"></span>
                  <span style="background:${esc(p.palette.gold)}"></span>
                  <span style="background:${esc(p.palette.paper)}"></span>
                </span>
                ${esc(p.name)}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="form-row">
          <label for="f-items">Items — one per line</label>
          <textarea id="f-items" placeholder="A plane painted yellow&#10;A helicopter&#10;...">${esc(seed.items.join('\n'))}</textarea>
          <div class="hint" id="items-count">0 items</div>
        </div>

        <div class="builder-actions">
          <button type="button" class="primary" id="btn-save">${editingId ? 'Save changes' : 'Save theme'}</button>
          <button type="button" id="btn-preview">Preview cards</button>
          <button type="button" id="btn-export">Export JSON</button>
          <label class="btn">Import JSON<input type="file" id="file-import" accept="application/json,.json" /></label>
          ${editingId ? '<button type="button" class="danger" id="btn-delete">Delete</button>' : ''}
        </div>
      </div>

      <div class="builder-preview">
        <div class="preview-label">Live preview</div>
        <div id="preview-root"></div>
      </div>
    `;

    const form = {
      name: qs('#f-name'),
      emoji: qs('#f-emoji'),
      desc: qs('#f-desc'),
      eyebrow: qs('#f-eyebrow'),
      subtitle: qs('#f-subtitle'),
      free1: qs('#f-free-1'),
      free2: qs('#f-free-2'),
      footer: qs('#f-footer'),
      colorInk: qs('#f-color-ink'),
      colorGold: qs('#f-color-gold'),
      colorPaper: qs('#f-color-paper'),
      colorInkHex: qs('#f-color-ink-hex'),
      colorGoldHex: qs('#f-color-gold-hex'),
      colorPaperHex: qs('#f-color-paper-hex'),
      items: qs('#f-items'),
    };

    const readTheme = () => {
      const itemsList = form.items.value.split('\n').map(s => s.trim()).filter(Boolean);
      const name = form.name.value.trim();
      return {
        id: editingId || slugify(name),
        name,
        emoji: form.emoji.value.trim() || '🎲',
        description: form.desc.value.trim(),
        eyebrow: form.eyebrow.value.trim(),
        title: 'B · I · N · G · O',
        subtitle: form.subtitle.value.trim(),
        footer: form.footer.value.trim(),
        freeSquare: { line1: form.free1.value.trim() || 'FREE', line2: form.free2.value.trim() || 'SPACE' },
        palette: {
          ink: form.colorInkHex.value.trim() || DEFAULT_PALETTE.ink,
          gold: form.colorGoldHex.value.trim() || DEFAULT_PALETTE.gold,
          paper: form.colorPaperHex.value.trim() || DEFAULT_PALETTE.paper,
        },
        items: itemsList
      };
    };

    const updatePreview = debounce(() => {
      const theme = withDefaults(readTheme());
      const count = qs('#items-count');
      const n = theme.items.length;
      count.textContent = `${n} item${n === 1 ? '' : 's'} · minimum ${MIN_ITEMS}`;
      count.className = 'hint ' + (n >= MIN_ITEMS ? 'ok' : 'warn');
      const previewHost = qs('#preview-root');
      if (theme.items.length < 24) {
        previewHost.innerHTML = `<div style="text-align:center; color:#777; font-size:0.85rem; padding:2rem">Add at least 24 items to preview</div>`;
      } else {
        previewHost.innerHTML = makeCard(theme, 0, 'preview');
      }
    }, 120);

    // Sync color picker <-> hex input pairs
    const syncColor = (picker, hex) => {
      picker.addEventListener('input', () => { hex.value = picker.value; updatePreview(); });
      hex.addEventListener('input', () => {
        const v = hex.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) picker.value = v;
        updatePreview();
      });
    };
    syncColor(form.colorInk, form.colorInkHex);
    syncColor(form.colorGold, form.colorGoldHex);
    syncColor(form.colorPaper, form.colorPaperHex);

    // Live preview on any other input
    ['name','emoji','desc','eyebrow','subtitle','free1','free2','footer','items'].forEach(k => {
      form[k].addEventListener('input', updatePreview);
    });

    // Preset swatches
    qsa('#palette-presets .preset-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = PRESETS[parseInt(btn.dataset.preset, 10)].palette;
        form.colorInk.value = form.colorInkHex.value = p.ink;
        form.colorGold.value = form.colorGoldHex.value = p.gold;
        form.colorPaper.value = form.colorPaperHex.value = p.paper;
        updatePreview();
      });
    });

    // Save
    qs('#btn-save').addEventListener('click', () => {
      const theme = readTheme();
      const warn = qs('#builder-warning');
      if (!theme.name) return showWarn('Please give your theme a name.');
      if (theme.items.length < MIN_ITEMS) return showWarn(`Need at least ${MIN_ITEMS} items (you have ${theme.items.length}).`);
      if (!editingId) {
        const existingIds = getUserThemes().map(t => t.id);
        let base = theme.id, i = 2;
        while (existingIds.includes(theme.id)) { theme.id = `${base}-${i++}`; }
      }
      saveUserTheme(theme);
      location.hash = `#/theme/${USER_ID_PREFIX}${theme.id}`;
    });

    // Preview button — same as live, also scrolls
    qs('#btn-preview').addEventListener('click', () => {
      updatePreview();
      qs('#preview-root').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Export
    qs('#btn-export').addEventListener('click', () => {
      const theme = readTheme();
      const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slugify(theme.name) || 'theme'}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // Import
    qs('#file-import').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const t = JSON.parse(text);
        applyThemeToForm(t, form);
        updatePreview();
      } catch (err) {
        showWarn('That file was not a valid theme JSON.');
      }
      e.target.value = '';
    });

    // Delete
    if (editingId) {
      qs('#btn-delete').addEventListener('click', () => {
        if (!confirm(`Delete "${seed.name}" from your saved themes?`)) return;
        deleteUserThemeById(editingId);
        location.hash = '#/';
      });
    }

    function showWarn(msg) {
      const el = qs('#builder-warning');
      el.textContent = msg;
      el.classList.add('show');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updatePreview();
  }

  function applyThemeToForm(t, form) {
    form.name.value = t.name || '';
    form.emoji.value = t.emoji || '🎲';
    form.desc.value = t.description || '';
    form.eyebrow.value = t.eyebrow || '';
    form.subtitle.value = t.subtitle || '';
    form.free1.value = (t.freeSquare && t.freeSquare.line1) || 'FREE';
    form.free2.value = (t.freeSquare && t.freeSquare.line2) || 'SPACE';
    form.footer.value = t.footer || '';
    const p = t.palette || DEFAULT_PALETTE;
    form.colorInk.value = form.colorInkHex.value = p.ink || DEFAULT_PALETTE.ink;
    form.colorGold.value = form.colorGoldHex.value = p.gold || DEFAULT_PALETTE.gold;
    form.colorPaper.value = form.colorPaperHex.value = p.paper || DEFAULT_PALETTE.paper;
    form.items.value = Array.isArray(t.items) ? t.items.join('\n') : '';
  }

  function renderImport(encoded) {
    show('import');
    let theme;
    try {
      theme = withDefaults(decodeTheme(encoded));
    } catch (e) {
      qs('#import-root').innerHTML = `
        <div class="import-wrap">
          <h2>Broken share link</h2>
          <p>That link didn't contain a valid theme.</p>
          <div class="import-actions"><button class="primary" data-href="#/">Back to themes</button></div>
        </div>`;
      wireImportActions();
      return;
    }
    qs('#import-root').innerHTML = `
      <div class="import-wrap">
        <h2>Import this theme?</h2>
        <div class="preview-mini">
          <div class="emoji">${esc(theme.emoji)}</div>
          <div style="text-align:left">
            <div style="font-weight:bold; font-size:1.1rem">${esc(theme.name)}</div>
            <div style="color:#666; font-size:0.9rem">${esc(theme.description)}</div>
            <div style="color:#888; font-size:0.8rem; margin-top:0.25rem">${theme.items.length} items</div>
          </div>
        </div>
        <div class="import-actions">
          <button class="primary" id="import-save">Save to my themes</button>
          <button data-href="#/">Cancel</button>
        </div>
      </div>`;
    wireImportActions();
    qs('#import-save').addEventListener('click', () => {
      const baseId = slugify(theme.name);
      let id = baseId, i = 2;
      const existing = getUserThemes().map(t => t.id);
      while (existing.includes(id)) id = `${baseId}-${i++}`;
      theme.id = id;
      saveUserTheme(theme);
      location.hash = `#/theme/${USER_ID_PREFIX}${id}`;
    });
  }
  function wireImportActions() {
    qsa('#import-root [data-href]').forEach(btn => {
      btn.addEventListener('click', () => { location.hash = btn.dataset.href; });
    });
  }

  // ---------- Routing ----------
  function parseHash() {
    // supports: '', '#/', '#/theme/:id', '#/new', '#/edit/:id', '#/import?data=...'
    const h = location.hash.replace(/^#/, '');
    if (!h || h === '/') return { name: 'picker' };
    const [pathPart, queryPart] = h.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    if (parts[0] === 'theme' && parts[1]) {
      return { name: 'generator', id: decodeURIComponent(parts.slice(1).join('/')) };
    }
    if (parts[0] === 'new') return { name: 'builder' };
    if (parts[0] === 'edit' && parts[1]) {
      return { name: 'builder', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'import') {
      const params = new URLSearchParams(queryPart || '');
      return { name: 'import', data: params.get('data') };
    }
    return { name: 'picker' };
  }

  function route() {
    const r = parseHash();
    // reset per-navigation state
    if (r.name !== 'generator') {
      state.currentTheme = null;
      state.seed = null;
    }
    if (r.name === 'picker') return renderPicker();
    if (r.name === 'generator') return renderGenerator(r.id);
    if (r.name === 'builder') return renderBuilder(r.id);
    if (r.name === 'import') return renderImport(r.data || '');
    renderPicker();
  }

  function handleLegacyQuery() {
    // ?theme=<id> legacy redirect to hash route
    const p = new URLSearchParams(location.search);
    const t = p.get('theme');
    if (t && !location.hash) {
      history.replaceState(null, '', location.pathname + '#/theme/' + encodeURIComponent(t));
    }
  }

  // ---------- Boot ----------
  function wireGeneratorToolbar() {
    qs('#shuffle').addEventListener('click', () => {
      state.seed = newSeed();
      qs('#seed').value = state.seed;
      renderCards();
    });
    qs('#count').addEventListener('change', renderCards);
    qs('#seed').addEventListener('change', () => {
      const v = qs('#seed').value.trim() || newSeed();
      state.seed = v;
      qs('#seed').value = v;
      renderCards();
    });
    qs('#print-btn').addEventListener('click', () => window.print());
    qs('#gen-edit-btn').addEventListener('click', () => {
      if (!state.currentTheme) return;
      const rawId = state.currentTheme.id;
      location.hash = `#/edit/${rawId}`;
    });
    qs('#gen-share-btn').addEventListener('click', async () => {
      if (!state.currentTheme) return;
      const theme = state.currentTheme;
      const url = `${location.origin}${location.pathname}#/import?data=${encodeTheme(theme)}`;
      try {
        await navigator.clipboard.writeText(url);
        flashToast('Share link copied to clipboard!');
      } catch (_) {
        prompt('Copy this share link:', url);
      }
    });
  }

  function wirePickerToolbar() {
    qs('#surprise-btn').addEventListener('click', () => {
      const bundled = state.themeIndex;
      const user = state.userThemes.map(t => ({ id: USER_ID_PREFIX + t.id }));
      const all = [...bundled, ...user];
      if (!all.length) return;
      const pick = all[Math.floor(Math.random() * all.length)];
      location.hash = `#/theme/${pick.id}`;
    });
    qs('#new-btn').addEventListener('click', () => { location.hash = '#/new'; });
  }

  function flashToast(msg) {
    let el = qs('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = 'position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);background:#0b1b3b;color:#fff;padding:0.6rem 1rem;border-radius:4px;z-index:100;font-size:0.9rem;box-shadow:0 4px 14px rgba(0,0,0,0.2);';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(flashToast._t);
    flashToast._t = setTimeout(() => { el.style.display = 'none'; }, 2200);
  }

  async function boot() {
    handleLegacyQuery();
    await loadThemeIndex();
    wirePickerToolbar();
    wireGeneratorToolbar();
    window.addEventListener('hashchange', route);
    route();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
