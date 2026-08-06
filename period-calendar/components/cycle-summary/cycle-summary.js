// components/cycle-summary/cycle-summary.js
const { today, daysBetween } = require('../../utils/calendar');

Component({
  properties: {
    prediction: { type: Object, value: null },
    cycles: { type: Array, value: [] },
  },

  data: {
    statusText: '',
    statusEmoji: '',
    isPeriodActive: false,
    periodProgress: '',
    confidenceText: '',
    showCard: false,
    todayStr: today(),
  },

  observers: {
    'prediction, cycles'() {
      this.updateStatus();
    },
  },

  methods: {
    updateStatus() {
      const { prediction, cycles } = this.data;
      if (!prediction) {
        this.setData({ showCard: false });
        return;
      }

      const todayStr = today();

      // 是否处于经期中
      let isPeriodActive = false;
      let currentPeriodEnd = '';

      if (cycles.length > 0) {
        const lastCycle = cycles[0];
        if (todayStr >= lastCycle.startDate && todayStr <= lastCycle.endDate) {
          isPeriodActive = true;
          currentPeriodEnd = lastCycle.endDate;
        }
      }

      let statusText, statusEmoji, periodProgress = '';

      if (isPeriodActive && currentPeriodEnd) {
        const dayOfPeriod = daysBetween(cycles[0].startDate, todayStr) + 1;
        const totalDays = cycles[0].periodLength || prediction.avgPeriodLength;
        periodProgress = `第 ${dayOfPeriod} 天 / 共 ${totalDays} 天`;

        if (dayOfPeriod <= 2) {
          statusText = '经期刚开始，注意休息和保暖';
          statusEmoji = '🌸';
        } else if (dayOfPeriod === totalDays) {
          statusText = '经期最后一天，快结束了';
          statusEmoji = '🌿';
        } else {
          statusText = '经期中，照顾好自己';
          statusEmoji = '💆‍♀️';
        }
      } else {
        const daysUntil = daysBetween(todayStr, prediction.nextPeriodStart);

        if (daysUntil <= 0) {
          statusText = '预计今天来潮，可以提前准备';
          statusEmoji = '📅';
        } else if (daysUntil === 1) {
          statusText = '明天预计来潮，请做好准备';
          statusEmoji = '⏰';
        } else if (daysUntil <= 3) {
          statusText = `${daysUntil} 天后预计来潮`;
          statusEmoji = '🔔';
        } else if (daysUntil <= 7) {
          statusText = `距下次经期还有 ${daysUntil} 天`;
          statusEmoji = '📋';
        } else {
          statusText = `距下次经期还有 ${daysUntil} 天`;
          statusEmoji = '✨';
        }
      }

      // 置信度
      let confidenceText = '';
      if (prediction.confidence === 'high') {
        confidenceText = '预测基于充足数据，可信度高';
      } else if (prediction.confidence === 'medium') {
        confidenceText = '继续记录可提高准确度';
      } else if (prediction.confidence === 'low') {
        confidenceText = '数据较少，多记录几次更准';
      } else {
        confidenceText = '开始记录第一条经期吧';
      }

      this.setData({
        statusText, statusEmoji, isPeriodActive,
        periodProgress, confidenceText, showCard: true,
      });
    },
  },
});
