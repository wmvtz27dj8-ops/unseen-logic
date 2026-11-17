/**
 * UNSEEN LOGIC — World 04: Wang Zhenyi's Celestial Shadow-Cone & Spherical Trigonometry (1792)
 * File 8/16: worlds/zhenyiEclipse.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

export class ZhenyiEclipseWorld {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.id = 'zhenyi';
    this.group = new THREE.Group();
    this.group.name = 'ZhenyiCelestialEclipseWorld';

    this.params = {
      orbitalPhase: 0.12,
      orbitalInclination: 0.09,
      umbraConvergence: 0.24,
      eclipticObliquity: 0.41,
      orbitSpeed: 0.35,
      fieldExpansion: 1.0,
      ...(options.params || {})
    };

    this.celestialRadius = 3.95;
    this.earthRadius = 0.62;
    this.moonRadius = 0.21;
    this.lunarOrbitRadius = 2.65;
    this.solarDistance = 6.2;

    this.disposables = [];
    this.rootRig = new THREE.Group();
    this.group.add(this.rootRig);

    // Reusable math scratch objects (zero per-frame GC allocations)
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._vecA = new THREE.Vector3();
    this._vecB = new THREE.Vector3();
    this._vecC = new THREE.Vector3();
    this._moonPos = new THREE.Vector3();
    this._sunPos = new THREE.Vector3(-this.solarDistance, 0, 0);

    // Scene sub-assemblies
    this.celestialGroup = new THREE.Group();
    this.equatorRing = null;
    this.eclipticRing = null;
    this.lunarOrbitRing = null;
    this.nodeLine = null;
    this.ascendingNodeMarker = null;
    this.descendingNodeMarker = null;

    // Spherical trigonometry dynamic arcs & vertices (Υ, S, P)
    this.sphArcHypotenuse = null;
    this.sphArcBase = null;
    this.sphArcAltitude = null;
    this.sphVertices = [];

    // Celestial bodies & shadow cones
    this.sunGroup = null;
    this.sunCorona = null;
    this.solarRays = null;
    this.earthGroup = null;
    this.earthMesh = null;
    this.earthGraticule = null;
    this.umbraMesh = null;
    this.umbraWireframe = null;
    this.penumbraMesh = null;
    this.umbraCrossSectionRing = null;
    this.penumbraCrossSectionRing = null;
    this.umbraApexMarker = null;
    this.moonMesh = null;
    this.moonHalo = null;
    this.degreeTicksMesh = null;

    this.buildCelestialArmillarySphere();
    this.buildSphericalTrigTriangle();
    this.buildSolarSourceAndTangentRays();
    this.buildTerrestrialSphere();
    this.buildShadowConesAndCrossSections();
    this.buildLunarBody();
    this.buildEclipticDegreeTicks();

    // Populate initial frame synchronously
    this.update(0, 0.016);
  }

  /**
   * Registers geometries and materials for deterministic GPU cleanup.
   * @param {THREE.BufferGeometry|THREE.Material} resource
   */
  track(resource) {
    if (resource) {
      this.disposables.push(resource);
    }
    return resource;
  }

  /**
   * Builds the celestial armillary sphere with Celestial Equator, tilted Ecliptic plane,
   * inclined Lunar Orbital track, and Line of Nodes (☊ / ☋).
   */
  buildCelestialArmillarySphere() {
    this.celestialGroup.name = 'ZhenyiCelestialArmillary';

    // Outer translucent meridian wireframe sphere
    const cageGeo = this.track(new THREE.SphereGeometry(this.celestialRadius, 36, 24));
    const cageMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x334155,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
        depthWrite: false
      })
    );
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    this.celestialGroup.add(cageMesh);

    // 1. Celestial Equator Ring (Cyan, horizontal XZ reference plane)
    const eqGeo = this.track(new THREE.TorusGeometry(this.celestialRadius, 0.014, 16, 160));
    const eqMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x5ac8fa,
        emissive: 0x0284c7,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.85
      })
    );
    this.equatorRing = new THREE.Mesh(eqGeo, eqMat);
    this.equatorRing.rotation.x = Math.PI / 2;
    this.celestialGroup.add(this.equatorRing);

    // 2. Ecliptic Great Circle (Amber/Gold, tilted by obliquity ε around X-axis)
    const eclGeo = this.track(new THREE.TorusGeometry(this.celestialRadius * 0.995, 0.016, 16, 160));
    const eclMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xffd60a,
        emissive: 0xd97706,
        emissiveIntensity: 0.7,
        roughness: 0.25,
        metalness: 0.85
      })
    );
    this.eclipticRing = new THREE.Mesh(eclGeo, eclMat);
    this.celestialGroup.add(this.eclipticRing);

    // 3. Lunar Orbital Path at r = lunarOrbitRadius (Indigo, tilted by nodal inclination ι)
    const lunarTrackGeo = this.track(new THREE.TorusGeometry(this.lunarOrbitRadius, 0.013, 16, 144));
    const lunarTrackMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.8
      })
    );
    this.lunarOrbitRing = new THREE.Mesh(lunarTrackGeo, lunarTrackMat);
    this.celestialGroup.add(this.lunarOrbitRing);

    // 4. Line of Nodes connecting Ascending Node (☊) and Descending Node (☋)
    const nodeGeo = this.track(new THREE.BufferGeometry());
    nodeGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-this.lunarOrbitRadius, 0, 0, this.lunarOrbitRadius, 0, 0],
        3
      )
    );
    const nodeMat = this.track(
      new THREE.LineDashedMaterial({
        color: 0x30d158,
        dashSize: 0.16,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.75
      })
    );
    this.nodeLine = new THREE.Line(nodeGeo, nodeMat);
    this.nodeLine.computeLineDistances();
    this.celestialGroup.add(this.nodeLine);

    // Ascending & Descending Node Octahedral Markers
    const nodeMarkerGeo = this.track(new THREE.OctahedronGeometry(0.085, 0));
    const nodeMarkerMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x30d158,
        emissive: 0x10b981,
        emissiveIntensity: 0.9,
        roughness: 0.2
      })
    );
    this.ascendingNodeMarker = new THREE.Mesh(nodeMarkerGeo, nodeMarkerMat);
    this.ascendingNodeMarker.position.set(this.lunarOrbitRadius, 0, 0);
    this.celestialGroup.add(this.ascendingNodeMarker);

    this.descendingNodeMarker = new THREE.Mesh(nodeMarkerGeo, nodeMarkerMat);
    this.descendingNodeMarker.position.set(-this.lunarOrbitRadius, 0, 0);
    this.celestialGroup.add(this.descendingNodeMarker);

    this.rootRig.add(this.celestialGroup);
  }

  /**
   * Builds Wang Zhenyi's Spherical Right Triangle on the celestial sphere:
   * - Hypotenuse λ along the Ecliptic (Gold)
   * - Base α along the Celestial Equator (Cyan)
   * - Altitude δ along the Hour Circle Meridian (Emerald): sin(δ) = sin(ε) · sin(λ)
   */
  buildSphericalTrigTriangle() {
    const createGeodesicArc = (segments, colorHex) => {
      const positions = new Float32Array((segments + 1) * 3);
      const geo = this.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = this.track(
        new THREE.LineBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.95
        })
      );
      const line = new THREE.Line(geo, mat);
      line.userData.segments = segments;
      return line;
    };

    this.sphArcHypotenuse = createGeodesicArc(48, 0xffd60a); // λ (Ecliptic arc)
    this.sphArcBase = createGeodesicArc(48, 0x5ac8fa);       // α (Right Ascension arc)
    this.sphArcAltitude = createGeodesicArc(36, 0x30d158);   // δ (Declination arc)

    this.celestialGroup.add(this.sphArcHypotenuse);
    this.celestialGroup.add(this.sphArcBase);
    this.celestialGroup.add(this.sphArcAltitude);

    // Three spherical triangle corner markers: Υ (Equinox), S (Ecliptic Point), P (Equatorial Projection)
    const vertexColors = [0xffffff, 0xffd60a, 0x30d158];
    vertexColors.forEach((hex) => {
      const vGeo = this.track(new THREE.SphereGeometry(0.075, 16, 16));
      const vMat = this.track(
        new THREE.MeshBasicMaterial({
          color: hex
        })
      );
      const marker = new THREE.Mesh(vGeo, vMat);
      this.celestialGroup.add(marker);
      this.sphVertices.push(marker);
    });
  }

  /**
   * Interpolates a great-circle spherical geodesic arc between unit-scaled vectors vStart and vEnd.
   * @param {THREE.Line} line
   * @param {THREE.Vector3} vStart
   * @param {THREE.Vector3} vEnd
   * @param {number} radius
   */
  updateGreatCircleArc(line, vStart, vEnd, radius) {
    const segments = line.userData.segments || 48;
    const posAttr = line.geometry.getAttribute('position');

    const uA = this._vecA.copy(vStart).normalize();
    const uB = this._vecB.copy(vEnd).normalize();
    const dot = THREE.MathUtils.clamp(uA.dot(uB), -1.0, 1.0);
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      if (sinOmega < 1e-4) {
        this._vecC.lerpVectors(uA, uB, t).normalize().multiplyScalar(radius);
      } else {
        const wA = Math.sin((1 - t) * omega) / sinOmega;
        const wB = Math.sin(t * omega) / sinOmega;
        this._vecC
          .set(
            uA.x * wA + uB.x * wB,
            uA.y * wA + uB.y * wB,
            uA.z * wA + uB.z * wB
          )
          .multiplyScalar(radius);
      }
      posAttr.setXYZ(i, this._vecC.x, this._vecC.y, this._vecC.z);
    }
    posAttr.needsUpdate = true;
  }

  /**
   * Builds the Solar Source along -X (representing Wang Zhenyi's hanging crystal lamp)
   * and upper/lower tangent light rays grazing the Earth's limbs.
   */
  buildSolarSourceAndTangentRays() {
    this.sunGroup = new THREE.Group();
    this.sunGroup.position.copy(this._sunPos);

    const sunCoreGeo = this.track(new THREE.SphereGeometry(0.42, 32, 32));
    const sunCoreMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xfffbeb
      })
    );
    this.sunGroup.add(new THREE.Mesh(sunCoreGeo, sunCoreMat));

    const coronaGeo = this.track(new THREE.SphereGeometry(0.68, 32, 32));
    const coronaMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xffd60a,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    this.sunGroup.add(this.sunCorona);

    this.rootRig.add(this.sunGroup);

    // Tangent solar grazing rays (outer & inner umbral tangents)
    const rayPositions = new Float32Array(8 * 2 * 3);
    const rayGeo = this.track(new THREE.BufferGeometry());
    rayGeo.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
    const rayMat = this.track(
      new THREE.LineBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.34
      })
    );
    this.solarRays = new THREE.LineSegments(rayGeo, rayMat);
    this.rootRig.add(this.solarRays);
  }

  /**
   * Builds the central Terrestrial Sphere (Earth) with meridian graticule cage
   * and polar axis rod.
   */
  buildTerrestrialSphere() {
    this.earthGroup = new THREE.Group();
    this.earthGroup.name = 'ZhenyiTerrestrialGlobe';

    const earthGeo = this.track(new THREE.SphereGeometry(this.earthRadius, 48, 36));
    const earthMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0x0f294a,
        emissive: 0x0369a1,
        emissiveIntensity: 0.35,
        roughness: 0.32,
        metalness: 0.25,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18
      })
    );
    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthGroup.add(this.earthMesh);

    const gratGeo = this.track(new THREE.SphereGeometry(this.earthRadius * 1.015, 24, 16));
    const gratMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        wireframe: true,
        transparent: true,
        opacity: 0.22
      })
    );
    this.earthGraticule = new THREE.Mesh(gratGeo, gratMat);
    this.earthGroup.add(this.earthGraticule);

    // Polar axis spindle
    const axisGeo = this.track(new THREE.CylinderGeometry(0.012, 0.012, this.earthRadius * 2.8, 12));
    const axisMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.65
      })
    );
    this.earthGroup.add(new THREE.Mesh(axisGeo, axisMat));

    this.rootRig.add(this.earthGroup);
  }

  /**
   * Builds Wang Zhenyi's Conical Umbra (converging dark shadow cone) and
   * Diverging Penumbra Frustum along +X, plus cross-sectional target rings at lunar distance.
   */
  buildShadowConesAndCrossSections() {
    // Unit Cone aligned from x = 0 (base radius 1) to x = 1 (apex at +X)
    const umbraGeo = this.track(new THREE.ConeGeometry(1.0, 1.0, 64, 1, true));
    umbraGeo.rotateZ(-Math.PI / 2);
    umbraGeo.translate(0.5, 0, 0);

    const umbraMat = this.track(
      new THREE.MeshPhysicalMaterial({
        color: 0x1e1b4b,
        emissive: 0x312e81,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.1,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.umbraMesh = new THREE.Mesh(umbraGeo, umbraMat);
    this.rootRig.add(this.umbraMesh);

    const umbraWireMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x818cf8,
        wireframe: true,
        transparent: true,
        opacity: 0.12,
        depthWrite: false
      })
    );
    this.umbraWireframe = new THREE.Mesh(umbraGeo, umbraWireMat);
    this.rootRig.add(this.umbraWireframe);

    // Diverging Penumbra Frustum from x = 0 (Earth radius) to x = 1 (expanded radius)
    const penumbraGeo = this.track(new THREE.CylinderGeometry(1.85, this.earthRadius, 1.0, 64, 1, true));
    penumbraGeo.rotateZ(-Math.PI / 2);
    penumbraGeo.translate(0.5, 0, 0);

    const penumbraMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        transparent: true,
        opacity: 0.10,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.penumbraMesh = new THREE.Mesh(penumbraGeo, penumbraMat);
    this.rootRig.add(this.penumbraMesh);

    // Cross-sectional rings at Lunar Orbit Distance (x = +lunarOrbitRadius)
    const uRingGeo = this.track(new THREE.TorusGeometry(1.0, 0.015, 16, 96));
    const uRingMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xff453a,
        transparent: true,
        opacity: 0.85
      })
    );
    this.umbraCrossSectionRing = new THREE.Mesh(uRingGeo, uRingMat);
    this.umbraCrossSectionRing.rotation.y = Math.PI / 2;
    this.umbraCrossSectionRing.position.set(this.lunarOrbitRadius, 0, 0);
    this.rootRig.add(this.umbraCrossSectionRing);

    const pRingGeo = this.track(new THREE.TorusGeometry(1.0, 0.01, 12, 96));
    const pRingMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x5ac8fa,
        transparent: true,
        opacity: 0.45
      })
    );
    this.penumbraCrossSectionRing = new THREE.Mesh(pRingGeo, pRingMat);
    this.penumbraCrossSectionRing.rotation.y = Math.PI / 2;
    this.penumbraCrossSectionRing.position.set(this.lunarOrbitRadius, 0, 0);
    this.rootRig.add(this.penumbraCrossSectionRing);

    // Umbral Apex Focal Marker
    const apexGeo = this.track(new THREE.OctahedronGeometry(0.08, 0));
    const apexMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xff453a
      })
    );
    this.umbraApexMarker = new THREE.Mesh(apexGeo, apexMat);
    this.rootRig.add(this.umbraApexMarker);
  }

  /**
   * Builds the orbiting Lunar Sphere whose illumination and crimson eclipse coloration
   * respond dynamically to its penetration into the Earth's shadow cones.
   */
  buildLunarBody() {
    const moonGeo = this.track(new THREE.SphereGeometry(this.moonRadius, 32, 24));
    const moonMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        emissive: 0xe2e8f0,
        emissiveIntensity: 0.45,
        roughness: 0.55,
        metalness: 0.1
      })
    );
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);

    const haloGeo = this.track(new THREE.SphereGeometry(this.moonRadius * 1.45, 24, 24));
    const haloMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
      })
    );
    this.moonHalo = new THREE.Mesh(haloGeo, haloMat);
    this.moonMesh.add(this.moonHalo);

    this.rootRig.add(this.moonMesh);
  }

  /**
   * Builds 72 InstancedMesh degree graduation ticks along the Ecliptic ring.
   */
  buildEclipticDegreeTicks() {
    const tickCount = 72;
    const tickGeo = this.track(new THREE.BoxGeometry(0.016, 0.08, 0.016));
    const tickMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0xffd60a,
        transparent: true,
        opacity: 0.65
      })
    );

    this.degreeTicksMesh = new THREE.InstancedMesh(tickGeo, tickMat, tickCount);
    const r = this.celestialRadius * 0.995;

    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * TWO_PI;
      const isMajor = i % 6 === 0;
      this._dummy.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      this._dummy.rotation.set(0, -angle, Math.PI / 2);
      this._dummy.scale.set(1, isMajor ? 1.8 : 0.9, 1);
      this._dummy.updateMatrix();
      this.degreeTicksMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.degreeTicksMesh.instanceMatrix.needsUpdate = true;
    this.eclipticRing.add(this.degreeTicksMesh);
  }

  /**
   * Returns interactive parameter definitions for the bottom-right HUD dock.
   */
  getParameterSchema() {
    return [
      {
        key: 'orbitalPhase',
        label: 'Lunar Phase Offset (λ)',
        min: -3.14,
        max: 3.14,
        step: 0.02,
        value: this.params.orbitalPhase
      },
      {
        key: 'orbitalInclination',
        label: 'Lunar Nodal Tilt (ι)',
        min: 0.0,
        max: 0.55,
        step: 0.01,
        value: this.params.orbitalInclination
      },
      {
        key: 'umbraConvergence',
        label: 'Solar Convergence (θ_s)',
        min: 0.14,
        max: 0.36,
        step: 0.01,
        value: this.params.umbraConvergence
      },
      {
        key: 'eclipticObliquity',
        label: 'Ecliptic Obliquity (ε)',
        min: 0.05,
        max: 0.75,
        step: 0.01,
        value: this.params.eclipticObliquity
      }
    ];
  }

  /**
   * Merges updated parameter values from UI controls.
   * @param {Object} next
   */
  setParams(next = {}) {
    Object.assign(this.params, next);
  }

  /**
   * Advances celestial orbital mechanics, shadow-cone intersection geometry,
   * lunar eclipse umbral reddening, and spherical trigonometry arcs.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   * @param {Object} externalParams
   */
  update(elapsedTime = 0, deltaTime = 0.016, externalParams = {}) {
    if (externalParams) {
      Object.assign(this.params, externalParams);
    }

    const obliquity = this.params.eclipticObliquity;
    const nodalTilt = this.params.orbitalInclination;
    const solarAngle = Math.max(this.params.umbraConvergence, 0.1);
    const orbitTheta = this.params.orbitalPhase + elapsedTime * this.params.orbitSpeed;

    // 1. Orient Ecliptic Ring & Lunar Orbital Ring
    if (this.eclipticRing) {
      this.eclipticRing.rotation.set(Math.PI / 2 + obliquity, 0, 0);
    }
    if (this.lunarOrbitRing) {
      this.lunarOrbitRing.rotation.set(Math.PI / 2 + nodalTilt, 0, 0);
    }

    // 2. Compute Umbra Cone Length: L_umbra = R_earth / tan(θ_solar)
    const umbraLength = THREE.MathUtils.clamp(
      this.earthRadius / Math.tan(solarAngle),
      2.2,
      5.8
    );

    if (this.umbraMesh && this.umbraWireframe) {
      this.umbraMesh.scale.set(umbraLength, this.earthRadius, this.earthRadius);
      this.umbraWireframe.scale.set(umbraLength, this.earthRadius, this.earthRadius);
    }
    if (this.umbraApexMarker) {
      this.umbraApexMarker.position.set(umbraLength, 0, 0);
    }

    const penumbraLength = 5.4;
    if (this.penumbraMesh) {
      this.penumbraMesh.scale.set(penumbraLength, 1.0, 1.0);
    }

    // Cross-sectional umbral & penumbral radii at lunar distance d = lunarOrbitRadius
    const umbraRadiusAtMoon = Math.max(
      this.earthRadius * (1.0 - this.lunarOrbitRadius / umbraLength),
      0.03
    );
    const penumbraRadiusAtMoon =
      this.earthRadius + this.lunarOrbitRadius * Math.tan(solarAngle * 0.85);

    if (this.umbraCrossSectionRing) {
      this.umbraCrossSectionRing.scale.setScalar(umbraRadiusAtMoon);
    }
    if (this.penumbraCrossSectionRing) {
      this.penumbraCrossSectionRing.scale.setScalar(penumbraRadiusAtMoon);
    }

    // 3. Update Tangent Solar Grazing Rays from Sun (-solarDistance) to Earth limbs & Umbra
    if (this.solarRays) {
      const rayAttr = this.solarRays.geometry.getAttribute('position');
      const sx = -this.solarDistance;
      const sunLimbR = 0.42;
      const er = this.earthRadius;

      // Upper & lower umbral converging tangent rays
      rayAttr.setXYZ(0, sx, sunLimbR, 0);
      rayAttr.setXYZ(1, umbraLength, 0, 0);

      rayAttr.setXYZ(2, sx, -sunLimbR, 0);
      rayAttr.setXYZ(3, umbraLength, 0, 0);

      // Transverse Z-plane grazing rays
      rayAttr.setXYZ(4, sx, 0, sunLimbR);
      rayAttr.setXYZ(5, umbraLength, 0, 0);

      rayAttr.setXYZ(6, sx, 0, -sunLimbR);
      rayAttr.setXYZ(7, umbraLength, 0, 0);

      // Diverging penumbral outer rays
      rayAttr.setXYZ(8, sx, -sunLimbR, 0);
      rayAttr.setXYZ(9, penumbraLength, er * 1.85, 0);

      rayAttr.setXYZ(10, sx, sunLimbR, 0);
      rayAttr.setXYZ(11, penumbraLength, -er * 1.85, 0);

      rayAttr.setXYZ(12, sx, 0, -sunLimbR);
      rayAttr.setXYZ(13, penumbraLength, 0, er * 1.85);

      rayAttr.setXYZ(14, sx, 0, sunLimbR);
      rayAttr.setXYZ(15, penumbraLength, 0, -er * 1.85);

      rayAttr.needsUpdate = true;
    }

    // 4. Compute Lunar Position & Eclipse Immersion (Umbra vs Penumbra vs Full Sunlight)
    const lx = Math.cos(orbitTheta) * this.lunarOrbitRadius;
    const flatZ = Math.sin(orbitTheta) * this.lunarOrbitRadius;
    const ly = flatZ * Math.sin(nodalTilt);
    const lz = flatZ * Math.cos(nodalTilt);
    this._moonPos.set(lx, ly, lz);

    if (this.moonMesh) {
      this.moonMesh.position.copy(this._moonPos);
      this.moonMesh.rotation.y = orbitTheta + Math.PI;

      // Check if Moon is on the anti-solar side (x > 0) inside shadow cones
      const radialAxisDist = Math.hypot(ly, lz);
      let eclipseFactor = 0.0;
      let penumbraFactor = 0.0;

      if (lx > 0.2) {
        const localUmbraR = Math.max(this.earthRadius * (1.0 - lx / umbraLength), 0.0);
        const localPenumbraR = this.earthRadius + lx * Math.tan(solarAngle * 0.85);

        if (radialAxisDist < localUmbraR + this.moonRadius) {
          eclipseFactor = THREE.MathUtils.clamp(
            1.0 - (radialAxisDist - localUmbraR * 0.4) / (localUmbraR + this.moonRadius),
            0.0,
            1.0
          );
        }
        if (radialAxisDist < localPenumbraR + this.moonRadius) {
          penumbraFactor = THREE.MathUtils.clamp(
            1.0 - radialAxisDist / (localPenumbraR + this.moonRadius),
            0.0,
            1.0
          );
        }
      }

      // Transition Lunar shader color from silver-white -> amber penumbra -> crimson Blood Moon
      if (eclipseFactor > 0.05) {
        this._color.setRGB(
          THREE.MathUtils.lerp(0.92, 0.86, eclipseFactor),
          THREE.MathUtils.lerp(0.94, 0.22, eclipseFactor),
          THREE.MathUtils.lerp(0.98, 0.14, eclipseFactor)
        );
        this.moonMesh.material.color.copy(this._color);
        this.moonMesh.material.emissive.setHex(0xb91c1c);
        this.moonMesh.material.emissiveIntensity = 0.35 + eclipseFactor * 0.55;
        if (this.moonHalo) {
          this.moonHalo.material.color.setHex(0xff453a);
          this.moonHalo.material.opacity = 0.28 + eclipseFactor * 0.25;
        }
      } else {
        const dim = 1.0 - penumbraFactor * 0.35;
        this.moonMesh.material.color.setRGB(0.95 * dim, 0.96 * dim, 0.99 * dim);
        this.moonMesh.material.emissive.setHex(0xcbd5e1);
        this.moonMesh.material.emissiveIntensity = 0.45 * dim;
        if (this.moonHalo) {
          this.moonHalo.material.color.setHex(0xf8fafc);
          this.moonHalo.material.opacity = 0.22 * dim;
        }
      }
    }

    // 5. Update Wang Zhenyi's Spherical Right Triangle (Υ, S, P) on Celestial Sphere
    const R = this.celestialRadius;
    const lambda = (elapsedTime * 0.28 + this.params.orbitalPhase) % TWO_PI;

    // Vertex 0: Vernal Equinox Υ = (R, 0, 0)
    const vEquinox = new THREE.Vector3(R, 0, 0);

    // Vertex 1: Ecliptic Point S at longitude λ tilted by obliquity ε
    const eclY = Math.sin(lambda) * Math.sin(obliquity) * R;
    const eclZ = Math.sin(lambda) * Math.cos(obliquity) * R;
    const eclX = Math.cos(lambda) * R;
    const vEcliptic = new THREE.Vector3(eclX, eclY, eclZ);

    // Vertex 2: Sub-ecliptic Equatorial Point P (Right Ascension α on XZ plane)
    const vEquator = new THREE.Vector3(eclX, 0, eclZ).normalize().multiplyScalar(R);

    this.updateGreatCircleArc(this.sphArcHypotenuse, vEquinox, vEcliptic, R);
    this.updateGreatCircleArc(this.sphArcBase, vEquinox, vEquator, R);
    this.updateGreatCircleArc(this.sphArcAltitude, vEquator, vEcliptic, R);

    if (this.sphVertices.length === 3) {
      this.sphVertices[0].position.copy(vEquinox);
      this.sphVertices[1].position.copy(vEcliptic);
      this.sphVertices[2].position.copy(vEquator);
    }

    // 6. Subtle axial rotation on Earth & solar corona pulse
    if (this.earthGroup) {
      this.earthGroup.rotation.z = -obliquity * 0.45;
      this.earthMesh.rotation.y = elapsedTime * 0.28;
      this.earthGraticule.rotation.y = elapsedTime * 0.28;
    }
    if (this.sunCorona) {
      this.sunCorona.scale.setScalar(1.0 + Math.sin(elapsedTime * 2.2) * 0.06);
    }

    this.rootRig.rotation.y = Math.sin(elapsedTime * 0.14) * 0.15;
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
    this.sphVertices.length = 0;
    this.group.clear();
  }
}

export function createZhenyiEclipseWorld(options = {}) {
  return new ZhenyiEclipseWorld(options);
}

export default ZhenyiEclipseWorld;
