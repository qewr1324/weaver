// src/scene/shader/presets.ts
import { DEFAULT_SHADER } from "./defaults";
import type { ShaderDefinition, ShaderChannel, ShaderChannelKey } from "./types";

export interface ShaderPreset {
	id: string;
	label: string;
	description: string;
	icon: string;
	/** یه تابع که shader فعلی رو با preset پر می‌کنه */
	apply: (base: ShaderDefinition) => ShaderDefinition;
}

const off = (): ShaderChannel => ({ enabled: false, source: "off" });

function cloneBase(base: ShaderDefinition): ShaderDefinition {
	return {
		...base,
		render: { ...base.render },
		channels: JSON.parse(JSON.stringify(base.channels)),
		output: { ...base.output, targets: [...base.output.targets] },
	};
}

export const SHADER_PRESETS: ShaderPreset[] = [
	{
		id: "empty",
		label: "Empty",
		description: "All channels off",
		icon: "○",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "unlit";
			return s;
		},
	},
	{
		id: "unlit-color",
		label: "Unlit Color",
		description: "Flat color, no lighting",
		icon: "■",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "unlit";
			s.channels.baseColor = {
				enabled: true,
				source: "color",
				color: [0.78, 0.55, 0.95, 1],
			};
			return s;
		},
	},
	{
		id: "standard-pbr",
		label: "Standard PBR",
		description: "Metallic-roughness PBR workflow",
		icon: "◆",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "pbr";
			s.channels.baseColor = {
				enabled: true,
				source: "color",
				color: [0.5, 0.5, 0.5, 1],
			};
			s.channels.roughness = {
				enabled: true,
				source: "number",
				number: 0.5,
			};
			s.channels.metallic = {
				enabled: true,
				source: "number",
				number: 0.0,
			};
			return s;
		},
	},
	{
		id: "pbr-textured",
		label: "PBR Textured",
		description: "Full PBR with texture inputs",
		icon: "▩",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "pbr";
			s.channels.baseColor = {
				enabled: true,
				source: "texture",
				texture: "albedo.png",
			};
			s.channels.roughness = {
				enabled: true,
				source: "texture",
				texture: "roughness.png",
			};
			s.channels.metallic = {
				enabled: true,
				source: "texture",
				texture: "metallic.png",
			};
			s.channels.normal = {
				enabled: true,
				source: "texture",
				texture: "normal.png",
			};
			s.channels.ao = {
				enabled: true,
				source: "texture",
				texture: "ao.png",
			};
			return s;
		},
	},
	{
		id: "toon",
		label: "Toon",
		description: "Cel-shaded look",
		icon: "●",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "lit";
			s.channels.baseColor = {
				enabled: true,
				source: "color",
				color: [1, 0.7, 0.3, 1],
			};
			s.channels.roughness = {
				enabled: true,
				source: "number",
				number: 0.9,
			};
			s.channels.specular = {
				enabled: true,
				source: "number",
				number: 0.0,
			};
			return s;
		},
	},
	{
		id: "emissive",
		label: "Emissive",
		description: "Self-illuminating surface",
		icon: "☀",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "unlit";
			s.channels.baseColor = {
				enabled: true,
				source: "color",
				color: [0.1, 0.1, 0.1, 1],
			};
			s.channels.emissive = {
				enabled: true,
				source: "color",
				color: [0.3, 0.8, 1.0, 1],
			};
			return s;
		},
	},
	{
		id: "glass",
		label: "Glass",
		description: "Transparent surface",
		icon: "◇",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "pbr";
			s.render.alphaMode = "blend";
			s.render.doubleSided = true;
			s.channels.baseColor = {
				enabled: true,
				source: "color",
				color: [0.8, 0.9, 1.0, 0.4],
			};
			s.channels.roughness = {
				enabled: true,
				source: "number",
				number: 0.05,
			};
			s.channels.metallic = {
				enabled: true,
				source: "number",
				number: 0.0,
			};
			s.channels.opacity = {
				enabled: true,
				source: "number",
				number: 0.4,
			};
			return s;
		},
	},
	{
		id: "water",
		label: "Water",
		description: "Animated water-like surface",
		icon: "≈",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "pbr";
			s.render.alphaMode = "blend";
			s.channels.baseColor = {
				enabled: true,
				source: "color",
				color: [0.1, 0.4, 0.6, 0.85],
			};
			s.channels.roughness = {
				enabled: true,
				source: "number",
				number: 0.15,
			};
			s.channels.metallic = {
				enabled: true,
				source: "number",
				number: 0.3,
			};
			s.channels.normal = {
				enabled: true,
				source: "texture",
				texture: "water_normal.png",
			};
			s.channels.opacity = {
				enabled: true,
				source: "number",
				number: 0.85,
			};
			return s;
		},
	},
	{
		id: "unlit-textured",
		label: "Unlit Textured",
		description: "Texture × color, no lighting",
		icon: "▣",
		apply: (base) => {
			const s = cloneBase(base);
			for (const key of Object.keys(s.channels) as ShaderChannelKey[]) {
				s.channels[key] = off();
			}
			s.render.lighting = "unlit";
			s.channels.baseColor = {
				enabled: true,
				source: "color-texture",
				color: [1, 1, 1, 1],
				texture: "albedo.png",
				intensity: 1,
			};
			return s;
		},
	},
];

export function applyPreset(current: ShaderDefinition, presetId: string): ShaderDefinition {
	const preset = SHADER_PRESETS.find((p) => p.id === presetId);
	if (!preset) return current;
	const next = preset.apply(current);
	// اسم و توضیحات و output رو نگه دار
	next.name = current.name;
	next.description = current.description;
	next.output = { ...current.output, targets: [...current.output.targets] };
	return next;
}

/** لیست preset ها به صورت آرایه‌ای برای UI */
export function getPresetList(): Array<{ id: string; label: string; description: string; icon: string }> {
	return SHADER_PRESETS.map((p) => ({
		id: p.id,
		label: p.label,
		description: p.description,
		icon: p.icon,
	}));
}
