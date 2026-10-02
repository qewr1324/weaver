// src/webview/viewport/scripts/scene/rebuild.ts
// ✨ Rebuild — ✅ fix: incremental (حتی با added/removed زیاد)
import { nodeIdToMesh, nodeIdToRoot, rootToNodeId, selectedIds, scene } from "../state";
import { detachGizmo } from "../gizmo";
import { applySelection } from "../picking";
import { clearHighlights } from "../highlighting";
import { buildNode } from "./build-node";

// ✅ snapshot از ساختار قبلی برای diff
let lastSnapshot: Map<string, string> = new Map();
let initialized = false;

/**
 * hash ساده از node data برای مقایسه.
 */
function hashNode(node: any): string {
	return JSON.stringify({
		id: node.id,
		name: node.name,
		enabled: node.enabled,
		transform: node.transform,
		components: node.components,
		children: (node.children || []).map((c: any) => c.id),
	});
}

/**
 * ساخت snapshot از کل درخت.
 */
function collectSnapshot(node: any, out: Map<string, string>): void {
	out.set(node.id, hashNode(node));
	for (const child of node.children ?? []) {
		collectSnapshot(child, out);
	}
}

/**
 * diff بین دو snapshot.
 */
function diffSnapshots(oldSnap: Map<string, string>, newSnap: Map<string, string>): { added: string[]; removed: string[]; changed: string[] } {
	const added: string[] = [];
	const removed: string[] = [];
	const changed: string[] = [];

	for (const [id, hash] of newSnap) {
		if (!oldSnap.has(id)) {
			added.push(id);
		} else if (oldSnap.get(id) !== hash) {
			changed.push(id);
		}
	}

	for (const id of oldSnap.keys()) {
		if (!newSnap.has(id)) {
			removed.push(id);
		}
	}

	return { added, removed, changed };
}

/**
 * پیدا کردن node data با id مشخص.
 */
function findNode(root: any, id: string): any {
	if (root.id === id) return root;
	for (const child of root.children ?? []) {
		const found = findNode(child, id);
		if (found) return found;
	}
	return null;
}

/**
 * پیدا کردن parent id یک node.
 */
function findParentId(root: any, targetId: string): string | null {
	for (const child of root.children ?? []) {
		if (child.id === targetId) return root.id;
		const found = findParentId(child, targetId);
		if (found) return found;
	}
	return null;
}

/**
 * dispose یک node و بچه‌هاش (recursive).
 */
function disposeNodeRecursive(id: string): void {
	// اول بچه‌ها
	const mesh = nodeIdToMesh.get(id);
	const root = nodeIdToRoot.get(id);

	if (mesh) {
		try {
			mesh.dispose();
		} catch {
			/* ignore */
		}
		nodeIdToMesh.delete(id);
	}
	if (root) {
		try {
			root.dispose();
		} catch {
			/* ignore */
		}
		nodeIdToRoot.delete(id);
		rootToNodeId.delete(root);
	}
}

/**
 * ✅ rebuild هوشمند: همیشه incremental (مگر بار اول).
 */
export function rebuildScene(data: any): void {
	const newSnap = new Map<string, string>();
	collectSnapshot(data.root, newSnap);

	// ✅ بار اول → full rebuild + ذخیره snapshot
	if (!initialized) {
		console.log("[Weaver:rebuild] first time → full rebuild");
		fullRebuild(data);
		lastSnapshot = newSnap;
		initialized = true;
		return;
	}

	const { added, removed, changed } = diffSnapshots(lastSnapshot, newSnap);

	// اگه هیچ تغییری نیست، هیچ کاری نکن
	if (added.length === 0 && removed.length === 0 && changed.length === 0) {
		return;
	}

	console.log(`[Weaver:rebuild] diff → +${added.length} -${removed.length} ~${changed.length}`);

	detachGizmo();

	// 1️⃣ حذف node های حذف‌شده
	for (const id of removed) {
		disposeNodeRecursive(id);
	}

	// 2️⃣ حذف و بازسازی node های تغییر‌کرده
	for (const id of changed) {
		disposeNodeRecursive(id);
		const nodeData = findNode(data.root, id);
		if (nodeData) {
			const parentId = findParentId(data.root, id);
			const parentRoot = parentId ? nodeIdToRoot.get(parentId) : null;
			buildNode(nodeData, parentRoot);
		}
	}

	// 3️⃣ اضافه کردن node های جدید
	for (const id of added) {
		const nodeData = findNode(data.root, id);
		if (!nodeData) continue;
		const parentId = findParentId(data.root, id);
		const parentRoot = parentId ? nodeIdToRoot.get(parentId) : null;
		buildNode(nodeData, parentRoot);
	}

	applySelection(selectedIds);

	lastSnapshot = newSnap;
}

/**
 * fallback: rebuild کامل (فقط بار اول).
 */
function fullRebuild(data: any): void {
	detachGizmo();
	clearHighlights();

	for (const [, obj] of nodeIdToMesh) {
		try {
			obj.dispose();
		} catch {
			/* ignore */
		}
	}
	for (const [, obj] of nodeIdToRoot) {
		try {
			obj.dispose();
		} catch {
			/* ignore */
		}
	}

	nodeIdToMesh.clear();
	nodeIdToRoot.clear();
	rootToNodeId.clear();

	for (const child of data.root.children ?? []) {
		buildNode(child, null);
	}

	applySelection(selectedIds);
}

/**
 * ✅ ریست snapshot (مثلاً موقع load scene جدید).
 */
export function resetRebuildSnapshot(): void {
	lastSnapshot = new Map();
	initialized = false;
}
