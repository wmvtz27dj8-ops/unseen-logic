/**
 * UNSEEN LOGIC — Core 4K Spatial WebGL Renderer & Post-Processing Pipeline
 * File 3/16: core/renderer.js
 * Architected by G. U. Sanjiv
 */

import * as THREE from 'https://unpkg.com/three@0.187.0/build/three.module.js';
import { EffectComposer } from 'https://unpkg.com/three@0.187.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.187.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.187.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.187.0/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'https://unpkg.com/three@0.187.0/examples/jsm/postprocessing/OutputPass.js';

/**
 * Custom 4K Spatial Upscaling, Contrast-Adaptive Sharpening (CAS),
 * Optical Micro-Dispersion, and Anti-Banding Dither Shader.
 */
const SpatialUpscaleShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uSharpness: { value: 0.42 },
    uChromaticStrength: { value: 0.0012 },
    uTime: { value: 0.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uSharpness;
    uniform float uChromaticStrength;
    uniform float uTime;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 texel = 1.0 / max(uResolution, vec2(1.0));
      vec2 centered = vUv - 0.5;
      float distSq = dot(centered, centered);

      // Subtle radial optical dispersion near viewport perimeter
      vec2 caOffset = centered * distSq * uChromaticStrength;
      float rCenter = texture2D(tDiffuse, clamp(vUv + caOffset, 0.0, 1.0)).r;
      vec4 centerSample = texture2D(tDiffuse, vUv);
      float bCenter = texture2D(tDiffuse, clamp(vUv - caOffset, 0.0, 1.0)).b;
      vec3 baseColor = vec3(rCenter, centerSample.g, bCenter);

      // Cardinal neighbor sampling for Contrast-Adaptive Spatial Sharpening
      vec3 north = texture2D(tDiffuse, clamp(vUv + vec2(0.0, texel.y), 0.0, 1.0)).rgb;
      vec3 south = texture2D(tDiffuse, clamp(vUv - vec2(0.0, texel.y), 0.0, 1.0)).rgb;
      vec3 east  = texture2D(tDiffuse, clamp(vUv + vec2(texel.x, 0.0), 0.0, 1.0)).rgb;
      vec3 west  = texture2D(tDiffuse, clamp(vUv - vec2(texel.x, 0.0), 0.0, 1.0)).rgb;

      vec3 minNeighbor = min(baseColor, min(min(north, south), min(east, west)));
      vec3 maxNeighbor = max(baseColor, max(max(north, south), max(east, west)));

      // Adaptive weight attenuates sharpening on high-contrast aliasing edges
      vec3 contrastRange = max(maxNeighbor - minNeighbor, vec3(0.0001));
      vec3 amp = clamp(min(minNeighbor, 1.0 - maxNeighbor) / contrastRange, 0.0, 1.0);
      amp = sqrt(amp);

      vec3 weight = -amp * (uSharpness * 0.25);
      vec3 blurSum = north + south + east + west;
      vec3 sharpened = (blurSum * weight + baseColor) / (1.0 + 4.0 * weight);

      // Micro blue-noise style dither prevents dark-gradient banding in 4K
      float dither = (hash12(gl_FragCoord.xy + fract(uTime) * 60.0) - 0.5) / 255.0;
      vec3 finalColor = max(sharpened + vec3(dither), vec3(0.0));

      gl_FragColor = vec4(finalColor, centerSample.a);
    }
  `
};

/**
 * Custom soft-glow circular starfield shader for deep spatial depth cues.
 */
const DeepSpaceStarShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uPixelRatio: { value: 2.0 },
    uOpacity: { value: 0.72 }
  },
  vertexShader: /* glsl */ `
    attribute float aScale;
    attribute float aPhase;
    attribute vec3 aColor;
    uniform float uTime;
    uniform float uPixelRatio;
    varying vec3 vColor;
    varying float vTwinkle;

    void main() {
      vColor = aColor;
      vTwinkle = 0.65 + 0.35 * sin(uTime * 1.4 + aPhase);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float depthAtten = 180.0 / max(-mvPosition.z, 1.0);
      gl_PointSize = clamp(aScale * uPixelRatio * depthAtten, 1.0, 14.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uOpacity;
    varying vec3 vColor;
    varying float vTwinkle;

    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      float core = smoothstep(0.5, 0.04, dist);
      float halo = exp(-dist * 7.5);
      float alpha = (core * 0.6 + halo * 0.85) * vTwinkle * uOpacity;
      gl_FragColor = vec4(vColor, alpha);
    }
  `
};

export class SpatialRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   */
  constructor(canvas, options = {}) {
    if (!canvas) {
      throw new Error('SpatialRenderer requires a valid HTMLCanvasElement.');
    }

    this.canvas = canvas;
    this.maxDpr = options.maxDpr || 2.0;
    this.autoScaleDpr = options.autoScaleDpr !== undefined ? options.autoScaleDpr : true;
    this.currentDpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.isDisposed = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.014);

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(46, width / Math.max(height, 1), 0.1, 420);
    this.camera.position.set(0, 0.6, 14);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // Handled by HDR MSAA RenderTarget
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      alpha: false
    });

    this.renderer.setPixelRatio(this.currentDpr);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.lights = {};
    this.starfield = null;
    this.composer = null;
    this.renderTarget = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.upscalePass = null;
    this.outputPass = null;

    // Telemetry & adaptive performance state
    this.stats = {
      fps: 60,
      frameCount: 0,
      lastFpsTime: performance.now(),
      lowFpsStreak: 0,
      drawCalls: 0,
      triangles: 0
    };

    this.domRefs = {
      resolutionBadge: document.getElementById('resolution-badge'),
      fpsCounter: document.getElementById('fps-counter'),
      drawCallsCounter: document.getElementById('draw-calls-counter')
    };

    this.initLights();
    this.initBackgroundStarfield();
    this.initPostProcessing();
    this.updateResolutionBadge();

    this._onResizeBound = this.resize.bind(this);
    window.addEventListener('resize', this._onResizeBound, { passive: true });
  }

  /**
   * Configures Apple-grade studio three-point and rim lighting rig.
   */
  initLights() {
    const ambient = new THREE.AmbientLight(0x8fa8d6, 0.55);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x7cc8ff, 0x0b0e1a, 0.65);
    hemi.position.set(0, 25, 0);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(12, 16, 14);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x5ac8fa, 18, 65, 1.6);
    rimLight.position.set(-14, 8, -10);
    this.scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x5e5ce6, 14, 60, 1.6);
    fillLight.position.set(14, -9, 8);
    this.scene.add(fillLight);

    this.lights = { ambient, hemi, keyLight, rimLight, fillLight };
  }

  /**
   * Builds a multi-chromatic procedural starfield volume for spatial parallax.
   */
  initBackgroundStarfield(count = 2600) {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0xdbeafe),
      new THREE.Color(0x5ac8fa),
      new THREE.Color(0x818cf8),
      new THREE.Color(0xf8fafc)
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 28 + Math.random() * 145;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      scales[i] = 0.45 + Math.pow(Math.random(), 2.2) * 2.1;
      phases[i] = Math.random() * Math.PI * 2;

      const tint = palette[i % palette.length];
      colors[i3] = tint.r;
      colors[i3 + 1] = tint.g;
      colors[i3 + 2] = tint.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(DeepSpaceStarShader.uniforms),
      vertexShader: DeepSpaceStarShader.vertexShader,
      fragmentShader: DeepSpaceStarShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    material.uniforms.uPixelRatio.value = this.currentDpr;

    this.starfield = new THREE.Points(geometry, material);
    this.starfield.name = 'DeepSpaceStarfield';
    this.starfield.frustumCulled = false;
    this.scene.add(this.starfield);
  }

  /**
   * Initializes HDR Multisampled EffectComposer with UnrealBloom and 4K CAS Upscaling.
   */
  initPostProcessing() {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    const rtWidth = Math.floor(width * this.currentDpr);
    const rtHeight = Math.floor(height * this.currentDpr);

    const isWebGL2 = this.renderer.capabilities.isWebGL2;
    this.renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
      samples: isWebGL2 ? 4 : 0
    });

    this.composer = new EffectComposer(this.renderer, this.renderTarget);
    this.composer.setPixelRatio(this.currentDpr);
    this.composer.setSize(width, height);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.52, // strength
      0.68, // radius
      0.78  // threshold
    );
    this.composer.addPass(this.bloomPass);

    this.upscalePass = new ShaderPass(SpatialUpscaleShader);
    this.upscalePass.uniforms.uResolution.value.set(rtWidth, rtHeight);
    this.composer.addPass(this.upscalePass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  /**
   * Updates target pixel-ratio clarity (e.g. 2.0 for 4K Ultra, 1.5 for 2K, 1.0 for 1080p).
   * @param {number} dprCap
   */
  setQuality(dprCap) {
    const parsed = Number(dprCap);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    this.maxDpr = Math.min(Math.max(parsed, 0.75), 3.0);
    this.currentDpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.resize();
  }

  /**
   * Adjusts HDR bloom parameters dynamically per theorem world.
   * @param {number} strength
   * @param {number} radius
   * @param {number} threshold
   */
  setBloomIntensity(strength = 0.52, radius = 0.68, threshold = 0.78) {
    if (!this.bloomPass) return;
    this.bloomPass.strength = strength;
    this.bloomPass.radius = radius;
    this.bloomPass.threshold = threshold;
  }

  /**
   * Adjusts 4K spatial sharpening strength.
   * @param {number} amount
   */
  setSharpness(amount = 0.42) {
    if (this.upscalePass?.uniforms?.uSharpness) {
      this.upscalePass.uniforms.uSharpness.value = THREE.MathUtils.clamp(amount, 0.0, 1.0);
    }
  }

  /**
   * Synchronizes viewport dimensions, camera projection, and post-processing targets.
   */
  resize() {
    if (this.isDisposed) return;

    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    this.currentDpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(this.currentDpr);
    this.renderer.setSize(width, height, false);

    if (this.composer) {
      this.composer.setPixelRatio(this.currentDpr);
      this.composer.setSize(width, height);
    }

    const rtWidth = Math.floor(width * this.currentDpr);
    const rtHeight = Math.floor(height * this.currentDpr);

    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }

    if (this.upscalePass?.uniforms?.uResolution) {
      this.upscalePass.uniforms.uResolution.value.set(rtWidth, rtHeight);
    }

    if (this.starfield?.material?.uniforms?.uPixelRatio) {
      this.starfield.material.uniforms.uPixelRatio.value = this.currentDpr;
    }

    this.updateResolutionBadge();
  }

  /**
   * Updates the HUD resolution indicator with effective physical pixel dimensions.
   */
  updateResolutionBadge() {
    if (!this.domRefs.resolutionBadge) return;
    const effWidth = Math.floor(window.innerWidth * this.currentDpr);
    const tier = effWidth >= 3200 ? '4K' : effWidth >= 2200 ? '2.5K' : 'HD';
    this.domRefs.resolutionBadge.textContent = `${tier} DPR ${this.currentDpr.toFixed(1)}`;
  }

  /**
   * Executes one full 4K spatial render pass and updates live telemetry.
   * @param {number} elapsedTime
   * @param {number} deltaTime
   */
  render(elapsedTime = 0, deltaTime = 0.016) {
    if (this.isDisposed) return;

    if (this.starfield) {
      this.starfield.rotation.y = elapsedTime * 0.012;
      this.starfield.rotation.x = Math.sin(elapsedTime * 0.008) * 0.04;
      if (this.starfield.material?.uniforms?.uTime) {
        this.starfield.material.uniforms.uTime.value = elapsedTime;
      }
    }

    if (this.upscalePass?.uniforms?.uTime) {
      this.upscalePass.uniforms.uTime.value = elapsedTime;
    }

    // Subtle breathing modulation on rim light for spatial depth
    if (this.lights.rimLight) {
      this.lights.rimLight.intensity = 17.5 + Math.sin(elapsedTime * 1.1) * 2.5;
    }

    if (this.composer) {
      this.composer.render(deltaTime);
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.updateTelemetry();
  }

  /**
   * Computes rolling FPS, draw call counts, and adaptive DPR safety fallback.
   */
  updateTelemetry() {
    this.stats.frameCount += 1;
    const now = performance.now();
    const elapsed = now - this.stats.lastFpsTime;

    if (elapsed >= 500) {
      const currentFps = Math.round((this.stats.frameCount * 1000) / elapsed);
      this.stats.fps = currentFps;
      this.stats.frameCount = 0;
      this.stats.lastFpsTime = now;

      if (this.domRefs.fpsCounter) {
        this.domRefs.fpsCounter.textContent = String(currentFps);
      }

      if (this.domRefs.drawCallsCounter && this.renderer.info) {
        this.stats.drawCalls = this.renderer.info.render.calls;
        this.stats.triangles = this.renderer.info.render.triangles;
        this.domRefs.drawCallsCounter.textContent = String(this.stats.drawCalls);
      }

      // Adaptive DPR governor protects frame smoothness on sustained heavy shaders
      if (this.autoScaleDpr && currentFps < 28 && this.currentDpr > 1.0) {
        this.stats.lowFpsStreak += 1;
        if (this.stats.lowFpsStreak >= 4) {
          this.maxDpr = Math.max(1.0, Number((this.currentDpr - 0.25).toFixed(2)));
          this.stats.lowFpsStreak = 0;
          this.resize();
        }
      } else {
        this.stats.lowFpsStreak = 0;
      }
    }
  }

  /**
   * Recursively frees all GPU geometries, materials, and textures within an Object3D subtree.
   * @param {THREE.Object3D} rootObject
   */
  static disposeObject(rootObject) {
    if (!rootObject) return;

    rootObject.traverse((node) => {
      if (node.geometry && typeof node.geometry.dispose === 'function') {
        node.geometry.dispose();
      }

      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const mat of materials) {
          if (!mat) continue;
          for (const value of Object.values(mat)) {
            if (value && typeof value === 'object' && value.isTexture && typeof value.dispose === 'function') {
              value.dispose();
            }
          }
          if (typeof mat.dispose === 'function') {
            mat.dispose();
          }
        }
      }
    });
  }

  /**
   * Instance helper that removes an Object3D from the scene and purges its GPU buffers.
   * @param {THREE.Object3D} obj
   */
  purgeObject(obj) {
    if (!obj) return;
    if (obj.parent) {
      obj.parent.remove(obj);
    }
    SpatialRenderer.disposeObject(obj);
  }

  /**
   * Completely tears down the WebGL context, EffectComposer, and all scene GPU allocations.
   */
  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;

    window.removeEventListener('resize', this._onResizeBound);

    SpatialRenderer.disposeObject(this.scene);
    this.scene.clear();

    if (this.bloomPass && typeof this.bloomPass.dispose === 'function') {
      this.bloomPass.dispose();
    }
    if (this.upscalePass && typeof this.upscalePass.dispose === 'function') {
      this.upscalePass.dispose();
    }
    if (this.outputPass && typeof this.outputPass.dispose === 'function') {
      this.outputPass.dispose();
    }
    if (this.renderTarget && typeof this.renderTarget.dispose === 'function') {
      this.renderTarget.dispose();
    }
    if (this.composer && typeof this.composer.dispose === 'function') {
      this.composer.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (typeof this.renderer.forceContextLoss === 'function') {
        this.renderer.forceContextLoss();
      }
    }
  }
}

export default SpatialRenderer;
