/*
请更新！
新增功能：评估字段与 PRD 对齐（6 维输入 + 输出 Recommendation 字段）
调整行数：约 +70 行
*/
import { nowISO, uid } from "./utils.js";

export const STORAGE_KEY = "TS_V1_DB";
export const SCHEMA_VERSION = "1.0.4";

export const Defaults = {
  assetStatuses: ["待建仓", "观察", "持仓", "清仓"],
  buildReasons: ["长期逻辑", "事件驱动", "右侧突破", "回踩确认", "估值性价比", "仓位管理"],
  industries: ["太空", "AI", "核能", "半导体", "加密", "其他"]
};

export const Enums = {
  AssessmentType: ["开仓评估", "持仓再评估", "减仓/止盈", "对冲", "紧急补齐"],

  ReBuyTier: ["0–25%", "25–50%", "50–75%", "75–100%", "不适用"],
  Risk3: ["低", "中", "高"],
  Capital: ["充足", "有限", "没有"],
  KeyLevel: ["突破前高", "回踩确认", "跌破关键位", "中性"],

  StrategyFit: ["趋势跟随", "事件驱动", "均值回归", "仓位再平衡"],
  Conflict: ["不冲突", "轻微", "显著"],

  OutcomeTier: ["A", "B", "C", "D"],
  RecType: ["保持", "减暴露", "锁定利润（分批）", "保护性对冲", "设条件等待"],
  RecStrength: ["建议", "强建议", "必须评估后才能增加暴露"],

  AssessStatus: ["草稿", "已提交", "已生成建议"],

  ActionType: ["加仓", "减仓", "止盈", "止损", "对冲", "其他"],
  ActionStatus: ["计划", "已执行", "已复盘"]
};

export function defaultConfig() {
  return {
    assetStatuses: [...Defaults.assetStatuses],
    buildReasons: [...Defaults.buildReasons],
    industries: [...Defaults.industries]
  };
}

export function defaultDB() {
  const t = nowISO();
  return {
    meta: {
      version: SCHEMA_VERSION,
      createdAt: t,
      updatedAt: t,
      lang: "zh",
      config: defaultConfig()
    },
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

  const tsla = {
    id: uid("asset"),
    symbol: "TSLA",
    status: "持仓",
    industry: "AI",
    buildReasons: ["长期逻辑"],
    thesis: "示例：把空仓立场产品化。",
    planQty: 200,
    holdingQty: 150,
    openedAt: t,
    closedAt: null,
    createdAt: t,
    updatedAt: t
  };
  db.assets.push(tsla);

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