/**
 * pages/calendar/calendar.js
 * 日历主页 — 控制日期标记、底部面板、数据加载、提醒引导
 */
const { predict } = require('../../utils/predict');
const { today, addDays, formatDate, daysBetween } = require('../../utils/calendar');
const remind = require('../../utils/remind');
const cycleService = require('../../services/cycle');

Page({
  data: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    cycles: [],
    prediction: null,
    markedDates: {},

    // 底部面板
    showPanel: false,
    panelType: '',              // 'mark' | 'edit' | 'delete'
    panelDate: '',              // 用户点击的日期
    selectedDuration: 5,        // 用户选择的持续天数
    presetDurations: [1, 2, 3, 4, 5, 6, 7],
    previewStart: '',
    previewEnd: '',

    // 面板动画
    panelAnimating: false,

    // 提醒引导横幅
    showRemindBanner: false,    // 标记经期后是否显示提醒引导
    reminderText: '',           // 提醒引导文案
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    wx.showNavigationBarLoading();
    try {
      const cycles = await cycleService.listCycles();
      const settings = wx.getStorageSync('periodSettings') || {};
      const predictionResult = predict(cycles, settings);

      const markedDates = {};
      cycles.forEach(c => {
        let d = new Date(c.startDate);
        const end = new Date(c.endDate);
        while (d <= end) {
          const key = this.fmt(d);
          markedDates[key] = { isPeriod: true, startDate: c.startDate, endDate: c.endDate };
          d.setDate(d.getDate() + 1);
        }
      });

      // 检查提醒引导横幅
      const remindConfig = remind.loadConfig();
      const remindText = remind.getReminderText(predictionResult, remindConfig);
      const showBanner = remind.shouldShowOnboardGuide() && remindConfig.remindEnabled;

      this.setData({
        cycles,
        prediction: predictionResult,
        markedDates,
        showRemindBanner: showBanner,
        reminderText: remindText.title,
      });
    } catch (err) {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败，下拉重试', icon: 'none' });
    } finally {
      wx.hideNavigationBarLoading();
    }
  },

  fmt(d) {
    return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  },

  // ==================== 日期点击 ====================

  onDateTap(e) {
    const { date } = e.detail;
    const { markedDates } = this.data;

    if (markedDates[date] && markedDates[date].isPeriod) {
      this.openEditPanel(date, markedDates[date]);
    } else {
      this.openMarkPanel(date);
    }
  },

  // ==================== 快速标记面板 ====================

  openMarkPanel(date) {
    const { prediction } = this.data;
    const defaultDuration = prediction && prediction.avgPeriodLength
      ? prediction.avgPeriodLength
      : 5;

    this.setData({
      showPanel: true,
      panelAnimating: true,
      panelType: 'mark',
      panelDate: date,
      selectedDuration: defaultDuration,
      previewStart: date,
      previewEnd: addDays(date, defaultDuration - 1),
    });
  },

  onSelectDuration(e) {
    const { days } = e.currentTarget.dataset;
    const { panelDate } = this.data;
    this.setData({
      selectedDuration: days,
      previewEnd: addDays(panelDate, days - 1),
    });
  },

  async onConfirmMark() {
    const { panelDate, selectedDuration } = this.data;
    wx.showLoading({ title: '保存中' });

    try {
      for (let i = 0; i < selectedDuration; i++) {
        const d = addDays(panelDate, i);
        await cycleService.markDay(d);
      }
      this.setData({ showPanel: false, panelAnimating: false, panelType: '' });
      wx.showToast({ title: '已记录', icon: 'success' });
      await this.loadData();

      // ==== 标记成功后 → 显示提醒引导横幅 ====
      this.showRemindGuide();
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 提醒引导 ====================

  showRemindGuide() {
    // 已经订阅就不弹了
    if (remind.isSubscribed()) return;
    // 每天最多弹一次
    if (!remind.shouldShowOnboardGuide()) return;

    const { prediction } = this.data;
    const config = remind.loadConfig();
    const { title } = remind.getReminderText(prediction, config);

    remind.markGuideShown();

    this.setData({
      showRemindBanner: true,
      reminderText: title,
    });
  },

  onRemindSubscribed() {
    this.setData({ showRemindBanner: false });
    wx.showToast({ title: '提醒已开启！', icon: 'success' });
  },

  onRemindCancelled() {
    this.setData({ showRemindBanner: false });
  },

  onDismissBanner() {
    this.setData({ showRemindBanner: false });
  },

  // ==================== 编辑/删除面板 ====================

  openEditPanel(date, periodInfo) {
    this.setData({
      showPanel: true,
      panelAnimating: true,
      panelType: 'edit',
      panelDate: date,
      editStartDate: periodInfo.startDate,
      editEndDate: periodInfo.endDate,
    });
  },

  async onDeleteCycle() {
    const { editStartDate, editEndDate } = this.data;
    wx.showModal({
      title: '确认删除',
      content: `将删除 ${editStartDate} ~ ${editEndDate} 的经期记录，确定吗？`,
      confirmColor: '#E84A6B',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ showPanel: false });
        await cycleService.deleteCycle(editStartDate);
        wx.showToast({ title: '已删除', icon: 'success' });
        await this.loadData();
      },
    });
  },

  // ==================== 面板收起 ====================

  onClosePanel() {
    this.setData({ showPanel: false, panelAnimating: false, panelType: '' });
  },

  onPanelMaskTap() {
    this.onClosePanel();
  },

  preventTouchMove() {
    return;
  },

  // ==================== 月份切换 ====================

  onMonthChange(e) {
    this.setData({ year: e.detail.year, month: e.detail.month });
  },

  // ==================== 分享 ====================

  onShareAppMessage() {
    return {
      title: '试试这个经期日历，记录和预测都很方便',
      path: '/pages/calendar/calendar',
    };
  },

  onShareTimeline() {
    return {
      title: '经期日历 - 智能预测，贴心提醒',
      query: '',
    };
  },
});
