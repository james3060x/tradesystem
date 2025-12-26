export function parseRoute(hash) {
  const h = (hash || "#/dashboard").replace(/^#/, "");
  const [pathPart, queryPart] = h.split("?");
  const path = pathPart || "/dashboard";
  const query = Object.fromEntries(new URLSearchParams(queryPart || ""));
  const seg = path.split("/").filter(Boolean);

  // routes
  // /dashboard
  // /assets
  // /asset/:id
  // /assess/new
  // /actions/new
  // /settings
  if (seg[0] === "asset" && seg[1]) return { name: "asset", params: { id: seg[1] }, query };
  if (seg[0] === "dashboard") return { name: "dashboard", params: {}, query };
  if (seg[0] === "assets") return { name: "assets", params: {}, query };
  if (seg[0] === "assess" && seg[1] === "new") return { name: "assessNew", params: {}, query };
  if (seg[0] === "actions" && seg[1] === "new") return { name: "actionNew", params: {}, query };
  if (seg[0] === "settings") return { name: "settings", params: {}, query };
  return { name: "dashboard", params: {}, query };
}

export function setActiveNav(name) {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;
  [...nav.querySelectorAll(".nav-item")].forEach(a => {
    const r = a.getAttribute("data-route");
    const active =
      (name === "dashboard" && r === "dashboard") ||
      (name === "assets" && r === "assets") ||
      (name === "asset" && r === "assets") ||
      (name === "assessNew" && r === "assess") ||
      (name === "actionNew" && r === "actions") ||
      (name === "settings" && r === "settings");
    a.classList.toggle("active", active);
  });
}