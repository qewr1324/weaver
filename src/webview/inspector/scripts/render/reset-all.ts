// src/webview/inspector/scripts/render/reset-all.ts
// ✨ جدید — Reset All button برای Transform
import type { InspectorState } from "../state";

export function renderResetAll(state: InspectorState): string {
	if (!state.current) return "";
	return `<div class="reset-all-wrap">
		<button class="reset-all-btn" id="resetAllTransform" title="Reset all transform channels">
			↺ Reset All
		</button>
	</div>`;
}
