/*
请更新！
新增功能：评估保存逻辑恢复为“6 维输入 → 分档输出 → Recommendation”
调整行数：约 +140 行
*/
import { parseRoute, setActiveNav } from "./router.js";
import { store } from "./store.js";
import { ui } from "./ui.js";
import { seedDemoDB, Enums } from "./schema.js";
import { qs, toast, nowISO, uid, parseMaybeDT } from "./utils.js";

let db = null;

function ensureInit() {
  db = store.load();
  if (!db.assets.length) {
    db = seedDemoDB();
    store.save(db);
  }
}

function render() {
  const r = parseRoute(location.hash);
  setActiveNav(r.name);

  const app = document.getElementById("app");
  if (!app) return;

  if (r.name === "dashboard") app.innerHTML = ui.dashboard(db);
  if (r.name === "assets") app.innerHTML = ui.assets(db);
  if (r.name === "asset") app.innerHTML = ui.assetDetail(db, r.params.id);
  if (r.name === "assessNew") app.innerHTML = ui.assessNew(db, r.query);
  if (r.name === "actionNew") app.innerHTML = ui.actionNew(db, r.query);
  if (r.name === "settings") app.innerHTML = ui.settings(db);

  bindPageEvents(r);
}

function bindPageEvents(r) {
  const quick = qs("#btnQuickAdd");
  if (quick) quick.onclick = () => { location.hash = "#/assets?add=1"; };

  if (r.name === "assets") {
    const btn = qs("#btnCreateAsset");
    if (btn) btn.onclick = () => {
      const symbol = (qs("#new_symbol")?.value || "").trim().toUpperCase();
      if (!symbol) return toast("请输入代码（Symbol）");

      const status = (qs("#new_status")?.value || "观察").trim();
      const industry = (qs("#new_industry")?.value || "").trim();
      const thesis = (qs("#new_thesis")?.value || "").trim();

      const planQtyRaw = (qs("#new_planQty")?.value || "").trim();
      const holdingQtyRaw = (qs("#new_holdingQty")?.value || "0").trim();

      const planQty = planQtyRaw ? Number(planQtyRaw) : null;
      if (planQtyRaw && Number.isNaN(planQty)) return toast("计划数量必须是数字或留空");

      const holdingQty = holdingQtyRaw ? Number(holdingQtyRaw) : 0;
      if (holdingQtyRaw && Number.isNaN(holdingQty)) return toast("当前数量必须是数字");

      const cfg = db.meta?.config || {};
      const reasons = readCheckboxList("new_reason", cfg.buildReasons || []);

      db = store.update(d => {
        const t = nowISO();
        const a = {
          id: uid("asset"),
          symbol,
          status,
          industry,
          buildReasons: reasons,
          thesis,
          planQty,
          holdingQty,
          openedAt: null,
          closedAt: null,
          createdAt: t,
          updatedAt: t
        };

        const holdingName = (d.meta?.config?.assetStatuses?.[2]) || "持仓";
        const clearedName = (d.meta?.config?.assetStatuses?.[3]) || "清仓";
        if (a.status === holdingName) a.openedAt = t;
        if (a.status === clearedName) a.closedAt = t;

        d.assets.push(a);
      });

      toast("已新增标的");
      location.hash = "#/assets";
    };
  }

  if (r.name === "assessNew") {
    const btn = qs("#btnSaveAssess");
    if (btn) btn.onclick = () => {
      const assetId = qs("#as_assetId")?.value || "";
      if (!assetId) return toast("请选择标的");

      const type = qs("#as_type")?.value || "持仓再评估";

      const reBuy = qs("#as_reBuy")?.value || "是";
      const reBuyTier = qs("#as_reBuyTier")?.value || "不适用";
      const noRebuyReason = (qs("#as_noRebuyReason")?.value || "").trim();

      const riskDensity = qs("#as_riskDensity")?.value || "中";
      const keyLevelState = qs("#as_keyLevel")?.value || "中性";
      const contrarian = qs("#as_contrarian")?.value || "否";

      const capitalConstraint = qs("#as_capital")?.value || "有限";
      const cashCushionOk = qs("#as_cashCushion")?.value || "是";

      const strategyFit = qs("#as_strategyFit")?.value || "趋势跟随";
      const conflict = qs("#as_conflict")?.value || "不冲突";

      const emotionRisk = qs("#as_emotionRisk")?.value || "中";
      const nextDecisionDamage = qs("#as_nextDecisionDamage")?.value || "中";

      const boundary = (qs("#as_boundary")?.value || "").trim();
      const explanation = (qs("#as_explain")?.value || "").trim();

      const rec = computeRecommendation({
        reBuy,
        reBuyTier,
        riskDensity,
        keyLevelState,
        capitalConstraint,
        cashCushionOk,
        conflict,
        emotionRisk,
        nextDecisionDamage,
        contrarian
      });

      db = store.update(d => {
        const t = nowISO();
        d.assessments.push({
          id: uid("as"),
          assetId,
          triggerLogId: null,
          type,

          // 6 维输入
          reBuy,
          reBuyTier,
          noRebuyReason,
          riskDensity,
          keyLevelState,
          contrarian,
          capitalConstraint,
          cashCushionOk,
          strategyFit,
          conflict,
          emotionRisk,
          nextDecisionDamage,

          // 输出
          outcomeTier: rec.outcomeTier,
          recommendationType: rec.recommendationType,
          recommendationStrength: rec.recommendationStrength,
          boundary,
          explanation,

          status: "已生成建议",
          emergency: false,
          backfillDueAt: null,
          createdAt: t,
          updatedAt: t
        });
      });

      toast("评估已保存并生成建议");
      location.hash = `#/asset/${encodeURIComponent(assetId)}`;
    };
  }

  if (r.name === "actionNew") {
    const dev = qs("#ac_deviation");
    const box = qs("#deviationBox");
    if (dev && box) {
      dev.onchange = () => { box.style.display = dev.checked ? "block" : "none"; };
    }

    const btn = qs("#btnSaveAction");
    if (btn) btn.onclick = () => {
      const assetId = qs("#ac_assetId")?.value || "";
      if (!assetId) return toast("请选择标的");

      const actionType = qs("#ac_type")?.value || "其他";
      const status = qs("#ac_status")?.value || "计划";
      const emergency = !!qs("#ac_emergency")?.checked;
      const deviation = !!qs("#ac_deviation")?.checked;

      const plannedAt = parseMaybeDT(qs("#ac_plannedAt")?.value || "");
      const executedAt = parseMaybeDT(qs("#ac_executedAt")?.value || "");

      const deviationReason = (qs("#ac_devReason")?.value || "").trim();
      const worstCaseAccepted = (qs("#ac_worst")?.value || "").trim();
      const exitCondition = (qs("#ac_exit")?.value || "").trim();

      if (deviation) {
        if (!deviationReason || !worstCaseAccepted || !exitCondition) {
          return toast("偏离模式：原因/最坏情况/撤退条件 必填");
        }
      }

      db = store.update(d => {
        const t = nowISO();
        d.actions.push({
          id: uid("ac"),
          assetId,
          positionId: null,
          assessmentId: null,
          actionType,
          plannedAt: plannedAt || null,
          executedAt: executedAt || null,
          status,
          emergency,
          deviation,
          deviationReason: deviation ? deviationReason : "",
          worstCaseAccepted: deviation ? worstCaseAccepted : "",
          exitCondition: deviation ? exitCondition : ""
        });

        // 紧急模式：48h 内补齐（这里仅插入一条草稿评估，提示补齐）
        if (emergency && executedAt) {
          const due = new Date(executedAt);
          due.setHours(due.getHours() + 48);
          d.assessments.push({
            id: uid("as"),
            assetId,
            triggerLogId: null,
            type: "紧急补齐",
            reBuy: "是",
            reBuyTier: "不适用",
            noRebuyReason: "",
            riskDensity: "中",
            keyLevelState: "中性",
            contrarian: "否",
            capitalConstraint: "有限",
            cashCushionOk: "是",
            strategyFit: "仓位再平衡",
            conflict: "不冲突",
            emotionRisk: "中",
            nextDecisionDamage: "中",
            outcomeTier: "C",
            recommendationType: "设条件等待",
            recommendationStrength: "必须评估后才能增加暴露",
            boundary: "",
            explanation: "紧急模式：需在 48 小时内补齐评估与证据。",
            status: "草稿",
            emergency: true,
            backfillDueAt: due.toISOString(),
            createdAt: t,
            updatedAt: t
          });
        }
      });

      toast("动作已保存");
      location.hash = "#/dashboard";
    };
  }

  if (r.name === "settings") {
    const btnExport = qs("#btnExport");
    if (btnExport) btnExport.onclick = () => store.exportFile();

    const file = qs("#fileImport");
    if (file) file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        db = await store.importFile(f);
        render();
      } catch (e) {
        toast(`导入失败：${e.message || e}`);
      } finally {
        file.value = "";
      }
    };

    const btnReset = qs("#btnReset");
    if (btnReset) btnReset.onclick = () => {
      const ok = confirm("确定清空所有数据？建议先导出备份。");
      if (!ok) return;
      store.reset();
      ensureInit();
      render();
      toast("已清空");
    };

    const btnLang = qs("#btnToggleLang");
    if (btnLang) btnLang.onclick = () => {
      db = store.update(d => {
        d.meta.lang = (d.meta.lang || "zh") === "zh" ? "en" : "zh";
      });
      render();
    };
  }
}

