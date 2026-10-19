(() => {
  const shell = document.querySelector('[data-experiment="metrics"]');
  const M = window.NLPToolboxMetrics;
  const presets = window.NLPToolboxData?.metrics;
  if (!shell || !M || !presets) return;

  const KEY = 'nlp-toolbox.metrics.state';
  const h = (tag, props = {}, children = []) => {
    const element = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') element.className = value;
      else if (key === 'text') element.textContent = value;
      else if (key === 'value') element.value = value;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, value);
    });
    (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((child) => element.append(child));
    return element;
  };
  const button = (text, className, onClick) => h('button', { type:'button', className, text, onClick });
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const saved = read();
  let state = {
    tab:saved?.tab || 'classification', mode:saved?.mode || 'matrix', matrix:saved?.matrix || { tp:40, fp:10, fn:5, tn:45 },
    truth:saved?.truth || '1, 1, 0, 1, 0, 0', prediction:saved?.prediction || '1, 0, 0, 1, 1, 0',
    reference:saved?.reference || presets.generation.partial.reference, candidate:saved?.candidate || presets.generation.partial.candidate,
    probabilities:saved?.probabilities || presets.language.confident.probabilities
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const pct = (value) => value === null ? '无法计算' : `${(value * 100).toFixed(1)}%`;
  const fixed = (value) => value === null ? '无法计算' : value.toFixed(4);
  const parseList = (value) => value.split(/[\s,]+/).filter(Boolean);
  const metricCard = (name, value, formula, meaning) => h('article', { className:'metric-card' }, [h('p', { className:'tool-label', text:name }), h('strong', { text:pct(value) }), h('p', { className:'formula', text:formula }), h('p', { text:meaning })]);
  const tabButton = (id, label) => {
    const tab = button(label, `metric-tab${state.tab === id ? ' is-active' : ''}`, () => { state.tab = id; save(); render(); });
    tab.setAttribute('aria-selected', String(state.tab === id));
    return tab;
  };

  const classification = () => {
    let matrix = { ...state.matrix }; let error = '';
    if (state.mode === 'list') try { matrix = M.calculateConfusionMatrix(parseList(state.truth), parseList(state.prediction)); } catch (issue) { error = issue.message; }
    const result = M.calculateClassification(matrix);
    const numberField = (key, label) => {
      const input = h('input', { type:'number', min:'0', step:'1', value:String(state.matrix[key]), 'aria-label':label });
      input.addEventListener('input', () => { state.matrix[key] = Math.max(0, Number(input.value) || 0); save(); });
      return h('label', { className:'metric-input', text:label }, [input]);
    };
    const matrixInput = h('div', { className:'classification-input' }, [h('div', { className:'inline-controls' }, [
      button('混淆矩阵', `tool-button ${state.mode === 'matrix' ? 'tool-button--primary' : ''}`, () => { state.mode = 'matrix'; save(); render(); }),
      button('预测列表', `tool-button ${state.mode === 'list' ? 'tool-button--primary' : ''}`, () => { state.mode = 'list'; save(); render(); })
    ])]);
    if (state.mode === 'matrix') {
      matrixInput.append(h('div', { className:'matrix-inputs' }, ['tp','fp','fn','tn'].map((key) => numberField(key, key.toUpperCase()))), button('重新计算', 'tool-button tool-button--primary', render));
    } else {
      const truth = h('textarea', { rows:'3', value:state.truth, 'aria-label':'真实标签' });
      const prediction = h('textarea', { rows:'3', value:state.prediction, 'aria-label':'预测标签' });
      truth.addEventListener('input', () => { state.truth = truth.value; save(); });
      prediction.addEventListener('input', () => { state.prediction = prediction.value; save(); });
      matrixInput.append(h('label', { className:'metric-textarea', text:'真实标签 · 0 / 1' }, [truth]), h('label', { className:'metric-textarea', text:'预测标签 · 0 / 1' }, [prediction]), button('从列表计算', 'tool-button tool-button--primary', render));
    }
    const table = h('table', { className:'confusion-table' }, [
      h('caption', { text:'混淆矩阵（Confusion Matrix）' }),
      h('thead', {}, h('tr', {}, [h('th', { text:'' }), h('th', { text:'预测为正类' }), h('th', { text:'预测为负类' })])),
      h('tbody', {}, [h('tr', {}, [h('th', { text:'实际为正类' }), h('td', { text:`TP · ${matrix.tp}` }), h('td', { text:`FN · ${matrix.fn}` })]), h('tr', {}, [h('th', { text:'实际为负类' }), h('td', { text:`FP · ${matrix.fp}` }), h('td', { text:`TN · ${matrix.tn}` })])])
    ]);
    const formulas = h('section', { className:'formula-grid' }, [
      metricCard('准确率（Accuracy）', result.accuracy, `(${matrix.tp} + ${matrix.tn}) / ${result.total || 0}`, '所有样本中预测正确的比例。'),
      metricCard('精确率（Precision）', result.precision, `${matrix.tp} / (${matrix.tp} + ${matrix.fp})`, '预测为正的样本中，多少确实为正。'),
      metricCard('召回率（Recall）', result.recall, `${matrix.tp} / (${matrix.tp} + ${matrix.fn})`, '真实为正的样本中，多少被成功找出。'),
      metricCard('F1 分数', result.f1, '(2 × TP) / (2 × TP + FP + FN)', '精确率（Precision）与召回率（Recall）的调和平均。')
    ]);
    const insight = result.precision === null || result.recall === null ? '当前样例无法计算精确率（Precision）或召回率（Recall）：对应分母为 0。' : Math.abs(result.precision - result.recall) < .08 ? '精确率（Precision）与召回率（Recall）接近，当前误报与漏报的平衡较为一致。' : result.precision > result.recall ? '精确率（Precision）较高、召回率（Recall）较低：正类预测较可信，但仍遗漏了一部分真实正例。' : '召回率（Recall）较高、精确率（Precision）较低：找到了更多真实正例，但也产生了更多误报。';
    const examples = h('div', { className:'example-list' }, Object.values(presets.classification).map((item) => button(item.label, 'tool-button tool-button--quiet', () => { state.mode = 'matrix'; state.matrix = { ...item.values }; save(); render(); })));
    return [h('section', { className:'metric-input-panel' }, [h('p', { className:'tool-label', text:'输入' }), h('h3', { text:'分类结果' }), matrixInput, h('p', { className:'input-help', text:'输入会在浏览器本地计算。计数必须为非负整数。' }), examples]), error ? h('p', { className:'metric-error', text:error }) : null, h('div', { className:'metric-matrix-wrap' }, [table]), h('section', { className:'calculation-panel' }, [h('p', { className:'tool-label', text:'分步计算' }), h('h3', { text:'公式代入' }), formulas]), h('section', { className:'insight-panel' }, [h('p', { className:'tool-label', text:'精确率与召回率' }), h('h3', { text:'如何理解当前结果？' }), h('p', { text:insight })]), h('section', { className:'when-panel' }, [h('p', { className:'tool-label', text:'何时使用该指标？' }), h('p', { text:'准确率（Accuracy）适合类别均衡；精确率（Precision）适合误报成本高；召回率（Recall）适合漏报成本高；F1 用于需要平衡二者的任务。' })])];
  };

  const generation = () => {
    const reference = h('textarea', { rows:'3', value:state.reference, 'aria-label':'参考文本' });
    const candidate = h('textarea', { rows:'3', value:state.candidate, 'aria-label':'生成文本' });
    reference.addEventListener('input', () => { state.reference = reference.value; save(); });
    candidate.addEventListener('input', () => { state.candidate = candidate.value; save(); });
    const bleu = M.calculateBleu(state.candidate, state.reference);
    const body = [h('section', { className:'metric-input-panel generation-input' }, [h('p', { className:'tool-label', text:'教学实现' }), h('h3', { text:'参考文本 / 生成文本' }), h('label', { className:'metric-textarea', text:'参考文本（Reference）' }, [reference]), h('label', { className:'metric-textarea', text:'生成文本（Candidate）' }, [candidate]), button('计算 BLEU / ROUGE', 'tool-button tool-button--primary', render), h('div', { className:'example-list' }, Object.values(presets.generation).map((item) => button(item.label, 'tool-button tool-button--quiet', () => { state.reference = item.reference; state.candidate = item.candidate; save(); render(); }))), h('p', { className:'input-help', text:'使用“转为小写 + 基础标点处理 + 空白切分”的教学 Tokenization；结果可能与 SacreBLEU、NLTK 或官方 ROUGE 实现略有不同。' })])];
    if (bleu.error) return [...body, h('p', { className:'metric-error', text:bleu.error })];
    const rouge1 = M.calculateRougeN(bleu.candidate, bleu.reference, 1), rouge2 = M.calculateRougeN(bleu.candidate, bleu.reference, 2), rougeL = M.calculateRougeL(bleu.candidate, bleu.reference);
    const trace = (part) => h('details', { className:'metric-trace', open:'open' }, [h('summary', { text:`BLEU-${part.n} · 截断精确率 ${fixed(part.precision)}` }), h('p', { text:`生成文本 N-gram：${part.candidateNgrams.join(' | ') || '—'}` }), h('p', { text:`参考文本 N-gram：${part.referenceNgrams.join(' | ') || '—'}` }), h('div', { className:'ngram-scroll' }, [h('table', { className:'ngram-table' }, [h('thead', {}, h('tr', {}, ['N-gram','生成次数','参考最大次数','截断计数'].map((text) => h('th', { text })))), h('tbody', {}, part.trace.map((row) => h('tr', {}, [h('td', { text:row.item }), h('td', { text:String(row.candidateCount) }), h('td', { text:String(row.referenceCount) }), h('td', { text:String(row.clippedCount) })])))])])]);
    body.push(h('section', { className:'calculation-panel' }, [h('p', { className:'tool-label', text:'分步计算' }), h('h3', { text:'BLEU' }), h('p', { text:`词元 · 生成文本 (${bleu.c}) = ${bleu.candidate.join(' · ')} / 参考文本 (${bleu.r}) = ${bleu.reference.join(' · ')}` }), trace(bleu.parts[0]), trace(bleu.parts[1]), h('p', { className:'formula', text:`BP = ${bleu.c > bleu.r ? '1' : `exp(1 − ${bleu.r} / ${bleu.c})`} = ${fixed(bleu.bp)}` }), h('div', { className:'formula-grid' }, [metricCard('BLEU-1', bleu.bleu1, `BP × clipped_P_1 = ${fixed(bleu.bleu1)}`, '一元词重叠，采用截断计数。'), metricCard('BLEU-2', bleu.bleu2, 'BP × exp((log(P_1) + log(P_2)) / 2)', '一元词与二元词的几何平均。')])]), h('section', { className:'calculation-panel' }, [h('p', { className:'tool-label', text:'以召回为导向的重叠' }), h('h3', { text:'ROUGE' }), h('div', { className:'formula-grid' }, [metricCard('ROUGE-1', rouge1.f1, `P = ${pct(rouge1.precision)}；R = ${pct(rouge1.recall)}`, '一元词重叠的 F1。'), metricCard('ROUGE-2', rouge2.f1, `P = ${pct(rouge2.precision)}；R = ${pct(rouge2.recall)}`, '二元词重叠的 F1。'), metricCard('ROUGE-L', rougeL.f1, `LCS_length = ${rougeL.length}`, '最长公共子序列的 F1。')]), h('p', { text:`LCS：${rougeL.sequence.join(' · ') || '没有公共子序列'} · 长度 ${rougeL.length}` })]));
    return body;
  };

  const language = () => {
    const input = h('textarea', { rows:'3', value:state.probabilities, 'aria-label':'词元概率' });
    input.addEventListener('input', () => { state.probabilities = input.value; save(); });
    const probabilities = parseList(state.probabilities).map(Number), result = M.calculatePerplexity(probabilities);
    const panel = h('section', { className:'metric-input-panel' }, [h('p', { className:'tool-label', text:'语言模型' }), h('h3', { text:'词元概率（Token Probability）' }), h('label', { className:'metric-textarea', text:'概率 · 以逗号或空格分隔' }, [input]), button('计算 PPL', 'tool-button tool-button--primary', render), h('div', { className:'example-list' }, Object.values(presets.language).map((item) => button(item.label, 'tool-button tool-button--quiet', () => { state.probabilities = item.probabilities; save(); render(); }))), h('p', { className:'input-help', text:'本页不运行语言模型。请提供每个真实 Token 被模型赋予的概率，且必须满足 0 < p ≤ 1。' })]);
    if (result.error) return [panel, h('p', { className:'metric-error', text:result.error })];
    return [panel, h('section', { className:'calculation-panel' }, [h('p', { className:'tool-label', text:'分步计算' }), h('h3', { text:'困惑度（Perplexity / PPL）' }), h('p', { text:`p(xᵢ)：${probabilities.map((value) => value.toFixed(4)).join(', ')}` }), h('p', { text:`log p(xᵢ)：${result.logs.map((value) => value.toFixed(4)).join(', ')}` }), h('p', { className:'formula', text:`NLL_mean = ${fixed(result.averageNll)}` }), h('p', { className:'formula', text:`PPL = exp(${fixed(result.averageNll)}) = ${fixed(result.ppl)}` }), metricCard('困惑度（PPL）', result.ppl, 'PPL = exp((−1 / N) × Σ log(p(xᵢ)))', '越低通常表示模型对该序列越有把握。')]), h('section', { className:'insight-panel' }, [h('p', { className:'tool-label', text:'结果解读' }), h('p', { text:'PPL 只能在相同分词规则（Tokenization）、词表与数据分布条件下谨慎比较；它不是跨系统的通用可读性评分。' })])];
  };

  const render = () => {
    shell.className = 'experiment-shell experiment-shell--tool'; shell.replaceChildren();
    const tabs = h('div', { className:'metric-tabs', role:'tablist', 'aria-label':'指标分类' }, [tabButton('classification','分类指标'), tabButton('generation','生成指标'), tabButton('language','语言模型')]);
    const content = state.tab === 'classification' ? classification() : state.tab === 'generation' ? generation() : language();
    shell.append(tabs, ...content.filter(Boolean));
  };
  render();
})();
