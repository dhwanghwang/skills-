# Data Collection Guide

## Table of Contents
1. [Data Source](#data-source)
2. [Input Formats](#input-formats)
3. [Data Points to Extract](#data-points-to-extract)
4. [Extraction Procedure](#extraction-procedure)

## Data Source

**唯一指定数据源：titan007（新球体育 / 球探体育）。禁止用其他站点（SportScore / OddsPortal / BetExplorer / nowgoal / aiscore 等）的盘口数据替代或顶替。**

> 2026-09-11 用户指令固化：后续所有预测**只抓 titan007**。titan007 未收录或某类盘口缺失时，该场/该维度判 `waiting` 并留空，**不得**改用其他来源，也不得估测。

### 已验证可用入口（2026-09-11 实测通过，全部用 WebFetch）

| 用途 | URL | 返回内容 |
|---|---|---|
| **基本面主源** | `https://zq.titan007.com/analysis/{match_id}cn.htm` | 对赛往绩、近期战绩、联赛盘路走势（主/客/全场/半场赢盘率与大球率）、相同盘路、进球数/单双、未来赛程 |
| **亚盘（让球盘）** | `https://vip.titan007.com/AsianOdds_n.aspx?id={match_id}` | 15 家公司 ×（初盘/即时）盘口 + 主客水位，附即时变化流水 |
| **大小球** | `https://vip.titan007.com/OverDown_n.aspx?id={match_id}` | 15 家公司 ×（初盘/即时）进球数线 + 大球/小球水位，附变化流水 |
| **欧赔（胜平负）** | `https://op1.titan007.com/oddslist/{match_id}.htm` | 百家欧指：主胜/和/客胜即时赔率 + 主和客胜率 + 返还率 + 凯利指数 |
| **赛程/取 ID** | `https://live.titan007.com/` | 当日全部比赛；ID 出现在 `javascript:addConcern({id},10)` 与 `MatchVIP.aspx?id={id}` 中 |
| 比赛详情 | `https://live.titan007.com/detail/{match_id}cn.htm` | 逐场赛果与过程数据 |

### 已确认失效的入口（勿再使用）

| 错误 URL | 结果 |
|---|---|
| `https://zq.titan007.com/asia/{id}.htm` | **404** |
| `https://www.titan007.com/cn/AsianOdds.aspx?ScheduleID={id}` | 无数据 |
| `https://vip.titan007.com/Odds_n.aspx?id={id}` | **404** |
| `https://vip.titan007.com/EuroOdds_n.aspx?id={id}` | **404** |

### 抓取方式与两个必知约定

1. **必须用 WebFetch**：curl / Bash 请求 titan007 会 TLS 握手失败。
2. **水位是港盘，需换算**：titan007 亚盘页的水位是不含本金的港盘（如 `0.92`），**EV 计算前必须 +1 换算为含本金小数盘**（`0.92 → 1.92`）。欧赔页的赔率则是正常的含本金小数赔，不换算。
3. **盘口中文对照**：平手=0｜平手/半球=±0.25｜半球=±0.5｜半球/一球=±0.75｜一球=±1｜一球/球半=±1.25｜球半=±1.5｜球半/两球=±1.75｜两球=±2｜两球/两球半=±2.25｜两球半=±2.5｜两球半/三球=±2.75｜三球=±3。带 `*`（如 `*平/半`）表示即时盘。
4. **基准公司**：以 **澳\***（澳门）与 **Crow\***（Crown）即时盘为准；记录时同时给出两家以便交叉。

### titan007 未收录时的处理

- live.titan007.com 找不到该场 → **无 titan007 ID**，用 `业务日+序号` 作 match_id（如 `20260911001`），`analysis_status` 判 `waiting`，让球盘字段留空，并在 `missing_data` 注明"titan007 未收录，无亚盘报价"。
- 仅在 titan007 页面整体打不开（站点故障）时，才允许临时换源，且必须在报告中显式标注"titan007 不可用，本次改用 XXX 临时源"。

## Input Formats

Accept either format from user:
- **Match ID only**: e.g. `2908467` -> construct URL `https://zq.titan007.com/analysis/2908467cn.htm`
- **Match description**: e.g. `2026.3.15 09:30 美职业 皇家盐湖城vs奥斯丁` -> search or confirm match ID with user

## Data Points to Extract

### 1. Asian Handicap (让球盘)
- Extract only rows labeled "即" (instant/live) and "早" (early/opening)
- Fields: home odds, handicap line, away odds
- Note which team is giving the handicap
- Record all available bookmaker data

### 2. Over/Under (大小球盘)
- Extract only rows labeled "即" (instant/live) and "早" (early/opening)
- Fields: over odds, total goals line, under odds
- Record all available bookmaker data

### 3. European Odds (欧赔胜平负)
- Extract only rows labeled "即" (instant/live) and "早" (early/opening)
- Fields: home win odds, draw odds, away win odds
- Record all available bookmaker data (at least top 10)

### 4. Team Fundamentals & History (基本面信息)

#### Core Fundamentals (核心基本面)
- Recent form (last 5-10 matches: W/D/L, goals scored/conceded)
- Home/away performance (home win rate / away win rate)
- Season total goals scored / conceded (and per-game average)
- Home/away goals scored / conceded separately
- Last 10 same-venue matches (home team: last 10 home; away team: last 10 away)

#### Head-to-Head History (历史交锋)
- All available historical matches between these two teams
- Recent 3-5 years of H2H records: W/D/L, goal trends
- Average goals in H2H matches

#### League Standings (联赛排名)
- Current league table position for both teams
- Points gap between teams
- Games played difference

#### Match Importance (比赛重要性)
- Both teams' motivation for this match
- Relegation battle / title race / playoff implications
- Recent scheduling (double headers, fatigue factors)

### 5. Lineups & Detailed Data (首发阵容与详细数据)

#### IMPORTANT: Lineup Timing
- **Note**: Starting lineups are typically published 30-60 minutes before match kickoff
- If collecting data earlier than this window, mark lineup data as "not yet available"
- Re-check for lineups closer to kickoff time if user requests update
- If lineup not available, proceed with prediction using available squad depth info from bench

#### When Available, Extract:
- Starting XI for both teams
- Key player stats (goals/assists this season)
- Injury/suspension list (especially core players - impact assessment)
- Bench strength / notable substitutes

#### Enhanced Data for Over/Under (大小球增强)
- Half-time goals data (半场进球数/模式)
- Corner kicks statistics (角球数据)
- Goal difference distribution (净胜球分布: 净胜2+/1/0/-1/-2+)

## Extraction Procedure

### 标准抓取顺序（4 次 WebFetch，全部命中 titan007）

1. **取 ID**：WebFetch `https://live.titan007.com/` → 从 `addConcern({id},10)` 提取 7 位 match_id（含日期与开赛时间、赛事名、队名）
2. **基本面**：WebFetch `https://zq.titan007.com/analysis/{id}cn.htm`
   → 对赛往绩、近期战绩（含比分/盘口/大小球结果）、联赛盘路走势（全场+半场、主/客拆分赢盘率与大球率）、相同盘路、进球数/单双、未来赛程
   （一次问清，不要重复抓取）
3. **亚盘**：WebFetch `https://vip.titan007.com/AsianOdds_n.aspx?id={id}`
   → 取澳\*与 Crow\*的**即时**盘口与主客水位（港盘，+1 换算）
4. **大小球**：WebFetch `https://vip.titan007.com/OverDown_n.aspx?id={id}`
   → 取即时进球数线与大球/小球水位
5. **欧赔**：WebFetch `https://op1.titan007.com/oddslist/{id}.htm`
   → 取主流公司即时主胜/和/客胜，及页尾的即时平均值与返还率（可直接用于去水位概率）
6. **首发阵容**：开赛前 30–60 分钟才公布，未公布标"待公布"，不得编造；可另查伤停
7. 汇总成结构化数据后再进入五步预测

### 注意事项
- 亚盘/大小球页的公司名被脱敏（`澳*`、`Crow*`、`36*`），这是正常的，按原样记录即可。
- 页面底部有**即时变化流水**（时间 + 盘口 + 水位），可用于判断早→即走势方向，必读。
- 欧赔页尾的"即时平均值"已含主/和/客胜率与返还率，可直接作为市场基准概率，无需自行计算。
- 若某一步 WebFetch 返回 404，先核对 URL 是否为上表中的**已验证入口**，勿改用其他站点。
