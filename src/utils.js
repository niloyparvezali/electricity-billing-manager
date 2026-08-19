export const money = n => `৳${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(Number(n || 0))}`;
export const fmt = n => new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(Number(n || 0));

export function localInputValue(date = new Date()) {
  const d = new Date(date);
  const pad = x => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function prettyDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-BD", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

export function prettyDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysBetween(from, to) {
  return Math.max(0, Math.ceil((new Date(to) - new Date(from)) / 86400000));
}
