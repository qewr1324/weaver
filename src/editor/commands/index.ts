import type { Command } from "../command-stack";
import type { Node } from "../../scene/node";
import type { Scene } from "../../scene/scene";

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
