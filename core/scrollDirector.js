/**
 * UNSEEN LOGIC — Scroll-Driven 3D Camera Choreography & Scene Lifecycle Director
 * File 4/16: core/scrollDirector.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'three';

/**
 * Canonical spatial keyframes, optical framing, and metadata for each chapter.
 * Camera X offsets counterbalance left/right glassmorphic cards so 3D constructs
 * always sit cleanly in the unobstructed half of the 4K viewport.
 */
export const CHAPTER_MANIFEST = {
  hero: {
    id: 'hero',
    sectionId: 'section-hero',
    title: 'Spatial Singularity',
    year: 'ARCHIVE // 00',
    formula: 'Ψ(x, t) = ∫ Φ(k) · e^(i(k·x - ωt)) dk',
    cameraPos: [0.0, 0.4, 13.5],
    lookAt: [0.0, 0.0, 0.0],
    fov: 46,
    bloom: { strength: 0.56, radius: 0.72, threshold: 0.76 },
    navGroup: 'hero'
  },
  wessel: {
    id: 'wessel',
    sectionId: 'section-wessel',
    title: 'Caspar Wessel — Geometric Complex Rotors',
    year: '1799 // ARCHIVE 01',
    formula: '(cos α + ε sin α)(cos β + ε sin β) = cos(α + β) + ε sin(α + β)',
    cameraPos: [-2.45, 0.65, 10.6],
    lookAt: [-2.15, 0.0, 0.0],
    fov: 45,
    bloom: { strength: 0.50, radius: 0.65, threshold: 0.78 },
    navGroup: 'wessel'
  },
  mengoli: {
    id: 'mengoli',
    sectionId: 'section-mengoli',
    title: 'Pietro Mengoli — Alternating Harmonic Quadratures',
    year: '1650 // ARCHIVE 02',
    formula: '∑ (-1)^(n+1) / n = 1 - 1/2 + 1/3 - 1/4 + ... = ln(2)',
    cameraPos: [2.45, 0.85, 11.2],
    lookAt: [2.15, -0.1, 0.0],
    fov: 45,
    bloom: { strength: 0.54, radius: 0.68, threshold: 0.76 },
    navGroup: 'wessel'
  },
  majorana: {
    id: 'majorana',
    sectionId: 'section-majorana',
    title: 'Ettore Majorana — Volumetti Spinor Vortices',
    year: '1932 // ARCHIVE 03',
    formula: 'i γ^μ ∂_μ ψ - m ψ = 0 ,   ψ = ψ^c',
    cameraPos: [-2.4, 0.45, 10.2],
    lookAt: [-2.1, 0.0, 0.0],
    fov: 46,
    bloom: { strength: 0.62, radius: 0.75, threshold: 0.72 },
    navGroup: 'wessel'
  },
  zhenyi: {
    id: 'zhenyi',
    sectionId: 'section-zhenyi',
    title: 'Wang Zhenyi — Celestial Umbral Trigonometry',
    year: '1792 // ARCHIVE 04',
    formula: 'sin(δ) = sin(ε) · sin(λ) ,   R_umbra = R_e - d · tan(θ_s)',
    cameraPos: [2.5, 0.95, 11.8],
    lookAt: [2.1, 0.0, 0.0],
    fov: 44,
    bloom: { strength: 0.52, radius: 0.66, threshold: 0.78 },
    navGroup: 'wessel'
  },
  peterson: {
    id: 'peterson',
    sectionId: 'section-peterson',
    title: 'Karl Peterson — Intrinsic Surface Curvature',
    year: '1853 // ARCHIVE 05',
    formula: '∂L/∂v - ∂M/∂u = L Γ¹₁₂ + M(Γ²₁₂ - Γ¹₁₁) - N Γ²₁₁',
    cameraPos: [-2.45, 1.15, 10.8],
    lookAt: [-2.1, -0.1, 0.0],
    fov: 45,
    bloom: { strength: 0.48, radius: 0.62, threshold: 0.80 },
    navGroup: 'wessel'
  },
  skinner: {
    id: 'skinner',
    sectionId: 'section-skinner',
    title: 'Francis Skinner — Modular Prime-Residue Lattice',
    year: '1935 // ARCHIVE 06',
    formula: 'a^(p-1) ≡ 1 (mod p) ,   Φ_p(k) = exp(2πi · a^k / p)',
    cameraPos: [2.4, 0.35, 10.6],
    lookAt: [2.1, 0.0, 0.0],
    fov: 45,
    bloom: { strength: 0.58, radius: 0.70, threshold: 0.75 },
    navGroup: 'wessel'
  },
  lab: {
    id: 'lab',
    sectionId: 'section-lab',
    title: 'Autonomous Formula & 3D Construct Machine',
    year: 'LIVE ENGINE // 07',
    formula: 'f(u, v, t) = sin(u · p1 - t · p2) · cos(v · p3) · p4',
    cameraPos: [0.0, 1.65, 13.8],
    lookAt: [0.0, -0.45, 0.0],
    fov: 48,
    bloom: { strength: 0.60, radius: 0.72, threshold: 0.74 },
    navGroup: 'lab'
  },
  credits: {
    id: 'credits',
    sectionId: 'section-credits',
    title: 'Architected by G. U. Sanjiv',
    year: 'ATTRIBUTION // 08',
    formula: '∀ Idea ∈ Humanity : Lim(Obscurity → 0) = LivingProof(3D)',
    cameraPos: [0.0, 0.25, 15.2],
    lookAt: [0.0, 0.0, 0.0],
    fov: 46,
    bloom: { strength: 0.64, radius: 0.78, threshold: 0.72 },
    navGroup: 'credits'
  }
};

