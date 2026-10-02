// src/webview/viewport/scripts/grid.ts
// ✨ Grid قابل تنظیم — user می‌تونه size / step / major رو عوض کنه

import { scene } from "./state";

export interface GridOptions {
	size: number; // کل اندازه (از -size/2 تا +size/2)
	step: number; // فاصله بین خطوط فرعی
	majorEvery: number; // هر چند خط، یه خط پررنگ
}

export const DEFAULT_GRID: GridOptions = {
	size: 100,
	step: 1,
	majorEvery: 10,
};

let currentOptions: GridOptions = { ...DEFAULT_GRID };
let gridMeshes: {
	minor: any | null;
	major: any | null;
	axisX: any | null;
	axisZ: any | null;
} = {
	minor: null,
	major: null,
	axisX: null,
	axisZ: null,
};

/**
 * ✅ ساخت/بازسازی grid با آپشن‌های جدید.
 * mesh های قبلی رو dispose می‌کنه و از صفر می‌سازه.
 */
export function buildGrid(options: Partial<GridOptions> = {}): void {
	const BABYLON = (window as any).BABYLON;
	if (!BABYLON || !scene) return;

	const opts: GridOptions = { ...currentOptions, ...options };
	currentOptions = opts;

	// ✅ پاک‌سازی mesh های قبلی
	disposeGrid();

	const half = opts.size / 2;
	const step = Math.max(0.1, opts.step);
	const majorEvery = Math.max(1, Math.round(opts.majorEvery));

	// ─── خطوط فرعی ───
	const minorLines: any[] = [];
	for (let i = -half; i <= half + 0.0001; i += step) {
		// skip خطوط اصلی
		const isMajor = Math.abs(i % (step * majorEvery)) < step * 0.01;
		if (isMajor) continue;

		minorLines.push([new BABYLON.Vector3(-half, 0, i), new BABYLON.Vector3(half, 0, i)]);
		minorLines.push([new BABYLON.Vector3(i, 0, -half), new BABYLON.Vector3(i, 0, half)]);
	}

	if (minorLines.length > 0) {
		const minor = BABYLON.MeshBuilder.CreateLineSystem("__grid_minor", { lines: minorLines }, scene);
		minor.color = new BABYLON.Color3(0.25, 0.27, 0.32);
		minor.alpha = 0.5;
		minor.isPickable = false;
		minor.alwaysSelectAsActiveMesh = true;
		gridMeshes.minor = minor;
	}

	// ─── خطوط اصلی ───
	const majorLines: any[] = [];
	for (let i = -half; i <= half + 0.0001; i += step * majorEvery) {
		majorLines.push([new BABYLON.Vector3(-half, 0, i), new BABYLON.Vector3(half, 0, i)]);
		majorLines.push([new BABYLON.Vector3(i, 0, -half), new BABYLON.Vector3(i, 0, half)]);
	}

	if (majorLines.length > 0) {
		const major = BABYLON.MeshBuilder.CreateLineSystem("__grid_major", { lines: majorLines }, scene);
		major.color = new BABYLON.Color3(0.45, 0.48, 0.55);
		major.alpha = 0.85;
		major.isPickable = false;
		major.alwaysSelectAsActiveMesh = true;
		gridMeshes.major = major;
	}

	// ─── محور X (قرمز) ───
	const axisX = BABYLON.MeshBuilder.CreateLines(
		"__axis_x",
		{
			points: [new BABYLON.Vector3(-half, 0, 0), new BABYLON.Vector3(half, 0, 0)],
		},
		scene,
	);
	axisX.color = new BABYLON.Color3(0.85, 0.3, 0.3);
	axisX.alpha = 0.9;
	axisX.isPickable = false;
	axisX.alwaysSelectAsActiveMesh = true;
	gridMeshes.axisX = axisX;

	// ─── محور Z (آبی) ───
	const axisZ = BABYLON.MeshBuilder.CreateLines(
		"__axis_z",
		{
			points: [new BABYLON.Vector3(0, 0, -half), new BABYLON.Vector3(0, 0, half)],
		},
		scene,
	);
	axisZ.color = new BABYLON.Color3(0.3, 0.5, 0.85);
	axisZ.alpha = 0.9;
	axisZ.isPickable = false;
	axisZ.alwaysSelectAsActiveMesh = true;
	gridMeshes.axisZ = axisZ;

	console.log(`[Weaver:grid] built — size=${opts.size} step=${opts.step} major=${opts.majorEvery}`);
}

/**
 * پاک‌سازی mesh های grid.
 */
export function disposeGrid(): void {
	for (const key of ["minor", "major", "axisX", "axisZ"] as const) {
		const m = gridMeshes[key];
		if (m) {
			try {
				m.dispose();
			} catch {
				/* ignore */
			}
			gridMeshes[key] = null;
		}
	}
}

/**
 * نمایش/مخفی کردن grid.
 */
export function setGridVisible(visible: boolean): void {
	for (const key of ["minor", "major", "axisX", "axisZ"] as const) {
		const m = gridMeshes[key];
		if (m) m.isVisible = visible;
	}
}

export function getGridVisible(): boolean {
	const m = gridMeshes.major || gridMeshes.minor;
	return m ? m.isVisible : false;
}

/**
 * toggle نمایش.
 */
export function toggleGridVisible(): boolean {
	const next = !getGridVisible();
	setGridVisible(next);
	return next;
}

/**
 * گرفتن آپشن‌های فعلی.
 */
export function getGridOptions(): GridOptions {
	return { ...currentOptions };
}
