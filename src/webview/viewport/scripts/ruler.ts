// src/webview/viewport/scripts/ruler.ts
import { camera } from "./state";

export interface RulerOptions {
	size: number;
	step: number;
	majorEvery: number;
	unit: string;
}

export const DEFAULT_RULER: RulerOptions = {
	size: 20,
	step: 1,
	majorEvery: 5,
	unit: "m",
};

let topCanvas: HTMLCanvasElement | null = null;
let leftCanvas: HTMLCanvasElement | null = null;
let topCtx: CanvasRenderingContext2D | null = null;
let leftCtx: CanvasRenderingContext2D | null = null;
let options: RulerOptions = { ...DEFAULT_RULER };
let installed = false;

const RULER_SIZE = 20;
const RULER_BG = "#1a1d24";
const RULER_FG = "#6e7681";
const RULER_MAJOR_FG = "#c9d1d9";
const RULER_LINE = "#30363d";
const RULER_CURSOR = "#f78166";

function ensureCanvases(): void {
	if (topCanvas) return;

	topCanvas = document.createElement("canvas");
	topCanvas.id = "ruler-top";
	topCanvas.className = "ruler ruler-top";
	document.getElementById("canvas-wrap")?.appendChild(topCanvas);
	topCtx = topCanvas.getContext("2d");

	leftCanvas = document.createElement("canvas");
	leftCanvas.id = "ruler-left";
	leftCanvas.className = "ruler ruler-left";
	document.getElementById("canvas-wrap")?.appendChild(leftCanvas);
	leftCtx = leftCanvas.getContext("2d");

	const corner = document.createElement("div");
	corner.className = "ruler-corner";
	corner.innerHTML = `<span>${options.unit}</span>`;
	document.getElementById("canvas-wrap")?.appendChild(corner);

	if (!document.getElementById("ruler-style")) {
		const style = document.createElement("style");
		style.id = "ruler-style";
		style.textContent = `
			.ruler {
				position: absolute;
				pointer-events: none;
				z-index: 9;
			}
			.ruler-top {
				top: 0;
				left: ${RULER_SIZE}px;
				right: 0;
				height: ${RULER_SIZE}px;
			}
			.ruler-left {
				top: ${RULER_SIZE}px;
				left: 0;
				width: ${RULER_SIZE}px;
				bottom: 0;
			}
			.ruler-corner {
				position: absolute;
				top: 0;
				left: 0;
				width: ${RULER_SIZE}px;
				height: ${RULER_SIZE}px;
				background: ${RULER_BG};
				border-right: 1px solid ${RULER_LINE};
				border-bottom: 1px solid ${RULER_LINE};
				z-index: 10;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 9px;
				color: ${RULER_FG};
				text-transform: uppercase;
				letter-spacing: 0.5px;
				user-select: none;
			}
			#hud, #fps, #perf-hud {
				top: ${RULER_SIZE + 6}px !important;
			}
			#hud {
				left: ${RULER_SIZE + 6}px !important;
			}
			#fps, #perf-hud {
				right: 6px !important;
			}
		`;
		document.head.appendChild(style);
	}
}

function resize(): void {
	if (!topCanvas || !leftCanvas) return;
	const wrap = document.getElementById("canvas-wrap");
	if (!wrap) return;

	const r = wrap.getBoundingClientRect();
	topCanvas.width = r.width - RULER_SIZE;
	topCanvas.height = RULER_SIZE;
	leftCanvas.width = RULER_SIZE;
	leftCanvas.height = r.height - RULER_SIZE;
}

/**
 * ✅ فاصله‌ی دوربین از مبدأ — مشترک بین دو خط‌کش.
 */
function getDistance(): number {
	if (!camera) return 1;
	const dx = camera.position.x;
	const dy = camera.position.y;
	const dz = camera.position.z;

	const horizontalDist = Math.sqrt(dx * dx + dz * dz);

	if (horizontalDist < 0.5) {
		return Math.max(0.5, Math.abs(dy));
	}

	return Math.max(0.5, horizontalDist);
}

/**
 * ✅ محاسبه‌ی screenPerUnit با در نظر گرفتن aspect ratio.
 *
 * توی Babylon، fov عمودیه. برای اینکه مقیاس افقی و عمودی یکسان باشه،
 * باید برای محور افقی از aspect ratio استفاده کنیم:
 *
 *   screenPerUnit_X = width / (2 * tan(fov/2) * aspect * dist)
 *   screenPerUnit_Y = height / (2 * tan(fov/2) * dist)
 *
 * ولی aspect = width / height، پس:
 *
 *   screenPerUnit_X = height / (2 * tan(fov/2) * dist)   ← همون Y
 *
 * یعنی: برای اینکه ۱ واحد X و ۱ واحد Y یکسان دیده بشن،
 * باید **هر دو** از height استفاده کنن.
 */

let cachedScale = 1;

function updateScale(canvasHeight: number): void {
	if (!camera) return;
	const dist = getDistance();
	const fov = camera.fov || 0.9;

	// ✅ مقیاس مشترک — بر اساس height (که fov عمودی باهاش هماهنگه)
	cachedScale = canvasHeight / (2 * Math.tan(fov / 2) * dist);
}

/**
 * ✅ world X → screen X با مقیاس مشترک.
 */
function worldToScreenX(worldX: number, width: number): number {
	if (!camera) return 0;
	const dx = worldX - camera.position.x;
	return width / 2 + dx * cachedScale;
}

