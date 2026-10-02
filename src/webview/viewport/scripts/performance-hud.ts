// src/webview/viewport/scripts/performance-hud.ts
// ✨ Perf HUD — ✅ fix: drawCalls per-frame (نه cumulative)
import { engine, scene } from "./state";

let hudEl: HTMLDivElement | null = null;
let visible = false;
let installed = false;

interface CellRefs {
	fps: HTMLElement;
	meshes: HTMLElement;
	active: HTMLElement;
	drawCalls: HTMLElement;
	indices: HTMLElement;
	materials: HTMLElement;
	textures: HTMLElement;
	lights: HTMLElement;
}
let cells: CellRefs | null = null;

function ensureHud(): HTMLDivElement {
	if (hudEl) return hudEl;

	hudEl = document.createElement("div");
	hudEl.id = "perf-hud";
	hudEl.style.display = "none";

	hudEl.innerHTML = `
		<div class="perf-row"><span>FPS</span><b data-cell="fps">—</b></div>
		<div class="perf-row"><span>Meshes</span><b data-cell="meshes">—</b></div>
		<div class="perf-row"><span>Active</span><b data-cell="active">—</b></div>
		<div class="perf-row"><span>Draw calls</span><b data-cell="drawCalls">—</b></div>
		<div class="perf-row"><span>Indices</span><b data-cell="indices">—</b></div>
		<div class="perf-row"><span>Materials</span><b data-cell="materials">—</b></div>
		<div class="perf-row"><span>Textures</span><b data-cell="textures">—</b></div>
		<div class="perf-row"><span>Lights</span><b data-cell="lights">—</b></div>
	`;

	document.getElementById("canvas-wrap")?.appendChild(hudEl);

	const q = (n: string) => hudEl!.querySelector(`[data-cell="${n}"]`) as HTMLElement;
	cells = {
		fps: q("fps"),
		meshes: q("meshes"),
		active: q("active"),
		drawCalls: q("drawCalls"),
		indices: q("indices"),
		materials: q("materials"),
		textures: q("textures"),
		lights: q("lights"),
	};

	return hudEl;
}

export function togglePerformanceHud(): void {
	visible = !visible;
	const el = ensureHud();
	el.style.display = visible ? "block" : "none";
}

let lastUpdate = 0;
const UPDATE_INTERVAL = 250;

// ✅ برای محاسبه‌ی draw calls per-frame
let lastDrawCalls = 0;
let lastDrawCallsTime = 0;

export function updatePerformanceHud(): void {
	if (!visible || !hudEl || !cells || !engine || !scene) return;

	const now = performance.now();
	if (now - lastUpdate < UPDATE_INTERVAL) return;
	lastUpdate = now;

	// ✅ draw calls per frame
	const engineAny = engine as any;
	const currentDrawCalls = engineAny._drawCalls?.current ?? 0;
	let drawCallsPerFrame = "—";

	if (lastDrawCallsTime > 0) {
		const dt = (now - lastDrawCallsTime) / 1000;
		const delta = currentDrawCalls - lastDrawCalls;
		if (dt > 0) {
			drawCallsPerFrame = (delta / dt).toFixed(0) + "/s";
		}
	}

	lastDrawCalls = currentDrawCalls;
	lastDrawCallsTime = now;

	cells.fps.textContent = engine.getFps().toFixed(0);
	cells.meshes.textContent = String(scene.meshes.length);
	cells.active.textContent = String(scene.getActiveMeshes?.().length ?? "—");
	cells.drawCalls.textContent = drawCallsPerFrame;
	cells.indices.textContent = String(scene.getActiveIndices?.() ?? "—");
	cells.materials.textContent = String(scene.materials.length);
	cells.textures.textContent = String(scene.textures.length);
	cells.lights.textContent = String(scene.lights.length);
}

export function installPerformanceHud(): void {
	if (installed) return;
	installed = true;
	ensureHud();
	window.addEventListener(
		"keydown",
		(e) => {
			if (e.code === "F3") {
				e.preventDefault();
				e.stopPropagation();
				togglePerformanceHud();
			}
		},
		{ capture: true },
	);
}
