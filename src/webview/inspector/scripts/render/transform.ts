// src/webview/inspector/scripts/render/transform.ts
import { formatNum } from "../../../shared/format";
import { parseFilter, matchesKeyValue, matchesText } from "../advanced-filter";
import { isPinned } from "../pin-lock";
import { AXES, CHANNELS, type InspectorState } from "../state";

/**
 * مقادیر یک کانال رو از همه‌ی selection ها جمع می‌کنه.
 * اگه multi-select باشه، مقادیر متفاوت → Mixed
 */
function getChannelValues(state: InspectorState, ch: string, ax: string): number[] {
	const c = state.current;
	if (!c) return [];

	// اگه multi-select داریم، از multiData استفاده کن (اگه موجود باشه)
	const multi = (state as any).multiData as Array<{ transform: any; localEuler?: any }> | undefined;
	if (state.isMulti && multi && multi.length > 1) {
		return multi.map((m) => {
			if (ch === "rotation") {
				return m.localEuler?.[ax] ?? m.transform.rotation[ax] ?? 0;
			}
			return m.transform[ch][ax] ?? 0;
		});
	}

	// تک انتخاب
	if (ch === "rotation") {
		return [(state.localEuler as any)[ax] ?? 0];
	}
	return [c.transform[ch as "position" | "scale"][ax as "x" | "y" | "z"] ?? 0];
}

function isMixed(values: number[]): boolean {
	if (values.length <= 1) return false;
	const first = values[0];
	return values.some((v) => Math.abs(v - first) > 1e-6);
}

function displayValue(values: number[]): string {
	if (values.length === 0) return "0";
	if (isMixed(values)) return "—";
	return formatNum(values[0]);
}

export function renderTransform(state: InspectorState): string {
	const c = state.current;
	if (!c) return "";

	const q = parseFilter(state.propertyFilter);
	const channels = CHANNELS.filter((ch) => {
		if (!matchesText(q, ch.key, ch.label, "transform")) return false;

		// اگه keyValue filter داره، مقدارش رو چک کن
		if (q.keyValue) {
			const [k, ax] = q.keyValue.key.split(".");
			if (k === ch.key && AXES.includes(ax as any)) {
				const values = getChannelValues(state, ch.key, ax);
				return matchesKeyValue(q, () => values[0]);
			}
		}
		return true;
	});

	if (channels.length === 0) return "";

	let html = `<div class="comp" data-comp="transform">`;
	html += `<div class="comp-head">
		Transform
		<span class="live-dot" id="liveDot" title="Live sync"></span>
	</div>`;
	html += `<div class="comp-body">`;

	for (const ch of channels) {
		for (const ax of AXES) {
			// اگه keyValue filter داره و این فیلد مطابق نیست، رد کن
			if (q.keyValue) {
				const [k, a] = q.keyValue.key.split(".");
				if (k === ch.key && a !== ax) continue;
			}

			const fieldId = `${ch.key}.${ax}`;
			const pinned = isPinned(fieldId);
			const values = getChannelValues(state, ch.key, ax);
			const mixed = isMixed(values);
			const display = displayValue(values);

			// step بر اساس channel
			const step = ch.key === "scale" ? 0.01 : ch.key === "rotation" ? 1 : 0.1;

			html += `<div class="row${pinned ? " pinned-row" : ""}" data-field="${fieldId}">
				<label class="pin-btn${pinned ? " pinned" : ""}"
					   data-pin="${fieldId}"
					   title="${pinned ? "Unpin" : "Pin this field"}">${pinned ? "📌" : "○"}</label>
				<label title="${ch.label}.${ax.toUpperCase()} — drag to change"
					   data-drag="${fieldId}"
					   data-step="${step}">${ax.toUpperCase()}</label>
				<input type="number" step="any"
					   data-ch="${ch.key}" data-ax="${ax}"
					   value="${display}"
					   placeholder="${mixed ? "Mixed" : ""}"
					   title="${ch.label}.${ax.toUpperCase()}${mixed ? " (multiple values)" : ""}"
					   ${mixed ? 'data-mixed="true"' : ""} />
				<label class="reset" data-reset="${fieldId}"
					   data-default="${ch.default}"
					   title="Reset to ${ch.default}">⟲</label>
			</div>`;
		}
	}

	html += `</div></div>`;
	return html;
}
