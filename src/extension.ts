// src/extension.ts — Weaver Engine (single file)
import * as vscode from "vscode";

// ═══════════════════════════════════════════════════════════════
// CORE LAYER
// ═══════════════════════════════════════════════════════════════

// ─── EventBus ──────────────────────────────────────────────────
type EventMap = Record<string, unknown>;
type EventHandler<T> = (payload: T) => void;
type Unsubscribe = () => void;

class EventBus<TEvents extends EventMap> {
	private handlers = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

	on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe {
		let set = this.handlers.get(event);
		if (!set) {
			set = new Set();
			this.handlers.set(event, set);
		}
		set.add(handler as EventHandler<unknown>);
		return () => this.off(event, handler);
	}

	once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe {
		const unsub = this.on(event, (payload) => {
			unsub();
			handler(payload);
		});
		return unsub;
	}

	off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
		const set = this.handlers.get(event);
		if (!set) return;
		set.delete(handler as EventHandler<unknown>);
		if (set.size === 0) this.handlers.delete(event);
	}

	emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
		const set = this.handlers.get(event);
		if (!set) return;
		for (const handler of [...set]) {
			try {
				(handler as EventHandler<TEvents[K]>)(payload);
			} catch (err) {
				console.error(`[EventBus] handler error for "${String(event)}"`, err);
			}
		}
	}

	clear(): void {
		this.handlers.clear();
	}
}

// ─── Disposable ────────────────────────────────────────────────
interface IDisposable {
	dispose(): void;
	readonly disposed: boolean;
}

class DisposableStore implements IDisposable {
	private items: IDisposable[] = [];
	private _disposed = false;
	get disposed(): boolean {
		return this._disposed;
	}

	add<T extends IDisposable>(item: T): T {
		if (this._disposed) {
			item.dispose();
			return item;
		}
		this.items.push(item);
		return item;
	}

	remove(item: IDisposable): void {
		const idx = this.items.indexOf(item);
		if (idx >= 0) this.items.splice(idx, 1);
	}

	dispose(): void {
		if (this._disposed) return;
		this._disposed = true;
		for (const item of this.items) {
			try {
				item.dispose();
			} catch (err) {
				console.error("[DisposableStore]", err);
			}
		}
		this.items.length = 0;
	}
}

abstract class Disposable implements IDisposable {
	protected readonly _store = new DisposableStore();
	private _disposed = false;
	get disposed(): boolean {
		return this._disposed;
	}

	protected register<T extends IDisposable>(item: T): T {
		return this._store.add(item);
	}

	dispose(): void {
		if (this._disposed) return;
		this._disposed = true;
		this._store.dispose();
	}
}

// ─── Logger ────────────────────────────────────────────────────
enum LogLevel {
	Debug = 0,
	Info = 1,
	Warn = 2,
	Error = 3,
	Silent = 4,
}

class Logger {
	private static globalLevel: LogLevel = LogLevel.Info;
	static setLevel(level: LogLevel): void {
		Logger.globalLevel = level;
	}

	constructor(private readonly scope: string) {}

	private log(level: LogLevel, method: "log" | "warn" | "error", args: unknown[]): void {
		if (level < Logger.globalLevel) return;
		console[method](`[Weaver:${this.scope}]`, ...args);
	}
	debug(...a: unknown[]): void {
		this.log(LogLevel.Debug, "log", a);
	}
	info(...a: unknown[]): void {
		this.log(LogLevel.Info, "log", a);
	}
	warn(...a: unknown[]): void {
		this.log(LogLevel.Warn, "warn", a);
	}
	error(...a: unknown[]): void {
		this.log(LogLevel.Error, "error", a);
	}
}

// ═══════════════════════════════════════════════════════════════
// SCENE LAYER
// ═══════════════════════════════════════════════════════════════

// ─── Transform ─────────────────────────────────────────────────
interface Vector3Like {
	x: number;
	y: number;
	z: number;
}
interface QuaternionLike {
	x: number;
	y: number;
	z: number;
	w: number;
}

interface TransformData {
	position: Vector3Like;
	rotation: QuaternionLike;
	scale: Vector3Like;
}

const vec3 = (x = 0, y = 0, z = 0): Vector3Like => ({ x, y, z });
const quat = (x = 0, y = 0, z = 0, w = 1): QuaternionLike => ({ x, y, z, w });

