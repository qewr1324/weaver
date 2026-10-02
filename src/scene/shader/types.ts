// src/scene/shader/types.ts

export type ChannelSource = "off" | "color" | "texture" | "color-texture" | "number" | "number-texture";

export interface ShaderChannel {
	enabled: boolean;
	source: ChannelSource;
	color?: [number, number, number, number];
	number?: number;
	texture?: string;
	intensity?: number;
}

export interface ShaderRenderSettings {
	lighting: "unlit" | "lit" | "pbr";
	alphaMode: "opaque" | "blend" | "cutout";
	cull: "back" | "front" | "none";
	doubleSided: boolean;
}

export interface ShaderDefinition {
	version: string;
	name: string;
	description: string;
	render: ShaderRenderSettings;
	channels: {
		baseColor: ShaderChannel;
		normal: ShaderChannel;
		roughness: ShaderChannel;
		metallic: ShaderChannel;
		ao: ShaderChannel;
		specular: ShaderChannel;
		emissive: ShaderChannel;
		height: ShaderChannel;
		opacity: ShaderChannel;
	};
	output: {
		targets: Array<"glsl" | "babylon" | "libgdx" | "monogame">;
		entryName: string;
	};
}

export type ShaderChannelKey = keyof ShaderDefinition["channels"];
