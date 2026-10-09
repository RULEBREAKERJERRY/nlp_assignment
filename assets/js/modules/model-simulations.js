window.NLPToolboxSim = (() => {
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0); const matVec=(v,m)=>m[0].map((_,j)=>v.reduce((s,x,i)=>s+x*m[i][j],0));
  const softmax=(xs)=>{const max=Math.max(...xs), exps=xs.map(x=>Math.exp(x-max)),sum=exps.reduce((a,b)=>a+b,0);return exps.map(x=>x/sum);};
  const convolveWindow=(window,kernel,bias)=>window.reduce((sum,row,i)=>sum+dot(row,kernel[i]),bias);
  const maxPool=(map)=>{const value=Math.max(...map),index=map.indexOf(value);return {value,index};};
  const cnnForward=({matrix,filters,classifier})=>{const maps=filters.map(filter=>{const count=matrix.length-filter.kernel.length+1;const raw=count>0?Array.from({length:count},(_,i)=>convolveWindow(matrix.slice(i,i+filter.kernel.length),filter.kernel,filter.bias)):[0];const activations=raw.map(x=>Math.max(0,x));return {...filter,raw,activations,pool:maxPool(activations)};});const features=maps.map(x=>x.pool.value),logits=classifier.weights.map((w,i)=>dot(w,features)+classifier.bias[i]);return {maps,features,logits,probabilities:softmax(logits)};};
  const attentionForward=({matrix,wq,wk,wv,queryIndex,scaled,causal})=>{const q=matrix.map(x=>matVec(x,wq)),k=matrix.map(x=>matVec(x,wk)),v=matrix.map(x=>matVec(x,wv)),query=q[queryIndex],scale=scaled?Math.sqrt(query.length):1;const raw=k.map(key=>dot(query,key)),masked=raw.map((score,i)=>causal&&i>queryIndex?-Infinity:score/scale);const visible=masked.map(x=>x===-Infinity?-1e9:x),weights=softmax(visible).map((x,i)=>masked[i]===-Infinity?0:x);const weighted=v.map((row,i)=>row.map(x=>x*weights[i])),context=v[0].map((_,j)=>weighted.reduce((s,row)=>s+row[j],0));return {q,k,v,query,raw,masked,weights,weighted,context,scale};};
  return {dot,matVec,softmax,convolveWindow,maxPool,cnnForward,attentionForward};
})();
