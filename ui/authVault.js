/**
 * UNSEEN LOGIC — Researcher Identity, Profile System & GitHub Pages Theory Vault
 * File 14/16: ui/authVault.js
 * Architected by G. U. Sanjiv
 */

import { FormulaParser, LAB_PRESETS } from '../engine/formulaParser.js';
import { normalizeTopology, SUPPORTED_TOPOLOGIES } from '../engine/constructBuilder.js';

const STORAGE_KEYS = Object.freeze({
  USERS_DB: 'unseen_logic_researchers_v1',
  ACTIVE_USER: 'unseen_logic_active_session_v1',
  VAULT_ITEMS: 'unseen_logic_theory_vault_v1'
});

/**
 * Curated starter constructs pre-populated in the Theory Vault so visitors
 * immediately have ready-to-launch 3D proofs and engineering templates.
 */
const STARTER_VAULT_CONSTRUCTS = [
  {
    id: 'seed-sanjiv-singularity',
    title: 'Spatial Harmonic Singularity Wave',
    domain: 'geometry',
    topology: 'spherical_harmonic',
    expression: 'sin(u * p1 + t * p2) * cos(v * p3) * p4 * 0.68',
    explanation: 'Foundational spherical harmonic resonance shell balancing azimuthal and polar wave modes across 4K space.',
    params: { p1: 3.0, p2: 1.4, p3: 2.0, p4: 1.35 },
    author: 'G. U. Sanjiv',
    createdAt: '2026-01-15T00:00:00.000Z',
    isSeed: true
  },
  {
    id: 'seed-token-budget',
    title: LAB_PRESETS.tokens.title,
    domain: LAB_PRESETS.tokens.domain,
    topology: LAB_PRESETS.tokens.topology,
    expression: LAB_PRESETS.tokens.expression,
    explanation: LAB_PRESETS.tokens.explanation,
    params: { ...LAB_PRESETS.tokens.params },
    author: 'Unseen Logic Core',
    createdAt: '2026-01-16T00:00:00.000Z',
    isSeed: true
  },
  {
    id: 'seed-orbital-slingshot',
    title: LAB_PRESETS.orbital.title,
    domain: LAB_PRESETS.orbital.domain,
    topology: LAB_PRESETS.orbital.topology,
    expression: LAB_PRESETS.orbital.expression,
    explanation: LAB_PRESETS.orbital.explanation,
    params: { ...LAB_PRESETS.orbital.params },
    author: 'Unseen Logic Core',
    createdAt: '2026-01-17T00:00:00.000Z',
    isSeed: true
  }
];

/**
 * Encodes a construct configuration object into a URL-safe Base64 string
 * supporting full Unicode mathematical symbols on static GitHub Pages URLs.
 * @param {Object} payload
 * @returns {string}
 */
export function encodeConstructSharePayload(payload) {
  const compact = {
    t: payload.title || 'Shared 3D Construct',
    d: payload.domain || 'compute',
    g: normalizeTopology(payload.topology),
    e: payload.expression || 'sin(u * p1 - t * p2) * cos(v * p3) * p4',
    x: payload.explanation || '',
    p: {
      p1: Number(payload.params?.p1 ?? 2.2),
      p2: Number(payload.params?.p2 ?? 1.2),
      p3: Number(payload.params?.p3 ?? 2.0),
      p4: Number(payload.params?.p4 ?? 1.35)
    },
    a: payload.author || 'Anonymous Thinker'
  };

  const jsonStr = JSON.stringify(compact);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 construct payload back into a normalized config object.
 * @param {string} encoded
 * @returns {Object|null}
 */
export function decodeConstructSharePayload(encoded) {
  if (!encoded || typeof encoded !== 'string') return null;
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const data = JSON.parse(jsonStr);

    if (!data || typeof data.e !== 'string') return null;
    FormulaParser.compile(data.e);

    return {
      title: String(data.t || 'Shared 3D Construct').slice(0, 72),
      domain: String(data.d || 'compute'),
      topology: normalizeTopology(data.g),
      expression: data.e,
      explanation: String(data.x || 'Loaded via shared GitHub Pages spatial link.').slice(0, 340),
      params: {
        p1: Number(data.p?.p1 ?? 2.2),
        p2: Number(data.p?.p2 ?? 1.2),
        p3: Number(data.p?.p3 ?? 2.0),
        p4: Number(data.p?.p4 ?? 1.35)
      },
      author: String(data.a || 'Shared Researcher').slice(0, 48)
    };
  } catch {
    return null;
  }
}

