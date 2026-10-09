window.NLPToolboxMetrics = (() => {
  const safeDivide = (top, bottom) => bottom > 0 ? top / bottom : null;
  const calculateConfusionMatrix = (truth, prediction) => {
    if (truth.length !== prediction.length || !truth.length) throw new Error('真实标签与预测标签必须包含相同数量的 0 / 1 标签。');
    return truth.reduce((matrix, actual, index) => {
      const predicted = prediction[index];
      if (!['0','1'].includes(actual) || !['0','1'].includes(predicted)) throw new Error('预测列表仅接受 0 和 1。');
      if (actual === '1' && predicted === '1') matrix.tp += 1;
      else if (actual === '0' && predicted === '1') matrix.fp += 1;
      else if (actual === '1' && predicted === '0') matrix.fn += 1;
      else matrix.tn += 1; return matrix;
    }, { tp:0, fp:0, fn:0, tn:0 });
  };
  const calculateClassification = ({ tp, fp, fn, tn }) => {
    const total = tp + fp + fn + tn;
    const accuracy = safeDivide(tp + tn, total), precision = safeDivide(tp, tp + fp), recall = safeDivide(tp, tp + fn);
    const f1 = precision === null || recall === null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall);
    return { total, accuracy, precision, recall, f1 };
  };
  const tokenizeForMetrics = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const buildNgrams = (tokens, n) => tokens.slice(0, Math.max(0, tokens.length - n + 1)).map((_, i) => tokens.slice(i, i + n).join(' '));
  const count = (items) => items.reduce((map, item) => { map[item] = (map[item] || 0) + 1; return map; }, {});
  const overlap = (candidate, reference) => {
    const candidateCounts = count(candidate), referenceCounts = count(reference); let clipped = 0;
    const trace = Object.entries(candidateCounts).map(([item, candidateCount]) => { const referenceCount = referenceCounts[item] || 0; const clippedCount = Math.min(candidateCount, referenceCount); clipped += clippedCount; return { item, candidateCount, referenceCount, clippedCount }; });
    return { clipped, trace };
  };
  const calculateBleu = (candidateText, referenceText) => {
    const candidate = tokenizeForMetrics(candidateText), reference = tokenizeForMetrics(referenceText); const c = candidate.length, r = reference.length;
    if (!c || !r) return { error:'参考文本和生成文本均需要至少一个可识别的 Token（词元）。', candidate, reference };
    const parts = [1,2].map((n) => { const candidateNgrams = buildNgrams(candidate, n), referenceNgrams = buildNgrams(reference, n); const match = overlap(candidateNgrams, referenceNgrams); return { n, candidateNgrams, referenceNgrams, ...match, precision:safeDivide(match.clipped, candidateNgrams.length) }; });
    const bp = c > r ? 1 : Math.exp(1 - r / c); const bleu1 = bp * (parts[0].precision || 0); const bleu2 = parts.every((part) => part.precision && part.precision > 0) ? bp * Math.exp((Math.log(parts[0].precision) + Math.log(parts[1].precision)) / 2) : 0;
    return { candidate, reference, parts, bp, bleu1, bleu2, c, r };
  };
  const calculateRougeN = (candidateTokens, referenceTokens, n) => { const candidate = buildNgrams(candidateTokens, n), reference = buildNgrams(referenceTokens, n), match = overlap(candidate, reference); const precision = safeDivide(match.clipped, candidate.length), recall = safeDivide(match.clipped, reference.length); const f1 = precision === null || recall === null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall); return { n, candidate, reference, ...match, precision, recall, f1 }; };
  const calculateLCS = (reference, candidate) => {
    const dp = Array.from({ length:reference.length + 1 }, () => Array(candidate.length + 1).fill(0));
    for (let i = 1; i <= reference.length; i += 1) for (let j = 1; j <= candidate.length; j += 1) dp[i][j] = reference[i - 1] === candidate[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const sequence = []; let i = reference.length, j = candidate.length;
    while (i && j) { if (reference[i - 1] === candidate[j - 1]) { sequence.unshift(reference[i - 1]); i -= 1; j -= 1; } else if (dp[i - 1][j] >= dp[i][j - 1]) i -= 1; else j -= 1; }
    return { length:dp[reference.length][candidate.length], sequence };
  };
  const calculateRougeL = (candidate, reference) => { const lcs = calculateLCS(reference, candidate), precision = safeDivide(lcs.length, candidate.length), recall = safeDivide(lcs.length, reference.length); return { ...lcs, precision, recall, f1:precision === null || recall === null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall) }; };
  const calculatePerplexity = (probabilities) => {
    if (!probabilities.length) return { error:'请至少输入一个概率。' };
    if (probabilities.some((p) => !Number.isFinite(p) || p <= 0 || p > 1)) return { error:'每个概率必须满足 0 < p ≤ 1。' };
    const logs = probabilities.map((p) => Math.log(p)), averageNll = -logs.reduce((sum, value) => sum + value, 0) / probabilities.length;
    return { logs, averageNll, ppl:Math.exp(averageNll) };
  };
  return { calculateConfusionMatrix, calculateClassification, tokenizeForMetrics, buildNgrams, calculateBleu, calculateRougeN, calculateLCS, calculateRougeL, calculatePerplexity };
})();
