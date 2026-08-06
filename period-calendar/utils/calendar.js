/**
 * 日历工具函数
 * 负责生成月历网格、日期计算等
 */

/**
 * 生成某年某月的日历网格数据
 * @param {number} year - 年份
 * @param {number} month - 月份 (1-12)
 * @returns {Array} 42个格子的日期数组（6行 x 7列）
 */
function generateMonthGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  // 第一天是星期几（0=周日, 6=周六）
  const startWeekDay = firstDay.getDay();

  const grid = [];

  // 填充上个月的尾巴
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startWeekDay - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    grid.push({
      date: formatDate(year, month - 1, d),
      day: d,
      isCurrentMonth: false,
    });
  }

  // 当月日期
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push({
      date: formatDate(year, month, d),
      day: d,
      isCurrentMonth: true,
    });
  }

  // 填充下个月的头（凑满42格）
  const remaining = 42 - grid.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    grid.push({
      date: formatDate(nextYear, nextMonth, d),
      day: d,
      isCurrentMonth: false,
    });
  }

  return grid;
}

/**
 * 格式化为 YYYY-MM-DD
 */
function formatDate(year, month, day) {
  // 处理 month 可能是 0 的情况（上一年12月）
  if (month === 0) {
    year -= 1;
    month = 12;
  }
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * 获取今天的日期字符串
 */
function today() {
  const d = new Date();
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.round((d2 - d1) / 86400000);
}

/**
 * 日期加 N 天
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

module.exports = {
  generateMonthGrid,
  formatDate,
  today,
  daysBetween,
  addDays,
};
