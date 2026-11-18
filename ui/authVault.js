// ui/authVault.js
import { UNSEEN_ARCHIVE } from '../data/unseenArchive.js';

const STORAGE_USER_KEY = 'unseen_logic_user_v1';
const STORAGE_VAULT_KEY = 'unseen_logic_custom_vault_v1';

const DOMAIN_META = [
  { id: 'all', label: 'All Archive' },
  { id: 'mechanics', label: 'Mechanics' },
  { id: 'physics', label: 'Physics' },
  { id: 'compute', label: 'Compute' },
  { id: 'topology', label: 'Topology' },
  { id: 'acoustics', label: 'Acoustics' },
  { id: 'saved', label: 'Saved Vault' }
];

export class AuthVault {
  constructor(options = {}) {
    this.onLoadConstruct = typeof options.onLoadConstruct === 'function' ? options.onLoadConstruct : null;
    this.onLaunchConstruct = typeof options.onLaunchConstruct === 'function' ? options.onLaunchConstruct : null;
    this.onNotify = typeof options.onNotify === 'function' ? options.onNotify : null;
    this.constructBuilder = options.constructBuilder || null;
    this.hudController = options.hudController || null;

    this.archive = Array.isArray(UNSEEN_ARCHIVE) ? UNSEEN_ARCHIVE : [];
    this.customTheories = this._loadCustomTheories();
    this.user = this._loadUser();

    this.activeDomain = 'all';
    this.searchQuery = '';
    this.isOpen = false;
    this.renderedCount = 0;
    this.pageSize = 36;
    this._legacyObserver = null;

    this._onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (this.authModalEl?.classList.contains('is-open')) {
          this.closeAuthModal();
        } else if (this.isOpen) {
          this.closeVault();
        }
      }
    };

    this._injectStyles();
    this._bindOrCreateUI();
    this._interceptLegacyVaultDrawer();
    this.renderVault(true);
  }

  _loadUser() {
    try {
      const raw = localStorage.getItem(STORAGE_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _saveUser(userObj) {
    this.user = userObj;
    try {
      if (userObj) {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj));
      } else {
        localStorage.removeItem(STORAGE_USER_KEY);
      }
    } catch {
      // Ignore storage quota restrictions
    }
    this._syncAuthUI();
  }

  _loadCustomTheories() {
    try {
      const raw = localStorage.getItem(STORAGE_VAULT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  _persistCustomTheories() {
    try {
      localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(this.customTheories));
    } catch {
      this._notify('Storage limit reached; export JSON backup.', 'error');
    }
  }

  _notify(message, type = 'info') {
    if (this.onNotify) {
      this.onNotify(message, type);
    } else if (this.hudController && typeof this.hudController.showToast === 'function') {
      this.hudController.showToast(message, type);
    }
  }

  getAllTheories() {
    return [...this.customTheories, ...this.archive];
  }

  getConstructs() {
    return this.getAllTheories();
  }

  saveConstruct(theory) {
    return this.saveTheory(theory);
  }

  addConstruct(theory) {
    return this.saveTheory(theory);
  }

  saveTheory(theory) {
    if (!theory || !theory.formula) return null;
    const entry = {
      id: theory.id || `UL-USR-${String(this.customTheories.length + 1).padStart(3, '0')}`,
      title: (theory.title || 'Untitled Custom Construct').trim(),
      author: (theory.author || (this.user ? this.user.handle : 'Anonymous Operator')).trim(),
      domain: DOMAIN_META.some((d) => d.id === theory.domain && d.id !== 'all' && d.id !== 'saved')
        ? theory.domain
        : 'compute',
      status: theory.status || 'User-synthesized parametric construct; empirical verification pending',
      formula: theory.formula.trim(),
      topology: theory.topology || 'toroidal_knot',
      params: {
        p1: Number(theory.params?.p1 ?? 3.5),
        p2: Number(theory.params?.p2 ?? 2.5),
        p3: Number(theory.params?.p3 ?? 1.6),
        p4: Number(theory.params?.p4 ?? 1.5)
      },
      summary: (theory.summary || 'Custom virtual machine synthesized inside the Unseen Logic HUD.').trim(),
      isCustom: true,
      savedAt: new Date().toISOString()
    };

    const existingIdx = this.customTheories.findIndex((item) => item.id === entry.id);
    if (existingIdx >= 0) {
      this.customTheories[existingIdx] = entry;
    } else {
      this.customTheories.unshift(entry);
    }

    this._persistCustomTheories();
    this.renderVault(true);
    this._notify(`Saved "${entry.title}" (${entry.id}) to Theory Vault`, 'success');
    return entry;
  }

  deleteCustomTheory(id) {
    const before = this.customTheories.length;
    this.customTheories = this.customTheories.filter((t) => t.id !== id);
    if (this.customTheories.length !== before) {
      this._persistCustomTheories();
      this.renderVault(true);
      this._notify(`Removed ${id} from Saved Vault`, 'info');
    }
  }

  launchEntry(entry, opts = {}) {
    if (!entry) return;

    if (this.onLoadConstruct) {
      this.onLoadConstruct(entry, { scrollToLab: opts.scrollToLab !== false });
    } else if (this.onLaunchConstruct) {
      this.onLaunchConstruct(entry);
    } else if (this.constructBuilder && typeof this.constructBuilder.applyConstructConfig === 'function') {
      this.constructBuilder.applyConstructConfig(entry);
    }

    window.dispatchEvent(
      new CustomEvent('unseen:launchConstruct', {
        detail: entry
      })
    );

    if (!opts.silent) {
      this._notify(`Loaded ${entry.id}: ${entry.title}`, 'success');
    }
    if (!opts.keepClosed) {
      this.closeVault();
    }
  }

  shareEntryURL(entry) {
    try {
      const payload = btoa(
        encodeURIComponent(
          JSON.stringify({
            id: entry.id,
            title: entry.title,
            author: entry.author,
            domain: entry.domain,
            status: entry.status,
            formula: entry.formula,
            topology: entry.topology,
            params: entry.params,
            summary: entry.summary
          })
        )
      );
      const url = `${window.location.origin}${window.location.pathname}#construct=${payload}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
      }
      window.history.replaceState(null, '', `#construct=${payload}`);
      this._notify(`Share link copied for ${entry.id}`, 'success');
    } catch {
      this._notify('Unable to encode share URL', 'error');
    }
  }

  checkUrlForSharedConstruct() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#construct=')) return null;
    try {
      const encoded = hash.slice('#construct='.length);
      const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
      if (decoded && decoded.formula) {
        this.launchEntry(decoded, { scrollToLab: true, keepClosed: true, silent: true });
        return decoded;
      }
    } catch {
      // Ignore malformed hash payloads
    }
    return null;
  }

  _checkSharedHash() {
    return this.checkUrlForSharedConstruct();
  }

  exportVaultJSON() {
    const bundle = {
      platform: 'Unseen Logic',
      architect: 'G. U. Sanjiv',
      exportedAt: new Date().toISOString(),
      totalEntries: this.getAllTheories().length,
      customEntries: this.customTheories,
      archiveEntries: this.archive
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unseen-logic-vault-${bundle.totalEntries}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this._notify(`Exported ${bundle.totalEntries} theories as JSON`, 'success');
  }

  importVaultJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result || '{}'));
        const incoming = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.customEntries)
          ? parsed.customEntries
          : Array.isArray(parsed.theories)
          ? parsed.theories
          : [];

        let imported = 0;
        incoming.forEach((item) => {
          if (item && item.formula && !this.archive.some((a) => a.id === item.id)) {
            this.saveTheory({ ...item, isCustom: true });
            imported += 1;
          }
        });
        this._notify(`Imported ${imported} custom theories into Vault`, 'success');
      } catch {
        this._notify('Invalid JSON vault bundle', 'error');
      }
    };
    reader.readAsText(file);
  }

  getFilteredEntries() {
    const q = this.searchQuery.trim().toLowerCase();
    const pool =
      this.activeDomain === 'saved'
        ? this.customTheories
        : this.activeDomain === 'all'
        ? this.getAllTheories()
        : this.getAllTheories().filter((item) => item.domain === this.activeDomain);

    if (!q) return pool;

    return pool.filter((item) => {
      return (
        (item.id && item.id.toLowerCase().includes(q)) ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.author && item.author.toLowerCase().includes(q)) ||
        (item.domain && item.domain.toLowerCase().includes(q)) ||
        (item.topology && item.topology.toLowerCase().includes(q)) ||
        (item.formula && item.formula.toLowerCase().includes(q)) ||
        (item.summary && item.summary.toLowerCase().includes(q))
      );
    });
  }

  openVaultDrawer(domain = null) {
    this.openVault(domain);
  }

  closeVaultDrawer() {
    this.closeVault();
  }

  toggleVaultDrawer() {
    this.toggleVault();
  }

  open(domain = null) {
    this.openVault(domain);
  }

  close() {
    this.closeVault();
  }

  toggle() {
    this.toggleVault();
  }

  openVault(domain = null) {
    if (domain) {
      this.activeDomain = domain;
    }
    this._hideLegacyDrawers();
    this.isOpen = true;
    if (this.overlayEl) {
      this.overlayEl.style.zIndex = '99999';
      this.overlayEl.classList.add('is-open');
      this.overlayEl.setAttribute('aria-hidden', 'false');
    }
    this.renderVault(true);
    setTimeout(() => this.searchInputEl?.focus(), 60);
  }

  closeVault() {
    this.isOpen = false;
    if (this.overlayEl) {
      this.overlayEl.classList.remove('is-open');
      this.overlayEl.setAttribute('aria-hidden', 'true');
    }
    this._hideLegacyDrawers();
  }

  toggleVault() {
    if (this.isOpen) {
      this.closeVault();
    } else {
      this.openVault();
    }
  }

  openAuthModal() {
    if (this.authModalEl) {
      this.authModalEl.style.zIndex = '100000';
      this.authModalEl.classList.add('is-open');
    }
  }

  closeAuthModal() {
    if (this.authModalEl) {
      this.authModalEl.classList.remove('is-open');
    }
  }

  _hideLegacyDrawers() {
    document.querySelectorAll('[id*="vault"], [class*="vault"]').forEach((el) => {
      if (el.closest('#ul-vault-overlay, #ul-auth-modal')) return;
      if (el.id === 'ul-vault-overlay' || el.id === 'ul-auth-modal') return;
      if (el.matches('button, a, span, svg, path, input')) return;
      if (
        el.classList.contains('open') ||
        el.classList.contains('active') ||
        el.classList.contains('is-open') ||
        el.classList.contains('visible') ||
        el.getAttribute('aria-hidden') === 'false'
      ) {
        el.classList.remove('open', 'active', 'is-open', 'visible');
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }

  _interceptLegacyVaultDrawer() {
    if (typeof MutationObserver === 'undefined') return;
    this._legacyObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const el = m.target;
        if (!(el instanceof HTMLElement)) continue;
        if (el.id === 'ul-vault-overlay' || el.id === 'ul-auth-modal') continue;
        if (el.closest('#ul-vault-overlay, #ul-auth-modal')) continue;
        if (el.matches('button, a, span, svg, path, input')) continue;

        const ident = `${el.id} ${el.className}`.toLowerCase();
        if (!ident.includes('vault')) continue;

        const opened =
          el.classList.contains('open') ||
          el.classList.contains('active') ||
          el.classList.contains('is-open') ||
          el.classList.contains('visible') ||
          el.getAttribute('aria-hidden') === 'false';

        if (opened) {
          el.classList.remove('open', 'active', 'is-open', 'visible');
          el.setAttribute('aria-hidden', 'true');
          if (!this.isOpen) {
            this.openVault();
          }
        }
      }
    });

    this._legacyObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  }

  _bindOrCreateUI() {
    document.addEventListener(
      'click',
      (e) => {
        if (e.target.closest('#ul-vault-overlay, #ul-auth-modal')) return;
        const trigger = e.target.closest('button, a, [role="button"]');
        if (!trigger) return;
        const label = `${trigger.id} ${trigger.className} ${trigger.textContent} ${trigger.getAttribute('aria-label') || ''} ${trigger.getAttribute('title') || ''}`.toLowerCase();
        if (label.includes('vault') || label.includes('archive')) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.openVault();
        }
      },
      true
    );

    let overlay = document.getElementById('ul-vault-overlay');
    if (!overlay) {
      overlay = document.createElement('aside');
      overlay.id = 'ul-vault-overlay';
      overlay.className = 'ul-vault-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = `
        <div class="ul-vault-shell">
          <header class="ul-vault-header">
            <div class="ul-vault-title-group">
              <span class="ul-vault-kicker">UNSEEN LOGIC // ARCHIVAL REPOSITORY</span>
              <h2 class="ul-vault-heading">Theory Vault <span class="ul-vault-badge" id="ul-vault-total-badge">${this.getAllTheories().length}</span></h2>
            </div>
            <div class="ul-vault-header-actions">
              <button type="button" class="ul-glass-btn" id="ul-vault-auth-btn">Operator Sign-In</button>
              <button type="button" class="ul-glass-btn" id="ul-vault-export-btn">Export JSON</button>
              <label class="ul-glass-btn ul-file-label">
                Import JSON
                <input type="file" id="ul-vault-import-input" accept=".json,application/json" hidden />
              </label>
              <button type="button" class="ul-glass-btn ul-close-btn" id="ul-vault-close-btn" aria-label="Close Vault">✕</button>
            </div>
          </header>

          <div class="ul-vault-controls">
            <div class="ul-search-wrap">
              <input
                type="search"
                id="ul-vault-search"
                class="ul-vault-search"
                placeholder="Search 205+ uncredited formulas, authors, topologies, equations..."
                autocomplete="off"
              />
              <span class="ul-search-count" id="ul-vault-match-count"></span>
            </div>
            <div class="ul-filter-pills" id="ul-vault-filters"></div>
          </div>

          <div class="ul-vault-scroll" id="ul-vault-scroll">
            <div class="ul-vault-grid" id="ul-vault-grid"></div>
            <div class="ul-vault-footer-bar">
              <button type="button" class="ul-glass-btn ul-load-more-btn" id="ul-vault-load-more">Load More Constructs</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    let authModal = document.getElementById('ul-auth-modal');
    if (!authModal) {
      authModal = document.createElement('div');
      authModal.id = 'ul-auth-modal';
      authModal.className = 'ul-auth-modal';
      authModal.innerHTML = `
        <div class="ul-auth-card">
          <div class="ul-auth-top">
            <h3>Operator Profile</h3>
            <button type="button" class="ul-glass-btn ul-close-btn" id="ul-auth-close-btn">✕</button>
          </div>
          <p class="ul-auth-sub">Sign in locally to stamp custom formulas and persist your Theory Vault across sessions.</p>
          <form id="ul-auth-form" class="ul-auth-form">
            <label>
              <span>Researcher / Operator Handle</span>
              <input type="text" id="ul-auth-handle" placeholder="e.g. G. U. Sanjiv" required />
            </label>
            <label>
              <span>Affiliation / Lab Tag (Optional)</span>
              <input type="text" id="ul-auth-org" placeholder="e.g. Unseen Logic Spatial Lab" />
            </label>
            <div class="ul-auth-actions">
              <button type="submit" class="ul-launch-btn">Activate Session</button>
              <button type="button" class="ul-glass-btn" id="ul-auth-logout-btn">Sign Out</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(authModal);
    }

    this.overlayEl = overlay;
    this.authModalEl = authModal;
    this.searchInputEl = overlay.querySelector('#ul-vault-search');
    this.filtersEl = overlay.querySelector('#ul-vault-filters');
    this.gridEl = overlay.querySelector('#ul-vault-grid');
    this.scrollEl = overlay.querySelector('#ul-vault-scroll');
    this.matchCountEl = overlay.querySelector('#ul-vault-match-count');
    this.totalBadgeEl = overlay.querySelector('#ul-vault-total-badge');
    this.loadMoreBtnEl = overlay.querySelector('#ul-vault-load-more');
    this.authBtnEl = overlay.querySelector('#ul-vault-auth-btn');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeVault();
    });
    overlay.querySelector('#ul-vault-close-btn')?.addEventListener('click', () => this.closeVault());
    overlay.querySelector('#ul-vault-export-btn')?.addEventListener('click', () => this.exportVaultJSON());
    overlay.querySelector('#ul-vault-import-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.importVaultJSON(file);
      e.target.value = '';
    });
    this.authBtnEl?.addEventListener('click', () => this.openAuthModal());

    this.searchInputEl?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value || '';
      this.renderVault(true);
    });

    this.loadMoreBtnEl?.addEventListener('click', () => {
      this.renderVault(false);
    });

    this.scrollEl?.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.scrollEl;
      if (scrollTop + clientHeight >= scrollHeight - 240) {
        this.renderVault(false);
      }
    });

    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) this.closeAuthModal();
    });
    authModal.querySelector('#ul-auth-close-btn')?.addEventListener('click', () => this.closeAuthModal());
    authModal.querySelector('#ul-auth-logout-btn')?.addEventListener('click', () => {
      this._saveUser(null);
      this.closeAuthModal();
      this._notify('Signed out of Operator session', 'info');
    });
    authModal.querySelector('#ul-auth-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const handle = authModal.querySelector('#ul-auth-handle')?.value.trim();
      const org = authModal.querySelector('#ul-auth-org')?.value.trim();
      if (!handle) return;
      this._saveUser({ handle, org, signedInAt: new Date().toISOString() });
      this.closeAuthModal();
      this._notify(`Operator active: ${handle}`, 'success');
    });

    window.addEventListener('keydown', this._onKeyDown);

    this._renderDomainPills();
    this._syncAuthUI();
  }

  _syncAuthUI() {
    if (!this.authBtnEl) return;
    if (this.user && this.user.handle) {
      this.authBtnEl.textContent = `@${this.user.handle}`;
      const handleInput = this.authModalEl?.querySelector('#ul-auth-handle');
      const orgInput = this.authModalEl?.querySelector('#ul-auth-org');
      if (handleInput) handleInput.value = this.user.handle;
      if (orgInput) orgInput.value = this.user.org || '';
    } else {
      this.authBtnEl.textContent = 'Operator Sign-In';
    }
  }

  _renderDomainPills() {
    if (!this.filtersEl) return;
    const all = this.getAllTheories();
    this.filtersEl.innerHTML = '';

    DOMAIN_META.forEach((dom) => {
      const count =
        dom.id === 'all'
          ? all.length
          : dom.id === 'saved'
          ? this.customTheories.length
          : all.filter((item) => item.domain === dom.id).length;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ul-filter-pill${this.activeDomain === dom.id ? ' is-active' : ''}`;
      btn.dataset.domain = dom.id;
      btn.textContent = `${dom.label} (${count})`;
      btn.addEventListener('click', () => {
        this.activeDomain = dom.id;
        this.renderVault(true);
      });
      this.filtersEl.appendChild(btn);
    });
  }

  renderVault(reset = true) {
    if (!this.gridEl) return;

    const all = this.getAllTheories();
    if (this.totalBadgeEl) {
      this.totalBadgeEl.textContent = String(all.length);
    }

    this._renderDomainPills();

    const filtered = this.getFilteredEntries();
    if (this.matchCountEl) {
      this.matchCountEl.textContent = `${filtered.length} of ${all.length} constructs`;
    }

    if (reset) {
      this.renderedCount = 0;
      this.gridEl.innerHTML = '';
      if (this.scrollEl) this.scrollEl.scrollTop = 0;
    }

    if (filtered.length === 0) {
      this.gridEl.innerHTML = `
        <div class="ul-vault-empty">
          <p>No unseen constructs match "${this._escapeHTML(this.searchQuery)}" in this filter.</p>
        </div>
      `;
      if (this.loadMoreBtnEl) this.loadMoreBtnEl.style.display = 'none';
      return;
    }

    const nextSlice = filtered.slice(this.renderedCount, this.renderedCount + this.pageSize);
    if (nextSlice.length === 0) {
      if (this.loadMoreBtnEl) this.loadMoreBtnEl.style.display = 'none';
      return;
    }

    const fragment = document.createDocumentFragment();

    nextSlice.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'ul-vault-card';
      card.innerHTML = `
        <div class="ul-card-top">
          <span class="ul-card-id">${this._escapeHTML(entry.id)}</span>
          <span class="ul-card-domain ul-domain-${this._escapeHTML(entry.domain)}">${this._escapeHTML(entry.domain)}</span>
        </div>
        <h3 class="ul-card-title">${this._escapeHTML(entry.title)}</h3>
        <div class="ul-card-author">${this._escapeHTML(entry.author)}</div>
        <p class="ul-card-summary">${this._escapeHTML(entry.summary)}</p>
        <div class="ul-card-status">${this._escapeHTML(entry.status)}</div>
        <code class="ul-card-formula">${this._escapeHTML(entry.formula)}</code>
        <div class="ul-card-meta">
          <span class="ul-meta-chip">${this._escapeHTML(entry.topology)}</span>
          <span class="ul-meta-chip">p1:${entry.params.p1} p2:${entry.params.p2} p3:${entry.params.p3} p4:${entry.params.p4}</span>
        </div>
        <div class="ul-card-actions">
          <button type="button" class="ul-launch-btn" data-action="launch">Launch 3D</button>
          <button type="button" class="ul-glass-btn ul-mini-btn" data-action="share">Share</button>
          ${entry.isCustom ? '<button type="button" class="ul-glass-btn ul-mini-btn ul-danger-btn" data-action="delete">Delete</button>' : ''}
        </div>
      `;

      card.querySelector('[data-action="launch"]')?.addEventListener('click', () => this.launchEntry(entry));
      card.querySelector('[data-action="share"]')?.addEventListener('click', () => this.shareEntryURL(entry));
      card.querySelector('[data-action="delete"]')?.addEventListener('click', () => this.deleteCustomTheory(entry.id));

      fragment.appendChild(card);
    });

    this.gridEl.appendChild(fragment);
    this.renderedCount += nextSlice.length;

    if (this.loadMoreBtnEl) {
      this.loadMoreBtnEl.style.display = this.renderedCount < filtered.length ? 'inline-flex' : 'none';
    }
  }

  dispose() {
    if (this._legacyObserver) {
      this._legacyObserver.disconnect();
      this._legacyObserver = null;
    }
    window.removeEventListener('keydown', this._onKeyDown);
    this.overlayEl?.remove();
    this.authModalEl?.remove();
  }

  _escapeHTML(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _injectStyles() {
    if (document.getElementById('ul-auth-vault-styles')) return;
    const style = document.createElement('style');
    style.id = 'ul-auth-vault-styles';
    style.textContent = `
      .ul-vault-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(5, 7, 13, 0.72);
        backdrop-filter: blur(28px) saturate(160%);
        -webkit-backdrop-filter: blur(28px) saturate(160%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(14px, 2.5vw, 36px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .ul-vault-overlay.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .ul-vault-shell {
        width: min(1440px, 100%);
        height: min(88vh, 960px);
        display: flex;
        flex-direction: column;
        background: linear-gradient(145deg, rgba(18, 23, 38, 0.84), rgba(10, 13, 22, 0.9));
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 24px;
        box-shadow: 0 32px 90px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.16);
        overflow: hidden;
        color: #f3f6ff;
      }
      .ul-vault-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 22px 28px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.09);
      }
      .ul-vault-kicker {
        display: block;
        font-size: 11px;
        letter-spacing: 0.18em;
        color: #7dd3fc;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .ul-vault-heading {
        margin: 0;
        font-size: clamp(20px, 2.2vw, 28px);
        font-weight: 600;
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ul-vault-badge {
        font-size: 13px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 999px;
        background: rgba(125, 211, 252, 0.16);
        border: 1px solid rgba(125, 211, 252, 0.35);
        color: #bae6fd;
      }
      .ul-vault-header-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
      }
      .ul-glass-btn {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.06);
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 500;
        padding: 8px 14px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .ul-glass-btn:hover {
        background: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.3);
        color: #ffffff;
      }
      .ul-close-btn {
        width: 36px;
        height: 36px;
        padding: 0;
        font-size: 15px;
      }
      .ul-vault-controls {
        padding: 16px 28px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(8, 11, 19, 0.35);
      }
      .ul-search-wrap {
        display: flex;
        align-items: center;
        gap: 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 14px;
        padding: 4px 16px;
      }
      .ul-search-wrap:focus-within {
        border-color: rgba(125, 211, 252, 0.55);
        box-shadow: 0 0 0 3px rgba(125, 211, 252, 0.12);
      }
      .ul-vault-search {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #f8fafc;
        font-size: 14px;
        padding: 10px 0;
      }
      .ul-search-count {
        font-size: 12px;
        color: #94a3b8;
        white-space: nowrap;
      }
      .ul-filter-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .ul-filter-pill {
        appearance: none;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 13px;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .ul-filter-pill:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
      .ul-filter-pill.is-active {
        background: rgba(56, 189, 248, 0.2);
        border-color: rgba(56, 189, 248, 0.6);
        color: #e0f2fe;
      }
      .ul-vault-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 22px 28px 32px;
      }
      .ul-vault-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
        gap: 18px;
      }
      .ul-vault-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.045);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease;
      }
      .ul-vault-card:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.075);
        border-color: rgba(125, 211, 252, 0.36);
      }
      .ul-card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .ul-card-id {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        font-weight: 600;
        color: #7dd3fc;
      }
      .ul-card-domain {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 3px 9px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
      }
      .ul-card-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #f8fafc;
        line-height: 1.3;
      }
      .ul-card-author {
        font-size: 12px;
        color: #94a3b8;
      }
      .ul-card-summary {
        margin: 0;
        font-size: 13px;
        line-height: 1.5;
        color: #cbd5e1;
      }
      .ul-card-status {
        font-size: 11.5px;
        color: #fbbf24;
        background: rgba(251, 191, 36, 0.08);
        border: 1px solid rgba(251, 191, 36, 0.22);
        padding: 6px 10px;
        border-radius: 10px;
        line-height: 1.35;
      }
      .ul-card-formula {
        display: block;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11.5px;
        color: #a5f3fc;
        background: rgba(3, 7, 18, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 8px 10px;
        border-radius: 10px;
        overflow-x: auto;
        white-space: nowrap;
      }
      .ul-card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .ul-meta-chip {
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.05);
        padding: 3px 8px;
        border-radius: 8px;
      }
      .ul-card-actions {
        margin-top: auto;
        padding-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ul-launch-btn {
        flex: 1;
        appearance: none;
        border: 1px solid rgba(56, 189, 248, 0.55);
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.35), rgba(59, 130, 246, 0.35));
        color: #f0f9ff;
        font-size: 13px;
        font-weight: 600;
        padding: 9px 14px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .ul-launch-btn:hover {
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.55), rgba(59, 130, 246, 0.55));
        box-shadow: 0 6px 20px rgba(14, 165, 233, 0.28);
      }
      .ul-mini-btn {
        padding: 9px 12px;
        font-size: 12px;
      }
      .ul-danger-btn:hover {
        border-color: rgba(248, 113, 113, 0.55);
        color: #fecaca;
      }
      .ul-vault-footer-bar {
        display: flex;
        justify-content: center;
        padding-top: 22px;
      }
      .ul-vault-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 48px 20px;
        color: #94a3b8;
      }
      .ul-auth-modal {
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: rgba(4, 6, 12, 0.76);
        backdrop-filter: blur(20px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      }
      .ul-auth-modal.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .ul-auth-card {
        width: min(440px, 100%);
        padding: 24px;
        border-radius: 22px;
        background: rgba(16, 21, 35, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.16);
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
        color: #f8fafc;
      }
      .ul-auth-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .ul-auth-top h3 {
        margin: 0;
        font-size: 19px;
      }
      .ul-auth-sub {
        margin: 0 0 18px;
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.45;
      }
      .ul-auth-form {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .ul-auth-form label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12px;
        color: #cbd5e1;
      }
      .ul-auth-form input {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 10px 12px;
        color: #ffffff;
        font-size: 14px;
        outline: none;
      }
      .ul-auth-form input:focus {
        border-color: rgba(125, 211, 252, 0.6);
      }
      .ul-auth-actions {
        display: flex;
        gap: 10px;
        margin-top: 6px;
      }
    `;
    document.head.appendChild(style);
  }
}

export default AuthVault;
