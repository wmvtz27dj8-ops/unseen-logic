/**
 * UNSEEN LOGIC — Direct Browser Gemini API Bridge & Autonomous Formula Synthesizer
 * File 13/16: engine/geminiBridge.js
 * Architected by G. U. Sanjiv
 */

import { FormulaParser, LAB_PRESETS } from './formulaParser.js';
import { normalizeTopology, SUPPORTED_TOPOLOGIES } from './constructBuilder.js';

const STORAGE_KEYS = Object.freeze({
  API_KEY: 'unseen_logic_gemini_api_key',
  MODEL: 'unseen_logic_gemini_model',
  RENDER_QUALITY: 'unseen_logic_render_quality'
});

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash'
]);

const SYSTEM_INSTRUCTION = `You are the mathematical synthesis core of UNSEEN LOGIC, a 4K spatial 3D scientific visualization engine.
Your task is to translate a user's real-world constraint, engineering problem, physics scenario, or raw intuition into a clean, continuous, bounded scalar mathematical field f(u, v, t) and 3D topological embedding.

STRICT RULES FOR "expression":
1. Output ONLY a single mathematical expression in terms of u, v, t, r, theta, and tunable parameters p1, p2, p3, p4. Do NOT include "f(u,v,t) =" or any equals sign.
2. Domain variables: u and v span [-pi, pi], t is continuous time in seconds, r = hypot(u, v), theta = atan2(v, u).
3. Tunable parameters: p1 (frequency/gain, ~0.5..5.0), p2 (temporal rate, ~0.2..3.0), p3 (coupling/harmonics, ~0.5..5.0), p4 (amplitude envelope, ~0.4..2.5).
4. Allowed functions ONLY: sin, cos, tan, asin, acos, atan, atan2, sinh, cosh, tanh, abs, sign, floor, ceil, round, fract, sqrt, cbrt, exp, log, ln, log10, log2, min, max, mod, pow, clamp, lerp, step, smoothstep, sinc, gauss.
5. Allowed constants: pi, tau, e, phi, ln2, sqrt2.
6. Use explicit arithmetic operators (+, -, *, /, %, ^). Keep output magnitudes well-behaved (roughly within [-3.5, 3.5]) using smooth damping like exp(-0.15 * r * r) or tanh(...) when needed so the 3D mesh renders cleanly.
7. Choose "topology" strictly from: "parametric_surface", "wave_interference", "toroidal_vortex", "hyperbolic_saddle", "spherical_harmonic".
8. Keep "title" concise (3-6 words) and "explanation" clear and insightful (1-2 sentences explaining how the variables map to the user's real-world constraint).`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: {
      type: 'STRING',
      description: 'Concise 3 to 6 word scientific title for the synthesized 3D construct.'
    },
    topology: {
      type: 'STRING',
      enum: [
        'parametric_surface',
        'wave_interference',
        'toroidal_vortex',
        'hyperbolic_saddle',
        'spherical_harmonic'
      ],
      description: 'Best 3D topological embedding for visualizing the mathematical relationship.'
    },
    expression: {
      type: 'STRING',
      description: 'Valid scalar math expression using u, v, t, r, theta, p1, p2, p3, p4.'
    },
    explanation: {
      type: 'STRING',
      description: '1 to 2 sentence explanation of how the formula models the user prompt or constraint.'
    },
    params: {
      type: 'OBJECT',
      properties: {
        p1: { type: 'NUMBER' },
        p2: { type: 'NUMBER' },
        p3: { type: 'NUMBER' },
        p4: { type: 'NUMBER' }
      },
      required: ['p1', 'p2', 'p3', 'p4']
    }
  },
  required: ['title', 'topology', 'expression', 'explanation', 'params']
};

/**
 * Cleans an AI-generated formula string to strip accidental prefixes or unicode symbols.
 * @param {string} rawExpr
 * @returns {string}
 */
