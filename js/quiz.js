const Quiz = (() => {
  let currentArticle = null;
  let questions = [];
  let currentIndex = 0;
  let results = [];
  let onCompleteCallback = null;

  function start(article, onComplete) {
    if (!article.quiz || !article.quiz.single || !article.quiz.judge) return;

    currentArticle = article;
    onCompleteCallback = onComplete;
    currentIndex = 0;
    results = [];

    questions = [];
    article.quiz.single.forEach(q => {
      questions.push({ type: 'single', data: q });
    });
    article.quiz.judge.forEach(q => {
      questions.push({ type: 'judge', data: q });
    });

    _shuffleArray(questions);

    const container = document.getElementById('quiz-container');
    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });

    _renderQuestion();
  }

  function _renderQuestion() {
    const body = document.getElementById('quiz-body');
    const q = questions[currentIndex];
    const total = questions.length;

    document.getElementById('quiz-progress').textContent = `${currentIndex + 1} / ${total}`;
    document.getElementById('quiz-progress-bar').style.width = `${((currentIndex) / total) * 100}%`;

    if (q.type === 'single') {
      body.innerHTML = _renderSingleQuestion(q.data, currentIndex);
      _bindSingleEvents(q.data, currentIndex);
    } else {
      body.innerHTML = _renderJudgeQuestion(q.data, currentIndex);
      _bindJudgeEvents(q.data, currentIndex);
    }

    document.getElementById('quiz-feedback').classList.add('hidden');
    document.getElementById('quiz-next').classList.add('hidden');
  }

  function _renderSingleQuestion(q, idx) {
    const optionsHtml = q.options.map((opt, i) => `
      <button class="quiz-option-btn" data-idx="${idx}" data-option="${_esc(opt)}">
        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
        <span class="option-text">${_esc(opt)}</span>
      </button>
    `).join('');

    return `
      <div class="quiz-question">
        <span class="quiz-q-type">单选题</span>
        <p class="quiz-q-text">${_esc(q.question)}</p>
      </div>
      <div class="quiz-options">${optionsHtml}</div>
    `;
  }

  function _renderJudgeQuestion(q, idx) {
    return `
      <div class="quiz-question">
        <span class="quiz-q-type">判断题</span>
        <p class="quiz-q-text">${_esc(q.statement)}</p>
      </div>
      <div class="quiz-judge-btns">
        <button class="quiz-judge-btn correct" data-idx="${idx}" data-answer="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>正确</span>
        </button>
        <button class="quiz-judge-btn wrong" data-idx="${idx}" data-answer="false">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span>错误</span>
        </button>
      </div>
    `;
  }

  function _bindSingleEvents(q, idx) {
    document.querySelectorAll(`.quiz-option-btn[data-idx="${idx}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.option;
        const isCorrect = selected === q.correctOption;
        _showFeedback(isCorrect, q.correctOption, q.sourceParagraph, q.sourceText);

        document.querySelectorAll(`.quiz-option-btn[data-idx="${idx}"]`).forEach(b => {
          b.disabled = true;
          if (b.dataset.option === q.correctOption) b.classList.add('correct');
          if (b.dataset.option === selected && !isCorrect) b.classList.add('wrong');
        });

        results.push({ type: 'single', correct: isCorrect, question: q.question, answer: q.correctOption, userAnswer: selected });
      });
    });
  }

  function _bindJudgeEvents(q, idx) {
    document.querySelectorAll(`.quiz-judge-btn[data-idx="${idx}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.answer === 'true';
        const isCorrect = selected === q.correctAnswer;
        const correctText = q.correctAnswer ? '正确 (√)' : '错误 (×)';
        _showFeedback(isCorrect, correctText, q.sourceParagraph, q.sourceText);

        document.querySelectorAll(`.quiz-judge-btn[data-idx="${idx}"]`).forEach(b => {
          b.disabled = true;
          if ((b.dataset.answer === 'true') === q.correctAnswer) b.classList.add('correct');
          else if (b === btn && !isCorrect) b.classList.add('wrong');
        });

        results.push({ type: 'judge', correct: isCorrect, question: q.statement, answer: correctText, userAnswer: selected ? '正确' : '错误' });
      });
    });
  }

  function _showFeedback(isCorrect, correctAnswer, sourceParagraph, sourceText) {
    const feedback = document.getElementById('quiz-feedback');
    const nextBtn = document.getElementById('quiz-next');

    if (isCorrect) {
      feedback.innerHTML = `
        <div class="feedback-correct">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          <span>回答正确！</span>
        </div>
      `;
      feedback.classList.remove('hidden');
      nextBtn.classList.add('hidden');
      _spawnEmojiFloat();

      setTimeout(() => {
        if (currentIndex >= questions.length - 1) {
          _showReport();
        } else {
          currentIndex++;
          _renderQuestion();
        }
      }, 800);
    } else {
      feedback.innerHTML = `
        <div class="feedback-wrong">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="3">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span>回答错误</span>
        </div>
        <div class="feedback-answer">
          <p><strong>正确答案：</strong>${_esc(correctAnswer)}</p>
          <p class="feedback-source"><strong>原文依据（第${sourceParagraph}段）：</strong>${_esc(sourceText)}</p>
          <button class="btn-link-source" onclick="Quiz.jumpToSource(${sourceParagraph})">跳转至原文对应段落</button>
        </div>
      `;
      feedback.classList.remove('hidden');
      nextBtn.classList.remove('hidden');

      if (currentIndex >= questions.length - 1) {
        nextBtn.textContent = '查看测验结果';
        nextBtn.onclick = _showReport;
      } else {
        nextBtn.textContent = '下一题';
        nextBtn.onclick = () => {
          currentIndex++;
          _renderQuestion();
        };
      }
    }
  }

  function _showReport() {
    const body = document.getElementById('quiz-body');
    const feedback = document.getElementById('quiz-feedback');
    const nextBtn = document.getElementById('quiz-next');
    feedback.classList.add('hidden');
    nextBtn.classList.add('hidden');

    const total = results.length;
    const correct = results.filter(r => r.correct).length;
    const wrong = results.filter(r => !r.correct);
    const pct = Math.round((correct / total) * 100);

    document.getElementById('quiz-progress-bar').style.width = '100%';

    let wrongHtml = '';
    if (wrong.length > 0) {
      wrongHtml = `
        <div class="quiz-report-section">
          <h3>错题回顾</h3>
          ${wrong.map((r, i) => `
            <div class="quiz-report-wrong">
              <p class="wrong-q">${i + 1}. ${_esc(r.question)}</p>
              <p class="wrong-a">你的答案：${_esc(r.userAnswer)} ｜ 正确答案：${_esc(r.answer)}</p>
            </div>
          `).join('')}
        </div>
      `;
    }

    body.innerHTML = `
      <div class="quiz-report">
        <div class="quiz-report-score ${pct >= 80 ? 'good' : pct >= 60 ? 'ok' : 'bad'}">
          <span class="score-num">${correct}/${total}</span>
          <span class="score-label">${pct >= 80 ? '优秀！知识点掌握良好' : pct >= 60 ? '不错，继续加油' : '需要复习哦'}</span>
        </div>
        <div class="quiz-report-bar">
          <div class="quiz-report-bar-fill" style="width:${pct}%;background:${pct >= 80 ? '#4CAF50' : pct >= 60 ? '#FFC107' : '#C0392B'}"></div>
        </div>
        ${wrongHtml}
        <button class="btn-primary quiz-report-close" onclick="Quiz.closeAndGoHome()">返回主页</button>
      </div>
    `;

    _saveQuizResult(currentArticle.id, correct, total);
    if (onCompleteCallback) onCompleteCallback(currentArticle.id, correct, total);
    if (correct === total) _showCelebration();
  }

  function jumpToSource(paragraphNum) {
    const body = document.getElementById('reader-body');
    if (!body) return;

    const paragraphs = body.querySelectorAll('p');
    const targetIdx = paragraphNum - 1;
    if (paragraphs[targetIdx]) {
      paragraphs[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      paragraphs[targetIdx].style.background = '#FFF9C4';
      setTimeout(() => { paragraphs[targetIdx].style.background = ''; }, 3000);
    }
  }

  function close() {
    const container = document.getElementById('quiz-container');
    container.classList.add('hidden');
    currentArticle = null;
    questions = [];
    results = [];
  }

  function closeAndGoHome() {
    close();
    if (typeof ArticleReader !== 'undefined') ArticleReader.hide();
  }

  function _spawnEmojiFloat() {
    const emojis = ['🔬','🌍','🚀','🦖','🌱','🔭','📚','🧬','⭐','🌊'];
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'emoji-float';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.left = (20 + Math.random() * 60) + '%';
      el.style.bottom = '60px';
      el.style.animationDelay = (Math.random() * 0.4) + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1800);
    }
  }

  function _showCelebration() {
    const overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    document.body.appendChild(overlay);
    _launchParticles(overlay);

    const backdrop = document.createElement('div');
    backdrop.className = 'celebration-backdrop';
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.className = 'celebration-modal';
    modal.innerHTML = `
      <div style="font-size:64px;margin-bottom:16px">🎉</div>
      <h2 style="font-size:1.5rem;font-weight:700;color:#3F664F;margin-bottom:8px">太棒啦！</h2>
      <p style="color:#666;margin-bottom:20px">本篇知识点全部掌握</p>
      <button class="btn-primary" onclick="this.closest('.celebration-modal').remove();document.querySelector('.celebration-overlay')?.remove();document.querySelector('.celebration-backdrop')?.remove();" style="padding:10px 32px">太好了</button>
    `;
    document.body.appendChild(modal);
  }

  function _launchParticles(container) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const particles = [];
    const colors = ['#3F664F','#5A8A6A','#FFD700','#FFA500','#7BC88F','#E8F5E9'];
    const emojis = ['🔬','🌍','🚀','🦖','🌱','🔭','📚','🧬','⭐','🌊','🎯','💡'];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2, y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16 - 4,
        size: 3 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)],
        life: 1, decay: 0.008 + Math.random() * 0.012,
        isEmoji: i < 15, emoji: emojis[Math.floor(Math.random() * emojis.length)],
        gravity: 0.15 + Math.random() * 0.1
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      particles.forEach(p => {
        if (p.life <= 0) return;
        alive++;
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
        p.life -= p.decay;
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.isEmoji) {
          ctx.font = `${p.size * 4}px serif`;
          ctx.fillText(p.emoji, p.x, p.y);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      if (alive > 0) requestAnimationFrame(animate);
      else canvas.remove();
    }
    animate();
  }

  function _saveQuizResult(articleId, correct, total) {
    const data = Progress._load ? Progress._load() : JSON.parse(localStorage.getItem('youth_science_reader') || '{}');
    if (!data.quizResults) data.quizResults = {};
    data.quizResults[articleId] = {
      correct, total,
      percentage: Math.round((correct / total) * 100),
      completedAt: new Date().toISOString()
    };
    localStorage.setItem('youth_science_reader', JSON.stringify(data));
  }

  function getQuizResult(articleId) {
    try {
      const data = JSON.parse(localStorage.getItem('youth_science_reader') || '{}');
      return data.quizResults?.[articleId] || null;
    } catch { return null; }
  }

  function hasQuiz(article) {
    return !!(article.quiz && article.quiz.single && article.quiz.single.length > 0);
  }

  function _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  return { start, close, closeAndGoHome, jumpToSource, getQuizResult, hasQuiz };
})();
