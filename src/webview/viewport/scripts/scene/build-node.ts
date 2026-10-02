// src/webview/viewport/scripts/scene/build-node.ts
import { scene, nodeIdToMesh, nodeIdToRoot, rootToNodeId, meshToNodeId } from "../state";

export function buildNode(nodeData: any, parentRoot: any): void {
	const BABYLON = (window as any).BABYLON;

	const mc = (nodeData.components || []).find((c: any) => c.type === "mesh");
	const lc = (nodeData.components || []).find((c: any) => c.type === "light");
	const cc = (nodeData.components || []).find((c: any) => c.type === "camera");

	const root = new BABYLON.TransformNode(nodeData.id + "__root", scene);

	let pickable: any = null;
	if (mc) {
		switch (mc.geometry) {
			case "box":
				pickable = BABYLON.MeshBuilder.CreateBox(nodeData.id, { size: 1 }, scene);
				break;
			case "sphere":
				pickable = BABYLON.MeshBuilder.CreateSphere(nodeData.id, { diameter: 1 }, scene);
				break;
			case "plane":
				pickable = BABYLON.MeshBuilder.CreatePlane(nodeData.id, { size: 1 }, scene);
				break;
			case "cylinder":
				pickable = BABYLON.MeshBuilder.CreateCylinder(nodeData.id, { height: 1, diameter: 1 }, scene);
				break;
			case "torus":
				pickable = BABYLON.MeshBuilder.CreateTorus(nodeData.id, { diameter: 1, thickness: 0.3 }, scene);
				break;
			default:
				pickable = BABYLON.MeshBuilder.CreateBox(nodeData.id, { size: 1 }, scene);
		}
		const m = new BABYLON.StandardMaterial(nodeData.id + "_m", scene);
		try {
			m.diffuseColor = BABYLON.Color3.FromHexString(mc.material.color);
		} catch {
			m.diffuseColor = new BABYLON.Color3(0.42, 0.27, 0.76);
		}
		m.emissiveColor = m.diffuseColor.scale(0.15);
		pickable.material = m;
	} else if (lc) {
		pickable = BABYLON.MeshBuilder.CreateSphere(nodeData.id + "_g", { diameter: 0.35 }, scene);
		const gm = new BABYLON.StandardMaterial(nodeData.id + "_gm", scene);
		gm.emissiveColor = new BABYLON.Color3(1, 0.9, 0.4);
		gm.disableLighting = true;
		pickable.material = gm;
	} else if (cc) {
		pickable = BABYLON.MeshBuilder.CreateBox(nodeData.id + "_g", { size: 0.5 }, scene);
		const gm = new BABYLON.StandardMaterial(nodeData.id + "_gm", scene);
		gm.wireframe = true;
		gm.emissiveColor = new BABYLON.Color3(0.5, 0.8, 1);
		gm.disableLighting = true;
		pickable.material = gm;
	}

	if (pickable) {
		pickable.parent = root;
		pickable.position.set(0, 0, 0);
		pickable.rotationQuaternion = BABYLON.Quaternion.Identity();
		pickable.scaling.set(1, 1, 1);
	}

	if (pickable) {
		meshToNodeId.set(pickable, nodeData.id);
		nodeIdToMesh.set(nodeData.id, pickable);
	}
	nodeIdToRoot.set(nodeData.id, root);
	rootToNodeId.set(root, nodeData.id);

	const t = nodeData.transform;
	if (t) {
		root.position.set(t.position.x, t.position.y, t.position.z);
		root.rotationQuaternion = new BABYLON.Quaternion(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
		root.scaling.set(t.scale.x, t.scale.y, t.scale.z);
	}

	if (parentRoot) {
		root.parent = parentRoot;
	}

	for (const child of nodeData.children ?? []) {
		buildNode(child, root);
	}
}
