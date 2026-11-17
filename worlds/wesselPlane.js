/**
 * UNSEEN LOGIC — World 01: Caspar Wessel's Geometric Complex Plane & Spatial Rotors (1799)
 * File 5/16: worlds/wesselPlane.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

export class WesselPlaneWorld {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.id = 'wessel';
    this.group = new THREE.Group();
    this.group.name = 'WesselComplexPlaneWorld';

    this.params = {
      phaseAlpha: 0.78,
      phaseBeta: 0.54,
      spatialTilt: 0.45,
      rotorHarmonic: 2.0,
      autoSweep: 0.35,
      fieldExpansion: 1.0,
      ...(options.params || {})
    };

    this.disposables = [];
    this.gimbalRings = [];
    this.vectors = {};
    this.arcs = {};
    this.connectors = {};

    // Reusable math scratch objects (zero per-frame GC churn)
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._upVec = new THREE.Vector3(0, 1, 0);
    this._dirVec = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._tiltQuat = new THREE.Quaternion();
    this._euler = new THREE.Euler();

    this.latticeCount = 21;
    this.latticeTotal = this.latticeCount * this.latticeCount;
    this.latticeMesh = null;

    this.rootRig = new THREE.Group();
    this.group.add(this.rootRig);

    this.buildCoordinateFrame();
    this.buildSpatialDirectionSphere();
    this.buildDirectionVectors();
    this.buildComplexPhaseLattice();
    this.buildRotorHelixRibbon();
  }

  /**
   * Registers geometry or material for deterministic GPU disposal.
   * @param {THREE.BufferGeometry|THREE.Material} resource
   */
  track(resource) {
    if (resource) {
      this.disposables.push(resource);
    }
    return resource;
  }

  /**
   * Builds Wessel's orthogonal Real (+1/-1), Imaginary (+ε/-ε), and Spatial (+η/-η) axes
   * along with polar concentric rings and angular graduations.
   */
  buildCoordinateFrame() {
    const frameGroup = new THREE.Group();
    frameGroup.name = 'WesselCoordinateFrame';

    // Concentric polar circles on the complex plane (XZ plane; Y is spatial η axis)
    const radii = [1.2, 2.4, 3.6, 4.8];
    radii.forEach((radius, idx) => {
      const segments = 128;
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * TWO_PI;
        pts.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
      }
      const geo = this.track(new THREE.BufferGeometry().setFromPoints(pts));
      const isUnitCircle = idx === 1;
      const mat = this.track(
        new THREE.LineBasicMaterial({
          color: isUnitCircle ? 0x5ac8fa : 0x334155,
          transparent: true,
          opacity: isUnitCircle ? 0.65 : 0.32
        })
      );
      const circle = new THREE.Line(geo, mat);
      frameGroup.add(circle);
    });

    // Radial spokes every 30 degrees
    const spokePositions = [];
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * TWO_PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      spokePositions.push(cosA * 0.4, 0, sinA * 0.4);
      spokePositions.push(cosA * 4.8, 0, sinA * 4.8);
    }
    const spokeGeo = this.track(new THREE.BufferGeometry());
    spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokePositions, 3));
    const spokeMat = this.track(
      new THREE.LineBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.22
      })
    );
    frameGroup.add(new THREE.LineSegments(spokeGeo, spokeMat));

    // Three principal orthogonal axes: Real (X), Imaginary ε (Z), Spatial Zenith η (Y)
    const axisSpecs = [
      { dir: new THREE.Vector3(1, 0, 0), length: 5.2, color: 0x5ac8fa },
      { dir: new THREE.Vector3(0, 0, 1), length: 5.2, color: 0x818cf8 },
      { dir: new THREE.Vector3(0, 1, 0), length: 4.2, color: 0x30d158 }
    ];

    axisSpecs.forEach(({ dir, length, color }) => {
      const rodGeo = this.track(new THREE.CylinderGeometry(0.014, 0.014, length * 2, 12));
      const rodMat = this.track(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.55
        })
      );
      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.quaternion.setFromUnitVectors(this._upVec, dir);
      frameGroup.add(rod);

      // Positive pole terminal marker
      const tipGeo = this.track(new THREE.OctahedronGeometry(0.09, 0));
      const tipMat = this.track(
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.85,
          roughness: 0.2
        })
      );
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.copy(dir).multiplyScalar(length);
      frameGroup.add(tip);
    });

    this.rootRig.add(frameGroup);
  }

  /**
   * Builds Wessel's 3D unit direction sphere & articulated spatial gimbal rings,
   * illustrating how 2D complex direction lines generalize to 3D spherical rotations.
   */
  buildSpatialDirectionSphere() {
    const sphereGroup = new THREE.Group();
    sphereGroup.name = 'WesselSpatialSphere';

    const shellGeo = this.track(new THREE.IcosahedronGeometry(2.4, 3));
    const shellMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.14,
        roughness: 0.12,
        metalness: 0.1,
        transmission: 0.62,
        transparent: true,
        opacity: 0.24,
        wireframe: false,
        depthWrite: false
      })
    );
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    sphereGroup.add(shellMesh);

    const cageGeo = this.track(new THREE.IcosahedronGeometry(2.41, 2));
    const cageMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.11
      })
    );
    sphereGroup.add(new THREE.Mesh(cageGeo, cageMat));

    const ringDefinitions = [
      { radius: 2.44, tube: 0.016, color: 0x5ac8fa, rot: [Math.PI / 2, 0, 0] },
      { radius: 2.52, tube: 0.014, color: 0x818cf8, rot: [0, 0, 0] },
      { radius: 2.60, tube: 0.012, color: 0x30d158, rot: [0, Math.PI / 2, 0] }
    ];

    ringDefinitions.forEach((def) => {
      const geo = this.track(new THREE.TorusGeometry(def.radius, def.tube, 20, 144));
      const mat = this.track(
        new THREE.MeshStandardMaterial({
          color: def.color,
          emissive: def.color,
          emissiveIntensity: 0.6,
          roughness: 0.22,
          metalness: 0.85
        })
      );
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.set(...def.rot);
      sphereGroup.add(ring);
      this.gimbalRings.push(ring);
    });

    this.spatialSphere = sphereGroup;
    this.rootRig.add(sphereGroup);
  }

  /**
   * Builds the three interactive complex direction vectors:
   * - z1 (Cyan): First direction segment at angle α
   * - z2 (Indigo): Second direction segment at angle β
   * - z1 · z2 (Gold/Emerald): Geometric product at summed angle α + β lifted into 3D space
   */
  buildDirectionVectors() {
    this.vectors.z1 = this.createVectorAssembly(0x5ac8fa, 1.0);
    this.vectors.z2 = this.createVectorAssembly(0x818cf8, 1.0);
    this.vectors.product = this.createVectorAssembly(0xffd60a, 1.25);

    this.rootRig.add(this.vectors.z1.group);
    this.rootRig.add(this.vectors.z2.group);
    this.rootRig.add(this.vectors.product.group);

    // Angle sector arcs for α, β, and α + β
    this.arcs.alpha = this.createArcLine(64, 0x5ac8fa);
    this.arcs.beta = this.createArcLine(64, 0x818cf8);
    this.arcs.sum = this.createArcLine(96, 0xffd60a);

    this.rootRig.add(this.arcs.alpha);
    this.rootRig.add(this.arcs.beta);
    this.rootRig.add(this.arcs.sum);

    // Dashed geometric projection lines connecting z1, z2, and product tip
    const connGeo = this.track(new THREE.BufferGeometry());
    connGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    const connMat = this.track(
      new THREE.LineDashedMaterial({
        color: 0xe2e8f0,
        dashSize: 0.14,
        gapSize: 0.09,
        transparent: true,
        opacity: 0.55
      })
    );
    this.connectors.triangle = new THREE.Line(connGeo, connMat);
    this.rootRig.add(this.connectors.triangle);
  }

  /**
   * Helper to build an articulated 3D arrow (shaft + cone head + glowing node).
   * @param {number} colorHex
   * @param {number} scale
   */
  createVectorAssembly(colorHex, scale = 1.0) {
    const group = new THREE.Group();

    const shaftGeo = this.track(new THREE.CylinderGeometry(0.026 * scale, 0.026 * scale, 1.0, 16));
    shaftGeo.translate(0, 0.5, 0);
    const shaftMat = this.track(
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.8
      })
    );
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    group.add(shaft);

    const headGeo = this.track(new THREE.ConeGeometry(0.085 * scale, 0.24 * scale, 20));
    const headMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: colorHex,
        emissiveIntensity: 0.9,
        roughness: 0.15,
        metalness: 0.5
      })
    );
    const head = new THREE.Mesh(headGeo, headMat);
    group.add(head);

    const orbGeo = this.track(new THREE.SphereGeometry(0.11 * scale, 16, 16));
    const orbMat = this.track(
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.42
      })
    );
    const orb = new THREE.Mesh(orbGeo, orbMat);
    group.add(orb);

    return { group, shaft, head, orb };
  }

  /**
   * Updates a vector assembly to point from origin to targetPos.
   * @param {Object} assembly
   * @param {THREE.Vector3} targetPos
   */
  orientVectorAssembly(assembly, targetPos) {
    const length = Math.max(targetPos.length(), 0.05);
    this._dirVec.copy(targetPos).normalize();
    this._quat.setFromUnitVectors(this._upVec, this._dirVec);

    assembly.group.quaternion.copy(this._quat);
    const shaftLen = Math.max(length - 0.18, 0.05);
    assembly.shaft.scale.set(1, shaftLen, 1);
    assembly.head.position.set(0, shaftLen + 0.08, 0);
    assembly.orb.position.set(0, length, 0);
  }

  /**
   * Creates a dynamic line geometry for angular sector arcs.
   * @param {number} segments
   * @param {number} colorHex
   */
  createArcLine(segments, colorHex) {
    const positions = new Float32Array((segments + 1) * 3);
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = this.track(
      new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85
      })
    );
    const line = new THREE.Line(geo, mat);
    line.userData.segments = segments;
    return line;
  }

  /**
   * Updates vertex positions of an angular sector arc on the tilted spatial plane.
   * @param {THREE.Line} line
   * @param {number} radius
   * @param {number} startAngle
   * @param {number} endAngle
   * @param {number} tiltAngle
   */
  updateArcLine(line, radius, startAngle, endAngle, tiltAngle) {
    const segments = line.userData.segments || 64;
    const posAttr = line.geometry.getAttribute('position');
    const cosTilt = Math.cos(tiltAngle);
    const sinTilt = Math.sin(tiltAngle);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = startAngle + (endAngle - startAngle) * t;
      const x = Math.cos(theta) * radius;
      const flatZ = Math.sin(theta) * radius;
      const y = flatZ * sinTilt;
      const z = flatZ * cosTilt;
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  }

  /**
   * Builds an InstancedMesh complex phase-field lattice across the plane,
   * visualizing harmonic phase ripples and local conformal rotation.
   */
  buildComplexPhaseLattice() {
    const nodeGeo = this.track(new THREE.BoxGeometry(0.075, 0.075, 0.075));
    const nodeMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.25,
        metalness: 0.75
      })
    );

    this.latticeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, this.latticeTotal);
    this.latticeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.latticeMesh.name = 'WesselPhaseLattice';
    this.rootRig.add(this.latticeMesh);
  }

  /**
   * Builds a continuous 3D helical rotor ribbon showing continuous exponential mapping e^(iθ + η).
   */
  buildRotorHelixRibbon() {
    const points = [];
    const totalPts = 180;
    for (let i = 0; i <= totalPts; i++) {
      const t = (i / totalPts) * TWO_PI * 2;
      const r = 1.35 + 0.55 * Math.sin(t * 0.5);
      points.push(new THREE.Vector3(Math.cos(t) * r, (i / totalPts - 0.5) * 2.4, Math.sin(t) * r));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = this.track(new THREE.TubeGeometry(curve, 180, 0.016, 10, false));
    const tubeMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.48,
        roughness: 0.2
      })
    );
    this.rotorRibbon = new THREE.Mesh(tubeGeo, tubeMat);
    this.rootRig.add(this.rotorRibbon);
  }

  /**
   * Returns interactive parameter definitions for the bottom-right HUD dock.
   */
  getParameterSchema() {
    return [
      {
        key: 'phaseAlpha',
        label: 'Direction Angle α (rad)',
        min: 0.0,
        max: 6.28,
        step: 0.02,
        value: this.params.phaseAlpha
      },
      {
        key: 'phaseBeta',
        label: 'Rotor Angle β (rad)',
        min: 0.0,
        max: 6.28,
        step: 0.02,
        value: this.params.phaseBeta
      },
      {
        key: 'spatialTilt',
        label: '3D Spatial Lift (η)',
        min: -1.2,
        max: 1.2,
        step: 0.02,
        value: this.params.spatialTilt
      },
      {
        key: 'rotorHarmonic',
        label: 'Harmonic Order (n)',
        min: 1.0,
        max: 6.0,
        step: 0.5,
        value: this.params.rotorHarmonic
      }
    ];
  }

  /**
   * Updates simulation parameters from HUD sliders or external controllers.
   * @param {Object} next
   */
  setParams(next = {}) {
    Object.assign(this.params, next);
  }

  /**
   * Per-frame animation and mathematical update loop.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   * @param {Object} externalParams
   */
  update(elapsedTime = 0, deltaTime = 0.016, externalParams = {}) {
    if (externalParams) {
      Object.assign(this.params, externalParams);
    }

    const sweep = elapsedTime * 0.22;
    const alpha = this.params.phaseAlpha + sweep * 0.45;
    const beta = this.params.phaseBeta + sweep * 0.3;
    const sumAngle = alpha + beta;
    const tilt = this.params.spatialTilt;
    const harmonic = this.params.rotorHarmonic;

    const r1 = 2.4;
    const r2 = 2.4;
    const rProd = 3.35;

    // Compute 3D endpoints for z1, z2, and geometric product z1 * z2
    const p1 = new THREE.Vector3(Math.cos(alpha) * r1, 0, Math.sin(alpha) * r1);
    const p2 = new THREE.Vector3(Math.cos(beta) * r2, 0, Math.sin(beta) * r2);

    const flatProdZ = Math.sin(sumAngle) * rProd;
    const pProd = new THREE.Vector3(
      Math.cos(sumAngle) * rProd,
      flatProdZ * Math.sin(tilt),
      flatProdZ * Math.cos(tilt)
    );

    this.orientVectorAssembly(this.vectors.z1, p1);
    this.orientVectorAssembly(this.vectors.z2, p2);
    this.orientVectorAssembly(this.vectors.product, pProd);

    // Update angular sector arcs
    this.updateArcLine(this.arcs.alpha, 1.05, 0, alpha, 0);
    this.updateArcLine(this.arcs.beta, 1.35, 0, beta, 0);
    this.updateArcLine(this.arcs.sum, 1.75, 0, sumAngle, tilt);

    // Update dashed geometric construction triangle
    const connAttr = this.connectors.triangle.geometry.getAttribute('position');
    connAttr.setXYZ(0, p1.x, p1.y, p1.z);
    connAttr.setXYZ(1, pProd.x, pProd.y, pProd.z);
    connAttr.setXYZ(2, p2.x, p2.y, p2.z);
    connAttr.setXYZ(3, 0, 0, 0);
    connAttr.needsUpdate = true;
    this.connectors.triangle.geometry.computeBoundingSphere();
    this.connectors.triangle.computeLineDistances();

    // Rotate Wessel's spatial gimbal rings
    if (this.spatialSphere) {
      this.spatialSphere.rotation.x = tilt * 0.65;
      this.spatialSphere.rotation.y = elapsedTime * 0.12;
    }
    this.gimbalRings.forEach((ring, idx) => {
      ring.rotation.z = elapsedTime * 0.18 * (idx % 2 === 0 ? 1 : -1) + tilt * 0.4;
    });

    if (this.rotorRibbon) {
      this.rotorRibbon.rotation.y = -elapsedTime * 0.16;
      this.rotorRibbon.rotation.z = Math.sin(elapsedTime * 0.4) * tilt * 0.45;
    }

    // Update 21x21 InstancedMesh Complex Phase Lattice
    if (this.latticeMesh) {
      const halfSpan = 4.4;
      const step = (halfSpan * 2) / (this.latticeCount - 1);
      let idx = 0;

      for (let ix = 0; ix < this.latticeCount; ix++) {
        const x = -halfSpan + ix * step;
        for (let iz = 0; iz < this.latticeCount; iz++) {
          const z = -halfSpan + iz * step;
          const r = Math.hypot(x, z);
          const theta = Math.atan2(z, x);

          // Complex rotor phase wave: Re(z^n * e^(-i*(α+β)))
          const phase = theta * harmonic - sumAngle;
          const envelope = Math.exp(-r * 0.18);
          const waveY = Math.cos(phase) * envelope * 0.72 * Math.cos(tilt * 0.5) - 0.55;

          this._dummy.position.set(x, waveY, z);
          this._dummy.rotation.set(phase * 0.35, theta + sumAngle, tilt * 0.5);

          const scaleFactor = 0.55 + 0.75 * Math.abs(Math.sin(phase)) * envelope;
          this._dummy.scale.set(scaleFactor, scaleFactor * (1 + Math.abs(waveY)), scaleFactor);
          this._dummy.updateMatrix();
          this.latticeMesh.setMatrixAt(idx, this._dummy.matrix);

          // Hue encodes complex argument arg(w)
          const hue = (((phase / TWO_PI) % 1) + 1) % 1;
          this._color.setHSL(0.52 + hue * 0.24, 0.85, 0.45 + 0.25 * envelope);
          this.latticeMesh.setColorAt(idx, this._color);

          idx += 1;
        }
      }

      this.latticeMesh.instanceMatrix.needsUpdate = true;
      if (this.latticeMesh.instanceColor) {
        this.latticeMesh.instanceColor.needsUpdate = true;
      }
    }

    // Gentle holistic floating cadence
    this.rootRig.rotation.y = Math.sin(elapsedTime * 0.18) * 0.14;
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
    this.gimbalRings.length = 0;
    this.group.clear();
  }
}

export function createWesselPlaneWorld(options = {}) {
  return new WesselPlaneWorld(options);
}

export default WesselPlaneWorld;
