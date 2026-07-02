const Calendar = (() => {
  let currentYear, currentMonth;

  function init() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth() + 1;

    document.getElementById('btn-prev-month').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 1) { currentMonth = 12; currentYear--; }
      render();
    });

    document.getElementById('btn-next-month').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 12) { currentMonth = 1; currentYear++; }
      render();
    });

    document.getElementById('btn-calendar-toggle').addEventListener('click', () => {
      const panel = document.getElementById('calendar-panel');
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) render();
    });

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('calendar-panel');
      const btn = document.getElementById('btn-calendar-toggle');
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.add('hidden');
      }
    });
  }

  function render() {
    const title = document.getElementById('calendar-title');
    title.textContent = `${currentYear}年${currentMonth}月`;

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();

    let startWeekday = firstDay.getDay();
    if (startWeekday === 0) startWeekday = 7;

    const stats = Progress.getMonthStats(currentYear, currentMonth);
    const today = new Date();
    const todayStr = _fmtDate(today);

    for (let i = 1; i < startWeekday; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const day = document.createElement('div');
      day.className = 'cal-day';
      if (dateStr === todayStr) day.classList.add('today');

      const num = document.createElement('span');
      num.className = 'day-num';
      num.textContent = d;
      day.appendChild(num);

      const stat = stats[dateStr];
      const pct = document.createElement('span');
      pct.className = 'day-pct';

      if (stat && stat.totalArticles > 0) {
        pct.textContent = stat.percentage + '%';
        if (stat.percentage >= 100) pct.classList.add('green');
        else if (stat.percentage >= 50) pct.classList.add('yellow');
        else pct.classList.add('gray');
      } else if (dateStr <= todayStr) {
        pct.textContent = '0%';
        pct.classList.add('gray');
      } else {
        pct.textContent = '';
      }

      if (pct.textContent) {
        day.appendChild(pct);
      }

      day.addEventListener('click', () => {
        if (typeof App !== 'undefined' && App.loadDate) {
          App.loadDate(dateStr);
          document.getElementById('calendar-panel').classList.add('hidden');
        }
      });

      grid.appendChild(day);
    }
  }

  function refresh() {
    const panel = document.getElementById('calendar-panel');
    if (!panel.classList.contains('hidden')) render();
  }

  function _fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return { init, render, refresh };
})();
