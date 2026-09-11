---
name: jingcai-daily
description: >
  每日竞彩足球批量分析、赔率刷新和批量复盘工作流。用户要求分析今天、明天或指定日期的全部/多场竞彩，
  刷新当日赔率、临场复测，或复盘一批竞彩场次时使用。按中国竞彩业务日（Asia/Shanghai 当日11:00
  至次日11:00）获取并核验尚未开赛场次，逐场调用 soccer-predict，生成日期目录下的单场报告、
  结构化结果、汇总报告与幂等历史归档。GitHub 推送默认不执行，由用户显式触发。多场任务优先使用
  具有独立写入范围的 subagent 并行分析；单场比赛、单个 match ID 或单场盘口问题优先使用 soccer-predict。
---

# 竞彩日分析工作流

把一批比赛作为可核验、可重跑、失败可恢复的任务处理：先冻结比赛集合，再逐场分析，最后由主 agent
统一校验、发布、汇总和归档。不因单场抓取失败虚构结论，不把已开赛场次包装成赛前预测。

## 开始前

1. 完整读取项目级 `$soccer-predict` 及所需参考文档，作为单场分析引擎。
2. 读取 [references/result-contract.md](references/result-contract.md)，按字段与状态契约生成结果。
3. 项目根路径固定 `F:\Workbuddy\soccer`，`soccer-prediction-journal/` 在其下；所有报告和历史只写入该仓库，不写入 skill 目录。

## 业务日与运行参数

- 时区 `Asia/Shanghai`。用户指定日期记为 `{business_date}`，未指定用当前系统日期。
- 竞彩业务窗口不是自然日：`{business_start}` = `{business_date} 11:00:00+08:00`，`{business_end}` = `{business_date + 1d} 11:00:00+08:00`；仅当 `{business_start} <= kickoff_time < {business_end}` 时比赛属于该业务日。
- 执行开始时间记为 `{now}`，运行标识 `{run_id}` 建议格式 `YYYYMMDDTHHMMSS+0800`。
- `kickoff_time` 必须含完整年月日与 `+08:00` 偏移，不能只存网页上的月日或时分。
- "销售截止/已截止" ≠ 已开赛；赛前资格由实际开球时间与比赛状态共同决定。
- 用户说"全部""所有比赛"时核验后的候选清单可视为已确认；范围不明确时先展示清单等待确认。
- 单场请求、单个 match ID、单场盘口问题交给 `$soccer-predict`；本技能只编排多场任务。
- 报告只返回可点击的本地文件链接，不自动打开浏览器或文件。

### 让球盘口径（强制，全流程适用）

- **数据源唯一：titan007**。亚盘、大小球、欧赔、基本面**全部**取自 titan007（2026-09-11 用户指令）。正确入口：亚盘 `vip.titan007.com/AsianOdds_n.aspx?id={id}`、大小球 `vip.titan007.com/OverDown_n.aspx?id={id}`、欧赔 `op1.titan007.com/oddslist/{id}.htm`、基本面 `zq.titan007.com/analysis/{id}cn.htm`。**禁用** SportScore / OddsPortal / BetExplorer / nowgoal / aiscore 等替代；titan007 未收录即判 `waiting`。注意亚盘水位是港盘，EV 计算前 **+1 换算**。
- **让球盘一律使用亚洲盘（亚盘）数据**：盘口、即时水位、早→即走势均取自 titan007 亚盘页面，与是否为竞足在售场次**无关**。竞足场次同样以亚盘为唯一推荐与结算口径。
- **竞彩让球胜平负（让胜/让平/让负）不是推荐口径**，仅在单场报告与日汇总中作为"竞彩对照"附注；其无走水保护（±1 遇净胜 1 球判让平即输），与亚盘结论冲突时**以亚盘为准**并显式标注差异。
- 亚盘结算规则：整数盘口净胜球恰好等于盘口 = 走水（本金返还，不计胜负）；四分盘（-0.75/-1.25 等）按赢半 / 输半；EV 计算与命中统计同口径。
- 某场抓不到亚盘或亚盘数据不可靠时，该场让球盘判 `waiting` 或降为参考，**禁止**用竞彩让球盘、欧赔换算或大小球替代填充。

### 批量推荐纪律（规则59/60/62，全批次适用）

