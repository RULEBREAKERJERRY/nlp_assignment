window.NLPToolboxLoss = (() => {
  const EPSILON = 1e-12;
  const dataset = [
    { x: -2, y: 0, label: 'negative evidence' },
    { x: -1, y: 0, label: 'negative evidence' },
    { x: 1, y: 1, label: 'positive evidence' },
    { x: 2, y: 1, label: 'positive evidence' }
  ];
  const clampProbability = (value) => Math.min(1 - EPSILON, Math.max(EPSILON, value));
  const sigmoid = (value) => value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));
  const binaryCrossEntropy = (target, probability) => {
    const p = clampProbability(probability);
    return -(target * Math.log(p) + (1 - target) * Math.log(1 - p));
  };
  const multiclassCrossEntropy = (targets, probabilities) => targets.reduce((sum, target, index) => sum - target * Math.log(clampProbability(probabilities[index])), 0);
  const forwardLogisticRegression = (weight, bias, samples = dataset) => {
    const rows = samples.map((sample) => {
      const z = weight * sample.x + bias;
      const probability = sigmoid(z);
      return { ...sample, z, probability, loss: binaryCrossEntropy(sample.y, probability) };
    });
    return { rows, loss: rows.reduce((sum, row) => sum + row.loss, 0) / rows.length };
  };
  const computeLogisticGradients = (weight, bias, samples = dataset) => {
    const forward = forwardLogisticRegression(weight, bias, samples);
    const gradients = forward.rows.reduce((result, row) => {
      const dz = row.probability - row.y;
      result.dw += dz * row.x;
      result.db += dz;
      return result;
    }, { dw: 0, db: 0 });
    return { forward, dw: gradients.dw / samples.length, db: gradients.db / samples.length };
  };
  const gradientDescentStep = (weight, bias, learningRate, samples = dataset) => {
    const current = computeLogisticGradients(weight, bias, samples);
    const nextWeight = weight - learningRate * current.dw;
    const nextBias = bias - learningRate * current.db;
    const next = forwardLogisticRegression(nextWeight, nextBias, samples);
    return { ...current, oldWeight: weight, oldBias: bias, nextWeight, nextBias, next };
  };
  const quadraticLoss = (weight) => weight * weight;
  const quadraticGradient = (weight) => 2 * weight;
  const quadraticStep = (weight, learningRate) => {
    const gradient = quadraticGradient(weight);
    const nextWeight = weight - learningRate * gradient;
    return { weight, loss: quadraticLoss(weight), gradient, nextWeight, nextLoss: quadraticLoss(nextWeight) };
  };
  const runQuadraticOptimization = (learningRate, steps = 16, initialWeight = 2) => {
    const history = [{ iteration: 0, weight: initialWeight, loss: quadraticLoss(initialWeight) }];
    let weight = initialWeight;
    for (let iteration = 1; iteration <= steps; iteration += 1) {
      if (!Number.isFinite(weight) || Math.abs(weight) > 1e12) break;
      weight -= learningRate * quadraticGradient(weight);
      history.push({ iteration, weight, loss: quadraticLoss(weight) });
    }
    return history;
  };
  const analyzeTrainingState = (history, kind = 'logistic') => {
    if (history.some((point) => !Number.isFinite(point.loss) || !Number.isFinite(point.weight))) return 'NUMERICAL INSTABILITY';
    if (history.length < 3) return 'READY';
    const first = history[0].loss;
    const last = history.at(-1).loss;
    if (last > first * 4) return 'DIVERGING';
    if (kind === 'quadratic') {
      const signs = history.slice(-6).map((point) => Math.sign(point.weight));
      const crossings = signs.slice(1).filter((sign, index) => sign !== 0 && signs[index] !== 0 && sign !== signs[index]).length;
      if (crossings >= 2 && last >= first * 0.95) return 'OSCILLATING';
      if (last < first && last > first * 0.05) return 'SLOW';
    }
    const improvement = (first - last) / Math.max(first, EPSILON);
    if (improvement < 0.04) return 'SLOW';
    return 'CONVERGING';
  };
  return { EPSILON, dataset, clampProbability, sigmoid, binaryCrossEntropy, multiclassCrossEntropy, forwardLogisticRegression, computeLogisticGradients, gradientDescentStep, quadraticLoss, quadraticGradient, quadraticStep, runQuadraticOptimization, analyzeTrainingState };
})();
