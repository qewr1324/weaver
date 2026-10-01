import { nextComponentId } from "../components";
import { Node } from "../node";
import { Scene } from "../scene";
import { vec3 } from "../transform";

export const SceneFactory = {
	createDefaultScene(name = "New Scene"): Scene {
		const scene = new Scene(name);

		const cam = new Node("Main Camera");
		cam.addComponent({
			id: nextComponentId(),
			type: "camera",
			fov: 0.8,
			near: 0.1,
			far: 1000,
			isMain: true,
		});
		cam.transform.position = vec3(0, 2, -8);
		scene.addNode(cam);

		const light = new Node("Sun");
		light.addComponent({
			id: nextComponentId(),
			type: "light",
			lightType: "directional",
			intensity: 1.2,
			color: "#fff5e0",
		});
		light.transform.position = vec3(4, 8, -4);
		scene.addNode(light);

		const cube = new Node("Cube");
		cube.addComponent({
			id: nextComponentId(),
			type: "mesh",
			geometry: "box",
			material: { color: "#6B46C1", metallic: 0.2, roughness: 0.6 },
		});
		scene.addNode(cube);

		const sphere = new Node("Sphere");
		sphere.addComponent({
			id: nextComponentId(),
			type: "mesh",
			geometry: "sphere",
			material: { color: "#3B82F6", metallic: 0.1, roughness: 0.4 },
		});
		sphere.transform.position = vec3(3, 1, 0);
		scene.addNode(sphere);

		return scene;
	},
};
