/**
 * UNSEEN LOGIC — Interactive HUD Controller, Live Parameter Sliders & Harmonic Audio Engine
 * File 15/16: ui/hudController.js
 * Architected by G. U. Sanjiv
 */

import { LAB_PRESETS } from '../engine/formulaParser.js';
import { SUPPORTED_TOPOLOGIES } from '../engine/constructBuilder.js';

/**
 * Distinct harmonic tuning profiles mapped to each theorem chapter so visitors
 * can hear the mathematical structure of every world alongside the 4K visuals.
 */
const WORLD_HARMONIC_PROFILES = Object.freeze({
  hero: { baseFreq: 110.0, ratios: [1.0, 1.5, 2.0, 2.5], waveform: 'sine', filterCutoff: 620 },
  wessel: { baseFreq: 130.81, ratios: [1.0, 1.25, 1.5, 1.875], waveform: 'triangle', filterCutoff: 780 },
  mengoli: { baseFreq: 146.83, ratios: [1.0, 1.333, 1.667, 2.0], waveform: 'sine', filterCutoff: 840 },
  majorana: { baseFreq: 98.0, ratios: [1.0, 1.414, 1.732, 2.236], waveform: 'sine', filterCutoff: 540 },
  zhenyi: { baseFreq: 164.81, ratios: [1.0, 1.5, 2.25, 3.0], waveform: 'triangle', filterCutoff: 920 },
  peterson: { baseFreq: 123.47, ratios: [1.0, 1.189, 1.498, 2.0], waveform: 'sine', filterCutoff: 700 },
  skinner: { baseFreq: 138.59, ratios: [1.0, 1.297, 1.681, 2.181], waveform: 'triangle', filterCutoff: 880 },
  lab: { baseFreq: 116.54, ratios: [1.0, 1.5, 1.875, 2.5], waveform: 'sine', filterCutoff: 820 },
  credits: { baseFreq: 110.0, ratios: [1.0, 1.5, 2.0, 3.0], waveform: 'sine', filterCutoff: 680 }
});

/**
 * Procedural Web Audio API Harmonic Synthesizer.
 * Generates a warm, studio-filtered spatial chord whose pitch ratios and filter
 * resonance respond dynamically to live mathematical parameter sliders.
 */
class HarmonicAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.filterNode = null;
    this.oscillators = [];
    this.voiceGains = [];
    this.isEnabled = false;
    this.currentWorldId = 'hero';
  }

  /**
   * Lazily initializes the Web Audio graph inside a user gesture handler.
   */
  ensureContext() {
    if (this.ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    try {
      this.ctx = new AudioCtx();
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 680;
      this.filterNode.Q.value = 1.6;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0001;

      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      const profile = WORLD_HARMONIC_PROFILES[this.currentWorldId] || WORLD_HARMONIC_PROFILES.hero;
      profile.ratios.forEach((ratio, idx) => {
        const osc = this.ctx.createOscillator();
        const vGain = this.ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : profile.waveform;
        osc.frequency.value = profile.baseFreq * ratio;
        osc.detune.value = (idx - 1.5) * 3.5;

        vGain.gain.value = 0.16 / (idx + 1);
        osc.connect(vGain);
        vGain.connect(this.filterNode);
        osc.start();

        this.oscillators.push(osc);
        this.voiceGains.push(vGain);
      });

      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  /**
   * Toggles audio playback with smooth exponential gain ramping.
   * @returns {Promise<boolean>} New active state
   */
  async toggle() {
    if (!this.isEnabled) {
      const ready = this.ensureContext();
      if (!ready || !this.ctx) return false;

      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.11, now, 0.25);
      this.isEnabled = true;
      this.setWorldProfile(this.currentWorldId);
      return true;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.18);
    }
    this.isEnabled = false;
    return false;
  }

  /**
   * Retunes oscillator frequencies smoothly when crossing into a new theorem world.
   * @param {string} worldId
   */
  setWorldProfile(worldId) {
    this.currentWorldId = worldId || 'hero';
    if (!this.ctx || this.oscillators.length === 0) return;

    const profile = WORLD_HARMONIC_PROFILES[this.currentWorldId] || WORLD_HARMONIC_PROFILES.hero;
    const now = this.ctx.currentTime;

    this.filterNode.frequency.setTargetAtTime(profile.filterCutoff, now, 0.35);
    this.oscillators.forEach((osc, idx) => {
      const ratio = profile.ratios[idx] || 1.0;
      osc.type = idx % 2 === 0 ? 'sine' : profile.waveform;
      osc.frequency.setTargetAtTime(profile.baseFreq * ratio, now, 0.35);
    });
  }

  /**
   * Modulates harmonic overtones and filter cutoff proportionally to active slider values.
   * @param {Array<{value: number, min: number, max: number}>} schema
   */
  modulateFromParameters(schema) {
    if (!this.isEnabled || !this.ctx || !Array.isArray(schema) || schema.length === 0) return;

    const profile = WORLD_HARMONIC_PROFILES[this.currentWorldId] || WORLD_HARMONIC_PROFILES.hero;
    const now = this.ctx.currentTime;

    const norms = schema.map((item) => {
      const span = Math.max(item.max - item.min, 1e-5);
      return Math.max(0, Math.min(1, (item.value - item.min) / span));
    });

    const p0 = norms[0] ?? 0.5;
    const p1 = norms[1] ?? 0.5;

    const dynamicCutoff = profile.filterCutoff * (0.75 + p0 * 0.75);
    this.filterNode.frequency.setTargetAtTime(dynamicCutoff, now, 0.12);

    this.oscillators.forEach((osc, idx) => {
      const ratio = profile.ratios[idx] || 1.0;
      const shift = 1.0 + (norms[idx % norms.length] - 0.5) * 0.12;
      osc.frequency.setTargetAtTime(profile.baseFreq * ratio * shift, now, 0.15);
      osc.detune.setTargetAtTime((p1 - 0.5) * 14 * (idx + 1), now, 0.15);
    });
  }

  /**
   * Closes the Web Audio context and releases audio nodes.
   */
  dispose() {
    if (this.ctx) {
      try {
        this.oscillators.forEach((osc) => osc.stop());
        this.ctx.close();
      } catch {
        // Ignore already-closed context errors
      }
      this.ctx = null;
    }
    this.oscillators.length = 0;
    this.voiceGains.length = 0;
    this.isEnabled = false;
  }
}

