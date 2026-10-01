export interface WeaverConfig {
	version: string;
	toolbar: {
		enabled: {
			addObjects: boolean;
			transformModes: boolean;
			referenceModes: boolean;
			shaderModes: boolean;
			snap: boolean;
		};
		addObjects: Array<{ id: string; label: string; icon: string; geometry: string }>;
		transformModes: Array<{ id: string; label: string; icon: string; key?: string }>;
		referenceModes: Array<{ id: string; label: string; icon: string }>;
		shaderModes: Array<{ id: string; label: string; icon: string }>;
		transformMode?: "move" | "rotate" | "scale";
		referenceMode?: "world" | "object";
		shaderMode?: "solid" | "wireframe" | "both";
		snap: {
			grid: { default: boolean; size: number; sizes: number[] };
			object: { default: boolean; threshold: number };
		};
		snapGrid?: boolean;
		snapGridSize?: number;
		snapObject?: boolean;
	};
	camera: {
		fov: number;
		minZ: number;
		maxZ: number;
		baseSpeed: number;
		baseLookSpeed: number;
		sprintMult: number;
		slowMult: number;
	};
	highlights: {
		hover: { r: number; g: number; b: number };
		selected: { r: number; g: number; b: number };
	};
	gizmo: {
		scaleRatio: number;
		alwaysOnTop: boolean;
		snapDistance: number;
	};
	scene: {
		clearColor: { r: number; g: number; b: number; a: number };
		grid: {
			enabled: boolean;
			size: number;
			majorUnit: number;
			minorVisibility: number;
			mainColor: { r: number; g: number; b: number };
			lineColor: { r: number; g: number; b: number };
		};
		lights: {
			sun: { intensity: number; direction: { x: number; y: number; z: number } };
			ambient: { intensity: number };
		};
	};
	defaults: {
		meshMaterial: { color: string; metallic: number; roughness: number };
		nodeName: string;
		sceneName: string;
	};
}
