(() => {
  const shell = document.querySelector('[data-experiment="preprocessing"]');
  const data = window.NLPToolboxData?.preprocessing;
  if (!shell || !data) return;

  const STORAGE_KEY = 'nlp-toolbox.preprocessing.state';
  const h = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'value') node.value = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.append(child)); return node;
  };
  const button = (text, className, action) => h('button', { type:'button', className, text, onClick:action });
  const read = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } };
  const clonePipeline = (pipeline) => pipeline.map((step) => ({ ...step }));
  const stepDefs = {
    normalize: { label:'空白规范化', note:'去除首尾空白并合并连续空格', accepts:['text'], output:'text' },
    lowercase: { label:'转为小写', note:'仅处理 ASCII / 英文字母', accepts:['text','tokens'], output:'same' },
    punctuation: { label:'移除标点', note:'处理英文与常见中文标点', accepts:['text','tokens'], output:'same' },
    tokenize: { label:'切分为词元（Tokenize）', note:'英文规则 + 简化中文教学模拟', accepts:['text'], output:'tokens' },
    stopwords: { label:'移除停用词', note:'本地英文 / 中文停用词表', accepts:['tokens'], output:'tokens' },
    lemmatize: { label:'词形归一（Lemmatize）', note:'基于规则的教学模拟', accepts:['tokens'], output:'tokens' },
    ngrams: { label:'构建 N-gram', note:'一元、二元、三元短语', accepts:['tokens'], output:'ngrams' }
  };
  const defaultInput = data.examples[0].text;
  const saved = read();
  let state = {
    input: typeof saved?.input === 'string' ? saved.input : defaultInput,
    pipeline: Array.isArray(saved?.pipeline) ? saved.pipeline.filter((step) => stepDefs[step.id]).map((step) => ({ ...step, enabled:step.enabled !== false })) : clonePipeline(data.defaultPipeline),
    customStopwords: Array.isArray(saved?.customStopwords) ? saved.customStopwords : [],
    comparisonA: saved?.comparisonA || null
  };
  const persist = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* local use remains available without persistence */ } };
  const stateCopy = (current) => ({ type:current.type, value:Array.isArray(current.value) ? [...current.value] : current.value });
  const longestMatch = (chunk) => {
    const dictionary = [...data.chineseDictionary].sort((a,b) => b.length - a.length); const tokens = []; let index = 0;
    while (index < chunk.length) { const matched = dictionary.find((word) => chunk.startsWith(word, index)); tokens.push(matched || chunk[index]); index += (matched || chunk[index]).length; }
    return tokens;
  };
  const tokenize = (text) => (text.match(/[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[\u4e00-\u9fff]+/g) || []).flatMap((part) => /^[\u4e00-\u9fff]+$/.test(part) ? longestMatch(part) : [part]);
  const normaliseWord = (word) => {
    const lower = word.toLowerCase(); if (data.irregularLemmas[lower]) return data.irregularLemmas[lower];
    if (!/^[a-z]+$/.test(lower)) return word;
    if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`;
    if (lower.endsWith('ing') && lower.length > 5) { const stem = lower.slice(0, -3); return stem.length > 2 && stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : stem; }
    if (lower.endsWith('ed') && lower.length > 4) { const stem = lower.slice(0, -2); return stem.length > 2 && stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : stem; }
    if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) return lower.slice(0, -1);
    return lower;
  };
  const processors = {
    normalize: (current) => ({ type:'text', value:current.value.replace(/\s+/g, ' ').trim(), meta:{} }),
    lowercase: (current) => ({ type:current.type, value:current.type === 'text' ? current.value.toLowerCase() : current.value.map((token) => token.toLowerCase()), meta:{} }),
    punctuation: (current) => {
      const replace = (value) => value.replace(/[\.,!?;:'"“”‘’()\[\]{}<>《》【】（）！？；：、，。…—\-_/\\]/g, ' ').replace(/\s+/g, ' ').trim();
      const value = current.type === 'text' ? replace(current.value) : current.value.map(replace).filter(Boolean); return { type:current.type, value, meta:{} };
    },
    tokenize: (current) => ({ type:'tokens', value:tokenize(current.value), meta:{} }),
    stopwords: (current, step) => {
      const stopwords = new Set([...data.englishStopwords, ...data.chineseStopwords, ...state.customStopwords]); const removed = current.value.filter((token) => stopwords.has(token));
      return { type:'tokens', value:current.value.filter((token) => !stopwords.has(token)), meta:{ removed, step } };
    },
    lemmatize: (current) => ({ type:'tokens', value:current.value.map(normaliseWord), meta:{} }),
    ngrams: (current, step) => { const n = Number(step.n || 2); return { type:'ngrams', value:current.value.slice(0, Math.max(0, current.value.length - n + 1)).map((_, index) => current.value.slice(index, index + n).join(' ')), meta:{ n } }; }
  };
  const formatState = (current) => current.type === 'text' ? current.value : JSON.stringify(current.value, null, 2);
  const runPipeline = (input, pipeline) => {
    let current = { type:'text', value:input }; const trace = [{ label:'原始输入', before:null, after:stateCopy(current), message:'尚未处理的原始文本。' }]; const warnings = []; let removedTokens = 0;
    pipeline.forEach((step, index) => {
      const def = stepDefs[step.id]; if (!step.enabled) { trace.push({ label:def.label, skipped:true, before:stateCopy(current), after:stateCopy(current), message:'此步骤已禁用。' }); return; }
      const before = stateCopy(current);
      if (!def.accepts.includes(current.type)) { const warning = `${def.label} 需要 ${def.accepts.join(' 或 ')} 类型输入，但当前收到 ${current.type}；该步骤未执行。`; warnings.push({ index, warning }); trace.push({ label:def.label, before, after:stateCopy(current), warning }); return; }
      const next = processors[step.id](current, step); removedTokens += next.meta?.removed?.length || 0; current = { type:next.type, value:next.value }; trace.push({ label:def.label, before, after:stateCopy(current), message:next.meta?.removed?.length ? `已移除：${next.meta.removed.join(', ')}` : def.note });
    });
    return { final:current, trace, warnings, removedTokens, enabledSteps:pipeline.filter((step) => step.enabled).length };
  };
  const pipelineNames = (pipeline) => pipeline.filter((step) => step.enabled).map((step) => stepDefs[step.id].label).join(' → ') || '没有启用的步骤';
  const getInsights = (result) => {
    const insights = []; const lowerIndex = state.pipeline.findIndex((step) => step.id === 'lowercase' && step.enabled); const stopIndex = state.pipeline.findIndex((step) => step.id === 'stopwords' && step.enabled);
    if (stopIndex >= 0 && (lowerIndex < 0 || stopIndex < lowerIndex)) insights.push('移除停用词发生在转为小写之前，因此 “The” 和 “THE” 无法匹配仅含小写形式的英文停用词表。');
    if (state.pipeline.some((step) => step.id === 'tokenize' && step.enabled) && /[\u4e00-\u9fff]/.test(state.input)) insights.push('中文词元使用本地小型最长匹配词典，未匹配内容回退为单字。这是教学模拟，不等同于 jieba 或 BERT tokenizer。');
    if (state.pipeline.some((step) => step.id === 'lemmatize' && step.enabled)) insights.push('词形归一使用小型不规则词表和规则，无法识别所有语法形式或依赖语境的词元原形。');
    if (result.warnings.length) insights.push('上方警告是有意呈现的：每一步都会接收前一步输出，因此不兼容的排序不会被静默忽略。');
    if (!insights.length) insights.push('可尝试把“转为小写”放到“移除停用词”之后，或把 N-gram 放到仅接受文本的步骤之前，观察真实的顺序差异。'); return insights;
  };
  const changePipeline = (next) => { state.pipeline = next; persist(); render(); };
  const moveStep = (index, direction) => { const next = clonePipeline(state.pipeline); const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; changePipeline(next); };
  const reset = () => { state.pipeline = clonePipeline(data.defaultPipeline); state.input = defaultInput; state.customStopwords = []; state.comparisonA = null; persist(); render(); };
  const loadPitfall = (pitfall) => { state.input = pitfall.input; state.pipeline = pitfall.pipeline; persist(); render(); };
  const createPipelineRow = (step, index) => {
    const def = stepDefs[step.id]; const row = h('article', { className:`pipeline-row${step.enabled ? '' : ' is-disabled'}` });
    const checkbox = h('input', { type:'checkbox', 'aria-label':`启用 ${def.label}` }); checkbox.checked = step.enabled; checkbox.addEventListener('change', () => { const next = clonePipeline(state.pipeline); next[index].enabled = checkbox.checked; changePipeline(next); });
    row.append(h('div', { className:'pipeline-status' }, [checkbox, h('span', { text:String(index + 1).padStart(2,'0') })]), h('div', { className:'pipeline-name' }, [h('strong', { text:def.label }), h('small', { text:def.note })]));
    if (step.id === 'ngrams') { const select = h('select', { 'aria-label':'N-gram size' }, [1,2,3].map((n) => h('option', { value:String(n), text:`n = ${n}`, ...(Number(step.n || 2) === n ? { selected:'selected' } : {}) }))); select.addEventListener('change', () => { const next = clonePipeline(state.pipeline); next[index].n = Number(select.value); changePipeline(next); }); row.append(select); }
    const controls = h('div', { className:'pipeline-actions' }, [button('↑', 'icon-button', () => moveStep(index, -1)), button('↓', 'icon-button', () => moveStep(index, 1)), button('移除', 'icon-button icon-button--remove', () => changePipeline(state.pipeline.filter((_, position) => position !== index)))]);
    controls.children[0].disabled = index === 0; controls.children[1].disabled = index === state.pipeline.length - 1; row.append(controls); return row;
  };
  const render = () => {
    const result = runPipeline(state.input, state.pipeline); shell.className = 'experiment-shell experiment-shell--tool'; shell.replaceChildren();
    const textarea = h('textarea', { id:'preprocess-input', rows:'7', 'aria-label':'原始文本输入', value:state.input, placeholder:'输入需要处理的文本…' }); textarea.addEventListener('input', () => { state.input = textarea.value; persist(); });
    const examples = h('div', { className:'example-list' }, data.examples.map((example) => button(example.name, 'tool-button tool-button--quiet', () => { state.input = example.text; persist(); render(); })));
    const inputPanel = h('section', { className:'preprocess-panel preprocess-input-panel' }, [h('p', { className:'tool-label', text:'输入' }), h('h3', { text:'原始文本' }), textarea, h('div', { className:'input-actions' }, [button('运行流程', 'tool-button tool-button--primary', render), h('p', { className:'input-help', text:'文本仅在当前浏览器本地处理；不会上传。' })]), examples]);
    const addSelect = h('select', { 'aria-label':'选择要添加的处理步骤' }, Object.entries(stepDefs).map(([id, def]) => h('option', { value:id, text:def.label })));
    const addButton = button('添加步骤', 'tool-button tool-button--quiet', () => { state.pipeline = [...state.pipeline, { id:addSelect.value, enabled:true, ...(addSelect.value === 'ngrams' ? { n:2 } : {}) }]; persist(); render(); });
    const pipelineRows = h('div', { className:'pipeline-rows' }, state.pipeline.map(createPipelineRow));
    const pipelinePanel = h('section', { className:'preprocess-panel' }, [h('div', { className:'panel-heading' }, [h('div', {}, [h('p', { className:'tool-label', text:'处理流程' }), h('h3', { text:'处理步骤' })]), button('重置流程', 'tool-button tool-button--quiet', reset)]), h('p', { className:'input-help', text:'每一步读取上一步的实际输出。可用 ↑ / ↓ 排序，也可禁用或移除。' }), pipelineRows, h('div', { className:'pipeline-add' }, [addSelect, addButton])]);
    const customWord = h('input', { type:'text', placeholder:'自定义停用词', 'aria-label':'自定义停用词' });
    const addWord = button('添加', 'tool-button tool-button--quiet', () => { const word = customWord.value.trim(); if (word && !state.customStopwords.includes(word)) { state.customStopwords.push(word); persist(); render(); } });
    const customPanel = h('div', { className:'custom-stopwords' }, [h('p', { className:'tool-label', text:'本地停用词' }), h('div', {}, [customWord, addWord]), h('p', { className:'input-help', text:state.customStopwords.length ? `已添加：${state.customStopwords.join(' · ')}` : '内置英文与少量中文停用词；可额外添加。' })]);
    const warnings = h('section', { className:'pipeline-warnings', 'aria-live':'polite' }, [h('p', { className:'tool-label', text:'流程警告' })]);
    if (result.warnings.length) result.warnings.forEach((item) => warnings.append(h('p', { text:item.warning }))); else warnings.append(h('p', { text:'当前流程的数据类型连续一致。' }));
    const trace = h('section', { className:'trace-panel' }, [h('p', { className:'tool-label', text:'步骤追踪' }), h('h3', { text:'每一步发生了什么' })]);
    result.trace.forEach((item, index) => { const details = h('details', { className:'trace-item', ...(index < 2 ? { open:'open' } : {}) }); details.append(h('summary', { text:item.skipped ? `${item.label} · 已禁用` : item.warning ? `${item.label} · 警告` : item.label })); if (item.before) details.append(h('p', { className:'trace-caption', text:'处理前' }), h('pre', { text:formatState(item.before) })); details.append(h('p', { className:'trace-caption', text:'处理后' }), h('pre', { text:formatState(item.after) }), h('p', { className:'trace-note', text:item.warning || item.message })); trace.append(details); });
    const finalOutput = formatState(result.final); const tokenCount = ['tokens','ngrams'].includes(result.final.type) ? result.final.value.length : tokenize(result.final.value).length;
    const outputStats = [['字符数', String(state.input.length)], ['词元数', String(tokenCount)], ['已移除', String(result.removedTokens)], ['N-gram 数', result.final.type === 'ngrams' ? String(result.final.value.length) : '—'], ['启用步骤', String(result.enabledSteps)]];
    const output = h('section', { className:'output-panel' }, [h('p', { className:'tool-label', text:'输出' }), h('h3', { text:'最终结果' }), h('pre', { className:'final-output', text:finalOutput }), h('div', { className:'output-meta' }, outputStats.map(([label, value]) => h('div', {}, [h('span', { text:label }), h('strong', { text:value })])))]);
    const insights = h('section', { className:'insight-panel' }, [h('p', { className:'tool-label', text:'流程洞察' }), h('h3', { text:'为什么结果发生了变化？' })]); getInsights(result).forEach((insight) => insights.append(h('p', { text:insight })));
    const comparison = h('section', { className:'compare-panel' }, [h('div', { className:'panel-heading' }, [h('div', {}, [h('p', { className:'tool-label', text:'对比处理流程' }), h('h3', { text:'流程 A / B' })]), button('保存为流程 A', 'tool-button tool-button--quiet', () => { state.comparisonA = { input:state.input, pipeline:clonePipeline(state.pipeline), output:finalOutput, type:result.final.type }; persist(); render(); })])]);
    if (state.comparisonA) { const compareGrid = h('div', { className:'compare-grid' }, [h('article', {}, [h('strong', { text:'流程 A' }), h('p', { text:pipelineNames(state.comparisonA.pipeline) }), h('pre', { text:state.comparisonA.output })]), h('article', {}, [h('strong', { text:'流程 B · 当前' }), h('p', { text:pipelineNames(state.pipeline) }), h('pre', { text:finalOutput })])]); comparison.append(compareGrid, button('清除对比', 'tool-button tool-button--quiet', () => { state.comparisonA = null; persist(); render(); })); } else comparison.append(h('p', { className:'empty-note', text:'将当前流程保存为流程 A，再调整顺序或步骤；当前输出即作为流程 B 显示。' }));
    const pitfalls = [
      { title:'先移除停用词，后转小写', input:'The models are learning and THE students are reading.', pipeline:[{id:'tokenize',enabled:true},{id:'stopwords',enabled:true},{id:'lowercase',enabled:true}] },
      { title:'先构建 N-gram，后转小写', input:'NLP Models Are Learning', pipeline:[{id:'tokenize',enabled:true},{id:'ngrams',enabled:true,n:2},{id:'lowercase',enabled:true}] },
      { title:'简化中文切分的局限', input:'自然语言处理很有趣，我们正在学习文本处理。', pipeline:[{id:'normalize',enabled:true},{id:'tokenize',enabled:true},{id:'stopwords',enabled:true}] },
      { title:'标点也可能携带信息', input:'Great!!! Really great? #NLP', pipeline:[{id:'lowercase',enabled:true},{id:'punctuation',enabled:true},{id:'tokenize',enabled:true}] }
    ];
    const pitfallsPanel = h('section', { className:'pitfalls-panel' }, [h('p', { className:'tool-label', text:'常见误区' }), h('h3', { text:'加载典型案例' })]); pitfalls.forEach((pitfall) => pitfallsPanel.append(button(pitfall.title, 'tool-button tool-button--quiet', () => loadPitfall(pitfall))));
    shell.append(h('div', { className:'preprocess-top' }, [inputPanel, pipelinePanel]), customPanel, warnings, trace, output, insights, comparison, pitfallsPanel);
  };
  render();
})();
