import type { Component, ComponentType } from "../components";
import { Transform } from "../transform";
import type { TransformData } from "../transform";

export interface NodeData {
	id: string;
	name: string;
	enabled: boolean;
	transform: TransformData;
	components: Component[];
	children: NodeData[];
}

let nodeCounter = 0;

export const nextNodeId = (): string => `node_${++nodeCounter}_${Date.now().toString(36)}`;

export class Node {
	readonly id: string;
	name: string;
	enabled = true;
	readonly transform = new Transform();
	readonly components: Component[] = [];
	parent: Node | null = null;
	readonly children: Node[] = [];

	constructor(name = "Node", id?: string) {
		this.id = id ?? nextNodeId();
		this.name = name;
	}

	addChild(child: Node): void {
		if (child.parent === this) return;
		child.parent?.removeChild(child);
		child.parent = this;
		this.children.push(child);
	}

	removeChild(child: Node): void {
		const idx = this.children.indexOf(child);
		if (idx >= 0) {
			this.children.splice(idx, 1);
			child.parent = null;
		}
	}

	addComponent(component: Component): void {
		this.components.push(component);
	}

	removeComponent(id: string): void {
		const idx = this.components.findIndex((c) => c.id === id);
		if (idx >= 0) this.components.splice(idx, 1);
	}

	findComponent<T extends ComponentType>(type: T): Extract<Component, { type: T }> | undefined {
		return this.components.find((c) => c.type === type) as Extract<Component, { type: T }> | undefined;
	}

	toJSON(): NodeData {
		return {
			id: this.id,
			name: this.name,
			enabled: this.enabled,
			transform: this.transform.toJSON(),
			components: this.components.map((c) => ({ ...c })),
			children: this.children.map((c) => c.toJSON()),
		};
	}

	static fromJSON(data: NodeData): Node {
		const node = new Node(data.name, data.id);
		node.enabled = data.enabled;
		node.transform = Transform.fromJSON(data.transform);
		for (const c of data.components) node.addComponent({ ...c } as Component);
		for (const childData of data.children) node.addChild(Node.fromJSON(childData));
		return node;
	}
}
