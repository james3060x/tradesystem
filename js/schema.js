// js/schema.js
// TradeSystem Web - Schema & Validation
// Version: 1.0.0

export const SCHEMA_VERSION = "1.0.0";
export const STORAGE_KEY = "TS_V1_DB";

export const Enums = {
	AssetClass: ["Stock", "ETF", "Crypto", "HKStock", "Other"],
	Venue: ["US", "HK", "Crypto", "Other"],
	AssetStatus: ["Active", "Watching", "Archived"],

	Account: ["Main", "Sub", "Other"],
	Currency: ["USD", "HKD", "USDT", "Other"],
	PositionStatus: ["Open", "Reduced", "Closed"],

	TriggerCategory: ["Profit", "Structure", "Capital", "Behavior"],
	RestrictionPolicy: ["BlockAddExposure", "ReminderOnly"],
	TriggerLogStatus: ["Open", "InAssessment", "Completed", "Snoozed"],

	AssessmentType: ["Entry", "PositionReeval", "ExitTrim", "Hedge", "EmergencyBackfill"],
	RiskTier: ["Low", "Med", "High"],
	CapitalConstraint: ["Sufficient", "Limited", "None"],
	KeyLevelState: ["Breakout", "Retest", "Breakdown", "Neutral"],
	ReBuySizeTier: ["T0_25", "T25_50", "T50_75", "T75_100", "NA"],

	OutcomeTier: ["A", "B", "C", "D"],
	RecommendationType: ["Hold", "ReduceExposure", "LockProfitTranches", "ProtectiveHedge", "WaitWithConditions"],
	RecommendationStrength: ["Suggest", "StrongSuggest", "MustAssessBeforeAddingExposure"],
	AssessmentStatus: ["Draft", "Submitted", "OutputReady"],

	ActionType: ["Add", "Reduce", "TakeProfit", "StopLoss", "Hedge", "SellCoveredCall", "SellPut", "Other"],
	ActionStatus: ["Planned", "Executed", "Reviewed"],

	EvidenceType: ["DailyChart", "H4Chart", "WeeklyChart", "Link", "Note"],

	ReviewOutcome: ["Better", "Same", "Worse", "Unknown"],
	ReviewTag: ["Process", "Psychology", "Risk", "Timing", "Sizing", "Thesis"],
};

export function createEmptyDb(now = new Date()) {
	const iso = now.toISOString();
	return {
		meta: {
			version: SCHEMA_VERSION,
			createdAt: iso,
			updatedAt: iso,
		},
		assets: [],
		positions: [],
		assessments: [],
		triggers: [],
		triggerLogs: [],
		actions: [],
		evidence: [],
		reviews: [],
	};
}

// ---------- validators ----------
function isPlainObject(x) {
	return x !== null && typeof x === "object" && !Array.isArray(x);
}
function isISODateTimeString(s) {
	if (typeof s !== "string" || s.length < 10) return false;
	const d = new Date(s);
	return !Number.isNaN(d.getTime());
}
function assert(condition, message, path, errors) {
	if (!condition) errors.push({ path, message });
}
function assertEnum(value, allowed, path, errors) {
	if (value == null) return;
	assert(allowed.includes(value), `必须是枚举之一：${allowed.join(" | ")}`, path, errors);
}
function assertString(value, path, errors, { required = false } = {}) {
	if (value == null) {
		if (required) errors.push({ path, message: "必填字符串不能为空" });
		return;
	}
	assert(typeof value === "string", "必须是字符串", path, errors);
}
function assertNumber(value, path, errors, { required = false } = {}) {
	if (value == null) {
		if (required) errors.push({ path, message: "必填数字不能为空" });
		return;
	}
	assert(typeof value === "number" && Number.isFinite(value), "必须是有限数字", path, errors);
}
function assertBoolean(value, path, errors, { required = false } = {}) {
	if (value == null) {
		if (required) errors.push({ path, message: "必填布尔值不能为空" });
		return;
	}
	assert(typeof value === "boolean", "必须是布尔值", path, errors);
}
function assertISO(value, path, errors, { required = false } = {}) {
	if (value == null) {
		if (required) errors.push({ path, message: "必填时间不能为空" });
		return;
	}
	assert(isISODateTimeString(value), "必须是 ISO datetime 字符串", path, errors);
}
function assertId(value, path, errors) {
	assertString(value, path, errors, { required: true });
}

