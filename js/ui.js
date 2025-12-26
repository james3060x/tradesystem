/*
请更新！
新增功能：评估页面按 PRD v1.0 6 维输入 + 分档输出 + 建议卡片
调整行数：约 +240 行
*/
import { escHtml, formatDT, diffDays, t } from "./utils.js";
import { Enums } from "./schema.js";

function getCfg(db) {
  return db.meta?.config || { assetStatuses: ["待建仓","观察","持仓","清仓"], buildReasons: [], industries: [] };
}

function holdingDays(a) {
  if (!a.openedAt) return null;
  if (a.closedAt) return diffDays(a.openedAt, a.closedAt);
  return diffDays(a.openedAt, null);
}

function checkboxList(idPrefix, options, selected) {
  const set = new Set(selected || []);
  return (options || []).map((opt, i) => {
    const id = `${idPrefix}_${i}`;
    const checked = set.has(opt) ? "checked" : "";
    return `
      <label class="pill" style="cursor:pointer;">
        <input type="checkbox" id="${escHtml(id)}" ${checked} /> ${escHtml(opt)}
      </label>
    `;
  }).join("");
}

function renderRecCard(a) {
  return `
    <div class="pills">
      <span class="pill ok">分档 ${escHtml(a.outcomeTier || "-")}</span>
      <span class="pill">${escHtml(a.recommendationType || "-")}</span>
      <span class="pill">${escHtml(a.recommendationStrength || "-")}</span>
    </div>
    ${a.boundary ? `<div class="field"><div class="label">行动边界</div><div class="muted small">${escHtml(a.boundary)}</div></div>` : ""}
    ${a.explanation ? `<div class="field"><div class="label">解释</div><div class="muted small">${escHtml(a.explanation)}</div></div>` : ""}
  `;
}

