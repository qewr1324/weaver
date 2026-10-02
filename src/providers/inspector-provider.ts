// src/providers/inspector-provider.ts
import * as vscode from "vscode";
import { RenameNodeCommand, SetWholeTransformCommand, type TransformSnapshot } from "../editor/commands";
import type { EditorContext } from "../editor/editor-context";
import { loadWebviewHtml } from "./html-loader";
import { Logger } from "../core/logger";

const inspLog = new Logger("Inspector");

const PUSH_THROTTLE_MS = 100;

export class InspectorProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | null = null;
	private subs: Array<() => void> = [];

	private pushTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingPush = false;

	// ✨ ذخیره‌ی before برای transform undo/redo
	private pendingBefore: TransformSnapshot | null = null;
	private pendingNodeId: string | null = null;
	private pendingChannel: "position" | "rotation" | "scale" | null = null;
	private pendingAxis: "x" | "y" | "z" | "w" | null = null;
	private commitTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly editor: EditorContext,
	) {}

	resolveWebviewView(view: vscode.WebviewView): void {
		inspLog.info("resolveWebviewView called");
		this.view = view;
		this.disposeSubs();

		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		view.webview.html = loadWebviewHtml(this.context, view.webview, "inspector");

		const doPush = () => {
			if (!this.view) return;
			const id = this.editor.selection.primary;
			const node = id ? this.editor.scene.findNode(id) : null;
			const ids = this.editor.selection.ids;

			inspLog.debug("pushInspect", { id, hasNode: !!node, count: ids.length });

			this.view.webview.postMessage({
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
				multi: ids.length > 1,
				count: ids.length,
				names: ids.map((i) => this.editor.scene.findNode(i)?.name).filter((n): n is string => !!n),
			});
		};

		const pushInspect = () => {
			if (this.pushTimer) {
				this.pendingPush = true;
				return;
			}

			doPush();

			this.pushTimer = setTimeout(() => {
				this.pushTimer = null;
				if (this.pendingPush) {
					this.pendingPush = false;
					pushInspect();
				}
			}, PUSH_THROTTLE_MS);
		};

		// ✨ commit pending transform به command stack
		const commitPending = async () => {
			if (this.commitTimer) {
				clearTimeout(this.commitTimer);
				this.commitTimer = null;
			}

			if (!this.pendingBefore || !this.pendingNodeId) return;

			const node = this.editor.scene.findNode(this.pendingNodeId);
			const before = this.pendingBefore;

			this.pendingBefore = null;
			this.pendingNodeId = null;
			this.pendingChannel = null;
			this.pendingAxis = null;

			if (!node) return;

			// after = مقدار فعلی node
			const after: TransformSnapshot = {
				position: { ...node.transform.position },
				rotation: { ...node.transform.rotation },
				scale: { ...node.transform.scale },
			};

			// ✅ حالا command بساز
			const cmd = new SetWholeTransformCommand(
				node,
				after,
				(n) => this.editor.setNodeTransform(n, n.transform.toJSON(), "undo", false),
				before, // ✨ explicitBefore
			);

			await this.editor.commands.execute(cmd);
			inspLog.debug("transform command committed", { nodeId: node.id });
		};

		this.subs.push(this.editor.selection.bus.on("changed", pushInspect));
		this.subs.push(this.editor.selection.bus.on("primaryChanged", pushInspect));
		this.subs.push(this.editor.bus.on("scene:loaded", pushInspect));
		this.subs.push(this.editor.bus.on("scene:mutated", pushInspect));

		const attachTransformListener = () => {
			const scene = this.editor.scene;
			inspLog.debug("attaching transform listener to scene", scene.name);
			const unsub = scene.bus.on("transform:changed", (payload) => {
				inspLog.debug("transform:changed", {
					nodeId: payload.nodeId,
					source: payload.source,
					live: payload.live,
					primary: this.editor.selection.primary,
				});
				if (payload.nodeId !== this.editor.selection.primary) return;
				if (payload.source === "inspector") return;
				pushInspect();
			});
			this.subs.push(unsub);
		};
		attachTransformListener();

		this.subs.push(
			this.editor.bus.on("scene:loaded", () => {
				inspLog.debug("scene:loaded → reattach transform listener");
				attachTransformListener();
				pushInspect();
			}),
		);

		this.subs.push(this.editor.bus.on("rename:changed", pushInspect));

		view.webview.onDidReceiveMessage(async (msg) => {
			inspLog.debug("msg from inspector", msg.type);
			switch (msg.type) {
				case "update:transform": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					if (typeof msg.value !== "number" || !Number.isFinite(msg.value)) return;

					// ✅ اگه pending نداشتیم، before رو ذخیره کن
					if (!this.pendingBefore || this.pendingNodeId !== msg.nodeId) {
						this.pendingBefore = {
							position: { ...node.transform.position },
							rotation: { ...node.transform.rotation },
							scale: { ...node.transform.scale },
						};
						this.pendingNodeId = msg.nodeId;
					}

					this.pendingChannel = msg.channel;
					this.pendingAxis = msg.axis;

					// ✅ مقدار جدید رو اعمال کن
					this.editor.setNodeTransformAxis(
						node,
						msg.channel,
						msg.axis,
						msg.value,
						"inspector",
						true, // ✅ همیشه live — command بعداً ساخته میشه
					);

					// ✅ timer برای commit
					if (this.commitTimer) clearTimeout(this.commitTimer);
					this.commitTimer = setTimeout(() => {
						void commitPending();
					}, 600); // ۶۰۰ms بعد از آخرین تغییر commit کن

					// ✅ اگه non-live اومد، فوری commit کن
					if (msg.live !== true) {
						await commitPending();
					}
					break;
				}

				case "update:property": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					const comp = node.components.find((c) => msg.prop in c);
					if (!comp) return;
					(comp as any)[msg.prop] = msg.value;
					this.editor.bus.emit("scene:mutated", undefined);
					break;
				}

				case "rename": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					await this.editor.commands.execute(new RenameNodeCommand(node, msg.name, (n) => this.editor.notifyRenamed(n)));
					break;
				}

				case "toggle:enabled": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					node.enabled = !node.enabled;
					this.editor.bus.emit("scene:mutated", undefined);
					pushInspect();
					break;
				}
			}
		});

		view.onDidDispose(() => {
			inspLog.info("webview disposed");
			this.disposeSubs();
			this.view = null;
			if (this.pushTimer) {
				clearTimeout(this.pushTimer);
				this.pushTimer = null;
			}
			if (this.commitTimer) {
				clearTimeout(this.commitTimer);
				this.commitTimer = null;
			}
			this.pendingPush = false;
			this.pendingBefore = null;
			this.pendingNodeId = null;
			this.pendingChannel = null;
			this.pendingAxis = null;
		});

		pushInspect();
	}

	private disposeSubs(): void {
		for (const un of this.subs) {
			try {
				un();
			} catch {
				/* ignore */
			}
		}
		this.subs = [];
	}
}
