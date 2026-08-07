/**
 * remind-btn — 订阅消息提醒按钮
 *
 * 用法：
 *   <remind-btn
 *     mode="inline"              // inline | card | float
 *     reminder-text="距经期还有3天"
 *     bind:subscribed="onSubscribed"
 *     bind:cancelled="onCancelled"
 *   />
 *
 * mode:
 *   inline — 行内按钮（设置页）
 *   card   — 卡片横幅（日历页标记后）
 *   float  — 浮动按钮（首页快捷入口）
 */

const remind = require('../../utils/remind');

Component({
  properties: {
    mode: {
      type: String,
      value: 'inline',          // inline | card | float
    },
    reminderText: {
      type: String,
      value: '',                // 外部传入的提醒文案
    },
    autoHide: {
      type: Boolean,
      value: false,             // 授权成功后是否自动隐藏
    },
  },

  data: {
    subscribed: false,
    subscribing: false,
    visible: true,
  },

  lifetimes: {
    attached() {
      this.setData({ subscribed: remind.isSubscribed() });
    },
  },

  pageLifetimes: {
    show() {
      this.setData({ subscribed: remind.isSubscribed() });
    },
  },

  methods: {
    async handleTap() {
      if (this.data.subscribing) return;

      this.setData({ subscribing: true });

      try {
        const { accepted } = await remind.requestSubscribe();

        if (accepted.length > 0) {
          this.setData({ subscribed: true });

          wx.showToast({ title: '提醒已开启', icon: 'success' });

          if (this.properties.autoHide) {
            this.setData({ visible: false });
          }

          this.triggerEvent('subscribed', { accepted });
        } else {
          this.triggerEvent('cancelled');
        }
      } catch (err) {
        console.error('订阅失败', err);
        this.triggerEvent('cancelled');
      } finally {
        this.setData({ subscribing: false });
      }
    },

    // 外部可调用：手动隐藏
    hide() {
      this.setData({ visible: false });
    },

    // 外部可调用：手动显示
    show() {
      this.setData({ visible: true, subscribed: remind.isSubscribed() });
    },

    // 外部可调用：刷新状态
    refresh() {
      this.setData({ subscribed: remind.isSubscribed() });
    },
  },
});
