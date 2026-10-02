// src/scene/shader/defaults.ts
import type { ShaderDefinition, ShaderChannel, ShaderChannelKey } from "./types";

const offChannel = (): ShaderChannel => ({
	enabled: false,
	source: "off",
});

const defaultChannels = () => ({
	baseColor: {
		enabled: true,
		source: "color" as const,
		color: [0.5, 0.5, 0.5, 1] as [number, number, number, number],
		intensity: 1,
	},
	normal: offChannel(),
	roughness: {
		enabled: true,
		source: "number" as const,
		number: 0.5,
	},
	metallic: {
		enabled: true,
		source: "number" as const,
		number: 0,
	},
	ao: offChannel(),
	specular: offChannel(),
	emissive: offChannel(),
	height: offChannel(),
	opacity: offChannel(),
});

export const DEFAULT_SHADER: ShaderDefinition = {
	version: "1.0.0",
	name: "Untitled Shader",
	description: "",
	render: {
		lighting: "pbr",
		alphaMode: "opaque",
		cull: "back",
		doubleSided: false,
	},
	channels: defaultChannels(),
	output: {
		targets: ["babylon"],
		entryName: "main",
	},
};

export interface ChannelMeta {
	label: string;
	description: string;
	allowedSources: ShaderChannel["source"][];
	defaultSource: ShaderChannel["source"];
}

export const CHANNEL_META: Record<ShaderChannelKey, ChannelMeta> = {
	baseColor: {
		label: "Base Color",
		description: "Surface base color",
		allowedSources: ["off", "color", "texture", "color-texture"],
		defaultSource: "color",
	},
	normal: {
		label: "Normal Map",
		description: "Surface detail normal map",
		allowedSources: ["off", "texture"],
		defaultSource: "texture",
	},
	roughness: {
		label: "Roughness",
		description: "Surface roughness",
		allowedSources: ["off", "number", "texture", "number-texture"],
		defaultSource: "number",
	},
	metallic: {
		label: "Metallic",
		description: "Surface metallic factor",
		allowedSources: ["off", "number", "texture", "number-texture"],
		defaultSource: "number",
	},
	ao: {
		label: "Ambient Occlusion",
		description: "Occlusion map",
		allowedSources: ["off", "texture"],
		defaultSource: "texture",
	},
	specular: {
		label: "Specular",
		description: "Specular reflection",
		allowedSources: ["off", "number", "texture", "number-texture"],
		defaultSource: "number",
	},
	emissive: {
		label: "Emissive",
		description: "Emitted light",
		allowedSources: ["off", "color", "texture", "color-texture"],
		defaultSource: "color",
	},
	height: {
		label: "Height / Displacement",
		description: "Displacement height",
		allowedSources: ["off", "number", "texture", "number-texture"],
		defaultSource: "texture",
	},
	opacity: {
		label: "Opacity",
		description: "Surface transparency",
		allowedSources: ["off", "number", "texture", "number-texture"],
		defaultSource: "number",
	},
};

export const CHANNEL_ORDER: ShaderChannelKey[] = ["baseColor", "normal", "roughness", "metallic", "ao", "specular", "emissive", "height", "opacity"];
