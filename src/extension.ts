// src/extension.ts — Weaver Engine (single file)
import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";

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
// CONFIG LAYER
// ═══════════════════════════════════════════════════════════════

interface WeaverConfig {
	version: string;
	toolbar: {
		addObjects: Array<{ id: string; label: string; icon: string; geometry: string }>;
		transformModes: Array<{ id: string; label: string; icon: string; key?: string }>;
		referenceModes: Array<{ id: string; label: string; icon: string }>;
		shaderModes: Array<{ id: string; label: string; icon: string }>;
		snap: {
			grid: { default: boolean; size: number; sizes: number[] };
			object: { default: boolean; threshold: number };
		};
	};
	gizmo: { scaleRatio: number; alwaysOnTop: boolean; snapDistance: number };
	camera: { baseSpeed: number; baseLookSpeed: number; sprintMult: number; slowMult: number };
	highlights: {
		hover: { r: number; g: number; b: number };
		selected: { r: number; g: number; b: number };
	};
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
			lightType: "directional",
			intensity: 1.2,
			color: "#fff5e0",
		});
		light.transform.position = vec3(4, 8, -4);
		scene.addNode(light);

		const cube = new Node("Cube");
		cube.addComponent({
			id: nextComponentId(),
			type: "mesh",
			geometry: "box",
			material: { color: "#6B46C1", metallic: 0.2, roughness: 0.6 },
		});
		scene.addNode(cube);

		const sphere = new Node("Sphere");
		sphere.addComponent({
			id: nextComponentId(),
			type: "mesh",
			geometry: "sphere",
			material: { color: "#3B82F6", metallic: 0.1, roughness: 0.4 },
		});
		sphere.transform.position = vec3(3, 1, 0);
		scene.addNode(sphere);

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
// HTML LOADER  (external .html files + nonce/csp substitution)
// ═══════════════════════════════════════════════════════════════

function loadWebviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview, fileName: "viewport.html" | "inspector.html"): string {
	const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
	const uri = vscode.Uri.joinPath(context.extensionUri, "src", "webview", fileName);
	let html: string;
	try {
		html = fs.readFileSync(uri.fsPath, "utf8");
	} catch (err) {
		return `<!DOCTYPE html><html><body style="color:#f66;font-family:monospace;padding:20px">
      Failed to load ${fileName}: ${String(err)}
    </body></html>`;
	}
	return html.replace(/\{\{nonce\}\}/g, nonce).replace(/\{\{cspSource\}\}/g, webview.cspSource);
}

function loadWeaverConfig(context: vscode.ExtensionContext): WeaverConfig | null {
	const uri = vscode.Uri.joinPath(context.extensionUri, "src", "webview", "weaver.config.json");
	try {
		const raw = fs.readFileSync(uri.fsPath, "utf8");
		const cfg = JSON.parse(raw) as WeaverConfig;
		log.info("weaver config loaded v" + cfg.version);
		return cfg;
	} catch (err) {
		log.error("failed to load weaver.config.json", err);
		return null;
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
	const config = loadWeaverConfig(context);

	context.subscriptions.push({ dispose: () => editor.dispose() });

	context.subscriptions.push(vscode.window.registerCustomEditorProvider("weaver.viewport", new WeaverViewportProvider(context, editor, config), { webviewOptions: { retainContextWhenHidden: true } }));

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
		private readonly config: WeaverConfig | null,
	) {}

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		panel.webview.html = loadWebviewHtml(this.context, panel.webview, "viewport.html");

		// ─── Config رو اول بفرست ───
		if (this.config) {
			panel.webview.postMessage({ type: "config", payload: this.config });
		}

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
		const selSub = this.editor.selection.bus.on("changed", (ids) => {
			panel.webview.postMessage({ type: "selection:update", ids });
		});
		panel.onDidDispose(() => {
			changeSub.dispose();
			selSub();
		});

		let initialSent = false;
		panel.webview.onDidReceiveMessage(async (msg) => {
			if (msg.type === "scene:save") {
				const json = JSON.stringify(msg.payload, null, 2);
				const edit = new vscode.WorkspaceEdit();
				edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), json);
				await vscode.workspace.applyEdit(edit);
			} else if (msg.type === "select") {
				this.editor.selection.set(msg.ids ?? []);
			} else if (msg.type === "add:node") {
				await this.handleAddNode(document, msg.payload);
			} else if (msg.type === "update:transform") {
				this.handleTransformUpdate(msg);
			} else if (msg.type === "ready") {
				if (!initialSent) {
					initialSent = true;
					update();
				}
			}
		});
	}

	// ─── اضافه کردن Node جدید ───
	private async handleAddNode(document: vscode.TextDocument, data: any): Promise<void> {
		try {
			const newNode = new Node(data.name);
			if (data.transform) {
				newNode.transform.position = { ...data.transform.position };
				newNode.transform.rotation = { ...data.transform.rotation };
				newNode.transform.scale = { ...data.transform.scale };
			}
			for (const c of data.components ?? []) {
				const { id: _ignore, ...rest } = c;
				newNode.addComponent({ id: nextComponentId(), ...rest } as Component);
			}

			// اضافه به scene داخلی
			const cmd = new AddNodeCommand(this.editor.scene, newNode);
			this.editor.commands.execute(cmd);

			// آپدیت فایل
			const updatedJson = Serializer.serialize(this.editor.scene);
			const edit = new vscode.WorkspaceEdit();
			edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), updatedJson);
			await vscode.workspace.applyEdit(edit);

			// انتخابش کن
			this.editor.selection.set([newNode.id]);
			log.info("added node", newNode.name, newNode.id);
		} catch (err) {
			log.error("handleAddNode failed", err);
		}
	}

	// ─── آپدیت transform (از Gizmo drag) ───
	private handleTransformUpdate(msg: any): void {
		try {
			const node = this.editor.scene.findNode(msg.nodeId);
			if (!node) return;
			const { axis, channel, value } = msg;
			const target = node.transform[channel as "position" | "rotation" | "scale"] as any;
			if (target && typeof value === "number") {
				target[axis] = value;
				this.editor.markDirty(true);
			}
		} catch (err) {
			log.error("handleTransformUpdate failed", err);
		}
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
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		view.webview.html = loadWebviewHtml(this.context, view.webview, "inspector.html");

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
}
