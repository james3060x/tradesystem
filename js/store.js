import { STORAGE_KEY, SCHEMA_VERSION, defaultDB, validateDBShape } from "./schema.js";
import { nowISO, toast } from "./utils.js";

export const store = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDB();
    try {
      const db = JSON.parse(raw);
      const v = validateDBShape(db);
      if (!v.ok) {
        toast(`导入数据异常：${v.error}，已重置为空库`);
        return defaultDB();
      }
      return migrate(db);
    } catch (e) {
      toast("数据损坏，已重置为空库");
      return defaultDB();
    }
  },

  save(db) {
    db.meta.updatedAt = nowISO();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  },

  update(mutator) {
    const db = this.load();
    const next = structuredClone(db);
    mutator(next);
    next.meta.updatedAt = nowISO();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      toast("保存失败：LocalStorage 空间不足（建议导出备份并清理）");
      throw e;
    }
    return next;
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    return defaultDB();
  },

  exportFile() {
    const db = this.load();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const ts = new Date();
    const pad = (n)=>String(n).padStart(2,"0");
    const name = `TradeSystem_backup_${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.json`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("已导出备份");
  },

  async importFile(file) {
    const text = await file.text();
    const obj = JSON.parse(text);
    const v = validateDBShape(obj);
    if (!v.ok) throw new Error(v.error);
    const migrated = migrate(obj);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    toast("已导入并覆盖当前数据");
    return migrated;
  }
};

function migrate(db) {
  // v1.0.0：目前只做版本对齐位（未来可扩展）
  db.meta = db.meta || {};
  db.meta.version = db.meta.version || SCHEMA_VERSION;
  if (!db.meta.createdAt) db.meta.createdAt = nowISO();
  if (!db.meta.updatedAt) db.meta.updatedAt = nowISO();
  return db;
}