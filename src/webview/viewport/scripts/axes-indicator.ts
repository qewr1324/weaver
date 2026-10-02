// src/webview/viewport/scripts/axes-indicator.ts
// ✨ XYZ indicator در گوشه — ✅ fix DOM leak (style فقط یک بار)
import { camera } from "./state";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let installed = false;

function ensureCanvas(): void {
	if (canvas) return;

	canvas = document.createElement("canvas");
	canvas.id = "axes-indicator";
	canvas.width = 100;
	canvas.height = 100;
	document.getElementById("canvas-wrap")?.appendChild(canvas);
	ctx = canvas.getContext("2d");

	// ✅ فقط یک بار style اضافه کن
	if (!document.getElementById("axes-indicator-style")) {
		const style = document.createElement("style");
		style.id = "axes-indicator-style";
		style.textContent = `
			#axes-indicator {
				position: absolute;
				bottom: 12px;
				right: 12px;
				width: 90px;
				height: 90px;
				pointer-events: none;
				z-index: 9;
				opacity: 0.85;
			}
		`;
		document.head.appendChild(style);
	}
}

export function drawAxesIndicator(): void {
	if (!canvas || !ctx || !camera) return;

	const BABYLON = (window as any).BABYLON;
	if (!BABYLON) return;

	const w = canvas.width;
	const h = canvas.height;
	const cx = w / 2;
	const cy = h / 2;
	const len = 34;

	ctx.clearRect(0, 0, w, h);

	const invView = camera.getViewMatrix().clone().invert();
	const axes = [
		{ vec: new BABYLON.Vector3(1, 0, 0), color: "#ff4d4d", label: "X" },
		{ vec: new BABYLON.Vector3(0, 1, 0), color: "#4dff4d", label: "Y" },
		{ vec: new BABYLON.Vector3(0, 0, 1), color: "#4d9dff", label: "Z" },
	];

	const projected = axes
		.map((a) => {
			const v = BABYLON.Vector3.TransformNormal(a.vec, invView);
			return { ...a, sx: v.x, sy: -v.y, sz: v.z };
		})
		.sort((a, b) => a.sz - b.sz);

	for (const p of projected) {
		const ex = cx + p.sx * len;
		const ey = cy + p.sy * len;

		ctx.strokeStyle = p.color;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(ex, ey);
		ctx.stroke();

		ctx.fillStyle = p.color;
		ctx.beginPath();
		ctx.arc(ex, ey, 6, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = "#fff";
		ctx.font = "bold 9px monospace";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(p.label, ex, ey);
	}

	ctx.fillStyle = "#fff";
	ctx.beginPath();
	ctx.arc(cx, cy, 3, 0, Math.PI * 2);
	ctx.fill();
}

export function installAxesIndicator(): void {
	if (installed) return;
	installed = true;
	ensureCanvas();
}

// ✅ پاک‌سازی کامل (اختیاری)
export function disposeAxesIndicator(): void {
	if (canvas) {
		canvas.remove();
		canvas = null;
		ctx = null;
	}
	const style = document.getElementById("axes-indicator-style");
	if (style) style.remove();
	installed = false;
}