- **回避整数盘（规则59，作用域已限定）**：**仅适用于 |盘口| ≤ 2.0 的让球盘与大小球整数线（2.0/3.0/4.0）**——09-09 单日 4 个整数盘全部走水，09-10 曼联大小球 4.0 被回避后实际恰 4 球走水（累计 5/5）。批次内优先选 ±0.25 / ±0.5 / ±0.75 / ±1.25 等分拆盘与非整数大小球线；确为整数盘/整数线的推荐 **EV 打 8 折**且不超过 ★★，日汇总里单列"整数盘走水风险"。⚠️ **|盘口| ≥2.5 的深盘不适用本条**（见规则63）。
- **深盘例外（规则63，已验证 4/4）**：同时满足 "λ 已上调 + 跨级/跨联赛断层 + 总进球预期 ≥3.5" 时，|盘口| ≥2.5 的深盘**可给至 ★★★**，须同步给出"让球方进 ≥4 球"概率校验。实证：巴萨 −3、巴黎 −3.5、拜仁 −3.0、曼联 −2.75 **全部打穿**，而 4 次回避深盘改站受让方 → 0/4。此时规则63 **优先于**规则59，不打 8 折。
- **负 EV 不进推荐栏（已扩展至大小球）**：让球盘与大小球 EV < 0 时均不得出现在推荐栏，只写进"不推荐原因/观望"栏；日汇总推荐表不得收录负 EV 场次。**EV 在 0 ~ +6% 之间须标注"低价值，建议观望"**。
- **比分不得同质化（规则60）**：同一批次同一比分最多出现 2 次。禁止因判断小球就统一输出 1-1；低进球场次须给 2–3 个并列候选并标注主候选。
- **信息密度分层（规则62）**：批次建立时给每场打标签——
  - **高**（五大联赛、欧冠正赛**且双方均五大联赛**、焦点战）：方向与比分可入主推；
  - **中**（欧冠正赛但含非五大联赛球队，如布拉格斯拉维亚、博德闪耀、加拉塔萨雷、沙巴巴库）：方向权重不上调；
  - **低**（J3/JFL 联赛杯、新赛季前杯赛、跨级别低关注度赛事）：**只输出大小球与盘口**，方向与比分标"低信息密度·不可靠"，不入主推。
  - **方向强弱门槛（规则67）**：方向权重上调仅限**强弱悬殊场**（1X2 最低赔 ≤1.50 或最高赔 ≥4.50）。**势均力敌场**（1X2 至少两项落在 2.00–4.00）方向权重下调 1 档，**必须显式列出平局概率，且平局概率 ≥25% 时不得给方向推荐**。
- **欧冠联赛阶段特殊处理（规则61/65/66）**：第 1–2 轮 λ总 在联赛均值基础上 **+0.5**；回落至 +0.2 须**同时**满足"双方近 5 场场均总进球**均** <2.0"+"非跨联赛遭遇战"+"修正后 λ ≥2.5"（原宽松条件在 09-10 误触发 2 次造成双墨），且**禁止推小 3.25 以下**。**让球盘已不是有效维度（三轮 3/18 = 16.7%）**：除"|盘口| ≥2.5 且满足规则63 三条件"外一律写"不推荐"。**用方差而非均值定盘**：σ ≥1.5 的高方差场次盘口线放宽 ±0.5 或改推"大球 + 让球方"组合。

## Step 1：获取、标准化并冻结比赛清单

### 数据入口

首选 `https://aiplus.titan007.com/ai/pc/spf`；不可访问或无法提取可靠比赛 ID、开球时间、状态与赔率时，备用 `https://cp.titan007.com/buy/JingCai.aspx`。

页面契约（避免把展示字段误当真实数据）：

- AI 预测页按"当日 11:00 至次日 11:00"分组；通常可从 `schedule_<match_id>` 提取比赛 ID。
- AI 预测页 `-` 通常表示未开赛；比分、分钟或"上/中/下"表示已开始。状态文案变化时同时核对比分与实际开球时间，不只依赖单个符号。
- 备用竞彩页可能默认展示"截止"时间，必须切换/读取"开赛"时间或用详情页核验，绝不能把销售截止时间写入 `kickoff_time`。
- 备用页可从亚盘、欧赔或详情链接的数字 ID 交叉核验 match ID。

### 标准化与筛选

1. 提取竞彩编号、match ID、联赛、主客队、实际开球时间、状态、胜平负与让球赔率（竞彩让球仅作对照，推荐口径见上文"让球盘口径"）、来源 URL、采集时间。
2. 只把业务窗口内、`kickoff_time > now`、状态明确未开赛的记录列为候选。
3. 已开赛、完场、取消、明确延期的进入排除清单；销售截止但未开赛仍可分析并标注销售状态。
4. 状态或开球时间无法可靠核验的列为 `waiting_verification`，不进入正式分析。
5. 按 `business_date + match_id` 去重；合并重复时保留来源列表，优先采用时间更新、字段更完整且可交叉核验的值。
6. match ID 必须为数字，主客队与完整开球时间必须存在；关键字段缺失进入异常清单。
7. 无候选场次时报告业务窗口、数据源、筛选统计与排除原因后停止，不拿其他业务日补齐。

