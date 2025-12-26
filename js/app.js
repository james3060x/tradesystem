// js/app.js
import { store } from "./store.js";
import { uid, nowISO, escHtml, formatDT, toast } from "./utils.js";

function render(db) {
	const el = document.getElementById("app");
	if (!el) return;

	el.innerHTML = `
		<div class="page">
			<h1>TradeSystem（v${escHtml(db?.meta?.version || "")}）</h1>

			<div class="card">
				<div class="kv"><b>UpdatedAt</b><span>${escHtml(formatDT(db?.meta?.updatedAt || ""))}</span></div>
				<div class="kv"><b>Assets</b><span>${Array.isArray(db.assets) ? db.assets.length : 0}</span></div>
			</div>

			<div class="card">
				<div class="row">
					<button class="primary" id="btnAddDemo">写入 Demo Asset</button>
					<button class="secondary" id="btnExport">导出备份</button>
					<button class="secondary" id="btnReset">重置 DB</button>
				</div>
				<small>验收点：写入后刷新页面，Assets 数量仍在，说明 LocalStorage 正常。</small>
			</div>
		</div>
	`;
}

function bind() {
	document.addEventListener("click", (e) => {
		const t = e.target;
		if (!(t instanceof HTMLElement)) return;

		if (t.id === "btnAddDemo") {
			const db = store.update((draft) => {
				draft.assets.push({
					id: uid("asset"),
					name: "TSLA",
					ticker: "TSLA",
					assetClass: "Stock",
					venue: "US",
					status: "Watching",
					notes: "demo",
					createdAt: nowISO(),
					updatedAt: nowISO(),
				});
			});
			toast("已写入 Demo Asset");
			render(db);
		}

		if (t.id === "btnExport") {
			store.exportBackup();
		}

		if (t.id === "btnReset") {
			const db = store.reset();
			render(db);
		}
	});
}

function main() {
	const db = store.load();
	render(db);
	bind();
}

main();