export class AuthVault {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.constructBuilder = options.constructBuilder || null;
    this.onLoadConstruct = typeof options.onLoadConstruct === 'function' ? options.onLoadConstruct : null;
    this.onNotify = typeof options.onNotify === 'function' ? options.onNotify : null;

    this.authMode = 'login'; // 'login' | 'register'
    this.currentUser = this.loadActiveSession();
    this.vaultItems = this.loadVaultItems();
    this.searchQuery = '';

    this.dom = {
      backdrop: document.getElementById('modal-backdrop'),
      authBtn: document.getElementById('hud-auth-btn'),
      authLabel: document.getElementById('hud-auth-label'),
      authModal: document.getElementById('auth-modal'),
      authFormView: document.getElementById('auth-form-view'),
      authProfileView: document.getElementById('auth-profile-view'),
      tabLogin: document.getElementById('auth-tab-login'),
      tabRegister: document.getElementById('auth-tab-register'),
      usernameInput: document.getElementById('auth-username-input'),
      emailInput: document.getElementById('auth-email-input'),
      roleInput: document.getElementById('auth-role-input'),
      submitAuthBtn: document.getElementById('auth-submit-btn'),
      logoutBtn: document.getElementById('auth-logout-btn'),
      avatarInitials: document.getElementById('profile-avatar-initials'),
      displayName: document.getElementById('profile-display-name'),
      displayRole: document.getElementById('profile-display-role'),

      vaultBtn: document.getElementById('hud-vault-btn'),
      vaultCount: document.getElementById('hud-vault-count'),
      vaultDrawer: document.getElementById('vault-drawer'),
      closeVaultBtn: document.getElementById('close-vault-btn'),
      vaultSearchInput: document.getElementById('vault-search-input'),
      vaultExportAllBtn: document.getElementById('vault-export-all-btn'),
      vaultImportBtn: document.getElementById('vault-import-btn'),
      vaultList: document.getElementById('vault-list'),

      saveVaultBtn: document.getElementById('lab-save-vault-btn'),
      exportJsonBtn: document.getElementById('lab-export-json-btn')
    };

