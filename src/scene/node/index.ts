import type { Component, ComponentType } from "../components";
import { nextComponentId } from "../components";
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

	/**
	 * Deep clone با IDهای جدید برای node و componentها.
	 * موقعیت رو offset می‌کنه تا روی parent overlap نشه.
	 */
	clone(offset = { x: 0.5, y: 0, z: 0.5 }): Node {
		const cloned = new Node(this.name + " (Copy)");
		cloned.enabled = this.enabled;
		cloned.transform.position = {
			x: this.transform.position.x + offset.x,
			y: this.transform.position.y + offset.y,
			z: this.transform.position.z + offset.z,
		};
		cloned.transform.rotation = { ...this.transform.rotation };
		cloned.transform.scale = { ...this.transform.scale };

		for (const c of this.components) {
			cloned.addComponent({ ...c, id: nextComponentId() } as Component);
		}

		for (const child of this.children) {
			cloned.addChild(child.clone({ x: 0, y: 0, z: 0 }));
		}

		return cloned;
	}
}
