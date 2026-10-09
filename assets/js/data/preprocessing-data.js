window.NLPToolboxData = window.NLPToolboxData || {};
window.NLPToolboxData.preprocessing = {
  examples: [
    { name:'英文评论示例', text:'  Natural   Language Processing is AMAZING! The NLP models are learning from texts.  ' },
    { name:'中英文混合示例', text:'自然语言处理（NLP）很有趣！The models, and students, are learning.\n\n  2026 年实验。' },
    { name:'含噪声输入示例', text:'THE   quick, quick foxes!!! are running 123 times\t in the fields.' }
  ],
  englishStopwords: ['a','an','the','is','are','am','be','been','being','of','to','in','and','or','for','on','at','with','from','by','as','this','that','these','those','it','its','was','were','will','would','can','could','should','has','have','had','not','but','if','than','then','into','about'],
  chineseStopwords: ['的','了','是','在','和','与','及','或','而','也','都','就','很','有','我','你','他','她','它','我们','你们','他们','这','那','一个','一些','进行'],
  chineseDictionary: ['自然语言处理','自然语言','机器学习','深度学习','语言模型','文本处理','文本','分词','模型','学习','学生','实验','有趣','非常','处理','语言','我们','你们','他们','中文','英文','数据','训练','应用','方法','结果','输入','输出','词元','词语'],
  irregularLemmas: { cars:'car', children:'child', went:'go', better:'good', studies:'study', mice:'mouse', feet:'foot', was:'be', were:'be', running:'run', stopped:'stop' },
  defaultPipeline: [
    { id:'normalize', enabled:true }, { id:'lowercase', enabled:true }, { id:'punctuation', enabled:true },
    { id:'tokenize', enabled:true }, { id:'stopwords', enabled:true }, { id:'lemmatize', enabled:true }
  ]
};