// ---------- entity validators ----------
function validateAsset(a, i, errors) {
	const p = `assets[${i}]`;
	assert(isPlainObject(a), "必须是对象", p, errors);
	if (!isPlainObject(a)) return;

	assertId(a.id, `${p}.id`, errors);
	assertString(a.name, `${p}.name`, errors, { required: true });
	assertString(a.ticker, `${p}.ticker`, errors, { required: true });
	assertEnum(a.assetClass, Enums.AssetClass, `${p}.assetClass`, errors);
	assertEnum(a.venue, Enums.Venue, `${p}.venue`, errors);
	assertEnum(a.status, Enums.AssetStatus, `${p}.status`, errors);

	assertString(a.notes, `${p}.notes`, errors);
	assertISO(a.createdAt, `${p}.createdAt`, errors, { required: true });
	assertISO(a.updatedAt, `${p}.updatedAt`, errors, { required: true });
}

function validatePosition(x, i, errors) {
	const p = `positions[${i}]`;
	assert(isPlainObject(x), "必须是对象", p, errors);
	if (!isPlainObject(x)) return;

	assertId(x.id, `${p}.id`, errors);
	assertString(x.assetId, `${p}.assetId`, errors, { required: true });

	assertEnum(x.account, Enums.Account, `${p}.account`, errors);
	assertString(x.batch, `${p}.batch`, errors);

	assertNumber(x.size, `${p}.size`, errors, { required: true });
	assertNumber(x.avgCost, `${p}.avgCost`, errors, { required: true });
	assertEnum(x.currency, Enums.Currency, `${p}.currency`, errors);

	assertISO(x.openedAt, `${p}.openedAt`, errors, { required: true });
	if (x.closedAt !== null && x.closedAt !== undefined) assertISO(x.closedAt, `${p}.closedAt`, errors);

	assertEnum(x.status, Enums.PositionStatus, `${p}.status`, errors);
}

function validateTrigger(x, i, errors) {
	const p = `triggers[${i}]`;
	assert(isPlainObject(x), "必须是对象", p, errors);
	if (!isPlainObject(x)) return;

	assertId(x.id, `${p}.id`, errors);
	assertString(x.name, `${p}.name`, errors, { required: true });
	assertEnum(x.category, Enums.TriggerCategory, `${p}.category`, errors);
	assertString(x.conditionSummary, `${p}.conditionSummary`, errors, { required: true });
	assertEnum(x.restrictionPolicy, Enums.RestrictionPolicy, `${p}.restrictionPolicy`, errors);
	assertBoolean(x.active, `${p}.active`, errors, { required: true });
}

function validateTriggerLog(x, i, errors) {
	const p = `triggerLogs[${i}]`;
	assert(isPlainObject(x), "必须是对象", p, errors);
	if (!isPlainObject(x)) return;

	assertId(x.id, `${p}.id`, errors);
	assertString(x.triggerId, `${p}.triggerId`, errors, { required: true });
	assertString(x.assetId, `${p}.assetId`, errors, { required: true });
	assertISO(x.firedAt, `${p}.firedAt`, errors, { required: true });
	assertEnum(x.status, Enums.TriggerLogStatus, `${p}.status`, errors);
	assertString(x.notes, `${p}.notes`, errors);
}