创建运行目录 `soccer-prediction-journal/reports/{business_date}/runs/{run_id}/`，逐场分析前写入初始 `run-manifest.json` 冻结候选与排除清单；之后页面新增或变化的比赛不静默加入，需要时创建新运行。

向用户展示候选清单：竞彩编号、match ID、完整开球时间、联赛、对阵、胜平负赔率、让球赔率（竞彩让球仅对照，正式推荐一律取亚盘）、状态、来源、采集时间，并给出原始数、去重后数量、候选数、待核验数与各类排除数量。

## Step 2：缓存判定与逐场分析

### 固定产物路径

用 match ID 作为唯一稳定文件名，不用可能随队名变化的 slug：

- 正式 Markdown：`reports/{business_date}/match-{match_id}.md`
- 正式 JSON：`reports/{business_date}/match-{match_id}.json`
- 本次尝试 Markdown：`reports/{business_date}/runs/{run_id}/match-{match_id}.md`
- 本次尝试 JSON：`reports/{business_date}/runs/{run_id}/match-{match_id}.json`

### 普通运行与刷新

- 普通运行仅当正式 Markdown 存在、正式 JSON 的 `analysis_status` 为 `success`、业务日与 match ID 匹配且历史条目完整时才复用，设 `run_action=reused`。
- 任一正式产物缺失、JSON 无法解析、状态非 `success`、路径不合规或历史条目不完整时重新分析，设 `run_action=generated`。
- 用户要求刷新赔率、重新分析或临场复测时设 `run_action=refreshed`，始终重新采集；旧正式产物在新尝试通过校验前保持不变。
- `skipped` 不是分析状态：分析质量用 `analysis_status`，本次动作用 manifest 的 `run_action`，正式 JSON 用 `artifact_action` 记录产物最初由生成还是刷新产生。

### 并行执行

- 待分析场次 N >= 2 且有多智能体能力时必须优先 subagent 并行，不要先在主 agent 串行跑完再补建并发；只有无多智能体能力、槽位为 1 或用户明确要求串行时才在当前任务内逐场执行。
- 先读取可用并发槽位，按"每场一个分析单元、超出槽位均衡分组"派发；每个单元只写自己的运行目录文件，不写共享文件。主 agent 负责冻结、分配、回收、校验、发布、汇总、归档。
- 不要用 `create_thread` 创建用户可见任务，除非用户明确要求。

### 分配与回收纪律

1. 设待分析 N 场、可用子智能体 W 个，实际并发 `min(N, W)`，不得超过运行环境槽位上限，也不得为凑并发重复创建线程。N <= W 时每个子智能体负责一场；N > W 时均衡分组，使各子智能体场次数相差不超过 1。分组优先保持数量均衡，同联赛或相近开球时间同组仅作可选优化，不得因此改变候选集合或跳过比赛。
2. 每个分配消息必须列出该子智能体的全部 match ID、竞彩编号、开球时间、主客队、business_date、run_id 与每场固定尝试路径；子智能体必须逐场处理完整个分组，不能只抓盘口后提前结束。
3. **完成条件**：每场走完完整五步预测并提交结果——基本面、伤停/首发、欧赔、亚盘、大小球、模型概率、胜平负、竞彩让球胜平负、预测比分、EV/价值判断、冷门与失效条件，以及该场 JSON 和完整 Markdown；**每场必须同时给出让球盘与大小球推荐**（各含方向、盘口、概率、EV，对应 `handicap_*` 与 `ou_*` 字段）。
4. 子智能体可并行抓取不同比赛，但不得并行写同一场的 JSON/Markdown，不得修改 run-manifest.json、历史、联赛资料或预测框架；每个 match ID 在运行目录只能有一份结果。
5. 派发后主 agent 须建 `match_id -> worker -> status` 回收表并持续等待：pending_init、running、"已写入部分产物未返回终态"都不是失败，不得在这些状态下 close_agent 或 interrupt。仅当明确 errored / interrupted 且确认该场未完成时，才把 match ID 重新分配给空闲槽位；不得让两个子智能体重写同一场。
6. worker 返回 completed 后仍须读取并校验其 JSON/Markdown，确认读取完成、校验通过并记录结果后才可关闭；交付文件存在不等于已返回终态。等待期间用户追加问题时，先报告仍在等待的 worker 与已收到的交付，再继续等待。

