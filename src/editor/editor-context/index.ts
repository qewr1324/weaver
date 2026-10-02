// src/editor/editor-context/index.ts
import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";
import { Logger } from "../../core/logger";
import { Scene } from "../../scene/scene";
import { CommandStack } from "../command-stack";
import type { SceneDocument } from "../scene-document";
import { Selection } from "../selection";

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
	}>();

	constructor() {
		super();
		this._fallbackScene = new Scene();
		this.register(this._fallbackCommands);
		this.register(this.selection);

		// fallback: وقتی document نداریم، fallbackScene منبع حقیقته
		this._fallbackScene.bus.on("scene:changed", () => {
			if (this._document) return; // اگه document داریم، اون مدیریت می‌کنه
			this.bus.emit("scene:mutated", undefined);
		});
	}

	/** scene فعال — از document اگه موجوده، وگرنه fallback */
	get scene(): Scene {
		return this._document?.scene ?? this._fallbackScene;
	}

	/** command stack فعال — از document اگه موجوده، وگرنه fallback */
	get commands(): CommandStack {
		return this._document?.commands ?? this._fallbackCommands;
	}

	/** document فعال (اگه هست) */
	get document(): SceneDocument | null {
		return this._document;
	}

	get dirty(): boolean {
		return this._document?.dirty ?? false;
	}

	/**
	 * یه SceneDocument رو attach کن.
	 * scene قبلی fallback می‌شه (ولی dispose نمی‌شه چون fallbackCommands مال خودشه).
	 */
	attachDocument(doc: SceneDocument): void {
		if (this._document === doc) return;

		// اگه قبلاً document داشتیم، dirty:changed قدیمی رو unsubscribe کن
		this._document = doc;

		// dirty از document به editor منتقل شه
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

	/**
	 * document فعال رو جدا کن (مثلاً وقتی تب بسته می‌شه).
	 * @param uri اگه بدی، فقط اگه همون uri بود جدا می‌کنه.
	 */
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
	 * سازگاری با کدهای قدیمی — یه Scene جدید رو جایگزین fallback می‌کنه.
	 * (وقتی document وجود نداره)
	 */
	loadScene(scene: Scene): void {
		if (this._document) {
			// اگه document داریم، scene رو داخلش replace کن
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
