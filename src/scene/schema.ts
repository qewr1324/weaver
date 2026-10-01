import { z } from "zod";

const Vector3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
const Quaternion = z.object({ x: z.number(), y: z.number(), z: z.number(), w: z.number() });

const TransformSchema = z.object({
	position: Vector3,
	rotation: Quaternion,
	scale: Vector3,
});

const MeshComponentSchema = z.object({
	id: z.string(),
	type: z.literal("mesh"),
	geometry: z.enum(["box", "sphere", "plane", "cylinder", "torus"]),
	material: z.object({
		color: z.string(),
		metallic: z.number().optional(),
		roughness: z.number().optional(),
	}),
});

const CameraComponentSchema = z.object({
	id: z.string(),
	type: z.literal("camera"),
	fov: z.number(),
	near: z.number(),
	far: z.number(),
	isMain: z.boolean(),
});

const LightComponentSchema = z.object({
	id: z.string(),
	type: z.literal("light"),
	lightType: z.enum(["directional", "point", "spot", "hemispheric"]),
	intensity: z.number(),
	color: z.string(),
});

const ScriptComponentSchema = z.object({
	id: z.string(),
	type: z.literal("script"),
	source: z.string(),
});

const ComponentSchema = z.discriminatedUnion("type", [MeshComponentSchema, CameraComponentSchema, LightComponentSchema, ScriptComponentSchema]);

// recursive NodeData
export type NodeDataRaw = {
	id: string;
	name: string;
	enabled: boolean;
	transform: z.infer<typeof TransformSchema>;
	components: z.infer<typeof ComponentSchema>[];
	children: NodeDataRaw[];
};

const NodeDataSchema: z.ZodType<NodeDataRaw> = z.lazy(() =>
	z.object({
		id: z.string(),
		name: z.string(),
		enabled: z.boolean(),
		transform: TransformSchema,
		components: z.array(ComponentSchema),
		children: z.array(NodeDataSchema),
	}),
);

export const SceneDataSchema = z.object({
	version: z.string(),
	name: z.string(),
	config: z.record(z.string(), z.unknown()).optional(),
	root: NodeDataSchema,
});

export type ValidatedSceneData = z.infer<typeof SceneDataSchema>;

export function validateSceneData(raw: unknown): { ok: true; data: ValidatedSceneData } | { ok: false; errors: string[] } {
	const result = SceneDataSchema.safeParse(raw);
	if (result.success) return { ok: true, data: result.data };
	return {
		ok: false,
		errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
	};
}
