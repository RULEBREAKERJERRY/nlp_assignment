# 实现记录

## 项目

- Project: NLP 百宝箱
- Design Reference: Massively
- Source: https://html5up.net/massively
- Author: HTML5 UP
- License: Creative Commons Attribution 3.0

## 设计提炼

本实现借鉴 Massively 的信息架构与排版方法：深色 Intro Hero、独立品牌 Header、横向导航、中央内容容器、Featured 内容、文章式模块网格、清晰的 section 分隔与深色 Footer。没有复制其 Demo 文案、示例图片或文章内容。

## 第一阶段范围

- 首页已提供学习路径与 9 个模块入口。
- 每个模块都有统一的 Generic Experiment Layout，预留 `data-experiment` DOM 节点。
- JavaScript 仅负责移动端菜单和首页锚点导航状态。

## 第二阶段第一部分

- 01 术语闯关使用独立题库、三层配对、错误诊断、错题本和 `nlp-toolbox.terminology.*` 本地记录。
- 02 文本预处理使用独立 Pipeline Engine，逐步传递 `text`、`tokens`、`ngrams` 状态，并记录可展开的 Step Trace。
- 中文 Tokenization 与 Lemmatization 均明确标记为教学用途的轻量规则模拟。

## 第二阶段第二部分

- 03 指标计算器将公式计算与 UI 分离，包含分类指标、BLEU / ROUGE 和基于用户概率输入的 PPL。
- 04 分层自测使用 42 道独立题目，提供随机抽题、逐题解析、错题本、历史记录与基于真实答题数据的学习报告。
- 03 与 04 均使用 `nlp-toolbox.metrics.*`、`nlp-toolbox.quiz.*` 命名空间保存本地状态。

## 第二阶段第三部分

- 05 Text-CNN 使用确定性的 4 维本地词向量、3 个小型卷积核和三分类教学参数，真实计算卷积、ReLU、max-over-time pooling、线性层与稳定 Softmax。
- 06 Attention 使用同一小型词表与固定 `Wq` / `Wk` / `Wv`，真实计算 Dot Product 或 Scaled Dot Product、Softmax、Causal Mask 和 Context Vector。
- 两页都将未知 Token 映射到确定性的 `<UNK>`，并在页面中说明这不是经过真实语料训练的生产级模型。

## 第二阶段第四部分

- 07 Loss 实验室包含 Cross-Entropy Explorer、Logistic Regression 梯度下降和二次函数 Learning Rate Lab。
- 所有曲线均由当前参数、解析梯度与逐步更新计算生成；没有预制或随机训练轨迹。
- Cross Entropy 概率会以 `1e-12` 裁剪，Sigmoid 使用稳定分支实现；非有限数值会停止当前训练更新。

## 第二阶段第五部分

- 08 Transformer 以 `d_model=4`、最多 6 Token、1 个完整 Block 模拟 Embedding、正弦位置编码、1/2 Head Self-Attention、Residual、LayerNorm 与 ReLU FFN。
- Mask 在 row-wise Softmax 之前写入 `-Infinity`；被屏蔽的权重在 UI 中标记为 `MASK`，其余可见权重重新归一化。
- 所有 Embedding、投影矩阵和 FFN 参数均为确定性教学参数，不表示真实预训练权重。

## 第二阶段第六部分

- 09 LLM Sampling 使用有限词级词表和确定性上下文 logits generator，真实运行 repetition penalty、temperature、Softmax、Top-k、Top-p、renormalization 与 categorical sampling。
- 随机性由本地 `mulberry32` seeded PRNG 提供；相同 Prompt、参数和 Seed 可复现同一 Token 序列。
- 页面明确区分教学采样器的分布特性与真实 LLM 的文本质量，不调用任何外部模型或 API。

## 扩展阶段第一部分

- 首页在 03 / ENGINEERING 与 About 之间新增了 04 / EXTENSIONS（拓展探索），并在 Learning Path 和一级导航中加入 04 / EXPLORE。
- 新增 10 BPE 子词切分实验室、11 信息检索与 RAG 实验室、12 Beam Search 解码实验室三个统一版式页面；三页仅包含流程预览、学习目标、核心概念、关联模块和实验占位区。
- 模块路标现连续连接 09 LLM Sampling → 10 BPE 子词切分 → 11 信息检索与 RAG → 12 Beam Search；10–12 的返回链接均指向首页的 `#extensions` 区域。
- 此时 10–12 均为页面骨架；尚未加入 BM25、向量检索、RAG、Beam Search、搜索树或任何模型调用脚本。

## 扩展阶段第二部分

