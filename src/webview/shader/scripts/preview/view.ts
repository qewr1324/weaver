// src/webview/shader/scripts/preview/view.ts
import type { ShaderDefinition } from "../../../../scene/shader/types";
import { ShaderPreviewRenderer, type PreviewShape } from "./renderer";

let renderer: ShaderPreviewRenderer | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let currentShape: PreviewShape = "sphere";

export function mountPreview(container: HTMLElement): void {
	container.innerHTML = `
		<div class="preview-wrap">
			<div class="preview-head">
				<span class="preview-title">Preview</span>
				<div class="preview-tools">
					<button class="preview-btn" data-shape="sphere" title="Sphere">●</button>
					<button class="preview-btn" data-shape="box" title="Box">■</button>
					<button class="preview-btn" data-shape="plane" title="Plane">▬</button>
					<button class="preview-btn" data-toggle="rotate" title="Auto Rotate">⟳</button>
				</div>
			</div>
			<canvas class="preview-canvas" id="shaderPreviewCanvas"></canvas>
		</div>
	`;

	canvasEl = container.querySelector<HTMLCanvasElement>("#shaderPreviewCanvas");
	if (!canvasEl) return;

	renderer = new ShaderPreviewRenderer();
	renderer.init(canvasEl);
	renderer.setShape(currentShape);

	// bind shape buttons
	container.querySelectorAll<HTMLButtonElement>("[data-shape]").forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.shape === currentShape);
		btn.addEventListener("click", () => {
			const shape = btn.dataset.shape as PreviewShape;
			currentShape = shape;
			renderer?.setShape(shape);
			container.querySelectorAll<HTMLButtonElement>("[data-shape]").forEach((b) => {
				b.classList.toggle("active", b.dataset.shape === shape);
			});
		});
	});

	// bind rotate toggle
	const rotateBtn = container.querySelector<HTMLButtonElement>("[data-toggle='rotate']");
	if (rotateBtn) {
		rotateBtn.classList.toggle("active", renderer.state.autoRotate);
		rotateBtn.addEventListener("click", () => {
			if (!renderer) return;
			renderer.state.autoRotate = !renderer.state.autoRotate;
			rotateBtn.classList.toggle("active", renderer.state.autoRotate);
		});
	}
}

export function updatePreview(shader: ShaderDefinition): void {
	if (!renderer) return;
	renderer.setShader(shader);
}

export function unmountPreview(): void {
	if (renderer) {
		renderer.dispose();
		renderer = null;
	}
	canvasEl = null;
}
