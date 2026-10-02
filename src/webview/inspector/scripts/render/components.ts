// src/webview/inspector/scripts/render/components.ts
import { esc, formatNum, isColorValue, toHex6 } from "../../../shared/format";
import { parseFilter, matchesText, matchesType } from "../advanced-filter";
import type { InspectorComponent, InspectorState } from "../state";

/**
 * نوع داده‌ی property رو تشخیص می‌ده.
 * اگه schema داشته باشی، اینجا می‌تونی override کنی.
 */
type PropKind = "number" | "int" | "bool" | "color" | "string" | "enum" | "vector2" | "vector3" | "vector4" | "node-ref" | "asset-ref" | "json";

function detectKind(key: string, value: unknown): PropKind {
	if (typeof value === "boolean") return "bool";
	if (typeof value === "number") {
		return Number.isInteger(value) && /count|index|segments|steps/i.test(key) ? "int" : "number";
	}
	if (isColorValue(value)) return "color";
	if (typeof value === "string") {
		if (/asset|texture|material|model|mesh/i.test(key)) return "asset-ref";
		if (/node|target|parent|child/i.test(key)) return "node-ref";
		return "string";
	}
	if (typeof value === "object" && value !== null) {
		const v = value as Record<string, number>;
		if ("x" in v && "y" in v && "z" in v && "w" in v) return "vector4";
		if ("x" in v && "y" in v && "z" in v) return "vector3";
		if ("x" in v && "y" in v) return "vector2";
		return "json";
	}
	return "string";
}

export function renderComponents(state: InspectorState): string {
	const c = state.current;
	if (!c) return "";

	const q = parseFilter(state.propertyFilter);
	let html = "";

	for (const comp of c.components || []) {
		if (!matchesType(q, comp.type)) continue;

		const title = comp.type.charAt(0).toUpperCase() + comp.type.slice(1);
		const enabled = (comp as any).enabled !== false;

		html += `<div class="comp" data-comp="${esc(comp.type)}">`;
		html += `<div class="comp-head">
			${esc(title)}
			${!enabled ? '<span class="comp-disabled-tag">disabled</span>' : ""}
		</div>`;
		html += `<div class="comp-body">`;

		const entries = Object.entries(comp).filter(([k]) => k !== "id" && k !== "type" && k !== "enabled");

		// اگه keyValue filter داره، فیلتر کن
		const filtered = q.keyValue
			? entries.filter(([k]) => {
					if (q.keyValue!.key !== k) return false;
					const v = typeof comp[k] === "number" ? (comp[k] as number) : undefined;
					if (v === undefined) return false;
					switch (q.keyValue!.op) {
						case ">":
							return v > q.keyValue!.value;
						case "<":
							return v < q.keyValue!.value;
						case ">=":
							return v >= q.keyValue!.value;
						case "<=":
							return v <= q.keyValue!.value;
						case "=":
							return v === q.keyValue!.value;
						case "!=":
							return v !== q.keyValue!.value;
					}
					return true;
				})
			: entries;

		if (filtered.length === 0 && q.text) {
			// اگه filter هیچ property رو match نکرد، کل component رو نشون نده
			continue;
		}

		for (const [k, v] of filtered) {
			if (q.text && !matchesText(q, k, comp.type)) continue;
			html += renderPropRow(k, v);
		}

		html += `</div></div>`;
	}

	return html;
}

function renderPropRow(key: string, value: unknown): string {
	const kind = detectKind(key, value);
	const label = `<label title="${esc(key)}">${esc(key.charAt(0))}</label>`;

	let input: string;
	switch (kind) {
		case "bool": {
			input = `<input type="checkbox" data-prop-bool="${esc(key)}" ${value ? "checked" : ""} />`;
			break;
		}
		case "int": {
			input = `<input type="number" step="1" data-prop-num="${esc(key)}" value="${formatNum(value as number)}" />`;
			break;
		}
		case "number": {
			input = `<input type="number" step="any" data-prop-num="${esc(key)}" value="${formatNum(value as number)}" />`;
			break;
		}
		case "color": {
			input = `<input type="color" data-prop="${esc(key)}" value="${esc(toHex6(value as string))}" />`;
			break;
		}
		case "vector2":
		case "vector3":
		case "vector4": {
			const axes = kind === "vector2" ? ["x", "y"] : kind === "vector3" ? ["x", "y", "z"] : ["x", "y", "z", "w"];
			input = `<div class="vec-group">${axes
				.map((a) => {
					const v = (value as any)[a];
					return `<span class="vec-cell">
						<span class="vec-axis">${a.toUpperCase()}</span>
						<input type="number" step="any"
							   data-vec-key="${esc(key)}"
							   data-vec-axis="${a}"
							   value="${formatNum(v)}" />
					</span>`;
				})
				.join("")}</div>`;
			break;
		}
		case "asset-ref": {
			input = `<div class="ref-row">
				<input type="text" data-prop="${esc(key)}" value="${esc(String(value ?? ""))}" />
				<button class="ref-btn" data-ref-pick="${esc(key)}" title="Pick asset">📁</button>
			</div>`;
			break;
		}
		case "node-ref": {
			input = `<div class="ref-row">
				<input type="text" data-prop="${esc(key)}" value="${esc(String(value ?? ""))}" />
				<button class="ref-btn" data-node-pick="${esc(key)}" title="Pick node">🎯</button>
			</div>`;
			break;
		}
		case "json": {
			const display = JSON.stringify(value);
			input = `<input type="text" data-prop="${esc(key)}" value="${esc(display)}" readonly />`;
			break;
		}
		default: {
			const display = typeof value === "object" ? JSON.stringify(value) : String(value);
			input = `<input type="text" data-prop="${esc(key)}" value="${esc(display)}" />`;
		}
	}

	return `<div class="row" data-prop-row="${esc(key)}">${label}${input}</div>`;
}

export type { InspectorComponent };
