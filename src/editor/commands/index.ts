// src/editor/commands/index.ts
import type { Node } from "../../scene/node";
import type { Scene } from "../../scene/scene";
import type { Command } from "../command-stack";

// ─────────────────────────────────────────────
// ADD
// ─────────────────────────────────────────────
export class AddNodeCommand implements Command {
	readonly label: string;

	constructor(
		private scene: Scene,
		private node: Node,
		private parent?: Node,
	) {
		this.label = `Add ${node.name}`;
	}

	execute(): void {
		this.scene.addNode(this.node, this.parent);
	}

	undo(): void {
		this.scene.removeNode(this.node);
	}
}

// ─────────────────────────────────────────────
// REMOVE
// ─────────────────────────────────────────────
export class RemoveNodeCommand implements Command {
	readonly label: string;
	private parent: Node | null = null;
	private index = -1;

	constructor(
		private scene: Scene,
		private node: Node,
	) {
		this.label = `Remove ${node.name}`;
	}

	execute(): void {
		this.parent = this.node.parent;
		this.index = this.parent ? this.parent.children.indexOf(this.node) : -1;
		this.scene.removeNode(this.node);
	}

	undo(): void {
		if (this.parent) {
			this.parent.children.splice(this.index, 0, this.node);
			this.node.parent = this.parent;
			this.scene.bus.emit("node:added", this.node);
			this.scene.bus.emit("scene:changed", undefined);
		}
	}
}

// ─────────────────────────────────────────────
// RENAME
// ─────────────────────────────────────────────
export class RenameNodeCommand implements Command {
	readonly label: string;
	private prevName: string;
	private onChanged?: (node: Node) => void;

	constructor(
		private node: Node,
		private nextName: string,
		onChanged?: (node: Node) => void,
	) {
		this.prevName = node.name;
		this.label = `Rename ${this.prevName} → ${nextName}`;
		this.onChanged = onChanged;
	}

	execute(): void {
		this.node.name = this.nextName;
		this.onChanged?.(this.node);
	}

	undo(): void {
		this.node.name = this.prevName;
		this.onChanged?.(this.node);
	}
}

// ─────────────────────────────────────────────
// REPARENT
// ─────────────────────────────────────────────
export class ReparentNodeCommand implements Command {
	readonly label: string;
	private oldParent: Node | null = null;
	private oldIndex = -1;

	constructor(
		private scene: Scene,
		private node: Node,
		private newParent: Node,
		private newIndex?: number,
	) {
		this.label = `Reparent ${node.name}`;
	}

	execute(): void {
		this.oldParent = this.node.parent;
		this.oldIndex = this.oldParent ? this.oldParent.children.indexOf(this.node) : -1;
		this.oldParent?.removeChild(this.node);
		if (typeof this.newIndex === "number") {
			this.node.parent = this.newParent;
			this.newParent.children.splice(this.newIndex, 0, this.node);
		} else {
			this.newParent.addChild(this.node);
		}
		this.scene.bus.emit("scene:changed", undefined);
	}

	undo(): void {
		this.newParent.removeChild(this.node);
		if (this.oldParent) {
			if (this.oldIndex >= 0) {
				this.oldParent.children.splice(this.oldIndex, 0, this.node);
				this.node.parent = this.oldParent;
			} else {
				this.oldParent.addChild(this.node);
			}
		}
		this.scene.bus.emit("scene:changed", undefined);
	}
}

// ─────────────────────────────────────────────
// DUPLICATE
// ─────────────────────────────────────────────
export class DuplicateNodeCommand implements Command {
	readonly label: string;
	private cloned: Node | null = null;

	constructor(
		private scene: Scene,
		private source: Node,
		private cloneFn: (source: Node) => Node,
	) {
		this.label = `Duplicate ${source.name}`;
	}

	execute(): void {
		if (!this.cloned) {
			this.cloned = this.cloneFn(this.source);
		}
		const parent = this.source.parent;
		if (parent) {
			this.scene.addNode(this.cloned, parent);
		}
	}

	undo(): void {
		if (this.cloned) this.scene.removeNode(this.cloned);
	}
}

// ─────────────────────────────────────────────
// SET PROPERTY
// ─────────────────────────────────────────────
export class SetPropertyCommand<T> implements Command {
	readonly label: string;
	private prev: T | undefined;

	constructor(
		private target: Record<string, T>,
		private key: string,
		private nextValue: T,
		labelText?: string,
	) {
		this.label = labelText ?? `Set ${key}`;
	}

	execute(): void {
		this.prev = this.target[this.key];
		this.target[this.key] = this.nextValue;
	}

	undo(): void {
		this.target[this.key] = this.prev as T;
	}
}

// ─────────────────────────────────────────────
// SET TRANSFORM (single axis)
// ─────────────────────────────────────────────
export class SetTransformCommand implements Command {
	readonly label: string;
	private prev: number;
	private onChanged?: (node: Node) => void;

	constructor(
		private node: Node,
		private channel: "position" | "rotation" | "scale",
		private axis: "x" | "y" | "z" | "w",
		private nextValue: number,
		onChanged?: (node: Node) => void,
	) {
		this.prev = (node.transform[channel] as any)[axis];
		this.label = `Set ${channel}.${axis}`;
		this.onChanged = onChanged;
	}

	execute(): void {
		(this.node.transform[this.channel] as any)[this.axis] = this.nextValue;
		this.onChanged?.(this.node);
	}

	undo(): void {
		(this.node.transform[this.channel] as any)[this.axis] = this.prev;
		this.onChanged?.(this.node);
	}
}

// ─────────────────────────────────────────────
// SET WHOLE TRANSFORM
// ─────────────────────────────────────────────
export interface TransformSnapshot {
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number; w: number };
	scale: { x: number; y: number; z: number };
}

export class SetWholeTransformCommand implements Command {
	readonly label: string;
	private prev: TransformSnapshot;
	private next: TransformSnapshot;
	private onChanged?: (node: Node) => void;

	constructor(
		private node: Node,
		next: TransformSnapshot,
		onChanged?: (node: Node) => void,
		explicitBefore?: TransformSnapshot,
	) {
		this.next = {
			position: { ...next.position },
			rotation: { ...next.rotation },
			scale: { ...next.scale },
		};

		if (explicitBefore) {
			this.prev = {
				position: { ...explicitBefore.position },
				rotation: { ...explicitBefore.rotation },
				scale: { ...explicitBefore.scale },
			};
		} else {
			this.prev = {
				position: { ...node.transform.position },
				rotation: { ...node.transform.rotation },
				scale: { ...node.transform.scale },
			};
		}

		this.label = `Transform ${node.name}`;
		this.onChanged = onChanged;

		console.log("[SetWhole] constructed", {
			node: node.name,
			nodeId: node.id,
			prev: this.prev.position,
			next: this.next.position,
		});
	}

	execute(): void {
		console.log("[SetWhole] execute →", this.next.position);
		this.node.transform.position = { ...this.next.position };
		this.node.transform.rotation = { ...this.next.rotation };
		this.node.transform.scale = { ...this.next.scale };
		this.onChanged?.(this.node);
	}

	undo(): void {
		console.log("[SetWhole] undo →", this.prev.position);
		this.node.transform.position = { ...this.prev.position };
		this.node.transform.rotation = { ...this.prev.rotation };
		this.node.transform.scale = { ...this.prev.scale };
		this.onChanged?.(this.node);
	}
}
