window.NLPToolboxSampling = (() => {
  const normalize = (values) => {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(total) || total <= 0) { const best = values.indexOf(Math.max(...values)); return values.map((_, index) => index === best ? 1 : 0); }
    return values.map((value) => value / total);
  };
  const stableSoftmax = (logits) => {
    const max = Math.max(...logits); return normalize(logits.map((value) => Math.exp(value - max)));
  };
  const mulberry32 = (seed) => {
    let value = seed >>> 0;
    return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const hash = (text) => [...text].reduce((value, char) => ((value << 5) - value + char.charCodeAt(0)) | 0, 2166136261) >>> 0;
  const generateLogits = (context, vocabulary, transitions) => {
    const last = context.at(-1)?.toLowerCase() || '<BOS>';
    const boosts = transitions[last] || transitions['<default>'];
    const joined = context.join(' ');
    return vocabulary.map((token) => {
      const base = ((hash(`${joined}|${token}`) % 1800) / 1000) - 1.25;
      const boost = boosts[token] || 0;
      const thematic = context.some((word) => word.toLowerCase() === 'ai') && ['will','can','model','system','future'].includes(token) ? .35 : 0;
      return base + boost + thematic;
    });
  };
  const applyRepetitionPenalty = (logits, vocabulary, context, penalty) => logits.map((logit, index) => {
    if (!context.map((token) => token.toLowerCase()).includes(vocabulary[index].toLowerCase()) || penalty === 1) return logit;
    return logit > 0 ? logit / penalty : logit * penalty;
  });
  const applyTemperature = (logits, temperature) => logits.map((logit) => logit / Math.max(.05, temperature));
  const applyTopK = (probabilities, k) => {
    if (!k || k >= probabilities.length) return { probabilities: [...probabilities], kept: probabilities.map(() => true) };
    const keptIndices = new Set(probabilities.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index).slice(0, Math.max(1, k)).map((entry) => entry.index));
    return { probabilities: probabilities.map((value, index) => keptIndices.has(index) ? value : 0), kept: probabilities.map((_, index) => keptIndices.has(index)) };
  };
  const applyTopP = (probabilities, threshold) => {
    if (threshold >= 1) return { probabilities: [...probabilities], kept: probabilities.map(() => true), cumulative: probabilities.map(() => null) };
    const sorted = probabilities.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index);
    let sum = 0; const kept = new Set(); const cumulative = Array(probabilities.length).fill(null);
    for (const entry of sorted) { if (entry.value <= 0 && kept.size) continue; sum += entry.value; kept.add(entry.index); cumulative[entry.index] = sum; if (sum >= threshold) break; }
    if (!kept.size) kept.add(sorted[0].index);
    return { probabilities: probabilities.map((value, index) => kept.has(index) ? value : 0), kept: probabilities.map((_, index) => kept.has(index)), cumulative };
  };
  const categoricalSample = (probabilities, randomValue) => {
    let cumulative = 0;
    for (let index = 0; index < probabilities.length; index += 1) { cumulative += probabilities[index]; if (randomValue < cumulative || index === probabilities.length - 1) return index; }
    return 0;
  };
  const entropy = (probabilities) => probabilities.reduce((sum, value) => value > 0 ? sum - value * Math.log(value) : sum, 0);
  const sampleNextToken = ({ context, vocabulary, transitions, config, randomValue }) => {
    const rawLogits = generateLogits(context, vocabulary, transitions);
    const penalizedLogits = applyRepetitionPenalty(rawLogits, vocabulary, context, config.penalty);
    const temperatureLogits = applyTemperature(penalizedLogits, config.temperature);
    const originalProbabilities = stableSoftmax(rawLogits);
    const probabilities = stableSoftmax(temperatureLogits);
    const topK = applyTopK(probabilities, config.topK);
    const afterTopK = normalize(topK.probabilities);
    const topP = applyTopP(afterTopK, config.topP);
    const finalProbabilities = normalize(topP.probabilities);
    const selectedIndex = config.method === 'greedy' ? finalProbabilities.indexOf(Math.max(...finalProbabilities)) : categoricalSample(finalProbabilities, randomValue);
    return { context:[...context], config:{ ...config }, rawLogits, penalizedLogits, temperatureLogits, originalProbabilities, probabilities, topKKept:topK.kept, afterTopK, topPKept:topP.kept, cumulative:topP.cumulative, finalProbabilities, randomValue: config.method === 'greedy' ? null : randomValue, selectedIndex, selectedToken:vocabulary[selectedIndex], selectedProbability:finalProbabilities[selectedIndex], entropy:entropy(finalProbabilities) };
  };
  const runGeneration = ({ promptTokens, vocabulary, transitions, config }) => {
    const rng = mulberry32(config.seed); const generated = []; const snapshots = []; let context = [...promptTokens];
    for (let index = 0; index < config.maxTokens; index += 1) {
      const snapshot = sampleNextToken({ context, vocabulary, transitions, config, randomValue:rng() }); snapshots.push(snapshot);
      if (snapshot.selectedToken === '<EOS>') break; generated.push(snapshot.selectedToken); context = [...context, snapshot.selectedToken];
    }
    return { generated, snapshots };
  };
  const generationStats = (generated, snapshots) => {
    const unique = new Set(generated).size; const counts = generated.reduce((map, token) => ({ ...map, [token]: (map[token] || 0) + 1 }), {});
    return { length:generated.length, uniqueRatio: generated.length ? unique / generated.length : 0, repeated: Object.values(counts).reduce((sum, count) => sum + Math.max(0, count - 1), 0), averageProbability: snapshots.length ? snapshots.reduce((sum, item) => sum + item.selectedProbability, 0) / snapshots.length : 0, averageEntropy:snapshots.length ? snapshots.reduce((sum, item) => sum + item.entropy, 0) / snapshots.length : 0 };
  };
  return { normalize, stableSoftmax, mulberry32, generateLogits, applyRepetitionPenalty, applyTemperature, applyTopK, applyTopP, categoricalSample, entropy, sampleNextToken, runGeneration, generationStats };
})();
