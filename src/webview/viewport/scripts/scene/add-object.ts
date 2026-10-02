// src/webview/viewport/scripts/scene/add-object.ts
import { postToExtension } from "../messaging";
import { setStatus } from "../look-mode";

export function addObject(geometry: string): void {
	const name = geometry.charAt(0).toUpperCase() + geometry.slice(1);
	postToExtension({
		type: "add:node",
		payload: {
			name,
			components: [
				{
					type: "mesh",
					geometry,
					material: { color: "#6B46C1", metallic: 0.2, roughness: 0.6 },
				},
			],
			transform: {
				position: { x: 0, y: 0, z: 0 },
				rotation: { x: 0, y: 0, z: 0, w: 1 },
				scale: { x: 1, y: 1, z: 1 },
			},
		},
	});
	setStatus("● Added " + name, true);
}