function sanitizeFormulaString(rawExpr) {
  if (typeof rawExpr !== 'string') return '';
  let expr = rawExpr.trim();

  // Strip "f(u, v, t) =" or "z =" prefixes if present
  const eqIndex = expr.indexOf('=');
  if (eqIndex !== -1 && eqIndex < 20) {
    expr = expr.slice(eqIndex + 1).trim();
  }

  // Strip surrounding backticks or quotes
  expr = expr.replace(/^[`"']+|[`"']+$/g, '').trim();

  // Normalize unicode math symbols
  expr = expr
    .replace(/·/g, '*')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/\*\*/g, '^');

  return expr;
}

/**
 * Extracts and parses a JSON object from raw model text, stripping markdown code fences if present.
 * @param {string} rawText
 * @returns {Object}
 */
function parseModelJsonPayload(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from Gemini API.');
  }

  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Unable to parse structured JSON construct from Gemini response.');
  }
}

export class GeminiBridge {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.apiKey = this.loadFromStorage(STORAGE_KEYS.API_KEY, options.apiKey || '');
    this.model = this.loadFromStorage(STORAGE_KEYS.MODEL, options.model || 'gemini-2.5-flash');
    this.renderQuality = Number(
      this.loadFromStorage(STORAGE_KEYS.RENDER_QUALITY, String(options.renderQuality || 2))
    );

    if (!ALLOWED_MODELS.has(this.model)) {
      this.model = 'gemini-2.5-flash';
    }

