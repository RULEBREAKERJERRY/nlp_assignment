(() => {
  const shell = document.querySelector('[data-experiment="loss"]');
  const math = window.NLPToolboxLoss;
  if (!shell || !math) return;

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
  const svg = (tag, props = {}, children = []) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(props).forEach(([key, value]) => node.setAttribute(key, value));
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.append(child));
    return node;
  };
  const button = (text, className, onClick) => el('button', { type: 'button', className, text, onClick });
  const format = (value, digits = 3) => Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
  const metric = (label, value) => el('div', {}, [el('span', { text: label }), el('strong', { className:label === '公式' ? 'formula-inline' : '', text: value })]);
  const statusLabel = (status) => ({ READY: '就绪', CONVERGING: '收敛中', SLOW: '下降缓慢', OSCILLATING: '震荡', DIVERGING: '发散', 'NUMERICAL INSTABILITY': '数值不稳定' }[status] || status);
  const pointPath = (points, width, height, maxY, minX = 0, maxX = points.length - 1) => {
    const padding = { left: 44, right: 18, top: 16, bottom: 30 };
    const sx = (x) => padding.left + ((x - minX) / Math.max(maxX - minX, 1)) * (width - padding.left - padding.right);
    const sy = (y) => height - padding.bottom - (Math.min(Math.max(y, 0), maxY) / Math.max(maxY, 1e-9)) * (height - padding.top - padding.bottom);
    return { d: points.map((point, index) => `${index ? 'L' : 'M'}${sx(point.x)},${sy(point.y)}`).join(' '), sx, sy, padding };
  };
  const lineChart = ({ points, title, yLabel, current = points.at(-1), color = '#6e8ef7', maxY }) => {
    const width = 640, height = 220;
    const domainY = maxY || Math.max(1, ...points.map((point) => point.y));
    const path = pointPath(points, width, height, domainY, points[0].x, points.at(-1).x);
    const chart = svg('svg', { class: 'loss-chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${title}，横轴为迭代次数，纵轴为 ${yLabel}` }, [
      svg('line', { x1: path.padding.left, y1: 16, x2: path.padding.left, y2: height - path.padding.bottom, class: 'chart-axis' }),
      svg('line', { x1: path.padding.left, y1: height - path.padding.bottom, x2: width - path.padding.right, y2: height - path.padding.bottom, class: 'chart-axis' }),
      svg('text', { x: path.padding.left, y: 12, class: 'chart-label' }, [document.createTextNode(`${yLabel} 0–${format(domainY, 2)}`)]),
      svg('text', { x: width - 68, y: height - 7, class: 'chart-label' }, [document.createTextNode('迭代次数')]),
      svg('path', { d: path.d, class: 'chart-line', stroke: color })
    ]);
    if (current) chart.append(svg('circle', { cx: path.sx(current.x), cy: path.sy(current.y), r: 4, class: 'chart-point', fill: color }));
    return el('div', { className: 'chart-wrap' }, chart);
  };
  const crossEntropyChart = (probability) => {
    const points = Array.from({ length: 100 }, (_, index) => {
      const p = (index + 1) / 100;
      return { x: p, y: -Math.log(math.clampProbability(p)) };
    });
    const mse = points.map((point) => ({ x: point.x, y: (1 - point.x) ** 2 }));
    const width = 640, height = 220, maxY = points[0].y;
    const cePath = pointPath(points, width, height, maxY, .01, 1);
    const msePath = pointPath(mse, width, height, maxY, .01, 1);
    const current = { x: probability, y: -Math.log(math.clampProbability(probability)) };
    const chart = svg('svg', { class: 'loss-chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '交叉熵与均方误差的概率损失曲线' }, [
      svg('line', { x1: cePath.padding.left, y1: 16, x2: cePath.padding.left, y2: height - cePath.padding.bottom, class: 'chart-axis' }),
      svg('line', { x1: cePath.padding.left, y1: height - cePath.padding.bottom, x2: width - cePath.padding.right, y2: height - cePath.padding.bottom, class: 'chart-axis' }),
      svg('path', { d: cePath.d, class: 'chart-line', stroke: '#6e8ef7' }),
      svg('path', { d: msePath.d, class: 'chart-line chart-line--secondary', stroke: '#8d96a3' }),
      svg('circle', { cx: cePath.sx(current.x), cy: cePath.sy(current.y), r: 4, class: 'chart-point', fill: '#6e8ef7' }),
      svg('text', { x: 48, y: 12, class: 'chart-label' }, [document.createTextNode('损失')]),
      svg('text', { x: width - 150, y: height - 7, class: 'chart-label' }, [document.createTextNode('正确类别概率')])
    ]);
    return el('div', { className: 'chart-wrap' }, [chart, el('p', { className: 'chart-key', text: '蓝色：交叉熵 · 灰色：均方误差（使用相同纵轴）' })]);
  };
  const landscape = (history) => {
    const width = 640, height = 220, range = 3, maxY = 9;
    const points = Array.from({ length: 121 }, (_, index) => { const x = -range + index * (range * 2 / 120); return { x, y: x * x }; });
    const path = pointPath(points, width, height, maxY, -range, range);
    const trajectory = history.map((point) => ({ x: Math.max(-range, Math.min(range, point.weight)), y: Math.min(maxY, point.loss) }));
    const trajectoryPath = pointPath(trajectory, width, height, maxY, -range, range);
    return el('div', { className: 'chart-wrap' }, [svg('svg', { class: 'loss-chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '二次损失地形与参数路径' }, [
      svg('line', { x1: path.padding.left, y1: 16, x2: path.padding.left, y2: height - path.padding.bottom, class: 'chart-axis' }),
      svg('line', { x1: path.padding.left, y1: height - path.padding.bottom, x2: width - path.padding.right, y2: height - path.padding.bottom, class: 'chart-axis' }),
      svg('path', { d: path.d, class: 'chart-line chart-line--secondary', stroke: '#8d96a3' }),
      svg('path', { d: trajectoryPath.d, class: 'chart-line', stroke: '#6e8ef7' }),
      ...trajectory.map((point) => svg('circle', { cx: trajectoryPath.sx(point.x), cy: trajectoryPath.sy(point.y), r: 3, class: 'chart-point', fill: '#6e8ef7' })),
      svg('text', { x: width - 105, y: height - 7, class: 'chart-label' }, [document.createTextNode('参数 w')])
    ]), el('p', { className: 'chart-key', text: '灰色：L(w) = w² · 蓝色：实际更新路径' })]);
  };
  const compareChart = () => {
    const runs = [{ label: '缓慢 0.05', lr: .05, color: '#9ba4b1' }, { label: '稳定 0.35', lr: .35, color: '#6e8ef7' }, { label: '震荡 1.0', lr: 1, color: '#a675bc' }, { label: '发散 1.2', lr: 1.2, color: '#b85a5f' }];
    const histories = runs.map((run) => ({ ...run, history: math.runQuadraticOptimization(run.lr, 12) }));
    const points = histories.flatMap((run) => run.history.map((point) => ({ x: point.iteration, y: Math.min(point.loss, 24) })));
    const width = 640, height = 220, maxY = Math.max(1, ...points.map((point) => point.y));
    const base = pointPath(points, width, height, maxY, 0, 12);
    const chart = svg('svg', { class: 'loss-chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '不同学习率对应不同的二次损失轨迹' }, [
      svg('line', { x1: base.padding.left, y1: 16, x2: base.padding.left, y2: height - base.padding.bottom, class: 'chart-axis' }),
      svg('line', { x1: base.padding.left, y1: height - base.padding.bottom, x2: width - base.padding.right, y2: height - base.padding.bottom, class: 'chart-axis' }),
      ...histories.map((run) => svg('path', { d: pointPath(run.history.map((point) => ({ x: point.iteration, y: Math.min(point.loss, 24) })), width, height, maxY, 0, 12).d, class: 'chart-line', stroke: run.color }))
    ]);
    return el('div', { className: 'chart-wrap' }, [chart, el('p', { className: 'chart-key', text: runs.map((run) => run.label).join('  ·  ') }), el('p', { className: 'input-help', text: '比较结果来自同一 L(w)=w² 更新规则的独立运行；图中纵轴上限设为 24，仅用于让发散现象保持可读。' })]);
  };

  const state = { probability: .7, lr: .1, initialWeight: 0, initialBias: 0, weight: 0, bias: 0, iteration: 0, batch: 50, history: [], lastStep: null, timer: null, instability: false, quadLR: .35, quadWeight: 2, quadHistory: [] };
  const initialiseLogistic = () => {
    const forward = math.forwardLogisticRegression(state.initialWeight, state.initialBias);
    state.weight = state.initialWeight; state.bias = state.initialBias; state.iteration = 0; state.lastStep = null; state.instability = false;
    state.history = [{ x: 0, y: forward.loss, iteration: 0, loss: forward.loss, weight: state.weight }];
  };
  const initialiseQuadratic = () => { state.quadWeight = 2; state.quadHistory = [{ iteration: 0, weight: 2, loss: 4 }]; };
  const stopTraining = () => { if (state.timer) window.clearInterval(state.timer); state.timer = null; };
  const logisticStep = () => {
    const step = math.gradientDescentStep(state.weight, state.bias, state.lr);
    if (![step.nextWeight, step.nextBias, step.next.loss].every(Number.isFinite)) { state.instability = true; stopTraining(); return false; }
    state.lastStep = step; state.weight = step.nextWeight; state.bias = step.nextBias; state.iteration += 1;
    state.history.push({ x: state.iteration, y: step.next.loss, iteration: state.iteration, loss: step.next.loss, weight: state.weight });
    return true;
  };
  const quadraticStep = () => {
    const step = math.quadraticStep(state.quadWeight, state.quadLR);
    if (!Number.isFinite(step.nextWeight) || !Number.isFinite(step.nextLoss)) return false;
    state.quadWeight = step.nextWeight;
    state.quadHistory.push({ iteration: state.quadHistory.length, weight: step.nextWeight, loss: step.nextLoss });
    return true;
  };

  const render = () => {
    const probability = state.probability;
    const loss = -Math.log(math.clampProbability(probability));
    const predictions = [probability, (1 - probability) / 2, (1 - probability) / 2];
    const labels = ['正向', '中性', '负向'];
    const targets = [1, 0, 0];
    const forward = math.forwardLogisticRegression(state.weight, state.bias);
    const status = statusLabel(state.instability ? 'NUMERICAL INSTABILITY' : math.analyzeTrainingState(state.history.map((point) => ({ loss: point.loss, weight: point.weight }))));
    const quadStatus = statusLabel(math.analyzeTrainingState(state.quadHistory, 'quadratic'));
    shell.className = 'experiment-shell experiment-shell--tool loss-lab';
    shell.replaceChildren();

    const probabilitySlider = el('input', { type: 'range', min: '.01', max: '.99', step: '.01', value: probability, 'aria-label': '正确类别的预测概率' });
    probabilitySlider.addEventListener('input', () => { state.probability = Number(probabilitySlider.value); render(); });
    const explorer = el('section', { className: 'loss-section' }, [
      el('p', { className: 'tool-label', text: '实验 A · 交叉熵观察器' }),
      el('h3', { text: '正确类别概率越低，交叉熵越大' }),
      el('label', { className: 'range-label', text: `正确类别概率 P(correct)：${format(probability, 2)}` }, probabilitySlider),
      el('div', { className: 'example-list' }, [
        button('高置信正确 · 0.90', 'tool-button tool-button--quiet', () => { state.probability = .9; render(); }),
        button('不确定 · 0.50', 'tool-button tool-button--quiet', () => { state.probability = .5; render(); }),
        button('高置信错误 · 0.03', 'tool-button tool-button--quiet', () => { state.probability = .03; render(); })
      ]),
      el('div', { className: 'loss-metrics' }, [metric('当前损失', format(loss)), metric('公式', `−log(${format(probability, 2)})`)]),
      crossEntropyChart(probability),
      el('div', { className: 'sim-scroll' }, el('table', { className: 'sim-matrix loss-table' }, [
        el('thead', {}, el('tr', {}, ['类别', 'y', 'p', '−y log(p)'].map((text) => el('th', { text })))),
        el('tbody', {}, labels.map((label, index) => el('tr', {}, [el('th', { text: label }), el('td', { text: targets[index] }), el('td', { text: format(predictions[index]) }), el('td', { text: format(-targets[index] * Math.log(math.clampProbability(predictions[index]))) })])))
      ])),
      el('p', { className: 'formula', text: 'L = −Σ (yᵢ × log(pᵢ)) = −log(p_correct)' }),
      el('p', { className: 'input-help', text: '对于 one-hot 目标，多分类交叉熵可化为正确类别概率的负对数。概率会用 ε=1e−12 裁剪，因此不会出现 log(0)。' })
    ]);

    const lrInput = el('input', { type: 'number', min: '.0001', max: '10', step: '.001', value: state.lr, 'aria-label': '逻辑回归学习率' });
    lrInput.addEventListener('change', () => { state.lr = Math.max(.0001, Number(lrInput.value) || .1); render(); });
    const wInput = el('input', { type: 'number', step: '.1', value: state.initialWeight, 'aria-label': '初始权重' });
    wInput.addEventListener('change', () => { state.initialWeight = Number(wInput.value) || 0; });
    const bInput = el('input', { type: 'number', step: '.1', value: state.initialBias, 'aria-label': '初始偏置' });
    bInput.addEventListener('change', () => { state.initialBias = Number(bInput.value) || 0; });
    const iterations = el('select', { 'aria-label': '训练迭代次数' }, [10, 50, 100, 200].map((value) => el('option', { value, text: `${value} 次迭代` })));
    iterations.value = String(state.batch); iterations.addEventListener('change', () => { state.batch = Number(iterations.value); });
    const controls = el('div', { className: 'loss-controls' }, [
      el('label', { className: 'select-label', text: '学习率' }, lrInput),
      el('label', { className: 'select-label', text: '初始 w' }, wInput),
      el('label', { className: 'select-label', text: '初始 b' }, bInput),
      el('label', { className: 'select-label', text: '自动训练次数' }, iterations),
      button('单步更新', 'tool-button tool-button--primary', () => { stopTraining(); logisticStep(); render(); }),
      button('开始训练', 'tool-button tool-button--primary', () => { if (state.timer) return; let remaining = state.batch; state.timer = window.setInterval(() => { if (!logisticStep() || --remaining <= 0) stopTraining(); render(); }, 100); render(); }),
      button('暂停', 'tool-button tool-button--quiet', () => { stopTraining(); render(); }),
      button('重置', 'tool-button tool-button--quiet', () => { stopTraining(); initialiseLogistic(); render(); })
    ]);
    const current = state.lastStep;
    const optimizer = el('section', { className: 'loss-section' }, [
      el('p', { className: 'tool-label', text: '实验 B · 梯度下降模拟器' }),
      el('h3', { text: '逻辑回归 + 二元交叉熵' }), controls,
      el('div', { className: 'loss-metrics' }, [metric('迭代次数', state.iteration), metric('平均损失', format(forward.loss)), metric('训练状态', status), metric('w / b', `${format(state.weight)} / ${format(state.bias)}`)]),
      lineChart({ points: state.history, title: '训练损失', yLabel: '平均 BCE 损失' }),
      el('div', { className: 'sim-scroll' }, el('table', { className: 'sim-matrix loss-table' }, [
        el('thead', {}, el('tr', {}, ['x', 'y', 'z = wx+b', 'sigmoid(z)', 'BCE'].map((text) => el('th', { text })))),
        el('tbody', {}, forward.rows.map((row) => el('tr', {}, [el('td', { text: row.x }), el('td', { text: row.y }), el('td', { text: format(row.z) }), el('td', { text: format(row.probability) }), el('td', { text: format(row.loss) })])))
      ])),
      el('div', { className: 'step-summary' }, [
        el('p', { className: 'tool-label', text: '当前更新' }),
        current ? el('p', { className: 'formula', text:`dw = ${format(current.dw)}；db = ${format(current.db)}；w = ${format(current.oldWeight)} − ${format(state.lr)} × ${format(current.dw)} = ${format(current.nextWeight)}；b = ${format(current.oldBias)} − ${format(state.lr)} × ${format(current.db)} = ${format(current.nextBias)}` }) : el('p', { className:'input-help', text:'点击“单步更新”可计算解析梯度，并执行一次参数更新。' }),
        el('p', { className: 'input-help', text: '数据集使用 4 个抽象的一维“证据”值，而非真实文本词向量。梯度为批量均值：dw = mean((p−y)x)，db = mean(p−y)。' })
      ])
    ]);

    const quadInput = el('input', { type: 'number', min: '.001', max: '3', step: '.01', value: state.quadLR, 'aria-label': '二次函数学习率' });
    quadInput.addEventListener('change', () => { state.quadLR = Math.max(.001, Number(quadInput.value) || .35); render(); });
    const learning = el('section', { className: 'loss-section' }, [
      el('p', { className: 'tool-label', text: '实验 C · 学习率实验室' }),
      el('h3', { text: '优化教学示例：L(w) = w²' }),
      el('div', { className: 'loss-controls' }, [
        el('label', { className: 'select-label', text: '学习率 η' }, quadInput),
        ...[{ text: '缓慢 0.05', value: .05 }, { text: '稳定 0.35', value: .35 }, { text: '震荡 1.0', value: 1 }, { text: '发散 1.2', value: 1.2 }].map((preset) => button(preset.text, 'tool-button tool-button--quiet', () => { state.quadLR = preset.value; initialiseQuadratic(); render(); })),
        button('单步更新', 'tool-button tool-button--primary', () => { quadraticStep(); render(); }),
        button('运行 16 步', 'tool-button tool-button--primary', () => { for (let index = 0; index < 16 && quadraticStep(); index += 1) {} render(); }),
        button('重置', 'tool-button tool-button--quiet', () => { initialiseQuadratic(); render(); })
      ]),
      el('div', { className: 'loss-metrics' }, [metric('w', format(state.quadWeight)), metric('损失', format(math.quadraticLoss(state.quadWeight))), metric('训练状态', quadStatus)]),
      landscape(state.quadHistory),
      el('p', { className: 'formula', text: `L(w) = w²；∂L / ∂w = 2w；w_next = w − η × 2w；η = ${format(state.quadLR, 2)}` }),
      el('h4', { text: '比较不同学习率' }), compareChart(),
      el('p', { className: 'input-help', text: '训练状态是基于真实轨迹的规则型教学提示，并非严格的收敛证明。二次函数示例只用于隔离步长行为，不是 NLP 模型。' })
    ]);
    const concepts = el('section', { className: 'loss-concepts' }, [
      el('p', { className: 'tool-label', text: '阅读提示' }),
      el('p', { text: 'Loss 用连续标量衡量预测误差。梯度给出 Loss 局部增长最快的方向，因此梯度下降沿相反方向更新。准确率（Accuracy）是离散评价指标，而非本实验用于更新参数的可微优化信号。' }),
      el('p', { text: '训练 Loss 更低，也不保证模型在未见数据上有更好的泛化能力。' })
    ]);
    shell.append(explorer, optimizer, learning, concepts);
  };
  initialiseLogistic(); initialiseQuadratic(); render();
})();