class Transform {
	position: Vector3Like = vec3();
	rotation: QuaternionLike = quat();
	scale: Vector3Like = vec3(1, 1, 1);

	toJSON(): TransformData {
		return {
			position: { ...this.position },
			rotation: { ...this.rotation },
			scale: { ...this.scale },
		};
	}

	static fromJSON(data: TransformData): Transform {
		const t = new Transform();
		t.position = { ...data.position };
		t.rotation = { ...data.rotation };
		t.scale = { ...data.scale };
		return t;
	}
}

// ─── Components ────────────────────────────────────────────────
type ComponentType = "mesh" | "camera" | "light" | "script";

interface ComponentBase {
	readonly type: ComponentType;
	readonly id: string;
}

interface MeshComponent extends ComponentBase {
	type: "mesh";
	geometry: "box" | "sphere" | "plane" | "cylinder" | "torus";
	material: { color: string; metallic?: number; roughness?: number };
}

interface CameraComponent extends ComponentBase {
	type: "camera";
	fov: number;
	near: number;
	far: number;
	isMain: boolean;
}

interface LightComponent extends ComponentBase {
	type: "light";
	lightType: "directional" | "point" | "spot" | "hemispheric";
	intensity: number;
	color: string;
}

interface ScriptComponent extends ComponentBase {
	type: "script";
	source: string;
}

type Component = MeshComponent | CameraComponent | LightComponent | ScriptComponent;

let componentCounter = 0;
const nextComponentId = (): string => `cmp_${++componentCounter}_${Date.now().toString(36)}`;

// ─── Node ──────────────────────────────────────────────────────
let nodeCounter = 0;
const nextNodeId = (): string => `node_${++nodeCounter}_${Date.now().toString(36)}`;

interface NodeData {
	id: string;
	name: string;
	enabled: boolean;
	transform: TransformData;
	components: Component[];
	children: NodeData[];
}

class Node {
	readonly id: string;
	name: string;
	enabled = true;
	readonly transform = new Transform();
	readonly components: Component[] = [];
	parent: Node | null = null;
	readonly children: Node[] = [];

	constructor(name = "Node", id?: string) {
		this.id = id ?? nextNodeId();
		this.name = name;
	}

	addChild(child: Node): void {
		if (child.parent === this) return;
		child.parent?.removeChild(child);
		child.parent = this;
		this.children.push(child);
	}

	removeChild(child: Node): void {
		const idx = this.children.indexOf(child);
		if (idx >= 0) {
			this.children.splice(idx, 1);
			child.parent = null;
		}
	}

	addComponent(component: Component): void {
		this.components.push(component);
	}

	removeComponent(id: string): void {
		const idx = this.components.findIndex((c) => c.id === id);
		if (idx >= 0) this.components.splice(idx, 1);
	}

	findComponent<T extends ComponentType>(type: T): Extract<Component, { type: T }> | undefined {
		return this.components.find((c) => c.type === type) as Extract<Component, { type: T }> | undefined;
	}

	toJSON(): NodeData {
		return {
			id: this.id,
			name: this.name,
			enabled: this.enabled,
			transform: this.transform.toJSON(),
			components: this.components.map((c) => ({ ...c })),
			children: this.children.map((c) => c.toJSON()),
		};
	}

	static fromJSON(data: NodeData): Node {
		const node = new Node(data.name, data.id);
		node.enabled = data.enabled;
		node.transform = Transform.fromJSON(data.transform);
		for (const c of data.components) node.addComponent({ ...c } as Component);
		for (const childData of data.children) node.addChild(Node.fromJSON(childData));
		return node;
	}
}

// ─── Scene ─────────────────────────────────────────────────────
interface SceneData {
	version: string;
	name: string;
	root: NodeData;
}

class Scene extends Disposable {
	readonly root: Node;
	name: string;

	readonly bus = new EventBus<{
		"node:added": Node;
		"node:removed": Node;
		"node:changed": Node;
		"scene:changed": void;
	}>();

	constructor(name = "Untitled Scene") {
		super();
		this.name = name;
		this.root = new Node("Root");
	}

	addNode(node: Node, parent: Node = this.root): void {
		parent.addChild(node);
		this.bus.emit("node:added", node);
		this.bus.emit("scene:changed", undefined);
	}

	removeNode(node: Node): void {
		node.parent?.removeChild(node);
		this.bus.emit("node:removed", node);
		this.bus.emit("scene:changed", undefined);
	}

