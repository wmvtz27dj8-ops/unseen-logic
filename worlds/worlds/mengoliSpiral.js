/**
 * UNSEEN LOGIC — World 02: Pietro Mengoli's Alternating Harmonic Series & Quadratures (1650)
 * File 6/16: worlds/mengoliSpiral.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const LN_2 = Math.LN2; // ~0.6931471805599453

export class MengoliSpiralWorld {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.id = 'mengoli';
    this.group = new THREE.Group();
    this.group.name = 'MengoliHarmonicSpiralWorld';

    this.params = {
      seriesTerms: 96,
      alternationExponent: 1.0,
      spiralPitch: 1.05,
      quadratureSpread: 1.0,
      fieldExpansion: 1.0,
      ...(options.params || {})
    };

    this.maxTerms = 140;
    this.quadraturePairs = 28;
    this.particleCount = 420;

    this.disposables = [];
    this.rootRig = new THREE.Group();
    this.group.add(this.rootRig);

    // Reusable scratch objects to prevent per-frame GC allocations
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._vecA = new THREE.Vector3();
    this._vecB = new THREE.Vector3();
    this._upVec = new THREE.Vector3(0, 1, 0);

    this.termMesh = null;
    this.connectorMesh = null;
    this.trajectoryLine = null;
    this.upperBoundLine = null;
    this.lowerBoundLine = null;
    this.inscribedMesh = null;
    this.circumscribedMesh = null;
    this.streamPoints = null;
    this.streamSeeds = new Float32Array(this.particleCount * 3);

    this.ln2Ring = null;
    this.ln2Core = null;
    this.envelopeRings = [];

    this.buildReferenceFrameAndLn2Attractor();
    this.buildAlternatingHarmonicInstances();
    this.buildConvergenceTrajectoryLines();
    this.buildHyperbolicQuadratureWings();
    this.buildAsymptoticParticleStream();

    // Perform initial synchronous layout so frame 0 is fully populated
    this.update(0, 0.016);
  }

  /**
   * Registers any Three.js geometry or material for guaranteed GPU cleanup.
   * @param {THREE.BufferGeometry|THREE.Material} resource
   */
  track(resource) {
    if (resource) {
      this.disposables.push(resource);
    }
    return resource;
  }

  /**
   * Builds the central asymptotic axis, the golden ln(2) equilibrium attractor ring,
   * and radial polar reference rings representing partial sum convergence bounds.
   */
  buildReferenceFrameAndLn2Attractor() {
    const frameGroup = new THREE.Group();
    frameGroup.name = 'MengoliLn2AttractorFrame';

    // Central vertical convergence axis (x = 0, z = 0)
    const axisGeo = this.track(new THREE.CylinderGeometry(0.015, 0.015, 7.6, 16));
    const axisMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        transparent: true,
        opacity: 0.42
      })
    );
    const centralAxis = new THREE.Mesh(axisGeo, axisMat);
    frameGroup.add(centralAxis);

    // Golden Equilibrium Ring representing exact limit S_∞ = ln(2)
    const ln2Radius = LN_2 * 2.6;
    const ln2RingGeo = this.track(new THREE.TorusGeometry(ln2Radius, 0.026, 24, 160));
    const ln2RingMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd60a,
        emissive: 0xffb703,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.9
      })
    );
    this.ln2Ring = new THREE.Mesh(ln2RingGeo, ln2RingMat);
    this.ln2Ring.rotation.x = Math.PI / 2;
    frameGroup.add(this.ln2Ring);

    // Luminous central focal octahedron at the convergence limit
    const coreGeo = this.track(new THREE.OctahedronGeometry(0.24, 1));
    const coreMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0xffd60a,
        emissiveIntensity: 0.9,
        roughness: 0.1,
        metalness: 0.4,
        clearcoat: 1.0
      })
    );
    this.ln2Core = new THREE.Mesh(coreGeo, coreMat);
    frameGroup.add(this.ln2Core);

    // Concentric polar boundary rings at r = 1.0, ln(2), and 0.5 scaled units
    const ringRadii = [1.0 * 2.6, 0.5 * 2.6, 1.35 * 2.6];
    ringRadii.forEach((radius, idx) => {
      const rGeo = this.track(new THREE.TorusGeometry(radius, 0.008, 12, 128));
      const rMat = this.track(
        new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0x38bdf8 : 0x475569,
          transparent: true,
          opacity: idx === 0 ? 0.35 : 0.22
        })
      );
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = (idx - 1) * 1.4;
      frameGroup.add(ring);
      this.envelopeRings.push(ring);
    });

    this.rootRig.add(frameGroup);
  }

  /**
   * Creates InstancedMeshes for each term (-1)^(n+1) / n^p in Mengoli's alternating
   * harmonic spiral, plus radial impulse struts linking each partial sum to the axis.
   */
  buildAlternatingHarmonicInstances() {
    // Stepped harmonic prism nodes
    const prismGeo = this.track(new THREE.BoxGeometry(0.16, 0.09, 0.26));
    const prismMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.22,
        metalness: 0.78
      })
    );

    this.termMesh = new THREE.InstancedMesh(prismGeo, prismMat, this.maxTerms);
    this.termMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.termMesh.name = 'MengoliHarmonicTermNodes';

    // Radial magnitude bars encoding |a_n| = 1 / n^p
    const strutGeo = this.track(new THREE.CylinderGeometry(0.011, 0.011, 1.0, 8));
    const strutMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.58
      })
    );

    this.connectorMesh = new THREE.InstancedMesh(strutGeo, strutMat, this.maxTerms);
    this.connectorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.connectorMesh.name = 'MengoliTermMagnitudeStruts';

    // Initialize instanceColor buffers immediately
    for (let i = 0; i < this.maxTerms; i++) {
      this._dummy.position.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.termMesh.setMatrixAt(i, this._dummy.matrix);
      this.connectorMesh.setMatrixAt(i, this._dummy.matrix);

      this._color.setHex(i % 2 === 0 ? 0x5ac8fa : 0x818cf8);
      this.termMesh.setColorAt(i, this._color);
      this.connectorMesh.setColorAt(i, this._color);
    }

    this.rootRig.add(this.termMesh);
    this.rootRig.add(this.connectorMesh);
  }

  /**
   * Builds continuous 3D line trajectories tracing:
   * 1. The oscillating partial sum path S_n
   * 2. The monotonically decreasing odd upper envelope S_{2k-1}
   * 3. The monotonically increasing even lower envelope S_{2k}
   */
  buildConvergenceTrajectoryLines() {
    const createDynamicLine = (pointCount, colorHex, opacity) => {
      const positions = new Float32Array(pointCount * 3);
      const geo = this.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = this.track(
        new THREE.LineBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity
        })
      );
      return new THREE.Line(geo, mat);
    };

    this.trajectoryLine = createDynamicLine(this.maxTerms, 0xffd60a, 0.85);
    this.upperBoundLine = createDynamicLine(Math.ceil(this.maxTerms / 2), 0x30d158, 0.65);
    this.lowerBoundLine = createDynamicLine(Math.floor(this.maxTerms / 2), 0x5ac8fa, 0.65);

    this.rootRig.add(this.trajectoryLine);
    this.rootRig.add(this.upperBoundLine);
    this.rootRig.add(this.lowerBoundLine);
  }

  /**
   * Builds Mengoli's Hyperbolic Quadrature Wings (area under y = 1/x):
   * Dual symmetrical arrays of inscribed (emerald) and circumscribed (indigo)
   * rectangular prisms demonstrating geometric squeeze convergence.
   */
  buildHyperbolicQuadratureWings() {
    const totalBars = this.quadraturePairs * 2; // Mirrored left & right hyperbolic wings

    const inscribedGeo = this.track(new THREE.BoxGeometry(0.11, 1.0, 0.14));
    inscribedGeo.translate(0, 0.5, 0);
    const inscribedMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0x30d158,
        emissive: 0x059669,
        emissiveIntensity: 0.35,
        roughness: 0.2,
        metalness: 0.65,
        transparent: true,
        opacity: 0.72
      })
    );
    this.inscribedMesh = new THREE.InstancedMesh(inscribedGeo, inscribedMat, totalBars);
    this.inscribedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const circumGeo = this.track(new THREE.BoxGeometry(0.13, 1.0, 0.16));
    circumGeo.translate(0, 0.5, 0);
    const circumMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        wireframe: true,
        transparent: true,
        opacity: 0.42
      })
    );
    this.circumscribedMesh = new THREE.InstancedMesh(circumGeo, circumMat, totalBars);
    this.circumscribedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.rootRig.add(this.inscribedMesh);
    this.rootRig.add(this.circumscribedMesh);
  }

  /**
   * Builds a swirling stream of convergence particles spiraling inward toward ln(2).
   */
  buildAsymptoticParticleStream() {
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      this.streamSeeds[i3] = Math.random(); // radial phase
      this.streamSeeds[i3 + 1] = Math.random() * TWO_PI; // angle
      this.streamSeeds[i3 + 2] = 0.4 + Math.random() * 0.8; // speed factor

      this._color.setHSL(0.54 + Math.random() * 0.14, 0.9, 0.65);
      colors[i3] = this._color.r;
      colors[i3 + 1] = this._color.g;
      colors[i3 + 2] = this._color.b;
    }

    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = this.track(
      new THREE.PointsMaterial({
        size: 0.055,
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );

    this.streamPoints = new THREE.Points(geo, mat);
    this.rootRig.add(this.streamPoints);
  }

  /**
   * Exposes live mathematical controls to the bottom-right HUD parameter dock.
   */
  getParameterSchema() {
    return [
      {
        key: 'seriesTerms',
        label: 'Partial Sum Terms (N)',
        min: 12,
        max: 140,
        step: 2,
        value: this.params.seriesTerms
      },
      {
        key: 'alternationExponent',
        label: 'Harmonic Exponent (p)',
        min: 0.45,
        max: 2.0,
        step: 0.05,
        value: this.params.alternationExponent
      },
      {
        key: 'spiralPitch',
        label: 'Helical Spiral Pitch',
        min: 0.3,
        max: 1.8,
        step: 0.05,
        value: this.params.spiralPitch
      },
      {
        key: 'quadratureSpread',
        label: 'Quadrature Wing Span',
        min: 0.5,
        max: 1.6,
        step: 0.05,
        value: this.params.quadratureSpread
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
   * Advances the alternating harmonic spiral, hyperbolic quadrature bounds, and particle flow.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   * @param {Object} externalParams
   */
  update(elapsedTime = 0, deltaTime = 0.016, externalParams = {}) {
    if (externalParams) {
      Object.assign(this.params, externalParams);
    }

    const activeCount = Math.min(Math.max(Math.round(this.params.seriesTerms), 4), this.maxTerms);
    const exponent = Math.max(this.params.alternationExponent, 0.2);
    const pitch = this.params.spiralPitch;

    // Compute exact alternating series partial sums & limit estimate
    let partialSum = 0;
    const trajAttr = this.trajectoryLine.geometry.getAttribute('position');
    const upperAttr = this.upperBoundLine.geometry.getAttribute('position');
    const lowerAttr = this.lowerBoundLine.geometry.getAttribute('position');

    let upperIdx = 0;
    let lowerIdx = 0;

    // Estimate asymptotic limit for current exponent p via averaged final pair
    let limitEstimate = LN_2;
    if (Math.abs(exponent - 1.0) > 0.01) {
      let sTemp = 0;
      for (let k = 1; k <= 200; k++) {
        sTemp += (k % 2 === 1 ? 1 : -1) / Math.pow(k, exponent);
      }
      limitEstimate = sTemp;
    }

    const limitRadius = limitEstimate * 2.6;
    if (this.ln2Ring) {
      const ringScale = Math.max(limitEstimate / LN_2, 0.25);
      this.ln2Ring.scale.setScalar(ringScale);
      this.ln2Ring.rotation.z = elapsedTime * 0.25;
    }
    if (this.ln2Core) {
      this.ln2Core.rotation.y = elapsedTime * 0.65;
      this.ln2Core.rotation.x = elapsedTime * 0.4;
    }

    const verticalSpan = 5.4 * pitch;

    for (let i = 0; i < this.maxTerms; i++) {
      const n = i + 1;
      const sign = n % 2 === 1 ? 1 : -1;
      const termMag = 1.0 / Math.pow(n, exponent);
      partialSum += sign * termMag;

      if (i < activeCount) {
        const progress = i / Math.max(activeCount - 1, 1);
        const theta = n * 0.44 + elapsedTime * 0.35;
        const y = (progress - 0.5) * verticalSpan;

        // Radial coordinate oscillates tightly around the exact convergence radius
        const radialOscillation = (partialSum - limitEstimate) * 3.8;
        const radius = Math.max(limitRadius + radialOscillation, 0.28);

        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;

        // Position & orient the stepped harmonic prism
        this._dummy.position.set(x, y, z);
        this._dummy.rotation.set(0, -theta, sign * 0.22);
        const nodeScale = THREE.MathUtils.clamp(0.45 + termMag * 1.4, 0.38, 1.45);
        this._dummy.scale.set(nodeScale, 1.0, nodeScale);
        this._dummy.updateMatrix();
        this.termMesh.setMatrixAt(i, this._dummy.matrix);

        // Color differentiates positive odd terms (+1/n^p) from negative even terms (-1/n^p)
        if (sign > 0) {
          this._color.setHSL(0.44, 0.88, 0.54); // Emerald-Cyan (+1/n)
        } else {
          this._color.setHSL(0.66, 0.85, 0.62); // Indigo-Violet (-1/n)
        }
        this.termMesh.setColorAt(i, this._color);

        // Radial strut connecting the oscillating partial sum to the equilibrium ring
        const eqX = Math.cos(theta) * limitRadius;
        const eqZ = Math.sin(theta) * limitRadius;
        this._vecA.set(eqX, y, eqZ);
        this._vecB.set(x, y, z);
        const strutLen = Math.max(this._vecA.distanceTo(this._vecB), 0.01);

        this._dummy.position.lerpVectors(this._vecA, this._vecB, 0.5);
        this._dummy.rotation.set(0, -theta, Math.PI / 2);
        this._dummy.scale.set(1, strutLen, 1);
        this._dummy.updateMatrix();
        this.connectorMesh.setMatrixAt(i, this._dummy.matrix);
        this.connectorMesh.setColorAt(i, this._color);

        trajAttr.setXYZ(i, x, y, z);

        if (sign > 0 && upperIdx < upperAttr.count) {
          upperAttr.setXYZ(upperIdx, x, y, z);
          upperIdx += 1;
        } else if (sign < 0 && lowerIdx < lowerAttr.count) {
          lowerAttr.setXYZ(lowerIdx, x, y, z);
          lowerIdx += 1;
        }
      } else {
        // Hide inactive instances cleanly at zero scale
        this._dummy.position.set(0, 0, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.termMesh.setMatrixAt(i, this._dummy.matrix);
        this.connectorMesh.setMatrixAt(i, this._dummy.matrix);
      }
    }

    this.termMesh.instanceMatrix.needsUpdate = true;
    this.connectorMesh.instanceMatrix.needsUpdate = true;
    if (this.termMesh.instanceColor) this.termMesh.instanceColor.needsUpdate = true;
    if (this.connectorMesh.instanceColor) this.connectorMesh.instanceColor.needsUpdate = true;

    this.trajectoryLine.geometry.setDrawRange(0, activeCount);
    trajAttr.needsUpdate = true;

    this.upperBoundLine.geometry.setDrawRange(0, upperIdx);
    upperAttr.needsUpdate = true;

    this.lowerBoundLine.geometry.setDrawRange(0, lowerIdx);
    lowerAttr.needsUpdate = true;

    this.updateQuadratureWings(elapsedTime);
    this.updateParticleStream(elapsedTime);

    this.envelopeRings.forEach((ring, idx) => {
      ring.rotation.z = elapsedTime * 0.14 * (idx % 2 === 0 ? 1 : -1);
    });

    this.rootRig.rotation.y = Math.sin(elapsedTime * 0.16) * 0.18;
  }

  /**
   * Updates Mengoli's mirrored Hyperbolic Quadrature bars (y = 1 / x^p),
   * showing inscribed vs. circumscribed Riemann bounds.
   * @param {number} elapsedTime
   */
  updateQuadratureWings(elapsedTime) {
    if (!this.inscribedMesh || !this.circumscribedMesh) return;

    const spread = this.params.quadratureSpread;
    const exponent = this.params.alternationExponent;
    const pulse = 1.0 + Math.sin(elapsedTime * 1.4) * 0.04;
    let instanceIdx = 0;

    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < this.quadraturePairs; k++) {
        const t = k / this.quadraturePairs;
        const x = (1.15 + t * 3.4) * spread;
        const xNext = (1.15 + ((k + 1) / this.quadraturePairs) * 3.4) * spread;

        // Inscribed height f(x_{k+1}) vs Circumscribed height f(x_k)
        const hInscribed = (2.1 / Math.pow(xNext, exponent)) * pulse;
        const hCircum = (2.1 / Math.pow(x, exponent)) * pulse;

        const arcAngle = side * (t * 0.65 - 0.32) + Math.sin(elapsedTime * 0.3) * 0.08;
        const posX = side * x * Math.cos(arcAngle * 0.35);
        const posZ = Math.sin(arcAngle) * 1.65;
        const baseY = -2.85 * this.params.spiralPitch;

        this._dummy.position.set(posX, baseY, posZ);
        this._dummy.rotation.set(0, -arcAngle, 0);
        this._dummy.scale.set(spread, Math.max(hInscribed, 0.05), spread);
        this._dummy.updateMatrix();
        this.inscribedMesh.setMatrixAt(instanceIdx, this._dummy.matrix);

        this._dummy.scale.set(spread, Math.max(hCircum, 0.06), spread);
        this._dummy.updateMatrix();
        this.circumscribedMesh.setMatrixAt(instanceIdx, this._dummy.matrix);

        instanceIdx += 1;
      }
    }

    this.inscribedMesh.instanceMatrix.needsUpdate = true;
    this.circumscribedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Animates asymptotic energy particles converging toward the ln(2) torus.
   * @param {number} elapsedTime
   */
  updateParticleStream(elapsedTime) {
    if (!this.streamPoints) return;

    const posAttr = this.streamPoints.geometry.getAttribute('position');
    const targetR = LN_2 * 2.6;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const seedPhase = this.streamSeeds[i3];
      const baseAngle = this.streamSeeds[i3 + 1];
      const speed = this.streamSeeds[i3 + 2];

      const cycle = (seedPhase + elapsedTime * 0.14 * speed) % 1.0;
      const damp = Math.exp(-cycle * 2.6);
      const sign = i % 2 === 0 ? 1 : -1;

      const r = targetR + sign * damp * 2.6 * Math.cos(cycle * Math.PI * 5);
      const angle = baseAngle + cycle * TWO_PI * 1.5;
      const y = (cycle - 0.5) * 4.8 * this.params.spiralPitch;

      posAttr.setXYZ(i, Math.cos(angle) * r, y, Math.sin(angle) * r);
    }

    posAttr.needsUpdate = true;
  }

  /**
   * Disposes all GPU geometries and materials owned by this world.
   */
  dispose() {
    for (const item of this.disposables) {
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      }
    }
    this.disposables.length = 0;
    this.envelopeRings.length = 0;
    this.group.clear();
  }
}

export function createMengoliSpiralWorld(options = {}) {
  return new MengoliSpiralWorld(options);
}

export default MengoliSpiralWorld;