function validateAssessment(x, i, errors) {
	const p = `assessments[${i}]`;
	assert(isPlainObject(x), "必须是对象", p, errors);
	if (!isPlainObject(x)) return;

	assertId(x.id, `${p}.id`, errors);
	assertString(x.assetId, `${p}.assetId`, errors, { required: true });

	if (x.triggerLogId !== null && x.triggerLogId !== undefined) {
		assertString(x.triggerLogId, `${p}.triggerLogId`, errors, { required: true });
	}

	assertEnum(x.type, Enums.AssessmentType, `${p}.type`, errors);

	assertBoolean(x.reBuy, `${p}.reBuy`, errors, { required: true });
	assertEnum(x.reBuySizeTier, Enums.ReBuySizeTier, `${p}.reBuySizeTier`, errors);
	assertEnum(x.riskDensity, Enums.RiskTier, `${p}.riskDensity`, errors);
	assertEnum(x.capitalConstraint, Enums.CapitalConstraint, `${p}.capitalConstraint`, errors);
	assertEnum(x.keyLevelState, Enums.KeyLevelState, `${p}.keyLevelState`, errors);
	assertEnum(x.emotionRisk, Enums.RiskTier, `${p}.emotionRisk`, errors);

	assertEnum(x.outcomeTier, Enums.OutcomeTier, `${p}.outcomeTier`, errors);
	assertEnum(x.recommendationType, Enums.RecommendationType, `${p}.recommendationType`, errors);
	assertEnum(x.recommendationStrength, Enums.RecommendationStrength, `${p}.recommendationStrength`, errors);
	assertString(x.boundary, `${p}.boundary`, errors);
	assertString(x.explanation, `${p}.explanation`, errors);

	assertEnum(x.status, Enums.AssessmentStatus, `${p}.status`, errors);

	assertBoolean(x.emergency, `${p}.emergency`, errors, { required: true });

	if (x.backfillDueAt !== null && x.backfillDueAt !== undefined) {
		assertISO(x.backfillDueAt, `${p}.backfillDueAt`, errors, { required: true });
	}

	assertISO(x.createdAt, `${p}.createdAt`, errors, { required: true });
	assertISO(x.updatedAt, `${p}.updatedAt`, errors, { required: true });
}

function validateAction(x, i, errors) {
	const p = `actions[${i}]`;
	assert(isPlainObject(x), "必须是对象", p, errors);
	if (!isPlainObject(x)) return;

	assertId(x.id, `${p}.id`, errors);
	assertString(x.assetId, `${p}.assetId`, errors, { required: true });

	if (x.positionId !== null && x.positionId !== undefined) {
		assertString(x.positionId, `${p}.positionId`, errors, { required: true });
	}
	if (x.assessmentId !== null && x.assessmentId !== undefined) {
		assertString(x.assessmentId, `${p}.assessmentId`, errors, { required: true });
	}

	assertEnum(x.actionType, Enums.ActionType, `${p}.actionType`, errors);
	if (x.plannedAt !== null && x.plannedAt !== undefined) assertISO(x.plannedAt, `${p}.plannedAt`, errors);
	if (x.executedAt !== null && x.executedAt !== undefined) assertISO(x.executedAt, `${p}.executedAt`, errors);

	assertEnum(x.status, Enums.ActionStatus, `${p}.status`, errors);

	assertBoolean(x.deviation, `${p}.deviation`, errors, { required: true });

	if (x.deviation === true) {
		assertString(x.deviationReason, `${p}.deviationReason`, errors, { required: true });
		assertString(x.worstCaseAccepted, `${p}.worstCaseAccepted`, errors, { required: true });
		assertString(x.exitCondition, `${p}.exitCondition`, errors, { required: true });
	} else {
		if (x.deviationReason !== null && x.deviationReason !== undefined) assertString(x.deviationReason, `${p}.deviationReason`, errors);
		if (x.worstCaseAccepted !== null && x.worstCaseAccepted !== undefined) assertString(x.worstCaseAccepted, `${p}.worstCaseAccepted`, errors);
		if (x.exitCondition !== null && x.exitCondition !== undefined) assertString(x.exitCondition, `${p}.exitCondition`, errors);
	}

	assertBoolean(x.emergency, `${p}.emergency`, errors, { required: true });
}

function validateEvidence(x, i, errors) {
	const p = `evidence[${i}]`;
	assert(isPlainObject(x), "必须是对象", p, errors);
	if (!isPlainObject(x)) return;

	assertId(x.id, `${p}.id`, errors);
	assertString(x.assetId, `${p}.assetId`, errors, { required: true });

	if (x.assessmentId !== null && x.assessmentId !== undefined) {
		assertString(x.assessmentId, `${p}.assessmentId`, errors, { required: true });
	}
	if (x.actionId !== null && x.actionId !== undefined) {
		assertString(x.actionId, `${p}.actionId`, errors, { required: true });
	}

	assertEnum(x.type, Enums.EvidenceType, `${p}.type`, errors);

	if (x.url !== null && x.url !== undefined) assertString(x.url, `${p}.url`, errors);
	if (x.text !== null && x.text !== undefined) assertString(x.text, `${p}.text`, errors);

	assertString(x.caption, `${p}.caption`, errors, { required: true });
	assertISO(x.createdAt, `${p}.createdAt`, errors, { required: true });
}

