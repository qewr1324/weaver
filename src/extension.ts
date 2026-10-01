// src/extension.ts — Weaver Engine (single file)
import * as vscode from "vscode";
import * as fs from "node:fs";

// ═══════════════════════════════════════════════════════════════
// CORE LAYER
// ═══════════════════════════════════════════════════════════════

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

const log = new Logger("Extension");

// ═══════════════════════════════════════════════════════════════
// CONFIG LAYER — single source of truth (global + scene override)
// ═══════════════════════════════════════════════════════════════

interface WeaverConfig {
	version: string;
	toolbar: {
		enabled: {
			addObjects: boolean;
			transformModes: boolean;
			referenceModes: boolean;
			shaderModes: boolean;
			snap: boolean;
		};
		addObjects: Array<{ id: string; label: string; icon: string; geometry: string }>;
		transformModes: Array<{ id: string; label: string; icon: string; key?: string }>;
		referenceModes: Array<{ id: string; label: string; icon: string }>;
		shaderModes: Array<{ id: string; label: string; icon: string }>;
		transformMode?: "move" | "rotate" | "scale";
		referenceMode?: "world" | "object";
		shaderMode?: "solid" | "wireframe" | "both";
		snap: {
			grid: { default: boolean; size: number; sizes: number[] };
			object: { default: boolean; threshold: number };
		};
		snapGrid?: boolean;
		snapGridSize?: number;
		snapObject?: boolean;
	};
	camera: {
		fov: number;
		minZ: number;
		maxZ: number;
		baseSpeed: number;
		baseLookSpeed: number;
		sprintMult: number;
		slowMult: number;
	};
	highlights: {
		hover: { r: number; g: number; b: number };
		selected: { r: number; g: number; b: number };
	};
	gizmo: {
		scaleRatio: number;
		alwaysOnTop: boolean;
		snapDistance: number;
	};
	scene: {
		clearColor: { r: number; g: number; b: number; a: number };
		grid: {
			enabled: boolean;
			size: number;
			majorUnit: number;
			minorVisibility: number;
			mainColor: { r: number; g: number; b: number };
			lineColor: { r: number; g: number; b: number };
		};
		lights: {
			sun: { intensity: number; direction: { x: number; y: number; z: number } };
			ambient: { intensity: number };
		};
	};
	defaults: {
		meshMaterial: { color: string; metallic: number; roughness: number };
		nodeName: string;
		sceneName: string;
	};
}

// ─── deep merge ────────────────────────────────────────────────
function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: unknown): T {
	if (!isPlainObject(base) || !isPlainObject(override)) {
		return (override === undefined ? base : override) as T;
	}
	const out: Record<string, unknown> = { ...base };
	for (const key of Object.keys(override)) {
		const b = (base as Record<string, unknown>)[key];
		const o = (override as Record<string, unknown>)[key];
		if (isPlainObject(b) && isPlainObject(o)) {
			out[key] = deepMerge(b, o);
		} else if (o !== undefined) {
			out[key] = o;
		}
	}
	return out as T;
}

// ─── default global config ─────────────────────────────────────
function createDefaultGlobalConfig(): WeaverConfig {
	return {
		version: "1.0.0",
		toolbar: {
			enabled: {
				addObjects: true,
				transformModes: true,
				referenceModes: true,
				shaderModes: true,
				snap: true,
			},
			addObjects: [
				{ id: "box", label: "Box", icon: "▣", geometry: "box" },
				{ id: "sphere", label: "Sphere", icon: "●", geometry: "sphere" },
				{ id: "plane", label: "Plane", icon: "▭", geometry: "plane" },
				{ id: "cylinder", label: "Cylinder", icon: "▮", geometry: "cylinder" },
				{ id: "torus", label: "Torus", icon: "◯", geometry: "torus" },
			],
			transformModes: [
				{ id: "move", label: "Move", icon: "✥", key: "KeyG" },
				{ id: "rotate", label: "Rotate", icon: "↻", key: "KeyR" },
				{ id: "scale", label: "Scale", icon: "⤢", key: "KeyT" },
			],
			referenceModes: [
				{ id: "world", label: "World", icon: "🌐" },
				{ id: "object", label: "Object", icon: "📦" },
			],
			shaderModes: [
				{ id: "solid", label: "Solid", icon: "■" },
				{ id: "wireframe", label: "Wireframe", icon: "▦" },
				{ id: "both", label: "Both", icon: "◨" },
			],
			transformMode: "move",
			referenceMode: "world",
			shaderMode: "solid",
			snap: {
				grid: { default: false, size: 0.5, sizes: [0.1, 0.25, 0.5, 1.0] },
				object: { default: false, threshold: 0.3 },
			},
			snapGrid: false,
			snapGridSize: 0.5,
			snapObject: false,
		},
		camera: {
			fov: 0.9,
			minZ: 0.05,
			maxZ: 5000,
			baseSpeed: 0.35,
			baseLookSpeed: 1.8,
			sprintMult: 4,
			slowMult: 0.25,
		},
		highlights: {
			hover: { r: 0.4, g: 0.75, b: 1.0 },
			selected: { r: 1.0, g: 0.6, b: 0.15 },
		},
		gizmo: {
			scaleRatio: 1.0,
			alwaysOnTop: true,
			snapDistance: 0.1,
		},
		scene: {
			clearColor: { r: 0.15, g: 0.18, b: 0.24, a: 1 },
			grid: {
				enabled: true,
				size: 100,
				majorUnit: 10,
				minorVisibility: 0.35,
				mainColor: { r: 0.3, g: 0.33, b: 0.4 },
				lineColor: { r: 0.5, g: 0.52, b: 0.6 },
			},
			lights: {
				sun: { intensity: 1.2, direction: { x: -0.5, y: -1, z: -0.3 } },
				ambient: { intensity: 0.8 },
			},
		},
		defaults: {
			meshMaterial: { color: "#6B46C1", metallic: 0.2, roughness: 0.6 },
			nodeName: "Node",
			sceneName: "Untitled Scene",
		},
	};
}

