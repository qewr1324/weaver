// src/webview/viewport/scripts/highlighting/index.ts
import { highlightLayer, hoveredMesh, selectedIds, meshToNodeId, nodeIdToMesh, HOVER_COLOR, SELECT_COLOR } from "../state";

export function refreshHighlights(): void {
	if (!highlightLayer) return;
	highlightLayer.removeAllMeshes();

	if (hoveredMesh && meshToNodeId.has(hoveredMesh)) {
		highlightLayer.addMesh(hoveredMesh, HOVER_COLOR);
	}

	for (const id of selectedIds) {
		const mesh = nodeIdToMesh.get(id);
		if (mesh && mesh.getClassName && mesh.getClassName().includes("Mesh")) {
			highlightLayer.removeMesh(mesh);
			highlightLayer.addMesh(mesh, SELECT_COLOR);
		}
	}
}
