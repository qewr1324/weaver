// src/webview/inspector/scripts/render/filter.ts
import { esc } from "../../../shared/format";
import type { InspectorState } from "../state";

export function renderFilter(state: InspectorState): string {
	return `<div class="search-wrap">
		<input type="text" id="propFilter" placeholder="Filter properties…" value="${esc(state.propertyFilter)}" spellcheck="false" />
	</div>`;
}