// ─── global config (توی پوشه کاربر) ────────────────────────────
const CONFIG_FILENAME = "weaver.config.json";
let GLOBAL_CONFIG: WeaverConfig | null = null;

function getGlobalConfigUri(context: vscode.ExtensionContext): vscode.Uri {
	return vscode.Uri.joinPath(context.globalStorageUri, CONFIG_FILENAME);
}

async function ensureGlobalConfig(context: vscode.ExtensionContext): Promise<WeaverConfig> {
	const uri = getGlobalConfigUri(context);

	try {
		await vscode.workspace.fs.createDirectory(context.globalStorageUri);
	} catch {
		/* ignore */
	}

	try {
		const raw = await vscode.workspace.fs.readFile(uri);
		const parsed = JSON.parse(new TextDecoder().decode(raw)) as WeaverConfig;
		log.info("global config loaded from " + uri.fsPath);
		return parsed;
	} catch {
		log.info("global config not found — creating default at " + uri.fsPath);
		const defaultCfg = createDefaultGlobalConfig();
		await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(defaultCfg, null, 2)));
		return defaultCfg;
	}
}

async function saveGlobalConfig(context: vscode.ExtensionContext, cfg: WeaverConfig): Promise<void> {
	const uri = getGlobalConfigUri(context);
	await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(cfg, null, 2)));
	log.info("global config saved to " + uri.fsPath);
}

// ═══════════════════════════════════════════════════════════════
// SCENE LAYER
// ═══════════════════════════════════════════════════════════════

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
	config?: Partial<WeaverConfig>; // ← override های صحنه
	root: NodeData;
}

class Scene extends Disposable {
	readonly root: Node;
	name: string;
	config: Partial<WeaverConfig>; // ← فقط override ها، نه کل کانفیگ

	readonly bus = new EventBus<{
		"node:added": Node;
		"node:removed": Node;
		"node:changed": Node;
		"scene:changed": void;
	}>();