export const ui = {
  dashboard(db) {
    const plannedActions = (db.actions || []).filter(x => x.status === "计划");
    return `
      <section class="card">
        <div class="h1">工作台</div>
        <div class="pills">
          <span class="pill">📝 待执行 ${plannedActions.length}</span>
        </div>
      </section>
      <section class="card">
        <div class="h2">待执行动作</div>
        ${plannedActions.length ? `<div class="list">${plannedActions.map(x => itemAction(db, x)).join("")}</div>` : `<div class="muted small">暂无</div>`}
      </section>
    `;
  },

  assets(db) {
    const assets = [...(db.assets||[])].sort((a,b)=> (a.status||"").localeCompare(b.status||""));
    const shouldShowAdd = (location.hash || "").includes("#/assets") && (location.hash || "").includes("add=1");
    return `
      <section class="card">
        <div class="row space">
          <div class="h1">标的</div>
          <a class="pill ok" href="#/assets" onclick="return false;">🧩 ${assets.length}</a>
        </div>
        <div class="field"><a class="btn" href="#/assets?add=1">➕ 新增标的</a></div>
      </section>

      ${shouldShowAdd ? renderAssetCreateForm(db) : ""}

      <section class="card">
        <div class="h2">列表</div>
        ${assets.length ? `<div class="list">${assets.map(a => itemAsset(db, a)).join("")}</div>` : `<div class="muted small">暂无标的</div>`}
      </section>
    `;
  },

  assetDetail(db, assetId) {
    const a = (db.assets||[]).find(x => x.id === assetId);
    if (!a) return `<section class="card"><div class="h1">标的不存在</div></section>`;

    const days = holdingDays(a);
    const latest = [...(db.assessments||[])]
      .filter(x => x.assetId === a.id)
      .sort((x,y)=>(y.updatedAt||"").localeCompare(x.updatedAt||""))[0];

    return `
      <section class="card">
        <div class="row space">
          <div>
            <div class="h1">${escHtml(a.symbol)}</div>
            <div class="muted small">状态：${escHtml(a.status||"-")} · 行业：${escHtml(a.industry||"-")}</div>
          </div>
          <div class="right">
            <a class="pill ok" href="#/assess/new?assetId=${encodeURIComponent(a.id)}">🧠 评估</a>
          </div>
        </div>
        <div class="pills" style="margin-top:10px;">
          <span class="pill">数量 ${escHtml(String(a.holdingQty||0))}</span>
          <span class="pill">持仓天数 ${days ?? "-"}</span>
        </div>
      </section>

      <section class="card">
        <div class="h2">最新评估</div>
        ${latest ? renderRecCard(latest) : `<div class="muted small">暂无</div>`}
      </section>
    `;
  },

  assessNew(db, query) {
    const assetId = query.assetId || "";
    const assets = db.assets || [];
    const assetOptions = assets.map(x => `<option value="${escHtml(x.id)}" ${x.id===assetId?"selected":""}>${escHtml(x.symbol||"")}</option>`).join("");

    return `
      <section class="card">
        <div class="h1">发起评估（完整）</div>
        <div class="muted small">依据 PRD v1.0：6 维输入 → 分档输出</div>

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
            ${Enums.AssessmentType.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">1）空仓立场：是否愿意复购？</div>
          <select class="select" id="as_reBuy">
            <option value="是">是</option>
            <option value="否">否</option>
          </select>
        </div>

        <div class="field">
          <div class="label">复购仓位档</div>
          <select class="select" id="as_reBuyTier">
            ${Enums.ReBuyTier.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
          <div class="muted small">若选择“不愿意复购”，这里建议选“不适用”。</div>
        </div>

        <div class="field">
          <div class="label">若不愿意复购，主要原因（可选）</div>
          <input class="input" id="as_noRebuyReason" placeholder="估值/趋势/事件/资金/暴露过高/其他" />
        </div>

        <div class="field">
          <div class="label">2）风险密度</div>
          <select class="select" id="as_riskDensity">
            ${Enums.Risk3.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">3）趋势与关键位</div>
          <select class="select" id="as_keyLevel">
            ${Enums.KeyLevel.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">是否计划逆势？</div>
          <select class="select" id="as_contrarian">
            <option value="否">否</option>
            <option value="是">是</option>
          </select>
        </div>

        <div class="field">
          <div class="label">4）资金约束：若继续跌破底仓价，是否仍有资金加仓？</div>
          <select class="select" id="as_capital">
            ${Enums.Capital.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">本次操作后现金安全垫是否充足？</div>
          <select class="select" id="as_cashCushion">
            <option value="是">是</option>
            <option value="否">否</option>
          </select>
        </div>

        <div class="field">
          <div class="label">5）策略一致性：本次操作类型</div>
          <select class="select" id="as_strategyFit">
            ${Enums.StrategyFit.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">与长期逻辑是否冲突？</div>
          <select class="select" id="as_conflict">
            ${Enums.Conflict.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">6）情绪与执行风险（FOMO/恐惧/报复性交易）</div>
          <select class="select" id="as_emotionRisk">
            ${Enums.Risk3.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">若回撤或踏空，是否影响下一次决策质量？</div>
          <select class="select" id="as_nextDecisionDamage">
            ${Enums.Risk3.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">行动边界（减仓比例区间 / 触发条件 / 撤退条件）</div>
          <input class="input" id="as_boundary" placeholder="例如：跌破20D减仓30%；突破后分批加" />
        </div>

        <div class="field">
          <div class="label">解释（用“空仓立场 + 风险密度 + 资金约束”三句完成）</div>
          <textarea class="textarea" id="as_explain"></textarea>
        </div>

        <div class="field">
          <button class="btn primary" id="btnSaveAssess">保存并生成建议</button>
        </div>

        <div class="muted small">保存后会生成：分档（A/B/C/D）、建议动作类型、建议强度。</div>
      </section>
    `;
  },

  actionNew(db, query) {
    const assetId = query.assetId || "";
    const assetOptions = (db.assets || [])
      .map(x => `<option value="${escHtml(x.id)}" ${x.id===assetId?"selected":""}>${escHtml(x.symbol||"")}</option>`)
      .join("");

    return `
      <section class="card">
        <div class="h1">记录动作</div>

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
            ${Enums.ActionType.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">状态</div>
          <select class="select" id="ac_status">
            ${Enums.ActionStatus.map(x=>`<option value="${escHtml(x)}">${escHtml(x)}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <div class="label">计划时间（可选）</div>
          <input class="input" id="ac_plannedAt" placeholder="YYYY-MM-DD HH:mm" />
        </div>

        <div class="field">
          <div class="label">执行时间（可选）</div>
          <input class="input" id="ac_executedAt" placeholder="YYYY-MM-DD HH:mm" />
        </div>

        <div class="row" style="margin-top:10px;">
          <label class="pill"><input type="checkbox" id="ac_emergency" /> 紧急模式</label>
          <label class="pill"><input type="checkbox" id="ac_deviation" /> 偏离系统建议</label>
        </div>

        <div id="deviationBox" style="display:none;">
          <div class="field"><div class="label">偏离原因（必填）</div><textarea class="textarea" id="ac_devReason"></textarea></div>
          <div class="field"><div class="label">可接受最坏情况（必填）</div><textarea class="textarea" id="ac_worst"></textarea></div>
          <div class="field"><div class="label">撤退条件（必填）</div><textarea class="textarea" id="ac_exit"></textarea></div>
        </div>

        <div class="field">
          <button class="btn primary" id="btnSaveAction">保存动作</button>
        </div>
      </section>
    `;
  },

  settings(db) {
    const cfg = getCfg(db);
    return `
      <section class="card">
        <div class="row space">
          <div class="h1">设置</div>
          <button class="pill" id="btnToggleLang">切换：中文/English</button>
        </div>

        <div class="field"><button class="btn" id="btnExport">导出备份</button></div>
        <div class="field"><div class="label">导入（覆盖）</div><input class="input" type="file" id="fileImport" accept="application/json" /></div>
        <div class="field"><button class="btn danger" id="btnReset">清空数据</button></div>

        <div class="field"><div class="label">当前版本</div><div class="muted small"><span class="kbd">${escHtml(db.meta.version)}</span></div></div>
      </section>
    `;
  }
};

function renderAssetCreateForm(db) {
  const cfg = getCfg(db);
  const statusOptions = (cfg.assetStatuses || []).map(s => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join("");
  const industryOptions = ["", ...(cfg.industries || [])].map(s => `<option value="${escHtml(s)}">${escHtml(s||"(空)")}</option>`).join("");

  return `
    <section class="card">
      <div class="h2">新增标的</div>

      <div class="field"><div class="label">代码（Symbol）*</div><input class="input" id="new_symbol" placeholder="TSLA" /></div>
      <div class="field"><div class="label">状态</div><select class="select" id="new_status">${statusOptions}</select></div>
      <div class="field"><div class="label">行业</div><select class="select" id="new_industry">${industryOptions}</select></div>

      <div class="field"><div class="label">建仓理由（多选）</div><div class="pills">${checkboxList("new_reason", cfg.buildReasons || [], [])}</div></div>
      <div class="field"><div class="label">补充说明</div><textarea class="textarea" id="new_thesis"></textarea></div>
      <div class="field"><div class="label">计划数量</div><input class="input" id="new_planQty" placeholder="200" /></div>
      <div class="field"><div class="label">当前数量</div><input class="input" id="new_holdingQty" value="0" /></div>

      <div class="field"><button class="btn primary" id="btnCreateAsset">保存标的</button></div>
    </section>
  `;
}

function itemAsset(db, a) {
  const days = holdingDays(a);
  return `
    <a class="item" href="#/asset/${encodeURIComponent(a.id)}">
      <div>
        <div class="title">${escHtml(a.symbol)}</div>
        <div class="sub">${escHtml(a.status||"")} · 数量 ${escHtml(String(a.holdingQty||0))} · 天数 ${days ?? "-"}</div>
      </div>
      <div class="right">
        <div class="tag">${escHtml(a.industry || "")}</div>
      </div>
    </a>
  `;
}

function itemAction(db, a) {
  const asset = (db.assets||[]).find(x => x.id === a.assetId);
  const when = a.executedAt || a.plannedAt || "";
  return `
    <div class="item">
      <div>
        <div class="title">${escHtml(asset?.symbol || "-")} · ${escHtml(a.actionType||"")}</div>
        <div class="sub">${escHtml(a.status||"")}</div>
      </div>
      <div class="right"><div class="tag">${escHtml(when ? formatDT(when) : "")}</div></div>
    </div>
  `;
}