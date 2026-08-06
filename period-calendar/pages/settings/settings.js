// pages/settings/settings.js
Page({
  data: {
    defaultCycleLength: 28,
    defaultPeriodLength: 5,
    remindBefore: 2,
    remindEnabled: true,
    // 订阅消息模板 ID（需替换为你在微信公众平台申请的模板 ID）
    templateIds: [],
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    // 从本地缓存读取
    const settings = wx.getStorageSync('periodSettings') || {};
    this.setData({
      defaultCycleLength: settings.defaultCycleLength || 28,
      defaultPeriodLength: settings.defaultPeriodLength || 5,
      remindBefore: settings.remindBefore || 2,
      remindEnabled: settings.remindEnabled !== false,
    });
  },

  saveSettings() {
    wx.setStorageSync('periodSettings', {
      defaultCycleLength: this.data.defaultCycleLength,
      defaultPeriodLength: this.data.defaultPeriodLength,
      remindBefore: this.data.remindBefore,
      remindEnabled: this.data.remindEnabled,
    });
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  onCycleChange(e) {
    this.setData({ defaultCycleLength: parseInt(e.detail.value) || 28 });
  },

  onPeriodChange(e) {
    this.setData({ defaultPeriodLength: parseInt(e.detail.value) || 5 });
  },

  onRemindBeforeChange(e) {
    this.setData({ remindBefore: parseInt(e.detail.value) || 2 });
  },

  onRemindToggle(e) {
    this.setData({ remindEnabled: e.detail.value });
  },

  // 请求订阅消息授权
  async requestSubscribe() {
    const { templateIds } = this.data;
    if (templateIds.length === 0) {
      wx.showToast({
        title: '暂无可用的通知模板',
        icon: 'none',
      });
      return;
    }

    try {
      const res = await wx.requestSubscribeMessage({
        tmplIds: templateIds,
      });
      const accepted = templateIds.filter(id => res[id] === 'accept');
      if (accepted.length > 0) {
        wx.showToast({ title: '已开启通知', icon: 'success' });
        this.saveSettings();
      }
    } catch (err) {
      // 用户拒绝，不提示
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '试试这个经期日历，记录和预测都很方便',
      path: '/pages/calendar/calendar',
    };
  },
});
