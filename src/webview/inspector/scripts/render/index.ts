// src/webview/inspector/scripts/render/index.ts
import { formatNum } from "../../../shared/format";
import { registerLiveDot } from "../live-sync";
import type { InspectorState } from "../state";
import { renderComponents } from "./components";
import { renderEmpty } from "./empty";
import { renderFilter } from "./filter";
import { renderMultiBadge, renderNameHeader } from "./header";
import { renderTransform } from "./transform";
import { quatToEuler } from "../utils/quaternion";

export interface RenderHooks {
	onBind: () => void;
}

export function renderFull(root: HTMLElement, state: InspectorState, hooks: RenderHooks): void {
	if (!state.current) {
		root.innerHTML = renderEmpty();
		state.focusedFieldId = null;
		registerLiveDot(null);
		return;
	}

	// ⭐ قبل از render، localEuler رو از quaternion محاسبه کن
	const e = quatToEuler(state.current.transform.rotation as any);
	state.localEuler.x = e.x;
	state.localEuler.y = e.y;
	state.localEuler.z = e.z;

	let html = "";
	html += renderMultiBadge(state);
	html += renderNameHeader(state);
	html += renderFilter(state);
	html += renderTransform(state);
	html += renderComponents(state);

	root.innerHTML = html;
	registerLiveDot(document.getElementById("liveDot"));
	hooks.onBind();
}

export function updateTransformValuesOnly(root: HTMLElement, state: InspectorState): void {
	if (!state.current) return;
	const c = state.current;

	// ⭐ از quaternion، Euler رو محاسبه کن و localEuler رو آپدیت کن
	const e = quatToEuler(c.transform.rotation as any);
	state.localEuler.x = e.x;
	state.localEuler.y = e.y;
	state.localEuler.z = e.z;

	for (const ch of ["position", "rotation", "scale"] as const) {
		for (const ax of ["x", "y", "z"] as const) {
			const inp = root.querySelector<HTMLInputElement>(`input[data-ch="${ch}"][data-ax="${ax}"]`);
			if (!inp) continue;
			if (document.activeElement === inp) continue;

			let v: number;
			if (ch === "rotation") {
				v = (state.localEuler as any)[ax];
			} else {
				v = (c.transform as any)[ch][ax];
			}

			const newStr = formatNum(v);
			if (inp.value !== newStr) inp.value = newStr;
		}
	}
}
