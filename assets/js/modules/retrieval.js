(() => {
  const shell = document.querySelector('[data-experiment="retrieval"]');
  const data = window.NLPToolboxData?.retrieval;
  const math = window.NLPToolboxRetrieval;
  if (!shell || !data || !math) return;

  const steps = [['文档','知识库中的每篇文档都可以被查看、添加或移除。'],['分块','文档会被切为可独立评分的分块，并保留来源信息。'],['索引','系统为每个分块建立词频、DF、IDF 与倒排索引。'],['查询','查询使用与分块相同的轻量规则词元化。'],['打分','TF-IDF 使用余弦相似度；BM25 结合词频饱和和长度归一化。'],['排序','分数降序排列；同分时按文档 ID 与分块索引稳定排序。'],['Top-k','Top-k 只保留排名最高的分块进入上下文，不是采样的 Top-k。'],['上下文','上下文按检索排名拼接，并保留来源标签。'],['证据','从已检索上下文中按查询词重叠选取证据句。'],['回答','回答预览仅拼接证据句，不运行或模拟 LLM。']];
  const el = (tag, props = {}, children = []) => { const node = document.createElement(tag); Object.entries(props).forEach(([key, value]) => { if (key === 'className') node.className = value; else if (key === 'text') node.textContent = value; else if (key === 'value') node.value = value; else if (key === 'checked') node.checked = value; else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value); else node.setAttribute(key, value); }); (Array.isArray(children) ? children : [children]).flat(Infinity).filter(Boolean).forEach((child) => node.append(child)); return node; };
  const button = (text, className, onClick, extra = {}) => el('button', { type:'button', className, text, onClick, ...extra });
  const table = (headers, rows, className = '') => el('div', { className:`retrieval-table-wrap ${className}` }, el('table', { className:'retrieval-table' }, [el('thead', {}, el('tr', {}, headers.map((header) => el('th', { text:header })))), el('tbody', {}, rows)]));
  const f = (value) => Number.isFinite(value) ? Number(value).toFixed(3) : '0.000';
  const cloneDocs = (documents) => documents.map((document) => ({ ...document }));
  const state = { documents:cloneDocs(data.documents), config:{ strategy:'fixed', chunkSize:30, overlap:5, stopWords:true }, query:'Why does Transformer need positional encoding?', method:'bm25', topK:3, k1:1.2, b:.75, activeDocumentId:data.documents[0].id, activeChunkId:null, selectedResultId:null, activeStep:0, indexTerm:'', pendingTitle:'', pendingContent:'', retrieval:null, outdated:true, notice:'结果已过期 · 修改数据或参数后请重新检索。' };
  const model = () => { const chunks = math.buildChunks(state.documents, state.config); return { chunks, index:math.buildIndex(chunks) }; };
  const invalidate = (message = '结果已过期 · 修改数据或参数后请重新检索。') => { state.retrieval = null; state.selectedResultId = null; state.outdated = true; state.notice = message; };
  const trimDocuments = () => { const total = state.documents.reduce((sum, document) => sum + document.content.length, 0); return state.documents.length <= 20 && total <= 50000; };
  const run = () => {
    const current = model();
    if (!state.documents.length) { invalidate('请先添加至少一个文档。'); render(); return; }
    if (!state.query.trim()) { invalidate('请输入检索查询。'); render(); return; }
    if (!current.chunks.length) { invalidate('当前分块配置没有生成分块。'); render(); return; }
    state.retrieval = math.retrieve(state.query, current.index, { method:state.method, k1:state.k1, b:state.b, stopWords:state.config.stopWords }); state.outdated = false;
    state.notice = state.retrieval.noRetrievableTerms ? '没有可检索的查询词 · 当前查询没有进入索引的有效词。' : '索引已就绪 · 检索结果反映当前知识库与配置。';
    state.selectedResultId = state.retrieval.results[0]?.chunk.id || null; render();
  };
  const loadCase = (caseData) => { state.query = caseData.query; state.config.strategy = caseData.strategy; state.config.chunkSize = caseData.chunkSize; state.config.overlap = caseData.overlap; state.topK = caseData.topK; if (caseData.documents) { state.documents = cloneDocs(caseData.documents); state.activeDocumentId = state.documents[0]?.id || null; } invalidate('案例已加载 · 请执行检索，观察结果变化。'); render(); };
  const highlighted = (text, terms, markClass = '') => { const holder = document.createDocumentFragment(); const set = new Set(terms); String(text).split(/(\s+)/).forEach((part) => { const key = math.normalizeText(part).trim(); if (key && set.has(key)) holder.append(el('mark', { className:markClass, text:part })); else holder.append(document.createTextNode(part)); }); return holder; };
  const chunkLabel = (chunk) => `${chunk.documentTitle} / 分块 ${String(chunk.chunkIndex).padStart(2,'0')}`;
  const emptyRow = (count, text) => el('tr', {}, el('td', { colspan:String(count), className:'retrieval-empty', text }));

  const render = () => {
    const current = model(); const { chunks, index } = current; const activeDocument = state.documents.find((document) => document.id === state.activeDocumentId) || state.documents[0]; const activeChunk = chunks.find((chunk) => chunk.id === state.activeChunkId); const retrieval = state.retrieval; const queryInfo = math.tokenizeForRetrieval(state.query, { stopWords:state.config.stopWords }); const topResults = retrieval ? math.selectTopK(retrieval.results, state.topK) : []; const context = math.assembleContext(topResults); const evidence = retrieval && !retrieval.noRetrievableTerms ? math.rankEvidence(context, retrieval.available, { stopWords:state.config.stopWords }) : []; const answer = math.buildExtractiveAnswer(evidence); const selectedResult = retrieval?.results.find((result) => result.chunk.id === state.selectedResultId) || retrieval?.results[0]; const comparison = retrieval && !retrieval.noRetrievableTerms ? ['tfidf','bm25'].map((method) => ({ method, results:math.retrieve(state.query, index, { method, k1:state.k1, b:state.b, stopWords:state.config.stopWords }).results.slice(0,3) })) : [];
    if (!state.indexTerm || !index.df.has(state.indexTerm)) state.indexTerm = index.vocabulary[0] || '';
    shell.className = 'experiment-shell experiment-shell--tool retrieval-lab'; shell.replaceChildren();

    const docRows = state.documents.map((document, indexValue) => { const words = math.tokenizeForRetrieval(document.content, { stopWords:false }).all.length; return el('li', { className:document.id === activeDocument?.id ? 'is-active' : '' }, [button(`${String(indexValue + 1).padStart(2,'0')} ${document.title}`, 'retrieval-document-button', () => { state.activeDocumentId = document.id; render(); }, { 'aria-pressed':document.id === activeDocument?.id ? 'true' : 'false' }), el('span', { text:`${document.content.length} 个字符 · ${words} 个词` }), button('移除', 'retrieval-remove', () => { state.documents = state.documents.filter((item) => item.id !== document.id); state.activeDocumentId = state.documents[0]?.id || null; invalidate('知识库已修改 · 索引已重建，检索结果已清空。'); render(); }, { 'aria-label':`移除文档 ${document.title}` })]); });
    const titleInput = el('input', { type:'text', value:state.pendingTitle, maxlength:'80', 'aria-label':'新文档标题' }); titleInput.addEventListener('input', () => { state.pendingTitle = titleInput.value; });
    const contentInput = el('textarea', { rows:'4', value:state.pendingContent, maxlength:'10000', 'aria-label':'新文档内容' }); contentInput.addEventListener('input', () => { state.pendingContent = contentInput.value; });
    const addDocument = () => { const title = state.pendingTitle.trim(); const content = state.pendingContent.trim(); if (!title || !content) { state.notice = '请填写文档标题和内容。'; render(); return; } const candidate = [...state.documents, { id:`custom-${Date.now()}`, title, content }]; if (candidate.length > 20 || candidate.reduce((sum, document) => sum + document.content.length, 0) > 50000) { state.notice = '当前教学实验最多保留 20 个文档或 50,000 个字符。'; render(); return; } state.documents = candidate; state.activeDocumentId = candidate.at(-1).id; state.pendingTitle = ''; state.pendingContent = ''; invalidate('文档已添加 · 索引已重建，检索结果已清空。'); render(); };
    const knowledge = el('section', { className:'retrieval-grid retrieval-grid--top' }, [
      el('article', { className:'retrieval-panel' }, [
        el('p', { className:'tool-label', text:'A · 知识库' }),
        el('ul', { className:'retrieval-documents', 'aria-label':'知识库文档' }, docRows.length ? docRows : el('li', { className:'retrieval-empty', text:'暂无文档。请添加文档以建立索引。' })),
        el('div', { className:'retrieval-add-document' }, [
          el('label', { className:'retrieval-field', text:'文档标题' }, titleInput),
          el('label', { className:'retrieval-field', text:'文档内容' }, contentInput),
          button('添加文档', 'tool-button tool-button--primary', addDocument),
          button('重置知识库', 'tool-button tool-button--quiet', () => { state.documents = cloneDocs(data.documents); state.activeDocumentId = state.documents[0].id; invalidate('知识库已重置 · 索引已重建，检索结果已清空。'); render(); })
        ])
      ]),
      el('article', { className:'retrieval-panel' }, [
        el('p', { className:'tool-label', text:'文档预览' }),
        activeDocument ? [el('h3', { text:activeDocument.title }), el('p', { className:'retrieval-preview', text:activeDocument.content })] : el('p', { className:'input-help', text:'请选择或添加一篇文档查看其内容。' })
      ])
    ]);

    const strategy = el('select', { 'aria-label':'分块策略' }, [el('option', { value:'fixed', text:'固定词数分块' }), el('option', { value:'sentence', text:'按句分块' })]); strategy.value = state.config.strategy; strategy.addEventListener('change', () => { state.config.strategy = strategy.value; state.config.chunkSize = strategy.value === 'sentence' ? 1 : 30; state.config.overlap = 0; invalidate('分块方式已修改 · 分块与索引已重建，结果已清空。'); render(); });
    const size = el('input', { type:'number', min:'1', max:state.config.strategy === 'sentence' ? '2' : '100', value:state.config.chunkSize, 'aria-label':'分块大小' }); size.addEventListener('change', () => { state.config.chunkSize = Math.max(1, Math.min(state.config.strategy === 'sentence' ? 2 : 100, Number(size.value) || 1)); state.config.overlap = Math.min(state.config.overlap, state.config.chunkSize - 1); invalidate('分块大小已修改 · 分块与索引已重建，结果已清空。'); render(); });
    const overlap = el('input', { type:'number', min:'0', max:String(Math.max(0,state.config.chunkSize - 1)), value:state.config.overlap, 'aria-label':'分块重叠' }); overlap.addEventListener('change', () => { state.config.overlap = Math.max(0, Math.min(state.config.chunkSize - 1, Number(overlap.value) || 0)); invalidate('重叠设置已修改 · 分块与索引已重建，结果已清空。'); render(); });
    const chunksRows = chunks.map((chunk) => el('article', { className:`retrieval-chunk${chunk.id === activeChunk?.id ? ' is-active' : ''}` }, [button(`${chunkLabel(chunk)}`, 'retrieval-chunk-title', () => { state.activeChunkId = chunk.id; render(); }, { 'aria-pressed':chunk.id === activeChunk?.id ? 'true' : 'false' }), el('div', { className:'retrieval-chunk-text' }, highlighted(chunk.text, chunk.overlapTokens, 'retrieval-overlap-token')), chunk.overlapTokens.length ? el('p', { className:'retrieval-overlap', text:`重叠内容：${chunk.overlapTokens.join(' · ')}` }) : null]));
    const chunking = el('section', { className:'retrieval-panel' }, [
      el('p', { className:'tool-label', text:'B · 文档分块实验' }),
      el('div', { className:'retrieval-config-row retrieval-config-row--chunking' }, [
        el('label', { className:'select-label', text:'分块策略' }, strategy),
        el('label', { className:'select-label', text:state.config.strategy === 'sentence' ? '每块句数' : '每块词数' }, size),
        el('label', { className:'select-label', text:state.config.strategy === 'sentence' ? '句子重叠' : '重叠词数' }, overlap)
      ]),
      el('div', { className:'retrieval-chunk-stats' }, [['文档数',state.documents.length],['分块数',chunks.length],['平均长度',chunks.length ? f(chunks.reduce((sum, chunk) => sum + chunk.tokens.length,0) / chunks.length) : '0'],['重叠数',state.config.overlap]].map(([label,value]) => el('span', { text:`${label} ${value}` }))),
      el('p', { className:'input-help', text:'较小的分块通常更聚焦；较大的分块保留更多上下文。重叠可以保留边界信息，但也会带来重复内容。' }),
      el('div', { className:'retrieval-chunks' }, chunksRows.length ? chunksRows : el('p', { className:'retrieval-empty', text:'尚未生成分块。请添加文档或修改分块设置。' }))
    ]);

    const query = el('textarea', { rows:'2', value:state.query, 'aria-label':'检索查询' }); query.addEventListener('input', () => { state.query = query.value; }); query.addEventListener('change', () => { invalidate('查询已修改 · 索引会复用，请重新检索以计算新查询。'); render(); });
    const method = el('select', { 'aria-label':'检索方法' }, [el('option', { value:'tfidf', text:'TF-IDF + 余弦相似度' }), el('option', { value:'bm25', text:'BM25' })]); method.value = state.method; method.addEventListener('change', () => { state.method = method.value; invalidate('检索方法已修改 · 索引会复用，请重新检索。'); render(); });
    const stopWords = el('input', { type:'checkbox', 'aria-label':'停用词过滤' }); stopWords.checked = state.config.stopWords; stopWords.addEventListener('change', () => { state.config.stopWords = stopWords.checked; invalidate('停用词过滤已修改 · 索引已重建，结果已清空。'); render(); });
    const topK = el('select', { 'aria-label':'返回的前 k 个分块' }, [1,2,3,5].map((value) => el('option', { value:String(value), text:`前 k = ${value}` }))); topK.value = String(state.topK); topK.addEventListener('change', () => { state.topK = Number(topK.value); invalidate('Top-k 已修改 · 请重新检索以更新上下文。'); render(); });
    const k1 = el('input', { type:'number', min:'.5', max:'2.5', step:'.1', value:state.k1, 'aria-label':'BM25 k1' }); k1.addEventListener('change', () => { state.k1 = Math.max(.5,Math.min(2.5,Number(k1.value)||1.2)); invalidate('BM25 k1 已修改 · 请重新检索。'); render(); });
    const b = el('input', { type:'number', min:'0', max:'1', step:'.05', value:state.b, 'aria-label':'BM25 b' }); b.addEventListener('change', () => { state.b = Math.max(0,Math.min(1,Number(b.value)||0)); invalidate('BM25 b 已修改 · 请重新检索。'); render(); });
    const queryPanel = el('section', { className:'retrieval-grid retrieval-grid--query' }, [el('article', { className:'retrieval-panel' }, [el('p', { className:'tool-label', text:'D · 查询与检索' }), el('label', { className:'retrieval-field', text:'查询' }, query), el('div', { className:'example-list' }, data.queries.map((value) => button(value, 'tool-button tool-button--quiet', () => { state.query = value; invalidate('查询已修改 · 请重新检索以计算分数。'); render(); }))), el('div', { className:'retrieval-config-row retrieval-config-row--query' }, [el('label', { className:'select-label', text:'检索方法' }, method), el('label', { className:'select-label retrieval-checkbox-label', text:'停用词过滤' }, stopWords), el('label', { className:'select-label', text:'上下文大小' }, topK), ...(state.method === 'bm25' ? [el('label', { className:'select-label', text:'BM25 k1' }, k1),el('label', { className:'select-label', text:'BM25 b' }, b)] : [])]), button('开始检索', 'tool-button tool-button--primary', run), el('p', { className:state.outdated ? 'retrieval-status is-outdated' : 'retrieval-status', text:state.notice })]), el('article', { className:'retrieval-panel' }, [el('p', { className:'tool-label', text:'查询查看器' }), el('p', { className:'input-help', text:'词元化会转小写、移除标点并按空白切分。中文会回退为逐字处理，并非生产级中文分词。' }), el('div', { className:'retrieval-token-row' }, [el('strong', { text:'查询词元' }), ...queryInfo.tokens.map((token) => el('span', { text:token }))]), queryInfo.removed.length ? el('div', { className:'retrieval-token-row is-muted' }, [el('strong', { text:'已移除的停用词' }), ...queryInfo.removed.map((token) => el('span', { text:token }))]) : null])]);

    const termOptions = el('select', { 'aria-label':'索引词查看器' }, index.vocabulary.map((term) => el('option', { value:term, text:term }))); termOptions.value = state.indexTerm; termOptions.addEventListener('change', () => { state.indexTerm = termOptions.value; render(); }); const postings = state.indexTerm ? [...(index.inverted.get(state.indexTerm) || [])].map((id) => chunks.find((chunk) => chunk.id === id)).filter(Boolean) : [];
    const indexRows = index.vocabulary.slice(0,40).map((term) => el('tr', {}, [el('td', { text:term }), el('td', { text:String(index.df.get(term)) }), el('td', { text:f(index.idf.get(term)) })]));
    const indexPanel = el('section', { className:'retrieval-grid retrieval-grid--index' }, [el('article', { className:'retrieval-panel' }, [el('p', { className:'tool-label', text:'C · 索引查看器 / 索引已就绪' }), table(['词项','DF','平滑 IDF'], indexRows.length ? indexRows : [emptyRow(3,'暂无索引词项。')])]), el('article', { className:'retrieval-panel' }, [el('p', { className:'tool-label', text:'倒排索引' }), el('label', { className:'select-label', text:'词项' }, termOptions), el('p', { className:'input-help', text:state.indexTerm ? `${state.indexTerm} → ${postings.length} 个分块条目` : '暂无可用词项。' }), el('ul', { className:'retrieval-postings' }, postings.map((chunk) => el('li', {}, button(chunkLabel(chunk), 'retrieval-link-button', () => { state.activeChunkId = chunk.id; render(); }))) )])]);

    const resultRows = retrieval && !retrieval.noRetrievableTerms ? retrieval.results.map((result) => { const width = retrieval.results[0]?.score ? Math.max(0,(result.score / retrieval.results[0].score) * 100) : 0; return el('article', { className:`retrieval-result${result.chunk.id === selectedResult?.chunk.id ? ' is-selected' : ''}` }, [el('div', { className:'retrieval-result-head' }, [button(`排名 ${result.rank} · ${chunkLabel(result.chunk)}`, 'retrieval-result-title', () => { state.selectedResultId = result.chunk.id; state.activeChunkId = result.chunk.id; render(); }, { 'aria-pressed':result.chunk.id === selectedResult?.chunk.id ? 'true' : 'false' }), el('strong', { text:f(result.score) })]), el('div', { className:'retrieval-score-bar' }, el('span', { style:`--score:${width}%` })), el('p', { className:'retrieval-match', text:result.matchedTerms.length ? `匹配词：${result.matchedTerms.join(' · ')}` : '没有匹配词' }), el('p', { className:'retrieval-snippet' }, highlighted(result.chunk.text, result.matchedTerms))]); }) : el('p', { className:'retrieval-empty', text:retrieval?.noRetrievableTerms ? '没有可检索的查询词 · 当前查询不含可进入索引的有效词。' : '请点击“开始检索”，计算分数、排名和上下文。' });
    const inspectorRows = selectedResult ? selectedResult.contributions.map((item) => el('tr', {}, state.method === 'tfidf' ? [el('td',{text:item.term}),el('td',{text:f(item.queryWeight)}),el('td',{text:f(item.chunkWeight)}),el('td',{text:f(item.tfidf)})] : [el('td',{text:item.term}),el('td',{text:String(item.tf)}),el('td',{text:String(item.df)}),el('td',{text:f(item.idf)}),el('td',{text:f(item.norm)}),el('td',{text:f(item.bm25)})])) : [];
    const resultsPanel = el('section', { className:'retrieval-grid retrieval-grid--results' }, [
      el('article', { className:'retrieval-panel' }, [
        el('p', { className:'tool-label', text:`E · 检索结果 / ${state.method.toUpperCase()}` }),
        state.method === 'bm25' ? el('p',{className:'input-help',text:'BM25 条形仅相对最高结果进行归一化；显示数值仍为原始 BM25 分数。'}) : null,
        el('div', { className:'retrieval-results' }, resultRows)
      ]),
      el('article', { className:'retrieval-panel' }, [
        el('p', { className:'tool-label', text:'分数查看器' }),
        selectedResult ? [
          el('p', { className:'retrieval-inspector-title', text:`${chunkLabel(selectedResult.chunk)} · 分数 ${f(selectedResult.score)}` }),
          table(state.method === 'tfidf' ? ['词项','查询 TF-IDF','分块 TF-IDF','点积贡献'] : ['词项','TF','DF','IDF','长度归一化','贡献'], inspectorRows.length ? inspectorRows : [emptyRow(state.method === 'tfidf' ? 4 : 6,'暂无匹配词。')]),
          el('p', { className:'input-help', text:state.method === 'tfidf' ? '余弦分数使用查询与分块的范数；匹配词解释了点积贡献。' : `k1=${state.k1}, b=${state.b}, avgdl=${f(index.avgLength)}。BM25 会让词频饱和，并按分块长度进行调整。` })
        ] : el('p', { className:'input-help', text:'检索后请选择一个已排序分块，查看各词项的分数贡献。' })
      ])
    ]);

    const contextBlocks = context.length ? context.map((item) => el('article', { className:'retrieval-context-block' }, [
      button(item.source, 'retrieval-source-button', () => { state.activeChunkId = item.chunk.id; state.selectedResultId = item.chunk.id; render(); }),
      el('span', { text:`分数 ${f(item.score)}` }),
      el('p', {}, highlighted(item.chunk.text, item.matchedTerms))
    ])) : el('p', { className:'retrieval-empty', text:'尚未有已排序的证据进入上下文。' });
    const sourceList = context.length ? el('ul', { className:'retrieval-sources' }, context.map((item) => el('li', {}, button(item.source, 'retrieval-link-button', () => { state.activeChunkId = item.chunk.id; state.selectedResultId = item.chunk.id; render(); })))) : null;
    const rag = el('section', { className:'retrieval-grid retrieval-grid--rag' }, [
      el('article', { className:'retrieval-panel' }, [
        el('p', { className:'tool-label', text:'F · 上下文组装' }),
        el('p', { className:'input-help', text:'这里的 Top-k 用于检索排名，不是下一词元采样中的 Top-k。上下文会按排名顺序组装。' }),
        el('div', { className:'retrieval-context' }, contextBlocks)
      ]),
      el('article', { className:'retrieval-panel retrieval-answer' }, [
        el('p', { className:'tool-label', text:'证据 → 抽取式教学回答预览' }),
        evidence.length ? [
          el('ol', { className:'retrieval-evidence' }, evidence.map((item) => el('li', {}, [el('p', { text:item.sentence }), el('span', { text:item.source })]))),
          el('p', { className:'retrieval-answer-preview', text:answer }),
          el('p', { className:'input-help', text:'回答预览会拼接排名靠前的证据句；它不是 LLM 生成、推理，也不保证事实正确。' }),
          sourceList
        ] : el('p', { className:'retrieval-empty', text:retrieval && !retrieval.noRetrievableTerms ? '未找到相关证据 · 已检索分块中没有与查询词重叠的证据句。' : '执行检索后即可组装证据并生成回答预览。' })
      ])
    ]);

    const compare = el('section', { className:'retrieval-grid retrieval-grid--compare' }, [
      el('article', { className:'retrieval-panel' }, [
        el('p', { className:'tool-label', text:'检索方法对比' }),
        comparison.length ? el('div', { className:'retrieval-compare' }, comparison.map((item) => el('div', {}, [
          el('h3', { text:item.method === 'tfidf' ? 'TF-IDF + 余弦相似度' : 'BM25' }),
          el('ol', {}, item.results.map((result) => el('li', { text:`${chunkLabel(result.chunk)} · ${f(result.score)}` })))
        ]))) : el('p', { className:'retrieval-empty', text:'执行检索后，可在同一查询下比较 TF-IDF 与 BM25。' })
      ]),
      el('article', { className:'retrieval-panel' }, [
        el('p', { className:'tool-label', text:'常见失败案例' }),
        el('div', { className:'retrieval-case-list' }, Object.entries(data.failureCases).map(([name, caseData]) => button(({ 'CHUNK TOO SMALL':'分块过小', 'CHUNK TOO LARGE':'分块过大', 'VOCABULARY MISMATCH':'词表不匹配', 'TOP-K TOO LOW':'Top-k 过低', 'BOUNDARY OVERLAP':'边界重叠' })[name] || name, 'tool-button tool-button--quiet', () => loadCase(caseData)))),
        el('p', { className:'input-help', text:'分块大小、重叠、词法词表不匹配与 Top-k 都会改变证据覆盖范围。稠密检索或许能缓解语义不匹配，但本实验刻意不模拟它。' })
      ])
    ]);
    const contextNote = el('section', { className:'retrieval-context-note' }, [
      el('p',{className:'tool-label',text:'RAG 流程位置'}),
      el('div',{className:'retrieval-flow'},['文档','分块','检索','上下文','LLM','回答'].map((label) => el('span',{className:['分块','检索','上下文'].includes(label) ? 'is-active' : label === 'LLM' ? 'is-muted' : '',text:label}))),
      el('p',{text:'RAG 不只有检索：完整系统还会构建上下文并调用生成模型。检索分数不代表事实真相，排名第 1 也不一定就是正确答案。'}),
      el('p',{className:'input-help',text:'本实验使用内存索引上的稀疏词法检索（TF-IDF / BM25）。未实现稠密向量、向量数据库、重排序、混合检索或真实 LLM 生成。'})
    ]);
    const stepNav = el('section',{className:'retrieval-step-area'},[
      el('div',{className:'retrieval-step-nav','aria-label':'检索学习步骤'},steps.map(([label],indexValue) => button(`${String(indexValue+1).padStart(2,'0')} ${label}`,`retrieval-step${state.activeStep===indexValue?' is-active':''}`,() => { state.activeStep=indexValue; render(); },state.activeStep===indexValue ? {'aria-current':'step'} : {}))),
      el('div',{className:'retrieval-explanation'},[el('p',{className:'tool-label',text:'当前发生什么？'}),el('p',{text:steps[state.activeStep][1]})])
    ]);
    shell.append(knowledge, stepNav, chunking, indexPanel, queryPanel, resultsPanel, rag, compare, contextNote);
  };
  render();
})();
