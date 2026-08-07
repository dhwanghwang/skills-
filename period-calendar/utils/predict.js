/**
 * 经期预测引擎
 *
 * 三段式精度提升：
 *   0 条记录 → 默认值（28天周期 / 5天经期）
 *   1 条记录 → 默认周期推算
 *   2~5 条记录 → 简单平均 + 异常值过滤（排除 <21 或 >40 的异常周期）
 *   6 条以上 → 加权平均（最近3个周期权重翻倍）+ 置信度评估
 */

const { today, daysBetween, addDays } = require('./calendar');

const DEFAULT_CYCLE = 28;
const DEFAULT_PERIOD = 5;

/**
 * 核心预测函数
 * @param {Array} cycles - 历史周期记录 [{ startDate, endDate, periodLength }]
 * @param {Object} settings - { defaultCycleLength, defaultPeriodLength }
 * @returns {Object} 预测结果
 */
function predict(cycles, settings = {}) {
  const defaultCycle = settings.defaultCycleLength || DEFAULT_CYCLE;
  const defaultPeriod = settings.defaultPeriodLength || DEFAULT_PERIOD;

  if (!cycles || cycles.length === 0) {
    return buildFallback(defaultCycle, defaultPeriod);
  }

  const sorted = [...cycles]
    .filter(c => c.startDate)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

  if (sorted.length === 1) {
    return fromSingleRecord(sorted[0], defaultCycle, defaultPeriod);
  }

  // 提取每条记录的 cycleLength（本次开始 - 上一次开始）
  const lengths = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const len = daysBetween(sorted[i + 1].startDate, sorted[i].startDate);
    if (len >= 21 && len <= 40) {
      lengths.push(len);
    }
  }

  let avgCycle, confidence;

  if (lengths.length < 4) {
    avgCycle = lengths.length > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
      : defaultCycle;
    confidence = 'low';
  } else {
    // 加权平均 — 最近3个周期权重翻倍
    const weighted = lengths.map((len, i) => ({
      len,
      w: i < 3 ? 2 : 1,
    }));
    const total = weighted.reduce((s, wl) => s + wl.len * wl.w, 0);
    const totalW = weighted.reduce((s, wl) => s + wl.w, 0);
    avgCycle = Math.round(total / totalW);

    // 方差 → 置信度
    const variance = calcVariance(lengths);
    confidence = variance < 2 ? 'high' : 'medium';
  }

  const lastCycle = sorted[0];
  const avgPeriod = Math.round(
    sorted.reduce((s, c) => s + (c.periodLength || defaultPeriod), 0) / sorted.length
  );

  // 核心推算
  const nextPeriodStart = addDays(lastCycle.startDate, avgCycle);
  const ovulationDay = addDays(nextPeriodStart, -14);
  const fertileStart = addDays(ovulationDay, -3);
  const fertileEnd = addDays(ovulationDay, 3);

  return {
    avgCycleLength: avgCycle,
    avgPeriodLength: avgPeriod,
    nextPeriodStart,
    nextPeriodEnd: addDays(nextPeriodStart, avgPeriod - 1),
    ovulationDay,
    fertileWindow: { start: fertileStart, end: fertileEnd },
    confidence,
    basedOn: sorted.length,
    stage: lengths.length >= 6 ? 'precise' : lengths.length >= 2 ? 'estimating' : 'initial',
  };
}

function buildFallback(cycleLen, periodLen) {
  const next = addDays(today(), cycleLen);
  const ov = addDays(next, -14);
  const ovStart = addDays(ov, -3);
  const ovEnd = addDays(ov, 3);

  return {
    avgCycleLength: cycleLen,
    avgPeriodLength: periodLen,
    nextPeriodStart: next,
    nextPeriodEnd: addDays(next, periodLen - 1),
    ovulationDay: ov,
    fertileWindow: { start: ovStart, end: ovEnd },
    confidence: 'none',
    basedOn: 0,
    stage: 'initial',
  };
}

function fromSingleRecord(onlyCycle, defaultCycle, defaultPeriod) {
  return predict(
    [
      {
        startDate: addDays(onlyCycle.startDate, -defaultCycle),
        endDate: addDays(onlyCycle.startDate, -defaultCycle + defaultPeriod - 1),
        periodLength: defaultPeriod,
      },
      onlyCycle,
    ],
    { defaultCycleLength: defaultCycle, defaultPeriodLength: defaultPeriod }
  );
}

function calcVariance(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
}

module.exports = { predict };