	findNode(id: string): Node | null {
		return this.walk(this.root, id);
	}

	private walk(node: Node, id: string): Node | null {
		if (node.id === id) return node;
		for (const child of node.children) {
			const found = this.walk(child, id);
			if (found) return found;
		}
		return null;
	}

	toJSON(): SceneData {
		return { version: "1.0", name: this.name, root: this.root.toJSON() };
	}

	static fromJSON(data: SceneData): Scene {
		const scene = new Scene(data.name);
		const root = Node.fromJSON(data.root);
		for (const child of root.children) scene.root.addChild(child);
		return scene;
	}
}

// ─── Serializer ────────────────────────────────────────────────
const Serializer = {
	serialize(scene: Scene): string {
		return JSON.stringify(scene.toJSON(), null, 2);
	},
	deserialize(json: string): Scene {
		return Scene.fromJSON(JSON.parse(json) as SceneData);
	},
};

// ─── Scene Factory ─────────────────────────────────────────────
const SceneFactory = {
	createDefaultScene(name = "New Scene"): Scene {
		const scene = new Scene(name);

		const cam = new Node("Main Camera");
		cam.addComponent({
			id: nextComponentId(),
			type: "camera",
			fov: 0.8,
			near: 0.1,
			far: 1000,
			isMain: true,
		});
		cam.transform.position = vec3(0, 2, -8);
		scene.addNode(cam);

		const light = new Node("Sun");
		light.addComponent({
			id: nextComponentId(),
			type: "light",
			lightType: "hemispheric",
			intensity: 1,
			color: "#ffffff",
		});
		light.transform.position = vec3(0, 10, 0);
		scene.addNode(light);

		const cube = new Node("Cube");
		cube.addComponent({
			id: nextComponentId(),
			type: "mesh",
			geometry: "box",
			material: { color: "#6B46C1", metallic: 0.2, roughness: 0.6 },
		});
		scene.addNode(cube);

		return scene;
	},
};

// ═══════════════════════════════════════════════════════════════
// RENDER LAYER
// ═══════════════════════════════════════════════════════════════

class AssetManager extends Disposable {
	private assets = new Map<string, unknown>();
	private log = new Logger("AssetManager");
	register<T>(key: string, asset: T): void {
		this.assets.set(key, asset);
	}
	get<T>(key: string): T | undefined {
		return this.assets.get(key) as T | undefined;
	}
	has(key: string): boolean {
		return this.assets.has(key);
	}
	dispose(): void {
		this.log.debug("disposing assets", this.assets.size);
		this.assets.clear();
		super.dispose();
	}
}

class RenderLoop extends Disposable {
	private handle: number | null = null;
	private callbacks = new Set<(dt: number) => void>();
	private lastTime = 0;

	start(): void {
		if (this.handle !== null) return;
		this.lastTime = performance.now();
		const tick = (now: number) => {
			const dt = (now - this.lastTime) / 1000;
			this.lastTime = now;
			for (const cb of this.callbacks) {
				try {
					cb(dt);
				} catch (err) {
					console.error("[RenderLoop]", err);
				}
			}
			this.handle = requestAnimationFrame(tick);
		};
		this.handle = requestAnimationFrame(tick);
	}

	stop(): void {
		if (this.handle !== null) {
			cancelAnimationFrame(this.handle);
			this.handle = null;
		}
	}

	onTick(cb: (dt: number) => void): Unsubscribe {
		this.callbacks.add(cb);
		return () => this.callbacks.delete(cb);
	}

	dispose(): void {
		this.stop();
		this.callbacks.clear();
		super.dispose();
	}
}

class Renderer extends Disposable {
	private log = new Logger("Renderer");
	readonly assets = new AssetManager();
	readonly loop = new RenderLoop();
	private scene: Scene | null = null;

	constructor() {
		super();
		this.register(this.assets);
		this.register(this.loop);
	}

	attachScene(scene: Scene): void {
		this.scene = scene;
		this.log.info("attached scene", scene.name);
	}

	getScene(): Scene | null {
		return this.scene;
	}

	async init(): Promise<void> {
		this.log.info("renderer initialized (stub)");
		this.loop.start();
	}

	render(): void {
		/* babylonScene.render() */
	}

	dispose(): void {
		this.scene = null;
		super.dispose();
	}
}

