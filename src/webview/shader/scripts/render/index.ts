// src/webview/shader/scripts/render/index.ts
import type { ShaderDefinition } from "../../../../scene/shader/types";
import { renderChannels } from "./channels";
import { renderCodeOutput } from "./code-output";
import { renderHeader } from "./header";
import { renderOutput } from "./output";
import { renderRenderSettings } from "./render-settings";
import { mountPreview, updatePreview } from "../preview/view";

export interface RenderHooks {
	onBind: () => void;
}

let previewMounted = false;

export function renderFull(root: HTMLElement, shader: ShaderDefinition | null, hooks: RenderHooks): void {
	if (!shader) {
		root.innerHTML = `<div class="empty">No shader loaded</div>`;
		previewMounted = false;
		return;
	}

	let html = "";
	html += renderHeader(shader);
	html += `<div class="shader-body">`;
	html += `<div class="shader-layout">`;
	html += `<div class="shader-left">`;
	html += renderRenderSettings(shader);
	html += renderChannels(shader);
	html += renderOutput(shader);
	html += renderCodeOutput(shader);
	html += `</div>`;
	html += `<div class="shader-right" id="previewContainer"></div>`;
	html += `</div>`;
	html += `</div>`;

	root.innerHTML = html;

	const previewContainer = root.querySelector<HTMLElement>("#previewContainer");
	if (previewContainer) {
		mountPreview(previewContainer);
		updatePreview(shader);
		previewMounted = true;
	}

	hooks.onBind();
}

export function updatePreviewOnly(shader: ShaderDefinition): void {
	if (!previewMounted) return;
	updatePreview(shader);
}
