(() => {
  const STOP_WORDS = new Set(['the','a','an','is','are','of','to','in','and','or','for','with','how','why','does','do','what','when','where','from','that','this','it','as','on','at','by','be','can','will']);
  const normalizeText = (text, lowercase = true) => (lowercase ? String(text || '').toLowerCase() : String(text || '')).replace(/[.,!?;:()[\]{}"'“”‘’/\\|*_+=<>-]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokenizeForRetrieval = (text, { stopWords = true } = {}) => {
    const normalized = normalizeText(text); const latin = normalized.match(/[a-z0-9]+/g) || []; const cjk = normalized.match(/[\u3400-\u9fff]+/g) || [];
    const tokens = [...latin, ...cjk.flatMap((group) => [...group])];
    return { all: tokens, tokens: stopWords ? tokens.filter((token) => !STOP_WORDS.has(token)) : tokens, removed: stopWords ? tokens.filter((token) => STOP_WORDS.has(token)) : [] };
  };
  const splitSentences = (text) => String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?。！？])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  const chunkByWords = (document, config) => {
    const words = normalizeText(document.content).split(' ').filter(Boolean); const size = Math.max(1, config.chunkSize); const overlap = Math.max(0, Math.min(size - 1, config.overlap)); const step = Math.max(1, size - overlap); const chunks = [];
    for (let start = 0, chunkIndex = 0; start < words.length; start += step, chunkIndex += 1) { const slice = words.slice(start, start + size); if (!slice.length) break; chunks.push({ id:`${document.id}::${chunkIndex + 1}`, documentId:document.id, documentTitle:document.title, chunkIndex:chunkIndex + 1, text:slice.join(' '), start, end:start + slice.length, overlapTokens: chunkIndex ? words.slice(start, Math.min(start + overlap, start + slice.length)) : [] }); if (start + size >= words.length) break; }
    return chunks;
  };
  const chunkBySentences = (document, config) => {
    const sentences = splitSentences(document.content); const size = Math.max(1, Math.min(2, config.chunkSize)); const overlap = Math.max(0, Math.min(size - 1, config.overlap)); const step = Math.max(1, size - overlap); const chunks = [];
    for (let start = 0, chunkIndex = 0; start < sentences.length; start += step, chunkIndex += 1) { const slice = sentences.slice(start, start + size); if (!slice.length) break; chunks.push({ id:`${document.id}::${chunkIndex + 1}`, documentId:document.id, documentTitle:document.title, chunkIndex:chunkIndex + 1, text:slice.join(' '), start, end:start + slice.length, overlapTokens: chunkIndex ? sentences.slice(start, Math.min(start + overlap, start + slice.length)) : [] }); if (start + size >= sentences.length) break; }
    return chunks;
  };
  const buildChunks = (documents, config) => documents.flatMap((document) => (config.strategy === 'sentence' ? chunkBySentences(document, config) : chunkByWords(document, config))).map((chunk) => ({ ...chunk, tokens:tokenizeForRetrieval(chunk.text, config).tokens }));
  const frequencyMap = (tokens) => tokens.reduce((map, token) => { map.set(token, (map.get(token) || 0) + 1); return map; }, new Map());
  const buildIndex = (chunks) => {
    const df = new Map(); const inverted = new Map(); const frequencies = new Map(); const lengths = new Map();
    chunks.forEach((chunk) => { const counts = frequencyMap(chunk.tokens); frequencies.set(chunk.id, counts); lengths.set(chunk.id, chunk.tokens.length); counts.forEach((_, term) => { df.set(term, (df.get(term) || 0) + 1); const ids = inverted.get(term) || new Set(); ids.add(chunk.id); inverted.set(term, ids); }); });
    const N = chunks.length; const idf = new Map([...df].map(([term, value]) => [term, Math.log((N + 1) / (value + 1)) + 1]));
    const avgLength = N ? [...lengths.values()].reduce((sum, value) => sum + value, 0) / N : 0;
    return { chunks, frequencies, lengths, df, idf, inverted, vocabulary:[...df.keys()].sort(), avgLength, N };
  };
  const normalizedTF = (term, counts, length) => length ? (counts.get(term) || 0) / length : 0;
  const vectorFor = (tokens, index) => { const counts = frequencyMap(tokens); const vector = new Map(); counts.forEach((_, term) => { if (index.idf.has(term)) vector.set(term, normalizedTF(term, counts, tokens.length) * index.idf.get(term)); }); return vector; };
  const cosineSimilarity = (left, right) => { let dot = 0; let leftNorm = 0; let rightNorm = 0; left.forEach((value, term) => { leftNorm += value * value; dot += value * (right.get(term) || 0); }); right.forEach((value) => { rightNorm += value * value; }); return leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : 0; };
  const bm25Idf = (N, df) => Math.log(((N - df + 0.5) / (df + 0.5)) + 1);
  const retrieve = (queryText, index, { method = 'bm25', k1 = 1.2, b = .75, stopWords = true } = {}) => {
    const query = tokenizeForRetrieval(queryText, { stopWords }); const available = query.tokens.filter((term) => index.idf.has(term)); const uniqueTerms = [...new Set(available)];
    if (!query.tokens.length || !available.length) return { query, available, results:[], noRetrievableTerms:true };
    const queryVector = vectorFor(available, index);
    const results = index.chunks.map((chunk) => {
      const counts = index.frequencies.get(chunk.id); const length = index.lengths.get(chunk.id); const chunkVector = vectorFor(chunk.tokens, index); const matchedTerms = uniqueTerms.filter((term) => counts.has(term));
      const contributions = matchedTerms.map((term) => { const tf = counts.get(term) || 0; const df = index.df.get(term) || 0; const tfidf = (queryVector.get(term) || 0) * (chunkVector.get(term) || 0); const idf = bm25Idf(index.N, df); const norm = 1 - b + b * (index.avgLength ? length / index.avgLength : 1); const bm25 = idf * ((tf * (k1 + 1)) / (tf + k1 * norm)); return { term, tf, df, tfidf, idf, norm, bm25, queryWeight:queryVector.get(term) || 0, chunkWeight:chunkVector.get(term) || 0 }; });
      const score = method === 'tfidf' ? cosineSimilarity(queryVector, chunkVector) : contributions.reduce((sum, item) => sum + item.bm25, 0);
      return { chunk, score:Number.isFinite(score) ? score : 0, matchedTerms, contributions, queryVector, chunkVector };
    }).sort((a, bResult) => bResult.score - a.score || a.chunk.documentId.localeCompare(bResult.chunk.documentId) || a.chunk.chunkIndex - bResult.chunk.chunkIndex).map((result, indexValue) => ({ ...result, rank:indexValue + 1 }));
    return { query, available, results, noRetrievableTerms:false };
  };
  const selectTopK = (results, k) => results.filter((result) => result.score > 0).slice(0, Math.max(1, Number(k) || 1));
  const assembleContext = (results) => results.map((result) => ({ ...result, source:`[Source ${result.rank}: ${result.chunk.documentTitle} / Chunk ${String(result.chunk.chunkIndex).padStart(2,'0')}]` }));
  const rankEvidence = (context, queryTokens, config) => context.flatMap((result) => splitSentences(result.chunk.text).map((sentence, index) => { const tokens = tokenizeForRetrieval(sentence, config).tokens; const overlap = [...new Set(tokens.filter((token) => queryTokens.includes(token)))]; return { sentence, overlap, score:overlap.length, source:result.source, result, sentenceIndex:index }; })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.result.rank - b.result.rank || a.sentenceIndex - b.sentenceIndex).slice(0, 3);
  const buildExtractiveAnswer = (evidence) => evidence.length ? evidence.map((item) => item.sentence).join(' ') : '';
  window.NLPToolboxRetrieval = { STOP_WORDS, normalizeText, tokenizeForRetrieval, splitSentences, chunkByWords, chunkBySentences, buildChunks, buildIndex, normalizedTF, vectorFor, cosineSimilarity, bm25Idf, retrieve, selectTopK, assembleContext, rankEvidence, buildExtractiveAnswer };
})();
