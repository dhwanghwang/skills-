# 批量结果契约

本文件定义 `jingcai-daily` 的每场 JSON 和运行 manifest。字段名和状态必须保持稳定，便于主 agent
完成缓存复用、完整性校验、汇总和历史归档。

## 每场结果 JSON

每个候选 match ID 都必须有一个 JSON。`success` 同时需要 Markdown 报告；其他状态允许没有 Markdown。

```json
{
  "schema_version": "1.0",
  "business_date": "2026-08-01",
  "match_id": "2912225",
  "kickoff_time": "2026-08-01T21:00:00+08:00",
  "league": "瑞典超",
  "home_team": "赫根",
  "away_team": "卡尔马",
  "analysis_status": "success",
  "artifact_action": "generated",
  "odds_snapshot_at": "2026-08-01T20:15:00+08:00",
  "analysis_version": "soccer-predict v1.3.9",
  "recommendation": "赫根 -1",
  "probability": 0.56,
  "handicap_recommendation": "赫根 -1 @1.85",
  "handicap_probability": 0.56,
  "handicap_ev": 0.04,
  "ou_recommendation": "大 2.5 @1.90",
  "ou_probability": 0.58,
  "ou_ev": 0.10,
  "predicted_score": "2-0",
  "formal_recommendation": true,
  "report_path": "soccer-prediction-journal/reports/2026-08-01/match-2912225.md",
  "missing_data": [],
  "error": ""
}
```

约束：

- `analysis_status` 只能是 `success|waiting|incomplete|failed`。
- `artifact_action` 只能是 `generated|refreshed|not_run`，表示这份 JSON/Markdown 是怎样产生的。
- `match_id` 必须为纯数字字符串；不要写成 JSON 数字，以免未来 ID 格式变化造成兼容问题。
- `kickoff_time` 和 `odds_snapshot_at` 使用 ISO 8601，并包含 `+08:00`。
- `probability` 为 `0..1` 数值或 `null`。`handicap_probability` 和 `ou_probability` 同理。
- `recommendation` 为综合最佳推荐（让球盘或大小球盘中 EV 最高者）。`handicap_recommendation` 和 `ou_recommendation` 分别为让球盘和大小球盘各自的最佳推荐，格式为"方向 @赔率"。
- `handicap_ev` 和 `ou_ev` 为对应推荐的期望值（EV），可为正/负/零数值或 `null`。
- `missing_data` 始终为数组，`error` 始终为字符串。
- `success` 必须给出正式 `report_path`，且对应 Markdown 完整存在。
- `success` 时 `handicap_recommendation` 和 `ou_recommendation` 不可为空字符串；`waiting/incomplete/failed` 时可为空字符串。
- `waiting/incomplete/failed` 的 `formal_recommendation` 必须为 `false`；可在 `recommendation` 中写"等待首发"或"数据不足，不投注"等非投注结论。
- `reused` 只出现在本次 `run-manifest.json` 的 `run_action` 中；复用时不要改写正式 JSON，正式 JSON 保留原来的 `artifact_action`。

## run-manifest.json

每次运行在 `reports/{business_date}/runs/{run_id}/run-manifest.json` 保存一份 manifest：

```json
{
  "schema_version": "1.0",
  "business_date": "2026-08-01",
  "business_window": {
    "start": "2026-08-01T11:00:00+08:00",
    "end": "2026-08-02T11:00:00+08:00"
  },
  "run_id": "20260801T201500+0800",
  "created_at": "2026-08-01T20:15:00+08:00",
  "candidates": [
    {
      "match_id": "2912225",
      "kickoff_time": "2026-08-01T21:00:00+08:00",
      "league": "瑞典超",
      "home_team": "赫根",
      "away_team": "卡尔马"
    }
  ],
  "excluded": [],
  "results": [
    {
      "match_id": "2912225",
      "analysis_status": "success",
      "run_action": "generated",
      "attempt_result_path": "soccer-prediction-journal/reports/2026-08-01/runs/20260801T201500+0800/match-2912225.json",
      "attempt_report_path": "soccer-prediction-journal/reports/2026-08-01/runs/20260801T201500+0800/match-2912225.md",
      "canonical_result_path": "soccer-prediction-journal/reports/2026-08-01/match-2912225.json",
      "canonical_report_path": "soccer-prediction-journal/reports/2026-08-01/match-2912225.md",
      "previous_success_retained": false,
      "error": ""
    }
  ]
}
```

Manifest 约束：

- `candidates` 中的 match ID 必须唯一；`results` 必须与候选集合一一对应。
- Manifest 的 `run_action` 只能是 `generated|refreshed|reused|not_run`，描述当前这次运行对该场采取的动作。
- `excluded` 不进入 `candidates`，每条需保存 `reason` 和可用的原始字段。
- `generated/refreshed` 总要有 `attempt_result_path`；状态为 `success` 时还必须有 `attempt_report_path`。
- `reused` 不需要本次尝试路径，但必须给出已存在的正式 JSON 和 Markdown 路径。
- 正式路径固定为 `reports/{business_date}/match-{match_id}.json|md`。
- 所有路径使用工作区相对路径，并且必须位于当前业务日目录下；拒绝 `..`、绝对路径和目录外文件。
- 刷新失败时可保留原正式路径，但 `analysis_status` 仍记录本次失败，且 `previous_success_retained=true`。

## 发布顺序

1. 冻结候选并创建 manifest。
2. 写本次尝试 JSON/Markdown，补齐 manifest 的 `results`。
3. 用 `validate_run.py --phase attempt` 校验。
4. 仅发布校验通过的成功产物；失败刷新保留旧正式文件。
5. 更新 manifest 后用 `--phase final` 校验。
6. final 校验通过后再更新汇总和历史。

## 日汇总产物

`reports/{business_date}/` 下的日汇总必须同时生成两种格式，缺一不可：

- `daily-summary.json`：结构化汇总，供程序消费。字段包含 `schema_version`、`date`、`competition`、`window`、`run_id`、`odds_cutoff`、`data_sources`、`total_matches`、`success_matches`、`status_stats`（candidates/success/reused/waiting/incomplete/failed/excluded）、`recommendations`（每场含 jingcai_no、match_id、match、league、kickoff、handicap_recommendation/handicap_probability/handicap_ev、ou_recommendation/ou_probability/ou_ev、predicted_score、confidence、key_reason）、`parlay`、`value_pick`、`high_value`、`report_paths`。
- `daily-summary.md`：人类可读汇总，与返回给用户的 Markdown 汇总一致，包含业务窗口、运行 ID、赔率截点、状态统计、逐场双盘汇总表格（每场必须含让球盘推荐+概率、大小球推荐+概率、预测比分）、核心推荐、报告链接和免责声明。

两文件路径：`reports/{business_date}/daily-summary.json` 与 `reports/{business_date}/daily-summary.md`，随正式报告一起发布并推送 GitHub。
