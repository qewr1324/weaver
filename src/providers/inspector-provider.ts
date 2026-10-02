// src/providers/inspector-provider.ts
import * as vscode from "vscode";
import { RenameNodeCommand } from "../editor/commands";
import type { EditorContext } from "../editor/editor-context";
import { loadWebviewHtml } from "./html-loader";
import { Logger } from "../core/logger";

const inspLog = new Logger("Inspector");

export class InspectorProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | null = null;
	private subs: Array<() => void> = [];

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

		const pushInspect = () => {
			const id = this.editor.selection.primary;
			const node = id ? this.editor.scene.findNode(id) : null;
			const ids = this.editor.selection.ids;
			inspLog.debug("pushInspect", { id, hasNode: !!node });
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
				multi: ids.length > 1,
				count: ids.length,
				names: ids.map((i) => this.editor.scene.findNode(i)?.name).filter((n): n is string => !!n),
			});
		};

		this.subs.push(this.editor.selection.bus.on("changed", pushInspect));
		this.subs.push(this.editor.selection.bus.on("primaryChanged", pushInspect));
		this.subs.push(this.editor.bus.on("scene:loaded", pushInspect));
		this.subs.push(this.editor.bus.on("scene:mutated", pushInspect));

		// ⭐ به جای this.editor.scene.bus، از eventbus editor استفاده کن
		// که مستقل از document عوض شدن کار می‌کنه
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

		// هر بار scene:loaded → listener رو دوباره attach کن
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
					this.editor.setNodeTransformAxis(node, msg.channel, msg.axis, msg.value, "inspector", msg.live === true);
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
