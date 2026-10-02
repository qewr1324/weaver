// src/webview/shader/scripts/bindings/settings-binding.ts
import { updatePreviewOnly } from "../render";
import { state } from "../state";
import { Messaging } from "../messaging";

export function bindSettingsInputs(root: HTMLElement): void {
	const shader = state.current;
	if (!shader) return;

	// ─── selects ───
	root.querySelectorAll<HTMLSelectElement>("select[data-setting]").forEach((sel) => {
		sel.addEventListener("change", () => {
			const key = sel.dataset.setting!;
			(shader.render as any)[key] = sel.value;
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
		});
	});

	// ─── checkboxes ───
	root.querySelectorAll<HTMLInputElement>("input[type='checkbox'][data-setting]").forEach((cb) => {
		cb.addEventListener("change", () => {
			const key = cb.dataset.setting!;
			(shader.render as any)[key] = cb.checked;
			Messaging.pushShader(shader);
			updatePreviewOnly(shader);
		});
	});

	// ─── output targets ───
	root.querySelectorAll<HTMLInputElement>("input[data-target]").forEach((cb) => {
		cb.addEventListener("change", () => {
			const target = cb.dataset.target as "glsl" | "babylon" | "libgdx" | "monogame";
			const set = new Set(shader.output.targets);
			if (cb.checked) set.add(target);
			else set.delete(target);
			shader.output.targets = [...set];
			Messaging.pushShader(shader);
		});
	});

	// ─── entry name ───
	const entryInp = root.querySelector<HTMLInputElement>("input[data-output-entry]");
	entryInp?.addEventListener("input", () => {
		shader.output.entryName = entryInp.value;
		Messaging.pushShader(shader);
	});

	// ─── name ───
	const nameInp = root.querySelector<HTMLInputElement>("#shaderNameInput");
	nameInp?.addEventListener("change", () => {
		shader.name = nameInp.value.trim() || "Untitled Shader";
		Messaging.pushShader(shader);
	});
}
