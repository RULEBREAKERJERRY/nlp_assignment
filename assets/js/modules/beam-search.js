(() => {
  const shell = document.querySelector('[data-experiment="beam-search"]');
  const data = window.NLPToolboxData?.beamSearch;
  const math = window.NLPToolboxBeamSearch;
  if (!shell || !data || !math) return;

  const stages = [
    ['当前候选束','当前保留的候选束来自上一步的全局剪枝。'],
    ['下一词元分布','每条候选束根据各自的上下文获得下一词元的完整概率分布。'],
    ['展开','每条候选束只需保留其前 B 个词元候选：同一父节点的第 B+1 名不可能进入全局前 B。'],
    ['打分','新路径使用原始分数 = 父路径原始分数 + log(词元概率)。'],
    ['长度惩罚','EOS 不计入生成长度。','ranking_score = raw_log_score / (((5 + length) / 6)^α)'],
    ['排序','来自所有父候选束的路径放在同一个列表中，按排序分数进行全局排序。'],
    ['剪枝','仅保留全局前 B 条候选；其余节点留在搜索树中并标记为“已剪枝”。'],
    ['下一步','保留下来的非 EOS 候选成为下一轮的活跃候选束。'],
    ['结束','EOS 候选变为已完成假设；达到最大生成词元数的活跃候选束变为截断假设。']
  ];
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'value') node.value = value;
      else if (key === 'checked') node.checked = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).flat(Infinity).filter(Boolean).forEach((child) => node.append(child));
    return node;
  };
  const svgEl = (tag, props = {}) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(props).forEach(([key,value]) => node.setAttribute(key,String(value))); return node; };
  const button = (text, className, onClick, extra = {}) => el('button', { type:'button', className, text, onClick, ...extra });
  const format = (value, digits = 3) => Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
  const visibleToken = (token) => token === '<EOS>' ? '<EOS>' : token;
  const sequence = (tokens) => tokens.filter((token) => token !== '<EOS>').join(' ') || '—';
  const dependencies = { vocabulary:data.vocabulary, generateLogits:data.generateLogits };
  const defaultConfig = { mode:'standard', beamWidth:3, alpha:0, maxNewTokens:5 };
  const state = { prompt:'The future of AI', config:{ ...defaultConfig }, search:null, snapshots:[], timer:null, notice:'已就绪 · 展开一步解码即可查看分布、分数与全局剪枝。', stage:0, selectedNodeId:'root', treeFilter:'all' };
  const stopAuto = () => { if (state.timer) window.clearInterval(state.timer); state.timer = null; };
  const resetSearch = () => {
    stopAuto();
    if (!state.prompt.trim()) { state.search = null; state.snapshots = []; state.notice = '请输入提示词后再开始解码。'; return; }
    state.search = math.createInitialState(state.prompt, state.config);
    state.snapshots = [];
    state.selectedNodeId = 'root';
    state.notice = '已就绪 · 初始候选束分数为 log(1) = 0。';
  };
  const stepSearch = () => {
    if (!state.search || state.search.completed) { if (state.search?.completed) state.notice = '解码已完成 · 请查看 N-best 假设，或重置参数。'; return; }
    state.snapshots.push(math.clone(state.search));
    state.search = math.beamSearchStep(state.search, dependencies);
    state.selectedNodeId = state.search.lastCandidates[0]?.id || state.selectedNodeId;
    state.notice = state.search.completed ? '解码已完成 · EOS 或最大生成词元数停止了搜索。' : `第 ${state.search.step} 步完成 · 候选已全局排序，并剪枝至宽度 ${state.config.beamWidth}。`;
  };
  const previousSearch = () => { stopAuto(); if (!state.snapshots.length) { state.notice = '当前已是初始候选束状态。'; return; } state.search = state.snapshots.pop(); state.selectedNodeId = state.search.activeBeams[0]?.nodeId || 'root'; state.notice = `已恢复第 ${state.search.step} 步 · 快照已恢复，无需重新计算。`; };
  const applyConfig = (patch, notice) => { state.config = { ...state.config, ...patch }; resetSearch(); state.notice = notice; };
  const runComplete = (config) => math.runBeamSearch(state.prompt, config, dependencies);
  const hypothesisRows = (search) => math.finalHypotheses(search).slice(0, Math.max(1, search.config.beamWidth));
  const nodeById = (id) => state.search?.treeNodes.find((node) => node.id === id);

  const makeTree = (search, bestPathIds) => {
    const visibleNodes = search.treeNodes.filter((node) => state.treeFilter === 'all' || node.step === Number(state.treeFilter) || node.id === 'root');
    const grouped = new Map();
    visibleNodes.forEach((node) => { const list = grouped.get(node.step) || []; list.push(node); grouped.set(node.step, list); });
    const maxStep = Math.max(...grouped.keys());
    const maxRows = Math.max(...[...grouped.values()].map((list) => list.length));
    const width = Math.max(760, (maxStep + 1) * 188 + 40);
    const height = Math.max(230, maxRows * 56 + 90);
    const positions = new Map();
    [...grouped.entries()].forEach(([step, list]) => {
      list.sort((left,right) => left.normalizedScore - right.normalizedScore || left.id.localeCompare(right.id)).forEach((node,index) => positions.set(node.id, { x:28 + step * 188, y:48 + index * 56 }));
    });
    const canvas = el('div', { className:'beam-tree-canvas', style:`width:${width}px;height:${height}px` });
    const svg = svgEl('svg', { class:'beam-tree-lines', width, height, viewBox:`0 0 ${width} ${height}`, 'aria-hidden':'true' });
    visibleNodes.filter((node) => node.parentId && positions.has(node.parentId)).forEach((node) => { const parent = positions.get(node.parentId); const child = positions.get(node.id); const active = bestPathIds.has(node.id) && bestPathIds.has(node.parentId); svg.append(svgEl('line', { x1:parent.x + 142, y1:parent.y + 18, x2:child.x, y2:child.y + 18, class:active ? 'is-best' : node.status === 'pruned' ? 'is-pruned' : '' })); });
    canvas.append(svg);
    [...grouped.entries()].forEach(([step]) => canvas.append(el('span', { className:'beam-tree-step-label', text:`步骤 ${step}`, style:`left:${28 + step * 188}px` })));
    visibleNodes.forEach((node) => {
      const point = positions.get(node.id); const selected = node.id === state.selectedNodeId; const classes = ['beam-tree-node', `is-${node.status}`, bestPathIds.has(node.id) ? 'is-best-path' : '', selected ? 'is-selected' : ''].filter(Boolean).join(' ');
      const label = node.id === 'root' ? '提示词根节点' : `${visibleToken(node.token)} · ${format(node.normalizedScore)}`;
      const statusLabel = node.status === 'active' ? '活跃' : node.status === 'finished' ? '已完成' : node.status === 'truncated' ? '已截断' : node.status === 'pruned' ? '已剪枝' : '根节点';
      canvas.append(button(label, classes, () => { state.selectedNodeId = node.id; render(); }, { style:`left:${point.x}px;top:${point.y}px`, 'aria-label':node.id === 'root' ? `提示词根节点：${node.sequence}` : `候选路径 ${node.sequence}，分数 ${format(node.normalizedScore)}，状态 ${statusLabel}` }));
    });
    return el('div', { className:'beam-tree-scroll', 'aria-label':'束搜索树' }, canvas);
  };

  const render = () => {
    const search = state.search;
    shell.className = 'experiment-shell experiment-shell--tool beam-lab'; shell.replaceChildren();
    const prompt = el('textarea', { rows:'2', value:state.prompt, 'aria-label':'束搜索提示词' }); prompt.addEventListener('input', () => { state.prompt = prompt.value; state.notice = '提示词已修改 · 请开始新的搜索，避免混用搜索历史。'; });
    const widthSelect = el('select', { 'aria-label':'候选束宽度' }, [1,2,3,4,5].map((value) => el('option', { value, text:`候选束宽度 = ${value}` }))); widthSelect.value = String(state.config.beamWidth); widthSelect.addEventListener('change', () => { applyConfig({ beamWidth:Number(widthSelect.value) }, '候选束宽度已修改 · 先前剪枝使用了其他宽度，搜索已重置。'); render(); });
    const alpha = el('select', { 'aria-label':'长度惩罚 alpha' }, [0,.5,1,1.5,2].map((value) => el('option', { value, text:`α = ${value}` }))); alpha.value = String(state.config.alpha); alpha.addEventListener('change', () => { applyConfig({ alpha:Number(alpha.value) }, '长度惩罚已修改 · 为保持排序历史一致，搜索已重置。'); render(); });
    const maxTokens = el('select', { 'aria-label':'最大生成词元数' }, [3,5,8,10].map((value) => el('option', { value, text:`最多 = ${value}` }))); maxTokens.value = String(state.config.maxNewTokens); maxTokens.addEventListener('change', () => { applyConfig({ maxNewTokens:Number(maxTokens.value) }, '最大生成词元数已修改 · 搜索已重置。'); render(); });
    const controls = el('section', { className:'beam-panel beam-controls' }, [
      el('p', { className:'tool-label', text:'A · 解码控制 · 教学数值仿真' }),
      el('p', { className:'input-help', text:'本实验使用与 09 LLM Sampling 相同的有限词表和确定性教学 Logits 生成器。束搜索算法真实执行，但词元分布并非来自预训练 LLM。' }),
      el('label', { className:'beam-field', text:'提示词' }, prompt),
      el('div', { className:'example-list' }, Object.keys(data.presets).map((name) => button(name === 'SIMPLE GENERATION' ? '基础生成' : name === 'GREEDY TRAP' ? '贪心陷阱' : name === 'LENGTH BIAS' ? '长度偏好' : name === 'EARLY EOS' ? '提前结束' : name, 'tool-button tool-button--quiet', () => { const preset = data.presets[name]; state.prompt = preset.prompt; state.config = { mode:preset.mode, beamWidth:preset.beamWidth, alpha:preset.alpha, maxNewTokens:preset.maxNewTokens }; resetSearch(); state.notice = '预设已加载 · 确定性分布已准备好，可开始搜索。'; render(); }))),
      button('使用提示词开始', 'tool-button tool-button--primary', () => { resetSearch(); render(); }),
      el('div', { className:'beam-options' }, [el('label', { className:'select-label', text:'候选束宽度' }, widthSelect), el('label', { className:'select-label', text:'长度惩罚' }, alpha), el('label', { className:'select-label', text:'最大生成词元数' }, maxTokens)]),
      el('div', { className:'beam-actions' }, [button('展开下一步', 'tool-button tool-button--primary', () => { stepSearch(); render(); }, { disabled:!search || search.completed ? 'disabled' : null }), button('← 上一步', 'tool-button tool-button--quiet', () => { previousSearch(); render(); }, { disabled:!state.snapshots.length ? 'disabled' : null }), button('自动解码', 'tool-button tool-button--quiet', () => { if (state.timer || !state.search || state.search.completed) return; state.timer = window.setInterval(() => { stepSearch(); if (state.search?.completed) stopAuto(); render(); }, 700); render(); }, { disabled:!search || search.completed ? 'disabled' : null }), button('暂停', 'tool-button tool-button--quiet', () => { stopAuto(); render(); }), button('重置', 'tool-button tool-button--quiet', () => { resetSearch(); render(); })]),
      el('p', { className:search?.completed ? 'beam-status is-complete' : 'beam-status', text:state.notice })
    ]);
    if (!search) { shell.append(controls, el('p', { className:'beam-empty', text:'请输入提示词，然后开始一轮新的束搜索。' })); return; }

    const stats = [['步骤',search.step],['活跃',search.activeBeams.length],['已完成',search.finishedHypotheses.filter((item) => item.status === 'finished').length],['已展开',search.expandedNodes],['已剪枝',search.prunedNodes]].map(([label,value]) => el('span', { text:`${label} ${value}` }));
    const beamRows = search.activeBeams.map((beam, index) => el('tr', {}, [el('td', { text:index + 1 }), el('td', { text:sequence(beam.tokens) }), el('td', { text:visibleToken(beam.tokens.at(-1) || '提示词') }), el('td', { text:format(beam.rawScore) }), el('td', { text:String(beam.length) }), el('td', { text:format(math.lengthPenalty(beam.length, state.config.alpha)) }), el('td', { text:format(beam.normalizedScore) }), el('td', { text:'活跃' })]));
    const current = el('section', { className:'beam-panel' }, [el('p', { className:'tool-label', text:'B · 当前候选束' }), el('div', { className:'beam-stats' }, stats), el('p', { className:'input-help', text:'长度只统计新生成的词元；<EOS> 不计入长度。候选束宽度为 1 时，保留路径等同于贪心搜索。' }), el('div', { className:'beam-formula-stack' }, [el('p', { className:'formula', text:`LP(length) = ((5 + length) / 6)^${state.config.alpha}` }), el('p', { className:'formula', text:'ranking_score = raw_log_score / LP(length)' })]), el('div', { className:'beam-table-wrap' }, el('table', { className:'beam-table' }, [el('thead', {}, el('tr', {}, ['排名','生成序列','最后词元','原始对数分数','长度','LP','排序分数','状态'].map((text) => el('th', { text })))), el('tbody', {}, beamRows.length ? beamRows : el('tr', {}, el('td', { colspan:8, text:'没有活跃候选束：保留路径均已完成或被截断。' })))]))]);

    const activeStage = stages[state.stage];
    const stageContent = activeStage[2]
      ? [el('p', { className:'formula beam-stage-formula', text:activeStage[2] }), el('p', { text:activeStage[1] })]
      : el('p', { text:activeStage[1] });
    const stepNavigator = el('section', { className:'beam-step-area' }, [el('div', { className:'beam-step-nav', 'aria-label':'束搜索解码步骤' }, stages.map(([name], index) => button(`${String(index + 1).padStart(2,'0')} ${name}`, `beam-step${index === state.stage ? ' is-active' : ''}`, () => { state.stage = index; render(); }, index === state.stage ? { 'aria-current':'step' } : {}))), el('div', { className:'beam-explanation' }, [el('p', { className:'tool-label', text:`当前发生什么？· ${activeStage[0]}` }), stageContent])]);

    const distributionBlocks = search.distributions.length ? search.distributions.map((entry) => el('article', { className:'beam-distribution' }, [el('h3', { text:entry.sequence }), el('p', { className:'input-help', text:'该父候选束的高概率词元。完整词表会先参与打分，再选择每个父节点前 B 个扩展。' }), el('div', { className:'beam-token-list' }, entry.all.map((item) => { const bar = el('span', { className:'beam-probability-bar', 'aria-label':`${item.token}，概率 ${format(item.probability)}，对数概率 ${format(item.logProbability)}` }, [el('span', { className:'beam-probability-fill', 'aria-hidden':'true' }), el('span', { className:'beam-probability-label', text:`${visibleToken(item.token)} · p ${format(item.probability)} · log p ${format(item.logProbability)}` })]); bar.style.setProperty('--probability', `${item.probability * 100}%`); return bar; }))])) : el('p', { className:'beam-empty', text:'展开一步解码，即可查看每个父候选束的下一词元分布。' });
    const distributions = el('section', { className:'beam-panel' }, [el('p', { className:'tool-label', text:'C · 下一词元分布' }), distributionBlocks]);

    const candidateRows = search.lastCandidates.map((candidate, index) => { const kept = ['active','finished','truncated'].includes(candidate.status); const pruneLine = index === state.config.beamWidth; return [pruneLine ? el('tr', { className:'beam-prune-line' }, el('td', { colspan:9, text:`剪枝线 · 仅保留全局前 ${state.config.beamWidth} 条候选` })) : null, el('tr', { className:`beam-candidate-row is-${candidate.status}${candidate.id === state.selectedNodeId ? ' is-selected' : ''}` }, [el('td', { text:index + 1 }), el('td', {}, button(sequence(candidate.tokens), 'beam-link-button', () => { state.selectedNodeId = candidate.id; render(); }, { 'aria-label':`查看候选路径 ${candidate.sequence}` })), el('td', { text:visibleToken(candidate.token) }), el('td', { text:format(candidate.tokenProbability) }), el('td', { text:format(candidate.tokenLogProbability) }), el('td', { text:format(candidate.rawScore) }), el('td', { text:format(candidate.lengthPenalty) }), el('td', { text:format(candidate.normalizedScore) }), el('td', { text:kept ? candidate.status === 'active' ? '活跃' : candidate.status === 'finished' ? '已完成' : '已截断' : '已剪枝' })])]; }).flat();
    const selectedNode = nodeById(state.selectedNodeId) || search.lastCandidates[0] || search.treeNodes[0];
    const parent = selectedNode?.parentId ? nodeById(selectedNode.parentId) : null;
    const inspector = selectedNode && selectedNode.id !== 'root'
      ? el('article', { className:'beam-score-inspector' }, [
        el('p', { className:'tool-label', text:'分数查看器' }),
        el('p', { className:'beam-parent-sequence', text:`父序列：${parent?.sequence || '提示词根节点'}` }),
        el('p', { className:'formula', text:`${format(parent?.rawScore || 0)} + log(${format(selectedNode.tokenProbability)}) = ${format(selectedNode.rawScore)}` }),
        el('p', { className:'formula', text:`${format(selectedNode.rawScore)} ÷ ${format(selectedNode.lengthPenalty)} = ${format(selectedNode.normalizedScore)}` }),
        el('p', { className:'input-help', text:`词元：${visibleToken(selectedNode.token)} · 生成长度 ${selectedNode.length} · 状态 ${selectedNode.status === 'active' ? '活跃' : selectedNode.status === 'finished' ? '已完成' : selectedNode.status === 'truncated' ? '已截断' : '已剪枝'}` })
      ])
      : el('article', { className:'beam-score-inspector' }, [
        el('p', { className:'tool-label', text:'分数查看器' }),
        el('p', { className:'input-help', text:'请在表格或搜索树中选择已展开候选，查看其对数概率计算过程。' })
      ]);
    const ranking = el('section', { className:'beam-grid beam-grid--ranking' }, [el('article', { className:'beam-panel' }, [el('p', { className:'tool-label', text:'D · 全局排序与剪枝' }), el('p', { className:'input-help', text:'所有父候选的扩展路径会先合并，再统一排序。这是全局剪枝，不是每个父节点各保留一个子节点。' }), el('div', { className:'beam-table-wrap' }, el('table', { className:'beam-table' }, [el('thead', {}, el('tr', {}, ['全局排名','序列','新词元','词元概率','对数概率','原始分数','LP','排序分数','状态'].map((text) => el('th', { text })))), el('tbody', {}, candidateRows.length ? candidateRows : el('tr', {}, el('td', { colspan:9, text:'尚未执行扩展。' })))]))]), inspector]);

    const finals = hypothesisRows(search); const best = finals[0]; const bestPathIds = new Set(best ? math.backtrack(search.treeNodes, best.nodeId).map((node) => node.id) : []);
    const treeFilter = el('select', { 'aria-label':'搜索树步骤筛选' }, [el('option', { value:'all', text:'全部步骤' }), ...Array.from({ length:search.step + 1 }, (_, step) => el('option', { value:step, text:`步骤 ${step}` }))]); treeFilter.value = state.treeFilter; treeFilter.addEventListener('change', () => { state.treeFilter = treeFilter.value; render(); });
    const tree = el('section', { className:'beam-panel beam-tree-panel' }, [el('div', { className:'beam-tree-head' }, [el('p', { className:'tool-label', text:'E · 搜索树' }), el('label', { className:'select-label', text:'树筛选' }, treeFilter)]), el('p', { className:'input-help', text:'每个已展开节点都会保留：强调色代表活跃，灰色代表已剪枝，描边代表已完成或已截断；最终最佳路径会被突出显示。' }), makeTree(search, bestPathIds)]);

    const finalList = finals.map((hypothesis, index) => { const status = hypothesis.status === 'finished' ? '已完成' : hypothesis.status === 'truncated' ? '已截断' : '活跃'; return el('li', { className:index === 0 ? 'is-best' : '' }, [el('strong', { text:`${index + 1}. ${sequence(hypothesis.tokens)}` }), el('span', { text:`原始分数 ${format(hypothesis.rawScore)} · 长度 ${hypothesis.length} · 排名分数 ${format(hypothesis.normalizedScore)} · ${status}` })]); });
    const finalPanel = el('section', { className:'beam-grid beam-grid--final' }, [
      el('article', { className:'beam-panel' }, [
        el('p', { className:'tool-label', text:'F · 已完成假设 / N-best' }),
        finalList.length ? el('ol', { className:'beam-final-list' }, finalList) : el('p', { className:'beam-empty', text:'暂无已完成假设。请继续解码或达到最大生成词元数。' })
      ]),
      el('article', { className:'beam-panel beam-best-result' }, [
        el('p', { className:'tool-label', text:'最终结果' }),
        best ? [
          el('h3', { text:sequence(best.tokens) }),
          el('div', { className:'beam-final-scores' }, [
            el('p', { className:'formula', text:`raw_score = ${format(best.rawScore)}` }),
            el('p', { className:'formula', text:`LP = ${format(math.lengthPenalty(best.length, state.config.alpha))}` }),
            el('p', { className:'formula', text:`ranking_score = ${format(best.normalizedScore)}` })
          ]),
          el('p', { className:'input-help', text:`候选束宽度 ${state.config.beamWidth}。高亮的搜索树路径可从该假设回溯至提示词根节点。` })
        ] : el('p', { className:'beam-empty', text:'产生 EOS 或达到最大生成词元数后会显示最终结果。' })
      ])
    ]);

    const greedy = runComplete({ ...state.config, beamWidth:1 }); const beam = runComplete({ ...state.config }); const greedyBest = hypothesisRows(greedy)[0]; const beamBest = hypothesisRows(beam)[0];
    const widthExperiment = [1,2,3,5].map((width) => { const result = runComplete({ ...state.config, beamWidth:width }); const resultBest = hypothesisRows(result)[0]; return el('li', {}, [el('strong', { text:`B=${width} · ${resultBest ? sequence(resultBest.tokens) : '—'}` }), el('span', { text:`分数 ${resultBest ? format(resultBest.normalizedScore) : '—'} · 已展开 ${result.expandedNodes} · 已剪枝 ${result.prunedNodes}` })]); });
    const comparison = el('section', { className:'beam-grid beam-grid--compare' }, [
      el('article', { className:'beam-panel' }, [
        el('p', { className:'tool-label', text:'G · 与贪心搜索对比' }),
        el('div', { className:'beam-decoder-compare' }, [
          el('div', {}, [el('h3', { text:'贪心搜索 / B = 1' }), greedyBest && sequence(greedyBest.tokens).startsWith('will help understand') ? el('p', {}, [el('span', { className:'beam-sequence-nowrap', text:'will help understand' }), document.createTextNode(sequence(greedyBest.tokens).slice('will help understand'.length))]) : el('p', { text:greedyBest ? sequence(greedyBest.tokens) : '—' }), el('span', { text:`分数 ${greedyBest ? format(greedyBest.normalizedScore) : '—'}` })]),
          el('div', {}, [el('h3', { text:`束搜索 / B = ${state.config.beamWidth}` }), el('p', { text:beamBest ? sequence(beamBest.tokens) : '—' }), el('span', { text:`分数 ${beamBest ? format(beamBest.normalizedScore) : '—'}` })])
        ]),
        el('p', { className:'input-help', text:'贪心搜索每一步只选择局部最优的延续；束搜索会保留多条高分假设，但仍是有限宽度近似，并非穷举搜索。' })
      ]),
      el('article', { className:'beam-panel' }, [
        el('p', { className:'tool-label', text:'候选束宽度实验' }),
        el('ul', { className:'beam-width-list' }, widthExperiment),
        el('p', { className:'input-help', text:'展开与剪枝计数只针对当前小型教学搜索树，不代表真实模型的 FLOPs。' })
      ])
    ]);
    const notes = el('section', { className:'beam-notes' }, [el('p', { className:'tool-label', text:'解码位置与限制' }), el('div', { className:'beam-flow' }, ['Logits','束搜索','序列','输出'].map((label) => el('span', { className:label === '束搜索' ? 'is-active' : '', text:label }))), el('p', { text:'束搜索是确定性的有限宽度搜索；采样则是概率化的词元选择。搜索分数不等同于文本质量、事实性或人类偏好。' }), el('p', { className:'input-help', text:'本实验有意未实现不重复 n-gram、覆盖惩罚和多样化束搜索等高级解码策略。' })]);
    shell.append(controls, current, stepNavigator, distributions, ranking, tree, finalPanel, comparison, notes);
  };
  resetSearch(); render();
})();
