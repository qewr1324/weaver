// src/webview/shader/scripts/render/channel.ts
import { CHANNEL_META } from "../../../../scene/shader/defaults";
import type { ShaderChannel, ShaderChannelKey, ChannelSource } from "../../../../scene/shader/types";

const SOURCE_LABELS: Record<ChannelSource, string> = {
	off: "Off",
	color: "Color",
	texture: "Texture",
	"color-texture": "Color × Texture",
	number: "Number",
	"number-texture": "Number × Texture",
};

export function renderChannel(key: ShaderChannelKey, channel: ShaderChannel): string {
	const meta = CHANNEL_META[key];
	const enabled = channel.enabled;

	let html = `<div class="channel${enabled ? " enabled" : ""}" data-channel="${key}">`;

	html += `<div class="channel-head">`;
	html += `<input type="checkbox" class="channel-toggle" data-channel-toggle="${key}" ${enabled ? "checked" : ""} />`;
	html += `<span class="channel-label">${esc(meta.label)}</span>`;
	html += `<span class="channel-desc">${esc(meta.description)}</span>`;
	html += `</div>`;

	if (enabled) {
		html += `<div class="channel-body">`;

		html += `<div class="channel-row">`;
		html += `<label>Source</label>`;
		html += `<select data-channel-source="${key}">`;
		for (const src of meta.allowedSources) {
			if (src === "off") continue;
			html += `<option value="${src}" ${channel.source === src ? "selected" : ""}>${SOURCE_LABELS[src]}</option>`;
		}
		html += `</select>`;
		html += `</div>`;

		html += renderSourceOptions(key, channel);

		if (channel.source === "color-texture" || channel.source === "number-texture") {
			html += `<div class="channel-row">
				<label>Intensity</label>
				<input type="number" step="0.01" data-channel-intensity="${key}"
					value="${formatNum(channel.intensity ?? 1)}" />
			</div>`;
		}

		html += `</div>`;
	}

	html += `</div>`;
	return html;
}

function renderSourceOptions(key: ShaderChannelKey, channel: ShaderChannel): string {
	let html = "";

	if (channel.source === "color" || channel.source === "color-texture") {
		const c = channel.color ?? [0.5, 0.5, 0.5, 1];
		const hex = rgbToHex(c[0], c[1], c[2]);
		html += `<div class="channel-row">
			<label>Color</label>
			<input type="color" data-channel-color="${key}" value="${hex}" />
			<input type="number" step="0.01" min="0" max="1" data-channel-alpha="${key}" value="${formatNum(c[3])}" title="Alpha" />
		</div>`;
	}

	if (channel.source === "number" || channel.source === "number-texture") {
		html += `<div class="channel-row">
			<label>Value</label>
			<input type="number" step="0.01" data-channel-number="${key}"
				value="${formatNum(channel.number ?? 0)}" />
		</div>`;
	}

	if (channel.source === "texture" || channel.source === "color-texture" || channel.source === "number-texture") {
		const path = channel.texture ?? "";

		html += `<div class="channel-row texture-row">`;
		html += `<label>Texture</label>`;
		html += `<div class="texture-picker">`;

		html += `<div class="texture-preview" data-texture-preview="${key}" title="Click or drop image">`;
		html += path ? `<span class="texture-loaded">🖼</span>` : `<span class="texture-empty">drop</span>`;
		html += `</div>`;

		html += `<input type="text" data-channel-texture="${key}" value="${esc(path)}" placeholder="textures/wood.png" spellcheck="false" />`;
		html += `<button class="texture-btn" data-texture-pick="${key}" title="Pick file">📁</button>`;

		html += `</div>`;
		html += `</div>`;
	}

	return html;
}

function rgbToHex(r: number, g: number, b: number): string {
	const toByte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
	return "#" + [r, g, b].map((v) => toByte(v).toString(16).padStart(2, "0")).join("");
}

function formatNum(v: number): string {
	if (!Number.isFinite(v)) return "0";
	const s = v.toFixed(4).replace(/\.?0+$/, "");
	return s === "" || s === "-" ? "0" : s;
}

function esc(s: unknown): string {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