向每个分析单元传递以下契约（单场填一个 match_id，分组列出全部并逐一展开固定尝试路径）：

```text
使用 $soccer-predict 预测比赛 {match_id}，完成完整五步分析和 Markdown 报告。
业务日期：{business_date}
业务窗口：{business_start} 至 {business_end}
已核验开球时间：{kickoff_time}

这是 batch_mode=true、archive_mode=parent 的批量调用。
使用 soccer-predict 的数据采集、模型和报告规则，但本调用由父级工作流接管归档阶段：
不要执行其单场模式的强制历史归档，不要修改 football-match-history.md、
football-league-profiles.md 或 prediction-framework.md，汇总由主 agent 负责。

本次尝试 Markdown：soccer-prediction-journal/reports/{business_date}/runs/{run_id}/match-{match_id}.md
本次尝试 JSON：soccer-prediction-journal/reports/{business_date}/runs/{run_id}/match-{match_id}.json
正式路径由主 agent 校验后发布，分析单元不得直接覆盖正式文件。

JSON 是每场必需产物，必须符合 jingcai-daily/references/result-contract.md。
success 必须同时生成完整 Markdown；waiting、incomplete 或 failed 仍必须生成 JSON，Markdown 可省略。
success 时 JSON 必须填写让球盘（handicap_recommendation/handicap_probability/handicap_ev）
和大小球盘（ou_recommendation/ou_probability/ou_ev）两组字段，不可留空。
如果分析单元无法写 JSON，返回完整 JSON payload，由主 agent 写入运行目录。
关键赔率、开球状态、阵容或独立核验数据缺失时，不得给出高置信度正式推荐。
```

主 agent 必须保证每个候选 match ID 最终有且只有一个结果 JSON；分析单元完全失败时由主 agent 生成 `analysis_status=failed` 的 JSON 并保留错误信息。

## Step 3：校验、发布、汇总和归档

### 3.1 完整性校验

所有分析单元返回后补齐 `run-manifest.json`，再运行：

```text
python F:\Workbuddy\soccer\skills\jingcai-daily\scripts\validate_run.py \
  --project-root F:\Workbuddy\soccer \
  --manifest soccer-prediction-journal/reports/{business_date}/runs/{run_id}/run-manifest.json \
  --phase attempt
```

校验失败时先修复 manifest 或运行产物，不生成成功汇总，也不写历史。

### 3.2 安全发布

- `generated/refreshed + success`：本次 JSON 与 Markdown 都通过校验后，才在同一文件系统内替换对应正式文件。
- `reused + success`：保留正式文件，不重复复制或改写历史。
- `waiting/incomplete/failed`：保留运行 JSON，不发布为正式结果，也不改写已有成功产物。
- 刷新失败时在 manifest 和汇总标记 `previous_success_retained=true`；旧报告只能作为"上次成功版本"展示，不能冒充本次刷新成功。
- 发布后更新 manifest 中的正式路径为实际路径，并以 `--phase final` 再校验一次。

### 3.3 汇总

1. 候选清单中每个 match ID 必须恰好对应一个结果；重复、遗漏或目录外路径都视为运行不完整。
2. 所有 `analysis_status=success` 的结果进入正式汇总，包括 `run_action=reused`。
3. `waiting`、`incomplete`、`failed` 单独列出原因；刷新失败且保留旧版本时明确标注旧版本时间。
4. 汇总以 Markdown 表格直接返回给用户，含业务窗口、运行 ID、赔率截点、来源、状态与动作统计、推荐、失败清单、报告链接和免责声明。**每场必须同时展示让球盘与大小球推荐**（含概率）：

```markdown
| # | 时间 | 联赛 | 对阵 | 让球盘推荐（亚盘） | 概率 | 大小球推荐 | 概率 | 比分 |
|---|------|------|------|------|:---:|------|:---:|------|
| 001 | 21:00 | 瑞典超 | 赫根 vs 卡尔马 | 赫根 -1 @1.85 | 56% | 大 2.5 @1.90 | 58% | 2-0 |
```

5. 汇总产物写入 `reports/{business_date}/`，必须同时生成两种格式：`daily-summary.json`（结构化汇总：schema_version、日期、窗口、run_id、统计、逐场双盘推荐、串关、高价值、报告路径）与 `daily-summary.md`（人类可读，内容与返回用户的表格一致）。两种缺一不可。

