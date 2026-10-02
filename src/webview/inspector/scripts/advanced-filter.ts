// src/webview/inspector/scripts/advanced-filter.ts
// ✨ جدید — Parse کردن filter query پیشرفته
// مثال: "type:mesh pos.y>0 !visible"

export interface FilterQuery {
	text: string;
	type?: string;
	not?: string;
	keyValue?: { key: string; op: ">" | "<" | ">=" | "<=" | "=" | "!="; value: number };
}

export function parseFilter(raw: string): FilterQuery {
	const tokens = raw.trim().split(/\s+/).filter(Boolean);
	const q: FilterQuery = { text: "" };
	const textParts: string[] = [];

	for (const tok of tokens) {
		if (tok.startsWith("type:")) {
			q.type = tok.slice(5).toLowerCase();
			continue;
		}
		if (tok.startsWith("!")) {
			q.not = tok.slice(1).toLowerCase();
			continue;
		}
		const m = tok.match(/^([\w.]+)(>=|<=|>|<|=|!=)(-?\d+(?:\.\d+)?)$/);
		if (m) {
			q.keyValue = {
				key: m[1],
				op: m[2] as any,
				value: parseFloat(m[3]),
			};
			continue;
		}
		textParts.push(tok.toLowerCase());
	}
	q.text = textParts.join(" ");
	return q;
}

export function matchesType(q: FilterQuery, type: string): boolean {
	if (q.type && !type.toLowerCase().includes(q.type)) return false;
	if (q.not && type.toLowerCase().includes(q.not)) return false;
	return true;
}

export function matchesText(q: FilterQuery, ...haystack: string[]): boolean {
	if (!q.text) return true;
	const hay = haystack.join(" ").toLowerCase();
	return hay.includes(q.text);
}

export function matchesKeyValue(q: FilterQuery, getValue: (key: string) => number | undefined): boolean {
	if (!q.keyValue) return true;
	const v = getValue(q.keyValue.key);
	if (v === undefined) return false;
	switch (q.keyValue.op) {
		case ">":
			return v > q.keyValue.value;
		case "<":
			return v < q.keyValue.value;
		case ">=":
			return v >= q.keyValue.value;
		case "<=":
			return v <= q.keyValue.value;
		case "=":
			return v === q.keyValue.value;
		case "!=":
			return v !== q.keyValue.value;
	}
	return true;
}
