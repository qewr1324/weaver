// src/scene/scene/index.ts
import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";
import { deepMerge } from "../../config/deep-merge";
import { getGlobalConfig } from "../../config/loader";
import type { WeaverConfig } from "../../config/types";
import { Node } from "../node";
import type { NodeData } from "../node";

export interface SceneData {
	version: string;
	name: string;
	config?: Partial<WeaverConfig>;
	root: NodeData;
}

export interface TransformChangedPayload {
	nodeId: string;
	transform: {
		position: { x: number; y: number; z: number };
		rotation: { x: number; y: number; z: number; w: number };
		scale: { x: number; y: number; z: number };
	};
	source: "viewport" | "inspector" | "undo" | "load";
}

export class Scene extends Disposable {
	readonly root: Node;
	name: string;
	config: Partial<WeaverConfig>;

	readonly bus = new EventBus<{
		"node:added": Node;
		"node:removed": Node;
		"node:changed": Node;
		"scene:changed": void;
		"scene:reloaded": void;
		"transform:changed": TransformChangedPayload;
	}>();

	constructor(name = "Untitled Scene", config: Partial<WeaverConfig> = {}) {
		super();
		this.name = name;
		this.config = config;
		this.root = new Node("Root");
	}

	addNode(node: Node, parent: Node = this.root): void {
		parent.addChild(node);
		this.bus.emit("node:added", node);
		this.bus.emit("scene:changed", undefined);
	}

	removeNode(node: Node): void {
		node.parent?.removeChild(node);
		this.bus.emit("node:removed", node);
		this.bus.emit("scene:changed", undefined);
	}

	findNode(id: string): Node | null {
		return this.walk(this.root, id);
	}

	private walk(node: Node, id: string): Node | null {
		if (node.id === id) return node;
		for (const child of node.children) {
			const found = this.walk(child, id);
			if (found) return found;
		}
		return null;
	}

	allNodes(): Node[] {
		const out: Node[] = [];
		const visit = (n: Node) => {
			for (const c of n.children) {
				out.push(c);
				visit(c);
			}
		};
		visit(this.root);
		return out;
	}

	resolvedConfig(): WeaverConfig | null {
		const global = getGlobalConfig();
		if (!global) return null;
		return deepMerge(global, this.config);
	}

	replaceContents(other: Scene): void {
		const oldChildren = [...this.root.children];
		for (const old of oldChildren) {
			old.parent = null;
		}
		this.root.children.length = 0;

		this.name = other.name;
		this.config = other.config;

		const sourceChildren = [...other.root.children];
		for (const child of sourceChildren) {
			const cloned = Node.fromJSON(child.toJSON());
			cloned.parent = this.root;
			this.root.children.push(cloned);
		}

		this.bus.emit("scene:reloaded", undefined);
		this.bus.emit("scene:changed", undefined);
	}

	toJSON(): SceneData {
		return {
			version: "1.0",
			name: this.name,
			config: this.config,
			root: this.root.toJSON(),
		};
	}

	static fromJSON(data: SceneData): Scene {
		const scene = new Scene(data.name, data.config ?? {});
		const root = Node.fromJSON(data.root);
		const children = [...root.children];
		for (const child of children) {
			child.parent = scene.root;
			scene.root.children.push(child);
		}
		return scene;
	}
}
