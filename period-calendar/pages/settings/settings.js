// pages/settings/settings.js
const remind = require('../../utils/remind');

Page({
  data: {
    defaultCycleLength: 28,
    defaultPeriodLength: 5,
    remindBefore: 2,
    remindEnabled: true,
    remindTime: '08:00',
    // 订阅消息模板 ID（在 utils/remind.js 中配置）
    templateIds: [remind.TEMPLATE_ID].filter(Boolean),
    subscribed: false,
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    const settings = wx.getStorageSync('periodSettings') || {};
    const remindConfig = remind.loadConfig();

    this.setData({
      defaultCycleLength: settings.defaultCycleLength || 28,
      defaultPeriodLength: settings.defaultPeriodLength || 5,
      remindBefore: remindConfig.remindBefore || 2,
      remindEnabled: remindConfig.remindEnabled !== false,
      remindTime: remindConfig.remindTime || '08:00',
      subscribed: remind.isSubscribed(),
    });
  },

  saveSettings() {
    // 1. 保存周期设置
    wx.setStorageSync('periodSettings', {
      defaultCycleLength: this.data.defaultCycleLength,
      defaultPeriodLength: this.data.defaultPeriodLength,
      remindBefore: this.data.remindBefore,
      remindEnabled: this.data.remindEnabled,
    });

    // 2. 保存提醒配置
    remind.saveConfig({
      remindBefore: this.data.remindBefore,
      remindEnabled: this.data.remindEnabled,
      remindTime: this.data.remindTime,
    });

    wx.showToast({ title: '已保存', icon: 'success' });
  },

  // ========== 周期设置 ==========

  onCycleChange(e) {
    this.setData({ defaultCycleLength: parseInt(e.detail.value) || 28 });
  },

  onPeriodChange(e) {
    this.setData({ defaultPeriodLength: parseInt(e.detail.value) || 5 });
  },

  // ========== 提醒设置 ==========

  onRemindBeforeChange(e) {
    const idx = parseInt(e.detail.value);
    const val = [1, 2, 3, 5, 7][idx] || 2;
    this.setData({ remindBefore: val });
  },

  onRemindToggle(e) {
    const enabled = e.detail.value;
    this.setData({ remindEnabled: enabled });

    // 切换开关时，如果开启且未订阅，自动弹出授权
    if (enabled && !remind.isSubscribed() && remind.TEMPLATE_ID) {
      this.requestSubscribe();
    }

    // 同步到云端
    remind.toggleRemind(enabled);
  },

  // ========== 订阅消息授权 ==========

  async requestSubscribe() {
    if (!remind.TEMPLATE_ID) {
      wx.showModal({
        title: '提示',
        content: '请先在 utils/remind.js 中配置订阅消息模板 ID。\n\n步骤：微信公众平台 → 功能 → 订阅消息 → 选用模板 → 复制模板 ID',
        showCancel: false,
      });
      return;
    }

    const { accepted } = await remind.requestSubscribe();

    if (accepted.length > 0) {
      this.setData({ subscribed: true });
    }
  },

  // 通过 remind-btn 组件触发
  onRemindSubscribed() {
    this.setData({ subscribed: true, remindEnabled: true });
    remind.saveConfig({ remindEnabled: true });
    wx.showToast({ title: '提醒已就绪', icon: 'success' });
  },

  onRemindCancelled() {
    // 用户拒绝授权 — 不强制
  },

  // ========== 分享 ==========

  onShareAppMessage() {
    return {
      title: '试试这个经期日历，记录和预测都很方便',
      path: '/pages/calendar/calendar',
    };
  },
});
