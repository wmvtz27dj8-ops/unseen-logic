/**
 * UNSEEN LOGIC — Safe Mathematical AST Expression Parser & Real-Time Constraint Solver
 * File 11/16: engine/formulaParser.js
 * Architected by G. U. Sanjiv
 */

const TWO_PI = Math.PI * 2;
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

export const MATH_CONSTANTS = Object.freeze({
  pi: Math.PI,
  PI: Math.PI,
  tau: TWO_PI,
  TAU: TWO_PI,
  e: Math.E,
  E: Math.E,
  phi: GOLDEN_RATIO,
  PHI: GOLDEN_RATIO,
  ln2: Math.LN2,
  LN2: Math.LN2,
  sqrt2: Math.SQRT2,
  SQRT2: Math.SQRT2
});

export const MATH_FUNCTIONS = Object.freeze({
  sin: { arity: 1, fn: (x) => Math.sin(x) },
  cos: { arity: 1, fn: (x) => Math.cos(x) },
  tan: { arity: 1, fn: (x) => Math.max(-50, Math.min(50, Math.tan(x))) },
  asin: { arity: 1, fn: (x) => Math.asin(Math.max(-1, Math.min(1, x))) },
  acos: { arity: 1, fn: (x) => Math.acos(Math.max(-1, Math.min(1, x))) },
  atan: { arity: 1, fn: (x) => Math.atan(x) },
  atan2: { arity: 2, fn: (y, x) => Math.atan2(y, x) },
  sinh: { arity: 1, fn: (x) => Math.sinh(Math.max(-12, Math.min(12, x))) },
  cosh: { arity: 1, fn: (x) => Math.cosh(Math.max(-12, Math.min(12, x))) },
  tanh: { arity: 1, fn: (x) => Math.tanh(x) },
  abs: { arity: 1, fn: (x) => Math.abs(x) },
  sign: { arity: 1, fn: (x) => Math.sign(x) },
  floor: { arity: 1, fn: (x) => Math.floor(x) },
  ceil: { arity: 1, fn: (x) => Math.ceil(x) },
  round: { arity: 1, fn: (x) => Math.round(x) },
  fract: { arity: 1, fn: (x) => x - Math.floor(x) },
  sqrt: { arity: 1, fn: (x) => Math.sqrt(Math.max(0, x)) },
  cbrt: { arity: 1, fn: (x) => Math.cbrt(x) },
  exp: { arity: 1, fn: (x) => Math.exp(Math.max(-20, Math.min(12, x))) },
  log: { arity: 1, fn: (x) => Math.log(Math.max(1e-9, Math.abs(x))) },
  ln: { arity: 1, fn: (x) => Math.log(Math.max(1e-9, Math.abs(x))) },
  log10: { arity: 1, fn: (x) => Math.log10(Math.max(1e-9, Math.abs(x))) },
  log2: { arity: 1, fn: (x) => Math.log2(Math.max(1e-9, Math.abs(x))) },
  min: { arity: 2, fn: (a, b) => Math.min(a, b) },
  max: { arity: 2, fn: (a, b) => Math.max(a, b) },
  mod: { arity: 2, fn: (a, b) => (b === 0 ? 0 : a - b * Math.floor(a / b)) },
  pow: { arity: 2, fn: (a, b) => Math.pow(a, Math.max(-16, Math.min(16, b))) },
  clamp: { arity: 3, fn: (x, lo, hi) => Math.max(lo, Math.min(hi, x)) },
  lerp: { arity: 3, fn: (a, b, t) => a + (b - a) * t },
  step: { arity: 2, fn: (edge, x) => (x < edge ? 0 : 1) },
  smoothstep: {
    arity: 3,
    fn: (e0, e1, x) => {
      const denom = Math.abs(e1 - e0) < 1e-9 ? 1e-9 : e1 - e0;
      const t = Math.max(0, Math.min(1, (x - e0) / denom));
      return t * t * (3 - 2 * t);
    }
  },
  sinc: {
    arity: 1,
    fn: (x) => (Math.abs(x) < 1e-6 ? 1.0 : Math.sin(x) / x)
  },
  gauss: {
    arity: 1,
    fn: (x) => Math.exp(-x * x)
  }
});

