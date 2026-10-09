window.NLPToolboxData = window.NLPToolboxData || {};
window.NLPToolboxData.metrics = {
  classification: {
    balanced:{ label:'类别均衡', values:{ tp:40, fp:10, fn:5, tn:45 } },
    precision:{ label:'高 Precision（精确率）', values:{ tp:28, fp:2, fn:22, tn:48 } },
    recall:{ label:'高 Recall（召回率）', values:{ tp:46, fp:24, fn:4, tn:26 } }
  },
  generation: {
    perfect:{ label:'完全匹配', reference:'the cat is sitting on the mat', candidate:'the cat is sitting on the mat' },
    partial:{ label:'部分匹配', reference:'the cat is sitting on the mat', candidate:'the cat sits on the mat' },
    repetition:{ label:'重复生成失败案例', reference:'the cat is on the mat', candidate:'the the the the the' }
  },
  language: {
    confident:{ label:'高置信度', probabilities:'0.9, 0.8, 0.95, 0.85' },
    uncertain:{ label:'低置信度', probabilities:'0.2, 0.15, 0.3, 0.1' },
    perfect:{ label:'PPL = 1', probabilities:'1, 1, 1' }
  }
};
