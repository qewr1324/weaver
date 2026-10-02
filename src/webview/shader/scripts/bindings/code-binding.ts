// src/webview/shader/scripts/bindings/code-binding.ts
import { generateAll } from "../codegen";
import { postToExtension } from "../../../shared/vscode-api";
import { state } from "../state";

export function bindCodeOutput(root: HTMLElement): void {
	const shader = state.current;
	if (!shader) return;

	// ─── tabs ───
	root.querySelectorAll<HTMLButtonElement>("[data-code-tab]").forEach((tab) => {
		tab.addEventListener("click", () => {
			const name = tab.dataset.codeTab!;

			root.querySelectorAll<HTMLButtonElement>("[data-code-tab]").forEach((t) => {
				t.classList.toggle("active", t.dataset.codeTab === name);
			});
			root.querySelectorAll<HTMLElement>("[data-code-panel]").forEach((p) => {
				p.classList.toggle("active", p.dataset.codePanel === name);
			});
		});
	});

	// ─── copy single file ───
	root.querySelectorAll<HTMLButtonElement>("[data-code-copy]").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const name = btn.dataset.codeCopy!;
			const files = generateAll(shader);
			const content = files[name];
			if (!content) return;

			try {
				await navigator.clipboard.writeText(content);
				flashButton(btn, "Copied!");
			} catch {
				flashButton(btn, "Failed");
			}
		});
	});

	// ─── copy all ───
	const copyAllBtn = root.querySelector<HTMLButtonElement>("[data-code-action='copy-all']");
	copyAllBtn?.addEventListener("click", async () => {
		const files = generateAll(shader);
		const parts: string[] = [];
		for (const [name, content] of Object.entries(files)) {
			parts.push(`// ─── ${name} ───\n${content}`);
		}
		const all = parts.join("\n\n");

		try {
			await navigator.clipboard.writeText(all);
			flashButton(copyAllBtn, "Copied all!");
		} catch {
			flashButton(copyAllBtn, "Failed");
		}
	});

	// ─── save all (از طریق extension) ───
	const saveAllBtn = root.querySelector<HTMLButtonElement>("[data-code-action='save-all']");
	saveAllBtn?.addEventListener("click", () => {
		const files = generateAll(shader);
		postToExtension({
			type: "shader:save-files",
			shaderName: shader.name,
			files,
		});
		flashButton(saveAllBtn, "Saving…");
	});
}

function flashButton(btn: HTMLButtonElement, text: string): void {
	const original = btn.textContent;
	btn.textContent = text;
	btn.disabled = true;
	setTimeout(() => {
		btn.textContent = original;
		btn.disabled = false;
	}, 1200);
}