    this.activeController = null;
    this.lastResponseMeta = null;
  }

  /**
   * Safely reads a string key from localStorage (handles private browsing restrictions).
   * @param {string} key
   * @param {string} fallback
   * @returns {string}
   */
  loadFromStorage(key, fallback = '') {
    try {
      const val = window.localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Safely writes or removes a key in localStorage.
   * @param {string} key
   * @param {string|null} value
   */
  saveToStorage(key, value) {
    try {
      if (value === null || value === undefined || value === '') {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, String(value));
      }
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }

  /**
   * Returns true if a non-empty Gemini API key is configured.
   * @returns {boolean}
   */
  hasApiKey() {
    return typeof this.apiKey === 'string' && this.apiKey.trim().length > 10;
  }

  /**
   * Updates and persists the user's Gemini API key.
   * @param {string} newKey
   */
  setApiKey(newKey) {
    const trimmed = typeof newKey === 'string' ? newKey.trim() : '';
    this.apiKey = trimmed;
    this.saveToStorage(STORAGE_KEYS.API_KEY, trimmed);
  }

  /**
   * Clears the stored Gemini API key from memory and localStorage.
   */
  clearApiKey() {
    this.apiKey = '';
    this.saveToStorage(STORAGE_KEYS.API_KEY, null);
  }

  /**
   * Sets and persists the selected Gemini model ID.
   * @param {string} modelId
   */
  setModel(modelId) {
    if (ALLOWED_MODELS.has(modelId)) {
      this.model = modelId;
      this.saveToStorage(STORAGE_KEYS.MODEL, modelId);
    }
  }

  /**
   * Sets and persists the preferred 4K DPR render clarity value.
   * @param {number|string} dprValue
   */
  setRenderQuality(dprValue) {
    const num = Number(dprValue);
    if (Number.isFinite(num) && num >= 0.75 && num <= 3.0) {
      this.renderQuality = num;
      this.saveToStorage(STORAGE_KEYS.RENDER_QUALITY, String(num));
    }
  }

  /**
   * Returns the current configuration snapshot.
   */
  getConfig() {
    return {
      hasKey: this.hasApiKey(),
      maskedKey: this.hasApiKey()
        ? `${this.apiKey.slice(0, 6)}...${this.apiKey.slice(-4)}`
        : '',
      model: this.model,
      renderQuality: this.renderQuality
    };
  }

  /**
   * Cancels any currently running Gemini API fetch request.
   */
  abortPendingRequest() {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
  }

  /**
   * Validates and normalizes a raw construct object (from Gemini or local synthesis)
   * ensuring the expression compiles cleanly in `FormulaParser`.
   * @param {Object} rawConfig
   * @param {string} domain
   * @returns {Object}
   */
  validateAndNormalizeConstruct(rawConfig, domain = 'compute') {
    const fallbackPreset = LAB_PRESETS[domain] || LAB_PRESETS.tokens;
    const topology = normalizeTopology(rawConfig?.topology || fallbackPreset.topology);

    const rawParams = rawConfig?.params || {};
    const clampParam = (val, defVal, min, max) => {
      const n = Number(val);
      if (!Number.isFinite(n)) return defVal;
      return Number(Math.max(min, Math.min(max, n)).toFixed(3));
    };

    const params = {
      p1: clampParam(rawParams.p1, 2.2, 0.2, 7.5),
      p2: clampParam(rawParams.p2, 1.2, 0.0, 5.0),
      p3: clampParam(rawParams.p3, 2.0, 0.2, 7.5),
      p4: clampParam(rawParams.p4, 1.35, 0.15, 3.5)
    };

    let expression = sanitizeFormulaString(rawConfig?.expression || '');
    let isValid = false;

    if (expression) {
      try {
        FormulaParser.compile(expression);
        isValid = true;
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      expression = fallbackPreset.expression;
    }

    const title =
      typeof rawConfig?.title === 'string' && rawConfig.title.trim().length > 2
        ? rawConfig.title.trim().slice(0, 68)
        : fallbackPreset.title;

    const explanation =
      typeof rawConfig?.explanation === 'string' && rawConfig.explanation.trim().length > 8
        ? rawConfig.explanation.trim().slice(0, 340)
        : fallbackPreset.explanation;

    return {
      title,
      domain,
      topology,
      topologyLabel: SUPPORTED_TOPOLOGIES[topology] || 'PARAMETRIC MANIFOLD',
      expression,
      explanation,
      params,
      source: isValid ? 'gemini-api' : 'validated-fallback'
    };
  }

  /**
   * Synthesizes a structured 3D mathematical construct from a user prompt and domain.
   * Uses the live Gemini REST API if an API key is configured, or gracefully runs the
   * deterministic local keyword-to-formula synthesizer if no key is present.
   *
   * @param {string} userPrompt
   * @param {string} domain
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async synthesizeConstruct(userPrompt, domain = 'compute', options = {}) {
    const promptText = typeof userPrompt === 'string' ? userPrompt.trim() : '';
    if (!promptText) {
      throw new Error('Please enter a problem description, constraint, or idea first.');
    }

    if (!this.hasApiKey()) {
      const localResult = this.synthesizeLocalHeuristic(promptText, domain);
      return {
        ...localResult,
        usedLocalFallback: true,
        notice: 'No Gemini API key set — synthesized locally via deterministic AST heuristic. Add your key in Settings (⚙) for full Gemini reasoning.'
      };
    }

    this.abortPendingRequest();
    const controller = new AbortController();
    this.activeController = controller;

    const timeoutMs = options.timeoutMs || 28000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const modelToUse = options.model || this.model || 'gemini-2.5-flash';
    const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(modelToUse)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const userMessage = [
      `Target System Domain: ${domain.toUpperCase()}`,
      `User Problem / Real-World Constraint: "${promptText}"`,
      'Synthesize an expressive, mathematically valid 3D construct JSON configuration.'
    ].join('\n');

    const requestBody = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }]
        }
      ],
      generationConfig: {
        temperature: 0.45,
        topP: 0.9,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      this.activeController = null;

      if (!response.ok) {
        let errDetail = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            errDetail = errJson.error.message;
          }
        } catch {
          // Use status fallback
        }
        throw new Error(`Gemini API Error: ${errDetail}`);
      }

      const payload = await response.json();
      const candidate = payload?.candidates?.[0];
      const rawText = candidate?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini API returned an empty candidate payload.');
      }

      const parsedJson = parseModelJsonPayload(rawText);
      const normalized = this.validateAndNormalizeConstruct(parsedJson, domain);

      this.lastResponseMeta = {
        model: modelToUse,
        timestamp: Date.now(),
        usageMetadata: payload.usageMetadata || null
      };

      return {
        ...normalized,
        usedLocalFallback: false,
        model: modelToUse,
        notice: `Synthesized live via ${modelToUse}.`
      };
    } catch (err) {
      clearTimeout(timeoutId);
      this.activeController = null;

      if (err && err.name === 'AbortError') {
        throw new Error('Formula synthesis request timed out or was cancelled.');
      }
      throw err;
    }
  }

  /**
   * Deterministic offline/no-key mathematical synthesizer that extracts numbers and
   * domain semantics from the user's prompt to build a custom valid formula.
   * @param {string} promptText
   * @param {string} domain
   * @returns {Object}
   */
  synthesizeLocalHeuristic(promptText, domain = 'compute') {
    const lower = promptText.toLowerCase();

    // Extract any numeric constants mentioned in the user's prompt (e.g., "4 models", "65536 tokens")
    const numbers = (promptText.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
    const seedVal = numbers.length > 0 ? numbers[0] : promptText.length;

    const p1 = Number((1.4 + (seedVal % 7) * 0.42).toFixed(2));
    const p2 = Number((0.75 + ((promptText.length % 5) * 0.28)).toFixed(2));
    const p3 = Number((1.6 + ((seedVal % 6) * 0.38)).toFixed(2));
    const p4 = 1.35;

    let topology = 'parametric_surface';
    let expression = `sin(u * p1 - t * p2) * cos(v * p3) * p4 * exp(-0.14 * r * r)`;
    let title = 'Adaptive Constraint Equilibrium';
    let explanation = `Synthesized locally for "${promptText.slice(0, 72)}${promptText.length > 72 ? '...' : ''}". Models coupled variable trade-offs across parametric space (u, v) under harmonic damping.`;

    if (
      lower.includes('vortex') ||
      lower.includes('orbit') ||
      lower.includes('torus') ||
      lower.includes('spin') ||
      lower.includes('cycle') ||
      lower.includes('loop')
    ) {
      topology = 'toroidal_vortex';
      expression = 'p4 * sin(u * p1 + v * p3 - t * p2) * cos(v * 2.0)';
      title = 'Cyclic Toroidal Flux Manifold';
    } else if (
      lower.includes('wave') ||
      lower.includes('quantum') ||
      lower.includes('interfer') ||
      lower.includes('signal') ||
      lower.includes('frequency') ||
      domain === 'physics'
    ) {
      topology = 'wave_interference';
      expression = '(sin(r * p1 - t * p2) + cos(theta * round(p3))) * 0.65 * p4 * exp(-0.12 * r)';
      title = 'Radial Harmonic Interference Field';
    } else if (
      lower.includes('saddle') ||
      lower.includes('entropy') ||
      lower.includes('heat') ||
      lower.includes('gradient') ||
      lower.includes('minimax') ||
      domain === 'systems'
    ) {
      topology = 'hyperbolic_saddle';
      expression = 'tanh(u * p1 * 0.5 - v * p2 * 0.5) * cos(v * p3 + t * 0.9) * p4';
      title = 'Nonlinear Minimax Saddle Surface';
    } else if (
      lower.includes('sphere') ||
      lower.includes('global') ||
      lower.includes('planet') ||
      lower.includes('harmonic') ||
      domain === 'geometry'
    ) {
      topology = 'spherical_harmonic';
      expression = 'sin(u * round(p1) + t * p2) * sin(v * round(p3)) * p4 * 0.65';
      title = 'Spherical Harmonic Resonance Shell';
    } else if (
      lower.includes('token') ||
      lower.includes('quota') ||
      lower.includes('compute') ||
      lower.includes('latency') ||
      domain === 'compute'
    ) {
      topology = 'parametric_surface';
      expression = 'sin(u * p1 - t * p2) * cos(v * p3) * p4 * exp(-0.16 * (u*u + v*v))';
      title = 'Compute & Latency Pareto Ridge';
    }

    return this.validateAndNormalizeConstruct(
      {
        title,
        topology,
        expression,
        explanation,
        params: { p1, p2, p3, p4 }
      },
      domain
    );
  }

  /**
   * Performs a lightweight test request to verify the user's Gemini API key.
   * @param {string} candidateKey
   * @returns {Promise<{ ok: boolean, message: string }>}
   */
  async verifyApiKey(candidateKey = this.apiKey) {
    const key = typeof candidateKey === 'string' ? candidateKey.trim() : '';
    if (!key) {
      return { ok: false, message: 'Enter an API key first.' };
    }

    const endpoint = `${GEMINI_API_BASE}/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with OK' }] }],
          generationConfig: { maxOutputTokens: 8 }
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          ok: false,
          message: data?.error?.message || `Verification failed (HTTP ${res.status}).`
        };
      }

      return { ok: true, message: 'Gemini API key verified and active.' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Network error verifying API key.'
      };
    }
  }
}

export function createGeminiBridge(options = {}) {
  return new GeminiBridge(options);
}

export default GeminiBridge;
