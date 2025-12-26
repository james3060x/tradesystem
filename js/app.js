import { parseRoute, setActiveNav } from "./router.js";
import { store } from "./store.js";
import { ui } from "./ui.js";
import { seedDemoDB } from "./schema.js";
import { qs, toast, nowISO, uid } from "./utils.js";

let db = null;

function ensureInit() {
  db = store.load();
  // 首次启动：给一个 demo seed（你也可以改成空库）
  if (!db.assets.length && !db.triggers.length) {
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
  // Top quick add
  const quick = qs("#btnQuickAdd");
  if (quick) quick.onclick = () => {
    location.hash = "#/assets";
    toast("去标的页新增（右上角＋用于未来扩展）");
  };

  if (r.name === "assets") {
    // 长按/按钮新增目前用简单 prompt（无框架最小可用）
    // 这里用点击标题区域快速新增（你也可以换成专门按钮）
    const title = qs(".topbar__title");
    if (title) {
      title.onclick = () => {
        const ticker = prompt("新增标的：输入代码/名称（如 TSLA）");
        if (!ticker) return;
        db = store.update(d => {
          const t = nowISO();
          d.assets.push({
            id: uid("asset"),
            name: ticker.toUpperCase(),
            ticker: ticker.toUpperCase(),
            assetClass: "Stock",
            venue: "US",
            status: "Watching",
            notes: "",
            createdAt: t,
            updatedAt: t
          });
        });
        render();
        toast("已新增标的");
      };
    }
  }

  if (r.name === "assessNew") {
    const btn = qs("#btnSaveAssess");
    if (btn) btn.onclick = () => {
      const assetId = qs("#as_assetId")?.value || "";
      if (!assetId) return toast("请选择标的");
      const type = qs("#as_type")?.value || "PositionReeval";
      const reBuy = (qs("#as_reBuy")?.value || "true") === "true";
      const reBuyTier = qs("#as_reBuyTier")?.value || "NA";
      const riskDensity = qs("#as_riskDensity")?.value || "Med";
      const capitalConstraint = qs("#as_capital")?.value || "Limited";
      const keyLevelState = qs("#as_keyLevel")?.value || "Neutral";
      const emotionRisk = qs("#as_emotion")?.value || "Low";
      const boundary = qs("#as_boundary")?.value || "";
      const explanation = qs("#as_explain")?.value || "";

      db = store.update(d => {
        const t = nowISO();
        const id = uid("as");
        const rec = computeRecommendation({ reBuy, reBuyTier, riskDensity, capitalConstraint, keyLevelState, emotionRisk });
        d.assessments.push({
          id,
          assetId,
          triggerLogId: null,
          type,
          reBuy,
          reBuySizeTier: reBuyTier,
          riskDensity,
          capitalConstraint,
          keyLevelState,
          emotionRisk,
          outcomeTier: rec.outcomeTier,
          recommendationType: rec.recommendationType,
          recommendationStrength: rec.recommendationStrength,
          boundary,
          explanation,
          status: "OutputReady",
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
      dev.onchange = () => {
        box.style.display = dev.checked ? "block" : "none";
      };
    }

    const btn = qs("#btnSaveAction");
    if (btn) btn.onclick = () => {
      const assetId = qs("#ac_assetId")?.value || "";
      if (!assetId) return toast("请选择标的");

      const actionType = qs("#ac_type")?.value || "Other";
      const status = qs("#ac_status")?.value || "Planned";
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
        const id = uid("ac");
        const t = nowISO();

        // v1.0：紧急模式可以先不绑定 assessmentId
        d.actions.push({
          id,
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

        // 紧急模式：如果填了 executedAt 且无 assessmentId，则生成 backfill 任务（以 assessment 形式）
        if (emergency && executedAt) {
          const asId = uid("as");
          const due = new Date(executedAt);
          due.setHours(due.getHours() + 48);
          d.assessments.push({
            id: asId,
            assetId,
            triggerLogId: null,
            type: "EmergencyBackfill",
            reBuy: true,
            reBuySizeTier: "NA",
            riskDensity: "Med",
            capitalConstraint: "Limited",
            keyLevelState: "Neutral",
            emotionRisk: "Med",
            outcomeTier: "C",
            recommendationType: "WaitWithConditions",
            recommendationStrength: "MustAssessBeforeAddingExposure",
            boundary: "",
            explanation: "紧急模式：需要在48小时内补齐评估输入与证据。",
            status: "Draft",
            emergency: true,
            backfillDueAt: due.toISOString(),
            createdAt: t,
            updatedAt: t
          });
          // 仍不强制绑定 action.assessmentId（因为可能要补写后再绑定），v1.0 简化为提示即可
        }
      });

      toast("动作已保存");
      location.hash = `#/asset/${encodeURIComponent(assetId)}`;
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
      const ok = confirm("确定清空所有数据？此操作不可撤销。建议先导出备份。");
      if (!ok) return;
      store.reset();
      ensureInit();
      render();
      toast("已清空并重置");
    };
  }
}

function parseMaybeDT(s) {
  // 支持 "YYYY-MM-DD HH:mm"
  const t = (s || "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [_, Y, M, D, hh, mm] = m;
  const d = new Date(Number(Y), Number(M) - 1, Number(D), Number(hh), Number(mm), 0);
  return d.toISOString();
}

function computeRecommendation(input) {
  // v1.0：分档映射（可继续细化为规则表）
  const { reBuy, riskDensity, capitalConstraint, keyLevelState, emotionRisk } = input;

  // 简单评分 -> 分档（内部，不对外暴露0-100）
  let score = 0;
  score += reBuy ? 2 : 0;
  score += (riskDensity === "Low" ? 2 : riskDensity === "Med" ? 1 : 0);
  score += (capitalConstraint === "Sufficient" ? 2 : capitalConstraint === "Limited" ? 1 : 0);
  score += (emotionRisk === "Low" ? 2 : emotionRisk === "Med" ? 1 : 0);
  score += (keyLevelState === "Breakout" ? 2 : keyLevelState === "Retest" ? 1 : 0);

  let outcomeTier = "C";
  if (score >= 9) outcomeTier = "A";
  else if (score >= 7) outcomeTier = "B";
  else if (score >= 5) outcomeTier = "C";
  else outcomeTier = "D";

  let recommendationType = "WaitWithConditions";
  let recommendationStrength = "Suggest";

  if (outcomeTier === "A") {
    recommendationType = "Hold";
    recommendationStrength = "Suggest";
  } else if (outcomeTier === "B") {
    recommendationType = "WaitWithConditions";
    recommendationStrength = "Suggest";
  } else if (outcomeTier === "C") {
    recommendationType = "ReduceExposure";
    recommendationStrength = "StrongSuggest";
  } else {
    recommendationType = "ProtectiveHedge";
    recommendationStrength = "MustAssessBeforeAddingExposure";
  }

  return { outcomeTier, recommendationType, recommendationStrength };
}

window.addEventListener("hashchange", () => render());

ensureInit();
render();