    this._listeners = [];
    this.bindEvents();
    this.updateAuthUi();
    this.updateVaultBadge();
    this.renderVaultList();
  }

  /**
   * Emits a user notification toast via callback or console fallback.
   * @param {string} message
   * @param {'info'|'success'|'error'} type
   */
  notify(message, type = 'info') {
    if (this.onNotify) {
      this.onNotify(message, type);
    }
  }

  /**
   * Helper to register DOM event listeners for clean disposal.
   * @param {EventTarget} target
   * @param {string} event
   * @param {Function} handler
   */
  listen(target, event, handler) {
    if (!target) return;
    target.addEventListener(event, handler);
    this._listeners.push({ target, event, handler });
  }

  /**
   * Safely parses JSON from localStorage.
   * @param {string} key
   * @param {*} fallback
   */
  readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Safely serializes JSON to localStorage.
   * @param {string} key
   * @param {*} value
   */
  writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      this.notify('Browser storage limit reached; export your Vault JSON as backup.', 'error');
    }
  }

  /**
   * Loads active researcher profile session if signed in.
   */
  loadActiveSession() {
    const session = this.readStorage(STORAGE_KEYS.ACTIVE_USER, null);
    if (session && typeof session.username === 'string' && session.username.trim()) {
      return session;
    }
    return null;
  }

  /**
   * Loads saved Theory Vault entries or initializes with starter constructs.
   * @returns {Array<Object>}
   */
  loadVaultItems() {
    const stored = this.readStorage(STORAGE_KEYS.VAULT_ITEMS, null);
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
    const seeded = STARTER_VAULT_CONSTRUCTS.map((item) => ({ ...item }));
    this.writeStorage(STORAGE_KEYS.VAULT_ITEMS, seeded);
    return seeded;
  }

  /**
   * Persists current vault array and refreshes HUD badge + drawer list.
   */
  persistVault() {
    this.writeStorage(STORAGE_KEYS.VAULT_ITEMS, this.vaultItems);
    this.updateVaultBadge();
    this.renderVaultList();
  }

  /**
   * Binds UI event listeners for Auth Modal, Vault Drawer, Import/Export, and Lab Save.
   */
  bindEvents() {
    this.listen(this.dom.authBtn, 'click', () => this.openAuthModal());
    this.listen(this.dom.vaultBtn, 'click', () => this.openVaultDrawer());
    this.listen(this.dom.closeVaultBtn, 'click', () => this.closeVaultDrawer());

    this.listen(this.dom.tabLogin, 'click', () => this.setAuthTab('login'));
    this.listen(this.dom.tabRegister, 'click', () => this.setAuthTab('register'));
    this.listen(this.dom.submitAuthBtn, 'click', () => this.handleAuthSubmit());
    this.listen(this.dom.logoutBtn, 'click', () => this.signOut());

    // Support pressing Enter inside Auth inputs
    [this.dom.usernameInput, this.dom.emailInput, this.dom.roleInput].forEach((input) => {
      this.listen(input, 'keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAuthSubmit();
        }
      });
    });

    this.listen(this.dom.vaultSearchInput, 'input', (e) => {
      this.searchQuery = (e.target.value || '').trim().toLowerCase();
      this.renderVaultList();
    });

    this.listen(this.dom.saveVaultBtn, 'click', () => this.saveCurrentLabConstruct());
    this.listen(this.dom.exportJsonBtn, 'click', () => this.exportCurrentLabConstruct());
    this.listen(this.dom.vaultExportAllBtn, 'click', () => this.exportAllVaultConstructs());
    this.listen(this.dom.vaultImportBtn, 'click', () => this.triggerVaultImport());
  }

  /**
   * Switches between Sign In and Create Profile tabs inside the Auth Modal.
   * @param {'login'|'register'} mode
   */
  setAuthTab(mode) {
    this.authMode = mode === 'register' ? 'register' : 'login';
    if (this.dom.tabLogin) {
      this.dom.tabLogin.classList.toggle('active', this.authMode === 'login');
    }
    if (this.dom.tabRegister) {
      this.dom.tabRegister.classList.toggle('active', this.authMode === 'register');
    }
    if (this.dom.submitAuthBtn) {
      this.dom.submitAuthBtn.textContent =
        this.authMode === 'register' ? 'Create Researcher Identity' : 'Enter Spatial Lab';
    }
  }

  /**
   * Validates inputs and signs in or creates a researcher profile in localStorage.
   */
  handleAuthSubmit() {
    const rawName = (this.dom.usernameInput?.value || '').trim();
    const rawEmail = (this.dom.emailInput?.value || '').trim();
    const rawRole = (this.dom.roleInput?.value || '').trim();

    if (!rawName && !rawEmail) {
      this.notify('Please enter your Thinker Name or Research Email.', 'error');
      return;
    }

    const usersDb = this.readStorage(STORAGE_KEYS.USERS_DB, {});
    const lookupKey = (rawEmail || rawName).toLowerCase();
    const existing = usersDb[lookupKey];

    let profile;
    if (existing && this.authMode === 'login') {
      profile = {
        ...existing,
        username: rawName || existing.username,
        role: rawRole || existing.role,
        lastLoginAt: new Date().toISOString()
      };
    } else {
      const displayName = rawName || rawEmail.split('@')[0] || 'Spatial Thinker';
      profile = {
        id: `thinker-${Date.now()}`,
        username: displayName,
        email: rawEmail || `${displayName.toLowerCase().replace(/\s+/g, '.')}@unseenlogic.org`,
        role: rawRole || 'Independent Spatial Researcher',
        createdAt: existing?.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
    }

    usersDb[lookupKey] = profile;
    this.writeStorage(STORAGE_KEYS.USERS_DB, usersDb);
    this.writeStorage(STORAGE_KEYS.ACTIVE_USER, profile);

    this.currentUser = profile;
    this.updateAuthUi();
    this.closeAuthModal();
    this.notify(`Welcome to Unseen Logic, ${profile.username}.`, 'success');
  }

  /**
   * Signs out the active researcher profile while preserving saved Vault constructs.
   */
  signOut() {
    this.currentUser = null;
    try {
      window.localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    } catch {
      // Ignore storage errors
    }
    this.updateAuthUi();
    this.closeAuthModal();
    this.notify('Signed out of researcher profile.', 'info');
  }

  /**
   * Computes 2-letter avatar initials from a researcher name.
   * @param {string} name
   * @returns {string}
   */
  getInitials(name) {
    if (!name || typeof name !== 'string') return 'UL';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Synchronizes HUD sign-in button and modal profile card with active session state.
   */
  updateAuthUi() {
    const user = this.currentUser;
    if (this.dom.authLabel) {
      this.dom.authLabel.textContent = user ? user.username : 'Sign In';
    }

    if (user) {
      if (this.dom.authFormView) this.dom.authFormView.classList.add('hidden');
      if (this.dom.authProfileView) this.dom.authProfileView.classList.remove('hidden');
      if (this.dom.avatarInitials) {
        this.dom.avatarInitials.textContent = this.getInitials(user.username);
      }
      if (this.dom.displayName) {
        this.dom.displayName.textContent = user.username;
      }
      if (this.dom.displayRole) {
        this.dom.displayRole.textContent = `${user.role} • ${user.email}`;
      }
    } else {
      if (this.dom.authFormView) this.dom.authFormView.classList.remove('hidden');
      if (this.dom.authProfileView) this.dom.authProfileView.classList.add('hidden');
    }
  }

  /**
   * Updates the saved construct counter badge on the top HUD Vault icon.
   */
  updateVaultBadge() {
    if (this.dom.vaultCount) {
      this.dom.vaultCount.textContent = String(this.vaultItems.length);
    }
  }

  /**
   * Captures the active construct from `ConstructBuilder` and saves it to the Theory Vault.
   */
  saveCurrentLabConstruct() {
    if (!this.constructBuilder) return null;
    const snapshot = this.constructBuilder.getStateSnapshot();

    const entry = {
      id: `construct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: snapshot.title || 'Untitled Spatial Construct',
      domain: snapshot.domain || 'compute',
      topology: normalizeTopology(snapshot.topology),
      expression: snapshot.expression,
      explanation: snapshot.explanation || '',
      params: { ...snapshot.params },
      author: this.currentUser ? this.currentUser.username : 'Guest Thinker',
      createdAt: new Date().toISOString()
    };

    this.vaultItems.unshift(entry);
    this.persistVault();
    this.notify(`Saved "${entry.title}" to Theory Vault.`, 'success');
    return entry;
  }

  /**
   * Exports the currently active 3D construct as a standalone JSON file.
   */
  exportCurrentLabConstruct() {
    if (!this.constructBuilder) return;
    const snapshot = this.constructBuilder.getStateSnapshot();
    const payload = {
      schema: 'unseen-logic-construct-v1',
      exportedAt: new Date().toISOString(),
      author: this.currentUser ? this.currentUser.username : 'G. U. Sanjiv Platform User',
      construct: snapshot
    };
    const slug = (snapshot.title || 'construct')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.triggerJsonDownload(payload, `unseen-logic-${slug || 'formula'}.json`);
    this.notify('Exported construct configuration JSON.', 'success');
  }

  /**
   * Exports the entire Theory Vault collection as a portable JSON archive.
   */
  exportAllVaultConstructs() {
    const payload = {
      schema: 'unseen-logic-vault-bundle-v1',
      exportedAt: new Date().toISOString(),
      owner: this.currentUser ? this.currentUser.username : 'Guest Thinker',
      count: this.vaultItems.length,
      constructs: this.vaultItems
    };
    this.triggerJsonDownload(payload, `unseen-logic-vault-${Date.now()}.json`);
    this.notify(`Exported ${this.vaultItems.length} constructs from Vault.`, 'success');
  }

  /**
   * Triggers a clean browser download of a JSON payload.
   * @param {Object} data
   * @param {string} filename
   */
  triggerJsonDownload(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Opens a native file picker to import single or bundled JSON construct files into the Vault.
   */
  triggerVaultImport() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const candidates = Array.isArray(parsed?.constructs)
          ? parsed.constructs
          : parsed?.construct
            ? [parsed.construct]
            : parsed?.expression
              ? [parsed]
              : [];

        if (candidates.length === 0) {
          throw new Error('No valid construct definitions found in JSON file.');
        }

        let importedCount = 0;
        for (const item of candidates) {
          if (!item || typeof item.expression !== 'string') continue;
          try {
            FormulaParser.compile(item.expression);
            this.vaultItems.unshift({
              id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: String(item.title || 'Imported Construct').slice(0, 72),
              domain: String(item.domain || 'compute'),
              topology: normalizeTopology(item.topology),
              expression: item.expression,
              explanation: String(item.explanation || 'Imported from JSON archive.').slice(0, 340),
              params: {
                p1: Number(item.params?.p1 ?? 2.2),
                p2: Number(item.params?.p2 ?? 1.2),
                p3: Number(item.params?.p3 ?? 2.0),
                p4: Number(item.params?.p4 ?? 1.35)
              },
              author: String(item.author || 'Imported Archive'),
              createdAt: item.createdAt || new Date().toISOString()
            });
            importedCount += 1;
          } catch {
            // Skip invalid formula entries
          }
        }

        if (importedCount === 0) {
          throw new Error('All formulas in the imported file failed AST syntax validation.');
        }

        this.persistVault();
        this.notify(`Imported ${importedCount} construct(s) into Theory Vault.`, 'success');
      } catch (err) {
        this.notify(
          err instanceof Error ? err.message : 'Failed to import JSON file.',
          'error'
        );
      }
    });

    fileInput.click();
  }

  /**
   * Builds a shareable GitHub Pages URL encoding the construct in `window.location.hash`.
   * @param {Object} item
   * @returns {string}
   */
  buildShareUrl(item) {
    const encoded = encodeConstructSharePayload(item);
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return `${baseUrl}#construct=${encoded}`;
  }

  /**
   * Copies a shareable GitHub Pages link for a vault construct to the system clipboard.
   * @param {Object} item
   */
  async copyShareLink(item) {
    const shareUrl = this.buildShareUrl(item);
    try {
      window.history.replaceState(null, '', `#construct=${encodeConstructSharePayload(item)}`);
    } catch {
      // Ignore history errors in sandboxed iframes
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        this.notify('Shareable GitHub Pages 3D link copied to clipboard!', 'success');
        return shareUrl;
      } catch {
        // Fallback below
      }
    }

    this.notify('Share URL updated in browser address bar.', 'info');
    return shareUrl;
  }

  /**
   * Inspects `window.location.hash` or query string on page load to restore any shared 3D construct.
   * @returns {Object|null}
   */
  checkUrlForSharedConstruct() {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    let token = '';

    if (hash.includes('construct=')) {
      token = hash.split('construct=')[1]?.split('&')[0] || '';
    } else if (search.includes('construct=')) {
      const params = new URLSearchParams(search);
      token = params.get('construct') || '';
    }

    if (!token) return null;

    const decoded = decodeConstructSharePayload(decodeURIComponent(token));
    if (decoded && this.onLoadConstruct) {
      this.onLoadConstruct(decoded, { scrollToLab: true, source: 'shared-url' });
      this.notify(`Loaded shared construct: "${decoded.title}" by ${decoded.author}`, 'success');
    }
    return decoded;
  }

  /**
   * Loads a saved vault entry into the active 3D Formula Machine.
   * @param {string} id
   */
  loadConstructById(id) {
    const found = this.vaultItems.find((item) => item.id === id);
    if (!found) return;

    if (this.onLoadConstruct) {
      this.onLoadConstruct(found, { scrollToLab: true, source: 'vault' });
    }
    this.closeVaultDrawer();
    this.notify(`Loaded "${found.title}" into 3D Formula Machine.`, 'success');
  }

  /**
   * Deletes a saved construct from the Theory Vault by ID.
   * @param {string} id
   */
  deleteConstructById(id) {
    const before = this.vaultItems.length;
    this.vaultItems = this.vaultItems.filter((item) => item.id !== id);
    if (this.vaultItems.length !== before) {
      this.persistVault();
      this.notify('Removed construct from Theory Vault.', 'info');
    }
  }

  /**
   * Renders filtered Theory Vault cards safely using DOM element construction.
   */
  renderVaultList() {
    const container = this.dom.vaultList;
    if (!container) return;

    container.innerHTML = '';
    const query = this.searchQuery;

    const filtered = this.vaultItems.filter((item) => {
      if (!query) return true;
      return (
        (item.title || '').toLowerCase().includes(query) ||
        (item.expression || '').toLowerCase().includes(query) ||
        (item.domain || '').toLowerCase().includes(query) ||
        (item.author || '').toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'modal-note';
      emptyMsg.textContent = query
        ? 'No saved constructs match your filter.'
        : 'Your Theory Vault is empty. Compile any formula and click "Save to Vault".';
      container.appendChild(emptyMsg);
      return;
    }

    for (const item of filtered) {
      const card = document.createElement('div');
      card.className = 'vault-item';

      const header = document.createElement('div');
      header.className = 'vault-item-header';

      const titleEl = document.createElement('span');
      titleEl.className = 'vault-item-title';
      titleEl.textContent = item.title;

      const topoEl = document.createElement('span');
      topoEl.className = 'topology-tag';
      topoEl.textContent = (SUPPORTED_TOPOLOGIES[item.topology] || 'MANIFOLD').split(' ')[0];

      header.appendChild(titleEl);
      header.appendChild(topoEl);

      const metaEl = document.createElement('p');
      metaEl.className = 'modal-note';
      metaEl.textContent = `By ${item.author || 'Thinker'} • ${(item.domain || 'compute').toUpperCase()}`;

      const eqBox = document.createElement('div');
      eqBox.className = 'equation-box';
      eqBox.style.marginTop = '8px';
      eqBox.style.marginBottom = '8px';
      const codeEl = document.createElement('code');
      codeEl.textContent = item.expression;
      eqBox.appendChild(codeEl);

      const actions = document.createElement('div');
      actions.className = 'vault-item-actions';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'mini-btn accent';
      loadBtn.textContent = 'Launch 3D';
      loadBtn.addEventListener('click', () => this.loadConstructById(item.id));

      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'mini-btn';
      shareBtn.textContent = 'Share Link';
      shareBtn.addEventListener('click', () => this.copyShareLink(item));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'mini-btn';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => this.deleteConstructById(item.id));

      actions.appendChild(loadBtn);
      actions.appendChild(shareBtn);
      actions.appendChild(delBtn);

      card.appendChild(header);
      card.appendChild(metaEl);
      card.appendChild(eqBox);
      card.appendChild(actions);

      container.appendChild(card);
    }
  }

  /**
   * Opens the Researcher Identity modal.
   */
  openAuthModal() {
    this.closeVaultDrawer();
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.add('hidden');

    this.updateAuthUi();
    if (this.dom.backdrop) this.dom.backdrop.classList.remove('hidden');
    if (this.dom.authModal) this.dom.authModal.classList.remove('hidden');
  }

  /**
   * Closes the Researcher Identity modal.
   */
  closeAuthModal() {
    if (this.dom.authModal) this.dom.authModal.classList.add('hidden');
    this.syncBackdropVisibility();
  }

  /**
   * Opens the slide-over Theory Vault drawer.
   */
  openVaultDrawer() {
    this.closeAuthModal();
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.add('hidden');

    this.renderVaultList();
    if (this.dom.backdrop) this.dom.backdrop.classList.remove('hidden');
    if (this.dom.vaultDrawer) this.dom.vaultDrawer.classList.remove('hidden');
  }

  /**
   * Closes the slide-over Theory Vault drawer.
   */
  closeVaultDrawer() {
    if (this.dom.vaultDrawer) this.dom.vaultDrawer.classList.add('hidden');
    this.syncBackdropVisibility();
  }

  /**
   * Hides the modal backdrop only when all modals and drawers are closed.
   */
  syncBackdropVisibility() {
    const authOpen = this.dom.authModal && !this.dom.authModal.classList.contains('hidden');
    const vaultOpen = this.dom.vaultDrawer && !this.dom.vaultDrawer.classList.contains('hidden');
    const settingsModal = document.getElementById('settings-modal');
    const settingsOpen = settingsModal && !settingsModal.classList.contains('hidden');

    if (!authOpen && !vaultOpen && !settingsOpen && this.dom.backdrop) {
      this.dom.backdrop.classList.add('hidden');
    }
  }

  /**
   * Detaches all registered event listeners.
   */
  dispose() {
    for (const item of this._listeners) {
      item.target.removeEventListener(item.event, item.handler);
    }
    this._listeners.length = 0;
  }
}

export function createAuthVault(options = {}) {
  return new AuthVault(options);
}

export default AuthVault;
