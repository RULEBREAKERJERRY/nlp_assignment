window.NLPToolboxData = window.NLPToolboxData || {};
window.NLPToolboxData.simulation = {
  vocab:{'<UNK>':[.05,.05,.05,.05],this:[.2,-.1,.4,.3],movie:[.5,.2,-.3,.1],is:[-.1,.3,.2,.4],very:[.4,.4,-.2,.2],good:[.8,.6,.5,.7],bad:[-.7,-.5,-.4,-.6],service:[.3,.1,.2,.4],really:[.2,.5,.1,.3],love:[.7,.5,.4,.6],hate:[-.6,-.4,-.5,-.3],natural:[.5,.3,.6,.2],language:[.4,.6,.2,.5],processing:[.6,.4,.5,.3],i:[.2,.2,.3,.1],the:[.1,.1,.1,.1]},
  cnnFilters:[{name:'卷积核 A',kernel:[[.3,-.2,.4,.1],[.2,.3,-.1,.2]],bias:.1},{name:'卷积核 B',kernel:[[-.2,.4,.1,.3],[.5,-.1,.2,-.2]],bias:-.05},{name:'卷积核 C',kernel:[[.1,.2,.3,-.1],[-.2,.4,.1,.2],[.3,-.1,.2,.4]],bias:.05}],
  classifier:{labels:['正向','中性','负向'],weights:[[.6,.2,.1],[-.1,.5,.1],[-.5,-.1,.7]],bias:[.1,.05,-.05]},
  wq:[[.4,.1,-.2,.3],[.2,.5,.1,-.1],[-.1,.3,.4,.2],[.3,-.2,.2,.5]],wk:[[.3,-.2,.4,.1],[.1,.5,-.1,.3],[.4,.1,.2,-.2],[-.1,.3,.5,.2]],wv:[[.5,.1,.2,-.1],[-.2,.4,.3,.1],[.1,-.1,.5,.4],[.3,.2,-.2,.5]],
  cnnExamples:{Positive:'this movie is very good',Negative:'the service is really bad',Mixed:'this movie is good but service bad'}, attentionExamples:{Love:'i really love natural language processing',Hate:'i really hate natural language processing',Short:'i love language'}
};
