// src/editor/editor-context/index.ts
import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";
import { Logger } from "../../core/logger";
import { Scene } from "../../scene/scene";
import type { Node } from "../../scene/node";
import { CommandStack } from "../command-stack";
import type { SceneDocument } from "../scene-document";
import { Selection } from "../selection";

/** snapshot ترنسفورم برای sync بین inspector و viewport */
export interface TransformSyncPayload {
	nodeId: string;
	transform: {
		position: { x: number; y: number; z: number };
		rotation: { x: number; y: number; z: number; w: number };
		scale: { x: number; y: number; z: number };
	};
	/** منبع تغییر — تا viewport از echo خودش صرف‌نظر کنه */
	source: "viewport" | "inspector" | "command" | "file";
}

export class EditorContext extends Disposable {
	private _document: SceneDocument | null = null;
	private _fallbackScene: Scene;
	private _fallbackCommands = new CommandStack();
	private log = new Logger("EditorContext");

	readonly selection = new Selection();

	readonly bus = new EventBus<{
		"scene:loaded": Scene;
		"scene:mutated": void;
		"dirty:changed": boolean;
		// ─── پل بین inspector و viewport ───
		"transform:changed": TransformSyncPayload;
		"rename:changed": { nodeId: string; name: string };
	}>();

	constructor() {
		super();
		this._fallbackScene = new Scene();
		this.register(this._fallbackCommands);
		this.register(this.selection);

		this._fallbackScene.bus.on("scene:changed", () => {
			if (this._document) return;
			this.bus.emit("scene:mutated", undefined);
		});
	}

	get scene(): Scene {
		return this._document?.scene ?? this._fallbackScene;
	}

	get commands(): CommandStack {
		return this._document?.commands ?? this._fallbackCommands;
	}

	get document(): SceneDocument | null {
		return this._document;
	}

	get dirty(): boolean {
		return this._document?.dirty ?? false;
	}

	attachDocument(doc: SceneDocument): void {
		if (this._document === doc) return;
		this._document = doc;

		doc.bus.on("dirty:changed", (v) => {
			if (this._document !== doc) return;
			this.bus.emit("dirty:changed", v);
		});
		doc.bus.on("changed", () => {
			if (this._document !== doc) return;
			this.bus.emit("scene:mutated", undefined);
		});

		this.selection.clear();
		this.markDirty(doc.dirty);
		this.bus.emit("scene:loaded", doc.scene);
	}

	detachDocument(uri?: string): void {
		if (!this._document) return;
		if (uri && this._document.uri.toString() !== uri) return;
		this._document = null;
		this.selection.clear();
		this.markDirty(false);
		this.bus.emit("scene:loaded", this._fallbackScene);
	}

	markDirty(value: boolean): void {
		this.bus.emit("dirty:changed", value);
	}

	/**
	 * helper: از هر جایی که transform رو عوض کردی، این رو صدا بزن
	 * تا inspector و viewport هم‌زمان sync شن.
	 */
	notifyTransformChanged(node: Node, source: TransformSyncPayload["source"]): void {
		this.bus.emit("transform:changed", {
			nodeId: node.id,
			transform: {
				position: { ...node.transform.position },
				rotation: { ...node.transform.rotation },
				scale: { ...node.transform.scale },
			},
			source,
		});
	}

	notifyRenamed(node: Node): void {
		this.bus.emit("rename:changed", { nodeId: node.id, name: node.name });
	}

	loadScene(scene: Scene): void {
		if (this._document) {
			this._document.scene.replaceContents(scene);
		} else {
			this._fallbackScene = scene;
		}
		this._fallbackCommands.clear();
		this.selection.clear();
		this.markDirty(false);
		this.bus.emit("scene:loaded", this.scene);
	}
}
