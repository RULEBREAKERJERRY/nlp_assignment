# NLP 百宝箱

自然语言处理课程的交互式学习与实验平台。课程主体的 01–09 模块已完成本地交互与数值仿真；04 / EXTENSIONS 中的 10 BPE 子词切分、11 信息检索与 RAG、12 Beam Search 解码实验室均已完成本地教学实现；05 / DECISION INTELLIGENCE 中的 13 Jev · AI Decision Lab 已完成本地结构化决策教学仿真。

## 本地打开

直接在浏览器打开 `index.html`，或用任意静态服务器从项目根目录提供文件。

## 目录

- `index.html`：首页、三层课程主体、拓展探索与决策智能入口
- `pages/`：13 个统一版式的模块页面
- `assets/css/`：全局、响应式与实验页面样式
- `assets/js/main.js`：移动端导航和首页导航状态增强
- `assets/js/data/`：术语 / 自测题库、预处理、指标、BPE、检索、Beam Search 与 Jev 教学数据
- `assets/js/modules/`：01–13 的本地交互、指标计算与数值仿真逻辑
- `docs/implementation-notes.md`：阶段实现说明

## 设计参考与署名

- Project: NLP 百宝箱
- Design Reference: Massively
- Source: https://html5up.net/massively
- Author: HTML5 UP
- License: Creative Commons Attribution 3.0

Massively 被用于页面结构与视觉语言参考；本项目没有复制其演示文案、图片或文章内容。页面 Footer 保留了 `Design adapted from Massively by HTML5 UP.` 署名。

## 后续阶段

已完成：术语闯关、文本预处理、指标计算器、分层自测、Text-CNN、Attention、Loss、Transformer、LLM Sampling。

已完成：BPE 子词切分实验室（Character-level Educational BPE）。

已完成：信息检索与 RAG 实验室（本地 Sparse Retrieval + Extractive Answer Preview）。

已完成：Beam Search 解码实验室（确定性教学 Logits Generator + 真实 Beam Search）。

已完成：Jev · AI Decision Lab（Choice、Score、Noul、Confidence、Policy 与 Builder 的本地教学仿真；不调用真实 Jev 服务）。
