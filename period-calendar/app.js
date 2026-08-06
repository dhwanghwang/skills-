// app.js - 经期日历小程序入口
App({
  globalData: {
    userInfo: null,
    openid: null,
    isLogin: false,
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'your-env-id',  // 替换为你的云开发环境 ID
        traceUser: true,
      });
    }

    // 静默登录
    this.autoLogin();
  },

  async autoLogin() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'login',
      });
      this.globalData.openid = result.openid;
      this.globalData.userInfo = result.userInfo || {};
      this.globalData.isLogin = true;
      console.log('登录成功', result.openid);
    } catch (err) {
      console.warn('登录失败，降级为离线模式', err);
    }
  },
});
