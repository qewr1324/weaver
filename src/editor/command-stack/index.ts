import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";

export interface Command {
	readonly label: string;
	execute(): void;
	undo(): void;
}

export class CommandStack extends Disposable {
	private undoStack: Command[] = [];
	private redoStack: Command[] = [];
	private maxSize = 200;
	readonly bus = new EventBus<{ changed: void }>();

	execute(cmd: Command): void {
		cmd.execute();
		this.undoStack.push(cmd);
		if (this.undoStack.length > this.maxSize) this.undoStack.shift();
		this.redoStack.length = 0;
		this.bus.emit("changed", undefined);
	}

	undo(): void {
		const cmd = this.undoStack.pop();
		if (!cmd) return;
		cmd.undo();
		this.redoStack.push(cmd);
		this.bus.emit("changed", undefined);
	}

	redo(): void {
		const cmd = this.redoStack.pop();
		if (!cmd) return;
		cmd.execute();
		this.undoStack.push(cmd);
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
