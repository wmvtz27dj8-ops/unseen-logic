/**
 * UNSEEN LOGIC — World 03: Ettore Majorana's Unpublished Volumetti Spinor & Vortex Analogs (1928–1937)
 * File 7/16: worlds/majoranaCloud.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

/**
 * Custom GLSL Shader for Majorana's Volumetti Quantum Scattering Probability Cloud.
 * Evaluates coherent interference between an incident wave-packet and spherical harmonic
 * scattered modes |ψ_in + f(θ,φ) e^(ikr)/r|^2 directly on the GPU.
 */
const MajoranaCloudShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uChiralCoupling: { value: 1.15 },
    uVortexStrength: { value: 1.0 },
    uWaveCoherence: { value: 0.85 },
    uScatterMode: { value: 3.0 }
  },
  vertexShader: /* glsl */ `
    attribute vec3 aSeed;      // x: baseRadius, y: polarTheta, z: azimuthPhi
    attribute float aPolarity; // +1.0 particle spinor branch, -1.0 conjugate branch

    uniform float uTime;
    uniform float uChiralCoupling;
    uniform float uVortexStrength;
    uniform float uWaveCoherence;
    uniform float uScatterMode;

    varying float vDensity;
    varying float vPolarity;
    varying float vPhase;

    void main() {
      float r0 = aSeed.x;
      float theta = aSeed.y;
      float phi = aSeed.z;

      // Hydrodynamic vortex swirl around the polar axis (Majorana fluid velocity v = ∇S / m)
      float swirlAngle = phi + uTime * (0.38 * uVortexStrength) / max(r0 * 0.65, 0.35) * aPolarity;
      float nutation = theta + sin(uTime * 0.55 + r0 * 1.4) * 0.14 * uChiralCoupling;

      // Spherical harmonic scattering amplitude Re(Y_l^m)
      float lMode = floor(uScatterMode + 0.5);
      float harmonic = sin(lMode * nutation) * cos((lMode - 1.0) * swirlAngle + uTime * 0.7 * aPolarity);

      // Coherent superposition of incident plane wave e^(ikz) and outgoing spherical wave e^(ikr)/r
      float kWave = 2.6 * uChiralCoupling;
      float zCoord0 = r0 * cos(nutation);
      float incidentPhase = kWave * zCoord0 - uTime * 2.1;
      float scatteredPhase = kWave * r0 - uTime * 2.1 + harmonic * 1.65;

      float interference = cos(incidentPhase - scatteredPhase) * uWaveCoherence;
      float radialDisplacement = (0.34 * harmonic + 0.24 * interference) * uChiralCoupling;
      float r = max(0.32, r0 + radialDisplacement);

      vec3 pos = vec3(
        r * sin(nutation) * cos(swirlAngle),
        r * cos(nutation),
        r * sin(nutation) * sin(swirlAngle)
      );

      // Toroidal vortex pinch near equatorial plane
      float eqPinch = exp(-pos.y * pos.y * 1.35) * uVortexStrength * 0.25;
      pos.xz *= (1.0 + eqPinch * sin(uTime * 1.3 + r0 * 2.0));

      vDensity = clamp(0.42 + 0.38 * interference + 0.32 * abs(harmonic), 0.12, 1.0);
      vPolarity = aPolarity;
      vPhase = scatteredPhase;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      float sizeScale = (18.0 + 22.0 * vDensity) / max(-mvPosition.z, 1.0);
      gl_PointSize = clamp(sizeScale, 1.5, 11.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    varying float vDensity;
    varying float vPolarity;
    varying float vPhase;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float d = length(uv);
      if (d > 0.5) discard;

      float core = smoothstep(0.5, 0.05, d);
      float glow = exp(-d * 6.5);

      // Self-conjugate dual palette: electric cyan (+ψ) vs luminous indigo-violet (ψ^c)
      vec3 cyanBranch = vec3(0.24, 0.82, 0.98);
      vec3 conjugateBranch = vec3(0.56, 0.48, 0.99);
      vec3 selfConjugateGold = vec3(0.98, 0.92, 0.72);

      float mixBranch = 0.5 + 0.5 * vPolarity;
      vec3 baseTint = mix(conjugateBranch, cyanBranch, mixBranch);

      // Highlight constructive self-conjugate nodes where ψ = ψ^c
      float nodeAlignment = pow(max(0.0, cos(vPhase * 0.5)), 4.0);
      vec3 finalColor = mix(baseTint, selfConjugateGold, nodeAlignment * 0.45);

      float alpha = (core * 0.55 + glow * 0.75) * vDensity * 0.85;
      gl_FragColor = vec4(finalColor * (0.85 + 0.55 * vDensity), alpha);
    }
  `
};