function readCheckboxList(idPrefix, options) {
  const vals = [];
  (options || []).forEach((opt, i) => {
    const id = `${idPrefix}_${i}`;
    const el = document.getElementById(id);
    if (el && el.checked) vals.push(opt);
  });
  return vals;
}

function computeRecommendation(input) {
  // v1.0：规则冻结为“分档映射”[^]
  // 这里采用一个可解释的打分 → 映射到 A/B/C/D，并输出类型/强度。
  const {
    reBuy,
    reBuyTier,
    riskDensity,
    keyLevelState,
    capitalConstraint,
    cashCushionOk,
    conflict,
    emotionRisk,
    nextDecisionDamage,
    contrarian
  } = input;

  let score = 0;

  // 空仓复购意愿（核心）
  score += (reBuy === "是") ? 3 : 0;
  score += (reBuyTier === "75–100%") ? 2 : 0;
  score += (reBuyTier === "50–75%") ? 1 : 0;

  // 风险密度：越低越好
  score += (riskDensity === "低") ? 2 : (riskDensity === "中" ? 1 : 0);

  // 关键位：突破/回踩优于跌破
  score += (keyLevelState === "突破前高") ? 2 : 0;
  score += (keyLevelState === "回踩确认") ? 1 : 0;
  score += (keyLevelState === "跌破关键位") ? -1 : 0;

  // 资金约束
  score += (capitalConstraint === "充足") ? 2 : (capitalConstraint === "有限" ? 1 : 0);
  score += (cashCushionOk === "是") ? 1 : -1;

  // 策略一致性
  score += (conflict === "不冲突") ? 2 : (conflict === "轻微" ? 1 : 0);

  // 情绪与执行风险：越低越好
  score += (emotionRisk === "低") ? 2 : (emotionRisk === "中" ? 1 : 0);
  score += (nextDecisionDamage === "低") ? 1 : (nextDecisionDamage === "高" ? -1 : 0);

  // 逆势额外惩罚
  score += (contrarian === "是") ? -1 : 0;

  let outcomeTier = "C";
  if (score >= 12) outcomeTier = "A";
  else if (score >= 9) outcomeTier = "B";
  else if (score >= 6) outcomeTier = "C";
  else outcomeTier = "D";

  let recommendationType = "设条件等待";
  let recommendationStrength = "建议";

  if (outcomeTier === "A") {
    recommendationType = "保持";
    recommendationStrength = "建议";
  } else if (outcomeTier === "B") {
    recommendationType = "设条件等待";
    recommendationStrength = "建议";
  } else if (outcomeTier === "C") {
    recommendationType = "减暴露";
    recommendationStrength = "强建议";
  } else {
    recommendationType = "保护性对冲";
    recommendationStrength = "必须评估后才能增加暴露";
  }

  return { outcomeTier, recommendationType, recommendationStrength };
}

window.addEventListener("hashchange", () => render());

ensureInit();
render();