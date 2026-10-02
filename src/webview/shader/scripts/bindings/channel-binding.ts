// src/webview/shader/scripts/bindings/channel-binding.ts
import { CHANNEL_META } from "../../../../scene/shader/defaults";
import type { ShaderChannelKey, ChannelSource } from "../../../../scene/shader/types";
import { updatePreviewOnly } from "../render";
import { state } from "../state";
import { Messaging } from "../messaging";
import { fileToDataUrl, setTexture, clearTexture } from "../texture-store";

export interface ChannelHooks {
	onRerender: () => void;
}

export function bindChannelInputs(root: HTMLElement, hooks: ChannelHooks): void {
	const shader = state.current;
	if (!shader) return;

	// ─── toggle ───
	root.querySelectorAll<HTMLInputElement>("input[data-channel-toggle]").forEach((cb) => {
		cb.addEventListener("change", () => {
			const key = cb.dataset.channelToggle as ShaderChannelKey;
			const ch = shader.channels[key];
			ch.enabled = cb.checked;

			if (cb.checked && ch.source === "off") {
				ch.source = CHANNEL_META[key].defaultSource;
			} else if (!cb.checked) {
				ch.source = "off";
			}

			hooks.onRerender();
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
		});
	});

	// ─── source ───
	root.querySelectorAll<HTMLSelectElement>("select[data-channel-source]").forEach((sel) => {
		sel.addEventListener("change", () => {
			const key = sel.dataset.channelSource as ShaderChannelKey;
			const ch = shader.channels[key];
			ch.source = sel.value as ChannelSource;
			hooks.onRerender();
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
		});
	});

	// ─── color ───
	root.querySelectorAll<HTMLInputElement>("input[data-channel-color]").forEach((inp) => {
		inp.addEventListener("input", () => {
			const key = inp.dataset.channelColor as ShaderChannelKey;
			const ch = shader.channels[key];
			const [r, g, b] = hexToRgb(inp.value);
			const a = ch.color?.[3] ?? 1;
			ch.color = [r, g, b, a];
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
		});
	});

	// ─── alpha ───
	root.querySelectorAll<HTMLInputElement>("input[data-channel-alpha]").forEach((inp) => {
		inp.addEventListener("input", () => {
			const key = inp.dataset.channelAlpha as ShaderChannelKey;
			const ch = shader.channels[key];
			const a = parseFloat(inp.value);
			if (!Number.isFinite(a)) return;
			const [r, g, b] = ch.color ?? [0.5, 0.5, 0.5, 1];
			ch.color = [r, g, b, Math.max(0, Math.min(1, a))];
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
		});
	});

	// ─── number ───
	root.querySelectorAll<HTMLInputElement>("input[data-channel-number]").forEach((inp) => {
		inp.addEventListener("input", () => {
			const key = inp.dataset.channelNumber as ShaderChannelKey;
			const ch = shader.channels[key];
			const v = parseFloat(inp.value);
			if (!Number.isFinite(v)) return;
			ch.number = v;
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
		});
	});

	// ─── texture (text input) ───
	root.querySelectorAll<HTMLInputElement>("input[data-channel-texture]").forEach((inp) => {
		inp.addEventListener("change", async () => {
			const key = inp.dataset.channelTexture as ShaderChannelKey;
			const ch = shader.channels[key];
			const path = inp.value.trim();
			ch.texture = path;

			if (path) {
				await setTexture(key, path);
			} else {
				clearTexture(key);
			}

			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
			hooks.onRerender();
		});
	});

	// ─── texture picker (file button) ───
	root.querySelectorAll<HTMLButtonElement>("button[data-texture-pick]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const key = btn.dataset.texturePick as ShaderChannelKey;
			openFilePicker(key, shader, hooks);
		});
	});

	// ─── texture drop zone ───
	root.querySelectorAll<HTMLElement>("[data-texture-preview]").forEach((zone) => {
		zone.addEventListener("dragover", (e) => {
			e.preventDefault();
			zone.classList.add("dragover");
		});
		zone.addEventListener("dragleave", () => {
			zone.classList.remove("dragover");
		});
		zone.addEventListener("drop", async (e) => {
			e.preventDefault();
			zone.classList.remove("dragover");
			const key = zone.dataset.texturePreview as ShaderChannelKey;
			const file = e.dataTransfer?.files?.[0];
			if (!file || !file.type.startsWith("image/")) return;

			const dataUrl = await fileToDataUrl(file);
			shader.channels[key].texture = dataUrl;
			await setTexture(key, dataUrl);
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
			hooks.onRerender();
		});
		zone.addEventListener("click", () => {
			const key = zone.dataset.texturePreview as ShaderChannelKey;
			openFilePicker(key, shader, hooks);
		});
	});

	// ─── intensity ───
	root.querySelectorAll<HTMLInputElement>("input[data-channel-intensity]").forEach((inp) => {
		inp.addEventListener("input", () => {
			const key = inp.dataset.channelIntensity as ShaderChannelKey;
			const ch = shader.channels[key];
			const v = parseFloat(inp.value);
			if (!Number.isFinite(v)) return;
			ch.intensity = v;
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
		});
	});
}

function openFilePicker(key: ShaderChannelKey, shader: any, hooks: ChannelHooks): void {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = "image/*";
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;

		const dataUrl = await fileToDataUrl(file);
		shader.channels[key].texture = dataUrl;
		await setTexture(key, dataUrl);
		Messaging.pushShader(shader);
		updatePreviewOnly(shader);
		hooks.onRerender();
	};
	input.click();
}

function hexToRgb(hex: string): [number, number, number] {
	const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (!m) return [0.5, 0.5, 0.5];
	return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}
