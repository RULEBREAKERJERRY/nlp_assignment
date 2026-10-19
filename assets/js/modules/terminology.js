(() => {
  const shell = document.querySelector('[data-experiment="terminology"]');
  const terms = window.NLPToolboxData?.terminology;
  if (!shell || !terms) return;

  const KEYS = { stats:'nlp-toolbox.terminology.stats', mistakes:'nlp-toolbox.terminology.mistakes', progress:'nlp-toolbox.terminology.progress' };
  const categories = { all:'全部', foundations:'基础概念', tasks:'NLP 任务', metrics:'评价指标', 'deep-learning':'深度学习', transformer:'Transformer / LLM' };
  const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* browser storage can be unavailable */ } };
  const shuffle = (items) => [...items].sort(() => Math.random() - .5);
  const byId = new Map(terms.map((term) => [term.id, term]));
  const metricFormulas = {
    accuracy:'Accuracy = (TP + TN) / (TP + TN + FP + FN)',
    precision:'Precision = TP / (TP + FP)',
    recall:'Recall = TP / (TP + FN)',
    f1:'F1 = 2 × Precision × Recall / (Precision + Recall)',
    perplexity:'PPL = exp(−1 / N × Σ log p(xᵢ))'
  };
  const h = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.append(child));
    return node;
  };
  const button = (text, className, action) => h('button', { type:'button', className, text, onClick:action });
  const loadStats = () => safeRead(KEYS.stats, { answered:0, correct:0, updatedAt:null });
  const loadMistakes = () => safeRead(KEYS.mistakes, {});
  let storedProgress = safeRead(KEYS.progress, null);
  let state = {
    category: storedProgress?.category || 'all', level: storedProgress?.level || 2,
    deck: (storedProgress?.deck || []).map((id) => byId.get(id)).filter(Boolean), index:storedProgress?.index || 0,
    responses: storedProgress?.responses || {}, session:{ answered:0, correct:0 }
  };
  if (!state.deck.length) state.deck = shuffle(terms);

  const persistProgress = () => safeWrite(KEYS.progress, { category:state.category, level:state.level, deck:state.deck.map((term) => term.id), index:state.index, responses:state.responses, savedAt:new Date().toISOString() });
  const termFor = () => state.deck[state.index];
  const optionsFor = (term, key, selectedId) => {
    const property = key === 'definition' ? 'definition' : 'application';
    const selectedTerm = selectedId && selectedId !== term.id ? byId.get(selectedId) : null;
    const pool = terms.filter((item) => item.id !== term.id && item.id !== selectedId && (state.level < 3 ? item.category === term.category : true));
    return shuffle([term, ...(selectedTerm ? [selectedTerm] : []), ...shuffle(pool).slice(0, selectedTerm ? 1 : 2)]).map((item) => ({ id:item.id, text:item[property] }));
  };
  const recordMistake = (term, response) => {
    const mistakes = loadMistakes();
    const record = mistakes[term.id] || { id:term.id, term:term.term, category:term.category, count:0 };
    record.count += 1;
    record.selectedDefinition = response.definition ? byId.get(response.definition)?.definition : '未选择';
    record.selectedApplication = response.application ? byId.get(response.application)?.application : '未选择';
    record.correctDefinition = term.definition;
    record.correctApplication = term.application;
    record.explanation = term.explanation;
    record.lastErrorAt = new Date().toISOString();
    mistakes[term.id] = record;
    safeWrite(KEYS.mistakes, mistakes);
  };
  const startDeck = () => {
    const filtered = terms.filter((term) => state.category === 'all' || term.category === state.category).filter((term) => term.difficulty <= state.level || state.level === 3);
    state.deck = shuffle(filtered.length ? filtered : terms);
    state.index = 0; state.responses = {}; state.session = { answered:0, correct:0 }; persistProgress(); render();
  };
  const selectAnswer = (key, id) => {
    const term = termFor(); const response = state.responses[term.id] || {};
    if (response.checked) return;
    response[key] = id; state.responses[term.id] = response; persistProgress(); render();
  };
  const checkAnswer = () => {
    const term = termFor(); const response = state.responses[term.id] || {};
    if (response.checked || !response.definition || (state.level > 1 && !response.application)) return;
    const correct = response.definition === term.id && (state.level === 1 || response.application === term.id);
    response.checked = true; response.correct = correct; state.responses[term.id] = response;
    state.session.answered += 1; if (correct) state.session.correct += 1;
    const stats = loadStats(); stats.answered += 1; if (correct) stats.correct += 1; stats.updatedAt = new Date().toISOString(); safeWrite(KEYS.stats, stats);
    if (!correct) recordMistake(term, response); persistProgress(); render();
  };
  const changeIndex = (amount) => { state.index = Math.max(0, Math.min(state.deck.length - 1, state.index + amount)); persistProgress(); render(); };
  const feedback = (term, response) => {
    if (!response?.checked) return h('div', { className:'term-feedback term-feedback--idle', text:'选择匹配项后检查答案。每次错误都会生成可回看的诊断记录。' });
    const correct = response.correct;
    const selectedDefinition = byId.get(response.definition)?.definition || '未选择';
    const selectedApplication = byId.get(response.application)?.application || '未选择';
    const list = h('dl', { className:'diagnostic-list' }, [
      h('div', {}, [h('dt', { text:'你选择的定义' }), h('dd', { text:selectedDefinition })]),
      ...(state.level > 1 ? [h('div', {}, [h('dt', { text:'你选择的场景' }), h('dd', { text:selectedApplication })])] : []),
      h('div', {}, [h('dt', { text:'正确匹配' }), h('dd', { text:`${term.definition} / ${term.application}` })]),
      h('div', {}, [h('dt', { text:'为什么' }), h('dd', { text:term.explanation })]),
      h('div', {}, [h('dt', { text:'易混淆点' }), h('dd', { text:term.confusion })])
    ]);
    return h('div', { className:`term-feedback ${correct ? 'term-feedback--correct' : 'term-feedback--wrong'}` }, [h('p', { className:'feedback-status', text:correct ? '正确 · 匹配无误。' : '请复习 · 需要重新辨析。' }), list, metricFormulas[term.id] ? h('p', { className:'formula', text:metricFormulas[term.id] }) : null]);
  };
  const optionGroup = (term, key, label) => {
    const response = state.responses[term.id] || {};
    const options = optionsFor(term, key, response[key]);
    const group = h('section', { className:'term-choice-group', 'aria-labelledby':`${key}-label` }, [h('p', { id:`${key}-label`, className:'tool-label', text:label })]);
    if (key === 'application' && state.level === 1) { group.append(h('p', { className:'choice-note', text:'第 1 级聚焦术语与定义；场景匹配将在下一等级开启。' })); return group; }
    const choices = h('div', { className:'term-options', role:'group', 'aria-label':label });
    options.forEach((option) => {
      const selected = response[key] === option.id; const isCorrect = response.checked && option.id === term.id;
      const isWrong = response.checked && selected && !isCorrect;
      const choice = button(option.text, `term-option${selected ? ' is-selected' : ''}${isCorrect ? ' is-correct' : ''}${isWrong ? ' is-wrong' : ''}`, () => selectAnswer(key, option.id));
      choice.setAttribute('aria-pressed', String(selected)); if (response.checked) choice.disabled = true; choices.append(choice);
    });
    group.append(choices); return group;
  };
  const summary = () => {
    const stats = loadStats(); const accuracy = stats.answered ? Math.round(stats.correct / stats.answered * 100) : 0;
    const mistakes = Object.values(loadMistakes()).sort((a, b) => b.count - a.count || new Date(b.lastErrorAt) - new Date(a.lastErrorAt));
    const statsGrid = h('div', { className:'stat-grid' }, [
      ['已作答', stats.answered], ['正确', stats.correct], ['错误', Math.max(0, stats.answered - stats.correct)], ['正确率', `${accuracy}%`]
    ].map(([label, value]) => h('div', {}, [h('span', { text:label }), h('strong', { text:String(value) })])));
    const missed = h('div', { className:'mistakes-preview' }, [h('p', { className:'tool-label', text:'最易错术语' })]);
    if (mistakes.length) mistakes.slice(0, 4).forEach((item) => missed.append(h('p', { text:`${item.term} · ${item.count} 次` })));
    else missed.append(h('p', { text:'尚无错题记录。' }));
    const categoryTotals = mistakes.reduce((totals, item) => { totals[item.category] = (totals[item.category] || 0) + item.count; return totals; }, {});
    const categoryGaps = h('div', { className:'mistakes-preview' }, [h('p', { className:'tool-label', text:'薄弱分类' })]);
    if (mistakes.length) Object.entries(categoryTotals).sort((a,b) => b[1] - a[1]).forEach(([category, count]) => categoryGaps.append(h('p', { text:`${categories[category]} · ${count} 次` })));
    else categoryGaps.append(h('p', { text:'完成答题后会按分类汇总错误。' }));
    return h('aside', { className:'term-summary', 'aria-label':'学习统计' }, [h('p', { className:'tool-label', text:'本次学习统计' }), statsGrid, missed, categoryGaps]);
  };
  const mistakeBook = () => {
    const records = Object.values(loadMistakes()).sort((a, b) => new Date(b.lastErrorAt) - new Date(a.lastErrorAt));
    const panel = h('section', { className:'mistake-book' }, [h('div', { className:'book-heading' }, [h('div', {}, [h('p', { className:'tool-label', text:'错题本' }), h('h3', { text:'错题记录' })])])]);
    const actions = h('div', { className:'book-actions' }, [
      button('导出 JSON', 'tool-button tool-button--quiet', () => exportMistakes(records)),
      button('清空记录', 'tool-button tool-button--danger', () => { if (window.confirm('确定清空术语闯关的全部错题记录吗？此操作无法撤销。')) { safeWrite(KEYS.mistakes, {}); render(); } })
    ]);
    panel.querySelector('.book-heading').append(actions);
    if (!records.length) panel.append(h('p', { className:'empty-note', text:'答错后，这里会保存术语、错误选择、正确答案与最近错误时间。' }));
    records.forEach((record) => panel.append(h('article', { className:'mistake-record' }, [h('h4', { text:record.term }), h('p', { text:`错误次数：${record.count} · 最近错误：${new Date(record.lastErrorAt).toLocaleString('zh-CN')}` }), h('p', { text:`你的选择：${record.selectedDefinition}` }), h('p', { text:`正确答案：${record.correctDefinition}` }), h('p', { text:record.explanation })])));
    return panel;
  };
  const exportMistakes = (records) => {
    const content = JSON.stringify({ exportedAt:new Date().toISOString(), module:'NLP Toolbox Terminology', records }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type:'application/json;charset=utf-8' }));
    const link = h('a', { href:url, download:'nlp-toolbox-terminology-mistakes.json' }); document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  const render = () => {
    const term = termFor(); const response = state.responses[term.id] || {};
    shell.className = 'experiment-shell experiment-shell--tool'; shell.replaceChildren();
    const controls = h('div', { className:'tool-controls' }, [
      h('label', { className:'select-label', text:'范围' }, [h('select', { 'aria-label':'题目分类', onChange:(event) => { state.category = event.target.value; startDeck(); } }, Object.entries(categories).map(([value, label]) => h('option', { value, text:label, ...(value === state.category ? { selected:'selected' } : {}) }))) ]),
      h('label', { className:'select-label', text:'难度' }, [h('select', { 'aria-label':'难度等级', onChange:(event) => { state.level = Number(event.target.value); startDeck(); } }, [[1,'第 1 级 · 术语与定义'],[2,'第 2 级 · 三层配对'],[3,'第 3 级 · 混合干扰项']].map(([value,label]) => h('option', { value, text:label, ...(value === state.level ? { selected:'selected' } : {}) }))) ]),
      button('重新开始', 'tool-button tool-button--quiet', startDeck)
    ]);
    const progress = h('div', { className:'tool-progress' }, [h('div', { className:'progress-meta' }, [h('span', { text:`当前关卡 ${String(state.index + 1).padStart(2, '0')} / ${String(state.deck.length).padStart(2, '0')}` }), h('span', { text:categories[term.category] })]), h('div', { className:'progress-track', role:'progressbar', 'aria-valuemin':'0', 'aria-valuemax':String(state.deck.length), 'aria-valuenow':String(state.index + 1) }, [h('i', { style:`width:${((state.index + 1) / state.deck.length) * 100}%` })])]);
    const question = h('section', { className:'term-question' }, [h('p', { className:'tool-label', text:'术语' }), h('h3', { text:term.term }), h('p', { className:'term-category', text:categories[term.category] })]);
    const checking = button(response.checked ? (response.correct ? '已完成本题' : '已记录诊断') : '检查答案', 'tool-button tool-button--primary', checkAnswer);
    checking.disabled = Boolean(response.checked || !response.definition || (state.level > 1 && !response.application));
    const nav = h('div', { className:'tool-navigation' }, [button('← 上一题', 'tool-button tool-button--quiet', () => changeIndex(-1)), checking, button('下一题 →', 'tool-button tool-button--quiet', () => changeIndex(1))]);
    nav.children[0].disabled = state.index === 0; nav.children[2].disabled = state.index === state.deck.length - 1;
    shell.append(controls, progress, question, optionGroup(term, 'definition', '定义'), optionGroup(term, 'application', '应用场景 / 示例'), nav, feedback(term, response), summary(), mistakeBook());
  };
  render();
})();
