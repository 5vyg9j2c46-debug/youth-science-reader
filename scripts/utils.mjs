const CATEGORIES = [
  '航天深空·天文新知',
  '考古文博·古文明发掘',
  '大国工程·前沿科技突破',
  '地球自然·气象地质博物探索',
  '生物世界·生命科学科普',
  '地理探索·环球人文地貌',
  '青少年健康医学科普',
  '生态环境·地球保护科考',
  '环球人文与跨国科考见闻'
];

function getTargetCount(isWeekend) {
  return 20;
}

function getExtraCount() {
  return 20;
}

function calcReadTime(text) {
  const clean = text.replace(/<[^>]*>/g, '').replace(/\s/g, '');
  const wordCount = clean.length;
  const rawMinutes = wordCount / 300;
  const readTime = Math.max(3, Math.ceil(rawMinutes));
  return { wordCount, readTime };
}

function generateId(date, index) {
  return `${date}-${String(index + 1).padStart(3, '0')}`;
}

function todayStr() {
  const d = new Date();
  const offset = 8;
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const local = new Date(utc + offset * 3600000);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
}

function isWeekendDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

function distributeCategories(targetCount) {
  const result = [];
  const cats = [...CATEGORIES];
  const perCat = Math.floor(targetCount / cats.length);
  const remainder = targetCount % cats.length;

  for (let i = 0; i < cats.length; i++) {
    const count = perCat + (i < remainder ? 1 : 0);
    for (let j = 0; j < count; j++) {
      result.push(cats[i]);
    }
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export {
  CATEGORIES,
  getTargetCount,
  getExtraCount,
  calcReadTime,
  generateId,
  todayStr,
  isWeekendDate,
  distributeCategories,
  sleep
};
