// pages/stats/stats.js
// 统计分析页
const { predict } = require('../../utils/predict');
const cycleService = require('../../services/cycle');

Page({
  data: {
    cycles: [],
    prediction: null,
    stats: null,
  },

  onShow() {
    this.loadStats();
  },

  async loadStats() {
    try {
      const cycles = await cycleService.listCycles();
      const settings = wx.getStorageSync('periodSettings') || {};
      const prediction = predict(cycles, settings);

      const stats = this.calcStats(cycles);

      this.setData({ cycles, prediction, stats });
    } catch (err) {
      console.error('加载统计失败', err);
    }
  },

  calcStats(cycles) {
    if (!cycles || cycles.length === 0) {
      return {
        totalRecords: 0,
        avgCycle: '-',
        avgPeriod: '-',
        minCycle: '-',
        maxCycle: '-',
        cycleTrend: '尚无数据',
      };
    }

    const sorted = [...cycles].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    // 周期长度列表
    const cycleLengths = [];
    for (let i = 1; i < sorted.length; i++) {
      const len = Math.round((new Date(sorted[i].startDate) - new Date(sorted[i-1].startDate)) / 86400000);
      if (len >= 21 && len <= 40) {
        cycleLengths.push(len);
      }
    }

    const periodLengths = sorted.map(c => {
      if (c.periodLength) return c.periodLength;
      return Math.round((new Date(c.endDate) - new Date(c.startDate)) / 86400000) + 1;
    });

    const avgCycle = cycleLengths.length > 0
      ? (cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length).toFixed(1)
      : '-';

    const avgPeriod = periodLengths.length > 0
      ? (periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length).toFixed(1)
      : '-';

    const minCycle = cycleLengths.length > 0 ? Math.min(...cycleLengths) : '-';
    const maxCycle = cycleLengths.length > 0 ? Math.max(...cycleLengths) : '-';

    // 趋势：最近3个周期的变化方向
    let cycleTrend = '数据不足';
    if (cycleLengths.length >= 3) {
      const recent = cycleLengths.slice(-3);
      const diff = recent[2] - recent[0];
      if (Math.abs(diff) <= 1) cycleTrend = '稳定';
      else if (diff > 0) cycleTrend = '变长中';
      else cycleTrend = '变短中';
    } else if (cycleLengths.length >= 2) {
      cycleTrend = '继续记录中';
    }

    return {
      totalRecords: sorted.length,
      avgCycle,
      avgPeriod,
      minCycle,
      maxCycle,
      cycleTrend,
      cycleLengths,
      periodLengths,
      lastThreeCycles: sorted.slice(0, 3).reverse(),
    };
  },
});
