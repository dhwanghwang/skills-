---
name: 足球预测 / soccer-predict
description: >
  足球赛事预测神器。自动采集 titan007.com 数据（亚盘、大小球、欧赔、基本面、阵容、角球、半全场），
  5 步量化分析框架，输出投注建议与预测比分。Football match betting prediction system. Auto-scrapes data from titan007.com (Asian handicap,
  over/under, European odds, fundamentals, lineups, corners, half-time goals), runs a 5-step
  quantitative analysis framework, and outputs betting recommendations with predicted scores.
  Supports concise/Markdown dual output modes, post-match review, and auto weight optimization.
  Triggers: (1) match ID like "2908467" or match description, (2) requests to predict/analyze
  football matches (e.g. "predict", "analyze this match"), (3) match results for post-match review
  (e.g. "review", "result was 2-1"), (4) handicap/over-under analysis.
---

# 足球博彩预测 / Football Betting Prediction

三大工作流：数据采集 → 预测分析 → 赛后复盘。分析引擎见 [prediction-framework.md](references/prediction-framework.md)。

## 输出模式

- **简洁模式**：让球盘推荐、大小球推荐、概率、EV、预测比分。
- **Markdown 报告模式**（默认）：完整报告，含数据表、公式与图表描述。

## 工作流一：赛前数据采集

用户提供比赛 ID 或描述时，从 **titan007.com** 采集（**唯一指定数据源，禁用其他站点**）：

1. 取 ID：`https://live.titan007.com/`（ID 在 `addConcern({id},10)` 中）
2. 基本面：`https://zq.titan007.com/analysis/{match_id}cn.htm`
3. 亚盘：`https://vip.titan007.com/AsianOdds_n.aspx?id={match_id}`
4. 大小球：`https://vip.titan007.com/OverDown_n.aspx?id={match_id}`
5. 欧赔：`https://op1.titan007.com/oddslist/{match_id}.htm`

全部用 **WebFetch**（curl 会 TLS 失败）。亚盘/大小球水位是**港盘**，计算 EV 前必须 **+1 换算**（0.92 → 1.92）。详见 [data-collection.md](references/data-collection.md)。

**采集项**：比赛信息（球队、联赛、时间、场地、天气）、亚盘、大小球盘、欧赔（各取"即"与"早"两行）、基本面（近期战绩、主客场、交锋、排名、盘路走势、进球数/单双）、大小球增强数据（半场进球、角球）、首发阵容。

**titan007 未收录该场时**：用 `业务日+序号` 作 match_id（如 `20260911001`），判 `waiting`、让球盘字段留空，注明"titan007 未收录"。**不得**改用其他数据源或估测盘口。

首发阵容通常开赛前 30-60 分钟公布；提前采集标注"阵容待公布"，用现有深度信息。采集完成即进入工作流二。

## 工作流二：预测分析

运行五步框架，详见 [prediction-framework.md](references/prediction-framework.md)：

1. **数据整理** - 分类整理采集数据
2. **基本面分析** - 盘口合理性、走势追踪、机构意图、欧亚转换
3. **盘口概率计算** - 亚盘与大小球真实隐含概率（取"即"盘）
4. **模型预测** - 亚盘模型（盘口 0.35 > 基本面 0.20+0.20 > 阵容 0.20 > 战意 0.10）与大小球模型（含 xG、联赛因子、半场进球、角球等）
5. **EV 计算与推荐** - 各选项期望值，输出最佳推荐与预测比分

**必输出**：让球盘推荐（方向+**亚盘盘口**+水位+概率+EV+星级，含走水/赢半/输半结算说明）、大小球推荐（方向+盘口线+赔率+概率+EV+星级）、综合推荐、预测比分、全部 EV。

> **JSON 必填**：`success` 时必须同时填写 `handicap_recommendation` / `handicap_probability` / `handicap_ev` 与 `ou_recommendation` / `ou_probability` / `ou_ev` 六个字段。

**⚠️ 存档（强制）**：预测完成后必须将比赛ID、联赛、盘口、让球盘推荐、大小球盘推荐、预测比分写入 `F:\Workbuddy\soccer\.workbuddy\memory\football-match-history.md`，状态标记"待确认"。不存档 = 工作流未完成。

## 工作流三：赛后复盘

用户提供赛果或请求复盘时触发，详见 [review-framework.md](references/review-framework.md)：

1. 回顾赛前数据与预测
2. 偏差分析：预测 vs 实际
3. 定位预测错误根因
4. **自动优化**：按误差调整特征权重
5. 保存框架更新与比赛历史（跨会话持久化）
6. 输出累计准确率统计

**目标**：亚盘与大小球准确率均 ≥ 70%。

## 参考文档

- [data-collection.md](references/data-collection.md) - 数据采集指南
- [prediction-framework.md](references/prediction-framework.md) - 预测分析框架
- [review-framework.md](references/review-framework.md) - 赛后复盘与学习框架
