// src/editor/command-stack/index.ts
import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";
import type { Node } from "../../scene/node";

export interface Command {
	readonly label: string;
	execute(): void | Promise<void>;
	undo(): void | Promise<void>;
}

/**
 * command خاص برای تغییراتی که بیرون از stack اتفاق افتاده
 * (مثل live-edit در inspector). مقادیر از قبل اعمال شدن؛
 * این command فقط undo/redo رو ممکن می‌کنه.
 */
class ExternalChangeCommand implements Command {
	readonly label: string;

	constructor(
		private node: Node,
		private channel: "position" | "rotation" | "scale",
		private axis: "x" | "y" | "z" | "w",
		private before: number,
		private after: number,
		private onChanged?: (node: Node) => void,
	) {
		this.label = `Set ${channel}.${axis}`;
	}

	execute(): void {
		(this.node.transform[this.channel] as any)[this.axis] = this.after;
		this.onChanged?.(this.node);
	}

	undo(): void {
		(this.node.transform[this.channel] as any)[this.axis] = this.before;
		this.onChanged?.(this.node);
	}
}

export class CommandStack extends Disposable {
	private undoStack: Command[] = [];
	private redoStack: Command[] = [];
	private maxSize = 200;
	private executing = false;
	readonly bus = new EventBus<{ changed: void }>();

	async execute(cmd: Command): Promise<void> {
		if (this.executing) return;
		this.executing = true;
		try {
			await cmd.execute();
			this.undoStack.push(cmd);
			if (this.undoStack.length > this.maxSize) this.undoStack.shift();
			this.redoStack.length = 0;
			this.bus.emit("changed", undefined);
		} finally {
			this.executing = false;
		}
	}

	async undo(): Promise<void> {
		if (this.executing) return;
		const cmd = this.undoStack.pop();
		if (!cmd) return;
		this.executing = true;
		try {
			await cmd.undo();
			this.redoStack.push(cmd);
			this.bus.emit("changed", undefined);
		} finally {
			this.executing = false;
		}
	}

	async redo(): Promise<void> {
		if (this.executing) return;
		const cmd = this.redoStack.pop();
		if (!cmd) return;
		this.executing = true;
		try {
			await cmd.execute();
			this.undoStack.push(cmd);
			this.bus.emit("changed", undefined);
		} finally {
			this.executing = false;
		}
	}

	/**
	 * ⭐ برای live-edit: مقدار از قبل اعمال شده.
	 * فقط command رو به undo stack اضافه کن (بدون execute).
	 */
	recordExternalChange(node: Node, channel: "position" | "rotation" | "scale", axis: "x" | "y" | "z" | "w", before: number, after: number, onChanged?: (node: Node) => void): void {
		if (Math.abs(before - after) < 1e-9) return;
		const cmd = new ExternalChangeCommand(node, channel, axis, before, after, onChanged);
		this.undoStack.push(cmd);
		if (this.undoStack.length > this.maxSize) this.undoStack.shift();
		this.redoStack.length = 0;
		this.bus.emit("changed", undefined);
	}

	clear(): void {
		this.undoStack.length = 0;
		this.redoStack.length = 0;
		this.bus.emit("changed", undefined);
	}

	dispose(): void {
		this.clear();
		super.dispose();
	}
}