// ═══════════════════════════════════════════════════════════════
// EDITOR LAYER
// ═══════════════════════════════════════════════════════════════

interface Command {
	readonly label: string;
	execute(): void;
	undo(): void;
	redo?(): void;
}

class CommandStack extends Disposable {
	private undoStack: Command[] = [];
	private redoStack: Command[] = [];
	private maxSize = 200;
	private log = new Logger("CommandStack");

	readonly bus = new EventBus<{ changed: void }>();

	execute(cmd: Command): void {
		cmd.execute();
		this.undoStack.push(cmd);
		if (this.undoStack.length > this.maxSize) this.undoStack.shift();
		this.redoStack.length = 0;
		this.bus.emit("changed", undefined);
		this.log.debug("executed", cmd.label);
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
		(cmd.redo ?? cmd.execute).call(cmd);
		this.undoStack.push(cmd);
		this.bus.emit("changed", undefined);
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}
	canRedo(): boolean {
		return this.redoStack.length > 0;
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

class Selection extends Disposable {
	private selected = new Set<string>();
	readonly bus = new EventBus<{ changed: string[] }>();

	get ids(): string[] {
		return [...this.selected];
	}
	get count(): number {
		return this.selected.size;
	}
	has(id: string): boolean {
		return this.selected.has(id);
	}

	set(ids: string[]): void {
		this.selected = new Set(ids);
		this.bus.emit("changed", this.ids);
	}
	add(id: string): void {
		this.selected.add(id);
		this.bus.emit("changed", this.ids);
	}
	remove(id: string): void {
		this.selected.delete(id);
		this.bus.emit("changed", this.ids);
	}
	toggle(id: string): void {
		if (this.selected.has(id)) this.selected.delete(id);
		else this.selected.add(id);
		this.bus.emit("changed", this.ids);
	}
	clear(): void {
		this.selected.clear();
		this.bus.emit("changed", this.ids);
	}
	dispose(): void {
		this.clear();
		super.dispose();
	}
}

class EditorContext extends Disposable {
	scene: Scene;
	readonly commands = new CommandStack();
	readonly selection = new Selection();
	readonly renderer = new Renderer();
	private log = new Logger("EditorContext");

	readonly bus = new EventBus<{
		"scene:loaded": Scene;
		"scene:saved": void;
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
		this.register(this.renderer);
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
		this.log.info("scene loaded", scene.name);
	}

	async saveScene(): Promise<void> {
		this.markDirty(false);
		this.bus.emit("scene:saved", undefined);
	}
}

// ─── Commands ──────────────────────────────────────────────────
class AddNodeCommand implements Command {
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

class DeleteNodeCommand implements Command {
	readonly label: string;
	private parent: Node | null;
	constructor(
		private scene: Scene,
		private node: Node,
	) {
		this.label = `Delete ${node.name}`;
		this.parent = node.parent;
	}
	execute(): void {
		this.scene.removeNode(this.node);
	}
	undo(): void {
		if (this.parent) this.scene.addNode(this.node, this.parent);
	}
}

class SetPropertyCommand<T> implements Command {
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

// ═══════════════════════════════════════════════════════════════
// VS CODE INTEGRATION
// ═══════════════════════════════════════════════════════════════

const log = new Logger("Extension");

export function activate(context: vscode.ExtensionContext): void {
	log.info("Weaver activating...");
	Logger.setLevel(LogLevel.Debug);

	const editor = new EditorContext();
	context.subscriptions.push({ dispose: () => editor.dispose() });

	context.subscriptions.push(vscode.window.registerCustomEditorProvider("weaver.viewport", new WeaverViewportProvider(context, editor), { webviewOptions: { retainContextWhenHidden: true } }));

	context.subscriptions.push(vscode.window.registerWebviewViewProvider("weaver.inspector", new InspectorProvider(context, editor)));

	context.subscriptions.push(
		vscode.commands.registerCommand("weaver.newScene", async () => {
			const name = await vscode.window.showInputBox({
				prompt: "Scene name",
				placeHolder: "My Awesome Level",
				value: "New Scene",
				validateInput: (v) => (v.trim().length === 0 ? "Name cannot be empty" : null),
			});

			if (name === undefined) return;

			const safeName = name.trim().replace(/\s+/g, "-").toLowerCase();
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder.uri, `${safeName}.weave.json`) : vscode.Uri.file(`${safeName}.weave.json`);

			const uri = await vscode.window.showSaveDialog({
				filters: { "Weaver Scene": ["weave.json"] },
				saveLabel: "Create Scene",
				defaultUri,
			});

			if (uri === undefined) return;

			const scene = SceneFactory.createDefaultScene(name.trim());
			const json = Serializer.serialize(scene);

			await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
			await vscode.commands.executeCommand("vscode.openWith", uri, "weaver.viewport");
			editor.loadScene(scene);
		}),
		vscode.commands.registerCommand("weaver.undo", () => editor.commands.undo()),
		vscode.commands.registerCommand("weaver.redo", () => editor.commands.redo()),
		vscode.commands.registerCommand("weaver.saveScene", async () => {
			await editor.saveScene();
			vscode.window.showInformationMessage("Scene saved ✓");
		}),
	);

	log.info("Weaver activated ✓");
}

export function deactivate(): void {
	log.info("Weaver deactivated");
}

// ═══════════════════════════════════════════════════════════════
// VIEWPORT PROVIDER
// ═══════════════════════════════════════════════════════════════

class WeaverViewportProvider implements vscode.CustomTextEditorProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly editor: EditorContext,
	) {}

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		panel.webview.html = this.getHtml(panel.webview);

		const update = () => {
			try {
				const scene = Serializer.deserialize(document.getText());
				this.editor.loadScene(scene);
				panel.webview.postMessage({
					type: "scene:update",
					payload: scene.toJSON(),
				});
			} catch (err) {
				log.error("deserialize failed", err);
			}
		};

		const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() === document.uri.toString()) update();
		});
		panel.onDidDispose(() => changeSub.dispose());

		let initialSent = false;
		panel.webview.onDidReceiveMessage(async (msg) => {
			if (msg.type === "scene:save") {
				const json = JSON.stringify(msg.payload, null, 2);
				const edit = new vscode.WorkspaceEdit();
				edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), json);
				await vscode.workspace.applyEdit(edit);
			} else if (msg.type === "select") {
				this.editor.selection.set(msg.ids ?? []);
			} else if (msg.type === "ready") {
				if (!initialSent) {
					initialSent = true;
					update();
				}
			}
		});
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = Math.random().toString(36).slice(2);
		return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
           style-src ${webview.cspSource} 'unsafe-inline';
           script-src 'nonce-${nonce}' https://cdn.babylonjs.com 'unsafe-eval';
           connect-src https://cdn.babylonjs.com;
           worker-src blob:;" />
