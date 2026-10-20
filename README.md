# NLP 百宝箱

面向西北工业大学《自然语言处理》课程的浏览器本地交互实验平台。首页以 Massively 的 Editorial 信息层级组织学习路线，13 个模块页面共用实验区与返回模块列表入口；03～13 另有相邻模块路标。项目使用 HTML、CSS 和原生 JavaScript；数值与决策演示均为教学仿真，不加载预训练模型，也不调用在线 API。

## 运行与目录

在现代浏览器中打开 [index.html](index.html)；也可以将项目根目录作为静态站点提供。页面资源使用相对路径，无需安装前端框架或数据库。完整实现边界见 [实现记录](docs/implementation-notes.md)，课程作业文稿见 [实验报告](docs/NLP百宝箱实验报告.md)。

| 路径 | 作用 |
| --- | --- |
| `index.html` | 首页、五层学习路线与 13 个模块入口；锚点见下表。 |
| `pages/` | 13 个独立 HTML 页面，沿用统一 Header、实验区和返回入口；01、02 暂无相邻路标。 |
| `assets/css/main.css`、`responsive.css`、`experiment.css` | 全局设计变量、响应式规则和共用实验样式。 |
| `assets/css/*.css` | 指标、自测、模型与拓展模块的局部实验样式。 |
| `assets/js/main.js` | 公共导航增强。 |
| `assets/js/data/` | 术语、自测题库及各实验的本地预设数据。 |
| `assets/js/modules/` | 模块交互与教学计算；部分模块将纯算法拆为 `*-algorithms.js`。 |
| `docs/implementation-notes.md` | 分层架构、算法边界与验证记录。 |

## 入门夯实 01～04

首页入口：[`#foundations`](index.html#foundations)。这一层从概念、文本处理、评价到自测，形成学习反馈闭环。

| 编号 | 模块 | 页面 | 当前功能 |
| --- | --- | --- | --- |
| 01 | 术语闯关 | [terminology.html](pages/terminology.html) | 36 个术语的定义与应用配对、错因、错题本。 |
| 02 | 文本预处理 | [preprocessing.html](pages/preprocessing.html) | 可排序 Pipeline、逐步轨迹、结果对比。 |
| 03 | 指标计算器 | [metrics.html](pages/metrics.html) | 分类指标、BLEU / ROUGE、PPL 分步演算。 |
| 04 | 分层自测 | [quiz.html](pages/quiz.html) | 42 道题、三级难度、解析、薄弱项与历史。 |

## 原理仿真 05～07

首页入口：[`#simulation`](index.html#simulation)。这一层展示模型前向计算、信息加权和参数优化的中间值。

| 编号 | 模块 | 页面 | 当前功能 |
| --- | --- | --- | --- |
| 05 | Text-CNN | [text-cnn.html](pages/text-cnn.html) | 低维词向量、卷积窗口、池化、分类 Softmax。 |
| 06 | Attention | [attention.html](pages/attention.html) | Q/K/V、点积与缩放点积、因果掩码、上下文向量。 |
| 07 | Loss 实验室 | [loss.html](pages/loss.html) | 交叉熵、逻辑回归梯度下降、学习率与二次函数实验。 |

## 工程虚仿 08～09

首页入口：[`#engineering`](index.html#engineering)。这里使用小规模、确定性参数演示架构与解码行为，不运行真实大模型。

| 编号 | 模块 | 页面 | 当前功能 |
| --- | --- | --- | --- |
| 08 | Transformer | [transformer.html](pages/transformer.html) | 单个小型 Block：位置编码、多头注意力、残差、归一化和 FFN。 |
| 09 | LLM Sampling | [llm-sampling.html](pages/llm-sampling.html) | temperature、top-k、top-p 与带种子的本地采样。 |

## 拓展探索 10～12

首页入口：[`#extensions`](index.html#extensions)。分别观察模型输入之前的子词学习、外部知识检索，以及生成时的确定性搜索。

| 编号 | 模块 | 页面 | 当前功能 |
| --- | --- | --- | --- |
| 10 | BPE 子词切分实验室 | [bpe.html](pages/bpe.html) | 字符级 BPE、词频加权合并、规则应用与新词轨迹。 |
| 11 | 信息检索与 RAG 实验室 | [retrieval.html](pages/retrieval.html) | 本地切块、TF-IDF / BM25、来源追踪与摘取式答案预览。 |
| 12 | Beam Search 解码实验室 | [beam-search.html](pages/beam-search.html) | 累计对数得分、全局剪枝、长度惩罚和搜索树。 |

## 决策智能 13

首页入口：[`#decision-intelligence`](index.html#decision-intelligence)。

| 编号 | 模块 | 页面 | 当前功能 |
| --- | --- | --- | --- |
| 13 | Jev · AI Decision Lab | [jev-decision.html](pages/jev-decision.html) | Choice、Score、Noul、置信度统计、策略工作流与本地 Decision Builder。 |

13 使用关键词规则与确定性哈希构造教学概率分布，再以 Softmax 和策略阈值演示“状态 → 判断 → 策略 → 动作”。它借鉴 Jev / System One 的结构化决策范式，**不调用 TypeSafe Jev 服务**；其概率不是经真实数据校准的模型预测。Decision Builder 只将配置保存到当前浏览器的 `nlp-toolbox.jev.builder`。

## 验证与教学边界

- 本地链接目标和脚本语法可作静态检查；浏览器逐页交互、移动端视觉及 Console 仍需在实际设备上验收。请勿把静态检查写成运行时验收。
- 中文分词、词形规范化、低维词向量、教学 logits、字符级 BPE 和摘取式 RAG 预览都与生产级 NLP 工具不同；各页面及实现记录说明了具体差异。
- 术语、预处理、指标、自测和 Jev 的构建器使用各自的 `nlp-toolbox.*` 本地键；不涉及账号、后端或云端同步。

## 设计参考与署名

Design reference: [Massively by HTML5 UP](https://html5up.net/massively)，许可：[Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/)。项目借鉴其页面结构、排版和内容层级，没有复制演示图片、文案或文章。首页与模块页 Footer 保留 `Design adapted from Massively by HTML5 UP.` 署名。