	constructor(name = "Untitled Scene", config: Partial<WeaverConfig> = {}) {
		super();
		this.name = name;
		this.config = config;
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

	// کانفیگ نهایی = global + scene override
	resolvedConfig(): WeaverConfig | null {
		if (!GLOBAL_CONFIG) return null;
		return deepMerge(GLOBAL_CONFIG, this.config);
	}

	toJSON(): SceneData {
		return {
			version: "1.0",
			name: this.name,
			config: this.config,
			root: this.root.toJSON(),
		};
	}

	static fromJSON(data: SceneData): Scene {
		const scene = new Scene(data.name, data.config ?? {});
		const root = Node.fromJSON(data.root);
		for (const child of root.children) scene.root.addChild(child);
		return scene;
	}
}

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
// EDITOR LAYER
// ═══════════════════════════════════════════════════════════════

interface Command {
	readonly label: string;
	execute(): void;
	undo(): void;
}

class CommandStack extends Disposable {
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

class Selection extends Disposable {
	private selected = new Set<string>();
	readonly bus = new EventBus<{ changed: string[] }>();
	get ids(): string[] {
		return [...this.selected];
	}
	set(ids: string[]): void {
		this.selected = new Set(ids);
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
// HTML LOADER
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

// ═══════════════════════════════════════════════════════════════
// VS CODE INTEGRATION
// ═══════════════════════════════════════════════════════════════

export function activate(context: vscode.ExtensionContext): void {
	log.info("Weaver activating...");
	Logger.setLevel(LogLevel.Debug);

	// ─── global config رو async لود کن ───
	ensureGlobalConfig(context).then((cfg) => {
		GLOBAL_CONFIG = cfg;
		log.info("global config ready: " + getGlobalConfigUri(context).fsPath);
	});

	const editor = new EditorContext();
	context.subscriptions.push({ dispose: () => editor.dispose() });

	// ─── providers ───
	context.subscriptions.push(vscode.window.registerCustomEditorProvider("weaver.viewport", new WeaverViewportProvider(context, editor), { webviewOptions: { retainContextWhenHidden: true } }));

	context.subscriptions.push(vscode.window.registerWebviewViewProvider("weaver.inspector", new InspectorProvider(context, editor)));

	// ─── commands ───
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

		// ─── config commands ───
		vscode.commands.registerCommand("weaver.openConfig", async () => {
			await ensureGlobalConfig(context);
			const uri = getGlobalConfigUri(context);
			await vscode.window.showTextDocument(uri);
		}),

		vscode.commands.registerCommand("weaver.resetConfig", async () => {
			const defaultCfg = createDefaultGlobalConfig();
			await saveGlobalConfig(context, defaultCfg);
			GLOBAL_CONFIG = defaultCfg;
			vscode.window.showInformationMessage("Weaver config reset to defaults ✓");
			vscode.commands.executeCommand("workbench.action.webview.reloadWebviewAction");
		}),

		vscode.commands.registerCommand("weaver.revealConfig", async () => {
			await ensureGlobalConfig(context);
			const uri = getGlobalConfigUri(context);
			await vscode.commands.executeCommand("revealFileInOS", uri);
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
		panel.webview.html = loadWebviewHtml(this.context, panel.webview, "viewport.html");

		const send = () => {
			try {
				const scene = Serializer.deserialize(document.getText());
				this.editor.loadScene(scene);

				// کانفیگ نهایی = global + scene override
				const resolved = scene.resolvedConfig();
				if (!resolved) {
					log.warn("global config not ready yet");
					return;
				}

				panel.webview.postMessage({
					type: "scene:update",
					payload: {
						...scene.toJSON(),
						config: resolved,
					},
				});
			} catch (err) {
				log.error("deserialize failed", err);
			}
		};

		const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() === document.uri.toString()) send();
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
			if (msg.type === "select") {
				this.editor.selection.set(msg.ids ?? []);
			} else if (msg.type === "add:node") {
				await this.handleAddNode(document, msg.payload);
			} else if (msg.type === "update:transform") {
				this.handleTransformUpdate(msg);
			} else if (msg.type === "config:update") {
				await this.handleConfigUpdate(document, msg.payload, panel);
			} else if (msg.type === "ready") {
				if (!initialSent) {
					initialSent = true;
					// اگه GLOBAL_CONFIG هنوز لود نشده، صبر کن
					if (!GLOBAL_CONFIG) {
						await ensureGlobalConfig(this.context).then((cfg) => {
							GLOBAL_CONFIG = cfg;
						});
					}
					send();
				}
			}
		});
	}

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

			this.editor.commands.execute(new AddNodeCommand(this.editor.scene, newNode));

			const updatedJson = Serializer.serialize(this.editor.scene);
			const edit = new vscode.WorkspaceEdit();
			edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), updatedJson);
			await vscode.workspace.applyEdit(edit);

			this.editor.selection.set([newNode.id]);
		} catch (err) {
			log.error("handleAddNode failed", err);
		}
	}

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

	// config صحنه رو ذخیره کن (فقط override ها، نه کل کانفیگ)
	private async handleConfigUpdate(document: vscode.TextDocument, payload: Partial<WeaverConfig>, panel: vscode.WebviewPanel): Promise<void> {
		try {
			this.editor.scene.config = payload;

			const updatedJson = JSON.stringify(
				{
					version: "1.0",
					name: this.editor.scene.name,
					config: this.editor.scene.config,
					root: this.editor.scene.root.toJSON(),
				},
				null,
				2,
			);

			const edit = new vscode.WorkspaceEdit();
			edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), updatedJson);
			await vscode.workspace.applyEdit(edit);

			// resolved config رو دوباره بفرست
			const resolved = this.editor.scene.resolvedConfig();
			if (resolved) {
				panel.webview.postMessage({
					type: "config:resolved",
					payload: resolved,
				});
			}
		} catch (err) {
			log.error("handleConfigUpdate failed", err);
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
