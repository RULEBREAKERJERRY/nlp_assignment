(() => {
  const shell = document.querySelector('[data-experiment="llm-sampling"]');
  const data = window.NLPToolboxData?.sampling;
  const math = window.NLPToolboxSampling;
  if (!shell || !data || !math) return;

  const pipeline = ['原始 Logits','重复惩罚','温度','Softmax','Top-k','Top-p','重新归一化','随机抽取','选择词元'];
  const presets = { Deterministic:{ method:'greedy', temperature:.7, topK:1, topP:1, penalty:1, label:'确定性' }, Focused:{ method:'sampling', temperature:.5, topK:5, topP:.8, penalty:1.1, label:'聚焦' }, Balanced:{ method:'sampling', temperature:.8, topK:10, topP:.9, penalty:1.1, label:'平衡' }, Exploratory:{ method:'sampling', temperature:1.3, topK:0, topP:.95, penalty:1, label:'探索' } };
  const el = (tag, props = {}, children = []) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (value === null || value === undefined) return; if (key === 'className') node.className = value; else if (key === 'text') node.textContent = value; else if (key === 'value') node.value = value; else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value); else node.setAttribute(key, value); }); (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.append(child)); return node; };
  const button = (text, className, onClick, extra = {}) => el('button', { type:'button', className, text, onClick, ...extra });
  const format = (value, digits = 3) => value === null || value === undefined ? '—' : Number.isFinite(value) ? Number(value).toFixed(digits) : '—';
  const tokenize = (text) => text.toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(-12);
  const showToken = (token) => token === '<EOS>' ? '<EOS>' : token;
  const state = { prompt:'The future of AI', config:{ method:'sampling', temperature:.8, topK:10, topP:.9, penalty:1.1, seed:42, maxTokens:10 }, context:[], generated:[], history:[], current:null, rng:null, step:0, showAll:false, timer:null, finished:false, compareA:'Focused', compareB:'Exploratory' };
  const stopAuto = () => { if (state.timer) window.clearInterval(state.timer); state.timer = null; };
  const promptTokens = () => tokenize(state.prompt);
  const prepareCurrent = (randomValue = null) => { const draw = randomValue ?? state.rng(); state.current = math.sampleNextToken({ context:state.context, vocabulary:data.vocabulary, transitions:data.transitions, config:state.config, randomValue:draw }); };
  const resetGeneration = () => { stopAuto(); state.context = promptTokens(); state.generated = []; state.history = []; state.rng = math.mulberry32(Number(state.config.seed) || 0); state.finished = false; state.step = 0; prepareCurrent(); };
  const patchConfig = (patch) => { state.config = { ...state.config, ...patch }; if (state.current) prepareCurrent(state.current.randomValue); };
  const generateNext = () => {
    if (state.finished || !state.current) return;
    const snapshot = state.current; state.history.push(snapshot);
    if (snapshot.selectedToken === '<EOS>') { state.finished = true; stopAuto(); return; }
    state.generated.push(snapshot.selectedToken); state.context.push(snapshot.selectedToken);
    if (state.generated.length >= state.config.maxTokens) { state.finished = true; stopAuto(); return; }
    prepareCurrent(); state.step = 0;
  };
  const metric = (label, value) => el('div', {}, [el('span', { text:label }), el('strong', { text:value })]);
  const strategyResult = (name) => { const config = { ...state.config, ...presets[name] }; const result = math.runGeneration({ promptTokens:promptTokens(), vocabulary:data.vocabulary, transitions:data.transitions, config }); return { name, config, ...result, stats:math.generationStats(result.generated, result.snapshots) }; };

  const render = () => {
    const current = state.current;
    const rows = data.vocabulary.map((token, index) => ({ token, index, raw:current.rawLogits[index], penalty:current.penalizedLogits[index], temperature:current.temperatureLogits[index], original:current.originalProbabilities[index], probability:current.probabilities[index], topK:current.topKKept[index], topP:current.topPKept[index], final:current.finalProbabilities[index], cumulative:current.cumulative[index], repeated:current.context.map((item) => item.toLowerCase()).includes(token.toLowerCase()), selected:index === current.selectedIndex })).sort((a, b) => b.raw - a.raw);
    const visibleRows = state.showAll ? rows : rows.slice(0, 10);
    shell.className = 'experiment-shell experiment-shell--tool sampling-lab'; shell.replaceChildren();

    const prompt = el('textarea', { rows:'2', value:state.prompt, 'aria-label':'生成提示词' }); prompt.addEventListener('input', () => { state.prompt = prompt.value; });
    const method = el('select', { 'aria-label':'采样方法' }, [el('option', { value:'sampling', text:'分类采样' }), el('option', { value:'greedy', text:'贪心解码' })]); method.value = state.config.method; method.addEventListener('change', () => { patchConfig({ method:method.value }); render(); });
    const temperature = el('input', { type:'number', min:'.05', max:'2', step:'.05', value:state.config.temperature, 'aria-label':'温度' }); temperature.addEventListener('change', () => { patchConfig({ temperature:Math.min(2, Math.max(.05, Number(temperature.value) || .8)) }); render(); });
    const topK = el('select', { 'aria-label':'Top-k' }, [el('option', { value:0, text:'关闭' }), ...[1,3,5,10,20,50].map((value) => el('option', { value, text:String(value) }))]); topK.value = String(state.config.topK); topK.addEventListener('change', () => { patchConfig({ topK:Number(topK.value) }); render(); });
    const topP = el('input', { type:'number', min:'.1', max:'1', step:'.05', value:state.config.topP, 'aria-label':'Top-p 核采样阈值' }); topP.addEventListener('change', () => { patchConfig({ topP:Math.min(1, Math.max(.1, Number(topP.value) || 1)) }); render(); });
    const penalty = el('input', { type:'number', min:'1', max:'2', step:'.05', value:state.config.penalty, 'aria-label':'重复惩罚' }); penalty.addEventListener('change', () => { patchConfig({ penalty:Math.min(2, Math.max(1, Number(penalty.value) || 1)) }); render(); });
    const seed = el('input', { type:'number', step:'1', value:state.config.seed, 'aria-label':'随机种子' }); seed.addEventListener('change', () => { state.config.seed = Math.trunc(Number(seed.value) || 0); resetGeneration(); render(); });
    const maxTokens = el('select', { 'aria-label':'最多生成词元数' }, [5,10,20].map((value) => el('option', { value, text:String(value) }))); maxTokens.value = String(state.config.maxTokens); maxTokens.addEventListener('change', () => { state.config.maxTokens = Number(maxTokens.value); if (state.generated.length >= state.config.maxTokens) state.finished = true; render(); });
    const controls = el('section', { className:'sampling-controls' }, [
      el('p', { className:'tool-label', text:'A · 生成控制 · 教学数值仿真' }),
      el('p', { className:'input-help', text:'本实验用有限的词级词表模拟从 Logits 到词元的采样。局部 Logits 为确定性教学参数，并非真实预训练 LLM 的输出。' }), prompt,
      el('div', { className:'example-list' }, ['The future of AI','Natural language processing','In the next decade','Once upon a time','Machine learning can'].map((text) => button(text, 'tool-button tool-button--quiet', () => { state.prompt = text; resetGeneration(); render(); }))),
      button('使用提示词运行', 'tool-button tool-button--primary', () => { resetGeneration(); render(); }),
      el('div', { className:'sampling-options' }, [el('label', { className:'select-label', text:'方法' }, method), el('label', { className:'select-label', text:'温度' }, temperature), el('label', { className:'select-label', text:'Top-k' }, topK), el('label', { className:'select-label', text:'Top-p' }, topP), el('label', { className:'select-label', text:'重复惩罚' }, penalty), el('label', { className:'select-label', text:'随机种子' }, seed), el('label', { className:'select-label', text:'最多生成词元' }, maxTokens)]),
      el('div', { className:'example-list' }, Object.entries(presets).map(([name, preset]) => button(preset.label, 'tool-button tool-button--quiet', () => { state.config = { ...state.config, ...preset }; resetGeneration(); render() })))
    ]);
    const flow = el('section', { className:'sampling-flow', 'aria-label':'采样流程' }, pipeline.map((label, index) => el('span', { className:state.step === index ? 'is-active' : '', text:(label === 'Top-k' && !state.config.topK) || (label === 'Top-p' && state.config.topP === 1) ? `${label} · 已跳过` : label })));
    const nav = el('div', { className:'tool-navigation' }, [button('← 上一步', 'tool-button tool-button--quiet', () => { state.step = Math.max(0, state.step - 1); render(); }), el('span', { className:'step-indicator', text:`步骤 ${state.step + 1} / ${pipeline.length} · ${pipeline[state.step]}` }), button('下一步 →', 'tool-button tool-button--quiet', () => { state.step = Math.min(pipeline.length - 1, state.step + 1); render(); })]);
    const distribution = el('section', { className:'sampling-distribution' }, [
      el('p', { className:'tool-label', text:'B · 词元分布实验室' }),
      flow, nav,
      el('div', { className:'sampling-metrics' }, [metric('原始熵', format(math.entropy(current.originalProbabilities))), metric('最终熵', format(current.entropy)), metric('最终概率和', format(current.finalProbabilities.reduce((sum, value) => sum + value, 0))), metric('核集合大小', String(current.topPKept.filter(Boolean).length))]),
      el('p', { className:'input-help', text:'流程顺序：确定性 Logits → 重复惩罚 → 温度 → Softmax → Top-k → Top-p → 重新归一化 → 选择词元。Logit 是未归一化分数，并非百分比。' }),
      el('div', { className:'sampling-table-wrap' }, el('table', { className:'sampling-table' }, [el('thead', {}, el('tr', {}, ['词元','原始 Logit','惩罚后','÷ T','Softmax 概率','Top-k','Top-p / 累计值','最终概率'].map((text) => el('th', { text })))), el('tbody', {}, visibleRows.map((row) => {
        const filtered = !row.topK || !row.topP; const tr = el('tr', { className:`${filtered ? 'is-filtered ' : ''}${row.selected ? 'is-selected' : ''}`.trim() });
        tr.append(el('th', { text:row.selected ? `${showToken(row.token)} · 已选中` : showToken(row.token) }), el('td', { text:format(row.raw) }), el('td', { text:row.repeated ? format(row.penalty) : '—' }), el('td', { text:format(row.temperature) }), el('td', { text:format(row.probability) }), el('td', { text:row.topK ? '保留' : '过滤' }), el('td', { text:row.topP ? `${row.cumulative === null ? '保留' : format(row.cumulative)}` : '过滤' }));
        const bar = el('span', { className:'probability-bar', 'aria-label':`词元 ${row.token}，最终概率 ${(row.final * 100).toFixed(1)}%` }); bar.style.setProperty('--probability', `${row.final * 100}%`); tr.append(el('td', {}, [bar, document.createTextNode(` ${format(row.final)}`)])); return tr;
      })) ])),
      button(state.showAll ? '仅显示前 10 个' : '显示全部词元', 'tool-button tool-button--quiet', () => { state.showAll = !state.showAll; render(); })
    ]);
    const drawRows = current.finalProbabilities.map((probability, index) => ({ token:data.vocabulary[index], probability, start:current.finalProbabilities.slice(0,index).reduce((sum,value)=>sum+value,0), end:current.finalProbabilities.slice(0,index+1).reduce((sum,value)=>sum+value,0) })).filter((row) => row.probability > 0);
    const currentStage = pipeline[state.step];
    const explanation = el('aside', { className:'sampling-explanation' }, [el('p', { className:'tool-label', text:`当前阶段 · ${currentStage}` }), el('p', { className:'formula', text:state.step === 2 ? `z′ = z / T = z / ${format(state.config.temperature,2)}` : state.step === 3 ? 'pᵢ = exp(zᵢ − max(z)) / (Σ exp(zⱼ − max(z)))' : state.step === 6 ? 'p′ᵢ = pᵢ / (Σ 保留的 pⱼ)' : state.step === 7 ? `r = ${current.randomValue === null ? '贪心模式不使用随机数' : format(current.randomValue)}` : state.step === 8 ? `选中的词元 = ${showToken(current.selectedToken)}；p = ${format(current.selectedProbability)}` : '请查看分布表中对应的列。' }), current.randomValue !== null ? el('p', { className:'input-help', text:`随机区间：${drawRows.map((row) => `${showToken(row.token)} [${format(row.start)}, ${format(row.end)})`).join(' · ')}` }) : el('p', { className:'input-help', text:'贪心解码直接选择最终概率最大的词元，不进行随机抽取。' }), el('p', { className:'input-help', text:'对于重复词元：正 Logit 除以惩罚值；负 Logit 乘以惩罚值。不同推理框架的具体实现可能略有差异。' })]);
    const lab = el('section', { className:'sampling-current' }, [distribution, explanation]);
    const historyRows = state.history.map((snapshot, index) => el('tr', {}, [el('td', { text:index + 1 }), el('td', { text:showToken(snapshot.selectedToken) }), el('td', { text:format(snapshot.selectedProbability) }), el('td', { text:snapshot.randomValue === null ? '贪心' : format(snapshot.randomValue) }), el('td', { text:format(snapshot.config.temperature, 2) }), el('td', { text:snapshot.config.topK || '关闭' }), el('td', { text:format(snapshot.config.topP, 2) })]));
    const output = el('section', { className:'sampling-output' }, [el('p', { className:'tool-label', text:'C · 自回归生成器' }), el('p', { className:'generated-sequence', text:[...promptTokens(), ...state.generated].join(' ') || '—' }), el('p', { className:'input-help', text:state.finished ? '生成已停止：达到最多生成词元数，或选中了 <EOS>。' : `下一词元预览：${showToken(current.selectedToken)} · p=${format(current.selectedProbability)}` }), el('div', { className:'generation-actions' }, [button('生成下一个词元', 'tool-button tool-button--primary', () => { generateNext(); render(); }, { disabled:state.finished ? 'disabled' : null }), button('自动生成', 'tool-button tool-button--primary', () => { if(state.timer || state.finished)return; state.timer=window.setInterval(()=>{generateNext(); if(state.finished)stopAuto(); render();},350); render(); }, { disabled:state.finished ? 'disabled' : null }), button('暂停', 'tool-button tool-button--quiet', () => { stopAuto(); render(); }), button('重置', 'tool-button tool-button--quiet', () => { resetGeneration(); render(); })]), el('div', { className:'sampling-table-wrap' }, el('table', { className:'sampling-table sampling-history' }, [el('thead', {}, el('tr', {}, ['步骤','词元','概率','随机抽取','T','Top-k','Top-p'].map((text)=>el('th',{text})))), el('tbody', {}, historyRows.length ? historyRows : el('tr', {}, el('td', { colspan:7, text:'尚未追加任何词元。' })))]))]);
    const aSelect = el('select', { 'aria-label':'策略 A' }, Object.keys(presets).map((name)=>el('option',{value:name,text:presets[name].label}))); aSelect.value=state.compareA; aSelect.addEventListener('change',()=>{state.compareA=aSelect.value;render();});
    const bSelect = el('select', { 'aria-label':'策略 B' }, Object.keys(presets).map((name)=>el('option',{value:name,text:presets[name].label}))); bSelect.value=state.compareB; bSelect.addEventListener('change',()=>{state.compareB=bSelect.value;render();});
    const a = strategyResult(state.compareA), b = strategyResult(state.compareB);
    const strategyCard = (result) => el('article', { className:'strategy-card' }, [el('p',{className:'tool-label',text:presets[result.name].label}),el('p',{text:`T=${format(result.config.temperature,2)} · top-k=${result.config.topK || '关闭'} · top-p=${format(result.config.topP,2)} · 惩罚=${format(result.config.penalty,2)}`}),el('p',{className:'strategy-output',text:[...promptTokens(),...result.generated].join(' ')}),el('p',{className:'input-help',text:`长度 ${result.stats.length} · 唯一词比例 ${format(result.stats.uniqueRatio)} · 重复数 ${result.stats.repeated} · 选中概率均值 ${format(result.stats.averageProbability)} · 熵均值 ${format(result.stats.averageEntropy)}`})]);
    const comparison = el('section', { className:'sampling-compare' }, [el('p',{className:'tool-label',text:'D · 对比采样策略'}),el('p',{className:'input-help',text:`两种策略使用相同提示词、随机种子 ${state.config.seed} 与最多生成词元限制。统计值只描述本教学采样器的分布特征，并不代表真实 LLM 的质量。`}),el('div',{className:'comparison-controls'},[el('label',{className:'select-label',text:'策略 A'},aSelect),el('label',{className:'select-label',text:'策略 B'},bSelect)]),el('div',{className:'strategy-grid'},[strategyCard(a),strategyCard(b)])]);
    shell.append(controls,lab,output,comparison);
  };
  resetGeneration(); render();
})();
