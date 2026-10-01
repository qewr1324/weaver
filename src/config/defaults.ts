import type { WeaverConfig } from "./types";

export function createDefaultGlobalConfig(): WeaverConfig {
	return {
		version: "1.0.0",
		toolbar: {
			enabled: {
				addObjects: true,
				transformModes: true,
				referenceModes: true,
				shaderModes: true,
				snap: true,
			},
			addObjects: [
				{ id: "box", label: "Box", icon: "▣", geometry: "box" },
				{ id: "sphere", label: "Sphere", icon: "●", geometry: "sphere" },
				{ id: "plane", label: "Plane", icon: "▭", geometry: "plane" },
				{ id: "cylinder", label: "Cylinder", icon: "▮", geometry: "cylinder" },
				{ id: "torus", label: "Torus", icon: "◯", geometry: "torus" },
			],
			transformModes: [
				{ id: "move", label: "Move", icon: "✥", key: "KeyG" },
				{ id: "rotate", label: "Rotate", icon: "↻", key: "KeyR" },
				{ id: "scale", label: "Scale", icon: "⤢", key: "KeyT" },
			],
			referenceModes: [
				{ id: "world", label: "World", icon: "🌐" },
				{ id: "object", label: "Object", icon: "📦" },
			],
			shaderModes: [
				{ id: "solid", label: "Solid", icon: "■" },
				{ id: "wireframe", label: "Wireframe", icon: "▦" },
				{ id: "both", label: "Both", icon: "◨" },
			],
			transformMode: "move",
			referenceMode: "world",
			shaderMode: "solid",
			snap: {
				grid: { default: false, size: 0.5, sizes: [0.1, 0.25, 0.5, 1.0] },
				object: { default: false, threshold: 0.3 },
			},
			snapGrid: false,
			snapGridSize: 0.5,
			snapObject: false,
		},
		camera: {
			fov: 0.9,
			minZ: 0.05,
			maxZ: 5000,
			baseSpeed: 0.35,
			baseLookSpeed: 1.8,
			sprintMult: 4,
			slowMult: 0.25,
		},
		highlights: {
			hover: { r: 0.4, g: 0.75, b: 1.0 },
			selected: { r: 1.0, g: 0.6, b: 0.15 },
		},
		gizmo: {
			scaleRatio: 1.0,
			alwaysOnTop: true,
			snapDistance: 0.1,
		},
		scene: {
			clearColor: { r: 0.15, g: 0.18, b: 0.24, a: 1 },
			grid: {
				enabled: true,
				size: 100,
				majorUnit: 10,
				minorVisibility: 0.35,
				mainColor: { r: 0.3, g: 0.33, b: 0.4 },
				lineColor: { r: 0.5, g: 0.52, b: 0.6 },
			},
			lights: {
				sun: { intensity: 1.2, direction: { x: -0.5, y: -1, z: -0.3 } },
				ambient: { intensity: 0.8 },
			},
		},
		defaults: {
			meshMaterial: { color: "#6B46C1", metallic: 0.2, roughness: 0.6 },
			nodeName: "Node",
			sceneName: "Untitled Scene",
		},
	};
}
