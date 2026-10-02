// src/webview/shader/scripts/render/output.ts
import type { ShaderDefinition } from "../../../../scene/shader/types";

const TARGET_LABELS: Record<string, string> = {
	glsl: "GLSL (raw)",
	babylon: "Babylon.js",
	libgdx: "LibGDX",
	monogame: "MonoGame (HLSL)",
};

export function renderOutput(shader: ShaderDefinition): string {
	const targets = shader.output.targets;

	let html = `<div class="settings-section">`;
	html += `<div class="settings-head">Output Targets</div>`;
	html += `<div class="settings-body">`;

	for (const key of Object.keys(TARGET_LABELS)) {
		const checked = targets.includes(key as any);
		html += `<div class="setting-row">
			<label>${TARGET_LABELS[key]}</label>
			<input type="checkbox" data-target="${key}" ${checked ? "checked" : ""} />
		</div>`;
	}

	html += `<div class="setting-row">
		<label>Entry Name</label>
		<input type="text" data-output-entry value="${shader.output.entryName}" />
	</div>`;

	html += `</div></div>`;
	return html;
}
