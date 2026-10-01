import { log } from "../../core/logger";
import { migrateSceneData } from "../migrations";
import { Scene } from "../scene";
import type { SceneData } from "../scene";
import { validateSceneData } from "../schema";

export const Serializer = {
	serialize(scene: Scene): string {
		return JSON.stringify(scene.toJSON(), null, 2);
	},

	deserialize(json: string): Scene {
		const raw = JSON.parse(json);
		const migrated = migrateSceneData(raw);
		const validated = validateSceneData(migrated);

		if (!validated.ok) {
			log.error("Scene validation failed:", validated.errors);
			throw new Error(`Invalid scene file: ${validated.errors[0]}`);
		}

		return Scene.fromJSON(validated.data as SceneData);
	},

	/** بدون throw — برای preview */
	tryDeserialize(json: string): { ok: true; scene: Scene } | { ok: false; error: string } {
		try {
			return { ok: true, scene: Serializer.deserialize(json) };
		} catch (err) {
			return { ok: false, error: String(err) };
		}
	},
};