function validateReview(x, i, errors) {
	const p = `reviews[${i}]`;
	assert(isPlainObject(x), "必须是对象", p, errors);
	if (!isPlainObject(x)) return;

	assertId(x.id, `${p}.id`, errors);
	assertString(x.assetId, `${p}.assetId`, errors, { required: true });
	assertString(x.actionId, `${p}.actionId`, errors, { required: true });

	if (x.assessmentId !== null && x.assessmentId !== undefined) {
		assertString(x.assessmentId, `${p}.assessmentId`, errors, { required: true });
	}

	assertEnum(x.outcome, Enums.ReviewOutcome, `${p}.outcome`, errors);

	if (x.tags !== null && x.tags !== undefined) {
		assert(Array.isArray(x.tags), "必须是数组", `${p}.tags`, errors);
		if (Array.isArray(x.tags)) {
			x.tags.forEach((t, idx) => assertEnum(t, Enums.ReviewTag, `${p}.tags[${idx}]`, errors));
		}
	}

	assertString(x.learnings, `${p}.learnings`, errors, { required: true });
	assertISO(x.reviewedAt, `${p}.reviewedAt`, errors, { required: true });
}

// ---------- DB validators ----------
export function validateDb(db) {
	const errors = [];

	assert(isPlainObject(db), "DB 必须是对象", "db", errors);
	if (!isPlainObject(db)) return { ok: false, errors };

	assert(isPlainObject(db.meta), "meta 必须是对象", "db.meta", errors);
	if (isPlainObject(db.meta)) {
		assertString(db.meta.version, "db.meta.version", errors, { required: true });
		assertISO(db.meta.createdAt, "db.meta.createdAt", errors, { required: true });
		assertISO(db.meta.updatedAt, "db.meta.updatedAt", errors, { required: true });
	}

	const arrayFields = ["assets", "positions", "assessments", "triggers", "triggerLogs", "actions", "evidence", "reviews"];
	for (const f of arrayFields) assert(Array.isArray(db[f]), `必须是数组字段：${f}`, `db.${f}`, errors);

	if (Array.isArray(db.assets)) db.assets.forEach((x, i) => validateAsset(x, i, errors));
	if (Array.isArray(db.positions)) db.positions.forEach((x, i) => validatePosition(x, i, errors));
	if (Array.isArray(db.assessments)) db.assessments.forEach((x, i) => validateAssessment(x, i, errors));
	if (Array.isArray(db.triggers)) db.triggers.forEach((x, i) => validateTrigger(x, i, errors));
	if (Array.isArray(db.triggerLogs)) db.triggerLogs.forEach((x, i) => validateTriggerLog(x, i, errors));
	if (Array.isArray(db.actions)) db.actions.forEach((x, i) => validateAction(x, i, errors));
	if (Array.isArray(db.evidence)) db.evidence.forEach((x, i) => validateEvidence(x, i, errors));
	if (Array.isArray(db.reviews)) db.reviews.forEach((x, i) => validateReview(x, i, errors));

	return { ok: errors.length === 0, errors };
}

export function normalizeDb(raw, now = new Date()) {
	const base = createEmptyDb(now);
	if (!isPlainObject(raw)) return base;

	const meta = isPlainObject(raw.meta) ? raw.meta : {};
	base.meta.version = typeof meta.version === "string" ? meta.version : SCHEMA_VERSION;
	base.meta.createdAt = typeof meta.createdAt === "string" ? meta.createdAt : base.meta.createdAt;
	base.meta.updatedAt = typeof meta.updatedAt === "string" ? meta.updatedAt : base.meta.updatedAt;

	for (const k of ["assets", "positions", "assessments", "triggers", "triggerLogs", "actions", "evidence", "reviews"]) {
		base[k] = Array.isArray(raw[k]) ? raw[k] : [];
	}

	return base;
}

export function migrateDb(db) {
	// v1.0.0：暂不迁移
	return db;
}