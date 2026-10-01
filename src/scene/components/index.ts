export type ComponentType = "mesh" | "camera" | "light" | "script";

export interface ComponentBase {
	readonly type: ComponentType;
	readonly id: string;
}

export interface MeshComponent extends ComponentBase {
	type: "mesh";
	geometry: "box" | "sphere" | "plane" | "cylinder" | "torus";
	material: { color: string; metallic?: number; roughness?: number };
}

export interface CameraComponent extends ComponentBase {
	type: "camera";
	fov: number;
	near: number;
	far: number;
	isMain: boolean;
}

export interface LightComponent extends ComponentBase {
	type: "light";
	lightType: "directional" | "point" | "spot" | "hemispheric";
	intensity: number;
	color: string;
}

export interface ScriptComponent extends ComponentBase {
	type: "script";
	source: string;
}

export type Component = MeshComponent | CameraComponent | LightComponent | ScriptComponent;

let componentCounter = 0;

export const nextComponentId = (): string => `cmp_${++componentCounter}_${Date.now().toString(36)}`;