export const LAB_PRESETS = Object.freeze({
  tokens: {
    id: 'tokens',
    domain: 'compute',
    title: 'AI Token & Quota Equilibrium Manifold',
    topology: 'parametric_surface',
    expression: 'sin(u * p1 - t * p2) * cos(v * p3) * p4 * exp(-0.18 * (u*u + v*v))',
    prompt: 'Balance multi-turn reasoning depth against a strict 5-hour token compute ceiling without quota saturation.',
    explanation: 'Models reasoning depth (u) vs. context length (v) under a damped harmonic envelope, identifying stable high-throughput ridges before quota saturation.',
    params: { p1: 2.4, p2: 1.15, p3: 2.2, p4: 1.45 }
  },
  harmonic: {
    id: 'harmonic',
    domain: 'physics',
    title: 'Coupled Standing-Wave Interference Lattice',
    topology: 'wave_interference',
    expression: '(sin(u * p1 + t * p2) + cos(v * p3 - t * p2)) * 0.5 * p4',
    prompt: 'Visualize constructive and destructive nodal interference between two phase-locked wave oscillators.',
    explanation: 'Superposes orthogonal harmonic modes across parametric space, exposing stationary nodal lines and resonant amplitude antinodes.',
    params: { p1: 3.0, p2: 1.6, p3: 3.0, p4: 1.25 }
  },
  orbital: {
    id: 'orbital',
    domain: 'geometry',
    title: 'Asymmetric Gravitational Slingshot Potential',
    topology: 'toroidal_vortex',
    expression: 'p4 * cos(u * p1 + v * p2 - t) / (1.0 + 0.45 * (u*u + v*v) * p3)',
    prompt: 'Simulate hyperbolic trajectory deflection and orbital energy exchange around a rotating gravity well.',
    explanation: 'Projects an inverse-quadratic gravitational potential well modulated by azimuthal frame-dragging harmonics.',
    params: { p1: 2.0, p2: 1.0, p3: 0.85, p4: 1.85 }
  },
  entropy: {
    id: 'entropy',
    domain: 'systems',
    title: 'Thermodynamic Carnot & Exergy Gradient',
    topology: 'hyperbolic_saddle',
    expression: 'tanh(u * p1 - v * p2) * cos(v * p3 + t * 0.8) * p4',
    prompt: 'Map thermal efficiency losses and exergy dissipation across coupled heat-exchange boundaries.',
    explanation: 'Captures nonlinear phase-transition gradients between high-order work extraction and entropic equilibrium.',
    params: { p1: 1.35, p2: 1.15, p3: 2.5, p4: 1.3 }
  }
});

const OPERATOR_PRECEDENCE = Object.freeze({
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  '^': 3
});

const RIGHT_ASSOCIATIVE = new Set(['^']);

/**
 * Tokenizes a mathematical expression string into lexical tokens and inserts
 * explicit multiplication tokens where implicit multiplication is used
 * (e.g. `2u`, `2pi`, `(u+1)(v-1)`, `p1 sin(u)`).
 * @param {string} source
 * @returns {Array<{type: string, value: string|number, pos: number}>}
 */
