# NLP 百宝箱｜实现记录

本文按当前页面而非开发时间线组织。项目共 13 个模块，入口在 [首页](../index.html)，使用 HTML5、CSS3 与原生 JavaScript。小词表、固定矩阵及教学分布用于解释机制，不代表训练好的生产模型。课程报告与测试证据另见 [实验报告](../NLP百宝箱_实验报告.md)。

## 共用页面与文件层次

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 页面 | `index.html`、`pages/*.html` | 首页五区入口、13 个模块页；03～13 有相邻路标，01、02 当前只有返回入口。 |
| 全局样式 | `assets/css/main.css`、`responsive.css` | 深色 Hero、品牌、导航、内容宽度、断点。 |
| 实验样式 | `assets/css/experiment.css`、模块 CSS | 共享实验容器与各模块的表格、矩阵、轨迹、图形。 |
| 导航脚本 | `assets/js/main.js` | 移动菜单和首页导航状态。 |
| 教学数据 | `assets/js/data/*.js` | 术语、自测题库及模块预设。 |
| 模块与算法 | `assets/js/modules/*.js` | DOM 交互；可独立验证的纯计算文件使用 `*-algorithms.js`。 |

外层借鉴 [Massively](https://html5up.net/massively) 的 Intro Hero、品牌 Header、横向导航、Featured 内容、文章式卡片和浅色中央容器；内层保持细边框、低阴影的科学实验界面。没有直接复制模板的演示图片或文案。首页与模块页 Footer 均保留 `Design adapted from Massively by HTML5 UP.`，对应 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) 许可。当前仓库不包含独立的 `html5up-massively/` 源码目录，运行页也未依赖其演示脚本。

每页将模块内容置于 `.experiment-shell[data-experiment]`，并复用公共实验样式。13 页都有“返回模块列表”；03～13 使用 `.module-links` 相邻路标，01、02 目前没有该导航。首页实际锚点是 `#foundations`、`#simulation`、`#engineering`、`#extensions` 和 `#decision-intelligence`。各模块脚本在浏览器本地执行，不需要服务端或外部模型 API。

## 入门夯实 01～04

| 模块 | 主要文件 | 交互与实现边界 |
| --- | --- | --- |
| 01 术语闯关 | `pages/terminology.html`、`assets/js/data/terminology-data.js`、`assets/js/modules/terminology.js` | 36 条术语数据与三层配对；错误诊断、统计、错题复习与导出。不是通用问答模型。 |
| 02 文本预处理 | `pages/preprocessing.html`、`preprocessing-data.js`、`preprocessing.js` | 可排序 Pipeline 将 `text → tokens → ngrams` 逐步传递，记录每一步输入输出、警告和结果对比。中文切分与词形规范化是有限规则教学模拟。 |
| 03 指标计算器 | `pages/metrics.html`、`metrics-data.js`、`metrics-algorithms.js`、`metrics.js` | 混淆矩阵、Accuracy / Precision / Recall / F1、BLEU-1/2、ROUGE-1/2/L、PPL；分母为零或概率非法时显式处理。轻量 tokenization 的数值不等于标准评测工具输出。 |
| 04 分层自测 | `pages/quiz.html`、`quiz-data.js`、`quiz.js` | 42 道题、三级难度、单选 / 多选 / 情景题等；随机抽题、逐题解析、错题本、分类薄弱项、历史与重练。 |

本地状态使用独立前缀：`nlp-toolbox.terminology.stats`、`nlp-toolbox.terminology.mistakes`、`nlp-toolbox.terminology.progress`；`nlp-toolbox.preprocessing.state`；`nlp-toolbox.metrics.state`；以及 `nlp-toolbox.quiz.history`、`nlp-toolbox.quiz.mistakes`、`nlp-toolbox.quiz.stats`、`nlp-toolbox.quiz.current`。这些键仅属于当前浏览器，不会同步到其他设备。

## 原理仿真 05～07

| 模块 | 主要文件 | 可观察的计算与限制 |
| --- | --- | --- |
| 05 Text-CNN | `pages/text-cnn.html`、`simulation-data.js`、`model-simulations.js`、`text-cnn.js` | 确定性四维词向量、三个卷积核，逐窗口卷积 `Σ(X⊙W)+b`、ReLU、max-over-time pooling、特征拼接、线性层与稳定 Softmax。权重未经训练，不是情感分析服务。 |
| 06 Attention | `pages/attention.html`、`simulation-data.js`、`model-simulations.js`、`attention.js` | 固定 `Wq/Wk/Wv` 投影，点积 / 缩放点积、Softmax 前因果掩码、注意力热力图与 `ΣαᵢVᵢ` 上下文向量。注意力权重不等于完整因果解释。 |
| 07 Loss 实验室 | `pages/loss.html`、`loss-algorithms.js`、`loss.js` | `-log(p)` 曲线、固定一维数据上的逻辑回归与平均 BCE 解析梯度、逐步更新、真实损失曲线；`L(w)=w²` 说明学习率的收敛、震荡与发散。 |

05、06 的未知词会映射到确定性的 `<UNK>`；输入和参数变化会重新计算中间值。07 将概率裁剪至 `1e-12` 以避免 `log(0)`，Sigmoid 采用稳定分支，非有限训练结果会被识别。二次函数只是优化直觉实验，不是 NLP 模型训练。

## 工程虚仿 08～09

| 模块 | 主要文件 | 可观察的计算与限制 |
| --- | --- | --- |
| 08 Transformer | `pages/transformer.html`、`transformer-data.js`、`transformer-algorithms.js`、`transformer.js` | `d_model=4`、最多 6 个 token、1 或 2 个头的单个 Block；正弦位置编码、注意力、残差、LayerNorm 和 ReLU FFN。矩阵为教学参数，不是预训练权重。 |
| 09 LLM Sampling | `pages/llm-sampling.html`、`sampling-data.js`、`sampling-algorithms.js`、`sampling.js` | 有限词级词表、确定性上下文 logits、重复惩罚、temperature、top-k、top-p、再归一化；`mulberry32` 种子控制本地随机采样的复现。 |

08 的 Mask 在逐行 Softmax 之前应用；09 的同 Prompt、配置和 Seed 可复现同一采样轨迹。两者都不下载模型权重，也不能据其输出评估真实 LLM 文本质量。

## 拓展探索 10～12

| 模块 | 主要文件 | 可观察的计算与限制 |
| --- | --- | --- |
| 10 BPE 子词切分 | `pages/bpe.html`、`bpe-data.js`、`bpe-algorithms.js`、`bpe.js` | 词频加权 Pair Count、确定性择对、从左到右非重叠合并、词表与有序规则、按规则顺序对新词逐步切分。字符级教学 BPE，非 Byte-level BPE；当前算法不选右侧为 `</w>` 的 pair。 |
| 11 信息检索与 RAG | `pages/retrieval.html`、`retrieval-data.js`、`retrieval-algorithms.js`、`retrieval.js` | 本地可编辑知识库、Chunking、倒排索引、TF-IDF 余弦相似度、BM25 与来源追踪；回答只是从证据句摘取的预览，不调用生成模型。 |
| 12 Beam Search | `pages/beam-search.html`、`beam-search-data.js`、`beam-search-algorithms.js`、`beam-search.js` | 复用 09 的教学 logits，累计 `log p`、全局候选排序、Beam Width 剪枝、EOS / 长度惩罚和带父节点的搜索树。每个父 Beam 仅展开概率最高的 B 个候选，并非穷举。 |

10 每轮重新扫描教学语料统计相邻符号对，同频按稳定规则决定合并次序；新词从字符与词边界符号出发，逐条应用有序 Merge Rule。11 演示“检索 → 组装上下文 → 摘取证据”，不包含向量数据库或真实生成式 RAG。12 的生成分布来自有限教学词表，不代表真实 LLM 的语言能力。

## 决策智能 13

13 Jev · AI Decision Lab 位于 `pages/jev-decision.html`，局部样式为 `assets/css/jev-decision.css`，预设场景为 `assets/js/data/jev-examples.js`，交互位于 `assets/js/modules/jev-decision.js`。页面分为“系统一、决策原语、置信度、工作流、工具分工、构建决策”六节，底部返回首页 `#decision-intelligence`，上一模块是 12。

此页以状态与问题为输入，使用词项线索及稳定哈希构造**确定性的教学 logits**。Choice 对选项做稳定 Softmax 并取最高概率项；Score 对 1～5 级量表的概率求期望；Noul 返回 `P(是)` 与 `P(否)`。Choice 与 Score 展示 `1 − H(p)/log(K)` 的本地分布集中度统计，Noul 不另设独立 Confidence。策略阈值由确定性代码将判断映射为人工审核或处理队列，调节策略不会重新生成判断。Decision Builder 最多组合五个问题，配置保存于 `nlp-toolbox.jev.builder`。

“Jev / System One”在此仅指公开的类型化决策范式。页面的概率、置信度和模拟 API 合约**不是 TypeSafe Jev 的内部算法、真实响应或经过校准的预测**；没有发送网络请求、保存 API Key 或运行外部服务。正式接口资料应以 [TypeSafe 官方介绍](https://typesafe.ai/blog/introducing-system-one-models-and-jev) 为准。

## 验证、待补证据与维护原则

- 2026-10-20 的源码级检查覆盖首页和 13 个模块页的本地链接与资源目标、34 个 JS 文件的 `node --check`。固定数值样例见报告；这些结果**不能替代**浏览器交互、Console 或视觉回归。
- CSS 中可找到桌面到平板 / 手机的断点及局部滚动容器，但尚需在实际 1920、1440、1366、平板与手机视口核查，尤其是矩阵、搜索树和 13 的构建器。
- 首页 05～09 的卡片与中阶介绍仍有“预留”阶段措辞，和模块页已实现的状态不一致；01、02 缺少与 03 一致的相邻模块路标。这些是本轮源码审阅发现的文案与导航遗留项，本次仅更新文档，未改动冻结的前端。
- 后续如果扩展模块，继续将题库 / 预设、纯计算与 DOM 渲染分离；不要把教学简化写成工业级模型能力，也不要把新功能描述为已测功能。
