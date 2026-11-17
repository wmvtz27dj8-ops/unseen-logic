/**
 * UNSEEN LOGIC — Master Application Entry Point & Spatial Orchestrator
 * File 16/16: main.js
 * Concept, Vision & System Architecture by G. U. Sanjiv
 */

import * as THREE from 'three';
import { SpatialRenderer } from './core/renderer.js';
import { ScrollDirector, CHAPTER_ORDER, CHAPTER_MANIFEST } from './core/scrollDirector.js';
import { WesselPlaneWorld } from './worlds/wesselPlane.js';
import { MengoliSpiralWorld } from './worlds/mengoliSpiral.js';
import { MajoranaCloudWorld } from './worlds/majoranaCloud.js';
import { ZhenyiEclipseWorld } from './worlds/zhenyiEclipse.js';
import { PetersonSurfaceWorld } from './worlds/petersonSurface.js';
import { SkinnerLatticeWorld } from './worlds/skinnerLattice.js';
import { LAB_PRESETS } from './engine/formulaParser.js';
import { ConstructBuilder } from './engine/constructBuilder.js';
import { GeminiBridge } from './engine/geminiBridge.js';
import { AuthVault } from './ui/authVault.js';
import { HudController } from './ui/hudController.js';

export const CREATOR_ATTRIBUTION = Object.freeze({
  name: 'G. U. Sanjiv',
  platform: 'UNSEEN LOGIC',
  version: '1.0.0-4K',
  manifesto:
    'Conceived and architected so that no human insight, unfinished theorem, or self-taught breakthrough ever vanishes unseen again. Every visitor holds the power to turn raw intuition into living 3D proof.'
});

const KEYBOARD_CHAPTER_MAP = Object.freeze({
  Digit0: 'hero',
  Digit1: 'wessel',
  Digit2: 'mengoli',
  Digit3: 'majorana',
  Digit4: 'zhenyi',
  Digit5: 'peterson',
  Digit6: 'skinner',
  Digit7: 'lab',
  Digit8: 'credits'
});

class UnseenLogicApp {
  constructor() {
    this.isBooted = false;
    this.isDisposed = false;
    this.rafId = null;
    this.clock = new THREE.Clock();

    this.renderer = null;
    this.scrollDirector = null;
    this.constructBuilder = null;
    this.geminiBridge = null;
    this.authVault = null;
    this.hudController = null;

    this.theoremWorlds = new Map();
    this.allWorlds = [];
    this._listeners = [];
    this._creatorObserver = null;

    this.bootDom = {
      loader: document.getElementById('boot-loader'),
      statusText: document.getElementById('boot-status-text'),
      progressBar: document.getElementById('boot-progress-bar')
    };

    this._animateBound = this.animate.bind(this);
  }

  /**
   * Registers a DOM or Window listener for deterministic cleanup on disposal.
   * @param {EventTarget} target
   * @param {string} event
   * @param {Function} handler
   * @param {Object|boolean} [options]
   */
  listen(target, event, handler, options) {
    if (!target) return;
    target.addEventListener(event, handler, options);
    this._listeners.push({ target, event, handler, options });
  }

  /**
   * Updates the boot preloader progress bar and status message.
   * @param {number} percent
   * @param {string} message
   */
  setBootProgress(percent, message) {
    if (this.bootDom.progressBar) {
      const clamped = Math.max(0, Math.min(100, percent));
      this.bootDom.progressBar.style.width = `${clamped}%`;
    }
    if (this.bootDom.statusText && message) {
      this.bootDom.statusText.textContent = message;
    }
  }

  /**
   * Smoothly dismisses the boot preloader overlay once frame 0 is rendered.
   */
  dismissBootLoader() {
    this.setBootProgress(100, '4K Spatial Engine Online — Architected by G. U. Sanjiv');
    const loader = this.bootDom.loader;
    if (!loader) return;

    requestAnimationFrame(() => {
      setTimeout(() => {
        loader.classList.add('fade-out');
        setTimeout(() => {
          loader.style.display = 'none';
        }, 800);
      }, 180);
    });
  }

