// src/webview/viewport/scripts/performance-hud.ts
// ✨ جدید — نمایش آمار performance (toggle با F3)
import { engine, scene } from "./state";

let hudEl: HTMLDivElement | null = null;
let visible = false;

function ensureHud(): HTMLDivElement {
	if (hudEl) return hudEl;
	hudEl = document.createElement("div");
	hudEl.id = "perf-hud";
	hudEl.style.display = "none";
	document.getElementById("canvas-wrap")?.appendChild(hudEl);
	return hudEl;
}

export function togglePerformanceHud(): void {
	visible = !visible;
	const el = ensureHud();
	el.style.display = visible ? "block" : "none";
}

export function updatePerformanceHud(): void {
	if (!visible || !hudEl || !engine || !scene) return;

	const fps = engine.getFps().toFixed(0);
	const meshes = scene.meshes.length;
	const materials = scene.materials.length;
	const textures = scene.textures.length;
	const lights = scene.lights.length;
	const drawCalls = engine._drawCalls?.current ?? "—";
	const activeMeshes = scene.getActiveMeshes?.().length ?? "—";
	const activeIndices = scene.getActiveIndices?.() ?? "—";

	hudEl.innerHTML = `
		<div class="perf-row"><span>FPS</span><b>${fps}</b></div>
		<div class="perf-row"><span>Meshes</span><b>${meshes}</b></div>
		<div class="perf-row"><span>Active</span><b>${activeMeshes}</b></div>
		<div class="perf-row"><span>Draw calls</span><b>${drawCalls}</b></div>
		<div class="perf-row"><span>Indices</span><b>${activeIndices}</b></div>
		<div class="perf-row"><span>Materials</span><b>${materials}</b></div>
		<div class="perf-row"><span>Textures</span><b>${textures}</b></div>
		<div class="perf-row"><span>Lights</span><b>${lights}</b></div>
	`;
}

export function installPerformanceHud(): void {
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
