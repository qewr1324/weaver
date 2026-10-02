// src/webview/shader/scripts/bindings/header-binding.ts
import { applyPreset } from "../../../../scene/shader/presets";
import { postToExtension } from "../../../shared/vscode-api";
import { duplicateShader, exportShaderToJSON, importShaderFromJSON, applyShader, copyToClipboard, readFromClipboard } from "../io";
import { openPresetsMenu, closeMenu } from "../presets-ui";
import { state } from "../state";

export interface HeaderHooks {
	onRerender: () => void;
}

export function bindHeaderInputs(root: HTMLElement, hooks: HeaderHooks): void {
	const shader = state.current;
	if (!shader) return;

	// ─── name ───
	const nameInp = root.querySelector<HTMLInputElement>("#shaderNameInput");
	nameInp?.addEventListener("change", () => {
		shader.name = nameInp.value.trim() || "Untitled Shader";
		postToExtension({ type: "shader:update", payload: shader });
	});

	// ─── presets ───
	const presetsWrap = root.querySelector<HTMLElement>("#presetsWrap");
	const presetsBtn = root.querySelector<HTMLButtonElement>("#presetsBtn");

	presetsBtn?.addEventListener("click", (e) => {
		e.stopPropagation();
		if (!presetsWrap) return;
		if (presetsWrap.classList.contains("open")) {
			closeMenu(presetsWrap);
		} else {
			openPresetsMenu(presetsWrap, () => {
				hooks.onRerender();
			});
		}
	});

	// ─── duplicate ───
	const dupBtn = root.querySelector<HTMLButtonElement>("#duplicateBtn");
	dupBtn?.addEventListener("click", () => {
		const copy = duplicateShader(shader);
		postToExtension({
			type: "shader:duplicate",
			payload: copy,
		});
	});

	// ─── reset ───
	const resetBtn = root.querySelector<HTMLButtonElement>("#resetBtn");
	resetBtn?.addEventListener("click", () => {
		if (!confirm("Reset shader to default PBR? All channel settings will be lost.")) return;
		const next = applyPreset(shader, "standard-pbr");
		applyShader(next);
		hooks.onRerender();
	});

	// ─── export ───
	const exportBtn = root.querySelector<HTMLButtonElement>("#exportBtn");
	exportBtn?.addEventListener("click", async () => {
		const json = exportShaderToJSON(shader);
		const ok = await copyToClipboard(json);
		flash(exportBtn, ok ? "Copied!" : "Failed");
	});

	// ─── import ───
	const importBtn = root.querySelector<HTMLButtonElement>("#importBtn");
	importBtn?.addEventListener("click", async () => {
		const text = await readFromClipboard();
		if (!text) {
			flash(importBtn, "Empty");
			return;
		}

		const result = importShaderFromJSON(text);
		if (!result.ok) {
			flash(importBtn, "Invalid");
			return;
		}

		const imported = result.shader;
		imported.name = shader.name;

		applyShader(imported);
		hooks.onRerender();
		flash(importBtn, "Imported!");
	});
}

function flash(btn: HTMLButtonElement, text: string): void {
	const original = btn.innerHTML;
	btn.innerHTML = text;
	btn.disabled = true;
	setTimeout(() => {
		btn.innerHTML = original;
		btn.disabled = false;
	}, 1200);
}
