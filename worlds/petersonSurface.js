/**
 * UNSEEN LOGIC — World 05: Karl Peterson's Differential Surface Geometry & Curvature Tensors (1853)
 * File 9/16: worlds/petersonSurface.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;

export class PetersonSurfaceWorld {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.id = 'peterson';
    this.group = new THREE.Group();
    this.group.name = 'PetersonCurvatureManifoldWorld';

    this.params = {
      bendingAngle: 0.42,
      curvatureRipple: 0.18,
      tensorScale: 1.0,
      autoBendSpeed: 0.25,
      fieldExpansion: 1.0,
      ...(options.params || {})
    };

    // Parametric grid resolution (u in [-PI, PI], v in [-1.28, 1.28])
    this.uSegments = 96;
    this.vSegments = 48;
    this.uCount = this.uSegments + 1;
    this.vCount = this.vSegments + 1;
    this.vertexTotal = this.uCount * this.vCount;
    this.surfaceScale = 1.42;

    // Darboux principal curvature tensor sample grid
    this.tensorCols = 16;
    this.tensorRows = 8;
    this.tensorTotal = this.tensorCols * this.tensorRows;

    this.disposables = [];
    this.rootRig = new THREE.Group();
    this.group.add(this.rootRig);

    // Pre-allocated typed buffers for zero-GC real-time differential geometry evaluation
    this.posBuffer = new Float32Array(this.vertexTotal * 3);
    this.normBuffer = new Float32Array(this.vertexTotal * 3);
    this.colorBuffer = new Float32Array(this.vertexTotal * 3);
    this.gaussianKBuffer = new Float32Array(this.vertexTotal);
    this.principalAngleBuffer = new Float32Array(this.vertexTotal);

    // Reusable scratch vectors & matrices
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._upVec = new THREE.Vector3(0, 1, 0);
    this._ru = new THREE.Vector3();
    this._rv = new THREE.Vector3();
    this._ruu = new THREE.Vector3();
    this._ruv = new THREE.Vector3();
    this._rvv = new THREE.Vector3();
    this._normal = new THREE.Vector3();
    this._tangentU = new THREE.Vector3();
    this._tangentV = new THREE.Vector3();
    this._quatNormal = new THREE.Quaternion();
    this._quatTwist = new THREE.Quaternion();

    // Scene sub-assemblies
    this.manifoldMesh = null;
    this.manifoldWireframe = null;
    this.normalNeedlesMesh = null;
    this.principalBar1Mesh = null;
    this.principalBar2Mesh = null;
    this.uGeodesicLines = [];
    this.vGeodesicLines = [];
    this.indicatrixGroup = null;
    this.dupinHyperbolaA = null;
    this.dupinHyperbolaB = null;

    this.buildReferenceFrame();
    this.buildManifoldSurface();
    this.buildCurvatureTensorFrames();
    this.buildIsoparametricGeodesics();
    this.buildOsculatingIndicatrix();

    // Populate initial frame synchronously
    this.update(0, 0.016);
  }

  /**
   * Registers any Three.js geometry or material for deterministic GPU disposal.
   * @param {THREE.BufferGeometry|THREE.Material} resource
   */
  track(resource) {
    if (resource) {
      this.disposables.push(resource);
    }
    return resource;
  }

  /**
   * Builds the ambient ambient Gaussian reference frame, polar base rings,
   * and vertical isometric axis spindle.
   */
  buildReferenceFrame() {
    const frameGroup = new THREE.Group();
    frameGroup.name = 'PetersonReferenceFrame';

    const axisGeo = this.track(new THREE.CylinderGeometry(0.012, 0.012, 6.4, 12));
    const axisMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        transparent: true,
        opacity: 0.32
      })
    );
    frameGroup.add(new THREE.Mesh(axisGeo, axisMat));

    const ringHeights = [-2.6, 0.0, 2.6];
    ringHeights.forEach((yPos, idx) => {
      const radius = idx === 1 ? 3.25 : 2.65;
      const ringGeo = this.track(new THREE.TorusGeometry(radius, 0.008, 12, 128));
      const ringMat = this.track(
        new THREE.MeshBasicMaterial({
          color: idx === 1 ? 0x5ac8fa : 0x334155,
          transparent: true,
          opacity: idx === 1 ? 0.34 : 0.22
        })
      );
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = yPos;
      frameGroup.add(ring);
    });

    this.rootRig.add(frameGroup);
  }

  /**
   * Builds the primary 2D parametric Riemannian manifold mesh with per-vertex
   * Gaussian curvature color attributes and an overlaid isoparametric coordinate net.
   */
  buildManifoldSurface() {
    const geometry = this.track(new THREE.BufferGeometry());
    const indices = [];

    for (let iv = 0; iv < this.vSegments; iv++) {
      for (let iu = 0; iu < this.uSegments; iu++) {
        const a = iv * this.uCount + iu;
        const b = a + 1;
        const c = (iv + 1) * this.uCount + iu;
        const d = c + 1;

        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(this.posBuffer, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.normBuffer, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colorBuffer, 3));

    const surfaceMat = this.track(
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.22,
        metalness: 0.35,
        clearcoat: 0.85,
        clearcoatRoughness: 0.14,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88
      })
    );

    this.manifoldMesh = new THREE.Mesh(geometry, surfaceMat);
    this.manifoldMesh.name = 'PetersonIsometricManifold';
    this.rootRig.add(this.manifoldMesh);

    const wireMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        wireframe: true,
        transparent: true,
        opacity: 0.09,
        depthWrite: false
      })
    );
    this.manifoldWireframe = new THREE.Mesh(geometry, wireMat);
    this.rootRig.add(this.manifoldWireframe);
  }

  /**
   * Builds InstancedMesh Darboux Moving Frames across the manifold:
   * - Surface Normal Needle N (Cyan/White)
   * - Principal Curvature Direction e1 crossbar (Emerald, max curvature κ1)
   * - Principal Curvature Direction e2 crossbar (Amber, min curvature κ2)
   */
  buildCurvatureTensorFrames() {
    const needleGeo = this.track(new THREE.CylinderGeometry(0.009, 0.015, 0.42, 8));
    needleGeo.translate(0, 0.21, 0);
    const needleMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.75,
        roughness: 0.2
      })
    );
    this.normalNeedlesMesh = new THREE.InstancedMesh(needleGeo, needleMat, this.tensorTotal);
    this.normalNeedlesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const bar1Geo = this.track(new THREE.BoxGeometry(0.32, 0.014, 0.014));
    const bar1Mat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x30d158,
        transparent: true,
        opacity: 0.88
      })
    );
    this.principalBar1Mesh = new THREE.InstancedMesh(bar1Geo, bar1Mat, this.tensorTotal);
    this.principalBar1Mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const bar2Geo = this.track(new THREE.BoxGeometry(0.014, 0.014, 0.32));
    const bar2Mat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xffd60a,
        transparent: true,
        opacity: 0.88
      })
    );
    this.principalBar2Mesh = new THREE.InstancedMesh(bar2Geo, bar2Mat, this.tensorTotal);
    this.principalBar2Mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.rootRig.add(this.normalNeedlesMesh);
    this.rootRig.add(this.principalBar1Mesh);
    this.rootRig.add(this.principalBar2Mesh);
  }

  /**
   * Builds luminous isoparametric geodesic curves (constant u meridians & constant v parallels)
   * that visibly bend without stretching during isometric deformation.
   */
  buildIsoparametricGeodesics() {
    const uLineCount = 8;
    for (let i = 0; i < uLineCount; i++) {
      const geo = this.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.vCount * 3), 3));
      const mat = this.track(
        new THREE.LineBasicMaterial({
          color: 0x5ac8fa,
          transparent: true,
          opacity: 0.62
        })
      );
      const line = new THREE.Line(geo, mat);
      line.userData.uIndex = Math.round((i / uLineCount) * this.uSegments);
      this.rootRig.add(line);
      this.uGeodesicLines.push(line);
    }

    const vLineCount = 5;
    for (let j = 0; j < vLineCount; j++) {
      const geo = this.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.uCount * 3), 3));
      const mat = this.track(
        new THREE.LineBasicMaterial({
          color: j === 2 ? 0xffd60a : 0x818cf8,
          transparent: true,
          opacity: j === 2 ? 0.85 : 0.55
        })
      );
      const line = new THREE.Line(geo, mat);
      line.userData.vIndex = Math.round(((j + 0.5) / vLineCount) * this.vSegments);
      this.rootRig.add(line);
      this.vGeodesicLines.push(line);
    }
  }

  /**
   * Builds a floating Dupin Curvature Indicatrix above the manifold apex,
   * illustrating conjugate hyperbolic asymptotes (L du^2 + 2M du dv + N dv^2 = ±1).
   */
  buildOsculatingIndicatrix() {
    this.indicatrixGroup = new THREE.Group();
    this.indicatrixGroup.position.set(0, 3.05, 0);

    const ringGeo = this.track(new THREE.TorusGeometry(0.95, 0.01, 12, 96));
    const ringMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        transparent: true,
        opacity: 0.42
      })
    );
    const outerRing = new THREE.Mesh(ringGeo, ringMat);
    outerRing.rotation.x = Math.PI / 2;
    this.indicatrixGroup.add(outerRing);

    const createHyperbolaBranch = (signX, colorHex) => {
      const pts = [];
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps - 0.5) * 1.9;
        const x = signX * 0.28 * Math.cosh(t);
        const z = 0.28 * Math.sinh(t);
        pts.push(new THREE.Vector3(x, 0, z));
      }
      const geo = this.track(new THREE.BufferGeometry().setFromPoints(pts));
      const mat = this.track(
        new THREE.LineBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.85
        })
      );
      return new THREE.Line(geo, mat);
    };

    this.dupinHyperbolaA = createHyperbolaBranch(1, 0x30d158);
    this.dupinHyperbolaB = createHyperbolaBranch(-1, 0xffd60a);
    this.indicatrixGroup.add(this.dupinHyperbolaA);
    this.indicatrixGroup.add(this.dupinHyperbolaB);

    this.rootRig.add(this.indicatrixGroup);
  }

  /**
   * Evaluates the Peterson–Bonnet isometric Catenoid-to-Helicoid immersion r(u, v; α)
   * plus optional non-isometric curvature ripple perturbation.
   * @param {number} u
   * @param {number} v
   * @param {number} alpha
   * @param {number} ripple
   * @param {number} elapsed
   * @param {number} outIdx
   */
  writeSurfaceVertex(u, v, alpha, ripple, elapsed, outIdx) {
    const cosA = Math.cos(alpha);
    const sinA = Math.sin(alpha);
    const coshV = Math.cosh(v);
    const sinhV = Math.sinh(v);
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);

    // Pure Bonnet isometric immersion (preserves ds^2 = cosh^2(v)(du^2 + dv^2) for all α)
    let x = cosA * coshV * cosU + sinA * sinhV * sinU;
    let y = v * cosA + u * sinA;
    let z = cosA * coshV * sinU - sinA * sinhV * cosU;

    // Optional harmonic perturbation to shift intrinsic Gaussian curvature K
    if (ripple > 0.001) {
      const wave = Math.sin(u * 3.0 + elapsed * 1.4) * Math.cos(v * 2.5 - elapsed * 0.9);
      const radialBoost = 1.0 + ripple * 0.24 * wave;
      x *= radialBoost;
      z *= radialBoost;
      y += ripple * 0.18 * Math.sin(u * 2.0 - v * 2.0 + elapsed);
    }

    const i3 = outIdx * 3;
    this.posBuffer[i3] = x * this.surfaceScale;
    this.posBuffer[i3 + 1] = y * this.surfaceScale * 0.72;
    this.posBuffer[i3 + 2] = z * this.surfaceScale;
  }

  /**
   * Recomputes all surface positions, First & Second Fundamental Forms (E,F,G,L,M,N),
   * Gaussian Curvature K, principal curvature directions, and vertex color heatmap.
   * @param {number} alpha
   * @param {number} ripple
   * @param {number} elapsed
   */
  updateSurfaceGeometryAndCurvature(alpha, ripple, elapsed) {
    const uMin = -Math.PI;
    const uMax = Math.PI;
    const vMin = -1.26;
    const vMax = 1.26;

    const du = (uMax - uMin) / this.uSegments;
    const dv = (vMax - vMin) / this.vSegments;

    // 1. Evaluate vertex coordinates
    for (let iv = 0; iv < this.vCount; iv++) {
      const v = vMin + iv * dv;
      for (let iu = 0; iu < this.uCount; iu++) {
        const u = uMin + iu * du;
        const idx = iv * this.uCount + iu;
        this.writeSurfaceVertex(u, v, alpha, ripple, elapsed, idx);
      }
    }

    // Helper to read vertex position into target Vector3
    const readPos = (iu, iv, target) => {
      const ciu = THREE.MathUtils.clamp(iu, 0, this.uSegments);
      const civ = THREE.MathUtils.clamp(iv, 0, this.vSegments);
      const i3 = (civ * this.uCount + ciu) * 3;
      target.set(this.posBuffer[i3], this.posBuffer[i3 + 1], this.posBuffer[i3 + 2]);
    };

    const pC = new THREE.Vector3();
    const pUPlus = new THREE.Vector3();
    const pUMinus = new THREE.Vector3();
    const pVPlus = new THREE.Vector3();
    const pVMinus = new THREE.Vector3();
    const pUVpp = new THREE.Vector3();
    const pUVpm = new THREE.Vector3();
    const pUVmp = new THREE.Vector3();
    const pUVmm = new THREE.Vector3();

    // 2. Compute discrete First & Second Fundamental Forms and Gaussian Curvature K
    for (let iv = 0; iv < this.vCount; iv++) {
      for (let iu = 0; iu < this.uCount; iu++) {
        const idx = iv * this.uCount + iu;
        const i3 = idx * 3;

        readPos(iu, iv, pC);
        readPos(iu + 1, iv, pUPlus);
        readPos(iu - 1, iv, pUMinus);
        readPos(iu, iv + 1, pVPlus);
        readPos(iu, iv - 1, pVMinus);

        const stepU = iu === 0 || iu === this.uSegments ? du : 2 * du;
        const stepV = iv === 0 || iv === this.vSegments ? dv : 2 * dv;

        // First partial derivatives r_u, r_v
        this._ru.subVectors(pUPlus, pUMinus).divideScalar(stepU);
        this._rv.subVectors(pVPlus, pVMinus).divideScalar(stepV);

        // Unit surface normal N = (r_u × r_v) / |r_u × r_v|
        this._normal.crossVectors(this._ru, this._rv);
        const normLen = Math.max(this._normal.length(), 1e-6);
        this._normal.divideScalar(normLen);

        this.normBuffer[i3] = this._normal.x;
        this.normBuffer[i3 + 1] = this._normal.y;
        this.normBuffer[i3 + 2] = this._normal.z;

        // First Fundamental Form coefficients E, F, G
        const E = this._ru.dot(this._ru);
        const F = this._ru.dot(this._rv);
        const G = this._rv.dot(this._rv);

        // Second partial derivatives r_uu, r_vv, r_uv
        this._ruu
          .copy(pUPlus)
          .add(pUMinus)
          .addScaledVector(pC, -2.0)
          .divideScalar(du * du);

        this._rvv
          .copy(pVPlus)
          .add(pVMinus)
          .addScaledVector(pC, -2.0)
          .divideScalar(dv * dv);

        readPos(iu + 1, iv + 1, pUVpp);
        readPos(iu + 1, iv - 1, pUVpm);
        readPos(iu - 1, iv + 1, pUVmp);
        readPos(iu - 1, iv - 1, pUVmm);

        this._ruv
          .copy(pUVpp)
          .sub(pUVpm)
          .sub(pUVmp)
          .add(pUVmm)
          .divideScalar(4 * du * dv);

        // Second Fundamental Form coefficients L, M, N
        const L = this._ruu.dot(this._normal);
        const M = this._ruv.dot(this._normal);
        const N = this._rvv.dot(this._normal);

        // Gaussian Curvature K = (LN - M^2) / (EG - F^2)
        const metricDet = Math.max(E * G - F * F, 1e-5);
        const K = (L * N - M * M) / metricDet;
        this.gaussianKBuffer[idx] = K;

        // Principal curvature orientation angle in (u,v) parameter space
        const principalTheta = 0.5 * Math.atan2(2 * M, L - N);
        this.principalAngleBuffer[idx] = principalTheta;

        // Map Gaussian curvature K to a luminous scientific color gradient:
        // K < 0 (hyperbolic saddle) -> Indigo/Cyan; K ≈ 0 -> Emerald; K > 0 -> Amber/Gold
        const kNorm = THREE.MathUtils.clamp(K * 0.65, -1.0, 1.0);
        if (kNorm < 0) {
          const t = -kNorm; // 0 (flat) -> 1 (strong negative saddle)
          this._color.setHSL(0.52 + t * 0.16, 0.88, 0.44 + (1 - t) * 0.14);
        } else {
          const t = kNorm;
          this._color.setHSL(0.42 - t * 0.30, 0.90, 0.48 + t * 0.12);
        }

        this.colorBuffer[i3] = this._color.r;
        this.colorBuffer[i3 + 1] = this._color.g;
        this.colorBuffer[i3 + 2] = this._color.b;
      }
    }

    const geo = this.manifoldMesh.geometry;
    geo.getAttribute('position').needsUpdate = true;
    geo.getAttribute('normal').needsUpdate = true;
    geo.getAttribute('color').needsUpdate = true;
    geo.computeBoundingSphere();
  }

  /**
   * Updates the 128 Darboux Principal Curvature Frames and isoparametric geodesic lines.
   * @param {number} alpha
   */
  updateTensorFramesAndGeodesics(alpha) {
    const tScale = this.params.tensorScale;
    let instIdx = 0;

    for (let r = 0; r < this.tensorRows; r++) {
      const iv = Math.round(((r + 0.5) / this.tensorRows) * this.vSegments);
      for (let c = 0; c < this.tensorCols; c++) {
        const iu = Math.round(((c + 0.5) / this.tensorCols) * this.uSegments);
        const idx = iv * this.uCount + iu;
        const i3 = idx * 3;

        const px = this.posBuffer[i3];
        const py = this.posBuffer[i3 + 1];
        const pz = this.posBuffer[i3 + 2];

        this._normal.set(this.normBuffer[i3], this.normBuffer[i3 + 1], this.normBuffer[i3 + 2]);
        if (this._normal.lengthSq() < 0.001) {
          this._normal.set(0, 1, 0);
        } else {
          this._normal.normalize();
        }

        // Compute local u-tangent for Darboux frame orientation
        const iuNext = Math.min(iu + 1, this.uSegments);
        const iuPrev = Math.max(iu - 1, 0);
        const iNext3 = (iv * this.uCount + iuNext) * 3;
        const iPrev3 = (iv * this.uCount + iuPrev) * 3;

        this._tangentU.set(
          this.posBuffer[iNext3] - this.posBuffer[iPrev3],
          this.posBuffer[iNext3 + 1] - this.posBuffer[iPrev3 + 1],
          this.posBuffer[iNext3 + 2] - this.posBuffer[iPrev3 + 2]
        );
        if (this._tangentU.lengthSq() < 1e-6) {
          this._tangentU.set(1, 0, 0);
        } else {
          this._tangentU.normalize();
        }

        // Align local Y with surface normal N, then twist around N by principal direction angle
        this._quatNormal.setFromUnitVectors(this._upVec, this._normal);
        const twistAngle = this.principalAngleBuffer[idx] + alpha;
        this._quatTwist.setFromAxisAngle(this._normal, twistAngle);

        this._dummy.position.set(px, py, pz);
        this._dummy.quaternion.copy(this._quatTwist).multiply(this._quatNormal);
        this._dummy.scale.setScalar(tScale);
        this._dummy.updateMatrix();

        this.normalNeedlesMesh.setMatrixAt(instIdx, this._dummy.matrix);

        // Place principal curvature crossbars slightly offset along the normal
        this._dummy.position.addScaledVector(this._normal, 0.04 * tScale);
        this._dummy.updateMatrix();
        this.principalBar1Mesh.setMatrixAt(instIdx, this._dummy.matrix);
        this.principalBar2Mesh.setMatrixAt(instIdx, this._dummy.matrix);

        instIdx += 1;
      }
    }

    this.normalNeedlesMesh.instanceMatrix.needsUpdate = true;
    this.principalBar1Mesh.instanceMatrix.needsUpdate = true;
    this.principalBar2Mesh.instanceMatrix.needsUpdate = true;

    // Update isoparametric u-geodesics (constant u meridians)
    for (const line of this.uGeodesicLines) {
      const iu = line.userData.uIndex;
      const attr = line.geometry.getAttribute('position');
      for (let iv = 0; iv < this.vCount; iv++) {
        const i3 = (iv * this.uCount + iu) * 3;
        attr.setXYZ(iv, this.posBuffer[i3], this.posBuffer[i3 + 1], this.posBuffer[i3 + 2]);
      }
      attr.needsUpdate = true;
    }

    // Update isoparametric v-geodesics (constant v parallels)
    for (const line of this.vGeodesicLines) {
      const iv = line.userData.vIndex;
      const attr = line.geometry.getAttribute('position');
      for (let iu = 0; iu < this.uCount; iu++) {
        const i3 = (iv * this.uCount + iu) * 3;
        attr.setXYZ(iu, this.posBuffer[i3], this.posBuffer[i3 + 1], this.posBuffer[i3 + 2]);
      }
      attr.needsUpdate = true;
    }
  }

  /**
   * Exposes interactive parameter controls to the bottom-right HUD parameter dock.
   */
  getParameterSchema() {
    return [
      {
        key: 'bendingAngle',
        label: 'Isometric Bend Angle (α)',
        min: 0.0,
        max: 1.57,
        step: 0.01,
        value: this.params.bendingAngle
      },
      {
        key: 'curvatureRipple',
        label: 'Non-Isometric Warp (δK)',
        min: 0.0,
        max: 1.0,
        step: 0.02,
        value: this.params.curvatureRipple
      },
      {
        key: 'tensorScale',
        label: 'Darboux Tensor Scale',
        min: 0.0,
        max: 1.8,
        step: 0.05,
        value: this.params.tensorScale
      },
      {
        key: 'autoBendSpeed',
        label: 'Bending Cadence',
        min: 0.0,
        max: 1.2,
        step: 0.05,
        value: this.params.autoBendSpeed
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
   * Per-frame animation and differential geometry solver update.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   * @param {Object} externalParams
   */
  update(elapsedTime = 0, deltaTime = 0.016, externalParams = {}) {
    if (externalParams) {
      Object.assign(this.params, externalParams);
    }

    // Smoothly oscillate isometric bending angle α between Catenoid (0) and Helicoid (π/2)
    let activeAlpha = this.params.bendingAngle;
    if (this.params.autoBendSpeed > 0.001) {
      const osc = 0.5 - 0.5 * Math.cos(elapsedTime * this.params.autoBendSpeed);
      activeAlpha = THREE.MathUtils.clamp(
        this.params.bendingAngle * 0.35 + osc * (Math.PI * 0.46),
        0.0,
        Math.PI * 0.5
      );
    }

    this.updateSurfaceGeometryAndCurvature(activeAlpha, this.params.curvatureRipple, elapsedTime);
    this.updateTensorFramesAndGeodesics(activeAlpha);

    // Rotate Dupin curvature indicatrix to match principal curvature orientation
    if (this.indicatrixGroup) {
      this.indicatrixGroup.rotation.y = activeAlpha + elapsedTime * 0.2;
      const warpScale = 1.0 + this.params.curvatureRipple * 0.25;
      this.dupinHyperbolaA.scale.set(warpScale, 1, 1 / warpScale);
      this.dupinHyperbolaB.scale.set(warpScale, 1, 1 / warpScale);
    }

    this.rootRig.rotation.y = elapsedTime * 0.14;
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
    this.uGeodesicLines.length = 0;
    this.vGeodesicLines.length = 0;
    this.group.clear();
  }
}

export function createPetersonSurfaceWorld(options = {}) {
  return new PetersonSurfaceWorld(options);
}

export default PetersonSurfaceWorld;
