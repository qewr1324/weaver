// src/webview/viewport/scripts/debug-leak.ts
// ⚠️ موقت — بعد از debug پاکش کن
// ✅ fix: drawCalls per-second محاسبه میشه (نه cumulative)
import { engine, scene } from "./state";

let last = {
	meshes: 0,
	materials: 0,
	textures: 0,
	geometries: 0,
	drawCalls: 0,
	lights: 0,
	transformNodes: 0,
	activeMeshes: 0,
	particles: 0,
};

let lastTime = 0;

export function installLeakDetector(): void {
	console.log("[LEAK] detector installed — watching every 2s (per-second rates)");

	setInterval(() => {
		if (!engine || !scene) return;

		const now = performance.now();
		const dt = lastTime > 0 ? (now - lastTime) / 1000 : 0;
		lastTime = now;

		const cur = {
			meshes: scene.meshes.length,
			materials: scene.materials.length,
			textures: scene.textures.length,
			geometries: (scene as any).geometries?.length ?? 0,
			drawCalls: (engine as any)._drawCalls?.current ?? 0,
			lights: scene.lights.length,
			transformNodes: scene.transformNodes.length,
			activeMeshes: scene.getActiveMeshes?.().length ?? 0,
			particles: scene.particleSystems?.length ?? 0,
		};

		const diff: Record<string, string> = {};
		let hasChange = false;

		for (const k of Object.keys(cur) as Array<keyof typeof cur>) {
			const d = cur[k] - last[k];
			if (d !== 0) {
				// ✅ برای drawCalls، per-second rate
				if (k === "drawCalls" && dt > 0) {
					diff[k] = `${(d / dt).toFixed(0)}/s`;
				} else {
					diff[k] = `${d > 0 ? "+" : ""}${d}`;
				}
				hasChange = true;
			}
		}

		if (hasChange) {
			console.warn(
				`[LEAK] ${Object.entries(diff)
					.map(([k, v]) => `${k}: ${v}`)
					.join(" | ")}`,
				"\n  full:",
				cur,
			);
		}

		last = cur;
	}, 2000);
}