  /**
   * Yields a single animation frame during initialization so progress UI repaints smoothly.
   */
  nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  /**
   * Initializes all core subsystems, 3D theorem worlds, autonomous formula engine,
   * Gemini API bridge, Theory Vault, HUD controllers, and creator attribution.
   */
  async init() {
    try {
      this.setBootProgress(12, 'Loading Gemini Bridge & 4K Render Preferences...');
      await this.nextFrame();

      this.geminiBridge = new GeminiBridge();
      const savedConfig = this.geminiBridge.getConfig();

      const canvas = document.getElementById('spatial-canvas');
      if (!canvas) {
        throw new Error('Missing #spatial-canvas element in index.html.');
      }

      this.setBootProgress(26, 'Initializing 4K HDR WebGL & Spatial Upscaling Pipeline...');
      await this.nextFrame();

      this.renderer = new SpatialRenderer(canvas, {
        maxDpr: savedConfig.renderQuality || 2.0,
        autoScaleDpr: true
      });

      this.setBootProgress(40, 'Calibrating Scroll-Driven Camera Choreography...');
      await this.nextFrame();

      this.scrollDirector = new ScrollDirector(this.renderer, {
        onWorldChange: (worldId, chapterMeta, worldInstance) => {
          if (this.hudController) {
            this.hudController.onWorldActivated(worldId, chapterMeta, worldInstance);
          }
          if (worldId === 'credits') {
            this.highlightCreatorAttribution();
          }
        }
      });

      this.setBootProgress(56, 'Reconstructing 6 Overlooked Mathematical & Physical Worlds...');
      await this.nextFrame();

      this.buildAndRegisterWorlds();

      this.setBootProgress(74, 'Compiling Autonomous 16,384-Node Formula Machine...');
      await this.nextFrame();

      this.constructBuilder = new ConstructBuilder({
        onMetricsChange: () => {
          // Metrics DOM elements are synced directly by ConstructBuilder
        }
      });
      this.scrollDirector.registerWorld('lab', this.constructBuilder);
      this.allWorlds.push(this.constructBuilder);

      this.setBootProgress(86, 'Connecting Theory Vault, Researcher Identity & HUD...');
      await this.nextFrame();

      this.authVault = new AuthVault({
        constructBuilder: this.constructBuilder,
        onLoadConstruct: (constructConfig, opts = {}) => {
          this.handleExternalConstructLoad(constructConfig, opts);
        },
        onNotify: (message, type) => {
          if (this.hudController) {
            this.hudController.showToast(message, type);
          }
        }
      });

      this.hudController = new HudController({
        renderer: this.renderer,
        scrollDirector: this.scrollDirector,
        constructBuilder: this.constructBuilder,
        geminiBridge: this.geminiBridge,
        authVault: this.authVault
      });

      // Ensure active world parameter sliders reflect the initial scroll chapter
      const initialWorldId = this.scrollDirector.getActiveWorldId();
      const initialWorld = this.scrollDirector.getActiveWorld();
      this.hudController.onWorldActivated(
        initialWorldId,
        CHAPTER_MANIFEST[initialWorldId],
        initialWorld
      );

      this.setBootProgress(94, 'Verifying Shared Links & Creator Attribution...');
      this.ensureCreatorAttributionIntegrity();
      this.setupCreatorRevealObserver();
      this.bindGlobalEvents();

      // Check if visitor arrived via a shared GitHub Pages construct link (#construct=...)
      const sharedConstruct = this.authVault.checkUrlForSharedConstruct();
      if (!sharedConstruct) {
        this.hudController.applyConstructToLabUi(LAB_PRESETS.tokens);
      }

      // Measure final layout metrics and render initial 4K frame synchronously
      this.scrollDirector.measureSections();
      this.scrollDirector.evaluateScroll(true);
      this.renderer.render(0, 0.016);

      this.isBooted = true;
      this.clock.start();
      this.rafId = requestAnimationFrame(this._animateBound);
      this.dismissBootLoader();
    } catch (error) {
      this.handleFatalBootError(error);
    }
  }

