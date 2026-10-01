import { Scene } from "../scene";
import type { SceneData } from "../scene";

export const Serializer = {
	serialize(scene: Scene): string {
		return JSON.stringify(scene.toJSON(), null, 2);
	},
	deserialize(json: string): Scene {
		return Scene.fromJSON(JSON.parse(json) as SceneData);
	},
};
