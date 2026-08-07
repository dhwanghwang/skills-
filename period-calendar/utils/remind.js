/**
 * 提醒工具模块
 *
 * 职责：
 *   1. 订阅消息授权封装（wx.requestSubscribeMessage）
 *   2. 提醒配置管理（本地缓存 + 云端同步）
 *   3. 提醒时机判断（距下次经期还有 N 天？）
 *   4. 多场景触发：标记经期后 / 设置页手动 / 首页入口
 */

const { today, daysBetween } = require('./calendar');

// ---------------------------------------------------------------
// 模板 ID — 替换为你在微信公众平台申请的「经期提醒」模板 ID
// 路径：小程序后台 → 功能 → 订阅消息 → 选用模板
// ---------------------------------------------------------------
const TEMPLATE_ID = '';          // ← 在此填入你的模板 ID

// ---------------------------------------------------------------
// 用户可见的提醒原因（与模板关键词对应）
// ---------------------------------------------------------------
const REMIND_REASON = '我们会在你预计下次经期前提醒你，不再错过重要日子';

// ---------------------------------------------------------------
// 核心：请求订阅消息授权
// 必须在用户点击事件中调用（微信限制）
// ---------------------------------------------------------------
function requestSubscribe() {
  if (!TEMPLATE_ID) {
    wx.showToast({ title: '请先在代码中配置模板ID', icon: 'none' });
    return Promise.resolve({ accepted: [] });
  }

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [TEMPLATE_ID],
      success: (res) => {
        const accepted = res[TEMPLATE_ID] === 'accept';
        if (accepted) {
          // 记录授权时间
          wx.setStorageSync('remindSubscribedAt', Date.now());
          syncReminderToCloud();
        }
        resolve({ accepted: accepted ? [TEMPLATE_ID] : [], result: res });
      },
      fail: (err) => {
        // 用户拒绝或关闭弹窗 — 静默处理
        console.log('订阅消息授权失败', err);
        resolve({ accepted: [], error: err });
      },
    });
  });
}

// ---------------------------------------------------------------
// 检查订阅状态
// ---------------------------------------------------------------
function isSubscribed() {
  const t = wx.getStorageSync('remindSubscribedAt');
  if (!t) return false;
  // 授权超过 30 天建议重新授权（微信策略）
  return (Date.now() - t) < 30 * 24 * 3600 * 1000;
}

function getSubscribedAt() {
  return wx.getStorageSync('remindSubscribedAt') || 0;
}

// ---------------------------------------------------------------
// 加载提醒配置
// ---------------------------------------------------------------
function loadConfig() {
  const defaults = {
    remindEnabled: true,
    remindBefore: 2,           // 提前 N 天提醒
    remindTime: '08:00',       // 提醒时间
  };
  const saved = wx.getStorageSync('remindConfig') || {};
  return { ...defaults, ...saved };
}

// ---------------------------------------------------------------
// 保存提醒配置
// ---------------------------------------------------------------
function saveConfig(config) {
  const current = loadConfig();
  const merged = { ...current, ...config };
  wx.setStorageSync('remindConfig', merged);
  syncReminderToCloud();
}

// ---------------------------------------------------------------
// 切换提醒开关
// ---------------------------------------------------------------
function toggleRemind(enabled) {
  const config = loadConfig();
  config.remindEnabled = enabled;
  saveConfig(config);
  return config;
}

// ---------------------------------------------------------------
// 判断今天是否应该提醒
// @param {Object} prediction — predict() 返回的结果
// @param {Object} config    — loadConfig() 返回的配置
// @returns {Object} { shouldRemind, daysUntil, nextDate }
// ---------------------------------------------------------------
function checkToday(prediction, config) {
  if (!prediction || !prediction.nextPeriodStart) {
    return { shouldRemind: false, daysUntil: null, nextDate: null };
  }

  const config_ = config || loadConfig();
  if (!config_.remindEnabled) {
    return { shouldRemind: false, daysUntil: null, nextDate: null };
  }

  const daysUntil = daysBetween(today(), prediction.nextPeriodStart);

  return {
    shouldRemind: daysUntil <= config_.remindBefore && daysUntil >= 0,
    daysUntil,
    nextDate: prediction.nextPeriodStart,
    remindBefore: config_.remindBefore,
  };
}

// ---------------------------------------------------------------
// 获取提醒状态的友好文案
// ---------------------------------------------------------------
function getReminderText(prediction, config) {
  const check = checkToday(prediction, config);

  if (!prediction || !prediction.nextPeriodStart) {
    return { title: '记录经期', subtitle: '记录后即可预测并开启提醒' };
  }

  const days = check.daysUntil;

  if (days < 0) {
    return { title: '经期中', subtitle: `预计持续 ${prediction.avgPeriodLength} 天` };
  }
  if (days === 0) {
    return { title: '预计今日来潮', subtitle: '经期提醒已就绪' };
  }
  if (days === 1) {
    return { title: '明天预计来潮', subtitle: '记得提前准备哦' };
  }
  if (days <= 3) {
    return { title: `${days} 天后预计来潮`, subtitle: '提醒已开启，届时通知你' };
  }

  return {
    title: `距下次经期 ${days} 天`,
    subtitle: check.shouldRemind ? '近几日会提醒你' : `将在 ${days - config.remindBefore} 天后提醒`,
  };
}

// ---------------------------------------------------------------
// 同步提醒配置到云端（云函数用）
// ---------------------------------------------------------------
async function syncReminderToCloud() {
  if (!wx.cloud) return;

  const config = loadConfig();
  const subscribed = isSubscribed();

  try {
    await wx.cloud.callFunction({
      name: 'remind',
      data: {
        action: 'syncConfig',
        config: {
          remindEnabled: config.remindEnabled,
          remindBefore: config.remindBefore,
          remindTime: config.remindTime,
          templateId: TEMPLATE_ID,
          subscribed,
          subscribedAt: getSubscribedAt(),
        },
      },
    });
  } catch (err) {
    console.warn('同步提醒配置到云端失败', err);
  }
}

// ---------------------------------------------------------------
// 首次提醒引导：标记经期后弹出
// 只在用户有历史记录且未订阅时触发
// ---------------------------------------------------------------
function shouldShowOnboardGuide() {
  if (isSubscribed()) return false;
  const settings = wx.getStorageSync('periodSettings') || {};
  if (!settings.remindEnabled) return false;
  // 避免每次标记都弹 — 每天最多弹 1 次
  const lastShown = wx.getStorageSync('remindGuideLastShown') || '';
  if (lastShown === today()) return false;
  return true;
}

function markGuideShown() {
  wx.setStorageSync('remindGuideLastShown', today());
}

module.exports = {
  TEMPLATE_ID,
  REMIND_REASON,
  requestSubscribe,
  isSubscribed,
  getSubscribedAt,
  loadConfig,
  saveConfig,
  toggleRemind,
  checkToday,
  getReminderText,
  syncReminderToCloud,
  shouldShowOnboardGuide,
  markGuideShown,
};
