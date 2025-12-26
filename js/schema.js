import { nowISO, uid } from "./utils.js";

export const STORAGE_KEY = "TS_V1_DB";
export const SCHEMA_VERSION = "1.0.0";

export const Enums = {
  AssetClass: ["Stock", "ETF", "Crypto", "HKStock", "Other"],
  Venue: ["US", "HK", "Crypto", "Other"],
  AssetStatus: ["Active", "Watching", "Archived"],

  PositionStatus: ["Open", "Reduced", "Closed"],
  Account: ["Main", "Sub", "Other"],
  Currency: ["USD", "HKD", "USDT", "Other"],

  TriggerCategory: ["Profit", "Structure", "Capital", "Behavior"],
  RestrictionPolicy: ["BlockAddExposure", "ReminderOnly"],
  TriggerLogStatus: ["Open", "InAssessment", "Completed", "Snoozed"],

  AssessmentType: ["Entry", "PositionReeval", "ExitTrim", "Hedge", "EmergencyBackfill"],
  Tier: ["A", "B", "C", "D"],
  RecType: ["Hold", "ReduceExposure", "LockProfitTranches", "ProtectiveHedge", "WaitWithConditions"],
  RecStrength: ["Suggest", "StrongSuggest", "MustAssessBeforeAddingExposure"],
  AssessStatus: ["Draft", "Submitted", "OutputReady"],

  Risk3: ["Low", "Med", "High"],
  Capital: ["Sufficient", "Limited", "None"],
  KeyLevel: ["Breakout", "Retest", "Breakdown", "Neutral"],
  ReBuyTier: ["T0_25", "T25_50", "T50_75", "T75_100", "NA"],

  ActionType: ["Add", "Reduce", "TakeProfit", "StopLoss", "Hedge", "SellCoveredCall", "SellPut", "Other"],
  ActionStatus: ["Planned", "Executed", "Reviewed"],

  EvidenceType: ["DailyChart", "H4Chart", "WeeklyChart", "Link", "Note"],
  ReviewOutcome: ["Better", "Same", "Worse", "Unknown"],
  ReviewTags: ["Process", "Psychology", "Risk", "Timing", "Sizing", "Thesis"]
};

export function defaultDB() {
  const t = nowISO();
  return {
    meta: { version: SCHEMA_VERSION, createdAt: t, updatedAt: t },
    assets: [],
    positions: [],
    assessments: [],
    triggers: [],
    triggerLogs: [],
    actions: [],
    evidence: [],
    reviews: []
  };
}

export function seedDemoDB() {
  const db = defaultDB();
  const t = nowISO();
  const a1 = { id: uid("asset"), name: "TSLA", ticker: "TSLA", assetClass: "Stock", venue: "US", status: "Active", notes: "示例：特斯拉", createdAt: t, updatedAt: t };
  const a2 = { id: uid("asset"), name: "BTC", ticker: "BTC", assetClass: "Crypto", venue: "Crypto", status: "Watching", notes: "示例：比特币", createdAt: t, updatedAt: t };
  db.assets.push(a1, a2);

  const p1 = { id: uid("pos"), assetId: a1.id, account: "Main", batch: "2025Q4", size: 150, avgCost: 320, currency: "USD", openedAt: t, closedAt: null, status: "Open" };
  db.positions.push(p1);

  const tr1 = { id: uid("tr"), name: "跌破 20D", category: "Structure", conditionSummary: "跌破20日均线 → 需要再评估", restrictionPolicy: "BlockAddExposure", active: true };
  db.triggers.push(tr1);

  const tl1 = { id: uid("tl"), triggerId: tr1.id, assetId: a1.id, firedAt: t, status: "Open", notes: "示例：手动触发" };
  db.triggerLogs.push(tl1);

  db.meta.updatedAt = nowISO();
  return db;
}

export function validateDBShape(db) {
  const keys = ["meta","assets","positions","assessments","triggers","triggerLogs","actions","evidence","reviews"];
  for (const k of keys) {
    if (!(k in db)) return { ok: false, error: `缺少字段: ${k}` };
  }
  if (!db.meta?.version) return { ok: false, error: "缺少 meta.version" };
  if (!Array.isArray(db.assets)) return { ok:false, error: "assets 必须是数组" };
  return { ok: true };
}