export function tokenizeExpression(source) {
  if (typeof source !== 'string') {
    throw new Error('Formula expression must be a string.');
  }

  const clean = source
    .replace(/·/g, '*')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .trim();

  if (!clean) {
    throw new Error('Formula expression cannot be empty.');
  }
  if (clean.length > 600) {
    throw new Error('Formula expression exceeds maximum safe length (600 chars).');
  }

  const rawTokens = [];
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    // Numeric literal (supports integers, decimals, and scientific notation)
    if (/[0-9.]/.test(ch)) {
      const start = i;
      let hasDot = ch === '.';
      i += 1;
      while (i < clean.length) {
        const c = clean[i];
        if (/[0-9]/.test(c)) {
          i += 1;
        } else if (c === '.' && !hasDot) {
          hasDot = true;
          i += 1;
        } else {
          break;
        }
      }

      if (i < clean.length && (clean[i] === 'e' || clean[i] === 'E')) {
        const expStart = i;
        i += 1;
        if (i < clean.length && (clean[i] === '+' || clean[i] === '-')) {
          i += 1;
        }
        let expDigits = 0;
        while (i < clean.length && /[0-9]/.test(clean[i])) {
          i += 1;
          expDigits += 1;
        }
        if (expDigits === 0) {
          i = expStart;
        }
      }

      const numStr = clean.slice(start, i);
      const parsed = Number(numStr);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid numeric literal "${numStr}" at position ${start}.`);
      }
      rawTokens.push({ type: 'NUMBER', value: parsed, pos: start });
      continue;
    }

    // Identifier (variable, constant, or function name)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      i += 1;
      while (i < clean.length && /[a-zA-Z0-9_]/.test(clean[i])) {
        i += 1;
      }
      const ident = clean.slice(start, i);
      rawTokens.push({ type: 'IDENT', value: ident, pos: start });
      continue;
    }

    // Arithmetic operators
    if ('+-*/%^'.includes(ch)) {
      rawTokens.push({ type: 'OP', value: ch, pos: i });
      i += 1;
      continue;
    }

    // Parentheses & commas
    if (ch === '(') {
      rawTokens.push({ type: 'LPAREN', value: '(', pos: i });
      i += 1;
      continue;
    }
    if (ch === ')') {
      rawTokens.push({ type: 'RPAREN', value: ')', pos: i });
      i += 1;
      continue;
    }
    if (ch === ',') {
      rawTokens.push({ type: 'COMMA', value: ',', pos: i });
      i += 1;
      continue;
    }

    throw new Error(`Unsupported character "${ch}" at position ${i}.`);
  }

  // Insert explicit '*' tokens for implicit multiplication
  const tokens = [];
  for (let idx = 0; idx < rawTokens.length; idx++) {
    const curr = rawTokens[idx];
    tokens.push(curr);

    const next = rawTokens[idx + 1];
    if (!next) continue;

    const currEndsValue =
      curr.type === 'NUMBER' ||
      curr.type === 'RPAREN' ||
      (curr.type === 'IDENT' && next.type !== 'LPAREN');

    const nextStartsValue =
      next.type === 'NUMBER' ||
      next.type === 'IDENT' ||
      next.type === 'LPAREN';

    if (currEndsValue && nextStartsValue) {
      tokens.push({ type: 'OP', value: '*', pos: next.pos });
    }
  }

  return tokens;
}

/**
 * Recursive-descent AST parser with operator precedence climbing and
 * strict function/variable whitelist validation.
 */
export class FormulaParser {
  /**
   * Parses an expression string into an optimized Abstract Syntax Tree (AST).
   * @param {string} expression
   * @returns {{ ast: Object, variables: Set<string>, functions: Set<string>, source: string }}
   */
  static parse(expression) {
    const tokens = tokenizeExpression(expression);
    let cursor = 0;
    const variables = new Set();
    const functions = new Set();

    const peek = () => tokens[cursor] || null;
    const consume = () => tokens[cursor++];

    const parseExpression = (minPrec = 1) => {
      let left = parseUnary();

      while (true) {
        const tok = peek();
        if (!tok || tok.type !== 'OP') break;

        const prec = OPERATOR_PRECEDENCE[tok.value];
        if (prec === undefined || prec < minPrec) break;

        consume();
        const nextMinPrec = RIGHT_ASSOCIATIVE.has(tok.value) ? prec : prec + 1;
        const right = parseExpression(nextMinPrec);

        left = {
          type: 'Binary',
          operator: tok.value,
          left,
          right
        };
      }

      return left;
    };

    const parseUnary = () => {
      const tok = peek();
      if (tok && tok.type === 'OP' && (tok.value === '+' || tok.value === '-')) {
        consume();
        const argument = parseUnary();
        if (tok.value === '+') return argument;
        return {
          type: 'Unary',
          operator: '-',
          argument
        };
      }
      return parsePrimary();
    };

    const parsePrimary = () => {
      const tok = peek();
      if (!tok) {
        throw new Error('Unexpected end of mathematical expression.');
      }

      if (tok.type === 'NUMBER') {
        consume();
        return { type: 'Literal', value: tok.value };
      }

      if (tok.type === 'LPAREN') {
        consume();
        const inner = parseExpression(1);
        const closing = peek();
        if (!closing || closing.type !== 'RPAREN') {
          throw new Error(`Missing closing parenthesis ")" near position ${tok.pos}.`);
        }
        consume();
        return inner;
      }

      if (tok.type === 'IDENT') {
        consume();
        const name = tok.value;

        // Function invocation: ident(...)
        if (peek() && peek().type === 'LPAREN') {
          const fnSpec = MATH_FUNCTIONS[name];
          if (!fnSpec) {
            throw new Error(`Unknown or disallowed math function "${name}()".`);
          }
          consume(); // '('
          const args = [];
          if (peek() && peek().type !== 'RPAREN') {
            args.push(parseExpression(1));
            while (peek() && peek().type === 'COMMA') {
              consume();
              args.push(parseExpression(1));
            }
          }
          const closeParen = peek();
          if (!closeParen || closeParen.type !== 'RPAREN') {
            throw new Error(`Missing closing ")" for function "${name}".`);
          }
          consume();

          if (args.length !== fnSpec.arity) {
            throw new Error(
              `Function "${name}()" expects ${fnSpec.arity} argument(s), received ${args.length}.`
            );
          }

          functions.add(name);
          return {
            type: 'Call',
            callee: name,
            args
          };
        }

        // Built-in mathematical constant
        if (Object.prototype.hasOwnProperty.call(MATH_CONSTANTS, name)) {
          return {
            type: 'Literal',
            value: MATH_CONSTANTS[name]
          };
        }

        // Dynamic variable (u, v, t, p1, p2, p3, p4, etc.)
        variables.add(name);
        return {
          type: 'Identifier',
          name
        };
      }

      throw new Error(`Unexpected token "${tok.value}" at position ${tok.pos}.`);
    };

    const rawAst = parseExpression(1);
    if (cursor < tokens.length) {
      const stray = tokens[cursor];
      throw new Error(`Unexpected trailing token "${stray.value}" at position ${stray.pos}.`);
    }

    const optimizedAst = FormulaParser.foldConstants(rawAst);
    return {
      ast: optimizedAst,
      variables,
      functions,
      source: expression
    };
  }

  /**
   * Constant-folding optimization pass that collapses static subtrees into
   * single Literal nodes for fast per-vertex evaluation.
   * @param {Object} node
   * @returns {Object}
   */
  static foldConstants(node) {
    if (!node || typeof node !== 'object') return node;

    if (node.type === 'Unary') {
      const arg = FormulaParser.foldConstants(node.argument);
      if (arg.type === 'Literal') {
        return { type: 'Literal', value: -arg.value };
      }
      return { ...node, argument: arg };
    }

    if (node.type === 'Binary') {
      const left = FormulaParser.foldConstants(node.left);
      const right = FormulaParser.foldConstants(node.right);
      if (left.type === 'Literal' && right.type === 'Literal') {
        const val = applyBinaryOp(node.operator, left.value, right.value);
        return { type: 'Literal', value: val };
      }
      return { ...node, left, right };
    }

    if (node.type === 'Call') {
      const args = node.args.map((a) => FormulaParser.foldConstants(a));
      if (args.every((a) => a.type === 'Literal')) {
        const fn = MATH_FUNCTIONS[node.callee].fn;
        const val = fn(...args.map((a) => a.value));
        return { type: 'Literal', value: sanitizeNumeric(val) };
      }
      return { ...node, args };
    }

    return node;
  }

  /**
   * Compiles an expression string into a fast, zero-eval JS closure `(scope) => number`.
   * @param {string} expression
   * @returns {{
   *   evaluate: (scope: Object) => number,
   *   ast: Object,
   *   variables: string[],
   *   functions: string[],
   *   source: string
   * }}
   */
  static compile(expression) {
    const parsed = FormulaParser.parse(expression);
    const evaluator = compileAstNode(parsed.ast);

    return {
      evaluate: (scope = {}) => sanitizeNumeric(evaluator(scope)),
      ast: parsed.ast,
      variables: Array.from(parsed.variables),
      functions: Array.from(parsed.functions),
      source: parsed.source
    };
  }
}

/**
 * Clamps non-finite or runaway values so malformed formulas never crash WebGL buffers.
 * @param {number} value
 * @returns {number}
 */
function sanitizeNumeric(value) {
  if (!Number.isFinite(value)) return 0;
  if (value > 1e4) return 1e4;
  if (value < -1e4) return -1e4;
  return value;
}

/**
 * Evaluates a binary arithmetic operator safely.
 * @param {string} op
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function applyBinaryOp(op, a, b) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return Math.abs(b) < 1e-9 ? 0 : a / b;
    case '%':
      return Math.abs(b) < 1e-9 ? 0 : a % b;
    case '^': {
      const clampedExp = Math.max(-16, Math.min(16, b));
      const res = Math.pow(a, clampedExp);
      return Number.isFinite(res) ? res : 0;
    }
    default:
      return 0;
  }
}

/**
 * Recursively compiles an AST node into a specialized closure tree.
 * @param {Object} node
 * @returns {(scope: Object) => number}
 */
function compileAstNode(node) {
  switch (node.type) {
    case 'Literal': {
      const val = node.value;
      return () => val;
    }

    case 'Identifier': {
      const key = node.name;
      return (scope) => {
        const v = scope[key];
        return typeof v === 'number' && Number.isFinite(v) ? v : 0;
      };
    }

    case 'Unary': {
      const evalArg = compileAstNode(node.argument);
      return (scope) => -evalArg(scope);
    }

    case 'Binary': {
      const evalL = compileAstNode(node.left);
      const evalR = compileAstNode(node.right);
      const op = node.operator;

      if (op === '+') return (scope) => evalL(scope) + evalR(scope);
      if (op === '-') return (scope) => evalL(scope) - evalR(scope);
      if (op === '*') return (scope) => evalL(scope) * evalR(scope);
      return (scope) => applyBinaryOp(op, evalL(scope), evalR(scope));
    }

    case 'Call': {
      const fn = MATH_FUNCTIONS[node.callee].fn;
      if (node.args.length === 1) {
        const a0 = compileAstNode(node.args[0]);
        return (scope) => fn(a0(scope));
      }
      if (node.args.length === 2) {
        const a0 = compileAstNode(node.args[0]);
        const a1 = compileAstNode(node.args[1]);
        return (scope) => fn(a0(scope), a1(scope));
      }
      const compiledArgs = node.args.map((arg) => compileAstNode(arg));
      return (scope) => fn(...compiledArgs.map((fnArg) => fnArg(scope)));
    }

    default:
      return () => 0;
  }
}

/**
 * Real-Time Parametric Constraint Solver & Field Telemetry Analyzer.
 * Evaluates compiled AST formulas across 2D/3D parametric domains, computes
 * stability & convergence metrics, and optimizes parameters against user constraints.
 */
export class ParametricConstraintSolver {
  /**
   * @param {Object} options
   */
  constructor(options = {}) {
    this.sampleResolution = options.sampleResolution || 32;
    this.domainMin = options.domainMin ?? -Math.PI;
    this.domainMax = options.domainMax ?? Math.PI;
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
      p1: 2.0,
      p2: 1.2,
      p3: 2.0,
      p4: 1.2
    };
  }

  /**
   * Samples the compiled formula over a uniform (u, v) grid and computes
   * convergence, Lipschitz stability index, RMS energy, and active node count.
   * @param {{ evaluate: Function }} compiled
   * @param {Object} params
   * @param {number} time
   * @param {number} renderGridResolution
   * @returns {Object}
   */
  analyzeField(compiled, params = {}, time = 0, renderGridResolution = 128) {
    const N = this.sampleResolution;
    const span = this.domainMax - this.domainMin;
    const step = span / Math.max(N - 1, 1);

    Object.assign(this._scope, params);
    this._scope.t = time;

    let sum = 0;
    let sumSq = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;
    let maxGradient = 0;
    let boundedCount = 0;
    const totalSamples = N * N;
    const grid = new Float32Array(totalSamples);

    for (let iv = 0; iv < N; iv++) {
      const v = this.domainMin + iv * step;
      this._scope.v = v;
      this._scope.y = v;

      for (let iu = 0; iu < N; iu++) {
        const u = this.domainMin + iu * step;
        this._scope.u = u;
        this._scope.x = u;
        this._scope.r = Math.hypot(u, v);
        this._scope.theta = Math.atan2(v, u);

        const val = compiled.evaluate(this._scope);
        const idx = iv * N + iu;
        grid[idx] = val;

        sum += val;
        sumSq += val * val;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
        if (Math.abs(val) < 25) boundedCount += 1;

        if (iu > 0) {
          const gradU = Math.abs(val - grid[idx - 1]) / step;
          if (gradU > maxGradient) maxGradient = gradU;
        }
        if (iv > 0) {
          const gradV = Math.abs(val - grid[idx - N]) / step;
          if (gradV > maxGradient) maxGradient = gradV;
        }
      }
    }

    const meanVal = sum / totalSamples;
    const rmsEnergy = Math.sqrt(sumSq / totalSamples);
    const boundedRatio = boundedCount / totalSamples;

    // Stability index penalizes steep discontinuous spikes while rewarding smooth energy
    const gradientPenalty = 1 / (1 + maxGradient * 0.085);
    const stabilityIndex = Number((boundedRatio * (0.45 + 0.55 * gradientPenalty)).toFixed(3));
    const convergencePct = Number(
      Math.min(99.9, Math.max(12.0, boundedRatio * 88.0 + gradientPenalty * 11.9)).toFixed(1)
    );

    const activeNodes = renderGridResolution * renderGridResolution;

    return {
      convergence: `${convergencePct}%`,
      convergenceNumeric: convergencePct,
      stabilityIndex,
      activeNodes,
      activeNodesFormatted: activeNodes.toLocaleString('en-US'),
      minVal: Number(minVal.toFixed(3)),
      maxVal: Number(maxVal.toFixed(3)),
      meanVal: Number(meanVal.toFixed(3)),
      rmsEnergy: Number(rmsEnergy.toFixed(3)),
      maxGradient: Number(maxGradient.toFixed(3))
    };
  }

  /**
   * Projected finite-difference gradient solver that adjusts parameters (p1..p4)
   * to satisfy target amplitude, RMS energy, and smoothness constraints.
   * @param {{ evaluate: Function }} compiled
   * @param {Object} initialParams
   * @param {Object} constraints
   * @returns {{ params: Object, metrics: Object, iterations: number }}
   */
  solveConstraints(compiled, initialParams = {}, constraints = {}) {
    const params = {
      p1: 2.0,
      p2: 1.2,
      p3: 2.0,
      p4: 1.2,
      ...initialParams
    };

    const bounds = constraints.bounds || {
      p1: [0.2, 8.0],
      p2: [0.1, 6.0],
      p3: [0.2, 8.0],
      p4: [0.2, 4.0]
    };

    const targetMax = constraints.targetMax ?? 2.4;
    const targetRms = constraints.targetRms ?? 0.95;
    const maxIter = constraints.maxIterations ?? 14;
    const tunableKeys = ['p1', 'p2', 'p3', 'p4'];
    const eps = 0.02;

    const computeLoss = (candidateParams) => {
      const stats = this.analyzeField(compiled, candidateParams, 0);
      const peakError = Math.max(0, stats.maxVal - targetMax) * 1.8;
      const rmsError = Math.abs(stats.rmsEnergy - targetRms);
      const stabilityPenalty = (1 - stats.stabilityIndex) * 1.5;
      return peakError + rmsError + stabilityPenalty;
    };

    let currentLoss = computeLoss(params);
    let stepSize = 0.12;
    let iter = 0;

    for (; iter < maxIter; iter++) {
      if (currentLoss < 0.04) break;

      const grad = {};
      for (const key of tunableKeys) {
        const orig = params[key];
        params[key] = orig + eps;
        const lossPlus = computeLoss(params);
        params[key] = orig;
        grad[key] = (lossPlus - currentLoss) / eps;
      }

      const candidate = { ...params };
      for (const key of tunableKeys) {
        const [lo, hi] = bounds[key] || [0.1, 10.0];
        const nextVal = candidate[key] - stepSize * Math.max(-4, Math.min(4, grad[key]));
        candidate[key] = Number(Math.max(lo, Math.min(hi, nextVal)).toFixed(3));
      }

      const nextLoss = computeLoss(candidate);
      if (nextLoss < currentLoss) {
        Object.assign(params, candidate);
        currentLoss = nextLoss;
      } else {
        stepSize *= 0.5;
      }
    }

    const finalMetrics = this.analyzeField(compiled, params, 0);
    return {
      params,
      metrics: finalMetrics,
      iterations: iter
    };
  }
}

/**
 * Convenience helper to compile a formula string directly.
 * @param {string} expression
 */
export function compileFormula(expression) {
  return FormulaParser.compile(expression);
}

/**
 * Convenience helper to evaluate an expression once against a variable scope.
 * @param {string} expression
 * @param {Object} scope
 * @returns {number}
 */
export function evaluateFormulaOnce(expression, scope = {}) {
  const compiled = FormulaParser.compile(expression);
  return compiled.evaluate(scope);
}

export default FormulaParser;
