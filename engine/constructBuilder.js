/**
 * UNSEEN LOGIC — Autonomous 3D Machine & Parametric Construct Generator
 * File 12/16: engine/constructBuilder.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'three';
import {
  FormulaParser,
  ParametricConstraintSolver,
  LAB_PRESETS
} from './formulaParser.js';

const TWO_PI = Math.PI * 2;

export const SUPPORTED_TOPOLOGIES = Object.freeze({
  parametric_surface: 'PARAMETRIC MANIFOLD',
  wave_interference: 'WAVE INTERFERENCE FIELD',
  toroidal_vortex: 'TOROIDAL VORTEX WELL',
  hyperbolic_saddle: 'HYPERBOLIC SADDLE TENSOR',
  spherical_harmonic: 'SPHERICAL HARMONIC SHELL'
});

/**
 * Normalizes arbitrary topology identifiers (including Gemini API suggestions)
 * into one of the five canonical 3D machine embeddings.
 * @param {string} rawTopology
 * @returns {string}
 */
export function normalizeTopology(rawTopology) {
  if (!rawTopology || typeof rawTopology !== 'string') {
    return 'parametric_surface';
  }
  const key = rawTopology.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (Object.prototype.hasOwnProperty.call(SUPPORTED_TOPOLOGIES, key)) {
    return key;
  }
  if (key.includes('torus') || key.includes('toroid') || key.includes('vortex') || key.includes('orbit')) {
    return 'toroidal_vortex';
  }
  if (key.includes('wave') || key.includes('polar') || key.includes('ripple') || key.includes('interfer')) {
    return 'wave_interference';
  }
  if (key.includes('saddle') || key.includes('hyperbol') || key.includes('mobius') || key.includes('ribbon')) {
    return 'hyperbolic_saddle';
  }
  if (key.includes('sphere') || key.includes('harmonic') || key.includes('cloud') || key.includes('shell')) {
    return 'spherical_harmonic';
  }
  return 'parametric_surface';
}

export class ConstructBuilder {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.id = 'lab';
    this.group = new THREE.Group();
    this.group.name = 'AutonomousFormulaConstructMachine';

    const defaultPreset = LAB_PRESETS.tokens;
    this.params = {
      p1: defaultPreset.params.p1,
      p2: defaultPreset.params.p2,
      p3: defaultPreset.params.p3,
      p4: defaultPreset.params.p4,
      fieldExpansion: 1.0,
      ...(options.params || {})
    };

    this.meta = {
      title: defaultPreset.title,
      domain: defaultPreset.domain,
      explanation: defaultPreset.explanation,
      topology: 'parametric_surface',
      expression: 'sin(u * p1 - t * p2) * cos(v * p3) * p4'
    };

    // 128 x 128 = 16,384 active computational nodes matching HUD telemetry
    this.gridSegments = 127;
    this.gridStride = this.gridSegments + 1; // 128
    this.nodeCount = this.gridStride * this.gridStride; // 16,384
    this.domainMin = -Math.PI;
    this.domainMax = Math.PI;

    // Instanced normal/flux actuators (16 x 16 = 256 probes)
    this.probeCols = 16;
    this.probeRows = 16;
    this.probeTotal = this.probeCols * this.probeRows;

    // Gradient-advected autonomous particle stream
    this.particleCount = 1200;
    this.particleUV = new Float32Array(this.particleCount * 2);
    this.particleLife = new Float32Array(this.particleCount);

    // Pre-allocated typed geometry buffers (zero per-frame GC pressure)
    this.posBuffer = new Float32Array(this.nodeCount * 3);
    this.normBuffer = new Float32Array(this.nodeCount * 3);
    this.colorBuffer = new Float32Array(this.nodeCount * 3);
    this.fieldBuffer = new Float32Array(this.nodeCount);

