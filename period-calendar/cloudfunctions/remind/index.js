/**
 * remind — 提醒管理云函数
 *
 * 支持两种调用方式：
 *   1. 小程序端调用 — action: 'syncConfig'  同步用户提醒配置
 *   2. 定时触发器    — 每日 8:00 自动执行，扫描并发送提醒
 *
 * 定时触发器配置（在云函数目录下 config.json）：
 *   { "triggers": [{ "name": "dailyRemind", "type": "timer",
 *      "config": "0 0 8 * * * *" }] }
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  // --- 分支 1：小程序端同步配置 ---
  if (event.action === 'syncConfig') {
    return syncConfig(event);
  }

  // --- 分支 2：定时触发 — 批量发送提醒 ---
  return sendScheduledReminders();
};

// =============================================================
// 同步用户提醒配置到 reminders 集合
// =============================================================
async function syncConfig(event) {
  const { OPENID } = cloud.getWXContext();
  const { config } = event;

  // 查询是否已有记录
  const existing = await db.collection('reminders')
    .where({ _openid: OPENID })
    .get();

  const data = {
    _openid: OPENID,
    remindEnabled: config.remindEnabled !== false,
    remindBefore: config.remindBefore || 2,
    remindTime: config.remindTime || '08:00',
    templateId: config.templateId || '',
    subscribed: config.subscribed || false,
    subscribedAt: config.subscribedAt || 0,
    updatedAt: db.serverDate(),
  };

  if (existing.data.length > 0) {
    await db.collection('reminders')
      .doc(existing.data[0]._id)
      .update({ data });
  } else {
    data.createdAt = db.serverDate();
    await db.collection('reminders').add({ data });
  }

  return { success: true };
}

// =============================================================
// 定时触发：查找今天需要提醒的用户并发送
// =============================================================
async function sendScheduledReminders() {
  // 1. 从云端获取所有开启了提醒的用户
  const { data: reminderRecords } = await db.collection('reminders')
    .where({
      remindEnabled: true,
      subscribed: true,
    })
    .get();

  if (reminderRecords.length === 0) {
    return { sent: 0, message: '无需要提醒的用户' };
  }

  const today = getTodayStr();
  let sentCount = 0;

  // 2. 逐个检查
  for (const record of reminderRecords) {
    try {
      const shouldSend = await checkAndSend(record, today);
      if (shouldSend) sentCount++;
    } catch (err) {
      console.error(`提醒发送失败 [${record._openid}]`, err);
    }
  }

  return { sent: sentCount, total: reminderRecords.length };
}

// =============================================================
// 检查单个用户是否需要发送提醒
// =============================================================
async function checkAndSend(record, today) {
  const { _openid, remindBefore, templateId } = record;

  // 防重复：今天已经发过了
  const lastSent = record.lastRemindedDate;
  if (lastSent && lastSent === today) return false;

  // 获取用户最近一次经期记录，计算下次经期预测日
  const { data: cycles } = await db.collection('cycles')
    .where({ _openid })
    .orderBy('startDate', 'desc')
    .limit(10)
    .get();

  if (cycles.length === 0) return false;

  // 需要 settings 来获取默认值 → 用用户配置的
  const settingsRecord = await db.collection('settings')
    .where({ _openid })
    .get();
  const settings = settingsRecord.data[0] || {};

  const nextPeriodStart = predictNextPeriod(cycles, settings);

  if (!nextPeriodStart) return false;

  // 判断：今天 = (下次经期 - remindBefore) 天？
  const daysUntil = daysBetween(today, nextPeriodStart);

  if (daysUntil !== remindBefore) return false;

  // --- 发送订阅消息 ---
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: _openid,
      templateId,
      page: '/pages/calendar/calendar',
      data: {
        thing1: { value: '经期提醒' },
        date2: { value: nextPeriodStart },
        thing3: { value: `预计 ${remindBefore} 天后来潮，做好准备哦` },
      },
      miniprogramState: 'developer',   // 开发版 → 正式上线改为 'formal'
    });

    // 记录发送时间，防止重复
    await db.collection('reminders')
      .doc(record._id)
      .update({
        data: {
          lastRemindedDate: today,
          lastRemindedAt: db.serverDate(),
        },
      });

    console.log(`✓ 提醒已发送 → ${_openid} (下次经期: ${nextPeriodStart})`);
    return true;
  } catch (err) {
    // 常见原因：用户取消了订阅、模板 ID 错误等
    console.warn(`提醒发送失败 [${_openid}]`, err.errCode, err.errMsg);

    // 如果用户已取消订阅，标记为未订阅
    if (err.errCode === 43101) {
      await db.collection('reminders')
        .doc(record._id)
        .update({
          data: { subscribed: false, updatedAt: db.serverDate() },
        });
    }

    return false;
  }
}

// =============================================================
// 预测下次经期（纯服务端版本，避免引入前端工具库）
// =============================================================
function predictNextPeriod(cycles, settings) {
  if (!cycles || cycles.length === 0) return null;

  const defaultCycle = settings.defaultCycleLength || 28;
  const sorted = cycles
    .filter(c => c.startDate)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

  if (sorted.length === 0) return null;

  // 计算平均周期长度（基于实际记录）
  let avgCycle = defaultCycle;
  const lengths = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const len = daysBetween(sorted[i + 1].startDate, sorted[i].startDate);
    if (len >= 21 && len <= 40) lengths.push(len);
  }
  if (lengths.length > 0) {
    avgCycle = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  }

  return addDays(sorted[0].startDate, avgCycle);
}

// =============================================================
// 日期工具（为了避免云函数额外依赖）
// =============================================================
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function daysBetween(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / 86400000);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