- 10 BPE 子词切分实验室现在真实执行 Character-level Educational BPE：语料规范化、词频统计、带 `</w>` 的字符初始化、频率加权 Pair Counting、确定性 Tie Breaking 与全语料 Merge。
- 每一步保存完整快照，支持 Previous、单步 Merge、Auto Train、Pause 与 Reset；Merge History 保留 Pair、当时频次和新 Symbol，Vocabulary 以初始符号加有序 Merge Rule 的结果演化。Pair Inspector 显示每个 Pair 的逐词频率贡献。
- 新词 Tokenization 从字符和 `</w>` 开始，支持 Previous Rule、Next Rule、Apply All、Reset Rules；每条被检查的规则均显示，未匹配时明确标注 `NO MATCH`。未出现在基础字符表中的字符会保留并标注 `UNSEEN SYMBOL`。
- 训练可选择 Lowercase ON/OFF；更改 Corpus 或大小写配置会重置训练状态，避免把旧 Merge Rule 带入新语料。
- 这是浏览器本地的教学实现，不是 GPT 或 Hugging Face 的生产级 Byte-level BPE；11 Retrieval / RAG 与 12 Beam Search 当时仍保持骨架。

## 扩展阶段第三部分

- 11 信息检索与 RAG 实验室实现了本地可编辑知识库、固定词数与 1–2 句两种真实 Chunking、带来源元数据的 Chunk 预览，以及自动重建的词表、DF、平滑 IDF 与倒排索引。
- Retrieval 分别真实计算 TF-IDF 向量的 Cosine Similarity 与可调 `k1` / `b` 的 BM25；结果按 Score 降序、Document ID、Chunk Index 稳定排序，并可查看词项对分数的贡献。
- Top-k Chunk 会严格按检索名次组装 Context；随后仅按 Query 与句子的词项重叠提取可追溯证据句，生成 Answer Preview。该预览不调用或模拟 LLM，零可检索词时不会产生答案。
- 界面包含 Query / 索引检查器、TF-IDF 与 BM25 对比、失败案例、步骤路标及 RAG 局限说明。它是浏览器内存中的稀疏词法检索教学实现，不包含 Dense Embedding、向量数据库、混合检索、重排序或真实生成模型。
- 12 Beam Search 当时仍保持页面骨架；01–10、首页、路标和扩展入口未因该模块更改。

## 扩展阶段第四部分

- 12 Beam Search 解码实验室以 09 的有限教学词表与确定性上下文 logits generator 为基础，真实执行稳定 Softmax、累积 log probability、全局候选排序与 Beam Width 剪枝；相同 Prompt 与参数会得到相同搜索结果。
- 每轮将所有 Active Beam 的候选合并后全局排序，而不是按父路径分别保留；候选同时显示 Token Probability、Token Log Probability、Raw Log Score、GNMT 风格 Length Penalty 与 Ranking Score。
- 页面保留 Active Beams、Pruned Paths、Finished Hypotheses 与带 parentId 的搜索树快照，支持单步、回退、自动解码、暂停和重置。`<EOS>` 生成后会进入 Finished Hypotheses，达到最大生成长度的活跃路径会以 Truncated Hypothesis 收束。
- Length Penalty 使用 `((5 + generatedLength) / 6)^α`，生成长度不包括 Prompt 与 `<EOS>`；提供 Greedy Trap、Length Bias、Early EOS 等确定性教学案例，说明 Beam Width = 1 等价于 Greedy Search，以及有限 Beam 不是穷举搜索。
- 该模块的模型分布仅用于解释解码策略，不是 GPT、真实 Transformer 或任何在线模型；11 Retrieval / RAG、01–10、首页与既有路标的功能代码未改动。

## 决策智能入口

- 首页在 04 / EXTENSIONS 之后新增了 05 / DECISION INTELLIGENCE（决策智能），并将 Learning Path 扩展为五层；一级导航增加“决策智能”入口。
- 新增 13 Jev · AI Decision Lab 的宽幅 Featured Card 与 `pages/jev-decision.html` 统一页面骨架，定位为从开放文本生成走向 Choice、Score、Noul、Confidence 与 Decision Workflow 的结构化判断。
- 13 已接入本地、确定性的结构化决策教学仿真：Choice、Score、Noul、Confidence 与 Policy 工作流均可观察和修改；同时提供 API Contract 样例、任务路由自测及可保存到浏览器 localStorage 的 Decision Builder。该模块不会调用真实 Jev 服务、发送网络请求或保存 API Key。公共模块路标将 12 Beam Search 与 13 连接，且 13 的返回链接指向首页 `#decision-intelligence`。

## 后续接入点

其余模块仍可在 `.experiment-shell[data-experiment]` 内接入，并复用 `experiment.css` 的实验面板样式。

## Attribution

首页和各模块页 Footer 均包含：`Design adapted from Massively by HTML5 UP.`，并链接至 HTML5 UP 与 CC BY 3.0 许可页面。