    // Reusable scratch objects
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._upVec = new THREE.Vector3(0, 1, 0);
    this._normal = new THREE.Vector3();
    this._tangentU = new THREE.Vector3();
    this._tangentV = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._scope = {
      u: 0,
      v: 0,
      t: 0,
      x: 0,
      y: 0,
      z: 0,
      r: 0,
      theta: 0,
      phi: 0,
      p1: this.params.p1,
      p2: this.params.p2,
      p3: this.params.p3,
      p4: this.params.p4
    };

    this.disposables = [];
    this.rootRig = new THREE.Group();
    this.group.add(this.rootRig);

    this.solver = new ParametricConstraintSolver({
      sampleResolution: 32,
      domainMin: this.domainMin,
      domainMax: this.domainMax
    });

    this.compiledFormula = FormulaParser.compile(this.meta.expression);
    this.lastMetrics = null;
    this.lastMetricsUpdate = -10;
    this.onMetricsChange = typeof options.onMetricsChange === 'function' ? options.onMetricsChange : null;

    // Scene sub-assemblies
    this.containmentGimbalOuter = null;
    this.containmentGimbalInner = null;
    this.baseGridRing = null;
    this.manifoldMesh = null;
    this.manifoldWireframe = null;
    this.probeInstancedMesh = null;
    this.flowPoints = null;

    this.buildContainmentRig();
    this.buildMorphingManifold();
    this.buildFluxProbeActuators();
    this.buildGradientParticleStream();

