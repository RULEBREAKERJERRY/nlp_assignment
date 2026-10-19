(() => {
  const MATH_NS = 'http://www.w3.org/1998/Math/MathML';
  const SUBSCRIPT = new Map(Object.entries({ '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ᵢ':'i','ⱼ':'j','ₖ':'k','ₙ':'n','ₜ':'t','ₚ':'p','ₓ':'x' }));
  const SUPERSCRIPT = new Map(Object.entries({ '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ᵀ':'T','ⁿ':'n' }));
  const RELATIONS = new Set(['=', '≈', '≠', '<', '>', '≤', '≥', '→']);
  const ADDITIVE = new Set(['+', '-', '−', '±']);
  const MULTIPLICATIVE = new Set(['*', '×', '·', '⊙']);
  const DELIMITERS = new Set(['(', ')', '[', ']', '{', '}', ',', ':', '：', ';', '；', '|']);
  const LARGE_OPERATORS = new Set(['Σ', '∑', 'Π', '∏']);

  const mathNode = (tag, value, attributes = {}) => {
    const node = document.createElementNS(MATH_NS, tag);
    Object.entries(attributes).forEach(([name, content]) => node.setAttribute(name, content));
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) node.append(...value.filter(Boolean));
      else if (value instanceof Node) node.append(value);
      else node.textContent = String(value);
    }
    return node;
  };
  const row = (...children) => mathNode('mrow', children.flat());
  const operator = (value, attributes) => mathNode('mo', value, attributes);
  const fenced = (content, open = '(', close = ')') => row(operator(open), content, operator(close));

  const isNumberStart = (char, next) => /\d/.test(char) || (char === '.' && /\d/.test(next || ''));
  const isIdentifierChar = (char) => Boolean(char) && !/\s/.test(char) && !RELATIONS.has(char) && !ADDITIVE.has(char) && !MULTIPLICATIVE.has(char) && !DELIMITERS.has(char) && !['/', '÷', '^'].includes(char);
  const tokenize = (source) => {
    const tokens = [];
    let index = 0;
    while (index < source.length) {
      const char = source[index];
      if (/\s/.test(char)) { index += 1; continue; }
      const pair = source.slice(index, index + 2);
      if (['<=', '>=', '!=', '->'].includes(pair)) {
        tokens.push({ type:'operator', value:({ '<=':'≤', '>=':'≥', '!=':'≠', '->':'→' })[pair] });
        index += 2;
        continue;
      }
      if (isNumberStart(char, source[index + 1])) {
        let value = char; index += 1;
        while (index < source.length && /[\d.]/.test(source[index])) { value += source[index]; index += 1; }
        tokens.push({ type:'number', value });
        continue;
      }
      if (RELATIONS.has(char) || ADDITIVE.has(char) || MULTIPLICATIVE.has(char) || ['/', '÷', '^'].includes(char)) {
        tokens.push({ type:'operator', value:char }); index += 1; continue;
      }
      if (DELIMITERS.has(char)) { tokens.push({ type:'delimiter', value:char }); index += 1; continue; }
      let value = char; index += 1;
      while (index < source.length && isIdentifierChar(source[index])) { value += source[index]; index += 1; }
      tokens.push({ type:'identifier', value });
    }
    return tokens;
  };

  const scriptedIdentifier = (value) => {
    let base = value;
    let subscript = '';
    let superscript = '';
    const underscore = base.indexOf('_');
    if (underscore > 0) {
      subscript = base.slice(underscore + 1);
      base = base.slice(0, underscore);
    }
    while (base.length && SUBSCRIPT.has(base.at(-1))) { subscript = SUBSCRIPT.get(base.at(-1)) + subscript; base = base.slice(0, -1); }
    while (base.length && SUPERSCRIPT.has(base.at(-1))) { superscript = SUPERSCRIPT.get(base.at(-1)) + superscript; base = base.slice(0, -1); }
    const isText = /[\u3400-\u9fff]/.test(base) || /\s/.test(base);
    let result = mathNode(isText ? 'mtext' : 'mi', base || value, isText ? {} : { mathvariant:'normal' });
    if (subscript) result = mathNode('msub', [result, mathNode(/^[\d.]+$/.test(subscript) ? 'mn' : 'mi', subscript, { mathvariant:'normal' })]);
    if (superscript) result = mathNode('msup', [result, mathNode(/^[\d.]+$/.test(superscript) ? 'mn' : 'mi', superscript, { mathvariant:'normal' })]);
    return result;
  };

  class FormulaParser {
    constructor(source) { this.tokens = tokenize(source); this.index = 0; }
    peek(value) { const token = this.tokens[this.index]; return value === undefined ? token : token?.value === value; }
    take() { const token = this.tokens[this.index]; this.index += 1; return token; }
    parse() {
      const parts = [];
      while (this.index < this.tokens.length) {
        parts.push(this.relation());
        if (this.index >= this.tokens.length) break;
        const token = this.take();
        parts.push(operator(token.value));
        if ([';', '；'].includes(token.value)) parts.push(mathNode('mspace', null, { width:'.65em' }));
      }
      return row(parts);
    }
    relation() {
      let left = this.additive();
      while (this.peek() && RELATIONS.has(this.peek().value)) {
        const op = this.take().value;
        left = row(left, operator(op), this.additive());
      }
      return left;
    }
    additive() {
      let left = this.multiplicative();
      while (this.peek() && ADDITIVE.has(this.peek().value)) {
        const op = this.take().value;
        left = row(left, operator(op), this.multiplicative());
      }
      return left;
    }
    multiplicative() {
      let left = this.power();
      while (this.peek()) {
        const op = this.peek().value;
        if (MULTIPLICATIVE.has(op)) {
          this.take(); left = row(left, operator(op === '*' ? '×' : op), this.power()); continue;
        }
        if (op === '/' || op === '÷') {
          this.take(); left = mathNode('mfrac', [left, this.power()]); continue;
        }
        break;
      }
      return left;
    }
    power() {
      let base = this.unary();
      while (this.peek('^')) { this.take(); base = mathNode('msup', [base, this.unary()]); }
      return base;
    }
    unary() {
      if (this.peek() && ['-', '−', '+'].includes(this.peek().value)) return row(operator(this.take().value), this.unary());
      return this.primary();
    }
    primary() {
      const token = this.take();
      if (!token) return mathNode('mtext', '');
      if (token.type === 'number') return mathNode('mn', token.value);
      if (token.value === '(' || token.value === '[' || token.value === '{') {
        const close = ({ '(' : ')', '[' : ']', '{' : '}' })[token.value];
        const content = this.relation();
        if (this.peek(close)) this.take();
        return fenced(content, token.value, close);
      }
      if (token.type === 'delimiter') return operator(token.value);
      if (LARGE_OPERATORS.has(token.value)) return operator(token.value, { largeop:'true' });
      const identifier = scriptedIdentifier(token.value);
      if (this.peek('(')) {
        this.take();
        const argumentsList = [];
        while (this.index < this.tokens.length && !this.peek(')')) {
          argumentsList.push(this.relation());
          if (this.peek(',')) { this.take(); argumentsList.push(operator(',')); }
          else if (!this.peek(')')) break;
        }
        if (this.peek(')')) this.take();
        return row(identifier, fenced(row(argumentsList)));
      }
      return identifier;
    }
  }

  const createFormula = (source, display = true) => {
    const math = mathNode('math', null, { display:display ? 'block' : 'inline', role:'math', 'aria-label':source });
    const semantics = mathNode('semantics');
    semantics.append(new FormulaParser(source).parse(), mathNode('annotation', source, { encoding:'text/plain' }));
    math.append(semantics);
    return math;
  };
  const renderElement = (element) => {
    if (!element || element.dataset.mathRendered === 'true') return;
    const source = (element.dataset.math || element.textContent || '').trim();
    if (!source) return;
    element.dataset.mathRendered = 'true';
    element.dataset.mathSource = source;
    element.replaceChildren(createFormula(source, !element.classList.contains('formula-inline')));
  };
  const render = (root = document) => {
    if (root.matches?.('.formula, .formula-inline')) renderElement(root);
    root.querySelectorAll?.('.formula:not([data-math-rendered]), .formula-inline:not([data-math-rendered])').forEach(renderElement);
  };
  const start = () => {
    render(document);
    if (!document.body || !('MutationObserver' in window)) return;
    new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) render(node);
    }))).observe(document.body, { childList:true, subtree:true });
  };

  window.NLPToolboxMath = { createFormula, render, tokenize };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