export class MajoranaCloudWorld {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.id = 'majorana';
    this.group = new THREE.Group();
    this.group.name = 'MajoranaVolumettiCloudWorld';

    this.params = {
      chiralCoupling: 1.15,
      vortexDensity: 1.05,
      waveCoherence: 0.85,
      scatterOrder: 3.0,
      fieldExpansion: 1.0,
      ...(options.params || {})
    };

    this.particleCount = 3400;
    this.vortexRingCount = 18;
    this.streamlineCount = 12;

    this.disposables = [];
    this.rootRig = new THREE.Group();
    this.group.add(this.rootRig);

    // Reusable scratch math objects (zero per-frame GC pressure)
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._euler = new THREE.Euler();

    this.cloudPoints = null;
    this.vortexInstanced = null;
    this.spinorRibbonA = null;
    this.spinorRibbonB = null;
    this.potentialCore = null;
    this.potentialHalo = null;
    this.scatteringShells = [];
    this.vortexStreamlines = [];

    this.buildSelfConjugateSpinorCore();
    this.buildProbabilityCloud();
    this.buildHydrodynamicVortexRings();
    this.buildHelicalVortexStreamlines();
    this.buildScatteringBoundaryCones();

    this.update(0, 0.016);
  }

  /**
   * Tracks geometries and materials for deterministic GPU disposal.
   * @param {THREE.BufferGeometry|THREE.Material} resource
   */
  track(resource) {
    if (resource) {
      this.disposables.push(resource);
    }
    return resource;
  }

  /**
   * Builds the central Self-Conjugate Spinor Core (ψ = ψ^c):
   * Intertwined counter-braided torus-knot spinor filaments surrounding a phase-locked core.
   */
  buildSelfConjugateSpinorCore() {
    const coreGroup = new THREE.Group();
    coreGroup.name = 'MajoranaSelfConjugateCore';

    const nucleusGeo = this.track(new THREE.IcosahedronGeometry(0.46, 3));
    const nucleusMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.95,
        roughness: 0.12,
        metalness: 0.3,
        clearcoat: 1.0
      })
    );
    this.potentialCore = new THREE.Mesh(nucleusGeo, nucleusMat);
    coreGroup.add(this.potentialCore);

    const haloGeo = this.track(new THREE.SphereGeometry(0.88, 32, 32));
    const haloMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        wireframe: true,
        transparent: true,
        opacity: 0.18
      })
    );
    this.potentialHalo = new THREE.Mesh(haloGeo, haloMat);
    coreGroup.add(this.potentialHalo);

    // Braided Spinor Knot A (+ψ) and Conjugate Knot B (ψ^c)
    const knotGeoA = this.track(new THREE.TorusKnotGeometry(1.12, 0.024, 220, 16, 2, 3));
    const knotMatA = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x5ac8fa,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.85
      })
    );
    this.spinorRibbonA = new THREE.Mesh(knotGeoA, knotMatA);
    coreGroup.add(this.spinorRibbonA);

    const knotGeoB = this.track(new THREE.TorusKnotGeometry(1.12, 0.024, 220, 16, 3, 2));
    const knotMatB = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0x6366f1,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.85
      })
    );
    this.spinorRibbonB = new THREE.Mesh(knotGeoB, knotMatB);
    this.spinorRibbonB.rotation.set(Math.PI / 4, Math.PI / 3, 0);
    coreGroup.add(this.spinorRibbonB);

    this.rootRig.add(coreGroup);
  }

  /**
   * Builds the 3,400-particle Volumetti Quantum Probability Cloud with stratified
   * radial shells and spherical angular distribution.
   */
  buildProbabilityCloud() {
    const positions = new Float32Array(this.particleCount * 3);
    const seeds = new Float32Array(this.particleCount * 3);
    const polarities = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      // Stratified concentric radial shells (1.2 to 4.4 units)
      const shellBias = Math.pow(Math.random(), 0.72);
      const radius = 1.15 + shellBias * 3.25;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * TWO_PI;

      seeds[i3] = radius;
      seeds[i3 + 1] = theta;
      seeds[i3 + 2] = phi;

      positions[i3] = radius * Math.sin(theta) * Math.cos(phi);
      positions[i3 + 1] = radius * Math.cos(theta);
      positions[i3 + 2] = radius * Math.sin(theta) * Math.sin(phi);

      polarities[i] = i % 2 === 0 ? 1.0 : -1.0;
    }

    const geometry = this.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    geometry.setAttribute('aPolarity', new THREE.BufferAttribute(polarities, 1));

    const material = this.track(
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(MajoranaCloudShader.uniforms),
        vertexShader: MajoranaCloudShader.vertexShader,
        fragmentShader: MajoranaCloudShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    this.cloudPoints = new THREE.Points(geometry, material);
    this.cloudPoints.name = 'MajoranaProbabilityCloud';
    this.cloudPoints.frustumCulled = false;
    this.rootRig.add(this.cloudPoints);
  }

  /**
   * Builds InstancedMesh quantized hydrodynamic vortex rings representing
   * Majorana's Madelung fluid circulation loops around the scattering center.
   */
  buildHydrodynamicVortexRings() {
    const torusGeo = this.track(new THREE.TorusGeometry(1.0, 0.012, 12, 96));
    const torusMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.85,
        transparent: true,
        opacity: 0.62
      })
    );

    this.vortexInstanced = new THREE.InstancedMesh(torusGeo, torusMat, this.vortexRingCount);
    this.vortexInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.vortexInstanced.name = 'MajoranaQuantizedVortexRings';

    for (let i = 0; i < this.vortexRingCount; i++) {
      this._dummy.position.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.vortexInstanced.setMatrixAt(i, this._dummy.matrix);
      this._color.setHSL(0.54 + (i / this.vortexRingCount) * 0.18, 0.88, 0.58);
      this.vortexInstanced.setColorAt(i, this._color);
    }

    this.rootRig.add(this.vortexInstanced);
  }

  /**
   * Builds 12 helical hydrodynamic streamlines spiraling from the south pole through
   * the scattering potential to the north pole, visualizing probability current J.
   */
  buildHelicalVortexStreamlines() {
    const samplesPerLine = 90;

    for (let s = 0; s < this.streamlineCount; s++) {
      const baseAngle = (s / this.streamlineCount) * TWO_PI;
      const chirality = s % 2 === 0 ? 1 : -1;
      const points = [];

      for (let k = 0; k <= samplesPerLine; k++) {
        const t = k / samplesPerLine; // 0 -> 1 from bottom to top
        const vAngle = t * Math.PI;
        // Streamlines bow outward around the central scattering core
        const r = 1.45 + Math.sin(vAngle) * 2.15;
        const twist = baseAngle + chirality * (t * TWO_PI * 1.35);
        const y = -Math.cos(vAngle) * 3.4;

        points.push(new THREE.Vector3(Math.cos(twist) * r, y, Math.sin(twist) * r));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const geo = this.track(new THREE.BufferGeometry().setFromPoints(curve.getPoints(120)));
      const mat = this.track(
        new THREE.LineBasicMaterial({
          color: chirality > 0 ? 0x5ac8fa : 0x818cf8,
          transparent: true,
          opacity: 0.28
        })
      );
      const line = new THREE.Line(geo, mat);
      line.userData.chirality = chirality;
      line.userData.index = s;
      this.rootRig.add(line);
      this.vortexStreamlines.push(line);
    }
  }

  /**
   * Builds subtle asymptotic scattering cones and equatorial phase rings marking
   * differential cross-section angles θ in Majorana's S-matrix notebooks.
   */
  buildScatteringBoundaryCones() {
    const coneAngles = [0.42, 0.88];
    coneAngles.forEach((angle, idx) => {
      const height = 4.2;
      const radius = Math.tan(angle) * height;
      const coneGeo = this.track(new THREE.ConeGeometry(radius, height, 48, 1, true));
      coneGeo.translate(0, -height * 0.5, 0);

      const coneMat = this.track(
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0x5ac8fa : 0x6366f1,
          wireframe: true,
          transparent: true,
          opacity: 0.08,
          depthWrite: false
        })
      );

      const topCone = new THREE.Mesh(coneGeo, coneMat);
      topCone.rotation.x = Math.PI;
      this.rootRig.add(topCone);
      this.scatteringShells.push(topCone);

      const bottomCone = new THREE.Mesh(coneGeo, coneMat);
      this.rootRig.add(bottomCone);
      this.scatteringShells.push(bottomCone);
    });
  }

  /**
   * Returns interactive parameter definitions for the HUD parameter dock.
   */
  getParameterSchema() {
    return [
      {
        key: 'chiralCoupling',
        label: 'Chiral Spinor Coupling',
        min: 0.3,
        max: 2.0,
        step: 0.05,
        value: this.params.chiralCoupling
      },
      {
        key: 'vortexDensity',
        label: 'Vortex Circulation (ℏ/m)',
        min: 0.2,
        max: 2.2,
        step: 0.05,
        value: this.params.vortexDensity
      },
      {
        key: 'waveCoherence',
        label: 'Wave Interference Coherence',
        min: 0.0,
        max: 1.5,
        step: 0.05,
        value: this.params.waveCoherence
      },
      {
        key: 'scatterOrder',
        label: 'Partial Wave Order (ℓ)',
        min: 1.0,
        max: 6.0,
        step: 1.0,
        value: this.params.scatterOrder
      }
    ];
  }

  /**
   * Updates simulation parameters from UI sliders or external controllers.
   * @param {Object} next
   */
  setParams(next = {}) {
    Object.assign(this.params, next);
  }

  /**
   * Per-frame update advancing the GPU probability cloud uniforms, quantized
   * hydrodynamic vortex rings, and self-conjugate spinor knots.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   * @param {Object} externalParams
   */
  update(elapsedTime = 0, deltaTime = 0.016, externalParams = {}) {
    if (externalParams) {
      Object.assign(this.params, externalParams);
    }

    const chiral = this.params.chiralCoupling;
    const vortex = this.params.vortexDensity;
    const coherence = this.params.waveCoherence;
    const order = this.params.scatterOrder;

    // Update GPU shader uniforms for the 3,400-particle probability cloud
    if (this.cloudPoints?.material?.uniforms) {
      const u = this.cloudPoints.material.uniforms;
      u.uTime.value = elapsedTime;
      u.uChiralCoupling.value = chiral;
      u.uVortexStrength.value = vortex;
      u.uWaveCoherence.value = coherence;
      u.uScatterMode.value = order;
    }

    // Rotate self-conjugate spinor core & dual torus knots
    if (this.potentialCore) {
      const pulse = 1.0 + Math.sin(elapsedTime * 2.4) * 0.08 * coherence;
      this.potentialCore.scale.setScalar(pulse);
      this.potentialCore.rotation.y = elapsedTime * 0.55 * vortex;
    }
    if (this.potentialHalo) {
      this.potentialHalo.rotation.y = -elapsedTime * 0.32;
      this.potentialHalo.rotation.z = elapsedTime * 0.21;
    }
    if (this.spinorRibbonA && this.spinorRibbonB) {
      this.spinorRibbonA.rotation.x = elapsedTime * 0.42 * chiral;
      this.spinorRibbonA.rotation.y = elapsedTime * 0.65 * vortex;

      this.spinorRibbonB.rotation.x = -elapsedTime * 0.42 * chiral + Math.PI / 4;
      this.spinorRibbonB.rotation.y = -elapsedTime * 0.65 * vortex + Math.PI / 3;
    }

    // Update quantized hydrodynamic vortex rings migrating along polar flux lines
    if (this.vortexInstanced) {
      for (let i = 0; i < this.vortexRingCount; i++) {
        const phase = ((i / this.vortexRingCount) + elapsedTime * 0.11 * vortex) % 1.0;
        const polarAngle = phase * Math.PI;
        const ringRadius = Math.max(Math.sin(polarAngle) * 3.15, 0.25);
        const y = -Math.cos(polarAngle) * 3.1;

        const tiltX = Math.PI / 2 + Math.sin(elapsedTime * 0.6 + i) * 0.18 * chiral;
        const tiltZ = Math.cos(elapsedTime * 0.5 + i * 0.7) * 0.18 * chiral;

        this._dummy.position.set(0, y, 0);
        this._dummy.rotation.set(tiltX, elapsedTime * 0.4 * (i % 2 === 0 ? 1 : -1), tiltZ);
        this._dummy.scale.set(ringRadius, ringRadius, 1.0);
        this._dummy.updateMatrix();
        this.vortexInstanced.setMatrixAt(i, this._dummy.matrix);

        const hue = i % 2 === 0 ? 0.54 : 0.68;
        const lightness = 0.42 + 0.26 * Math.sin(polarAngle);
        this._color.setHSL(hue, 0.88, lightness);
        this.vortexInstanced.setColorAt(i, this._color);
      }
      this.vortexInstanced.instanceMatrix.needsUpdate = true;
      if (this.vortexInstanced.instanceColor) {
        this.vortexInstanced.instanceColor.needsUpdate = true;
      }
    }

    // Animate helical vortex streamlines
    for (let i = 0; i < this.vortexStreamlines.length; i++) {
      const line = this.vortexStreamlines[i];
      const dir = line.userData.chirality || 1;
      line.rotation.y = elapsedTime * 0.24 * vortex * dir;
      line.scale.setScalar(0.92 + 0.08 * chiral);
    }

    this.rootRig.rotation.y = Math.sin(elapsedTime * 0.15) * 0.16;
  }

  /**
   * Releases all GPU geometries and materials owned by this world.
   */
  dispose() {
    for (const item of this.disposables) {
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    }
    this.disposables.length = 0;
    this.scatteringShells.length = 0;
    this.vortexStreamlines.length = 0;
    this.group.clear();
  }
}

export function createMajoranaCloudWorld(options = {}) {
  return new MajoranaCloudWorld(options);
}

export default MajoranaCloudWorld;