function screenToWorldX(screenX: number, width: number): number {
	if (!camera) return 0;
	if (cachedScale < 1e-9) return camera.position.x;
	const dx = (screenX - width / 2) / cachedScale;
	return camera.position.x + dx;
}

function worldToScreenY(worldY: number, height: number): number {
	if (!camera) return 0;
	const dy = worldY - camera.position.y;
	return height / 2 - dy * cachedScale;
}

function screenToWorldY(screenY: number, height: number): number {
	if (!camera) return 0;
	if (cachedScale < 1e-9) return camera.position.y;
	const dy = (height / 2 - screenY) / cachedScale;
	return camera.position.y + dy;
}

function drawTop(): void {
	if (!topCanvas || !topCtx) return;
	const w = topCanvas.width;
	const h = topCanvas.height;

	topCtx.fillStyle = RULER_BG;
	topCtx.fillRect(0, 0, w, h);

	topCtx.strokeStyle = RULER_LINE;
	topCtx.lineWidth = 1;
	topCtx.beginPath();
	topCtx.moveTo(0, h - 0.5);
	topCtx.lineTo(w, h - 0.5);
	topCtx.stroke();

	const worldLeft = screenToWorldX(0, w);
	const worldRight = screenToWorldX(w, w);

	const step = options.step;
	const start = Math.floor(worldLeft / step) * step;
	const end = Math.ceil(worldRight / step) * step;

	topCtx.font = "9px monospace";
	topCtx.textBaseline = "top";
	topCtx.textAlign = "center";

	for (let v = start; v <= end; v += step) {
		const x = worldToScreenX(v, w);
		if (x < -50 || x > w + 50) continue;

		const isMajor = Math.abs(v % (step * options.majorEvery)) < step * 0.01;

		topCtx.strokeStyle = isMajor ? RULER_MAJOR_FG : RULER_FG;
		topCtx.beginPath();
		topCtx.moveTo(x, isMajor ? 4 : h - 6);
		topCtx.lineTo(x, h);
		topCtx.stroke();

		if (isMajor) {
			topCtx.fillStyle = RULER_MAJOR_FG;
			topCtx.fillText(formatNum(v), x, 2);
		}
	}

	const camX = camera?.position.x ?? 0;
	const cursorX = worldToScreenX(camX, w);
	topCtx.strokeStyle = RULER_CURSOR;
	topCtx.lineWidth = 1;
	topCtx.beginPath();
	topCtx.moveTo(cursorX, 0);
	topCtx.lineTo(cursorX, h);
	topCtx.stroke();
}

function drawLeft(): void {
	if (!leftCanvas || !leftCtx) return;
	const w = leftCanvas.width;
	const h = leftCanvas.height;

	leftCtx.fillStyle = RULER_BG;
	leftCtx.fillRect(0, 0, w, h);

	leftCtx.strokeStyle = RULER_LINE;
	leftCtx.lineWidth = 1;
	leftCtx.beginPath();
	leftCtx.moveTo(w - 0.5, 0);
	leftCtx.lineTo(w - 0.5, h);
	leftCtx.stroke();

	const worldTop = screenToWorldY(0, h);
	const worldBottom = screenToWorldY(h, h);

	const step = options.step;
	const start = Math.floor(worldBottom / step) * step;
	const end = Math.ceil(worldTop / step) * step;

	leftCtx.font = "9px monospace";
	leftCtx.textBaseline = "middle";
	leftCtx.textAlign = "left";

	for (let v = start; v <= end; v += step) {
		const y = worldToScreenY(v, h);
		if (y < -50 || y > h + 50) continue;

		const isMajor = Math.abs(v % (step * options.majorEvery)) < step * 0.01;

		leftCtx.strokeStyle = isMajor ? RULER_MAJOR_FG : RULER_FG;
		leftCtx.beginPath();
		leftCtx.moveTo(isMajor ? 4 : w - 6, y);
		leftCtx.lineTo(w, y);
		leftCtx.stroke();

		if (isMajor) {
			leftCtx.fillStyle = RULER_MAJOR_FG;
			leftCtx.fillText(formatNum(v), 2, y);
		}
	}

	const camY = camera?.position.y ?? 0;
	const cursorY = worldToScreenY(camY, h);
	leftCtx.strokeStyle = RULER_CURSOR;
	leftCtx.lineWidth = 1;
	leftCtx.beginPath();
	leftCtx.moveTo(0, cursorY);
	leftCtx.lineTo(w, cursorY);
	leftCtx.stroke();
}

function formatNum(v: number): string {
	if (Math.abs(v) < 0.001) return "0";
	const s = v.toFixed(1);
	return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function installRuler(opts: Partial<RulerOptions> = {}): void {
	if (installed) return;
	installed = true;
	options = { ...DEFAULT_RULER, ...opts };

	ensureCanvases();
	resize();

	window.addEventListener("resize", () => {
		resize();
	});

	console.log("[Weaver:ruler] installed");
}

export function drawRuler(): void {
	if (!topCanvas || !leftCanvas) return;
	if (!camera) return;

	// ✅ هر فریم scale رو آپدیت کن (بر اساس ارتفاع canvas)
	updateScale(leftCanvas.height);

	drawTop();
	drawLeft();
}

export function setRulerOptions(opts: Partial<RulerOptions>): void {
	options = { ...options, ...opts };
}

export function getRulerOptions(): RulerOptions {
	return { ...options };
}
