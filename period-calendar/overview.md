# 生理期日历小程序架构设计文档

## 项目概况

- **类型**：个人健康工具类微信小程序
- **核心功能**：日历形式记录生理期 + AI 预测下次经期/排卵日/易孕期
- **后端方案**：微信云开发（推荐），数据天然 `_openid` 隔离
- **上线节奏**：极速上线（1~2 周 MVP）

---

## 页面结构

```
pages/
├── calendar/    # 日历主页 - 月视图日历 + 标记/取消经期
├── stats/       # 统计预测 - 周期趋势 + 下次预测 + 排卵推测
└── settings/    # 个人设置 - 周期默认值 + 提醒开关 + 数据管理
```

三 Tab 底部导航：日历 | 统计 | 我的

---

## 核心技术决策

### 预测算法（PredictEngine）
- **三段式**：默认值 → 简单平均 → 加权平均
- 经期推算：lastStart + avgCycleLength
- 排卵日 = 下次经期 - 14 天
- 易孕期 = 排卵日 ± 3 天
- 置信度由数据量和方差决定

### 数据库（云开发）
- `cycles` 集合：`{ _openid, startDate, endDate, cycleLength, periodLength, symptoms, notes }`
- `settings` 集合：`{ _openid, defaultCycleLength: 28, defaultPeriodLength: 5, remindBefore, remindEnabled }`
- 所有查询自动带 `_openid` 过滤 → 数据隔离

### 云函数
- `cycleCRUD`：周期记录的增删改查 + 自动合并相邻周期
- `remind`：定时推送订阅消息提醒

### UI 颜色编码
| 类型 | 颜色 | 说明 |
|------|------|------|
| 实际经期 | `#E84A6B` 深粉实心圆 | 用户已记录 |
| 预测经期 | `#F5A0B5` 浅粉虚线圆 | AI 预测 |
| 排卵日 | `#5B9BD5` 蓝色小圆点 | 预计排卵 |
| 易孕期 | `#D6E8F7` 浅蓝底色 | 排卵 ±3 天 |
| 今天 | `#333` 加粗边框 | 当前日期 |

---

## 项目文件清单（已生成 30 个文件）

```
miniprogram/
├── app.js / app.json / app.wxss              # 全局入口 + 主题变量
├── project.config.json / sitemap.json         # 工具配置
├── utils/
│   ├── calendar.js                           # 月历网格生成 + 日期工具
│   ├── predict.js                            # 三段式预测引擎
│   └── auth.js                               # 鉴权封装
├── services/
│   └── cycle.js                              # 周期数据服务层
├── components/
│   ├── calendar-grid/                        # 自绘月历组件（4文件）
│   └── cycle-summary/                        # 周期状态卡片（4文件）
├── pages/
│   ├── calendar/                             # 日历主页（4文件）
│   ├── stats/                                # 统计分析页（4文件）
│   └── settings/                             # 设置页（4文件）
└── cloudfunctions/
    ├── login/                                # 静默登录云函数
    └── cycleCRUD/                            # 周期 CRUD 云函数
```

---

## 在微信中试用步骤

1. **注册小程序**：去 mp.weixin.qq.com 注册，拿到 AppID
2. **替换 AppID**：修改 `project.config.json` 中的 `"appid"` 和 `app.js` 中的 `"your-env-id"`
3. **开通云开发**：开发者工具中点「云开发」开通，创建 `cycles`、`settings`、`users` 三个集合
4. **部署云函数**：右键 `cloudfunctions/login` 和 `cloudfunctions/cycleCRUD` →「上传并部署」
5. **点击预览**：开发者工具右上角点「预览」，微信扫码即可真机试用

---

## 注意事项

1. **隐私**：所有数据仅用户自己可见，分享不泄露个人数据
2. **日历组件自绘**：不用 TDesign Calendar，需要精细控制颜色标记
3. **冷启动**：新用户无数据时用默认值 28 天，标注「初步预测」
4. **审核**：健康类需注意不涉及医疗诊断建议，定位为「记录工具」

---

## UI / 交互优化记录 (2026-08-06 更新)

### 快捷标记交互
- **旧流程（4步）**：点日期 → modal 确认 → picker 选结束 → 确认 → 保存
- **新流程（2步）**：点日期 → 底部面板选天数（点击预设圆按钮） → 确认
- 底部面板：7 个圆形天数按钮（1~7天），默认选中用户历史平均经期长度
- 面板底部有实时预览：「开始日 → 结束日」
- 面板从底部滑入，带弹性过渡动画

### 日历网格视觉升级
- 经期日改为浅粉圆底高亮（`opacity: 0.18`），不含文字变色干扰
- 预测经期用粉色虚线圈标记
- 易孕期用浅蓝圆底
- 排卵日右上角蓝点标记
- 今日用加粗黑色圆环，识别性更强
- 增加「回到今天」浮动按钮：切换到其它月份时自动出现在右上角
- 点击反馈：日期格按压时显示半透明圆形覆盖

### 状态卡片升级
- 经期中/预测待来潮两种状态分别用不同渐变背景
- 三列数据显示（平均周期 / 经期时长 / 下次预计）
- 非经期时额外显示排卵日和易孕期信息行
- 置信度标签底部居中显示

### 修改文件清单
- `pages/calendar/calendar.js` — 标记面板逻辑重写
- `pages/calendar/calendar.wxml` — modal 改为底部抽屉面板
- `pages/calendar/calendar.wxss` — 面板样式 + 动画
- `components/calendar-grid/calendar-grid.js` — 增加 backToToday 逻辑
- `components/calendar-grid/calendar-grid.wxml` — 视觉层级优化
- `components/calendar-grid/calendar-grid.wxss` — 圆底标记 + 回到今天按钮
- `components/cycle-summary/cycle-summary.wxml` — 三列布局 + 排卵行
- `components/cycle-summary/cycle-summary.wxss` — 渐变背景 + 卡片升级
- `components/cycle-summary/cycle-summary.js` — 状态优化
