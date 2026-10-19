(() => {
  const shell = document.querySelector('[data-experiment="bpe"]');
  const data = window.NLPToolboxData?.bpe;
  const bpe = window.NLPToolboxBPE;
  if (!shell || !data || !bpe) return;

  const steps = [
    ['语料', '整理输入文本并统计每个单词的出现频率。重复单词会在后续词对计数中贡献更多次数。'],
    ['初始符号', '每个单词从字符序列和 </w> 词边界开始；每个词独立保存，因此合并不会跨越单词边界。'],
    ['词对计数', '扫描每个词中的相邻符号对，并乘以该词频。词对频率不是“出现于几个不同单词”。'],
    ['选择词对', '选择频率最高的可合并词对。频率相同则以词对的字典序打破平局，使训练可重复。'],
    ['合并', '以从左到右、非重叠的方式替换词对；同一条规则会作用在当前语料中的全部匹配位置。'],
    ['更新词表', '新符号加入词表，然后重新扫描整个教学语料，而不是沿用旧的词对计数。'],
    ['重复', '重复统计、选择和合并，直到达到合并步数，或不再有可合并的字符对。'],
    ['切分', '新词也从字符和 </w> 开始，按训练阶段的规则顺序逐条执行；未匹配规则会如实标记。']
  ];
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'value') node.value = value;
      else if (key === 'checked') node.checked = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => node.append(child));
    return node;
  };
  const button = (text, className, onClick, extra = {}) => el('button', { type: 'button', className, text, onClick, ...extra });
  const pairSame = (first, second) => first && second && first.left === second.left && first.right === second.right;
  const symbolChip = (symbol, className = '') => el('span', { className: `bpe-symbol ${className}`, text: symbol });
  const symbols = (items, highlight = null) => el('div', { className: 'bpe-symbols' }, items.map((symbol, index) => {
    const start = highlight && items[index] === highlight.left && items[index + 1] === highlight.right;
    const end = highlight && items[index - 1] === highlight.left && items[index] === highlight.right;
    return symbolChip(symbol, start ? 'is-pair-start' : end ? 'is-pair-end' : '');
  }));
  const table = (headers, rows, className = '') => el('div', { className: `bpe-table-wrap ${className}` }, el('table', { className: 'bpe-table' }, [el('thead', {}, el('tr', {}, headers.map((header) => el('th', { text: header })))), el('tbody', {}, rows)]));

  const state = { corpusText: data.presets['CLASSIC ENGLISH'], lowercase: true, maximumMerges: 10, snapshots: [], activeStep: 0, selectedPair: null, tokenText: data.tokenizerExample, tokenRuleIndex: 0, timer: null };
  const stopAuto = () => { if (state.timer) window.clearInterval(state.timer); state.timer = null; };
  const start = () => { state.snapshots = [bpe.createState(state.corpusText, state.maximumMerges, { lowercase: state.lowercase })]; state.selectedPair = null; state.tokenRuleIndex = 0; };
  start();
  const current = () => state.snapshots[state.snapshots.length - 1];
  const setMaximumMerges = (value) => {
    state.maximumMerges = Math.max(1, Math.min(50, Number(value) || 10));
    state.snapshots = state.snapshots.map((snapshot) => ({ ...snapshot, maximumMerges: state.maximumMerges }));
    state.tokenRuleIndex = Math.min(state.tokenRuleIndex, current().rules.length);
  };
  const mergeNext = () => {
    const result = bpe.nextMerge(current());
    if (result.bestPair) state.snapshots.push(bpe.snapshot(result.state));
    if (result.complete) stopAuto();
    state.selectedPair = result.bestPair || state.selectedPair; state.tokenRuleIndex = Math.min(state.tokenRuleIndex, current().rules.length); render();
  };
  const previous = () => { stopAuto(); if (state.snapshots.length > 1) state.snapshots.pop(); state.tokenRuleIndex = Math.min(state.tokenRuleIndex, current().rules.length); render(); };
  const reset = () => { stopAuto(); start(); state.activeStep = 0; render(); };
  const autoTrain = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    stopAuto();
    state.timer = window.setInterval(() => {
      const result = bpe.nextMerge(current());
      if (!result.bestPair) { stopAuto(); render(); return; }
      state.snapshots.push(bpe.snapshot(result.state)); state.selectedPair = result.bestPair;
      if (result.complete) stopAuto(); render();
    }, 700);
  };
  const emptyRow = (count, text) => el('tr', {}, el('td', { colspan: String(count), className: 'bpe-empty', text }));

  const render = () => {
    const model = current(); const pairs = bpe.countPairs(model.entries); const best = bpe.selectBestPair(pairs); const reachedLimit = model.rules.length >= model.maximumMerges;
    const inspectedPair = pairs.find((pair) => pairSame(pair, state.selectedPair)) || best || pairs[0] || null;
    const corpusWords = model.initialEntries.reduce((sum, entry) => sum + entry.frequency, 0);
    shell.className = 'experiment-shell experiment-shell--tool bpe-lab'; shell.replaceChildren();

    const corpus = el('textarea', { rows: '4', value: state.corpusText, 'aria-label': 'BPE 训练语料' });
    corpus.addEventListener('input', () => { state.corpusText = corpus.value; });
    corpus.addEventListener('change', reset);
    const lowercase = el('input', { type: 'checkbox', 'aria-label': '训练前将语料转为小写' }); lowercase.checked = state.lowercase;
    lowercase.addEventListener('change', () => { state.lowercase = lowercase.checked; reset(); });
    const mergeCount = el('input', { type: 'number', min: '1', max: '50', value: state.maximumMerges, 'aria-label': '最大合并步数' });
    mergeCount.addEventListener('change', () => { setMaximumMerges(mergeCount.value); render(); });
    const controls = el('section', { className: 'bpe-controls' }, [
      el('div', {}, [el('p', { className: 'tool-label', text: 'A · 训练分词器' }), el('h3', { text: '字符级教学版 BPE' }), el('p', { className: 'input-help', text: '经典教学 BPE：字符 + </w>、按词频加权的词对合并。它用于解释机制，并非 GPT 生产环境中的字节级 BPE 分词器。' })]),
      el('label', { className: 'bpe-field', text: '输入语料' }, corpus),
      el('div', { className: 'example-list', 'aria-label': '语料预设' }, Object.entries(data.presets).map(([name, value]) => button(name === 'CLASSIC ENGLISH' ? '经典英文' : name === 'MORPHOLOGY' ? '词形变化' : name === 'CUSTOM' ? '自定义' : name, 'tool-button tool-button--quiet', () => { stopAuto(); state.corpusText = value; reset(); }))),
      el('div', { className: 'bpe-control-row' }, [el('label', { className: 'select-label bpe-checkbox-label', text: '语料转小写' }, lowercase), el('label', { className: 'select-label', text: '最大合并步数' }, mergeCount), button('开始 / 重置训练', 'tool-button tool-button--primary', reset)]),
      el('p', { className: 'input-help', text: '修改语料或大小写选项会重置 BPE 模型。标点会被视为分隔符；当前教学解析器只保留英文字母。' })
    ]);
    const navigator = el('section', { className: 'bpe-step-area' }, [el('div', { className: 'bpe-step-nav', 'aria-label': 'BPE 学习步骤' }, steps.map(([label], index) => button(`${String(index + 1).padStart(2, '0')} ${label}`, `bpe-step${state.activeStep === index ? ' is-active' : ''}`, () => { state.activeStep = index; render(); }, state.activeStep === index ? { 'aria-current': 'step' } : {}))), el('div', { className: 'bpe-explanation' }, [el('p', { className: 'tool-label', text: '当前发生什么？' }), el('p', { text: steps[state.activeStep][1] })])]);
    const stats = el('section', { className: 'bpe-training-stats', 'aria-label': 'Training stats' }, [
      ['语料词数', corpusWords], ['不同单词数', model.initialEntries.length], ['基础符号数', model.initialVocabulary.length], ['已合并步数', model.rules.length], ['当前词表大小', model.vocabulary.length], ['当前词对数', pairs.length]
    ].map(([label, value]) => el('div', {}, [el('span', { text: label }), el('strong', { text: String(value) })])));

    const frequencyRows = model.initialEntries.length ? model.initialEntries.map((entry) => el('tr', {}, [el('td', { text: entry.word }), el('td', { text: String(entry.frequency) })])) : [emptyRow(2, '请输入训练语料。')];
    const stateRows = model.entries.length ? model.entries.map((entry) => el('tr', {}, [el('td', { text: entry.word }), el('td', { text: String(entry.frequency) }), el('td', {}, symbols(entry.symbols, best))])) : [emptyRow(3, '暂无语料状态。')];
    const corpusPanels = el('section', { className: 'bpe-grid bpe-grid--state' }, [el('article', { className: 'bpe-panel' }, [el('p', { className: 'tool-label', text: '单词频率表' }), table(['单词', '频率'], frequencyRows)]), el('article', { className: 'bpe-panel' }, [el('p', { className: 'tool-label', text: '当前语料状态' }), el('p', { className: 'input-help', text: '带描边的符号会标出当前最佳词对在语料中的所有出现位置。' }), table(['单词', '频率', '符号序列'], stateRows, 'bpe-corpus-table')])]);

    const pairRows = pairs.slice(0, 18).map((pair, index) => el('tr', { className: pairSame(pair, best) ? 'is-best' : '' }, [el('td', { text: String(index + 1) }), el('td', {}, button(`${pair.left} + ${pair.right}`, 'bpe-pair-button', () => { state.selectedPair = pair; render(); }, { 'aria-pressed': pairSame(pair, inspectedPair) ? 'true' : 'false', 'aria-label': `查看词对 ${pair.left} 加 ${pair.right}` })), el('td', { text: String(pair.count) })]));
    const contributionRows = bpe.pairOccurrences(model.entries, inspectedPair).map((item) => el('tr', {}, [el('td', { text: item.word }), el('td', { text: `${item.occurrences} × ${item.frequency}` }), el('td', { text: String(item.contribution) })]));
    const pairInspector = el('article', { className: 'bpe-panel bpe-pair-inspector' }, [el('p', { className: 'tool-label', text: '该词对出现在哪里？' }), inspectedPair ? el('p', { className: 'bpe-inspector-title', text: `${inspectedPair.left} + ${inspectedPair.right}  ·  加权总数 ${inspectedPair.count}` }) : el('p', { className: 'input-help', text: '当前语料没有可用的词对频率。' }), table(['单词', '出现次数 × 词频', '贡献'], contributionRows.length ? contributionRows : [emptyRow(3, '暂无出现位置。')])]);
    const bestPanel = el('section', { className: 'bpe-grid bpe-grid--pair' }, [
      el('article', { className: 'bpe-panel bpe-best-pair' }, [el('p', { className: 'tool-label', text: '最佳词对 / 算法' }), best ? el('div', { className: 'bpe-merge-display' }, [symbolChip(best.left), el('span', { className: 'bpe-operator', text: '+' }), symbolChip(best.right), el('span', { className: 'bpe-arrow', text: '→' }), symbolChip(`${best.left}${best.right}`, 'is-result')]) : el('p', { className: 'input-help', text: !model.entries.length ? '请输入训练语料。' : reachedLimit ? '已达到设定的合并步数上限。' : '没有可合并的词对' }), best && el('p', { className: 'bpe-best-count', text: `加权频率 ${best.count}` }), el('p', { className: 'formula', text: 'pair*(t) = argmax(pairCount(pair))；Corpus(t + 1) = Merge(Corpus(t), pair*(t))' }), el('p', { className: 'input-help', text: '平局规则：先比较频率，再按词对字典序排列。 </w> 会出现在词对计数中，但当前教学流程不会把它选为最终合并对象。' })]),
      el('article', { className: 'bpe-panel' }, [el('p', { className: 'tool-label', text: '词对频率 / 选择查看' }), table(['排名', '词对', '次数'], pairRows.length ? pairRows : [emptyRow(3, '暂无词对频率。')], 'bpe-pair-table')])
    ]);
    const trainingControls = el('div', { className: 'tool-navigation bpe-train-navigation' }, [button('← 上一步', 'tool-button tool-button--quiet', previous, state.snapshots.length <= 1 ? { disabled: 'disabled' } : {}), el('span', { className: 'step-indicator', text: `合并 ${model.rules.length} / ${model.maximumMerges}` }), button('合并下一词对 →', 'tool-button tool-button--primary', mergeNext, !best || reachedLimit ? { disabled: 'disabled' } : {}), button('自动训练', 'tool-button tool-button--quiet', autoTrain, !best || reachedLimit ? { disabled: 'disabled' } : {}), button('暂停', 'tool-button tool-button--quiet', () => { stopAuto(); render(); }), button('重置', 'tool-button tool-button--quiet', reset)]);

    const baseVocabulary = new Set(model.initialVocabulary); const vocabChips = model.vocabulary.map((symbol) => symbolChip(symbol, baseVocabulary.has(symbol) ? 'is-base' : 'is-merged'));
    const historyRows = model.rules.length ? model.rules.map((rule) => el('tr', {}, [el('td', { text: String(rule.step) }), el('td', { text: `${rule.left} + ${rule.right}` }), el('td', { text: String(rule.count) }), el('td', { text: rule.merged })])) : [emptyRow(4, '暂无合并规则。请选择“合并下一词对”开始训练。')];
    const vocabulary = el('section', { className: 'bpe-grid bpe-grid--vocab' }, [el('article', { className: 'bpe-panel' }, [el('p', { className: 'tool-label', text: '词表演化' }), el('div', { className: 'bpe-stat-row' }, [el('span', { text: '初始大小' }), el('strong', { text: String(model.initialVocabulary.length) }), el('span', { text: '当前大小' }), el('strong', { text: String(model.vocabulary.length) }), el('span', { text: '新符号数' }), el('strong', { text: String(model.rules.length) })]), el('p', { className: 'input-help', text: '基础符号使用中性描边；每次合并都会新增一个带强调色的符号。' }), el('div', { className: 'bpe-vocabulary' }, vocabChips)]), el('article', { className: 'bpe-panel' }, [el('p', { className: 'tool-label', text: '合并规则 / 顺序很重要' }), el('p', { className: 'input-help', text: '新文本会按这个有序规则表逐条处理，而不是在最终词表上进行贪心最长匹配。' }), table(['步骤', '词对', '合并时次数', '新符号'], historyRows)])]);

    const newText = el('textarea', { rows: '2', value: state.tokenText, 'aria-label': '待切分的新文本' });
    newText.addEventListener('input', () => { state.tokenText = newText.value; }); newText.addEventListener('change', render);
    const ruleLimit = Math.min(state.tokenRuleIndex, model.rules.length);
    const tokenOptions = { lowercase: model.lowercase, baseVocabulary: model.initialVocabulary, ruleLimit };
    const tokenized = bpe.tokenizeText(state.tokenText, model.rules, tokenOptions);
    const fullTokenized = bpe.tokenizeText(state.tokenText, model.rules, { ...tokenOptions, ruleLimit: model.rules.length });
    const traceCards = tokenized.length ? tokenized.map((result) => el('details', { className: 'bpe-token-trace', open: 'open' }, [el('summary', {}, el('span', { className: 'bpe-trace-summary' }, [el('span', { className: 'bpe-trace-word', text: result.word || '—' }), el('span', { className: 'bpe-trace-result', text: `[ ${result.tokens.join(' · ') || '—'} ]` })])), result.unseenCharacters.length ? el('p', { className: 'bpe-unknown-note', text: `未见符号：${result.unseenCharacters.join(' · ')}。该字符会被保留以便查看，但基础字符词表中没有它。` }) : null, ...result.trace.map((trace) => el('div', { className: `bpe-trace-row${trace.applied ? '' : ' is-no-match'}` }, [el('span', { text: trace.kind === 'INITIAL' ? '初始状态' : trace.kind.replace('RULE', '规则') }), el('div', {}, [trace.rule && el('small', { text: `${trace.rule.left} + ${trace.rule.right} → ${trace.rule.merged}${trace.applied ? '' : ' · 未匹配'}` }), symbols(trace.symbols)])]))])) : [el('p', { className: 'input-help', text: '请输入用空格分隔的英文单词，查看子词切分追踪。' })];
    const allWords = bpe.normalizeWhitespace(state.tokenText).split(' ').map((word) => bpe.cleanWord(word, model.lowercase)).filter(Boolean);
    const characterCount = allWords.reduce((sum, word) => sum + [...word].length, 0); const bpeCount = fullTokenized.reduce((sum, result) => sum + result.tokens.length, 0); const unseen = [...new Set(fullTokenized.flatMap((result) => result.unseenCharacters))];
    const comparisonRows = [
      ['字符级', characterCount, '基础字符', '字符表覆盖后较低', '细'], ['词级', allWords.length, '完整单词', '未见单词时较高', '粗'], ['BPE', bpeCount, '学习到的子词', unseen.length ? `未见：${unseen.join(' · ')}` : '取决于基础字符表', '中等']
    ].map((row) => el('tr', {}, row.map((value) => el('td', { text: String(value) }))));
    const ruleControls = el('div', { className: 'tool-navigation bpe-rule-navigation' }, [button('← 上一条规则', 'tool-button tool-button--quiet', () => { state.tokenRuleIndex = Math.max(0, state.tokenRuleIndex - 1); render(); }, ruleLimit === 0 ? { disabled: 'disabled' } : {}), el('span', { className: 'step-indicator', text: `规则 ${ruleLimit} / ${model.rules.length}` }), button('下一条规则 →', 'tool-button tool-button--primary', () => { state.tokenRuleIndex = Math.min(model.rules.length, state.tokenRuleIndex + 1); render(); }, ruleLimit >= model.rules.length ? { disabled: 'disabled' } : {}), button('应用全部', 'tool-button tool-button--quiet', () => { state.tokenRuleIndex = model.rules.length; render(); }, ruleLimit >= model.rules.length ? { disabled: 'disabled' } : {}), button('重置规则', 'tool-button tool-button--quiet', () => { state.tokenRuleIndex = 0; render(); })]);
    const tokenizer = el('section', { className: 'bpe-tokenizer' }, [el('article', { className: 'bpe-panel' }, [el('p', { className: 'tool-label', text: 'C · 切分新文本' }), el('label', { className: 'bpe-field', text: '新文本' }, newText), el('p', { className: 'input-help', text: `逐条规则模式会应用已学习规则中的前 ${ruleLimit} / ${model.rules.length} 条。没有匹配位置的规则仍会显示为“未匹配”。` }), ruleControls, el('div', { className: 'bpe-traces' }, traceCards)]), el('article', { className: 'bpe-panel' }, [el('p', { className: 'tool-label', text: 'D · 表示方式对比' }), el('p', { className: 'input-help', text: '该对比用于描述而非排名：BPE 常在字符级与词级之间平衡序列长度、词表大小和 OOV 行为。' }), table(['切分方式', '词元数', '词表依赖', 'OOV 风险', '粒度'], comparisonRows, 'bpe-representation')])]);
    const context = el('section', { className: 'bpe-context' }, [el('p', { className: 'tool-label', text: '流程位置与分词器说明' }), el('div', { className: 'bpe-context-flow' }, ['文本', '预处理', '分词器', '词元 ID', 'Transformer'].map((label) => el('span', { className: label === '分词器' ? 'is-active' : '', text: label }))), el('div', { className: 'bpe-concept-grid' }, [el('p', { text: '字符级：几乎避免词级 OOV，但序列可能较长。' }), el('p', { text: '词级：单位直观，但需要大词表，且容易出现词级 OOV。' }), el('p', { text: 'BPE：反复合并高频符号对；它是常见子词方法之一，并非所有现代分词器。' }), el('p', { text: '字节级 BPE 从字节开始，更容易覆盖任意 Unicode。WordPiece 使用不同的选择标准；Unigram 从较大词表出发并以概率方式删减。' })]), el('p', { className: 'input-help', text: '为保证过程清晰，每一步合并都会重新扫描小型语料；工业训练会使用更高效的数据结构。' })]);
    const note = el('section', { className: 'bpe-note' }, [el('p', { className: 'tool-label', text: '教学范围' }), el('p', { text: '这是确定性的字符级教学版 BPE：使用本地英文字符符号、显式 </w> 边界和有序合并规则。生产级分词器可能包含字节级规范化、特殊词元和更大的词表。当前结果对本地语料真实有效，但不是 GPT 或 Hugging Face 分词器。' })]);
    shell.append(controls, navigator, stats, corpusPanels, bestPanel, pairInspector, trainingControls, vocabulary, tokenizer, context, note);
  };
  window.addEventListener('beforeunload', stopAuto);
  render();
})();
