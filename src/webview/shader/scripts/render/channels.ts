// src/webview/shader/scripts/render/channels.ts
import { CHANNEL_ORDER } from "../../../../scene/shader/defaults";
import type { ShaderDefinition } from "../../../../scene/shader/types";
import { renderChannel } from "./channel";

export function renderChannels(shader: ShaderDefinition): string {
	let html = `<div class="channels-section">`;
	html += `<div class="channels-head">Channels</div>`;
	html += `<div class="channels-body">`;

	for (const key of CHANNEL_ORDER) {
		const ch = shader.channels[key];
		html += renderChannel(key, ch);
	}

	html += `</div></div>`;
	return html;
}