<style>
  html, body { width:100%; height:100%; margin:0; padding:0; overflow:hidden; background:#0D1117; }
  #renderCanvas { width:100%; height:100%; display:block; outline:none; touch-action:none; }
  #hud {
    position:absolute; top:8px; left:8px; color:#A78BFA;
    font:12px/1.6 monospace; pointer-events:none;
    background:rgba(13,17,23,.6); padding:6px 10px; border-radius:4px;
    z-index:10;
  }
  #loading {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    color:#A78BFA; font:14px monospace; z-index:5;
  }
</style>
</head>
<body>
<div id="hud">Weaver Viewport</div>
<div id="loading">Loading Babylon…</div>
<canvas id="renderCanvas"></canvas>

<script nonce="${nonce}" src="https://cdn.babylonjs.com/babylon.js"></script>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const canvas = document.getElementById('renderCanvas');
  const hud = document.getElementById('hud');
  const loading = document.getElementById('loading');

  let engine, scene, camera;
  let sceneData = null;
  const nodeIdToMesh = new Map();

  function initBabylon() {
    console.log('[Weaver] initBabylon called');
    if (typeof BABYLON === 'undefined') {
      loading.textContent = 'Failed to load Babylon (offline?)';
      console.error('[Weaver] BABYLON is undefined');
      return;
    }
    loading.remove();

    canvas.width = canvas.clientWidth || 800;
    canvas.height = canvas.clientHeight || 600;
    console.log('[Weaver] canvas size', canvas.width, canvas.height);

    engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.07, 0.09, 1);

    camera = new BABYLON.ArcRotateCamera(
      'editorCam',
      -Math.PI / 2,
      Math.PI / 3,
      12,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    camera.wheelDeltaPercentage = 0.02;
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 500;
    camera.target = BABYLON.Vector3.Zero();
    camera.setPosition(new BABYLON.Vector3(6, 6, -6));

    scene.onPointerObservable.add((pi) => {
      if (pi.type === BABYLON.PointerEventTypes.POINTERPICK) {
        const picked = pi.pickInfo?.pickedMesh;
        const nodeId = picked?.metadata?.nodeId;
        vscode.postMessage({ type: 'select', ids: nodeId ? [nodeId] : [] });
      }
    });

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());
    setTimeout(() => engine.resize(), 100);

    console.log('[Weaver] Babylon ready');
    vscode.postMessage({ type: 'ready' });
  }

  function buildNode(nodeData, parentMesh) {
    const meshComp = (nodeData.components || []).find(c => c.type === 'mesh');
    const lightComp = (nodeData.components || []).find(c => c.type === 'light');
    const camComp = (nodeData.components || []).find(c => c.type === 'camera');

    let node = null;

    if (meshComp) {
      switch (meshComp.geometry) {
        case 'box': node = BABYLON.MeshBuilder.CreateBox(nodeData.id, { size: 1 }, scene); break;
        case 'sphere': node = BABYLON.MeshBuilder.CreateSphere(nodeData.id, { diameter: 1 }, scene); break;
        case 'plane': node = BABYLON.MeshBuilder.CreatePlane(nodeData.id, { size: 1 }, scene); break;
        case 'cylinder': node = BABYLON.MeshBuilder.CreateCylinder(nodeData.id, { height: 1, diameter: 1 }, scene); break;
        case 'torus': node = BABYLON.MeshBuilder.CreateTorus(nodeData.id, { diameter: 1, thickness: 0.3 }, scene); break;
        default: node = BABYLON.MeshBuilder.CreateBox(nodeData.id, { size: 1 }, scene);
      }
      const mat = new BABYLON.StandardMaterial(nodeData.id + '_mat', scene);
      try {
        mat.diffuseColor = BABYLON.Color3.FromHexString(meshComp.material.color || '#6B46C1');
      } catch {
        mat.diffuseColor = new BABYLON.Color3(0.42, 0.27, 0.76);
      }
      node.material = mat;
      node.metadata = { nodeId: nodeData.id };
      nodeIdToMesh.set(nodeData.id, node);
    } else if (lightComp) {
      node = new BABYLON.TransformNode(nodeData.id, scene);
      if (lightComp.lightType === 'hemispheric') {
        const l = new BABYLON.HemisphericLight(nodeData.id + '_l', BABYLON.Vector3.Up(), scene);
        l.intensity = lightComp.intensity ?? 1;
      } else if (lightComp.lightType === 'directional') {
        const l = new BABYLON.DirectionalLight(nodeData.id + '_l', new BABYLON.Vector3(-1, -1, -1), scene);
        l.intensity = lightComp.intensity ?? 1;
      } else if (lightComp.lightType === 'point') {
        const l = new BABYLON.PointLight(nodeData.id + '_l', BABYLON.Vector3.Zero(), scene);
        l.intensity = lightComp.intensity ?? 1;
      }
      nodeIdToMesh.set(nodeData.id, node);
    } else {
      node = new BABYLON.TransformNode(nodeData.id, scene);
      nodeIdToMesh.set(nodeData.id, node);
    }

    const t = nodeData.transform;
    if (t) {
      node.position.set(t.position.x, t.position.y, t.position.z);
      node.rotationQuaternion = new BABYLON.Quaternion(
        t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w,
      );
      node.scaling.set(t.scale.x, t.scale.y, t.scale.z);
    }

    if (parentMesh && node) node.parent = parentMesh;
    for (const child of nodeData.children ?? []) buildNode(child, node);
  }

  function rebuildScene(data) {
    if (!scene) return;
    for (const [, obj] of nodeIdToMesh) obj.dispose();
    nodeIdToMesh.clear();
    for (const child of data.root.children ?? []) buildNode(child, null);
    hud.textContent = 'Weaver Viewport — ' + data.name;
    console.log('[Weaver] scene rebuilt', data.name);
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    console.log('[Weaver] message', msg.type);
    if (msg.type === 'scene:update') {
      sceneData = msg.payload;
      if (scene) rebuildScene(sceneData);
      else setTimeout(() => { if (scene) rebuildScene(sceneData); }, 300);
    }
  });

  window.addEventListener('load', initBabylon);
