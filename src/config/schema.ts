import { z } from "zod";

const Vec2 = z.object({ x: z.number(), y: z.number() });
const Vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
const Color3 = z.object({ r: z.number(), g: z.number(), b: z.number() });
const Color4 = z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() });

export const ToolbarItemSchema = z.object({
	id: z.string(),
	label: z.string(),
	icon: z.string(),
	geometry: z.string().optional(),
	key: z.string().optional(),
});

export const WeaverConfigSchema = z.object({
	version: z.string(),
	toolbar: z.object({
		enabled: z.object({
			addObjects: z.boolean(),
			transformModes: z.boolean(),
			referenceModes: z.boolean(),
			shaderModes: z.boolean(),
			snap: z.boolean(),
		}),
		addObjects: z.array(ToolbarItemSchema),
		transformModes: z.array(ToolbarItemSchema),
		referenceModes: z.array(ToolbarItemSchema),
		shaderModes: z.array(ToolbarItemSchema),
		transformMode: z.enum(["move", "rotate", "scale"]).optional(),
		referenceMode: z.enum(["world", "object"]).optional(),
		shaderMode: z.enum(["solid", "wireframe", "both"]).optional(),
		snap: z.object({
			grid: z.object({
				default: z.boolean(),
				size: z.number(),
				sizes: z.array(z.number()),
			}),
			object: z.object({
				default: z.boolean(),
				threshold: z.number(),
			}),
		}),
		snapGrid: z.boolean().optional(),
		snapGridSize: z.number().optional(),
		snapObject: z.boolean().optional(),
	}),
	camera: z.object({
		fov: z.number(),
		minZ: z.number(),
		maxZ: z.number(),
		baseSpeed: z.number(),
		baseLookSpeed: z.number(),
		sprintMult: z.number(),
		slowMult: z.number(),
	}),
	highlights: z.object({
		hover: Color3,
		selected: Color3,
	}),
	gizmo: z.object({
		scaleRatio: z.number(),
		alwaysOnTop: z.boolean(),
		snapDistance: z.number(),
	}),
	scene: z.object({
		clearColor: Color4,
		grid: z.object({
			enabled: z.boolean(),
			size: z.number(),
			majorUnit: z.number(),
			minorVisibility: z.number(),
			mainColor: Color3,
			lineColor: Color3,
		}),
		lights: z.object({
			sun: z.object({
				intensity: z.number(),
				direction: Vec3,
			}),
			ambient: z.object({ intensity: z.number() }),
		}),
	}),
	defaults: z.object({
		meshMaterial: z.object({
			color: z.string(),
			metallic: z.number(),
			roughness: z.number(),
		}),
		nodeName: z.string(),
		sceneName: z.string(),
	}),
});

export type WeaverConfigValidated = z.infer<typeof WeaverConfigSchema>;

export function validateConfig(raw: unknown): { ok: true; data: WeaverConfigValidated } | { ok: false; errors: string[] } {
	const result = WeaverConfigSchema.safeParse(raw);
	if (result.success) return { ok: true, data: result.data };
	return {
		ok: false,
		errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
	};
}
