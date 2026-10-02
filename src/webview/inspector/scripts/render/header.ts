// src/webview/inspector/scripts/render/header.ts
import { esc } from "../../../shared/format";
import type { InspectorState } from "../state";

export function renderMultiBadge(state: InspectorState): string {
	if (!state.isMulti) return "";
	const names = state.multiNames.slice(0, 3).map(esc).join(", ");
	const more = state.multiNames.length > 3 ? ` +${state.multiNames.length - 3}` : "";
	return `<div class="multi-badge">
		<span>${state.count} selected</span>
		<span class="list">${names}${more}</span>
	</div>`;
}

export function renderNameHeader(state: InspectorState): string {
	if (!state.current) return "";
	return `<div class="name">
		<input type="text" id="nameInput" value="${esc(state.current.name)}" spellcheck="false" />
		<span class="type">${esc(state.current.id.slice(0, 8))}</span>
	</div>`;
}