    // Perform initial synchronous evaluation and metric analysis
    this.refreshMetrics(0);
    this.update(0, 0.016);
  }

  /**
   * Tracks Three.js geometries and materials for deterministic GPU disposal.
   * @param {THREE.BufferGeometry|THREE.Material} resource
   */
  track(resource) {
    if (resource) {
      this.disposables.push(resource);
    }
    return resource;
  }

  /**
   * Builds the Apple-grade calibrated optical containment gimbal and polar stage
   * framing the autonomous 3D construct.
   */
  buildContainmentRig() {
    const rigGroup = new THREE.Group();
    rigGroup.name = 'AutonomousContainmentRig';

    const outerGeo = this.track(new THREE.TorusGeometry(4.15, 0.016, 18, 160));
    const outerMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x5ac8fa,
        emissive: 0x0284c7,
        emissiveIntensity: 0.55,
        roughness: 0.22,
        metalness: 0.88
      })
    );
    this.containmentGimbalOuter = new THREE.Mesh(outerGeo, outerMat);
    this.containmentGimbalOuter.rotation.x = Math.PI / 2;
    this.containmentGimbalOuter.position.y = -1.65;
    rigGroup.add(this.containmentGimbalOuter);

    const innerGeo = this.track(new THREE.TorusGeometry(3.65, 0.011, 14, 144));
    const innerMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.85,
        transparent: true,
        opacity: 0.68
      })
    );
    this.containmentGimbalInner = new THREE.Mesh(innerGeo, innerMat);
    this.containmentGimbalInner.rotation.x = Math.PI / 2;
    this.containmentGimbalInner.position.y = -1.65;
    rigGroup.add(this.containmentGimbalInner);

    // Subtle polar reference crosshair beneath the manifold
    const crossPositions = new Float32Array([
      -4.1, -1.65, 0, 4.1, -1.65, 0,
      0, -1.65, -4.1, 0, -1.65, 4.1
    ]);
    const crossGeo = this.track(new THREE.BufferGeometry());
    crossGeo.setAttribute('position', new THREE.BufferAttribute(crossPositions, 3));
    const crossMat = this.track(
      new THREE.LineBasicMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.36
      })
    );
    this.baseGridRing = new THREE.LineSegments(crossGeo, crossMat);
    rigGroup.add(this.baseGridRing);

    this.rootRig.add(rigGroup);
  }

  /**
   * Builds the 128 x 128 morphing parametric manifold mesh and luminous wireframe overlay.
   */
  buildMorphingManifold() {
    const geometry = this.track(new THREE.BufferGeometry());
    const indices = new Uint32Array(this.gridSegments * this.gridSegments * 6);
    let ptr = 0;

    for (let iv = 0; iv < this.gridSegments; iv++) {
      for (let iu = 0; iu < this.gridSegments; iu++) {
        const a = iv * this.gridStride + iu;
        const b = a + 1;
        const c = (iv + 1) * this.gridStride + iu;
        const d = c + 1;

        indices[ptr++] = a;
        indices[ptr++] = c;
        indices[ptr++] = b;

        indices[ptr++] = b;
        indices[ptr++] = c;
        indices[ptr++] = d;
      }
    }

    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute('position', new THREE.BufferAttribute(this.posBuffer, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.normBuffer, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colorBuffer, 3));

    const surfaceMat = this.track(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.2,
        metalness: 0.32,
        clearcoat: 0.88,
        clearcoatRoughness: 0.14,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      })
    );

    this.manifoldMesh = new THREE.Mesh(geometry, surfaceMat);
    this.manifoldMesh.name = 'AutonomousParametricManifold';
    this.rootRig.add(this.manifoldMesh);

    const wireMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        wireframe: true,
        transparent: true,
        opacity: 0.085,
        depthWrite: false
      })
    );
    this.manifoldWireframe = new THREE.Mesh(geometry, wireMat);
    this.rootRig.add(this.manifoldWireframe);
  }

  /**
   * Builds 256 InstancedMesh surface-normal flux probes that ride the morphing construct
   * and visualize local gradient intensity and orientation.
   */
  buildFluxProbeActuators() {
    const probeGeo = this.track(new THREE.ConeGeometry(0.032, 0.22, 8));
    probeGeo.translate(0, 0.11, 0);
    const probeMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.72,
        roughness: 0.2,
        metalness: 0.85
      })
    );

    this.probeInstancedMesh = new THREE.InstancedMesh(probeGeo, probeMat, this.probeTotal);
    this.probeInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.probeInstancedMesh.name = 'AutonomousFluxProbes';

    for (let i = 0; i < this.probeTotal; i++) {
      this._dummy.position.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.probeInstancedMesh.setMatrixAt(i, this._dummy.matrix);
      this._color.setHex(0x5ac8fa);
      this.probeInstancedMesh.setColorAt(i, this._color);
    }

    this.rootRig.add(this.probeInstancedMesh);
  }

  /**
   * Builds 1,200 autonomous particles that flow across (u, v) parameter space
   * along the numerical gradient field ∇f(u, v, t) of the active formula.
   */
  buildGradientParticleStream() {
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      const i2 = i * 2;
      const i3 = i * 3;
      this.particleUV[i2] = this.domainMin + Math.random() * (this.domainMax - this.domainMin);
      this.particleUV[i2 + 1] = this.domainMin + Math.random() * (this.domainMax - this.domainMin);
      this.particleLife[i] = Math.random();

      this._color.setHSL(0.52 + Math.random() * 0.16, 0.92, 0.64);
      colors[i3] = this._color.r;
      colors[i3 + 1] = this._color.g;
      colors[i3 + 2] = this._color.b;
    }

    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = this.track(
      new THREE.PointsMaterial({
        size: 0.058,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );

    this.flowPoints = new THREE.Points(geo, mat);
    this.flowPoints.name = 'AutonomousGradientFlow';
    this.flowPoints.frustumCulled = false;
    this.rootRig.add(this.flowPoints);
  }

  /**
   * Maps parameter coordinates (u, v) and scalar field value val = f(u, v, t)
   * into 3D world space according to the active topological embedding.
   * @param {number} u
   * @param {number} v
   * @param {number} val
   * @param {string} topology
   * @param {THREE.Vector3} outVec
   */
  mapDomainTo3D(u, v, val, topology, outVec) {
    const clampedVal = THREE.MathUtils.clamp(val, -4.5, 4.5);
    const uNorm = u / Math.PI; // [-1, 1]
    const vNorm = v / Math.PI; // [-1, 1]

    switch (topology) {
      case 'toroidal_vortex': {
        const theta = u; // [0, 2π]
        const phi = v;   // [0, 2π]
        const majorR = 2.25;
        const minorR = Math.max(0.28, 0.82 + clampedVal * 0.34);
        const radial = majorR + minorR * Math.cos(phi);
        outVec.set(
          radial * Math.cos(theta),
          minorR * Math.sin(phi) + clampedVal * 0.22,
          radial * Math.sin(theta)
        );
        break;
      }

      case 'wave_interference': {
        const radius = ((uNorm + 1) * 0.5) * 3.45;
        const angle = v;
        outVec.set(
          radius * Math.cos(angle),
          clampedVal * 0.82,
          radius * Math.sin(angle)
        );
        break;
      }

      case 'hyperbolic_saddle': {
        const x = uNorm * 3.1;
        const z = vNorm * 3.1;
        const saddleBase = (uNorm * uNorm - vNorm * vNorm) * 0.95;
        outVec.set(x, saddleBase + clampedVal * 0.65, z);
        break;
      }

      case 'spherical_harmonic': {
        const theta = (uNorm + 1) * Math.PI;         // [0, 2π]
        const phi = ((vNorm + 1) * 0.5) * Math.PI;   // [0, π]
        const r = Math.max(0.45, 2.15 + clampedVal * 0.45);
        outVec.set(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        );
        break;
      }

      case 'parametric_surface':
      default: {
        outVec.set(uNorm * 3.25, clampedVal * 0.85, vNorm * 3.25);
        break;
      }
    }
  }

  /**
   * Compiles a user-entered or AI-generated mathematical expression safely.
   * @param {string} expression
   * @param {Object} meta
   * @returns {{ ok: boolean, error?: string, metrics?: Object }}
   */
  setFormula(expression, meta = {}) {
    try {
      const compiled = FormulaParser.compile(expression);
      this.compiledFormula = compiled;
      this.meta.expression = expression;

      if (meta.title) this.meta.title = meta.title;
      if (meta.domain) this.meta.domain = meta.domain;
      if (meta.explanation) this.meta.explanation = meta.explanation;
      if (meta.topology) {
        this.setTopology(meta.topology);
      }

      const metrics = this.refreshMetrics(0);
      return { ok: true, metrics };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid mathematical formula syntax.'
      };
    }
  }

  /**
   * Switches the 3D topological embedding mode and updates UI badge if present.
   * @param {string} rawTopology
   * @returns {string}
   */
  setTopology(rawTopology) {
    const normalized = normalizeTopology(rawTopology);
    this.meta.topology = normalized;

    const badge = document.getElementById('lab-topology-badge');
    if (badge) {
      badge.textContent = `TOPOLOGY: ${SUPPORTED_TOPOLOGIES[normalized]}`;
    }
    return normalized;
  }

  /**
   * Applies a complete construct configuration (from LAB_PRESETS, Vault, or Gemini API).
   * @param {Object} config
   * @returns {{ ok: boolean, error?: string, metrics?: Object }}
   */
  applyConstructConfig(config = {}) {
    if (config.params && typeof config.params === 'object') {
      this.setParams(config.params);
    }
    if (config.topology) {
      this.setTopology(config.topology);
    }
    const expr = config.expression || this.meta.expression;
    return this.setFormula(expr, {
      title: config.title,
      domain: config.domain,
      explanation: config.explanation,
      topology: config.topology
    });
  }

  /**
   * Runs the projected gradient constraint solver to automatically tune p1..p4
   * for optimal stability and bounded energy.
   * @param {Object} constraints
   */
  optimizeConstraints(constraints = {}) {
    if (!this.compiledFormula) return null;
    const result = this.solver.solveConstraints(this.compiledFormula, this.params, constraints);
    if (result && result.params) {
      this.setParams(result.params);
      this.lastMetrics = result.metrics;
      this.syncMetricsToDom(result.metrics);
    }
    return result;
  }

  /**
   * Evaluates field telemetry metrics and updates DOM counters.
   * @param {number} elapsedTime
   */
  refreshMetrics(elapsedTime = 0) {
    if (!this.compiledFormula) return null;
    const metrics = this.solver.analyzeField(
      this.compiledFormula,
      this.params,
      elapsedTime,
      this.gridStride
    );
    this.lastMetrics = metrics;
    this.lastMetricsUpdate = elapsedTime;
    this.syncMetricsToDom(metrics);
    if (this.onMetricsChange) {
      this.onMetricsChange(metrics);
    }
    return metrics;
  }

  /**
   * Pushes live convergence, stability index, and active node count to the Lab card UI.
   * @param {Object} metrics
   */
  syncMetricsToDom(metrics) {
    if (!metrics) return;
    const convEl = document.getElementById('metric-convergence');
    const stabEl = document.getElementById('metric-stability');
    const nodesEl = document.getElementById('metric-nodes');

    if (convEl) convEl.textContent = metrics.convergence;
    if (stabEl) stabEl.textContent = Number(metrics.stabilityIndex).toFixed(3);
    if (nodesEl) nodesEl.textContent = metrics.activeNodesFormatted;
  }

  /**
   * Exposes interactive parameter schema for the bottom-right HUD parameter dock.
   */
  getParameterSchema() {
    return [
      {
        key: 'p1',
        label: 'Frequency / Gain (p1)',
        min: 0.2,
        max: 6.0,
        step: 0.05,
        value: this.params.p1
      },
      {
        key: 'p2',
        label: 'Temporal Phase Rate (p2)',
        min: 0.0,
        max: 4.0,
        step: 0.05,
        value: this.params.p2
      },
      {
        key: 'p3',
        label: 'Harmonic Coupling (p3)',
        min: 0.2,
        max: 6.0,
        step: 0.05,
        value: this.params.p3
      },
      {
        key: 'p4',
        label: 'Amplitude Envelope (p4)',
        min: 0.1,
        max: 3.0,
        step: 0.05,
        value: this.params.p4
      }
    ];
  }

  /**
   * Merges updated parameter values from HUD sliders or external controllers.
   * @param {Object} next
   */
  setParams(next = {}) {
    Object.assign(this.params, next);
    this.refreshMetrics(this.lastMetricsUpdate > 0 ? this.lastMetricsUpdate : 0);
  }

  /**
   * Returns a serializable snapshot of the active autonomous construct for saving/exporting.
   */
  getStateSnapshot() {
    return {
      title: this.meta.title,
      domain: this.meta.domain,
      topology: this.meta.topology,
      expression: this.meta.expression,
      explanation: this.meta.explanation,
      params: {
        p1: this.params.p1,
        p2: this.params.p2,
        p3: this.params.p3,
        p4: this.params.p4
      },
      metrics: this.lastMetrics || this.refreshMetrics(0)
    };
  }

  /**
   * Advances the 16,384-node morphing manifold, normal probes, and gradient-advected
   * particle flow every frame.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   * @param {Object} externalParams
   */
  update(elapsedTime = 0, deltaTime = 0.016, externalParams = {}) {
    if (externalParams) {
      Object.assign(this.params, externalParams);
    }

    const stride = this.gridStride;
    const segs = this.gridSegments;
    const span = this.domainMax - this.domainMin;
    const step = span / segs;
    const topology = this.meta.topology;

    this._scope.p1 = this.params.p1;
    this._scope.p2 = this.params.p2;
    this._scope.p3 = this.params.p3;
    this._scope.p4 = this.params.p4;
    this._scope.t = elapsedTime;

    const ptScratch = new THREE.Vector3();

    // 1. Evaluate f(u, v, t) across all 128 x 128 = 16,384 nodes and map into 3D space
    for (let iv = 0; iv < stride; iv++) {
      const v = this.domainMin + iv * step;
      this._scope.v = v;
      this._scope.y = v;

      for (let iu = 0; iu < stride; iu++) {
        const u = this.domainMin + iu * step;
        const idx = iv * stride + iu;
        const i3 = idx * 3;

        this._scope.u = u;
        this._scope.x = u;
        this._scope.r = Math.hypot(u, v);
        this._scope.theta = Math.atan2(v, u);

        const val = this.compiledFormula.evaluate(this._scope);
        this.fieldBuffer[idx] = val;

        this.mapDomainTo3D(u, v, val, topology, ptScratch);
        this.posBuffer[i3] = ptScratch.x;
        this.posBuffer[i3 + 1] = ptScratch.y;
        this.posBuffer[i3 + 2] = ptScratch.z;

        // Luminous height/energy spectrum coloring
        const normVal = THREE.MathUtils.clamp(val * 0.42, -1.0, 1.0);
        if (normVal >= 0) {
          this._color.setHSL(0.53 - normVal * 0.40, 0.90, 0.46 + normVal * 0.16);
        } else {
          const neg = -normVal;
          this._color.setHSL(0.55 + neg * 0.17, 0.86, 0.44 - neg * 0.12);
        }
        this.colorBuffer[i3] = this._color.r;
        this.colorBuffer[i3 + 1] = this._color.g;
        this.colorBuffer[i3 + 2] = this._color.b;
      }
    }

    // 2. Fast central-difference vertex normals on the 128 x 128 grid
    for (let iv = 0; iv < stride; iv++) {
      const ivPrev = iv > 0 ? iv - 1 : 0;
      const ivNext = iv < segs ? iv + 1 : segs;

      for (let iu = 0; iu < stride; iu++) {
        const iuPrev = iu > 0 ? iu - 1 : 0;
        const iuNext = iu < segs ? iu + 1 : segs;

        const i3 = (iv * stride + iu) * 3;
        const iU1 = (iv * stride + iuNext) * 3;
        const iU0 = (iv * stride + iuPrev) * 3;
        const iV1 = (ivNext * stride + iu) * 3;
        const iV0 = (ivPrev * stride + iu) * 3;

        this._tangentU.set(
          this.posBuffer[iU1] - this.posBuffer[iU0],
          this.posBuffer[iU1 + 1] - this.posBuffer[iU0 + 1],
          this.posBuffer[iU1 + 2] - this.posBuffer[iU0 + 2]
        );
        this._tangentV.set(
          this.posBuffer[iV1] - this.posBuffer[iV0],
          this.posBuffer[iV1 + 1] - this.posBuffer[iV0 + 1],
          this.posBuffer[iV1 + 2] - this.posBuffer[iV0 + 2]
        );

        this._normal.crossVectors(this._tangentV, this._tangentU);
        const len = this._normal.length();
        if (len > 1e-6) {
          this._normal.divideScalar(len);
        } else {
          this._normal.set(0, 1, 0);
        }

        this.normBuffer[i3] = this._normal.x;
        this.normBuffer[i3 + 1] = this._normal.y;
        this.normBuffer[i3 + 2] = this._normal.z;
      }
    }

    const geo = this.manifoldMesh.geometry;
    geo.getAttribute('position').needsUpdate = true;
    geo.getAttribute('normal').needsUpdate = true;
    geo.getAttribute('color').needsUpdate = true;

    // 3. Update 256 InstancedMesh Surface-Normal Flux Probes
    if (this.probeInstancedMesh) {
      let probeIdx = 0;
      for (let r = 0; r < this.probeRows; r++) {
        const iv = Math.round(((r + 0.5) / this.probeRows) * segs);
        for (let c = 0; c < this.probeCols; c++) {
          const iu = Math.round(((c + 0.5) / this.probeCols) * segs);
          const idx = iv * stride + iu;
          const i3 = idx * 3;

          this._normal.set(this.normBuffer[i3], this.normBuffer[i3 + 1], this.normBuffer[i3 + 2]);
          if (this._normal.lengthSq() < 0.001) {
            this._normal.set(0, 1, 0);
          } else {
            this._normal.normalize();
          }

          this._quat.setFromUnitVectors(this._upVec, this._normal);
          this._dummy.position.set(this.posBuffer[i3], this.posBuffer[i3 + 1], this.posBuffer[i3 + 2]);
          this._dummy.quaternion.copy(this._quat);

          const mag = Math.abs(this.fieldBuffer[idx]);
          const scaleY = THREE.MathUtils.clamp(0.45 + mag * 0.55, 0.35, 2.2);
          this._dummy.scale.set(1.0, scaleY, 1.0);
          this._dummy.updateMatrix();
          this.probeInstancedMesh.setMatrixAt(probeIdx, this._dummy.matrix);

          this._color.setHSL(THREE.MathUtils.clamp(0.55 - mag * 0.16, 0.12, 0.68), 0.9, 0.6);
          this.probeInstancedMesh.setColorAt(probeIdx, this._color);

          probeIdx += 1;
        }
      }
      this.probeInstancedMesh.instanceMatrix.needsUpdate = true;
      if (this.probeInstancedMesh.instanceColor) {
        this.probeInstancedMesh.instanceColor.needsUpdate = true;
      }
    }

    // 4. Advect 1,200 Autonomous Particles across the manifold along local field gradients
    if (this.flowPoints) {
      const flowPos = this.flowPoints.geometry.getAttribute('position');
      const dt = Math.min(Math.max(deltaTime, 0.004), 0.05);
      const eps = 0.04;

      for (let i = 0; i < this.particleCount; i++) {
        const i2 = i * 2;
        this.particleLife[i] += dt * 0.28;

        let u = this.particleUV[i2];
        let v = this.particleUV[i2 + 1];

        if (
          this.particleLife[i] >= 1.0 ||
          u < this.domainMin ||
          u > this.domainMax ||
          v < this.domainMin ||
          v > this.domainMax
        ) {
          u = this.domainMin + Math.random() * span;
          v = this.domainMin + Math.random() * span;
          this.particleLife[i] = 0.0;
        } else {
          // Estimate local partial derivatives (∂f/∂u, ∂f/∂v)
          this._scope.u = u + eps;
          this._scope.v = v;
          const fUPlus = this.compiledFormula.evaluate(this._scope);

          this._scope.u = u - eps;
          const fUMinus = this.compiledFormula.evaluate(this._scope);

          this._scope.u = u;
          this._scope.v = v + eps;
          const fVPlus = this.compiledFormula.evaluate(this._scope);

          this._scope.v = v - eps;
          const fVMinus = this.compiledFormula.evaluate(this._scope);

          const gradU = THREE.MathUtils.clamp((fUPlus - fUMinus) / (2 * eps), -4, 4);
          const gradV = THREE.MathUtils.clamp((fVPlus - fVMinus) / (2 * eps), -4, 4);

          // Blend gradient ascent with tangential curl so particles trace dynamic streamlines
          u += (gradU * 0.35 - gradV * 0.45) * dt;
          v += (gradV * 0.35 + gradU * 0.45) * dt;
        }

        this.particleUV[i2] = u;
        this.particleUV[i2 + 1] = v;

        this._scope.u = u;
        this._scope.v = v;
        this._scope.x = u;
        this._scope.y = v;
        this._scope.r = Math.hypot(u, v);
        this._scope.theta = Math.atan2(v, u);

        const val = this.compiledFormula.evaluate(this._scope);
        this.mapDomainTo3D(u, v, val, topology, ptScratch);
        flowPos.setXYZ(i, ptScratch.x, ptScratch.y + 0.06, ptScratch.z);
      }

      flowPos.needsUpdate = true;
    }

    // 5. Rotate optical containment gimbals & gently orbit the autonomous machine
    if (this.containmentGimbalOuter && this.containmentGimbalInner) {
      this.containmentGimbalOuter.rotation.z = elapsedTime * 0.14;
      this.containmentGimbalInner.rotation.z = -elapsedTime * 0.22;
    }

    this.rootRig.rotation.y = elapsedTime * 0.12;
  }

  /**
   * Releases all GPU geometries and materials owned by this autonomous construct.
   */
  dispose() {
    for (const item of this.disposables) {
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    }
    this.disposables.length = 0;
    this.group.clear();
  }
}

export function createConstructBuilder(options = {}) {
  return new ConstructBuilder(options);
}

export default ConstructBuilder;
