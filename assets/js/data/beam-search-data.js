window.NLPToolboxData = window.NLPToolboxData || {};

(() => {
  const sampling = window.NLPToolboxData.sampling;
  const vocabulary = sampling.vocabulary;
  const tiny = 1e-12;
  const probabilityLogits = (probabilities) => vocabulary.map((token) => Math.log(Math.max(tiny, probabilities[token] || tiny)));

  const specialLogits = (mode, generated) => {
    if (mode === 'greedy-trap') {
      if (!generated.length) return probabilityLogits({ will:.55, can:.45 });
      if (generated[0] === 'will' && generated.length === 1) return probabilityLogits({ change:.25, become:.25, learn:.25, generate:.25 });
      if (generated[0] === 'can' && generated.length === 1) return probabilityLogits({ help:.9, change:.1 });
      return probabilityLogits({ '<EOS>':.99, '.':.01 });
    }
    if (mode === 'length-bias') {
      if (!generated.length) return probabilityLogits({ '<EOS>':.51, will:.49 });
      if (generated.length === 1) return probabilityLogits({ change:.99, '.':.01 });
      if (generated.length === 2) return probabilityLogits({ transform:.99, '.':.01 });
      if (generated.length === 3) return probabilityLogits({ language:.99, '.':.01 });
      return probabilityLogits({ '<EOS>':.99, '.':.01 });
    }
    if (mode === 'early-eos') {
      if (!generated.length) return probabilityLogits({ will:.4, '<EOS>':.35, can:.25 });
      if (generated[0] === 'will' && generated.length === 1) return probabilityLogits({ help:.8, change:.2 });
      if (generated[0] === 'can' && generated.length === 1) return probabilityLogits({ learn:.8, help:.2 });
      return probabilityLogits({ '<EOS>':.98, '.':.02 });
    }
    return null;
  };

  const generateLogits = ({ context, generated, mode }) => {
    const controlled = specialLogits(mode, generated);
    if (controlled) return controlled;
    return window.NLPToolboxSampling.generateLogits(context, vocabulary, sampling.transitions);
  };

  window.NLPToolboxData.beamSearch = {
    vocabulary,
    generateLogits,
    presets: {
      'SIMPLE GENERATION': { prompt:'The future of AI', mode:'standard', beamWidth:3, alpha:0, maxNewTokens:5 },
      'GREEDY TRAP': { prompt:'Greedy trap', mode:'greedy-trap', beamWidth:2, alpha:0, maxNewTokens:3 },
      'LENGTH BIAS': { prompt:'Length bias', mode:'length-bias', beamWidth:2, alpha:0, maxNewTokens:5 },
      'EARLY EOS': { prompt:'Early ending', mode:'early-eos', beamWidth:3, alpha:0, maxNewTokens:4 }
    }
  };
})();