export const CHAPTER_ORDER = [
  'hero',
  'wessel',
  'mengoli',
  'majorana',
  'zhenyi',
  'peterson',
  'skinner',
  'lab',
  'credits'
];

export class ScrollDirector {
  /**
   * @param {import('./renderer.js').SpatialRenderer} spatialRenderer
   * @param {Object} callbacks
   */
  constructor(spatialRenderer, callbacks = {}) {
    if (!spatialRenderer || !spatialRenderer.scene || !spatialRenderer.camera) {
      throw new Error('ScrollDirector requires an initialized SpatialRenderer.');
    }

    this.renderer = spatialRenderer;
    this.scene = spatialRenderer.scene;
    this.camera = spatialRenderer.camera;
    this.onWorldChange = typeof callbacks.onWorldChange === 'function' ? callbacks.onWorldChange : null;

    this.worlds = new Map();
    this.worldStates = new Map();
    this.worldRoot = new THREE.Group();
    this.worldRoot.name = 'UnseenLogicWorldRoot';
    this.scene.add(this.worldRoot);

    this.activeWorldId = 'hero';
    this.previousWorldId = null;
    this.sectionMetrics = [];

    // Smooth camera & scroll interpolation state
    this.currentCamPos = new THREE.Vector3(...CHAPTER_MANIFEST.hero.cameraPos);
    this.targetCamPos = new THREE.Vector3(...CHAPTER_MANIFEST.hero.cameraPos);
    this.currentLookAt = new THREE.Vector3(...CHAPTER_MANIFEST.hero.lookAt);
    this.targetLookAt = new THREE.Vector3(...CHAPTER_MANIFEST.hero.lookAt);
    this.currentFov = CHAPTER_MANIFEST.hero.fov;
    this.targetFov = CHAPTER_MANIFEST.hero.fov;

    // Interactive pointer parallax & manual drag inspection state
    this.pointerNorm = new THREE.Vector2(0, 0);
    this.pointerSmoothed = new THREE.Vector2(0, 0);
    this.isDragging = false;
    this.dragStart = new THREE.Vector2(0, 0);
    this.userOrbitOffset = new THREE.Vector2(0, 0);
    this.targetOrbitOffset = new THREE.Vector2(0, 0);

    // Scratch vectors to avoid per-frame GC allocations
    this._scratchPosA = new THREE.Vector3();
    this._scratchPosB = new THREE.Vector3();
    this._scratchLookA = new THREE.Vector3();
    this._scratchLookB = new THREE.Vector3();
    this._finalCamPos = new THREE.Vector3();
    this._finalLookAt = new THREE.Vector3();

    this.dom = {
      worldTitle: document.getElementById('active-world-title'),
      worldYear: document.getElementById('active-world-year'),
      formulaReadout: document.getElementById('formula-readout'),
      creatorMonolith: document.getElementById('creator-monolith'),
      chapterDots: Array.from(document.querySelectorAll('.chapter-dot')),
      hudLinks: Array.from(document.querySelectorAll('.hud-link')),
      sections: Array.from(document.querySelectorAll('.spatial-section'))
    };

    // Build built-in origin/credits singularity construct so Hero & Credits have rich 3D presence
    this.singularityConstruct = this.createOriginSingularityWorld();
    this.registerWorld('hero', this.singularityConstruct);
    this.registerWorld('credits', this.singularityConstruct);

    this.bindEvents();
    this.measureSections();
    this.evaluateScroll(true);
  }

