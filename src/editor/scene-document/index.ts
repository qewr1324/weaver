// src/editor/scene-document/index.ts
import * as vscode from "vscode";
import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";
import { Logger } from "../../core/logger";
import { Serializer } from "../../scene/serializer";
import { Scene } from "../../scene/scene";
import { CommandStack } from "../command-stack";

export class SceneDocument extends Disposable {
	private readonly log = new Logger("SceneDocument");
	private readonly _scene: Scene;
	private _dirty = false;
	private _applyingRemote = false;
	private _flushTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly _flushDelayMs = 200;

	/** command stack مخصوص همین document */
	readonly commands = new CommandStack();

	readonly bus = new EventBus<{
		changed: void;
		"dirty:changed": boolean;
		"external:changed": void;
		"scene:reloaded": void;
	}>();

	constructor(
		readonly uri: vscode.Uri,
		initial: Scene,
	) {
		super();
		this._scene = initial;
		this.register(this.commands);

		// ─── هر تغییر در scene → dirty + debounced flush ───
		this._scene.bus.on("scene:changed", () => {
			if (this._applyingRemote) return;
			this.markDirty(true);
			this.bus.emit("changed", undefined);
			this.scheduleFlush();
		});

		// ─── reload از فایل → dirty پاک ───
		this._scene.bus.on("scene:reloaded", () => {
			if (this._applyingRemote) return;
			this.bus.emit("changed", undefined);
		});
	}

	get scene(): Scene {
		return this._scene;
	}

	get dirty(): boolean {
		return this._dirty;
	}

	get writing(): boolean {
		return this._applyingRemote;
	}

	markDirty(value: boolean): void {
		if (this._dirty === value) return;
		this._dirty = value;
		this.bus.emit("dirty:changed", value);
	}

	/**
	 * از فایل → Scene.
	 * مهم: event `scene:changed` رو fire **نمی‌کنه** (چون از فایل اومده).
	 */
	applyFromText(text: string): void {
		if (this._applyingRemote) {
			this.log.debug("applyFromText skipped (applyingRemote)");
			return;
		}

		try {
			const incoming = Serializer.deserialize(text);

			this._applyingRemote = true;
			try {
				this._scene.replaceContents(incoming);
			} finally {
				queueMicrotask(() => {
					this._applyingRemote = false;
				});
			}

			this.markDirty(false);
			this.bus.emit("external:changed", undefined);
			this.bus.emit("scene:reloaded", undefined);
			this.bus.emit("changed", undefined);
		} catch (err) {
			this.log.error("applyFromText failed", err);
		}
	}

	private scheduleFlush(): void {
		if (this._flushTimer) clearTimeout(this._flushTimer);
		this._flushTimer = setTimeout(() => {
			this._flushTimer = null;
			void this.flushToDocument();
		}, this._flushDelayMs);
	}

	async flushToDocument(save = false): Promise<void> {
		if (this._flushTimer) {
			clearTimeout(this._flushTimer);
			this._flushTimer = null;
		}

		const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === this.uri.toString());
		if (!doc) {
			this.log.warn("document not found for flush", this.uri.toString());
			return;
		}

		const json = Serializer.serialize(this._scene);
		if (json === doc.getText()) {
			this.markDirty(false);
			if (save && doc.isDirty) await doc.save();
			return;
		}

		this._applyingRemote = true;
		try {
			const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
			const edit = new vscode.WorkspaceEdit();
			edit.replace(this.uri, fullRange, json);
			await vscode.workspace.applyEdit(edit);

			if (save) {
				await doc.save();
			}
		} finally {
			// ⭐ به جای queueMicrotask از setTimeout(150) استفاده کن
			// تا event onDidChangeTextDocument فرصت fire شدن داشته باشه
			setTimeout(() => {
				this._applyingRemote = false;
			}, 150);
		}

		this.markDirty(false);
	}

	dispose(): void {
		if (this._flushTimer) clearTimeout(this._flushTimer);
		super.dispose();
	}
}
