import { escHtml, formatDT, toast, addHours } from "./utils.js";
import { Enums } from "./schema.js";

export const ui = {
  dashboard(db) {
    const openTL = db.triggerLogs
      .filter(x => x.status === "Open" || x.status === "InAssessment")
      .sort((a,b) => (b.firedAt || "").localeCompare(a.firedAt || ""));

    const plannedActions = db.actions
      .filter(x => x.status === "Planned")
      .sort((a,b) => (a.plannedAt || "").localeCompare(b.plannedAt || ""));

    // backfill due list: emergency actions missing assessment
    const emergencyMissing = db.actions
      .filter(a => a.emergency && !a.assessmentId && a.executedAt);

    return `
      <section class="card">
        <div class="h1">工作台</div>
        <div class="pills">
          <span class="pill ${openTL.length ? "warn":"ok"}">🎯 触发任务 ${openTL.length}</span>
          <span class="pill ${plannedActions.length ? "warn":"ok"}">📝 待执行 ${plannedActions.length}</span>
          <span class="pill ${emergencyMissing.length ? "bad":"ok"}">⏱️ 紧急补齐 ${emergencyMissing.length}</span>
        </div>
      </section>

      <section class="card">
        <div class="h2">触发任务（Open / In Assessment）</div>
        ${openTL.length ? `<div class="list">${openTL.map(x => itemTriggerLog(db, x)).join("")}</div>` : `<div class="muted small">暂无</div>`}
      </section>

      <section class="card">
        <div class="h2">待执行动作（Planned）</div>
        ${plannedActions.length ? `<div class="list">${plannedActions.map(x => itemAction(db, x)).join("")}</div>` : `<div class="muted small">暂无</div>`}
      </section>

      <section class="card">
        <div class="h2">紧急模式待补齐（48h）</div>
        ${emergencyMissing.length ? `<div class="list">${emergencyMissing.map(a => itemEmergency(db, a)).join("")}</div>` : `<div class="muted small">暂无</div>`}
      </section>
    `;
  },

  assets(db) {
    const assets = [...db.assets].sort((a,b)=> (a.status||"").localeCompare(b.status||""));
    return `
      <section class="card">
        <div class="row space">
          <div class="h1">标的</div>
          <a class="pill ok" href="#/assets" onclick="return false;">🧩 ${assets.length}</a>
        </div>
        <div class="muted small">点击进入标的页：仓位/评估/动作/复盘</div>
      </section>

      <section class="card">
        <div class="h2">列表</div>
        ${assets.length ? `<div class="list">${assets.map(a => itemAsset(db, a)).join("")}</div>` : `<div class="muted small">暂无标的，点击右上角＋添加</div>`}
      </section>
    `;
  },

  assetDetail(db, assetId) {
    const a = db.assets.find(x => x.id === assetId);
    if (!a) return `<section class="card"><div class="h1">标的不存在</div></section>`;

    const positions = db.positions.filter(p => p.assetId === a.id && p.status !== "Closed");
    const latestAssess = [...db.assessments].filter(x => x.assetId === a.id).sort((x,y)=>(y.updatedAt||"").localeCompare(x.updatedAt||""))[0];
    const actions = [...db.actions].filter(x => x.assetId === a.id).sort((x,y)=>(y.executedAt||y.plannedAt||"").localeCompare(x.executedAt||x.plannedAt||""));
    const reviews = db.reviews.filter(r => r.assetId === a.id).sort((x,y)=>(y.reviewedAt||"").localeCompare(x.reviewedAt||""));

    return `
      <section class="card">
        <div class="row space">
          <div>
            <div class="h1">${escHtml(a.name || a.ticker || "Asset")}</div>
            <div class="muted small">${escHtml(a.assetClass)} · ${escHtml(a.venue)} · ${escHtml(a.status)}</div>
          </div>
          <div class="right">
            <a class="pill ok" href="#/assess/new?assetId=${encodeURIComponent(a.id)}">🧠 评估</a>
          </div>
        </div>
        ${a.notes ? `<div class="field"><div class="label">Notes</div><div class="muted small">${escHtml(a.notes)}</div></div>` : ""}
      </section>

      <section class="card">
        <div class="h2">仓位（Open/Reduced）</div>
        ${positions.length ? `<div class="list">${positions.map(p => itemPosition(db, p)).join("")}</div>` : `<div class="muted small">暂无仓位</div>`}
        <div class="field"><a class="btn" href="#/actions/new?assetId=${encodeURIComponent(a.id)}">📝 记录动作</a></div>
      </section>

      <section class="card">
        <div class="h2">最新评估</div>
        ${latestAssess ? renderAssessment(latestAssess) : `<div class="muted small">暂无评估</div>`}
      </section>

      <section class="card">
        <div class="h2">动作</div>
        ${actions.length ? `<div class="list">${actions.slice(0,20).map(x => itemAction(db, x)).join("")}</div>` : `<div class="muted small">暂无</div>`}
      </section>

      <section class="card">
        <div class="h2">复盘</div>
        ${reviews.length ? `<div class="list">${reviews.slice(0,20).map(r => itemReview(db, r)).join("")}</div>` : `<div class="muted small">暂无</div>`}
      </section>
    `;
  },

  assessNew(db, query) {
    const assetId = query.assetId || "";
    const a = assetId ? db.assets.find(x => x.id === assetId) : null;

    const assetOptions = db.assets.map(x => `<option value="${escHtml(x.id)}" ${x.id===assetId?"selected":""}>${escHtml(x.name||x.ticker)}</option>`).join("");

    return `
      <section class="card">
        <div class="h1">发起评估</div>
        <div class="muted small">v1.0 分档输出（A/B/C/D）</div>

        <div class="field">
          <div class="label">标的</div>
          <select class="select" id="as_assetId">
            <option value="">请选择</option>
            ${assetOptions}
          </select>
        </div>

        <div class="field">
          <div class="label">评估类型</div>
          <select class="select" id="as_type">
            ${Enums.AssessmentType.map(x=>`<option value="${x}">${x}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">空仓立场：是否愿意复购</div>
          <select class="select" id="as_reBuy">
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </div>

        <div class="field">
          <div class="label">复购仓位档</div>
          <select class="select" id="as_reBuyTier">
            ${Enums.ReBuyTier.map(x=>`<option value="${x}">${x}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">风险密度</div>
          <select class="select" id="as_riskDensity">
            ${Enums.Risk3.map(x=>`<option value="${x}">${x}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">资金约束</div>
          <select class="select" id="as_capital">
            ${Enums.Capital.map(x=>`<option value="${x}">${x}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">关键位状态</div>
          <select class="select" id="as_keyLevel">
            ${Enums.KeyLevel.map(x=>`<option value="${x}">${x}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">情绪风险</div>
          <select class="select" id="as_emotion">
            ${Enums.Risk3.map(x=>`<option value="${x}">${x}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">边界（减仓比例/条件等）</div>
          <input class="input" id="as_boundary" placeholder="例如：跌破20D减仓30%；或回踩确认再加" />
        </div>

        <div class="field">
          <div class="label">解释（空仓立场 + 风险密度 + 资金约束）</div>
          <textarea class="textarea" id="as_explain" placeholder="用三句话说明：为什么这样建议"></textarea>
        </div>

        <div class="field">
          <button class="btn primary" id="btnSaveAssess">保存并生成建议</button>
        </div>

        ${a ? `<div class="muted small">当前：${escHtml(a.name||a.ticker)}</div>` : ""}
      </section>
    `;
  },

  actionNew(db, query) {
    const assetId = query.assetId || "";
    const assetOptions = db.assets.map(x => `<option value="${escHtml(x.id)}" ${x.id===assetId?"selected":""}>${escHtml(x.name||x.ticker)}</option>`).join("");

    return `
      <section class="card">
        <div class="h1">记录动作</div>
        <div class="muted small">支持偏离强制字段、紧急模式 48h 补齐</div>

        <div class="field">
          <div class="label">标的</div>
          <select class="select" id="ac_assetId">
            <option value="">请选择</option>
            ${assetOptions}
          </select>
        </div>

        <div class="field">
          <div class="label">动作类型</div>
          <select class="select" id="ac_type">
            ${Enums.ActionType.map(x=>`<option value="${x}">${x}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">状态</div>
          <select class="select" id="ac_status">
            ${Enums.ActionStatus.map(x=>`<option value="${x}">${x}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">PlannedAt（可选）</div>
          <input class="input" id="ac_plannedAt" placeholder="留空则不填；格式：2025-12-25 22:00" />
        </div>

        <div class="field">
          <div class="label">ExecutedAt（可选）</div>
          <input class="input" id="ac_executedAt" placeholder="留空则不填；格式：2025-12-25 22:00" />
        </div>

        <div class="row" style="margin-top:10px;">
          <label class="pill"><input type="checkbox" id="ac_emergency" /> 紧急模式</label>
          <label class="pill"><input type="checkbox" id="ac_deviation" /> 偏离系统建议</label>
        </div>

        <div id="deviationBox" style="display:none;">
          <div class="field">
            <div class="label">偏离原因（必填）</div>
            <textarea class="textarea" id="ac_devReason" placeholder="为什么要偏离？"></textarea>
          </div>
          <div class="field">
            <div class="label">可接受最坏情况（必填）</div>
            <textarea class="textarea" id="ac_worst" placeholder="最大回撤/最大亏损/时间成本等"></textarea>
          </div>
          <div class="field">
            <div class="label">撤退条件（必填）</div>
            <textarea class="textarea" id="ac_exit" placeholder="触发即执行"></textarea>
          </div>
        </div>

        <div class="field">
          <button class="btn primary" id="btnSaveAction">保存动作</button>
        </div>
      </section>
    `;
  },

  settings(db) {
    return `
      <section class="card">
        <div class="h1">设置</div>
        <div class="muted small">LocalStorage 保存 · 一键导出备份 · 导入恢复</div>

        <div class="field">
          <button class="btn" id="btnExport">导出备份 JSON</button>
        </div>

        <div class="field">
          <div class="label">导入（覆盖当前数据）</div>
          <input class="input" type="file" id="fileImport" accept="application/json" />
        </div>

        <div class="field">
          <button class="btn danger" id="btnReset">清空数据（危险）</button>
        </div>

        <div class="field">
          <div class="label">当前版本</div>
          <div class="muted small"><span class="kbd">${escHtml(db.meta.version)}</span></div>
        </div>
      </section>
    `;
  }
};

function itemAsset(db, a) {
  const pos = db.positions.filter(p => p.assetId === a.id && p.status !== "Closed").length;
  const lastAssess = [...db.assessments].filter(x => x.assetId === a.id).sort((x,y)=>(y.updatedAt||"").localeCompare(x.updatedAt||""))[0];
  const tier = lastAssess?.outcomeTier ? `分档 ${lastAssess.outcomeTier}` : "未评估";
  return `
    <a class="item" href="#/asset/${encodeURIComponent(a.id)}">
      <div>
        <div class="title">${escHtml(a.name || a.ticker)}</div>
        <div class="sub">${escHtml(a.assetClass)} · ${escHtml(a.status)} · 仓位 ${pos}</div>
      </div>
      <div class="right">
        <div class="tag">${escHtml(tier)}</div>
        <div class="sub">${escHtml(a.ticker || "")}</div>
      </div>
    </a>
  `;
}

function itemPosition(db, p) {
  return `
    <div class="item">
      <div>
        <div class="title">${escHtml(p.account)} · ${escHtml(p.status)}</div>
        <div class="sub">Size ${p.size} · Avg ${p.avgCost} ${escHtml(p.currency)} · Batch ${escHtml(p.batch||"")}</div>
      </div>
      <div class="right">
        <div class="tag">${escHtml(p.openedAt ? formatDT(p.openedAt) : "")}</div>
      </div>
    </div>
  `;
}

function renderAssessment(a) {
  return `
    <div class="pills">
      <span class="pill ok">分档 ${escHtml(a.outcomeTier || "-")}</span>
      <span class="pill">${escHtml(a.recommendationType || "-")}</span>
      <span class="pill">${escHtml(a.recommendationStrength || "-")}</span>
    </div>
    ${a.boundary ? `<div class="field"><div class="label">边界</div><div class="muted small">${escHtml(a.boundary)}</div></div>` : ""}
    ${a.explanation ? `<div class="field"><div class="label">解释</div><div class="muted small">${escHtml(a.explanation)}</div></div>` : ""}
    <div class="muted small">更新：${escHtml(formatDT(a.updatedAt))}</div>
  `;
}

function itemTriggerLog(db, t) {
  const asset = db.assets.find(x => x.id === t.assetId);
  const trig = db.triggers.find(x => x.id === t.triggerId);
  return `
    <div class="item">
      <div>
        <div class="title">${escHtml(asset?.name || "Unknown")} · ${escHtml(trig?.name || "Trigger")}</div>
        <div class="sub">${escHtml(trig?.restrictionPolicy || "")} · ${escHtml(t.status)}</div>
      </div>
      <div class="right">
        <div class="tag">${escHtml(formatDT(t.firedAt))}</div>
        <a class="sub" href="#/assess/new?assetId=${encodeURIComponent(t.assetId)}">去评估</a>
      </div>
    </div>
  `;
}

function itemAction(db, a) {
  const asset = db.assets.find(x => x.id === a.assetId);
  const when = a.executedAt || a.plannedAt || "";
  const flags = [
    a.emergency ? "紧急" : "",
    a.deviation ? "偏离" : ""
  ].filter(Boolean).join(" · ");
  return `
    <div class="item">
      <div>
        <div class="title">${escHtml(asset?.name || "Unknown")} · ${escHtml(a.actionType)}</div>
        <div class="sub">${escHtml(a.status)}${flags ? ` · ${escHtml(flags)}` : ""}</div>
      </div>
      <div class="right">
        <div class="tag">${escHtml(when ? formatDT(when) : "")}</div>
      </div>
    </div>
  `;
}

function itemEmergency(db, a) {
  const asset = db.assets.find(x => x.id === a.assetId);
  const due = a.executedAt ? addHours(a.executedAt, 48) : "";
  return `
    <div class="item">
      <div>
        <div class="title">${escHtml(asset?.name || "Unknown")} · 紧急补齐</div>
        <div class="sub">48h 内补齐评估与证据</div>
      </div>
      <div class="right">
        <div class="tag">Due ${escHtml(formatDT(due))}</div>
        <a class="sub" href="#/assess/new?assetId=${encodeURIComponent(a.assetId)}">补评估</a>
      </div>
    </div>
  `;
}

function itemReview(db, r) {
  return `
    <div class="item">
      <div>
        <div class="title">复盘 · ${escHtml(r.outcome || "Unknown")}</div>
        <div class="sub">${escHtml((r.tags||[]).join(", "))}</div>
      </div>
      <div class="right">
        <div class="tag">${escHtml(formatDT(r.reviewedAt))}</div>
      </div>
    </div>
  `;
}