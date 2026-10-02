// src/webview/shader/scripts/render/header.ts
import type { ShaderDefinition } from "../../../../scene/shader/types";

export function renderHeader(shader: ShaderDefinition): string {
	const lighting = shader.render.lighting.toUpperCase();
	const alpha = shader.render.alphaMode;

	return `
		<div class="shader-header">
			<input type="text" class="shader-name" id="shaderNameInput" value="${esc(shader.name)}" spellcheck="false" />
			<span class="shader-badge">${lighting}</span>
			<span class="shader-badge secondary">${alpha}</span>
			<div class="header-actions">
				<div class="presets-wrap" id="presetsWrap">
					<button class="header-btn" id="presetsBtn" title="Apply preset">
						<span class="icon">✦</span> Presets
					</button>
				</div>
				<button class="header-btn" id="duplicateBtn" title="Duplicate shader">
					<span class="icon">⎘</span>
				</button>
				<button class="header-btn" id="resetBtn" title="Reset to default">
					<span class="icon">↺</span>
				</button>
				<button class="header-btn" id="exportBtn" title="Export to clipboard">
					<span class="icon">⤴</span> Export
				</button>
				<button class="header-btn" id="importBtn" title="Import from clipboard">
					<span class="icon">⤵</span> Import
				</button>
			</div>
		</div>
	`;
}

function esc(s: string): string {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
