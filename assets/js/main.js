(() => {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-list');
  const links = document.querySelectorAll('.nav-list a');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.forEach((link) => link.addEventListener('click', () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const sections = [...document.querySelectorAll('main[id], main section[id]')];
  if ('IntersectionObserver' in window && sections.length) {
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!current) return;
      links.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${current.target.id}`));
    }, { rootMargin: '-25% 0px -60% 0px', threshold: [0.01, 0.3] });
    sections.forEach((section) => observer.observe(section));
  }

  const modules = [
    { file: 'terminology.html', label: '01 术语闯关', section: 'foundations' },
    { file: 'preprocessing.html', label: '02 文本预处理', section: 'foundations' },
    { file: 'metrics.html', label: '03 指标计算器', section: 'foundations' },
    { file: 'quiz.html', label: '04 分层自测', section: 'foundations' },
    { file: 'text-cnn.html', label: '05 Text-CNN', section: 'simulation' },
    { file: 'attention.html', label: '06 Attention', section: 'simulation' },
    { file: 'loss.html', label: '07 Loss 实验室', section: 'simulation' },
    { file: 'transformer.html', label: '08 Transformer', section: 'engineering' },
    { file: 'llm-sampling.html', label: '09 LLM Sampling', section: 'engineering' },
    { file: 'bpe.html', label: '10 BPE 子词切分', section: 'extensions' },
    { file: 'retrieval.html', label: '11 信息检索与 RAG', section: 'extensions' },
    { file: 'beam-search.html', label: '12 Beam Search', section: 'extensions' },
    { file: 'jev-decision.html', label: '13 Jev · AI Decision Lab', section: 'decision-intelligence' }
  ];
  const currentFile = window.location.pathname.split('/').pop();
  const currentIndex = modules.findIndex((module) => module.file === currentFile);

  if (currentIndex >= 0) {
    const current = modules[currentIndex];
    const previous = modules[currentIndex - 1];
    const next = modules[currentIndex + 1];
    const back = document.querySelector('.back-link');
    let moduleLinks = document.querySelector('.module-links');

    if (back) {
      if (!moduleLinks) {
        moduleLinks = document.createElement('nav');
        back.before(moduleLinks);
      }
      moduleLinks.className = 'module-links';
      moduleLinks.setAttribute('aria-label', '模块导航');
      moduleLinks.replaceChildren();

      const makeLink = (module, direction) => {
        const link = document.createElement('a');
        link.href = module.file;
        link.setAttribute('aria-label', `${direction}：${module.label}`);
        link.textContent = direction === '上一模块' ? `← ${module.label}` : `${module.label} →`;
        return link;
      };
      moduleLinks.append(previous ? makeLink(previous, '上一模块') : document.createElement('span'));
      moduleLinks.append(next ? makeLink(next, '下一模块') : document.createElement('span'));

      back.href = `../index.html#${current.section}`;
      back.setAttribute('aria-label', '返回模块列表');
      back.replaceChildren();
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '←';
      back.append(arrow, document.createTextNode('返回模块列表'));
    }
  }
})();
