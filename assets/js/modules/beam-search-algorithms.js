window.NLPToolboxBeamSearch = (() => {
  const EPSILON = 1e-12;
  const stableSoftmax = (logits) => {
    const max = Math.max(...logits);
    const values = logits.map((value) => Math.exp(value - max));
    const total = values.reduce((sum, value) => sum + value, 0);
    return total > 0 && Number.isFinite(total) ? values.map((value) => value / total) : values.map((_, index) => index === 0 ? 1 : 0);
  };
  const tokenizePrompt = (text) => String(text || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean).slice(-12);
  const lengthPenalty = (length, alpha) => Math.pow((5 + Math.max(0, length)) / 6, Math.max(0, alpha));
  const rankingScore = (rawScore, length, alpha) => rawScore / lengthPenalty(length, alpha);
  const sequenceText = (promptTokens, tokens) => [...promptTokens, ...tokens.filter((token) => token !== '<EOS>')].join(' ');
  const compareCandidates = (left, right) => right.normalizedScore - left.normalizedScore || right.rawScore - left.rawScore || left.sequenceKey.localeCompare(right.sequenceKey) || left.order - right.order;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const createInitialState = (prompt, config) => {
    const promptTokens = tokenizePrompt(prompt);
    const root = { id:'root', parentId:null, step:0, token:'PROMPT', generatedTokens:[], sequence:sequenceText(promptTokens, []), tokenProbability:1, tokenLogProbability:0, rawScore:0, length:0, lengthPenalty:1, normalizedScore:0, status:'root' };
    return { promptTokens, config:{ ...config }, step:0, activeBeams:[{ id:'beam-root', nodeId:'root', tokens:[], rawScore:0, length:0, normalizedScore:0, status:'active' }], finishedHypotheses:[], treeNodes:[root], lastCandidates:[], distributions:[], expandedNodes:0, prunedNodes:0, completed:false };
  };
  const getDistribution = (beam, state, dependencies) => {
    const context = [...state.promptTokens, ...beam.tokens];
    const logits = dependencies.generateLogits({ context, generated:beam.tokens, mode:state.config.mode });
    const probabilities = stableSoftmax(logits);
    return dependencies.vocabulary.map((token, index) => ({ token, logit:logits[index], probability:probabilities[index], logProbability:Math.log(Math.max(EPSILON, probabilities[index])) })).sort((left, right) => right.probability - left.probability || left.token.localeCompare(right.token));
  };
  const makeCandidate = (beam, item, state, order) => {
    const tokens = item.token === '<EOS>' ? [...beam.tokens, '<EOS>'] : [...beam.tokens, item.token];
    const length = beam.length + (item.token === '<EOS>' ? 0 : 1);
    const rawScore = beam.rawScore + item.logProbability;
    const penalty = lengthPenalty(length, state.config.alpha);
    return { id:`node-${state.step + 1}-${order}`, parentId:beam.nodeId, parentBeamId:beam.id, step:state.step + 1, token:item.token, tokenProbability:item.probability, tokenLogProbability:item.logProbability, tokens, length, rawScore, lengthPenalty:penalty, normalizedScore:rawScore / penalty, finished:item.token === '<EOS>', status:'candidate', order, sequenceKey:tokens.join(' ') };
  };
  const finaliseAtLimit = (next) => {
    if (next.step < next.config.maxNewTokens && next.activeBeams.length) return next;
    const truncated = next.activeBeams.map((beam) => ({ ...beam, status:'truncated' }));
    const ids = new Set(truncated.map((beam) => beam.nodeId));
    next.treeNodes = next.treeNodes.map((node) => ids.has(node.id) ? { ...node, status:'truncated' } : node);
    next.lastCandidates = next.lastCandidates.map((candidate) => ids.has(candidate.id) ? { ...candidate, status:'truncated' } : candidate);
    next.finishedHypotheses = [...next.finishedHypotheses, ...truncated];
    next.activeBeams = [];
    next.completed = true;
    return next;
  };
  const beamSearchStep = (state, dependencies) => {
    if (state.completed || !state.activeBeams.length || state.step >= state.config.maxNewTokens) return clone(state);
    const next = clone(state);
    const expansions = [];
    const distributions = [];
    let order = next.treeNodes.length;
    next.activeBeams.forEach((beam) => {
      const distribution = getDistribution(beam, next, dependencies);
      const candidates = distribution.slice(0, next.config.beamWidth).map((item) => makeCandidate(beam, item, next, order++));
      distributions.push({ beamId:beam.id, nodeId:beam.nodeId, sequence:sequenceText(next.promptTokens, beam.tokens), all:distribution.slice(0, 5), candidates });
      expansions.push(...candidates);
    });
    const ranked = [...expansions].sort(compareCandidates);
    const keptIds = new Set(ranked.slice(0, next.config.beamWidth).map((candidate) => candidate.id));
    const nodes = expansions.map((candidate) => ({ ...candidate, sequence:sequenceText(next.promptTokens, candidate.tokens), status:keptIds.has(candidate.id) ? (candidate.finished ? 'finished' : 'active') : 'pruned' }));
    const retained = nodes.filter((candidate) => keptIds.has(candidate.id));
    next.treeNodes.push(...nodes);
    next.lastCandidates = nodes.sort(compareCandidates);
    next.distributions = distributions;
    next.expandedNodes += nodes.length;
    next.prunedNodes += nodes.length - retained.length;
    next.step += 1;
    next.activeBeams = retained.filter((candidate) => !candidate.finished).map((candidate, index) => ({ id:`beam-${next.step}-${index + 1}`, nodeId:candidate.id, tokens:candidate.tokens, rawScore:candidate.rawScore, length:candidate.length, normalizedScore:candidate.normalizedScore, status:'active' }));
    next.finishedHypotheses = [...next.finishedHypotheses, ...retained.filter((candidate) => candidate.finished).map((candidate) => ({ id:`finished-${candidate.id}`, nodeId:candidate.id, tokens:candidate.tokens, rawScore:candidate.rawScore, length:candidate.length, normalizedScore:candidate.normalizedScore, status:'finished' }))];
    if (!next.activeBeams.length) next.completed = true;
    return finaliseAtLimit(next);
  };
  const runBeamSearch = (prompt, config, dependencies) => {
    let state = createInitialState(prompt, config);
    while (!state.completed && state.step < config.maxNewTokens) state = beamSearchStep(state, dependencies);
    return state;
  };
  const finalHypotheses = (state) => [...state.finishedHypotheses].sort((left, right) => right.normalizedScore - left.normalizedScore || right.rawScore - left.rawScore || left.tokens.join(' ').localeCompare(right.tokens.join(' ')));
  const backtrack = (treeNodes, nodeId) => { const nodes = new Map(treeNodes.map((node) => [node.id, node])); const path = []; let current = nodes.get(nodeId); while (current) { path.unshift(current); current = current.parentId ? nodes.get(current.parentId) : null; } return path; };
  return { EPSILON, stableSoftmax, tokenizePrompt, lengthPenalty, rankingScore, sequenceText, compareCandidates, createInitialState, getDistribution, beamSearchStep, runBeamSearch, finalHypotheses, backtrack, clone };
})();
