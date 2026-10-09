(() => {
  const shell = document.querySelector('[data-experiment="transformer"]');
  const data = window.NLPToolboxData?.transformer;
  const math = window.NLPToolboxTransformer;
  if (!shell || !data || !math) return;

  const steps = ['词元','词向量','位置编码','Q / K / V','多头注意力','遮罩','Attention','拼接与投影','残差与归一化','前馈网络','输出'];
  const matrixLabels = { TOKENS:'词元索引', Embedding:'词向量', Position:'位置编码', Input:'输入表示', Scores:'分数', 'Masked scores':'遮罩后分数', 'Attention weights':'Attention 权重', 'Head output':'头部输出', Concat:'拼接结果', Projection:'投影结果', 'Residual 1':'残差 1', 'Norm 1':'归一化 1', 'FFN hidden':'FFN 隐藏层', 'FFN output':'FFN 输出', 'Residual 2':'残差 2', 'Block output':'模块输出', 'Norm 2 / output':'归一化 2 / 输出' };
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'value') node.value = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.append(child));
    return node;
  };
  const button = (text, className, onClick, extra = {}) => el('button', { type: 'button', className, text, onClick, ...extra });
  const format = (value) => value === -Infinity ? '已遮罩' : Number.isFinite(value) ? Number(value).toFixed(3) : '—';
  const matrixLabel = (name) => name.startsWith('Q Head') ? `Q 第 ${name.split(' ').at(-1)} 头` : name.startsWith('K Head') ? `K 第 ${name.split(' ').at(-1)} 头` : name.startsWith('V Head') ? `V 第 ${name.split(' ').at(-1)} 头` : name.startsWith('Attention Head') ? `Attention 第 ${name.split(' ').at(-1)} 头` : matrixLabels[name] || name;
  const tokenize = (text) => text.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const shapeText = (matrix) => math.shape(matrix).join(' × ');
  const state = { text: data.examples.Love, positional: true, causal: false, heads: 2, head: 0, step: 0, inspect: 'Input', detail: null, timer: null };
  const stopAuto = () => { if (state.timer) window.clearInterval(state.timer); state.timer = null; };

  const matrixTable = (name, matrix, rowLabels, { mask = false, maskPattern = null, heatmap = false, columnLabels = null } = {}) => {
    const [, columns] = math.shape(matrix);
    const tbody = el('tbody');
    matrix.forEach((row, rowIndex) => {
      const tr = el('tr'); tr.append(el('th', { text: rowLabels?.[rowIndex] ?? `${rowIndex}` }));
      row.forEach((value, columnIndex) => {
        const masked = mask && (value === -Infinity || maskPattern?.[rowIndex]?.[columnIndex] === false);
        const cell = button(masked ? '遮罩' : format(value), `transformer-cell${masked ? ' is-masked' : ''}${heatmap && !masked ? ' is-heat' : ''}`, () => { state.detail = { name, row: rowIndex, column: columnIndex }; render(); }, { 'aria-label': `${matrixLabel(name)}，第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列：${masked ? '已遮罩' : format(value)}` });
        if (heatmap && !masked) cell.style.setProperty('--weight', Math.max(0, Math.min(1, value)));
        tr.append(el('td', {}, cell));
      });
      tbody.append(tr);
    });
    return el('div', { className: 'transformer-matrix-wrap' }, [el('table', { className: 'transformer-matrix' }, [
      el('thead', {}, el('tr', {}, [el('th', { text: matrixLabel(name) }), ...Array.from({ length: columns }, (_, index) => el('th', { text: columnLabels?.[index] ?? `d${index + 1}` }))])), tbody
    ])]);
  };
  const matrixPanel = (name, matrix, rowLabels, description, options = {}) => el('article', { className: 'transformer-panel' }, [
    el('div', { className: 'matrix-meta' }, [el('p', { className: 'tool-label', text: matrixLabel(name) }), el('span', { text: `形状 ${shapeText(matrix)}` })]),
    el('p', { className: 'matrix-description', text: description }), matrixTable(name, matrix, rowLabels, options)
  ]);
  const currentDetail = (result, tokens) => {
    if (!state.detail) return el('p', { className: 'input-help', text: '点击任意矩阵数值，可查看对应的具体计算。' });
    const { name, row, column } = state.detail;
    if (name === 'Input') return el('p', { className: 'formula', text: `X[${tokens[row]}, d${column + 1}] = 词向量 ${format(result.embedding[row][column])} + 位置编码 ${format(result.position[row][column])} = ${format(result.input[row][column])}` });
    if (name === 'Q' || name === 'K' || name === 'V') {
      const parameter = name === 'Q' ? data.parameters.wq : name === 'K' ? data.parameters.wk : data.parameters.wv;
      const value = result[name.toLowerCase()][row][column];
      return el('p', { className: 'formula', text: `${name}[${tokens[row]}, d${column + 1}] = X_row · W${name}_column = ${result.input[row].map((item, index) => `${format(item)}×${format(parameter[index][column])}`).join(' + ')} = ${format(value)}` });
    }
    if (name === 'Residual 1') return el('p', { className: 'formula', text: `残差 1 = 输入表示 + Attention 输出 = ${format(result.input[row][column])} + ${format(result.projected[row][column])} = ${format(result.residual1[row][column])}` });
    if (name === 'Norm 1') {
      const vector = result.residual1[row]; const mean = math.vectorMean(vector); const variance = math.vectorVariance(vector, mean);
      return el('p', { className: 'formula', text: `LayerNorm(${tokens[row]}): 均值=${format(mean)}，方差=${format(variance)}，γ=1，β=0 → ${format(result.norm1[row][column])}` });
    }
    return el('p', { className: 'formula', text: `${name}[${row + 1}, ${column + 1}] = ${format((result.output || [[0]])[row]?.[column])}` });
  };

  const render = () => {
    const parsed = tokenize(state.text);
    const tokens = (parsed.length ? parsed : ['<UNK>']).map((token) => (data.vocab[token] ? token : '<UNK>'));
    const embedding = tokens.map((token) => data.vocab[token]);
    const result = math.runTransformerBlock({ embedding, parameters: data.parameters, positional: state.positional, causal: state.causal, heads: state.heads });
    state.head = Math.min(state.head, state.heads - 1);
    const head = result.attentionHeads[state.head];
    const headRows = tokens.map((token) => `${token}`);
    const inspector = {
      'Embedding': result.embedding, 'Position': result.position, 'Input': result.input, 'Q': result.q, 'K': result.k, 'V': result.v,
      'Scores': head.rawScores, 'Masked scores': head.maskedScores, 'Attention weights': head.weights, 'Head output': head.output,
      'Concat': result.concat, 'Projection': result.projected, 'Residual 1': result.residual1, 'Norm 1': result.norm1,
      'FFN hidden': result.ffnHidden, 'FFN output': result.ffnOutput, 'Residual 2': result.residual2, 'Block output': result.output
    };
    shell.className = 'experiment-shell experiment-shell--tool transformer-lab'; shell.replaceChildren();

    const input = el('textarea', { rows: '2', value: state.text, 'aria-label': 'Transformer 输入文本' });
    input.addEventListener('input', () => { state.text = input.value; });
    const positionToggle = el('input', { type: 'checkbox', 'aria-label': '启用位置编码' }); positionToggle.checked = state.positional;
    positionToggle.addEventListener('change', () => { state.positional = positionToggle.checked; render(); });
    const maskSelect = el('select', { 'aria-label': 'Attention 遮罩' }, [el('option', { value: 'none', text: '双向 / 无遮罩' }), el('option', { value: 'causal', text: '因果遮罩' })]);
    maskSelect.value = state.causal ? 'causal' : 'none'; maskSelect.addEventListener('change', () => { state.causal = maskSelect.value === 'causal'; render(); });
    const headCount = el('select', { 'aria-label': 'Attention 头数量' }, [el('option', { value: 1, text: '1 个头 · dₖ=4' }), el('option', { value: 2, text: '2 个头 · dₖ=2' })]);
    headCount.value = String(state.heads); headCount.addEventListener('change', () => { state.heads = Number(headCount.value); state.head = 0; render(); });
    const controls = el('section', { className: 'transformer-controls' }, [
      el('p', { className: 'tool-label', text: '教学数值仿真' }),
      el('p', { className: 'input-help', text: '本模块使用低维向量与确定性参数。结构遵循 Transformer 前向传播，但并非预训练 GPT 或 BERT 模型。' }), input,
      el('div', { className: 'example-list' }, Object.entries(data.examples).map(([, value]) => button(value, 'tool-button tool-button--quiet', () => { stopAuto(); state.text = value; state.step = 0; render(); }))),
      button('运行前向传播', 'tool-button tool-button--primary', render),
      el('div', { className: 'transformer-options' }, [el('label', { className: 'select-label', text: '位置编码' }, positionToggle), el('label', { className: 'select-label', text: 'Attention 模式' }, maskSelect), el('label', { className: 'select-label', text: '头数量' }, headCount)]),
      el('p', { className: 'input-help', text: parsed.length > 6 ? '为保持矩阵可读性，只使用前 6 个词元。' : '未知词、中文和 emoji 会稳定映射为 <UNK>。' })
    ]);
    const diagram = el('section', { className: 'transformer-architecture', 'aria-label': 'Transformer 模块结构' }, [
      ...['词元','词向量 + 位置','多头注意力','残差与归一化','前馈网络','残差与归一化','输出'].map((label, index) => el('span', { className: state.step === [0, 1, 4, 8, 9, 9, 10][index] ? 'is-active' : '', text: label }))
    ]);
    const stepNav = el('div', { className: 'transformer-steps', 'aria-label': 'Transformer 步骤导航' }, steps.map((label, index) => button(`${String(index + 1).padStart(2, '0')} ${label}`, `transformer-step${state.step === index ? ' is-active' : ''}`, () => { state.step = index; render(); }, state.step === index ? { 'aria-current': 'step' } : {})));
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const navigation = el('div', { className: 'tool-navigation' }, [
      button('← 上一步', 'tool-button tool-button--quiet', () => { state.step = Math.max(0, state.step - 1); render(); }),
      el('span', { className: 'step-indicator', text: `步骤 ${state.step + 1} / ${steps.length} · ${steps[state.step]}` }),
      button('下一步 →', 'tool-button tool-button--quiet', () => { state.step = Math.min(steps.length - 1, state.step + 1); render(); }),
      button('自动播放', 'tool-button tool-button--primary', () => { if (reduced) return; stopAuto(); state.timer = window.setInterval(() => { state.step = (state.step + 1) % steps.length; render(); }, 900); }),
      button('重置', 'tool-button tool-button--quiet', () => { stopAuto(); state.step = 0; state.head = 0; state.positional = true; state.causal = false; state.heads = 2; render(); })
    ]);
    const overview = el('section', { className: 'transformer-overview' }, [diagram, stepNav, navigation]);

    const headSelect = el('select', { 'aria-label': '选中的 Attention 头' }, Array.from({ length: state.heads }, (_, index) => el('option', { value: index, text: `第 ${index + 1} 个头` })));
    headSelect.value = String(state.head); headSelect.addEventListener('change', () => { state.head = Number(headSelect.value); render(); });
    let visual;
    if (state.step === 0) visual = [matrixPanel('TOKENS', tokens.map((_, index) => [index]), tokens, '将文本转为小写、移除标点并按空白切分后得到的词元索引。')];
    else if (state.step === 1) visual = [matrixPanel('Embedding', result.embedding, tokens, '确定性的教学词向量。', { heatmap: true })];
    else if (state.step === 2) visual = [matrixPanel('Position', result.position, tokens, '正弦位置编码：PE(pos,2i)=sin，PE(pos,2i+1)=cos。', { heatmap: true }), matrixPanel('Input', result.input, tokens, '词向量 + 位置编码（关闭位置编码时仅使用词向量）。', { heatmap: true })];
    else if (state.step === 3) visual = [matrixPanel('Q', result.q, tokens, 'Q = XWQ.'), matrixPanel('K', result.k, tokens, 'K = XWK.'), matrixPanel('V', result.v, tokens, 'V = XWV.')];
    else if (state.step === 4) visual = [el('div', { className: 'head-selector' }, [el('label', { className: 'select-label', text: '选择 Attention 头' }, headSelect)]), matrixPanel(`Q Head ${state.head + 1}`, result.qHeads[state.head], tokens, `从 Q 拆分得到；形状为 ${shapeText(result.qHeads[state.head])}。`), matrixPanel(`K Head ${state.head + 1}`, result.kHeads[state.head], tokens, '对应的 Key 通道。'), matrixPanel(`V Head ${state.head + 1}`, result.vHeads[state.head], tokens, '对应的 Value 通道。')];
    else if (state.step === 5) visual = [el('div', { className: 'head-selector' }, [el('label', { className: 'select-label', text: '选择 Attention 头' }, headSelect)]), matrixPanel('Scores', head.rawScores, tokens, `QKᵀ / √dₖ。形状为 ${shapeText(result.qHeads[state.head])} × ${shapeText(math.transpose(result.kHeads[state.head]))}。`, { columnLabels: tokens }), matrixPanel('Masked scores', head.maskedScores, tokens, '遮罩会在按行计算 Softmax 之前加入。', { mask: true, columnLabels: tokens })];
    else if (state.step === 6) visual = [el('div', { className: 'head-selector' }, [el('label', { className: 'select-label', text: '选择 Attention 头' }, headSelect)]), matrixPanel(`Attention Head ${state.head + 1}`, head.weights, tokens, '按行计算的 Softmax 权重；每一可见行的和为 1。', { mask: state.causal, maskPattern: head.mask, heatmap: true, columnLabels: tokens }), matrixPanel('Head output', head.output, tokens, 'Attention 权重 × V。', { heatmap: true })];
    else if (state.step === 7) visual = [matrixPanel('Concat', result.concat, tokens, '将各头输出拼接回 d_model=4。'), matrixPanel('Projection', result.projected, tokens, 'Concat × WO。', { heatmap: true })];
    else if (state.step === 8) visual = [matrixPanel('Residual 1', result.residual1, tokens, '输入 + 投影后的多头注意力。'), matrixPanel('Norm 1', result.norm1, tokens, '对每个词元特征向量进行 LayerNorm，γ=1、β=0。', { heatmap: true })];
    else if (state.step === 9) visual = [matrixPanel('FFN hidden', result.ffnHidden, tokens, 'Norm1 × W1 + b1，随后经过 ReLU。'), matrixPanel('FFN output', result.ffnOutput, tokens, 'ReLU 隐藏层 × W2 + b2。'), matrixPanel('Residual 2', result.residual2, tokens, 'Norm1 + FFN 输出。')];
    else visual = [matrixPanel('Block output', result.output, tokens, '第二次 LayerNorm 的输出：每个词元的上下文化表示。', { heatmap: true }), matrixPanel('Input', result.input, tokens, '更新前：词向量 + 位置编码。'), matrixPanel('Norm 2 / output', result.output, tokens, '更新后：Transformer 模块输出。', { heatmap: true })];
    const formula = el('aside', { className: 'transformer-formula' }, [
      el('p', { className: 'tool-label', text: '公式 / 单元格查看器' }),
      el('p', { className: 'formula', text: state.step < 3 ? 'X = Embedding + Positional Encoding' : state.step < 7 ? 'Attention(Q,K,V) = softmax(QKᵀ / √dₖ + mask)V' : state.step < 9 ? 'Norm1 = LayerNorm(X + MultiHead(X))' : state.step === 9 ? 'FFN(x) = ReLU(xW1 + b1)W2 + b2' : 'Output = LayerNorm(Norm1 + FFN(Norm1))' }),
      currentDetail(result, tokens),
      el('p', { className: 'input-help', text: state.causal ? '因果模式会在 Softmax 前遮住未来的 Key；被遮罩的单元格会明确标记。' : '双向模式允许每一组 Query / Key 相互可见。' })
    ]);
    const selected = el('select', { 'aria-label': '矩阵查看器' }, Object.keys(inspector).map((name) => el('option', { value: name, text: matrixLabel(name) })));
    selected.value = state.inspect; selected.addEventListener('change', () => { state.inspect = selected.value; render(); });
    const inspectorPanel = el('section', { className: 'transformer-inspector' }, [el('p', { className: 'tool-label', text: '矩阵查看器' }), el('label', { className: 'select-label', text: '矩阵' }, selected), matrixPanel(state.inspect, inspector[state.inspect], tokens, `可查看的${matrixLabel(state.inspect)}矩阵。`), el('details', {}, [el('summary', { text: '查看参数 WQ / WK / WV / WO' }), el('pre', { text: ['WQ', 'WK', 'WV', 'WO'].map((name) => `${name}\n${data.parameters[`w${name.slice(1).toLowerCase()}`].map((row) => `[${row.map(format).join(', ')}]`).join('\n')}`).join('\n\n') })])]);
    const trace = el('section', { className: 'transformer-trace' }, [el('p', { className: 'tool-label', text: '计算追踪 / 形状流' }), el('p', { text: `词元 ${tokens.length} → 词向量 ${shapeText(result.embedding)} → Q/K/V ${shapeText(result.q)} → ${state.heads} × (${tokens.length} × ${4 / state.heads}) 个头 → 分数 ${tokens.length} × ${tokens.length} → 拼接 ${shapeText(result.concat)} → FFN ${shapeText(result.ffnHidden)} → 输出 ${shapeText(result.output)}。` }), el('p', { className: 'input-help', text: 'Attention 在词元之间混合信息；随后 FFN 对每个词元独立施加相同的非线性变换。' }), el('p', { className: 'input-help', text: '想复习 Q/K/V、Softmax 与遮罩，可返回 06 Attention；训练优化请参见 07 Loss 实验室。' })]);
    shell.append(controls, overview, el('section', { className: 'transformer-current' }, [el('div', { className: 'transformer-visual' }, visual), formula]), inspectorPanel, trace);
  };
  render();
})();
