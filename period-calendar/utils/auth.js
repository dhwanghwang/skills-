/**
 * 用户鉴权工具
 */
const app = getApp();

/**
 * 确保用户已登录，未登录则触发静默登录
 */
async function ensureLogin() {
  if (app.globalData.isLogin) {
    return app.globalData.openid;
  }

  try {
    await app.autoLogin();
    return app.globalData.openid;
  } catch (err) {
    wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    throw err;
  }
}

module.exports = { ensureLogin };