  /**
   * Instantiates all 6 historical theorem simulations and registers them with ScrollDirector.
   */
  buildAndRegisterWorlds() {
    const worldFactories = [
      ['wessel', () => new WesselPlaneWorld()],
      ['mengoli', () => new MengoliSpiralWorld()],
      ['majorana', () => new MajoranaCloudWorld()],
      ['zhenyi', () => new ZhenyiEclipseWorld()],
      ['peterson', () => new PetersonSurfaceWorld()],
      ['skinner', () => new SkinnerLatticeWorld()]
    ];

    for (const [id, factory] of worldFactories) {
      const instance = factory();
      this.theoremWorlds.set(id, instance);
      this.allWorlds.push(instance);
      this.scrollDirector.registerWorld(id, instance);
    }
  }

  /**
   * Applies a construct loaded from the Theory Vault or a shared URL hash
   * into the Autonomous Formula Machine and synchronizes all HUD panels.
   * @param {Object} constructConfig
   * @param {Object} options
   */
  handleExternalConstructLoad(constructConfig, options = {}) {
    if (!constructConfig || !this.constructBuilder) return;

    const result = this.constructBuilder.applyConstructConfig(constructConfig);
    if (!result.ok) {
      if (this.hudController) {
        this.hudController.showToast(
          result.error || 'Unable to compile shared construct formula.',
          'error'
        );
      }
      return;
    }

    if (this.hudController) {
      this.hudController.applyConstructToLabUi(constructConfig);
      if (constructConfig.domain && this.hudController.dom.domainSelect) {
        this.hudController.dom.domainSelect.value = constructConfig.domain;
      }
    }

    if (options.scrollToLab && this.scrollDirector) {
      this.scrollDirector.scrollToWorld('lab');
    }
  }

  /**
   * Guarantees creator attribution for G. U. Sanjiv is cleanly populated in the DOM.
   */
  ensureCreatorAttributionIntegrity() {
    const nameEl = document.getElementById('creator-name');
    if (nameEl && !nameEl.textContent.trim()) {
      nameEl.textContent = CREATOR_ATTRIBUTION.name;
    }

    const manifestoEl = document.getElementById('creator-manifesto');
    if (manifestoEl && !manifestoEl.textContent.trim()) {
      manifestoEl.textContent = CREATOR_ATTRIBUTION.manifesto;
    }
  }

