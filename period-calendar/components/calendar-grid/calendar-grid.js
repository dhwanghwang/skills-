// components/calendar-grid/calendar-grid.js
const { generateMonthGrid, today, formatDate } = require('../../utils/calendar');

Component({
  properties: {
    year: { type: Number, value: new Date().getFullYear() },
    month: { type: Number, value: new Date().getMonth() + 1 },
    markedDates: { type: Object, value: {} },
    prediction: { type: Object, value: null },
  },

  data: {
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarData: [],
    showBackToToday: false, // 是否显示「回到今天」
  },

  lifetimes: {
    attached() {
      this.renderGrid();
      this.checkBackToToday();
    },
  },

  observers: {
    'year, month, markedDates, prediction'() {
      this.renderGrid();
      this.checkBackToToday();
    },
  },

  methods: {
    renderGrid() {
      const { year, month, markedDates, prediction } = this.data;
      const grid = generateMonthGrid(year, month);
      const todayStr = today();

      const calendarData = grid.map(day => {
        const dateKey = day.date;
        const marked = markedDates[dateKey] || {};

        const isPeriod = !!marked.isPeriod;

        let isPredicted = false;
        if (prediction && prediction.stage !== 'initial') {
          isPredicted = dateKey >= prediction.nextPeriodStart
            && dateKey <= prediction.nextPeriodEnd;
        }

        const isOvulation = prediction && dateKey === prediction.ovulationDay;

        let isFertile = false;
        if (prediction && prediction.fertileWindow) {
          isFertile = dateKey >= prediction.fertileWindow.start
            && dateKey <= prediction.fertileWindow.end;
        }

        const isToday = dateKey === todayStr;
        const isInteractive = day.isCurrentMonth;

        let className = 'date-cell';
        if (!isInteractive) className += ' outside';
        if (isPeriod) className += ' period';
        if (isPredicted && !isPeriod) className += ' predicted';
        if (isToday) className += ' today';
        if (isFertile && !isPeriod) className += ' fertile';

        return {
          ...day,
          isPeriod,
          isPredicted,
          isOvulation,
          isFertile,
          isToday,
          isInteractive,
          className,
        };
      });

      this.setData({ calendarData });
    },

    checkBackToToday() {
      const now = new Date();
      const isCurrentMonth = this.data.year === now.getFullYear()
        && this.data.month === now.getMonth() + 1;
      this.setData({ showBackToToday: !isCurrentMonth });
    },

    /** 回到今天所在月份 */
    onBackToToday() {
      const now = new Date();
      this.setData({ year: now.getFullYear(), month: now.getMonth() + 1 });
      this.triggerEvent('monthchange', { year: now.getFullYear(), month: now.getMonth() + 1 });
    },

    onDateTap(e) {
      const { date, isinteractive } = e.currentTarget.dataset;
      const interactive = isinteractive !== undefined ? isinteractive : true;
      if (!interactive) return;
      this.triggerEvent('datetap', { date });
    },

    onDateLongpress(e) {
      const { date } = e.currentTarget.dataset;
      this.triggerEvent('datelongpress', { date });
    },

    onPrevMonth() {
      const { year, month } = this.data;
      let newMonth = month - 1;
      let newYear = year;
      if (newMonth < 1) { newMonth = 12; newYear -= 1; }
      this.setData({ year: newYear, month: newMonth });
      this.triggerEvent('monthchange', { year: newYear, month: newMonth });
    },

    onNextMonth() {
      const { year, month } = this.data;
      let newMonth = month + 1;
      let newYear = year;
      if (newMonth > 12) { newMonth = 1; newYear += 1; }
      this.setData({ year: newYear, month: newMonth });
      this.triggerEvent('monthchange', { year: newYear, month: newMonth });
    },
  },
});