export class HudController {
  /**
   * @param {Object} deps
   */
  constructor(deps = {}) {
    this.renderer = deps.renderer || null;
    this.scrollDirector = deps.scrollDirector || null;
    this.constructBuilder = deps.constructBuilder || null;
    this.geminiBridge = deps.geminiBridge || null;
    this.authVault = deps.authVault || null;

    this.activeWorldId = 'hero';
    this.activeWorldInstance = null;
    this.defaultParamSnapshots = new Map();
    this.docksVisible = true;
    this.isSynthesizing = false;

    this.audio = new HarmonicAudioSynthesizer();
    this._listeners = [];

    this.dom = {
      // Top HUD buttons
      telemetryToggleBtn: document.getElementById('hud-telemetry-toggle'),
      audioToggleBtn: document.getElementById('hud-audio-toggle'),
      settingsBtn: document.getElementById('hud-settings-btn'),

      // Docks & Parameter Sliders
      telemetryDock: document.getElementById('telemetry-dock'),
      parameterDock: document.getElementById('parameter-dock'),
      slidersContainer: document.getElementById('parameter-sliders-container'),
      randomizeParamsBtn: document.getElementById('randomize-params-btn'),
      resetParamsBtn: document.getElementById('reset-params-btn'),
      formulaReadout: document.getElementById('formula-readout'),

      // Settings Modal
      backdrop: document.getElementById('modal-backdrop'),
      settingsModal: document.getElementById('settings-modal'),
      apiKeyInput: document.getElementById('gemini-api-key-input'),
      modelSelect: document.getElementById('gemini-model-select'),
      renderQualitySelect: document.getElementById('render-quality-select'),
      settingsStatus: document.getElementById('settings-status'),
      clearApiKeyBtn: document.getElementById('clear-api-key-btn'),
      saveSettingsBtn: document.getElementById('save-settings-btn'),
      closeModalBtns: Array.from(document.querySelectorAll('[data-close-modal]')),

      // Autonomous Formula Lab Controls
      presetChipsContainer: document.getElementById('lab-preset-chips'),
      domainSelect: document.getElementById('lab-domain-select'),
      promptInput: document.getElementById('lab-prompt-input'),
      generateAiBtn: document.getElementById('lab-generate-ai-btn'),
      compileLocalBtn: document.getElementById('lab-compile-local-btn'),
      expressionInput: document.getElementById('lab-expression-input'),
      aiStatus: document.getElementById('lab-ai-status'),
      topologyBadge: document.getElementById('lab-topology-badge'),
      generatedTitle: document.getElementById('lab-generated-title'),
      generatedExplanation: document.getElementById('lab-generated-explanation'),
      generatedEquation: document.getElementById('lab-generated-equation'),

      // Toast Stack
      toastContainer: document.getElementById('toast-container')
    };

    this.bindEvents();
    this.syncSettingsFormFromBridge();
  }

