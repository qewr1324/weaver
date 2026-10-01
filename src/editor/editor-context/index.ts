import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";
import { Logger } from "../../core/logger";
import { Scene } from "../../scene/scene";
import { CommandStack } from "../command-stack";
import { Selection } from "../selection";

export class EditorContext extends Disposable {
	scene: Scene;
	readonly commands = new CommandStack();
	readonly selection = new Selection();
	private log = new Logger("EditorContext");

	readonly bus = new EventBus<{
		"scene:loaded": Scene;
		"scene:mutated": void;
		"dirty:changed": boolean;
	}>();

	private _dirty = false;

	get dirty(): boolean {
		return this._dirty;
	}

	constructor() {
		super();
		this.scene = new Scene();
		this.register(this.commands);
		this.register(this.selection);
		this.scene.bus.on("scene:changed", () => {
			this.markDirty(true);
			this.bus.emit("scene:mutated", undefined);
		});
	}

	markDirty(value: boolean): void {
		if (this._dirty === value) return;
		this._dirty = value;
		this.bus.emit("dirty:changed", value);
	}

	loadScene(scene: Scene): void {
		this.scene = scene;
		this.commands.clear();
		this.selection.clear();
		this.markDirty(false);
		this.bus.emit("scene:loaded", scene);
	}
}
