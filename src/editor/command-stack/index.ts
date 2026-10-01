import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";

export interface Command {
	readonly label: string;
	execute(): void | Promise<void>;
	undo(): void | Promise<void>;
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