  /**
   * Creates the ambient geodesic harmonic astrolabe used in Hero & Attribution chapters.
   */
  createOriginSingularityWorld() {
    const group = new THREE.Group();
    group.name = 'OriginSingularityWorld';

    const coreGeo = new THREE.IcosahedronGeometry(1.65, 3);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x13223f,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      wireframe: false
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    const wireGeo = new THREE.IcosahedronGeometry(1.72, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x5ac8fa,
      wireframe: true,
      transparent: true,
      opacity: 0.34
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    group.add(wireMesh);

    const rings = [];
    const ringConfigs = [
      { radius: 2.55, tube: 0.018, color: 0x5ac8fa, tiltX: 0.65, tiltY: 0.2 },
      { radius: 3.15, tube: 0.014, color: 0x818cf8, tiltX: -0.45, tiltY: 0.8 },
      { radius: 3.75, tube: 0.012, color: 0xe2e8f0, tiltX: 1.1, tiltY: -0.35 }
    ];

    for (const cfg of ringConfigs) {
      const rGeo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 24, 180);
      const rMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.color,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.9
      });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.rotation.set(cfg.tiltX, cfg.tiltY, 0);
      group.add(ring);
      rings.push(ring);
    }

    const params = {
      harmonicOrder: 3.0,
      gimbalVelocity: 0.65,
      fieldExpansion: 1.0,
      luminance: 0.55
    };

    return {
      id: 'hero',
      group,
      params,
      getParameterSchema() {
        return [
          { key: 'harmonicOrder', label: 'Harmonic Symmetry', min: 1, max: 8, step: 0.5, value: params.harmonicOrder },
          { key: 'gimbalVelocity', label: 'Astrolabe Velocity', min: 0.0, max: 2.5, step: 0.05, value: params.gimbalVelocity },
          { key: 'fieldExpansion', label: 'Spatial Radius', min: 0.6, max: 1.6, step: 0.05, value: params.fieldExpansion },
          { key: 'luminance', label: 'Core Radiance', min: 0.1, max: 1.5, step: 0.05, value: params.luminance }
        ];
      },
      setParams(next = {}) {
        Object.assign(params, next);
        coreMat.emissiveIntensity = params.luminance;
        group.scale.setScalar(params.fieldExpansion);
      },
      update(elapsed) {
        const speed = params.gimbalVelocity;
        coreMesh.rotation.y = elapsed * 0.22 * speed;
        coreMesh.rotation.x = Math.sin(elapsed * 0.35) * 0.25;
        wireMesh.rotation.y = -elapsed * 0.16 * speed;
        wireMesh.rotation.z = elapsed * 0.12 * speed;

        rings.forEach((ring, idx) => {
          const dir = idx % 2 === 0 ? 1 : -1;
          ring.rotation.z += 0.004 * dir * speed * (idx + 1) * 0.5;
          ring.rotation.x += 0.002 * dir * speed;
        });
      },
      dispose() {
        coreGeo.dispose();
        coreMat.dispose();
        wireGeo.dispose();
        wireMat.dispose();
        rings.forEach((r) => {
          r.geometry.dispose();
          r.material.dispose();
        });
      }
    };
  }

  /**
   * Registers a 3D world module under its canonical chapter key.
   * @param {string} id
   * @param {Object} worldInstance
   */
  registerWorld(id, worldInstance) {
    if (!id || !worldInstance || !worldInstance.group) return;

    this.worlds.set(id, worldInstance);
    this.worldStates.set(id, {
      weight: id === this.activeWorldId ? 1.0 : 0.0,
      targetWeight: id === this.activeWorldId ? 1.0 : 0.0
    });

    if (!worldInstance.group.parent) {
      worldInstance.group.visible = id === this.activeWorldId;
      this.worldRoot.add(worldInstance.group);
    }

    if (id === this.activeWorldId && this.onWorldChange) {
      this.onWorldChange(id, CHAPTER_MANIFEST[id], worldInstance);
    }
  }

  /**
   * Returns the currently active world instance.
   */
  getActiveWorld() {
    return this.worlds.get(this.activeWorldId) || null;
  }

  /**
   * Returns the currently active world ID.
   */
  getActiveWorldId() {
    return this.activeWorldId;
  }

  /**
   * Binds scroll, resize, chapter rail clicks, and pointer drag/parallax listeners.
   */
  bindEvents() {
    this._onScroll = () => this.evaluateScroll(false);
    this._onResize = () => {
      this.measureSections();
      this.evaluateScroll(false);
    };
    this._onPointerMove = (e) => {
      const nx = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const ny = (e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
      this.pointerNorm.set(nx, ny);

      if (this.isDragging) {
        const dx = (e.clientX - this.dragStart.x) * 0.0045;
        const dy = (e.clientY - this.dragStart.y) * 0.0035;
        this.targetOrbitOffset.x = THREE.MathUtils.clamp(this.targetOrbitOffset.x + dx, -1.35, 1.35);
        this.targetOrbitOffset.y = THREE.MathUtils.clamp(this.targetOrbitOffset.y + dy, -0.75, 0.75);
        this.dragStart.set(e.clientX, e.clientY);
      }
    };
    this._onPointerDown = (e) => {
      if (e.target === this.renderer.canvas) {
        this.isDragging = true;
        this.dragStart.set(e.clientX, e.clientY);
      }
    };
    this._onPointerUp = () => {
      this.isDragging = false;
    };

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this._onPointerDown, { passive: true });
    window.addEventListener('pointerup', this._onPointerUp, { passive: true });

    this.dom.chapterDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const targetKey = dot.getAttribute('data-target');
        if (targetKey) {
          this.scrollToWorld(targetKey);
        }
      });
    });

    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', () => this.scrollToWorld('hero'));
    }
  }

  /**
   * Measures vertical bounds of every `.spatial-section` in document space.
   */
  measureSections() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    this.sectionMetrics = this.dom.sections.map((el) => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + scrollY;
      const height = Math.max(rect.height, 1);
      return {
        id: el.getAttribute('data-world') || 'hero',
        element: el,
        top,
        bottom: top + height,
        center: top + height * 0.5,
        height
      };
    });
  }

  /**
   * Smoothly scrolls the page to the requested chapter ID.
   * @param {string} worldId
   */
  scrollToWorld(worldId) {
    const meta = CHAPTER_MANIFEST[worldId];
    if (!meta) return;
    const targetEl = document.getElementById(meta.sectionId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Evaluates current scroll position, interpolates camera targets between neighboring
   * chapters, and switches the active 3D world when crossing section midpoints.
   * @param {boolean} immediate
   */
  evaluateScroll(immediate = false) {
    if (this.sectionMetrics.length === 0) {
      this.measureSections();
    }

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const viewportCenter = scrollY + window.innerHeight * 0.5;

    let closestIdx = 0;
    let closestDist = Infinity;

    for (let i = 0; i < this.sectionMetrics.length; i++) {
      const sec = this.sectionMetrics[i];
      const dist = Math.abs(viewportCenter - sec.center);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }

      // Trigger glass card reveal states
      const card = sec.element.querySelector('.theorem-card');
      if (card) {
        const isFocused = dist < sec.height * 0.58;
        card.classList.toggle('in-view', isFocused);
      }
      if (sec.id === 'credits' && this.dom.creatorMonolith) {
        this.dom.creatorMonolith.classList.toggle('revealed', dist < sec.height * 0.65);
      }
    }

    const primarySec = this.sectionMetrics[closestIdx];
    const nextWorldId = primarySec ? primarySec.id : 'hero';

    // Determine neighboring section for continuous camera keyframe blending
    let lowerIdx = closestIdx;
    let upperIdx = closestIdx;
    let blendAlpha = 0.0;

    if (viewportCenter < primarySec.center && closestIdx > 0) {
      lowerIdx = closestIdx - 1;
      upperIdx = closestIdx;
      const span = Math.max(this.sectionMetrics[upperIdx].center - this.sectionMetrics[lowerIdx].center, 1);
      blendAlpha = THREE.MathUtils.clamp((viewportCenter - this.sectionMetrics[lowerIdx].center) / span, 0, 1);
    } else if (viewportCenter >= primarySec.center && closestIdx < this.sectionMetrics.length - 1) {
      lowerIdx = closestIdx;
      upperIdx = closestIdx + 1;
      const span = Math.max(this.sectionMetrics[upperIdx].center - this.sectionMetrics[lowerIdx].center, 1);
      blendAlpha = THREE.MathUtils.clamp((viewportCenter - this.sectionMetrics[lowerIdx].center) / span, 0, 1);
    }

    // Smoothstep easing on camera blend
    const smoothAlpha = blendAlpha * blendAlpha * (3 - 2 * blendAlpha);
    const metaA = CHAPTER_MANIFEST[this.sectionMetrics[lowerIdx].id] || CHAPTER_MANIFEST.hero;
    const metaB = CHAPTER_MANIFEST[this.sectionMetrics[upperIdx].id] || metaA;

    this._scratchPosA.set(...metaA.cameraPos);
    this._scratchPosB.set(...metaB.cameraPos);
    this.targetCamPos.lerpVectors(this._scratchPosA, this._scratchPosB, smoothAlpha);

    this._scratchLookA.set(...metaA.lookAt);
    this._scratchLookB.set(...metaB.lookAt);
    this.targetLookAt.lerpVectors(this._scratchLookA, this._scratchLookB, smoothAlpha);

    this.targetFov = THREE.MathUtils.lerp(metaA.fov, metaB.fov, smoothAlpha);

    if (immediate) {
      this.currentCamPos.copy(this.targetCamPos);
      this.currentLookAt.copy(this.targetLookAt);
      this.currentFov = this.targetFov;
    }

    if (nextWorldId !== this.activeWorldId || immediate) {
      this.activateWorld(nextWorldId);
    }
  }

  /**
   * Transitions HUD telemetry, chapter rail indicators, bloom settings, and active 3D world.
   * @param {string} worldId
   */
  activateWorld(worldId) {
    const meta = CHAPTER_MANIFEST[worldId];
    if (!meta) return;

    this.previousWorldId = this.activeWorldId;
    this.activeWorldId = worldId;
    this.targetOrbitOffset.set(0, 0);

    // Update HUD badges & live formula display
    if (this.dom.worldTitle) {
      this.dom.worldTitle.textContent = meta.title;
    }
    if (this.dom.worldYear) {
      this.dom.worldYear.textContent = meta.year;
    }
    if (this.dom.formulaReadout) {
      this.dom.formulaReadout.textContent = meta.formula;
    }

    // Sync chapter rail dots
    this.dom.chapterDots.forEach((dot) => {
      dot.classList.toggle('active', dot.getAttribute('data-target') === worldId);
    });

    // Sync top navigation links
    this.dom.hudLinks.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('data-nav') === meta.navGroup);
    });

    // Adjust post-processing bloom to match chapter atmosphere
    if (meta.bloom && typeof this.renderer.setBloomIntensity === 'function') {
      this.renderer.setBloomIntensity(meta.bloom.strength, meta.bloom.radius, meta.bloom.threshold);
    }

    // Update target transition weights for registered worlds
    for (const [key, state] of this.worldStates.entries()) {
      state.targetWeight = key === worldId ? 1.0 : 0.0;
    }

    const activeInstance = this.worlds.get(worldId) || null;
    if (this.onWorldChange) {
      this.onWorldChange(worldId, meta, activeInstance);
    }
  }

  /**
   * Advances camera damping, pointer parallax, world cross-fades, and active world simulations.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   */
  update(elapsedTime, deltaTime) {
    const dt = Math.min(Math.max(deltaTime, 0.001), 0.1);
    const lerpFactor = 1 - Math.exp(-5.5 * dt);

    // Damp camera position, lookAt target, and FOV
    this.currentCamPos.lerp(this.targetCamPos, lerpFactor);
    this.currentLookAt.lerp(this.targetLookAt, lerpFactor);
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, this.targetFov, lerpFactor);

    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Smooth pointer parallax & manual drag orbit
    this.pointerSmoothed.lerp(this.pointerNorm, lerpFactor);
    if (!this.isDragging) {
      this.targetOrbitOffset.multiplyScalar(Math.exp(-1.4 * dt));
    }
    this.userOrbitOffset.lerp(this.targetOrbitOffset, lerpFactor * 1.4);

    // Apply subtle orbital parallax around the lookAt point
    const relOffset = this._finalCamPos.subVectors(this.currentCamPos, this.currentLookAt);
    const totalYaw = this.pointerSmoothed.x * 0.14 + this.userOrbitOffset.x;
    const totalPitch = -this.pointerSmoothed.y * 0.09 + this.userOrbitOffset.y;

    relOffset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, totalYaw);
    relOffset.y += totalPitch * 2.2;

    this.camera.position.copy(this.currentLookAt).add(relOffset);
    this._finalLookAt.copy(this.currentLookAt);
    this.camera.lookAt(this._finalLookAt);

    // Update visible & transitioning 3D worlds
    const uniqueUpdated = new Set();
    for (const [id, world] of this.worlds.entries()) {
      const state = this.worldStates.get(id);
      if (!state) continue;

      // Ensure shared instances (like hero & credits singularity) take max target weight
      let effectiveTarget = state.targetWeight;
      if (world === this.singularityConstruct) {
        effectiveTarget = this.activeWorldId === 'hero' || this.activeWorldId === 'credits' ? 1.0 : 0.0;
      }

      state.weight = THREE.MathUtils.lerp(state.weight, effectiveTarget, lerpFactor * 1.35);

      if (state.weight > 0.015) {
        world.group.visible = true;
        const transitionScale = 0.86 + 0.14 * state.weight;
        const baseScale = world.params?.fieldExpansion || 1.0;
        world.group.scale.setScalar(baseScale * transitionScale);

        if (!uniqueUpdated.has(world) && typeof world.update === 'function') {
          world.update(elapsedTime, dt, world.params || {});
          uniqueUpdated.add(world);
        }
      } else {
        state.weight = 0.0;
        world.group.visible = false;
      }
    }
  }

  /**
   * Cleans up event listeners and disposes the built-in singularity construct.
   */
  dispose() {
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);

    if (this.singularityConstruct && typeof this.singularityConstruct.dispose === 'function') {
      this.singularityConstruct.dispose();
    }
    this.worlds.clear();
    this.worldStates.clear();
  }
}

export default ScrollDirector;
