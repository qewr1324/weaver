// src/scene/shader/schema.ts
import { z } from "zod";

const ChannelSourceSchema = z.enum(["off", "color", "texture", "color-texture", "number", "number-texture"]);

const ShaderChannelSchema = z.object({
	enabled: z.boolean(),
	source: ChannelSourceSchema,
	color: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
	number: z.number().optional(),
	texture: z.string().optional(),
	intensity: z.number().optional(),
});

export const ShaderDefinitionSchema = z.object({
	version: z.string(),
	name: z.string(),
	description: z.string().default(""),
	render: z.object({
		lighting: z.enum(["unlit", "lit", "pbr"]),
		alphaMode: z.enum(["opaque", "blend", "cutout"]),
		cull: z.enum(["back", "front", "none"]),
		doubleSided: z.boolean(),
	}),
	channels: z.object({
		baseColor: ShaderChannelSchema,
		normal: ShaderChannelSchema,
		roughness: ShaderChannelSchema,
		metallic: ShaderChannelSchema,
		ao: ShaderChannelSchema,
		specular: ShaderChannelSchema,
		emissive: ShaderChannelSchema,
		height: ShaderChannelSchema,
		opacity: ShaderChannelSchema,
	}),
	output: z.object({
		targets: z.array(z.enum(["glsl", "babylon", "libgdx", "monogame"])),
		entryName: z.string(),
	}),
});

export type ValidatedShaderDefinition = z.infer<typeof ShaderDefinitionSchema>;

export function validateShader(raw: unknown) {
	return ShaderDefinitionSchema.safeParse(raw);
}
