// js/store.js
// TradeSystem Web - LocalStorage Store

import { STORAGE_KEY, normalizeDb, migrateDb, validateDb, createEmptyDb } from "./schema.js";
import { nowISO, toast } from "./utils.js";

function safeParse(str) {
	try { return JSON.parse(str); } catch { return null; }
}

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

function touchMeta(db) {
	if (!db.meta) db.meta = {};
	if (!db.meta.createdAt) db.meta.createdAt = nowISO();
	db.meta.updatedAt = nowISO();
}

function downloadJson(filename, obj) {
	const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

export const store = {
	load() {
		let raw = null;
		try { raw = localStorage.getItem(STORAGE_KEY); } catch { raw = null; }

		if (!raw) {
			const fresh = createEmptyDb(new Date());
			localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
			return fresh;
		}

		const parsed = safeParse(raw);
		let db = normalizeDb(parsed, new Date());
		db = migrateDb(db);

		const res = validateDb(db);
		if (!res.ok) {
			console.warn("DB validate failed, reset to empty DB", res.errors);
			toast("本地数据损坏，已重置为空数据库", 2500);

			const fresh = createEmptyDb(new Date());
			localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
			return fresh;
		}

		return db;
	},

	save(db) {
		const res = validateDb(db);
		if (!res.ok) {
			console.warn("Refuse to save invalid DB", res.errors);
			throw new Error("Refuse to save invalid DB");
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
		return db;
	},

	update(fn) {
		const current = this.load();
		const draft = clone(current);

		fn?.(draft);
		touchMeta(draft);

		const res = validateDb(draft);
		if (!res.ok) {
			console.warn("Update rejected by schema validation", res.errors);
			toast("保存失败：数据不符合 schema", 2200);
			const err = new Error("Schema validation failed");
			err.errors = res.errors;
			throw err;
		}

		try {
			this.save(draft);
			return draft;
		} catch (e) {
			console.warn("Save failed", e);
			toast("保存失败：LocalStorage 可能已满", 2200);
			throw e;
		}
	},

	exportBackup() {
		const db = this.load();
		const d = new Date();
		const pad = (n) => String(n).padStart(2, "0");
		const name = `TradeSystem_backup_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
		downloadJson(name, db);
		toast("已导出备份", 1600);
	},

	importBackup(rawObj) {
		let db = normalizeDb(rawObj, new Date());
		db = migrateDb(db);

		if (!db.meta) db.meta = {};
		if (!db.meta.createdAt) db.meta.createdAt = nowISO();
		db.meta.updatedAt = nowISO();

		const res = validateDb(db);
		if (!res.ok) {
			console.warn("Import rejected", res.errors);
			toast("导入失败：备份文件结构不合法", 2200);
			const err = new Error("Import validation failed");
			err.errors = res.errors;
			throw err;
		}

		this.save(db);
		toast("导入成功（已覆盖本地数据）", 2000);
		return db;
	},

	reset() {
		const fresh = createEmptyDb(new Date());
		this.save(fresh);
		toast("已重置为空数据库", 1800);
		return fresh;
	},
};