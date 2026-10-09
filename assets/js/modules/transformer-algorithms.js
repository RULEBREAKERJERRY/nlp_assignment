window.NLPToolboxTransformer = (() => {
  const EPSILON = 1e-5;
  const shape = (matrix) => [matrix.length, matrix[0]?.length || 0];
  const ensure = (condition, message) => { if (!condition) throw new Error(message); };
  const clone = (matrix) => matrix.map((row) => [...row]);
  const matrixMultiply = (left, right) => {
    const [, leftColumns] = shape(left); const [rightRows, rightColumns] = shape(right);
    ensure(leftColumns === rightRows, `Shape mismatch: ${shape(left).join('×')} cannot multiply ${shape(right).join('×')}`);
    return left.map((row) => Array.from({ length: rightColumns }, (_, column) => row.reduce((sum, value, index) => sum + value * right[index][column], 0)));
  };
  const matrixAdd = (left, right) => {
    ensure(shape(left).join(',') === shape(right).join(','), `Shape mismatch: ${shape(left).join('×')} and ${shape(right).join('×')}`);
    return left.map((row, index) => row.map((value, column) => value + right[index][column]));
  };
  const transpose = (matrix) => matrix[0].map((_, column) => matrix.map((row) => row[column]));
  const addBias = (matrix, bias) => matrix.map((row) => row.map((value, column) => value + bias[column]));
  const relu = (matrix) => matrix.map((row) => row.map((value) => Math.max(0, value)));
  const vectorMean = (vector) => vector.reduce((sum, value) => sum + value, 0) / vector.length;
  const vectorVariance = (vector, mean = vectorMean(vector)) => vector.reduce((sum, value) => sum + (value - mean) ** 2, 0) / vector.length;
  const layerNorm = (matrix, gamma = null, beta = null) => matrix.map((row) => {
    const mean = vectorMean(row); const variance = vectorVariance(row, mean); const denominator = Math.sqrt(variance + EPSILON);
    return row.map((value, index) => ((value - mean) / denominator) * (gamma?.[index] ?? 1) + (beta?.[index] ?? 0));
  });
  const positionalEncoding = (length, dimensions) => Array.from({ length }, (_, position) => Array.from({ length: dimensions }, (_, index) => {
    const exponent = (2 * Math.floor(index / 2)) / dimensions;
    const angle = position / (10000 ** exponent);
    return index % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
  }));
  const softmax = (vector) => {
    const finite = vector.filter(Number.isFinite); if (!finite.length) return vector.map(() => 0);
    const maximum = Math.max(...finite); const exps = vector.map((value) => value === -Infinity ? 0 : Math.exp(value - maximum));
    const total = exps.reduce((sum, value) => sum + value, 0); return exps.map((value) => value / total);
  };
  const softmaxRows = (matrix) => matrix.map(softmax);
  const splitHeads = (matrix, heads) => {
    const [, dimensions] = shape(matrix); ensure(dimensions % heads === 0, 'num_heads must divide d_model');
    const size = dimensions / heads;
    return Array.from({ length: heads }, (_, head) => matrix.map((row) => row.slice(head * size, (head + 1) * size)));
  };
  const combineHeads = (heads) => heads[0].map((_, row) => heads.flatMap((head) => head[row]));
  const causalMask = (length) => Array.from({ length }, (_, row) => Array.from({ length }, (_, column) => column <= row));
  const scaledDotProductAttention = (q, k, v, causal) => {
    const dimensions = shape(q)[1]; const rawScores = matrixMultiply(q, transpose(k)).map((row) => row.map((value) => value / Math.sqrt(dimensions)));
    const mask = causal ? causalMask(q.length) : rawScores.map((row) => row.map(() => true));
    const maskedScores = rawScores.map((row, index) => row.map((value, column) => mask[index][column] ? value : -Infinity));
    const weights = softmaxRows(maskedScores); const output = matrixMultiply(weights, v);
    return { rawScores, mask, maskedScores, weights, output };
  };
  const runTransformerBlock = ({ embedding, parameters, positional = true, causal = false, heads = 2 }) => {
    const position = positionalEncoding(embedding.length, 4);
    const input = positional ? matrixAdd(embedding, position) : clone(embedding);
    const q = matrixMultiply(input, parameters.wq); const k = matrixMultiply(input, parameters.wk); const v = matrixMultiply(input, parameters.wv);
    const qHeads = splitHeads(q, heads); const kHeads = splitHeads(k, heads); const vHeads = splitHeads(v, heads);
    const attentionHeads = qHeads.map((head, index) => scaledDotProductAttention(head, kHeads[index], vHeads[index], causal));
    const headOutputs = attentionHeads.map((head) => head.output); const concat = combineHeads(headOutputs); const projected = matrixMultiply(concat, parameters.wo);
    const residual1 = matrixAdd(input, projected); const norm1 = layerNorm(residual1);
    const ffnHiddenLinear = addBias(matrixMultiply(norm1, parameters.w1), parameters.b1); const ffnHidden = relu(ffnHiddenLinear);
    const ffnOutput = addBias(matrixMultiply(ffnHidden, parameters.w2), parameters.b2); const residual2 = matrixAdd(norm1, ffnOutput); const output = layerNorm(residual2);
    return { embedding, position, input, q, k, v, qHeads, kHeads, vHeads, attentionHeads, headOutputs, concat, projected, residual1, norm1, ffnHiddenLinear, ffnHidden, ffnOutput, residual2, output };
  };
  return { EPSILON, shape, matrixMultiply, matrixAdd, transpose, addBias, relu, vectorMean, vectorVariance, layerNorm, positionalEncoding, softmax, softmaxRows, splitHeads, combineHeads, causalMask, scaledDotProductAttention, runTransformerBlock };
})();
