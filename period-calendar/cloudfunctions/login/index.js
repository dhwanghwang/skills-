// cloudfunctions/login/index.js
// 微信静默登录云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 查找用户
  const userRes = await db.collection('users')
    .where({ _openid: openid })
    .get();

  if (userRes.data.length === 0) {
    // 新用户 → 自动注册
    await db.collection('users').add({
      data: {
        _openid: openid,
        createdAt: db.serverDate(),
        lastLoginAt: db.serverDate(),
      },
    });

    // 初始化默认设置
    await db.collection('settings').add({
      data: {
        _openid: openid,
        defaultCycleLength: 28,
        defaultPeriodLength: 5,
        remindBefore: 2,
        remindEnabled: true,
        updatedAt: db.serverDate(),
      },
    });

    return {
      openid,
      userInfo: {},
      isNew: true,
    };
  }

  // 老用户 → 更新最后登录时间
  await db.collection('users')
    .where({ _openid: openid })
    .update({
      data: { lastLoginAt: db.serverDate() },
    });

  return {
    openid,
    userInfo: userRes.data[0],
    isNew: false,
  };
};