### 3.4 历史归档与旧数据兼容

只有主 agent 写入 `F:\Workbuddy\soccer\.workbuddy\memory\football-match-history.md`，只归档本次 `generated/refreshed + success`；`reused` 只验证已有条目，不重复写入。稳定键：

`<!-- jingcai-key: {business_date}/{match_id} -->`

归档前按顺序查找：先找完全匹配的稳定键，找到则更新；没有稳定键时在对应业务日章节按 match ID 找旧格式条目，唯一匹配则补上稳定键再更新；同一业务日多个旧格式匹配时不追加第三份，保留旧快照并在 manifest 记录迁移异常，选择明确标注为最近刷新且字段最完整的一条作为当前条目，无法确定时停止该场归档并报告。

当前条目至少保存：业务日期、完整开球时间、分析版本、赔率时间、让球盘推荐（**亚盘盘口+水位**）、大小球盘推荐、预测比分、正式报告路径、预测状态"待确认"和最近刷新原因。归档后重新读取目标段落，确认当前稳定键只出现一次；不为了采用新键批量删除旧历史快照。

### 3.5 GitHub 推送（默认不执行，人工触发）

**流程到此结束，不自动推送。** 归档完成后主 agent 只提示："预测记录已生成，需要推送时说『推送预测记录』"。

收到用户显式推送指令时才按项目级仓库映射执行：

1. 定位 `F:\Workbuddy\soccer\soccer-prediction-journal` 仓库的 main 分支。
2. `git status --short --branch` 确认变更范围；只暂存本次业务日的报告、运行 manifest、汇总文件和本次实际更新的历史条目，禁止 `git add -A` 静默带入无关改动。
3. 推送前 `git fetch origin main`，用 `git rev-list --left-right --count HEAD...origin/main` 确认没有分叉；发现远端领先或已分叉时停止推送并报告，不强制覆盖远端。
4. 提交信息使用简洁稳定格式，例如 `Add {business_date} Jingcai prediction records`；提交前再次检查 staged diff。
5. 直接执行 `git push origin main`；不创建 PR，不把 `gh auth status` 作为前置条件，不改用其他凭据绕过 Git Credential Manager。
6. 推送失败若疑似沙箱网络限制，按平台权限流程申请提升后重试同一 Git 命令；不改写提交或强制推送。
7. 推送后再次 `git fetch origin main`，确认 HEAD 与 origin/main 提交哈希一致且工作区干净；最终回复报告仓库、分支、commit 和同步结果。

## 状态语义与降级

- `success`：关键数据与必要核验完成，JSON 合规且 Markdown 完整，允许进入正式汇总。
- `waiting`：预期可在开球前补齐的临时数据尚未出现（如首发待公布），不发布正式推荐。
- `incomplete`：分析已结束但必要核验仍缺失或已无安全重试窗口，不发布正式推荐。
- `failed`：抓取、工具、文件写入或分析过程发生技术失败。
- 首选页数据质量不合格时也要启用备用页，不只在 HTTP 失败时降级。
- 两个入口都无法形成可靠候选清单时停止逐场分析，报告 URL、时间和失败原因。
- 单场失败不阻塞其他场次，但不得把空伤停表写成"阵容齐整"，不得猜测缺失数据。
- 页面出现矛盾时间时以可核验的实际开球来源为准；无法确认则保持 `waiting_verification`。

## 赛后批量复盘

1. 从历史找出指定业务日或 match ID 的"待确认"记录，核验 90 分钟正式赛果和来源时间。
2. 对每场调用 `$soccer-predict` 复盘流程，沿用 `archive_mode=parent`：分析单元只返回偏差分析、联赛资料建议和权重调整建议，不写共享文件。
3. 主 agent 按 `kickoff_time + match_id` 的稳定顺序串行应用复盘；每处理一场前重新读取最新权重，遵守 soccer-predict 的单场学习护栏，再写回权重和版本。
4. 原地更新带稳定键的历史条目，不为同一场另建赛前条目；没有可靠赛果时保持"待确认"，不更新权重。
5. 复盘结果以 Markdown 表格直接返回：汇总推荐、实际赛果、命中、偏差原因、是否参与学习和累计统计。

## 最终交付

最终回复必须包含：业务窗口、候选/成功/复用/待核验/失败数量、汇总结果（Markdown 表格）、成功场次报告链接、刷新失败但保留旧版本的清单、历史归档结果，以及 GitHub 推送提示（记录已就绪，推送需用户显式触发）。
只提供可点击的本地文件链接，不自动打开报告。
