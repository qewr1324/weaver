// src/webview/viewport/scripts/highlighting/index.ts
// ✨ Highlight — ✅ fix: با outline جای HighlightLayer
import { hoveredMesh, selectedIds, meshToNodeId, nodeIdToMesh } from "../state";

let currentHoveredMesh: any = null;
const currentSelectedMeshes = new Set<any>();

/**
 * یک mesh رو outline کن.
 */
function applyOutline(mesh: any, color: { r: number; g: number; b: number }, width = 0.02): void {
	if (!mesh || !mesh.getClassName) return;
	if (!mesh.getClassName().includes("Mesh")) return;
	mesh.renderOutline = true;
	mesh.outlineColor = new (window as any).BABYLON.Color3(color.r, color.g, color.b);
	mesh.outlineWidth = width;
}

/**
 * outline یه mesh رو پاک کن.
 */
function clearOutline(mesh: any): void {
	if (!mesh) return;
	mesh.renderOutline = false;
}

/**
 * ✅ refresh — حالا با outline، بدون render pass جدید.
 */
export function refreshHighlights(): void {
	// 1️⃣ hover
	const newHovered = hoveredMesh && meshToNodeId.has(hoveredMesh) ? hoveredMesh : null;
	if (newHovered !== currentHoveredMesh) {
		if (currentHoveredMesh) clearOutline(currentHoveredMesh);
		currentHoveredMesh = newHovered;
		if (currentHoveredMesh) {
			// hover = آبی روشن
			applyOutline(currentHoveredMesh, { r: 0.4, g: 0.75, b: 1.0 }, 0.015);
		}
	}

	// 2️⃣ selection
	const newSelected = new Set<any>();
	for (const id of selectedIds) {
		const mesh = nodeIdToMesh.get(id);
		if (mesh) newSelected.add(mesh);
	}

	// حذف mesh هایی که دیگه انتخاب نیستن
	for (const m of currentSelectedMeshes) {
		if (!newSelected.has(m)) {
			clearOutline(m);
		}
	}

	// اضافه کردن mesh های جدید
	for (const m of newSelected) {
		if (!currentSelectedMeshes.has(m)) {
			applyOutline(m, { r: 1.0, g: 0.6, b: 0.15 }, 0.025);
		}
	}

	// آپدیت set
	currentSelectedMeshes.clear();
	for (const m of newSelected) currentSelectedMeshes.add(m);
}

/**
 * پاک‌سازی کامل.
 */
export function clearHighlights(): void {
	if (currentHoveredMesh) {
		clearOutline(currentHoveredMesh);
		currentHoveredMesh = null;
	}
	for (const m of currentSelectedMeshes) {
		clearOutline(m);
	}
	currentSelectedMeshes.clear();
}
