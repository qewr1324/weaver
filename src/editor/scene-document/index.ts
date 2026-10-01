import * as vscode from "vscode";
import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";
import { Logger } from "../../core/logger";
import { Serializer } from "../../scene/serializer";
import { Scene } from "../../scene/scene";

/**
 * SceneDocument = single source of truth بین فایل و Scene in-memory.
 * هر تغییری از سمت Editor باید از طریق این کلاس اعمال بشه.
 */
export class SceneDocument extends Disposable {
	private readonly log = new Logger("SceneDocument");
	private _scene: Scene;
	private _dirty = false;
	private _syncing = false;

	readonly bus = new EventBus<{
		changed: void;
		"dirty:changed": boolean;
		"synced:from-file": void;
	}>();

	constructor(
		readonly uri: vscode.Uri,
		initial: Scene,
	) {
		super();
		this._scene = initial;

		this._scene.bus.on("scene:changed", () => {
			if (this._syncing) return;
			this.markDirty(true);
			this.bus.emit("changed", undefined);
		});
	}

	get scene(): Scene {
		return this._scene;
	}

	get dirty(): boolean {
		return this._dirty;
	}

	markDirty(value: boolean): void {
		if (this._dirty === value) return;
		this._dirty = value;
		this.bus.emit("dirty:changed", value);
	}

	/**
	 * از سمت VSCode document → Scene in-memory
	 */
	applyFromText(text: string): void {
		try {
			const scene = Serializer.deserialize(text);
			this._syncing = true;
			this._scene = scene;
			this._syncing = false;
			this.markDirty(false);
			this.bus.emit("synced:from-file", undefined);
			this.bus.emit("changed", undefined);
		} catch (err) {
			this.log.error("applyFromText failed", err);
		}
	}

	/**
	 * از Scene → فایل.
	 * @param save اگه true باشه، بعد از applyEdit یه doc.save() هم می‌زنه.
	 */
	async flushToDocument(save = false): Promise<void> {
		const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === this.uri.toString());
		if (!doc) {
			this.log.warn("document not found for flush", this.uri.toString());
			return;
		}

		const json = Serializer.serialize(this._scene);
		if (json === doc.getText()) {
			this.markDirty(false);
			if (save) await doc.save();
			return;
		}

		const edit = new vscode.WorkspaceEdit();
		edit.replace(this.uri, new vscode.Range(0, 0, doc.lineCount, 0), json);
		await vscode.workspace.applyEdit(edit);

		if (save) {
			await doc.save();
		}

		this.markDirty(false);
	}

	dispose(): void {
		super.dispose();
	}
}
