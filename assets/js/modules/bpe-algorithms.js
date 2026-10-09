(() => {
  const END = '</w>';
  const cloneEntries = (entries) => entries.map((entry) => ({ ...entry, symbols: [...entry.symbols] }));
  const pairKey = (left, right) => `${left}\u0001${right}`;
  const normalizeWhitespace = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const cleanWord = (word, lowercase = true) => {
    const letters = String(word || '').replace(/[^A-Za-z]/g, '');
    return lowercase ? letters.toLowerCase() : letters;
  };
  const parseCorpus = (text, { lowercase = true } = {}) => {
    const words = normalizeWhitespace(text).split(' ').map((word) => cleanWord(word, lowercase)).filter(Boolean);
    const frequencies = new Map();
    words.forEach((word) => frequencies.set(word, (frequencies.get(word) || 0) + 1));
    return [...frequencies.entries()].sort(([left], [right]) => left.localeCompare(right))
      .map(([word, frequency]) => ({ word, frequency, symbols: [...word, END] }));
  };
  const vocabularyFor = (entries) => [...new Set([END, ...entries.flatMap((entry) => entry.symbols)])].sort((left, right) => left.localeCompare(right));
  const countPairs = (entries) => {
    const pairs = new Map();
    entries.forEach(({ symbols, frequency }) => {
      for (let index = 0; index < symbols.length - 1; index += 1) {
        const left = symbols[index]; const right = symbols[index + 1]; const key = pairKey(left, right);
        const pair = pairs.get(key) || { left, right, count: 0 };
        pair.count += frequency;
        pairs.set(key, pair);
      }
    });
    return [...pairs.values()].sort((a, b) => b.count - a.count || a.left.localeCompare(b.left) || a.right.localeCompare(b.right));
  };
  // Keep </w> visible in Pair Frequency, but do not select a final symbol + </w> merge in this teaching flow.
  const selectBestPair = (pairs) => pairs.find((pair) => pair.right !== END) || null;
  const mergeSymbols = (symbols, left, right) => {
    const merged = [];
    for (let index = 0; index < symbols.length; index += 1) {
      if (symbols[index] === left && symbols[index + 1] === right) { merged.push(`${left}${right}`); index += 1; }
      else merged.push(symbols[index]);
    }
    return merged;
  };
  const pairOccurrences = (entries, pair) => !pair ? [] : entries.map((entry) => {
    let occurrences = 0;
    for (let index = 0; index < entry.symbols.length - 1; index += 1) if (entry.symbols[index] === pair.left && entry.symbols[index + 1] === pair.right) occurrences += 1;
    return { word: entry.word, frequency: entry.frequency, occurrences, contribution: occurrences * entry.frequency };
  }).filter((entry) => entry.occurrences > 0);
  const createState = (corpusText, maximumMerges = 10, { lowercase = true } = {}) => {
    const entries = parseCorpus(corpusText, { lowercase }); const initialVocabulary = vocabularyFor(entries);
    return { corpusText: normalizeWhitespace(corpusText), lowercase, entries, initialEntries: cloneEntries(entries), rules: [], vocabulary: [...initialVocabulary], initialVocabulary, maximumMerges: Math.max(1, Math.min(50, Number(maximumMerges) || 10)), step: 0 };
  };
  const snapshot = (state) => ({ ...state, entries: cloneEntries(state.entries), initialEntries: cloneEntries(state.initialEntries), rules: state.rules.map((rule) => ({ ...rule })), vocabulary: [...state.vocabulary], initialVocabulary: [...state.initialVocabulary] });
  const nextMerge = (state) => {
    const pairs = countPairs(state.entries); const bestPair = selectBestPair(pairs);
    if (!bestPair || state.rules.length >= state.maximumMerges) return { state: snapshot(state), bestPair: null, complete: true };
    const merged = `${bestPair.left}${bestPair.right}`;
    const entries = state.entries.map((entry) => ({ ...entry, symbols: mergeSymbols(entry.symbols, bestPair.left, bestPair.right) }));
    const rules = [...state.rules, { step: state.rules.length + 1, left: bestPair.left, right: bestPair.right, merged, count: bestPair.count }];
    const vocabulary = [...new Set([...state.initialVocabulary, ...rules.map((rule) => rule.merged)])].sort((left, right) => left.localeCompare(right));
    const next = { ...state, entries, rules, vocabulary, step: state.step + 1 };
    return { state: next, bestPair, complete: rules.length >= state.maximumMerges || !selectBestPair(countPairs(entries)) };
  };
  const tokenizeWord = (word, rules, { lowercase = true, baseVocabulary = [], ruleLimit = rules.length } = {}) => {
    const normalized = cleanWord(word, lowercase); let symbols = [...normalized, END]; const base = new Set(baseVocabulary);
    const unseenCharacters = [...new Set([...normalized].filter((symbol) => !base.has(symbol)))];
    const trace = [{ kind: 'INITIAL', symbols: [...symbols], rule: null, applied: true }];
    rules.slice(0, Math.max(0, ruleLimit)).forEach((rule) => {
      const next = mergeSymbols(symbols, rule.left, rule.right); const applied = next.join('\u0001') !== symbols.join('\u0001');
      trace.push({ kind: `RULE ${String(rule.step).padStart(2, '0')}`, symbols: [...next], rule, applied }); symbols = next;
    });
    return { word: normalized, tokens: symbols.map((symbol) => symbol.replace(END, '')).filter(Boolean), symbols, trace, unseenCharacters };
  };
  const tokenizeText = (text, rules, options = {}) => normalizeWhitespace(text).split(' ').map((word) => cleanWord(word, options.lowercase !== false)).filter(Boolean).map((word) => tokenizeWord(word, rules, options));
  window.NLPToolboxBPE = { END, normalizeWhitespace, cleanWord, parseCorpus, vocabularyFor, countPairs, selectBestPair, mergeSymbols, pairOccurrences, createState, snapshot, nextMerge, tokenizeWord, tokenizeText };
})();