  /**
   * Registers a DOM listener for deterministic teardown in `dispose()`.
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
   * Displays a non-intrusive glassmorphic toast notification in the top-right corner.
   * @param {string} message
   * @param {'info'|'success'|'error'} type
   * @param {number} durationMs
   */
  showToast(message, type = 'info', durationMs = 3600) {
    const container = this.dom.toastContainer;
    if (!container || !message) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Cap visible stack to 4 notifications
    while (container.children.length > 4) {
      container.removeChild(container.firstChild);
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(14px)';
      toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      setTimeout(() => {
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }
      }, 260);
    }, durationMs);
  }

  /**
   * Binds all HUD, Settings Modal, Slider Dock, and Formula Lab event handlers.
   */
  bindEvents() {
    // 1. Telemetry & Parameter Docks Toggle
    this.listen(this.dom.telemetryToggleBtn, 'click', () => this.toggleTelemetryDocks());

    // 2. Harmonic Audio Toggle
    this.listen(this.dom.audioToggleBtn, 'click', async () => {
      const enabled = await this.audio.toggle();
      if (this.dom.audioToggleBtn) {
        this.dom.audioToggleBtn.classList.toggle('active', enabled);
      }
      this.showToast(
        enabled
          ? 'Harmonic spatial audio synthesis active.'
          : 'Harmonic spatial audio muted.',
        'info',
        2400
      );
    });

    // 3. Perturb & Reset Parameter Sliders
    this.listen(this.dom.randomizeParamsBtn, 'click', () => this.perturbActiveParameters());
    this.listen(this.dom.resetParamsBtn, 'click', () => this.resetActiveParameters());

    // 4. Settings Modal Open/Close/Save/Clear
    this.listen(this.dom.settingsBtn, 'click', () => this.openSettingsModal());
    this.listen(this.dom.saveSettingsBtn, 'click', () => this.handleSaveSettings());
    this.listen(this.dom.clearApiKeyBtn, 'click', () => this.handleClearApiKey());

    this.dom.closeModalBtns.forEach((btn) => {
      this.listen(btn, 'click', () => this.closeAllModals());
    });

    this.listen(this.dom.backdrop, 'click', () => this.closeAllModals());

    this.listen(window, 'keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // 5. Autonomous Formula Lab Preset Chips
    if (this.dom.presetChipsContainer) {
      const chips = Array.from(this.dom.presetChipsContainer.querySelectorAll('.preset-chip'));
      chips.forEach((chip) => {
        this.listen(chip, 'click', () => {
          const presetKey = chip.getAttribute('data-preset');
          if (presetKey) {
            this.selectLabPreset(presetKey, chips);
          }
        });
      });
    }

    // 6. Compile Direct Formula Expression
    this.listen(this.dom.compileLocalBtn, 'click', () => this.handleCompileLocalExpression());
    this.listen(this.dom.expressionInput, 'keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleCompileLocalExpression();
      }
    });

    // 7. Synthesize Problem/Constraint via Gemini API Bridge
    this.listen(this.dom.generateAiBtn, 'click', () => this.handleGeminiSynthesis());
  }

  /**
   * Toggles visibility of the bottom-left telemetry readout and bottom-right parameter dock.
   */
  toggleTelemetryDocks() {
    this.docksVisible = !this.docksVisible;
    if (this.dom.telemetryDock) {
      this.dom.telemetryDock.classList.toggle('collapsed', !this.docksVisible);
    }
    if (this.dom.parameterDock) {
      this.dom.parameterDock.classList.toggle('collapsed', !this.docksVisible);
    }
    if (this.dom.telemetryToggleBtn) {
      this.dom.telemetryToggleBtn.classList.toggle('active', this.docksVisible);
    }
  }

  /**
   * Called whenever `ScrollDirector` transitions to a new chapter/3D world.
   * Rebuilds the live parameter sliders and updates harmonic audio tuning.
   * @param {string} worldId
   * @param {Object} chapterMeta
   * @param {Object} worldInstance
   */
  onWorldActivated(worldId, chapterMeta, worldInstance) {
    this.activeWorldId = worldId;
    this.activeWorldInstance = worldInstance;

    if (worldInstance && typeof worldInstance.getParameterSchema === 'function') {
      const schema = worldInstance.getParameterSchema();
      if (!this.defaultParamSnapshots.has(worldId)) {
        const defaults = {};
        for (const item of schema) {
          defaults[item.key] = item.value;
        }
        this.defaultParamSnapshots.set(worldId, defaults);
      }
      this.renderParameterSliders(worldInstance);
      this.audio.setWorldProfile(worldId);
      this.audio.modulateFromParameters(schema);
    } else {
      this.audio.setWorldProfile(worldId);
    }
  }

  /**
   * Builds interactive range sliders inside `#parameter-sliders-container`
   * matching the active 3D world's mathematical schema.
   * @param {Object} worldInstance
   */
  renderParameterSliders(worldInstance) {
    const container = this.dom.slidersContainer;
    if (!container || !worldInstance || typeof worldInstance.getParameterSchema !== 'function') {
      return;
    }

    const schema = worldInstance.getParameterSchema();
    container.innerHTML = '';

    for (const item of schema) {
      const row = document.createElement('div');
      row.className = 'param-row';

      const labelRow = document.createElement('div');
      labelRow.className = 'param-label-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'param-name';
      nameSpan.textContent = item.label;

      const decimals = item.step < 0.05 ? 2 : item.step < 1 ? 2 : 0;
      const valSpan = document.createElement('span');
      valSpan.className = 'param-val';
      valSpan.textContent = Number(item.value).toFixed(decimals);

      labelRow.appendChild(nameSpan);
      labelRow.appendChild(valSpan);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = String(item.min);
      slider.max = String(item.max);
      slider.step = String(item.step);
      slider.value = String(item.value);
      slider.setAttribute('aria-label', item.label);
      slider.dataset.paramKey = item.key;

      slider.addEventListener('input', () => {
        const numericVal = Number(slider.value);
        valSpan.textContent = numericVal.toFixed(decimals);

        if (typeof worldInstance.setParams === 'function') {
          worldInstance.setParams({ [item.key]: numericVal });
        } else if (worldInstance.params) {
          worldInstance.params[item.key] = numericVal;
        }

        if (typeof worldInstance.getParameterSchema === 'function') {
          this.audio.modulateFromParameters(worldInstance.getParameterSchema());
        }
      });

      row.appendChild(labelRow);
      row.appendChild(slider);
      container.appendChild(row);
    }
  }

  /**
   * Perturbs all parameters of the active 3D world smoothly within their valid bounds.
   */
  perturbActiveParameters() {
    const world = this.activeWorldInstance;
    if (!world || typeof world.getParameterSchema !== 'function') return;

    const schema = world.getParameterSchema();
    const nextParams = {};

    for (const item of schema) {
      const span = item.max - item.min;
      const jitter = (Math.random() - 0.5) * span * 0.55;
      let raw = item.value + jitter;
      if (raw < item.min) raw = item.min + Math.abs(jitter) * 0.5;
      if (raw > item.max) raw = item.max - Math.abs(jitter) * 0.5;

      const stepped = Math.round(raw / item.step) * item.step;
      const clamped = Number(Math.max(item.min, Math.min(item.max, stepped)).toFixed(4));
      nextParams[item.key] = clamped;
    }

    if (typeof world.setParams === 'function') {
      world.setParams(nextParams);
    }
    this.renderParameterSliders(world);
    this.audio.modulateFromParameters(world.getParameterSchema());
  }

  /**
   * Restores the active 3D world's parameters to their initial default values.
   */
  resetActiveParameters() {
    const world = this.activeWorldInstance;
    if (!world) return;

    const defaults = this.defaultParamSnapshots.get(this.activeWorldId);
    if (defaults && typeof world.setParams === 'function') {
      world.setParams({ ...defaults });
      this.renderParameterSliders(world);
      if (typeof world.getParameterSchema === 'function') {
        this.audio.modulateFromParameters(world.getParameterSchema());
      }
      this.showToast('Parameters restored to canonical baseline.', 'info', 2000);
    }
  }

  /**
   * Loads a curated preset into the Autonomous Formula Machine and updates all UI controls.
   * @param {string} presetKey
   * @param {Array<HTMLElement>} chips
   */
  selectLabPreset(presetKey, chips = []) {
    const preset = LAB_PRESETS[presetKey];
    if (!preset || !this.constructBuilder) return;

    chips.forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute('data-preset') === presetKey);
    });

    if (this.dom.domainSelect && preset.domain) {
      this.dom.domainSelect.value = preset.domain;
    }
    if (this.dom.promptInput && preset.prompt) {
      this.dom.promptInput.value = preset.prompt;
    }

    const res = this.constructBuilder.applyConstructConfig(preset);
    if (res.ok) {
      this.applyConstructToLabUi(preset);
      this.setLabStatus(`Loaded preset: ${preset.title}`, false);
    }
  }

  /**
   * Compiles the direct mathematical expression typed in `#lab-expression-input`.
   */
  handleCompileLocalExpression() {
    if (!this.constructBuilder || !this.dom.expressionInput) return;

    const expr = (this.dom.expressionInput.value || '').trim();
    if (!expr) {
      this.setLabStatus('Enter a mathematical expression f(u, v, t) to compile.', true);
      return;
    }

    const result = this.constructBuilder.setFormula(expr, {
      title: this.dom.generatedTitle?.textContent || 'Custom Parametric Construct',
      domain: this.dom.domainSelect?.value || 'compute'
    });

    if (!result.ok) {
      this.setLabStatus(`Syntax Error: ${result.error}`, true);
      this.showToast(result.error, 'error');
      return;
    }

    const formulaText = `f(u, v, t) = ${expr}`;
    if (this.dom.generatedEquation) {
      this.dom.generatedEquation.textContent = formulaText;
    }
    if (this.dom.formulaReadout && this.activeWorldId === 'lab') {
      this.dom.formulaReadout.textContent = formulaText;
    }

    this.setLabStatus('Compiled AST expression into 16,384-node 3D construct.', false);
    this.showToast('3D construct compiled successfully.', 'success', 2400);
  }

  /**
   * Sends the user's real-world problem or constraint through `GeminiBridge`
   * and builds the resulting autonomous 3D construct.
   */
  async handleGeminiSynthesis() {
    if (!this.geminiBridge || !this.constructBuilder || this.isSynthesizing) return;

    const promptText = (this.dom.promptInput?.value || '').trim();
    const domain = this.dom.domainSelect?.value || 'compute';

    if (!promptText) {
      this.setLabStatus('Describe a constraint or idea in the prompt box first.', true);
      this.showToast('Please enter a problem description or idea first.', 'error');
      return;
    }

    this.isSynthesizing = true;
    const btn = this.dom.generateAiBtn;
    const originalLabel = btn ? btn.textContent : 'Synthesize with Gemini API';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Synthesizing 3D Proof...';
    }
    this.setLabStatus('Synthesizing mathematical construct...', false);

    try {
      const config = await this.geminiBridge.synthesizeConstruct(promptText, domain);
      const compileRes = this.constructBuilder.applyConstructConfig(config);

      if (!compileRes.ok) {
        throw new Error(compileRes.error || 'Compiled construct failed validation.');
      }

      this.applyConstructToLabUi(config);
      this.setLabStatus(config.notice || 'Synthesized autonomous 3D construct.', false);
      this.showToast(`Synthesized: ${config.title}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Synthesis failed.';
      this.setLabStatus(msg, true);
      this.showToast(msg, 'error');
    } finally {
      this.isSynthesizing = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    }
  }

  /**
   * Synchronizes a construct configuration object across all Formula Lab UI readouts
   * and updates the bottom-right parameter sliders.
   * @param {Object} config
   */
  applyConstructToLabUi(config = {}) {
    if (this.dom.expressionInput && config.expression) {
      this.dom.expressionInput.value = config.expression;
    }
    if (this.dom.generatedTitle && config.title) {
      this.dom.generatedTitle.textContent = config.title;
    }
    if (this.dom.generatedExplanation && config.explanation) {
      this.dom.generatedExplanation.textContent = config.explanation;
    }
    if (this.dom.generatedEquation && config.expression) {
      this.dom.generatedEquation.textContent = `f(u, v, t) = ${config.expression}`;
    }
    if (this.dom.topologyBadge && config.topology) {
      const label = SUPPORTED_TOPOLOGIES[config.topology] || 'PARAMETRIC MANIFOLD';
      this.dom.topologyBadge.textContent = `TOPOLOGY: ${label}`;
    }
    if (this.dom.formulaReadout && config.expression && this.activeWorldId === 'lab') {
      this.dom.formulaReadout.textContent = `f(u, v, t) = ${config.expression}`;
    }

    if (this.activeWorldId === 'lab' && this.constructBuilder) {
      this.renderParameterSliders(this.constructBuilder);
    }
  }

  /**
   * Updates the status readout line inside the Formula Lab panel.
   * @param {string} message
   * @param {boolean} isError
   */
  setLabStatus(message, isError = false) {
    const el = this.dom.aiStatus;
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? 'var(--accent-crimson)' : 'var(--accent-emerald)';
  }

  /**
   * Populates Settings Modal inputs from `GeminiBridge` stored state.
   */
  syncSettingsFormFromBridge() {
    if (!this.geminiBridge) return;
    const cfg = this.geminiBridge.getConfig();

    if (this.dom.apiKeyInput) {
      this.dom.apiKeyInput.value = '';
      this.dom.apiKeyInput.placeholder = cfg.hasKey
        ? `Saved Key (${cfg.maskedKey}) — enter new key to replace`
        : 'AIzaSy...';
    }
    if (this.dom.modelSelect) {
      this.dom.modelSelect.value = cfg.model;
    }
    if (this.dom.renderQualitySelect) {
      this.dom.renderQualitySelect.value = String(cfg.renderQuality);
    }
    if (this.dom.settingsStatus) {
      this.dom.settingsStatus.textContent = cfg.hasKey
        ? `Active key configured (${cfg.maskedKey}) • Model: ${cfg.model}`
        : 'No API key saved yet — local AST synthesizer active.';
      this.dom.settingsStatus.style.color = cfg.hasKey
        ? 'var(--accent-emerald)'
        : 'var(--text-secondary)';
    }
  }

  /**
   * Opens the Settings Modal and closes any other open drawers/modals.
   */
  openSettingsModal() {
    if (this.authVault) {
      this.authVault.closeAuthModal();
      this.authVault.closeVaultDrawer();
    }
    this.syncSettingsFormFromBridge();
    if (this.dom.backdrop) this.dom.backdrop.classList.remove('hidden');
    if (this.dom.settingsModal) this.dom.settingsModal.classList.remove('hidden');
  }

  /**
   * Closes the Settings Modal and restores backdrop state.
   */
  closeSettingsModal() {
    if (this.dom.settingsModal) this.dom.settingsModal.classList.add('hidden');
    if (this.authVault) {
      this.authVault.syncBackdropVisibility();
    } else if (this.dom.backdrop) {
      this.dom.backdrop.classList.add('hidden');
    }
  }

  /**
   * Closes all modals and drawers across the entire application.
   */
  closeAllModals() {
    if (this.dom.settingsModal) this.dom.settingsModal.classList.add('hidden');
    if (this.authVault) {
      this.authVault.closeAuthModal();
      this.authVault.closeVaultDrawer();
    }
    if (this.dom.backdrop) {
      this.dom.backdrop.classList.add('hidden');
    }
  }

  /**
   * Persists API key, model selection, and 4K DPR clarity from the Settings Modal.
   */
  handleSaveSettings() {
    if (!this.geminiBridge) return;

    const typedKey = (this.dom.apiKeyInput?.value || '').trim();
    if (typedKey) {
      this.geminiBridge.setApiKey(typedKey);
    }

    if (this.dom.modelSelect) {
      this.geminiBridge.setModel(this.dom.modelSelect.value);
    }

    if (this.dom.renderQualitySelect) {
      const q = Number(this.dom.renderQualitySelect.value);
      this.geminiBridge.setRenderQuality(q);
      if (this.renderer && typeof this.renderer.setQuality === 'function') {
        this.renderer.setQuality(q);
      }
    }

    this.syncSettingsFormFromBridge();
    this.closeSettingsModal();
    this.showToast('Engine & Gemini API configuration saved.', 'success');
  }

  /**
   * Removes the stored Gemini API key from localStorage.
   */
  handleClearApiKey() {
    if (!this.geminiBridge) return;
    this.geminiBridge.clearApiKey();
    this.syncSettingsFormFromBridge();
    this.showToast('Gemini API key removed from browser storage.', 'info');
  }

  /**
   * Detaches all DOM event listeners and disposes the Web Audio synthesizer.
   */
  dispose() {
    for (const item of this._listeners) {
      item.target.removeEventListener(item.event, item.handler);
    }
    this._listeners.length = 0;
    this.audio.dispose();
  }
}

export function createHudController(deps = {}) {
  return new HudController(deps);
}

export default HudController;
