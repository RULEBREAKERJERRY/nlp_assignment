(() => {
  const shell = document.querySelector('[data-experiment="attention"]');
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
  const tokenize = (text) => text.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 8);
  const format = (value) => value === -Infinity ? '已遮罩' : Number(value).toFixed(3);
  const projectionText = (name, matrix) => `${name}\n${matrix.map((row) => `[ ${row.map(format).join('  ')} ]`).join('\n')}`;
  let autoTimer;
  const state = { text: data.attentionExamples.Love, query: 0, selectedKey: 0, scaled: true, causal: false };
  const stopAuto = () => { if (autoTimer) window.clearInterval(autoTimer); autoTimer = undefined; };

  const render = () => {
    const parsed = tokenize(state.text);
    const tokens = (parsed.length ? parsed : ['<UNK>']).map((token) => (data.vocab[token] ? token : '<UNK>'));
    const embedding = tokens.map((token) => data.vocab[token]);
    const queryIndex = Math.min(state.query, tokens.length - 1);
    const keyIndex = Math.min(state.selectedKey, tokens.length - 1);
    const forward = (index) => sim.attentionForward({
      matrix: embedding, wq: data.wq, wk: data.wk, wv: data.wv, queryIndex: index,
      scaled: state.scaled, causal: state.causal
    });
    const output = forward(queryIndex);
    const heatmap = tokens.map((_, index) => forward(index));
    shell.className = 'experiment-shell experiment-shell--tool';
    shell.replaceChildren();

    const input = el('textarea', { rows: '3', value: state.text, 'aria-label': 'Attention 输入序列' });
    input.addEventListener('input', () => { state.text = input.value; });
    const querySelect = el('select', { 'aria-label': 'Query 词元' });
    tokens.forEach((token, index) => querySelect.append(el('option', { value: index, text: `${index + 1}. ${token}` })));
    querySelect.value = String(queryIndex);
    querySelect.addEventListener('change', () => { state.query = Number(querySelect.value); state.selectedKey = state.query; render(); });
    const scaled = el('input', { type: 'checkbox', 'aria-label': '使用缩放点积 Attention' });
    scaled.checked = state.scaled;
    scaled.addEventListener('change', () => { state.scaled = scaled.checked; render(); });
    const mask = el('input', { type: 'checkbox', 'aria-label': '应用因果遮罩' });
    mask.checked = state.causal;
    mask.addEventListener('change', () => { state.causal = mask.checked; render(); });

    const controls = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: '教学数值仿真' }),
      el('h3', { text: '点积 Attention' }), input,
      el('div', { className: 'example-list' }, Object.entries(data.attentionExamples).map(([, example]) =>
        button(example, 'tool-button tool-button--quiet', () => { stopAuto(); state.text = example; state.query = 0; state.selectedKey = 0; render(); })
      )),
      button('运行 Attention', 'tool-button tool-button--primary', render),
      el('div', { className: 'inline-controls' }, [
        el('label', { className: 'select-label', text: 'Query 词元' }, querySelect),
        el('label', { className: 'select-label', text: '缩放点积' }, scaled),
        el('label', { className: 'select-label', text: '因果遮罩' }, mask)
      ]),
      el('div', { className: 'tool-navigation' }, [
        button('← 上一个 Query', 'tool-button tool-button--quiet', () => { state.query = Math.max(0, queryIndex - 1); state.selectedKey = state.query; render(); }),
        button('下一个 Query →', 'tool-button tool-button--quiet', () => { state.query = Math.min(tokens.length - 1, queryIndex + 1); state.selectedKey = state.query; render(); }),
        button('自动播放', 'tool-button tool-button--primary', () => { stopAuto(); autoTimer = window.setInterval(() => { state.query = (state.query + 1) % tokens.length; state.selectedKey = state.query; render(); }, 900); }),
        button('重置', 'tool-button tool-button--quiet', () => { stopAuto(); state.query = 0; state.selectedKey = 0; state.scaled = true; state.causal = false; render(); })
      ]),
      el('p', { className: 'input-help', text: '词向量与投影矩阵均为确定性的教学参数。未知词、中文和 emoji 会映射为 <UNK>。' })
    ]);

    const qkvRows = tokens.map((token, index) => el('tr', { className: index === queryIndex ? 'is-active' : '' }, [
      el('th', { text: token }),
      el('td', { text: `[${output.q[index].map(format).join(', ')}]` }),
      el('td', { text: `[${output.k[index].map(format).join(', ')}]` }),
      el('td', { text: `[${output.v[index].map(format).join(', ')}]` })
    ]));
    const qkv = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: '01–03 词向量 / Q K V' }),
      el('p', { text: `当前 Query：${tokens[queryIndex]}` }),
      el('p', { className: 'formula', text: 'Q = XWq · K = XWk · V = XWv' }),
      el('div', { className: 'sim-scroll' }, el('table', { className: 'sim-matrix' }, [
        el('thead', {}, el('tr', {}, [el('th', { text: '词元' }), el('th', { text: 'Q' }), el('th', { text: 'K' }), el('th', { text: 'V' })])),
        el('tbody', {}, qkvRows)
      ])),
      el('details', { className: 'projection-details' }, [
        el('summary', { text: '查看投影矩阵 Wq / Wk / Wv' }),
        el('pre', { text: `${projectionText('Wq', data.wq)}\n\n${projectionText('Wk', data.wk)}\n\n${projectionText('Wv', data.wv)}` })
      ])
    ]);

    const selectedScore = output.masked[keyIndex];
    const scoreBars = tokens.map((token, index) => button(
      `${token} · 原始分数 ${format(output.raw[index])} · 最终分数 ${format(output.masked[index])} · 权重 ${format(output.weights[index])}`,
      `attention-bar${output.masked[index] === -Infinity ? ' is-masked' : ''}`,
      () => { state.selectedKey = index; render(); }
    ));
    const scores = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: '04–06 分数 / 遮罩 / Softmax' }),
      el('p', { className: 'formula', text: `scoreᵢ = Q·Kᵢ${state.scaled ? ' / √dₖ' : ''}；遮罩在 Softmax 前应用` }),
      el('p', { text: `当前计算：Q_${tokens[queryIndex]} · K_${tokens[keyIndex]} = ${output.query.map((value, index) => `${format(value)}×${format(output.k[keyIndex][index])}`).join(' + ')} = 原始分数 ${format(output.raw[keyIndex])}；最终分数 ${format(selectedScore)}。` }),
      el('div', { className: 'attention-bars' }, scoreBars),
      el('p', { text: `权重之和 = ${format(output.weights.reduce((sum, value) => sum + value, 0))}` })
    ]);

    const heatRows = tokens.map((token, rowIndex) => el('tr', {}, [
      el('th', { text: token }),
      ...heatmap[rowIndex].weights.map((weight, columnIndex) => el('td', {
        className: heatmap[rowIndex].masked[columnIndex] === -Infinity ? 'is-masked' : '',
        style: `--weight:${weight}`,
        text: heatmap[rowIndex].masked[columnIndex] === -Infinity ? '遮罩' : format(weight),
        'aria-label': `从 ${token} 到 ${tokens[columnIndex]} 的 Attention：${format(weight)}`
      }))
    ]));
    const map = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: 'Attention 热力图' }),
      el('div', { className: 'sim-scroll' }, el('table', { className: 'heatmap' }, [
        el('thead', {}, el('tr', {}, [el('th', { text: 'Q / K' }), ...tokens.map((token) => el('th', { text: token }))])),
        el('tbody', {}, heatRows)
      ]))
    ]);

    const context = el('section', { className: 'sim-panel' }, [
      el('p', { className: 'tool-label', text: '07–08 加权 Value / 上下文向量' }),
      el('p', { className: 'formula', text: 'Context = Σ αᵢVᵢ' }),
      el('p', { text: `加权 Value：${output.weighted.map((row, index) => `${format(output.weights[index])}×V_${tokens[index]}=[${row.map(format).join(', ')}]`).join('；')}` }),
      el('p', { text: `上下文向量：[ ${output.context.map(format).join(', ')} ]` }),
      el('p', { className: 'input-help', text: 'Attention 权重描述的是这一次加权求和；它本身不能完整解释模型行为，更不等同于因果解释。' })
    ]);
    shell.append(controls, qkv, scores, map, context);
  };
  render();
})();
