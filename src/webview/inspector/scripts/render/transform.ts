// src/webview/inspector/scripts/render/transform.ts
import { formatNum } from "../../../shared/format";
import { AXES, CHANNELS, type InspectorState } from "../state";

export function renderTransform(state: InspectorState): string {
	const c = state.current;
	if (!c) return "";

	const filter = state.propertyFilter.trim().toLowerCase();
	const channels = CHANNELS.filter((ch) => !filter || ch.key.includes(filter) || ch.label.toLowerCase().includes(filter) || "transform".includes(filter));
	if (channels.length === 0) return "";

	let html = `<div class="comp" data-comp="transform">`;
	html += `<div class="comp-head">Transform <span class="live-dot" id="liveDot" title="Live sync"></span></div>`;
	html += `<div class="comp-body">`;

	for (const ch of channels) {
		for (const ax of AXES) {
			let v: number;
			if (ch.key === "rotation") {
				// ⭐ از localEuler استفاده کن
				v = (state.localEuler as any)[ax];
			} else {
				v = (c.transform as any)[ch.key][ax];
			}

			html += `<div class="row">
				<label title="${ch.label}.${ax.toUpperCase()} — drag to change"
					   data-drag="${ch.key}.${ax}"
					   data-step="${ch.key === "scale" ? 0.01 : ch.key === "rotation" ? 1 : 0.1}">${ax.toUpperCase()}</label>
				<input type="number" step="any"
					   data-ch="${ch.key}" data-ax="${ax}"
					   value="${formatNum(v)}"
					   title="${ch.label}.${ax.toUpperCase()}" />
				<label class="reset" data-reset="${ch.key}.${ax}"
					   data-default="${ch.default}"
					   title="Reset to ${ch.default}">⟲</label>
			</div>`;
		}
	}

	html += `</div></div>`;
	return html;
}
