// src/webview/inspector/scripts/render/components.ts
import { esc, formatNum, isColorValue, toHex6 } from "../../../shared/format";
import type { InspectorComponent, InspectorState } from "../state";

export function renderComponents(state: InspectorState): string {
	const c = state.current;
	if (!c) return "";

	const filter = state.propertyFilter.trim().toLowerCase();
	let html = "";

	for (const comp of c.components || []) {
		const title = comp.type.charAt(0).toUpperCase() + comp.type.slice(1);
		if (filter && !comp.type.toLowerCase().includes(filter)) continue;

		html += `<div class="comp" data-comp="${esc(comp.type)}">`;
		html += `<div class="comp-head">${esc(title)}</div>`;
		html += `<div class="comp-body">`;

		const entries = Object.entries(comp).filter(([k]) => k !== "id" && k !== "type");
		for (const [k, v] of entries) {
			html += renderPropRow(k, v);
		}

		html += `</div></div>`;
	}
	return html;
}

function renderPropRow(key: string, value: unknown): string {
	let input: string;
	if (isColorValue(value)) {
		input = `<input type="color" data-prop="${esc(key)}" value="${esc(toHex6(value))}" />`;
	} else if (typeof value === "number") {
		input = `<input type="number" step="any" data-prop-num="${esc(key)}" value="${formatNum(value)}" />`;
	} else {
		const display = typeof value === "object" ? JSON.stringify(value) : String(value);
		input = `<input type="text" data-prop="${esc(key)}" value="${esc(display)}" />`;
	}
	return `<div class="row">
		<label title="${esc(key)}">${esc(key.charAt(0))}</label>
		${input}
	</div>`;
}

export type { InspectorComponent };
