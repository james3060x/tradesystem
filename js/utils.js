/*
请更新！
新增功能：i18n 辅助函数、列表 CRUD 辅助、日期/时间解析
调整行数：约 +120 行
*/
export function nowISO() {
  return new Date().toISOString();
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function escHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDT(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseMaybeDT(s) {
  // 支持 "YYYY-MM-DD HH:mm"；留空返回 null
  const t = (s || "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [_, Y, M, D, hh, mm] = m;
  const d = new Date(Number(Y), Number(M) - 1, Number(D), Number(hh), Number(mm), 0);
  return d.toISOString();
}

export function addHours(iso, h) {
  const d = iso ? new Date(iso) : new Date();
  d.setHours(d.getHours() + h);
  return d.toISOString();
}

export function diffDays(fromISO, toISO) {
  if (!fromISO) return null;
  const a = new Date(fromISO).getTime();
  const b = (toISO ? new Date(toISO) : new Date()).getTime();
  const ms = b - a;
  return Math.max(0, Math.floor(ms / (24 * 3600 * 1000)));
}

export function uniq(arr) {
  return Array.from(new Set(arr));
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function toast(msg, ms = 1800) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), ms);
}

// i18n
export function getLang(db) {
  return db?.meta?.lang || "zh";
}

export function setLang(db, lang) {
  db.meta = db.meta || {};
  db.meta.lang = lang;
}

export function t(db, zh, en) {
  const lang = getLang(db);
  return lang === "en" ? (en || zh) : zh;
}

// 可编辑列表 CRUD
export function normalizeItem(s) {
  return String(s || "").trim();
}

export function addToList(list, value) {
  const v = normalizeItem(value);
  if (!v) return list;
  if (list.includes(v)) return list;
  return [...list, v];
}

export function removeFromList(list, value) {
  return (list || []).filter(x => x !== value);
}

export function replaceInList(list, oldValue, newValue) {
  const nv = normalizeItem(newValue);
  if (!nv) return list;
  if (oldValue === nv) return list;
  const next = (list || []).map(x => (x === oldValue ? nv : x));
  // 去重
  return uniq(next);
}