  /**
   * Configures an IntersectionObserver for smooth scroll-reveal animation of the
   * creator monolith honoring G. U. Sanjiv.
   */
  setupCreatorRevealObserver() {
    const monolith = document.getElementById('creator-monolith');
    if (!monolith || typeof IntersectionObserver === 'undefined') return;

    this._creatorObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            monolith.classList.add('revealed');
          }
        }
      },
      { threshold: 0.25 }
    );

    this._creatorObserver.observe(monolith);
  }

  /**
   * Triggers visual emphasis on the creator attribution monolith when entering Chapter 08.
   */
  highlightCreatorAttribution() {
    const monolith = document.getElementById('creator-monolith');
    if (monolith) {
      monolith.classList.add('revealed');
    }
  }

  /**
   * Binds global keyboard navigation, visibility lifecycle, hashchange, and WebGL context events.
   */
  bindGlobalEvents() {
    // 1. Pause delta-time accumulation when browser tab is backgrounded
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.clock.stop();
      } else if (!this.isDisposed) {
        this.clock.start();
        this.clock.getDelta();
      }
    });

    // 2. React to hash changes if user pastes a #construct=... URL while already on the page
    this.listen(window, 'hashchange', () => {
      if (this.authVault) {
        this.authVault.checkUrlForSharedConstruct();
      }
    });

    // 3. Re-measure scroll sections after fonts and layout settle
    this.listen(window, 'load', () => {
      if (this.scrollDirector) {
        this.scrollDirector.measureSections();
        this.scrollDirector.evaluateScroll(false);
      }
    });

    // 4. WebGL Context Loss & Restoration handlers
    const canvas = this.renderer?.canvas;
    if (canvas) {
      this.listen(canvas, 'webglcontextlost', (e) => {
        e.preventDefault();
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        if (this.hudController) {
          this.hudController.showToast(
            'GPU spatial context paused — awaiting restoration...',
            'error',
            5000
          );
        }
      });

      this.listen(canvas, 'webglcontextrestored', () => {
        if (this.renderer) {
          this.renderer.resize();
        }
        if (!this.isDisposed && this.rafId === null) {
          this.clock.start();
          this.rafId = requestAnimationFrame(this._animateBound);
        }
        if (this.hudController) {
          this.hudController.showToast('4K Spatial GPU context restored.', 'success');
        }
      });
    }

    // 5. Power-user spatial keyboard shortcuts (ignored when typing inside form controls)
    this.listen(window, 'keydown', (e) => {
      const target = e.target;
      const tag = target && target.tagName ? target.tagName.toUpperCase() : '';
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (target && target.isContentEditable) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      // Digit keys 0..8 jump directly to spatial chapters
      const mappedChapter = KEYBOARD_CHAPTER_MAP[e.code];
      if (mappedChapter && this.scrollDirector) {
        e.preventDefault();
        this.scrollDirector.scrollToWorld(mappedChapter);
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'h':
          if (this.hudController) {
            this.hudController.toggleTelemetryDocks();
          }
          break;
        case 'r':
          if (this.hudController) {
            this.hudController.resetActiveParameters();
          }
          break;
        case 'v':
          if (this.authVault) {
            this.authVault.openVaultDrawer();
          }
          break;
        case 'm':
          if (this.hudController?.dom?.audioToggleBtn) {
            this.hudController.dom.audioToggleBtn.click();
          }
          break;
        default:
          break;
      }
    });
  }

  /**
   * Main 60/120Hz spatial render loop.
   */
  animate() {
    if (this.isDisposed) return;

    this.rafId = requestAnimationFrame(this._animateBound);

    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.elapsedTime;

    if (this.scrollDirector) {
      this.scrollDirector.update(elapsedTime, deltaTime);
    }

    if (this.renderer) {
      this.renderer.render(elapsedTime, deltaTime);
    }
  }

  /**
   * Displays a graceful diagnostic message inside the boot screen if WebGL is unavailable.
   * @param {unknown} error
   */
  handleFatalBootError(error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to initialize WebGL 4K spatial context.';
    this.setBootProgress(100, `Spatial Engine Notice: ${message}`);
    if (this.bootDom.progressBar) {
      this.bootDom.progressBar.style.background = '#ff453a';
    }
  }

  /**
   * Returns a read-only runtime state snapshot for diagnostics and inspection.
   */
  getRuntimeState() {
    return {
      creator: CREATOR_ATTRIBUTION.name,
      version: CREATOR_ATTRIBUTION.version,
      activeChapter: this.scrollDirector ? this.scrollDirector.getActiveWorldId() : 'hero',
      chapters: [...CHAPTER_ORDER],
      fps: this.renderer?.stats?.fps ?? 0,
      drawCalls: this.renderer?.stats?.drawCalls ?? 0,
      activeConstruct: this.constructBuilder ? this.constructBuilder.getStateSnapshot() : null
    };
  }

  /**
   * Deterministically tears down all animation frames, listeners, worlds, and GPU buffers.
   */
  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this._creatorObserver) {
      this._creatorObserver.disconnect();
      this._creatorObserver = null;
    }

    for (const item of this._listeners) {
      item.target.removeEventListener(item.event, item.handler, item.options);
    }
    this._listeners.length = 0;

    if (this.hudController) {
      this.hudController.dispose();
    }
    if (this.authVault) {
      this.authVault.dispose();
    }
    if (this.geminiBridge) {
      this.geminiBridge.abortPendingRequest();
    }

    for (const world of this.allWorlds) {
      if (world && typeof world.dispose === 'function') {
        world.dispose();
      }
    }
    this.allWorlds.length = 0;
    this.theoremWorlds.clear();

    if (this.scrollDirector) {
      this.scrollDirector.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

const app = new UnseenLogicApp();

window.UNSEEN_LOGIC = Object.freeze({
  creator: CREATOR_ATTRIBUTION.name,
  getState: () => app.getRuntimeState(),
  scrollTo: (chapterId) => app.scrollDirector?.scrollToWorld(chapterId),
  loadPreset: (presetKey) => app.hudController?.selectLabPreset(presetKey),
  optimizeConstruct: () => app.constructBuilder?.optimizeConstraints(),
  dispose: () => app.dispose()
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init(), { once: true });
} else {
  app.init();
}

export default app;
