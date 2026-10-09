window.NLPToolboxData = window.NLPToolboxData || {};
window.NLPToolboxData.retrieval = {
  documents: [
    { id:'doc-transformer', title:'Transformer', content:'Transformer is a neural architecture built around self-attention. Self-attention compares tokens with one another, but it does not inherently encode their order. Positional encoding adds position information so the model can distinguish a token at the beginning from the same token later in a sequence.' },
    { id:'doc-attention', title:'Attention', content:'Attention uses a query to compare with keys and then forms a weighted sum of values. Softmax converts similarity scores into attention weights. A causal mask prevents a token from attending to future tokens during autoregressive language modeling.' },
    { id:'doc-textcnn', title:'Text-CNN', content:'Text-CNN maps text tokens to embeddings and applies convolution filters over local windows. Max-over-time pooling retains the strongest activation from each filter. The pooled feature vector is sent to a classifier for a text label prediction.' },
    { id:'doc-bpe', title:'BPE Tokenization', content:'Byte Pair Encoding starts from small symbols and repeatedly merges frequent adjacent pairs. The resulting subword vocabulary can reuse word pieces such as roots and suffixes. Character-level teaching BPE makes the merge rules and word boundary marker visible.' },
    { id:'doc-rag', title:'Retrieval-Augmented Generation', content:'RAG retrieves relevant chunks from an external knowledge base before generation. Retrieved chunks are assembled into context for a language model. Retrieval score measures lexical relevance, not whether the source is factually true or sufficient for an answer.' },
    { id:'doc-metrics', title:'BLEU and ROUGE', content:'BLEU measures clipped n-gram precision and includes a brevity penalty. ROUGE commonly measures recall-oriented n-gram overlap or longest common subsequence overlap. These automatic metrics are useful signals but do not fully represent human judgement.' },
    { id:'doc-sampling', title:'Language Model Sampling', content:'Temperature rescales logits before softmax. Top-k keeps a fixed number of candidate tokens, while top-p keeps the smallest candidate set whose cumulative probability reaches a threshold. Retrieval Top-k is different: it keeps ranked document chunks, not token candidates.' }
  ],
  queries: ['Why does Transformer need positional encoding?', 'What is attention?', 'How does BPE work?', 'What is RAG?', 'How does top-p sampling work?'],
  failureCases: {
    'CHUNK TOO SMALL': { query:'Why does Transformer need positional encoding?', strategy:'fixed', chunkSize:8, overlap:0, topK:1 },
    'CHUNK TOO LARGE': { query:'Why does Transformer need positional encoding?', strategy:'fixed', chunkSize:80, overlap:0, topK:1 },
    'VOCABULARY MISMATCH': { query:'automobile', strategy:'fixed', chunkSize:20, overlap:0, topK:3, documents:[{ id:'case-car', title:'Car terminology', content:'A car transports people on roads. The vehicle needs fuel or electricity to move.' }] },
    'TOP-K TOO LOW': { query:'How does Transformer represent order and attention?', strategy:'fixed', chunkSize:18, overlap:0, topK:1 },
    'BOUNDARY OVERLAP': { query:'positional encoding', strategy:'fixed', chunkSize:9, overlap:0, topK:2 }
  }
};
