(() => {
  const shell = document.querySelector('[data-experiment="text-cnn"]');
  const data = window.NLPToolboxData?.simulation;
  const sim = window.NLPToolboxSim;
  if (!shell || !data || !sim) return;

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
  const button = (text, className, onClick) => el('button', { type: 'button', className, text, onClick });
  const tokenize = (text) => text.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 10);
  const format = (value) => Number(value).toFixed(3);
  const matrix = (tokens, rows, active = []) => el('div', { className: 'sim-scroll' }, el('table', { className: 'sim-matrix' }, [
    el('thead', {}, el('tr', {}, [el('th', { text: '词元' }), ...['d1', 'd2', 'd3', 'd4'].map((label) => el('th', { text: label }))])),
    el('tbody', {}, rows.map((row, index) => el('tr', { className: active.includes(index) ? 'is-active' : '' }, [
      el('th', { text: tokens[index] || '—' }), ...row.map((value) => el('td', { text: format(value) }))
    ])))
  ]));

  const state = { text: data.cnnExamples.Positive, filter: 0, position: 0, filters: JSON.parse(JSON.stringify(data.cnnFilters)) };
  let autoTimer;
  const stopAuto = () => { if (autoTimer) window.clearInterval(autoTimer); autoTimer = undefined; };

  const render = () => {
    const parsed = tokenize(state.text);
    const tokens = (parsed.length ? parsed : ['<UNK>']).map((token) => (data.vocab[token] ? token : '<UNK>'));
    const embedding = tokens.map((token) => data.vocab[token]);
    const result = sim.cnnForward({ matrix: embedding, filters: state.filters, classifier: data.classifier });
    const filter = result.maps[state.filter];
    const position = Math.min(state.position, filter.raw.length - 1);
    const windowMatrix = embedding.slice(position, position + filter.kernel.length);
    const windowTokens = tokens.slice(position, position + filter.kernel.length);
    const isFullWindow = windowMatrix.length === filter.kernel.length;

    shell.className = 'experiment-shell experiment-shell--tool';
    shell.replaceChildren();
    const input = el('textarea', { rows: '3', value: state.text, 'aria-label': 'Text-CNN 输入文本' });
    input.addEventListener('input', () => { state.text = input.value; });
    const filterSelect = el('select', { 'aria-label': '当前卷积核' });
    state.filters.forEach((item, index) => filterSelect.append(el('option', { value: index, text: `${item.name} · 窗口 ${item.kernel.length}` })));
    filterSelect.value = String(state.filter);
    filterSelect.addEventListener('change', () => { state.filter = Number(filterSelect.value); state.position = 0; render(); });

    const inputPanel = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: '教学数值仿真' }),
      el('h3', { text: '文本 → Text-CNN 前向传播' }), input,
      el('div', { className: 'example-list' }, Object.entries(data.cnnExamples).map(([, example]) =>
        button(example, 'tool-button tool-button--quiet', () => { stopAuto(); state.text = example; state.position = 0; render(); })
      )),
      button('运行前向传播', 'tool-button tool-button--primary', render),
      el('p', { className: 'input-help', text: '本实验使用英文教学词表。未知词、中文和 emoji 会稳定映射为 <UNK>；为便于观察，最多显示前 10 个词元。' })
    ]);

    const embeddingPanel = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: '01 词元 / 02 词向量' }),
      el('p', { text: `词元：${tokens.map((token) => `[ ${token} ]`).join(' ')}` }),
      matrix(tokens, embedding, Array.from({ length: Math.min(filter.kernel.length, tokens.length) }, (_, index) => position + index))
    ]);

    const kernelEditor = el('div', { className: 'kernel-editor' });
    filter.kernel.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
      const field = el('input', { type: 'number', step: '.05', value: String(value), 'aria-label': `卷积核第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列的数值` });
      field.addEventListener('change', () => { state.filters[state.filter].kernel[rowIndex][columnIndex] = Number(field.value) || 0; render(); });
      kernelEditor.append(field);
    }));
    const bias = el('input', { type: 'number', step: '.05', value: String(filter.bias), 'aria-label': '卷积偏置' });
    bias.addEventListener('change', () => { state.filters[state.filter].bias = Number(bias.value) || 0; render(); });
    const convolutionPanel = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: '03 卷积 / 04 激活' }), filterSelect,
      el('p', { text: `窗口 ${position + 1}：[${windowTokens.join(', ')}]` }),
      matrix(windowTokens, windowMatrix),
      el('p', { className: 'formula', text: isFullWindow ? `z = Σ(X ⊙ W) + b = ${format(filter.raw[position] - filter.bias)} + ${format(filter.bias)} = ${format(filter.raw[position])}` : 'z = Σ(X ⊙ W) + b（需要完整窗口）' }),
      el('p', { className: 'formula', text: `a = ReLU(z) = ${format(filter.activations[position])}` }),
      !isFullWindow ? el('p', { className: 'input-help', text: `该卷积核需要 ${filter.kernel.length} 个词元。窗口不足时，教学仿真会显示 0 激活值。` }) : null,
      el('p', { className: 'tool-label', text: '编辑卷积核' }), kernelEditor,
      el('label', { className: 'metric-input', text: '偏置（Bias）' }, bias),
      el('div', { className: 'tool-navigation' }, [
        button('← 上一步', 'tool-button tool-button--quiet', () => { state.position = Math.max(0, position - 1); render(); }),
        button('下一步 →', 'tool-button tool-button--quiet', () => { state.position = Math.min(filter.raw.length - 1, position + 1); render(); }),
        button('自动播放', 'tool-button tool-button--primary', () => { stopAuto(); autoTimer = window.setInterval(() => { state.position = (state.position + 1) % filter.raw.length; render(); }, 900); }),
        button('重置', 'tool-button tool-button--quiet', () => { stopAuto(); state.position = 0; render(); })
      ])
    ]);

    const best = result.probabilities.indexOf(Math.max(...result.probabilities));
    const outputPanel = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: '05 特征图 / 06 池化' }),
      el('p', { text: `特征图：[ ${filter.activations.map(format).join(', ')} ]` }),
      el('p', { text: `最大池化：${format(filter.pool.value)}，位于窗口 ${filter.pool.index + 1} [${tokens.slice(filter.pool.index, filter.pool.index + filter.kernel.length).join(', ')}]` }),
      el('p', { className: 'tool-label', text: '07 分类' }),
      el('p', { className: 'formula', text: 'logits = W_c × pooled_features + b_c；p = softmax(logits)' }),
      el('p', { text: `特征向量：[ ${result.features.map(format).join(', ')} ]` }),
      el('p', { text: `Logits：[ ${result.logits.map(format).join(', ')} ]` }),
      el('div', { className: 'probability-list' }, result.probabilities.map((value, index) => el('p', { text: `${data.classifier.labels[index]} · ${(value * 100).toFixed(1)}%` }))),
      el('p', { className: 'input-help', text: `预测类别：${data.classifier.labels[best]}。卷积核与分类器权重均为固定教学参数，不代表真实情感模型训练得到的权重。` })
    ]);
    shell.append(inputPanel, embeddingPanel, convolutionPanel, outputPanel);
  };
  render();
})();
