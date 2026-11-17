/**
 * UNSEEN LOGIC — World 06: Francis Skinner's Cyclic Prime-Residue & Modular Lattices (1934–1939)
 * File 10/16: worlds/skinnerLattice.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

const PRIME_TABLE = [
  7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59,
  61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127
];

/**
 * Computes (base^exp) mod mod safely using integer binary exponentiation.
 * @param {number} base
 * @param {number} exp
 * @param {number} mod
 * @returns {number}
 */
function modPow(base, exp, mod) {
  let result = 1;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0) {
    if ((e & 1) === 1) {
      result = (result * b) % mod;
    }
    b = (b * b) % mod;
    e >>= 1;
  }
  return result;
}

/**
 * Snaps an arbitrary integer to the nearest prime in PRIME_TABLE.
 * @param {number} value
 * @returns {number}
 */
function snapToPrime(value) {
  let closest = PRIME_TABLE[0];
  let minDiff = Math.abs(value - closest);
  for (let i = 1; i < PRIME_TABLE.length; i++) {
    const diff = Math.abs(value - PRIME_TABLE[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closest = PRIME_TABLE[i];
    }
  }
  return closest;
}

export class SkinnerLatticeWorld {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.id = 'skinner';
    this.group = new THREE.Group();
    this.group.name = 'SkinnerModularLatticeWorld';

    this.params = {
      primeModulus: 37,
      primitiveBase: 5,
      latticeDepth: 5,
      helicalTwist: 0.78,
      orbitCadence: 0.45,
      fieldExpansion: 1.0,
      ...(options.params || {})
    };

    this.maxModulus = 127;
    this.maxDepth = 8;
    this.maxClockNodes = this.maxModulus * this.maxDepth;
    this.maxChordSegments = this.maxModulus * this.maxDepth;
    this.outerRadius = 3.45;
    this.innerRadius = 1.15;

    this.disposables = [];
    this.rootRig = new THREE.Group();
    this.group.add(this.rootRig);

    // Reusable math scratch objects (zero per-frame GC allocations)
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._colorA = new THREE.Color();
    this._colorB = new THREE.Color();
    this._vecA = new THREE.Vector3();
    this._vecB = new THREE.Vector3();
    this._upVec = new THREE.Vector3(0, 1, 0);

    // Pre-allocated sequence buffers for cyclic powers a^k mod p
    this.residueSequence = new Int32Array(this.maxModulus + 2);
    this.quadraticResidueFlags = new Int8Array(this.maxModulus + 1);
    this.activePrime = 37;
    this.activeBase = 5;
    this.multiplicativeOrder = 36;

    // Scene sub-assemblies
    this.clockRings = [];
    this.clockNodesMesh = null;
    this.legendrePillarsMesh = null;
    this.planarChordWeb = null;
    this.helicalScrollWeb = null;
    this.identityBeacon = null;
    this.cycleTracerOrb = null;
    this.coreCrystal = null;
    this.coreCage = null;

    this.buildModularClockFrame();
    this.buildConcentricResidueNodes();
    this.buildQuadraticResiduePillars();
    this.buildCyclicChordWebs();
    this.buildFermatIdentityCore();

    // Synchronize frame 0 state immediately
    this.update(0, 0.016);
  }

  /**
   * Registers geometries and materials for deterministic GPU disposal.
   * @param {THREE.BufferGeometry|THREE.Material} resource
   */
  track(resource) {
    if (resource) {
      this.disposables.push(resource);
    }
    return resource;
  }

  /**
   * Computes the cyclic orbit sequence x_k = a^k mod p (for k = 0 .. p-1),
   * multiplicative order ord_p(a), and quadratic residue Legendre flags.
   * @param {number} p
   * @param {number} a
   */
  computeNumberTheoreticState(p, a) {
    this.activePrime = p;
    let base = ((Math.round(a) % p) + p) % p;
    if (base <= 1) base = 2;
    this.activeBase = base;

    // Compute sequence x_k = a^k mod p
    let current = 1;
    let order = p - 1;
    let foundOrder = false;

    for (let k = 0; k <= p; k++) {
      this.residueSequence[k] = current;
      if (k > 0 && current === 1 && !foundOrder) {
        order = k;
        foundOrder = true;
      }
      current = (current * base) % p;
    }
    this.multiplicativeOrder = order;

    // Evaluate Legendre symbols (n / p) via Euler's criterion: n^((p-1)/2) mod p
    this.quadraticResidueFlags.fill(0);
    const halfExp = (p - 1) >> 1;
    for (let n = 1; n < p; n++) {
      const eulerVal = modPow(n, halfExp, p);
      this.quadraticResidueFlags[n] = eulerVal === 1 ? 1 : -1;
    }
  }

  /**
   * Builds concentric modular clock rings and the vertical scroll axis representing
   * Francis Skinner's continuous 20-foot modular arithmetic paper rolls.
   */
  buildModularClockFrame() {
    const frameGroup = new THREE.Group();
    frameGroup.name = 'SkinnerModularClockFrame';

    // Central vertical scroll axis
    const axisGeo = this.track(new THREE.CylinderGeometry(0.014, 0.014, 6.8, 12));
    const axisMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        transparent: true,
        opacity: 0.36
      })
    );
    frameGroup.add(new THREE.Mesh(axisGeo, axisMat));

    // Concentric modular clock rings for each scroll tier
    for (let d = 0; d < this.maxDepth; d++) {
      const t = d / Math.max(this.maxDepth - 1, 1);
      const radius = THREE.MathUtils.lerp(this.outerRadius, this.innerRadius, t);
      const isOuter = d === 0;

      const ringGeo = this.track(new THREE.TorusGeometry(radius, isOuter ? 0.016 : 0.009, 14, 144));
      const ringMat = this.track(
        new THREE.MeshStandardMaterial({
          color: isOuter ? 0x5ac8fa : 0x475569,
          emissive: isOuter ? 0x0284c7 : 0x1e293b,
          emissiveIntensity: isOuter ? 0.65 : 0.25,
          roughness: 0.25,
          metalness: 0.85,
          transparent: true,
          opacity: isOuter ? 0.82 : 0.38
        })
      );
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      frameGroup.add(ring);
      this.clockRings.push(ring);
    }

    // Zero-residue & Fermat Identity (1 mod p) Anchor Monolith at angle 0
    const anchorGeo = this.track(new THREE.OctahedronGeometry(0.14, 0));
    const anchorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd60a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.95,
        roughness: 0.18,
        metalness: 0.8
      })
    );
    this.identityBeacon = new THREE.Mesh(anchorGeo, anchorMat);
    this.identityBeacon.position.set(this.outerRadius, 0, 0);
    frameGroup.add(this.identityBeacon);

    this.rootRig.add(frameGroup);
  }

  /**
   * Builds InstancedMesh residue nodes distributed around the concentric modular clock rings.
   */
  buildConcentricResidueNodes() {
    const nodeGeo = this.track(new THREE.OctahedronGeometry(0.068, 1));
    const nodeMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.8
      })
    );

    this.clockNodesMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, this.maxClockNodes);
    this.clockNodesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clockNodesMesh.name = 'SkinnerResidueClockNodes';

    for (let i = 0; i < this.maxClockNodes; i++) {
      this._dummy.position.set(0, 0, 0);
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.clockNodesMesh.setMatrixAt(i, this._dummy.matrix);
      this._color.setHex(0x5ac8fa);
      this.clockNodesMesh.setColorAt(i, this._color);
    }

    this.rootRig.add(this.clockNodesMesh);
  }

  /**
   * Builds outer perimeter Legendre Quadratic Residue symmetry columns:
   * Quadratic residues (+1) rise above the modular plane in emerald/cyan;
   * non-residues (-1) project below in indigo/amber.
   */
  buildQuadraticResiduePillars() {
    const pillarGeo = this.track(new THREE.BoxGeometry(0.055, 1.0, 0.055));
    pillarGeo.translate(0, 0.5, 0);
    const pillarMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.22,
        metalness: 0.72,
        transparent: true,
        opacity: 0.78
      })
    );

    this.legendrePillarsMesh = new THREE.InstancedMesh(pillarGeo, pillarMat, this.maxModulus);
    this.legendrePillarsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.legendrePillarsMesh.name = 'SkinnerLegendreSymmetryPillars';

    for (let i = 0; i < this.maxModulus; i++) {
      this._dummy.position.set(0, 0, 0);
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.legendrePillarsMesh.setMatrixAt(i, this._dummy.matrix);
      this._color.setHex(0x30d158);
      this.legendrePillarsMesh.setColorAt(i, this._color);
    }

    this.rootRig.add(this.legendrePillarsMesh);
  }

  /**
   * Builds two vertex-colored modular chord webs:
   * 1. Planar modular multiplication chords (a^k mod p -> a^(k+1) mod p) on the primary ring
   * 2. 3D helical scroll chords ascending through Skinner's concentric scroll tiers
   */
  buildCyclicChordWebs() {
    const createVertexColoredSegments = (segmentCount, opacity) => {
      const vertexCount = segmentCount * 2;
      const positions = new Float32Array(vertexCount * 3);
      const colors = new Float32Array(vertexCount * 3);

      const geo = this.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = this.track(
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );

      return new THREE.LineSegments(geo, mat);
    };

    this.planarChordWeb = createVertexColoredSegments(this.maxModulus, 0.52);
    this.helicalScrollWeb = createVertexColoredSegments(this.maxChordSegments, 0.85);

    this.rootRig.add(this.planarChordWeb);
    this.rootRig.add(this.helicalScrollWeb);
  }

  /**
   * Builds the central Fermat Little Theorem Symmetry Core & real-time Orbit Tracer Orb.
   */
  buildFermatIdentityCore() {
    const coreGeo = this.track(new THREE.IcosahedronGeometry(0.64, 1));
    const coreMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.65,
        roughness: 0.16,
        metalness: 0.85,
        clearcoat: 1.0
      })
    );
    this.coreCrystal = new THREE.Mesh(coreGeo, coreMat);
    this.rootRig.add(this.coreCrystal);

    const cageGeo = this.track(new THREE.IcosahedronGeometry(0.76, 1));
    const cageMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        wireframe: true,
        transparent: true,
        opacity: 0.35
      })
    );
    this.coreCage = new THREE.Mesh(cageGeo, cageMat);
    this.rootRig.add(this.coreCage);

    // Glowing phase packet traversing the cyclic power sequence
    const orbGeo = this.track(new THREE.SphereGeometry(0.11, 20, 20));
    const orbMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xffffff
      })
    );
    this.cycleTracerOrb = new THREE.Mesh(orbGeo, orbMat);
    this.rootRig.add(this.cycleTracerOrb);
  }

  /**
   * Exposes interactive parameter controls to the bottom-right HUD parameter dock.
   */
  getParameterSchema() {
    return [
      {
        key: 'primeModulus',
        label: 'Prime Modulus (p)',
        min: 7,
        max: 127,
        step: 2,
        value: this.params.primeModulus
      },
      {
        key: 'primitiveBase',
        label: 'Generator Root (a)',
        min: 2,
        max: 31,
        step: 1,
        value: this.params.primitiveBase
      },
      {
        key: 'latticeDepth',
        label: 'Scroll Tier Depth',
        min: 1,
        max: 8,
        step: 1,
        value: this.params.latticeDepth
      },
      {
        key: 'helicalTwist',
        label: '3D Scroll Elevation',
        min: 0.0,
        max: 1.6,
        step: 0.05,
        value: this.params.helicalTwist
      }
    ];
  }

  /**
   * Merges updated parameter values from HUD sliders or external controllers.
   * @param {Object} next
   */
  setParams(next = {}) {
    Object.assign(this.params, next);
  }

  /**
   * Advances the modular clock-rings, cyclic prime-residue chords, Legendre symmetry
   * columns, and real-time Fermat orbit tracer.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   * @param {Object} externalParams
   */
  update(elapsedTime = 0, deltaTime = 0.016, externalParams = {}) {
    if (externalParams) {
      Object.assign(this.params, externalParams);
    }

    const p = snapToPrime(this.params.primeModulus);
    const a = Math.max(2, Math.round(this.params.primitiveBase));
    const depth = THREE.MathUtils.clamp(Math.round(this.params.latticeDepth), 1, this.maxDepth);
    const elevationSpan = this.params.helicalTwist * 3.2;

    this.computeNumberTheoreticState(p, a);

    const isPrimitiveRoot = this.multiplicativeOrder === p - 1;
    const activeStep = (elapsedTime * this.params.orbitCadence * 6.0) % Math.max(this.multiplicativeOrder, 1);

    // 1. Update concentric clock ring vertical elevations
    for (let d = 0; d < this.maxDepth; d++) {
      const ring = this.clockRings[d];
      if (!ring) continue;
      if (d < depth) {
        ring.visible = true;
        const normD = depth === 1 ? 0 : d / (depth - 1) - 0.5;
        ring.position.y = normD * elevationSpan;
        ring.rotation.z = elapsedTime * 0.08 * (d % 2 === 0 ? 1 : -1);
      } else {
        ring.visible = false;
      }
    }

    // Position Fermat Identity Anchor at residue 1 (angle = 2π * 1 / p) on outer tier
    const identityAngle = (1 / p) * TWO_PI;
    const baseTierY = depth === 1 ? 0 : -0.5 * elevationSpan;
    if (this.identityBeacon) {
      this.identityBeacon.position.set(
        Math.cos(identityAngle) * this.outerRadius,
        baseTierY,
        Math.sin(identityAngle) * this.outerRadius
      );
      this.identityBeacon.rotation.y = elapsedTime * 1.4;
    }

    // 2. Update InstancedMesh Residue Clock Nodes across active tiers
    let nodeIdx = 0;
    for (let d = 0; d < this.maxDepth; d++) {
      const tierActive = d < depth;
      const tDepth = depth === 1 ? 0 : d / (depth - 1);
      const radius = THREE.MathUtils.lerp(this.outerRadius, this.innerRadius, tDepth);
      const yBase = (depth === 1 ? 0 : tDepth - 0.5) * elevationSpan;

      for (let r = 0; r < this.maxModulus; r++) {
        if (tierActive && r < p) {
          const theta = (r / p) * TWO_PI;
          const x = Math.cos(theta) * radius;
          const z = Math.sin(theta) * radius;

          // Highlight residue 1 (Fermat return) and active wave resonance
          const wave = Math.sin(theta * 3.0 - elapsedTime * 2.2 + d * 0.9);
          const isIdentity = r === 1;
          const isZero = r === 0;
          const scale = isIdentity ? 1.55 : isZero ? 0.65 : 0.85 + 0.25 * wave;

          this._dummy.position.set(x, yBase + wave * 0.04, z);
          this._dummy.rotation.set(0, -theta, elapsedTime * 0.6);
          this._dummy.scale.setScalar(scale);
          this._dummy.updateMatrix();
          this.clockNodesMesh.setMatrixAt(nodeIdx, this._dummy.matrix);

          if (isIdentity) {
            this._color.setHex(0xffd60a); // Gold for 1 (mod p)
          } else if (isPrimitiveRoot) {
            this._color.setHSL(0.52 + (r / p) * 0.16, 0.88, 0.56);
          } else {
            this._color.setHSL(0.64 + (r / p) * 0.14, 0.82, 0.54);
          }
          this.clockNodesMesh.setColorAt(nodeIdx, this._color);
        } else {
          this._dummy.position.set(0, 0, 0);
          this._dummy.scale.set(0, 0, 0);
          this._dummy.updateMatrix();
          this.clockNodesMesh.setMatrixAt(nodeIdx, this._dummy.matrix);
        }
        nodeIdx += 1;
      }
    }

    this.clockNodesMesh.instanceMatrix.needsUpdate = true;
    if (this.clockNodesMesh.instanceColor) {
      this.clockNodesMesh.instanceColor.needsUpdate = true;
    }

    // 3. Update Perimeter Legendre Quadratic Residue Symmetry Pillars
    const pillarRingRadius = this.outerRadius + 0.36;
    for (let r = 0; r < this.maxModulus; r++) {
      if (r > 0 && r < p) {
        const legendre = this.quadraticResidueFlags[r]; // +1 or -1
        const theta = (r / p) * TWO_PI;
        const x = Math.cos(theta) * pillarRingRadius;
        const z = Math.sin(theta) * pillarRingRadius;
        const pulse = 0.85 + 0.2 * Math.sin(elapsedTime * 2.0 + r * 0.4);
        const height = legendre * 0.68 * pulse;

        this._dummy.position.set(x, baseTierY, z);
        this._dummy.rotation.set(0, -theta, 0);
        this._dummy.scale.set(1.0, height, 1.0);
        this._dummy.updateMatrix();
        this.legendrePillarsMesh.setMatrixAt(r, this._dummy.matrix);

        if (legendre > 0) {
          this._color.setHex(0x30d158); // Quadratic Residue (+1)
        } else {
          this._color.setHex(0x818cf8); // Quadratic Non-Residue (-1)
        }
        this.legendrePillarsMesh.setColorAt(r, this._color);
      } else {
        this._dummy.position.set(0, 0, 0);
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.legendrePillarsMesh.setMatrixAt(r, this._dummy.matrix);
      }
    }

    this.legendrePillarsMesh.instanceMatrix.needsUpdate = true;
    if (this.legendrePillarsMesh.instanceColor) {
      this.legendrePillarsMesh.instanceColor.needsUpdate = true;
    }

    // 4. Update Planar Modular Chord Web & 3D Helical Scroll Chords
    const planarPos = this.planarChordWeb.geometry.getAttribute('position');
    const planarCol = this.planarChordWeb.geometry.getAttribute('color');
    const scrollPos = this.helicalScrollWeb.geometry.getAttribute('position');
    const scrollCol = this.helicalScrollWeb.geometry.getAttribute('color');

    const cycleLen = Math.min(this.multiplicativeOrder, p - 1);

    // Planar chords on base ring (k = 0 .. cycleLen - 1)
    for (let k = 0; k < cycleLen; k++) {
      const rStart = this.residueSequence[k];
      const rEnd = this.residueSequence[k + 1];

      const aStart = (rStart / p) * TWO_PI;
      const aEnd = (rEnd / p) * TWO_PI;

      const vIdx = k * 2;
      planarPos.setXYZ(
        vIdx,
        Math.cos(aStart) * this.outerRadius,
        baseTierY,
        Math.sin(aStart) * this.outerRadius
      );
      planarPos.setXYZ(
        vIdx + 1,
        Math.cos(aEnd) * this.outerRadius,
        baseTierY,
        Math.sin(aEnd) * this.outerRadius
      );

      const tCycle = k / Math.max(cycleLen, 1);
      this._colorA.setHSL(0.53 + tCycle * 0.16, 0.92, 0.58);
      this._colorB.setHSL(0.53 + ((k + 1) / Math.max(cycleLen, 1)) * 0.16, 0.92, 0.62);

      planarCol.setXYZ(vIdx, this._colorA.r, this._colorA.g, this._colorA.b);
      planarCol.setXYZ(vIdx + 1, this._colorB.r, this._colorB.g, this._colorB.b);
    }

    this.planarChordWeb.geometry.setDrawRange(0, cycleLen * 2);
    planarPos.needsUpdate = true;
    planarCol.needsUpdate = true;

    // 3D Helical Scroll Chords connecting successive powers across concentric scroll tiers
    const totalScrollSteps = Math.min(cycleLen * depth, this.maxChordSegments);
    for (let s = 0; s < totalScrollSteps; s++) {
      const k0 = s % cycleLen;
      const k1 = (s + 1) % cycleLen;

      const r0 = this.residueSequence[k0];
      const r1 = this.residueSequence[k1];

      const t0 = s / Math.max(totalScrollSteps, 1);
      const t1 = (s + 1) / Math.max(totalScrollSteps, 1);

      const rad0 = THREE.MathUtils.lerp(this.outerRadius, this.innerRadius, t0);
      const rad1 = THREE.MathUtils.lerp(this.outerRadius, this.innerRadius, t1);

      const y0 = (t0 - 0.5) * elevationSpan;
      const y1 = (t1 - 0.5) * elevationSpan;

      const ang0 = (r0 / p) * TWO_PI;
      const ang1 = (r1 / p) * TWO_PI;

      const vIdx = s * 2;
      scrollPos.setXYZ(vIdx, Math.cos(ang0) * rad0, y0, Math.sin(ang0) * rad0);
      scrollPos.setXYZ(vIdx + 1, Math.cos(ang1) * rad1, y1, Math.sin(ang1) * rad1);

      const isReturnToOne = r1 === 1;
      this._colorA.setHSL(0.50 + t0 * 0.18, 0.94, 0.58);
      if (isReturnToOne) {
        this._colorB.setHex(0xffd60a); // Gold flash when a^k ≡ 1 (mod p)
      } else {
        this._colorB.setHSL(0.50 + t1 * 0.18, 0.94, 0.62);
      }

      scrollCol.setXYZ(vIdx, this._colorA.r, this._colorA.g, this._colorA.b);
      scrollCol.setXYZ(vIdx + 1, this._colorB.r, this._colorB.g, this._colorB.b);
    }

    this.helicalScrollWeb.geometry.setDrawRange(0, totalScrollSteps * 2);
    scrollPos.needsUpdate = true;
    scrollCol.needsUpdate = true;

    // 5. Animate Orbit Tracer Orb smoothly along the active cyclic residue trajectory
    if (this.cycleTracerOrb && cycleLen > 0) {
      const stepFloor = Math.floor(activeStep) % cycleLen;
      const stepFrac = activeStep - Math.floor(activeStep);
      const resA = this.residueSequence[stepFloor];
      const resB = this.residueSequence[(stepFloor + 1) % cycleLen];

      const angA = (resA / p) * TWO_PI;
      const angB = (resB / p) * TWO_PI;

      this._vecA.set(Math.cos(angA) * this.outerRadius, baseTierY, Math.sin(angA) * this.outerRadius);
      this._vecB.set(Math.cos(angB) * this.outerRadius, baseTierY, Math.sin(angB) * this.outerRadius);
      this.cycleTracerOrb.position.lerpVectors(this._vecA, this._vecB, stepFrac);
    }

    // 6. Rotate central Fermat Symmetry Crystal
    if (this.coreCrystal && this.coreCage) {
      this.coreCrystal.rotation.y = elapsedTime * 0.35;
      this.coreCrystal.rotation.x = Math.sin(elapsedTime * 0.4) * 0.25;
      this.coreCrystal.material.emissive.setHex(isPrimitiveRoot ? 0x0ea5e9 : 0x6366f1);

      this.coreCage.rotation.y = -elapsedTime * 0.24;
      this.coreCage.rotation.z = elapsedTime * 0.18;
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
    this.clockRings.length = 0;
    this.group.clear();
  }
}

export function createSkinnerLatticeWorld(options = {}) {
  return new SkinnerLatticeWorld(options);
}

export default SkinnerLatticeWorld;
