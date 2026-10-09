window.NLPToolboxData = window.NLPToolboxData || {};
window.NLPToolboxData.sampling = {
  vocabulary:['the','a','AI','model','language','processing','machine','learning','future','can','will','learn','generate','text','data','human','system','creative','useful','powerful','new','ideas','tools','help','people','with','and','to','for','from','in','is','become','more','responsible','understand','build','change','our','world','ways','because','of','.','<EOS>'],
  transitions:{
    '<default>':{the:1.4,AI:1.1,model:1.0,language:.8,can:.7,will:.7,new:.6,'.':.15},
    'ai':{will:2.4,can:2.1,model:1.6,system:1.3,help:1.2,become:.8,'.':.2},
    'future':{of:2.4,is:1.8,will:1.7,can:1.2,AI:1.5,'.':.25},
    'language':{model:2.5,processing:2.2,can:1.1,will:.8,generate:1.0,'.':.2},
    'processing':{can:2.1,help:1.5,with:1.3,language:1.0,'.':.35},
    'machine':{learning:2.4,can:1.1,model:1.0,'.':.2},
    'learning':{can:2.2,model:1.6,from:1.0,data:1.3,'.':.25},
    'can':{help:2.0,learn:1.9,generate:1.7,build:1.3,change:1.1,'.':.2},
    'will':{help:1.8,change:1.7,become:1.5,generate:1.2,learn:1.1,'.':.2},
    'model':{can:1.8,will:1.3,learn:1.5,generate:1.4,understand:1.1,'.':.25},
    'text':{and:1.5,with:1.2,for:1.0,'.':.5,'<EOS>':.25},
    'data':{and:1.5,can:1.1,help:1.0,'.':.45},
    'help':{people:2.0,build:1.1,understand:1.3,with:1.1,'.':.35},
    'people':{with:1.5,and:1.2,build:.9,'.':.35},
    'new':{ideas:1.8,tools:1.7,model:1.2,ways:1.0,'.':.25},
    'creative':{ideas:2.0,tools:1.2,text:1.0,'.':.3},
    '.':{'<EOS>':2.1,the:.5,AI:.5}
  }
};
