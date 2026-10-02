// src/webview/shared/format.ts
/**
 * helperهای فرمت‌دهی — بدون وابستگی به DOM.
 */

export function formatNum(v: unknown): string {
	if (typeof v !== "number" || !Number.isFinite(v)) return "0";
	const s = v.toFixed(6).replace(/\.?0+$/, "");
	return s === "" || s === "-" ? "0" : s;
}

export function esc(s: unknown): string {
	return String(s).replace(
		/[&<>"']/g,
		(c) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[c]!,
	);
}

export function isColorValue(v: unknown): v is string {
	if (typeof v !== "string") return false;
	return /^#([0-9a-fA-F]{3,8})$/.test(v) || /^rgb/.test(v);
}

/**
 * hex کوتاه (#abc) یا 8 رقمی (#aabbccdd) رو به #rrggbb نرمال می‌کنه.
 * برای <input type="color"> لازمه.
 */
export function toHex6(v: string): string {
	if (v.length === 4) {
		return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
	}
	return v.slice(0, 7);
}

export function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}
