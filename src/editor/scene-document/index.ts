import * as vscode from "vscode";
import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";
import { Logger } from "../../core/logger";
import { Serializer } from "../../scene/serializer";
import { Scene } from "../../scene/scene";

/**
 * SceneDocument = single source of truth بین فایل و Scene in-memory.
 *
 * - `scene` همیشه همون object می‌مونه (هرگز عوض نمی‌شه) — فقط محتویاتش به‌روز می‌شه.
 * - `_writing` جلوی re-entrancy رو می‌گیره وقتی خودمون فایل رو ذخیره می‌کنیم.
 * - `_syncing` جلوی dirty شدن رو می‌گیره وقتی از فایل داریم sync می‌کنیم.
 */
export class SceneDocument extends Disposable {
	private readonly log = new Logger("SceneDocument");
	private _scene: Scene;
	private _dirty = false;
	private _syncing = false;
	private _writing = false;

	readonly bus = new EventBus<{
		changed: void;
		"dirty:changed": boolean;
		"external:changed": void;
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

	/** آیا همین الان داریم فایل رو می‌نویسیم؟ */
	get writing(): boolean {
		return this._writing;
	}

	markDirty(value: boolean): void {
		if (this._dirty === value) return;
		this._dirty = value;
		this.bus.emit("dirty:changed", value);
	}

	/**
	 * از سمت VSCode document → Scene in-memory.
	 * فقط وقتی که تغییر از بیرون اومده (نه خودمون).
	 * از `replaceContents` استفاده می‌کنه تا object `Scene` عوض نشه.
	 */
	applyFromText(text: string): void {
		if (this._writing) return;

		try {
			const scene = Serializer.deserialize(text);
			this._syncing = true;
			this._scene.replaceContents(scene);
			this._syncing = false;
			this.markDirty(false);
			this.bus.emit("external:changed", undefined);
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

		// ─── flag: ما داریم می‌نویسیم ───
		this._writing = true;
		try {
			const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
			const edit = new vscode.WorkspaceEdit();
			edit.replace(this.uri, fullRange, json);
			await vscode.workspace.applyEdit(edit);

			if (save) {
				await doc.save();
			}
		} finally {
			// ─── یه tick صبر کن تا eventهای VSCode fire بشن ───
			setTimeout(() => {
				this._writing = false;
			}, 50);
		}

		this.markDirty(false);
	}

	dispose(): void {
		super.dispose();
	}
}