</script>
</body>
</html>`;
	}
}

// ═══════════════════════════════════════════════════════════════
// INSPECTOR PROVIDER
// ═══════════════════════════════════════════════════════════════

class InspectorProvider implements vscode.WebviewViewProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly editor: EditorContext,
	) {}

	resolveWebviewView(view: vscode.WebviewView): void {
		view.webview.options = { enableScripts: true };
		view.webview.html = this.getHtml();

		this.editor.selection.bus.on("changed", (ids) => {
			const id = ids[0];
			const node = id ? this.editor.scene.findNode(id) : null;
			view.webview.postMessage({
				type: "inspect",
				payload: node
					? {
							id: node.id,
							name: node.name,
							enabled: node.enabled,
							transform: node.transform.toJSON(),
							components: node.components,
						}
					: null,
			});
		});

		view.webview.onDidReceiveMessage((msg) => {
			if (msg.type === "update:transform") {
				const node = this.editor.scene.findNode(msg.nodeId);
				if (!node) return;
				const { axis, channel, value } = msg;
				const target = node.transform[channel as "position" | "rotation" | "scale"] as any;
				const cmd = new SetPropertyCommand<number>(target, axis, value, `Set ${channel}.${axis}`);
				this.editor.commands.execute(cmd);
				this.editor.bus.emit("scene:mutated", undefined);
			}
		});
	}

	private getHtml(): string {
		const nonce = Math.random().toString(36).slice(2);
		return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"/>
<style>
  body { color:#ccc; font:12px/1.5 monospace; padding:10px; background:#0D1117; margin:0; }
  .empty { opacity:.5; text-align:center; padding:20px 0; }
  h3 { color:#A78BFA; margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:1px; }
  .section { margin-bottom:14px; }
  .row { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
  .row label { width:60px; color:#888; }
  input[type=number] {
    flex:1; background:#161B22; border:1px solid #30363D; color:#ccc;
    padding:3px 6px; border-radius:3px; font-family:inherit; font-size:12px;
  }
  input[type=number]:focus { outline:none; border-color:#6B46C1; }
  .axis-x { color:#ff6b6b; }
  .axis-y { color:#6bff8f; }
  .axis-z { color:#6b9cff; }
  .comp { padding:4px 6px; background:#161B22; border-radius:3px; margin-bottom:4px; color:#A78BFA; }
</style>
</head>
<body>
<div id="root"><div class="empty">No selection</div></div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  let current = null;

  function numInput(axis, channel, value) {
    return '<input type="number" step="0.1" data-channel="' + channel + '" data-axis="' + axis + '" value="' + (value ?? 0) + '"/>';
  }

  function render(payload) {
    const root = document.getElementById('root');
    if (!payload) {
      root.innerHTML = '<div class="empty">No selection</div>';
      current = null;
      return;
    }
    current = payload;
    const t = payload.transform;
    root.innerHTML =
      '<div class="section"><h3>' + payload.name + '</h3></div>' +
      '<div class="section"><h3>Transform</h3>' +
        '<div class="row"><label class="axis-x">Pos X</label>' + numInput('x','position',t.position.x) + '</div>' +
        '<div class="row"><label class="axis-y">Pos Y</label>' + numInput('y','position',t.position.y) + '</div>' +
        '<div class="row"><label class="axis-z">Pos Z</label>' + numInput('z','position',t.position.z) + '</div>' +
        '<div class="row"><label class="axis-x">Scl X</label>' + numInput('x','scale',t.scale.x) + '</div>' +
        '<div class="row"><label class="axis-y">Scl Y</label>' + numInput('y','scale',t.scale.y) + '</div>' +
        '<div class="row"><label class="axis-z">Scl Z</label>' + numInput('z','scale',t.scale.z) + '</div>' +
      '</div>' +
      '<div class="section"><h3>Components</h3>' +
        payload.components.map(c => '<div class="comp">' + c.type + '</div>').join('') +
      '</div>';

    root.querySelectorAll('input[type=number]').forEach(input => {
      input.addEventListener('change', (e) => {
        const channel = e.target.dataset.channel;
        const axis = e.target.dataset.axis;
        const value = parseFloat(e.target.value) || 0;
        vscode.postMessage({
          type: 'update:transform',
          nodeId: current.id,
          channel, axis, value,
        });
      });
    });
  }

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'inspect') render(msg.payload);
  });
</script>
</body>
</html>`;
	}
}
