# Changelog

## [1.5.0] - 2026-09-11

- **数据源唯一化（用户指令）**：预测数据采集**只使用 titan007**，禁用 SportScore / OddsPortal / BetExplorer / nowgoal / aiscore 等替代源。
- 补齐 titan007 盘口正确入口（此前一直用错 URL，导致多轮改用第三方站）：
  - 亚盘 `https://vip.titan007.com/AsianOdds_n.aspx?id={match_id}`
  - 大小球 `https://vip.titan007.com/OverDown_n.aspx?id={match_id}`
  - 欧赔 `https://op1.titan007.com/oddslist/{match_id}.htm`
  - 基本面 `https://zq.titan007.com/analysis/{match_id}cn.htm`
  - 取 ID `https://live.titan007.com/`（ID 在 `addConcern({id},10)` 中）
- 记录已确认 404 的错误入口（`zq.titan007.com/asia/{id}.htm`、`vip.titan007.com/Odds_n.aspx`、`vip.titan007.com/EuroOdds_n.aspx`），避免重复踩坑。
- 明确 titan007 水位为**港盘**，EV 计算前必须 +1 换算；盘口中文对照表（平手/半球=±0.25 等）。
- titan007 未收录的场次：用业务日+序号作 match_id，判 `waiting`，**不得**改用其他源或估测。

## [1.4.0] - 2026-09-11

基于 2026-09-10 欧冠联赛阶段第 1 轮最后 6 场复盘（让球 0/4、大小球 2/5、方向 2/6、比分 0/6），沉淀规则 64–67 并修订 59/61/62/63：

### Added
- **规则64 深盘打穿 4/4，优先级反转**：巴萨 −3、巴黎 −3.5、拜仁 −3.0、曼联 −2.75 全部打穿，而我们 4 次因回避深盘站受让方 → 0/4。**|盘口| ≥2.5 时规则63 优先于规则59**，不打 8 折、不因整数封顶；规则63 由"待验证"升级为"已验证（4/4）"
- **规则65 欧冠让球盘不再是有效维度**：三轮累计 3/18 (16.7%)，远低于随机水平。除深盘例外外一律写"不推荐"，价值发现转向大小球与方向
- **规则66 用方差而非均值定盘**：欧冠进球呈双峰（09-10 六场 2/2/5/4/5/5，0 场 3 球），赛事级 λ 校准 100% 准确但逐场仅 2/6。σ ≥1.5 的高方差场次盘口线放宽 ±0.5 或改推"大球 + 让球方"组合
- **规则67 方向可靠性强弱门槛**：方向权重上调仅限强弱悬殊场（1X2 最低赔 ≤1.50 或最高赔 ≥4.50）；势均力敌场须显式列平局概率，≥25% 时不得给方向推荐；新增"中等信息密度"层级（欧冠正赛但含非五大联赛球队）

### Changed
- **规则59 作用域限定**：仅适用于 |盘口| ≤2.0 的让球盘与大小球整数线（2.0/3.0/4.0），不得套用于深盘
- **规则61 回落条款收紧**：回落 +0.2 须同时满足"双方近 5 场场均总进球**均** <2.0"+"非跨联赛遭遇战"+"修正后 λ ≥2.5"；**禁止推小 3.25 以下**（原宽松条件在 09-10 误触发 2 次，直接造成科莫场与费内巴切场双墨）
- **规则62 新增中等层级**：方向权重上调限于双方均五大联赛的欧冠正赛
- **负 EV 硬门槛扩展至大小球**；新增 **EV 0 ~ +6% 须标注"低价值，建议观望"**

## [1.3.0] - 2026-09-10

### Added
基于 2026-09-09 共 14 场（日联杯 7 + 澳足总杯 1 + 欧冠 6）批量复盘，沉淀规则 59–63：

- **规则59 整数盘走水陷阱**：`prediction-framework.md` 全局铁律与 `jingcai-daily/SKILL.md` 新增批量推荐纪律——优先 ±0.25/±0.75/±1.25 等分拆盘；±1.0/±2.0 让球盘与大小球 3.0 整数线 EV 打 8 折且不超过 ★★★（历史三轮整数让球盘走水 6/9）
- **规则60 比分同质化**：同一批次同一比分最多 2 次；低进球场次须给 2–3 个并列候选并标注主候选，禁止因判断小球硬编码 1-1
- **规则61 欧冠 λ 修正上调**：联赛阶段第 1–2 轮 λ总 由 +0.3 上调至 **+0.5**（09-09 单轮场均 4.17 球）；双方近 5 场场均总进球 <2.0 或一方连续零封时回落至 +0.2
- **规则62 信息密度分层**：高信息密度（五大联赛/欧冠正赛/焦点战）方向与比分可上调权重；低信息密度（J3/JFL 联赛杯、新赛季前杯赛）只输出大小球与盘口，方向与比分标注不可靠
- **规则63 深盘条件放宽（待验证）**：λ 已上调 + 跨级断层 + 总进球预期 ≥3.5 三条件齐备时，-2.5 以上深盘可给至 ★★★

### Changed
- **负 EV 不进推荐栏**：让球盘 EV < 0 时只写进"不推荐原因/观望"栏，不得作为推荐输出
- 规则56 适用范围限定为**欧冠联赛阶段**，不得外推到日联杯等低信息密度赛事

## [1.2.0] - 2026-09-09

### Changed
- **让球盘口径统一为亚洲盘**：不论该场是否为竞足（中国竞彩）在售场次，让球盘的盘口、水位、走势、EV 与复盘结算一律使用亚盘数据；竞彩让球胜平负（让胜/让平/让负）降级为报告中的对照附注，不参与推荐与命中统计
- 走水（本金返还）与四分盘赢半/输半的结算规则写入 `prediction-framework.md`、`review-framework.md`
- 亚盘数据缺失时让球盘判 `waiting` 或降为参考，禁止用竞彩让球盘、欧赔换算或大小球替代
- 同步更新：`soccer-predict/SKILL.md`、`references/prediction-framework.md`、`references/review-framework.md`、`jingcai-daily/SKILL.md`、`jingcai-daily/references/result-contract.md`

## [1.1.0] - 2026-09-07

### Changed
- 精简 `prediction-framework.md`、`soccer-predict/SKILL.md`、`jingcai-daily/SKILL.md` 表述，压缩重复说明；保留全部权重表、公式、防守伤停规则、存档与 JSON 约束等硬性规则
- GitHub 推送改为人工触发：预测流程结束并归档后不再自动 push，仅在用户显式下达推送指令时执行
- `result-contract.md` 同步移除自动推送描述

## [1.0.0] - 2026-04-13

### Added
- Initial release
- 5-step quantitative analysis framework
- Automated data scraping from titan007.com
- Asian handicap and over/under prediction models
- Dual output modes (concise / visual)
- Post-match review with auto weight optimization
- ClawHub and GitHub distribution
