// src/providers/inspector-provider.ts
import * as vscode from "vscode";
import { RenameNodeCommand, SetTransformCommand } from "../editor/commands";
import type { EditorContext, TransformSyncPayload } from "../editor/editor-context";
import { loadWebviewHtml } from "./html-loader";

export class InspectorProvider implements vscode.WebviewViewProvider {
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

		let lastPushTime = 0;
		let pushTimer: ReturnType<typeof setTimeout> | null = null;

		// ─── ذخیره‌ی آخرین command برای coalesce undo ───
		// (وقتی کاربر داره تایپ می‌کنه، همه‌ی تغییرات یه undo بگیره)
		let liveSession: {
			nodeId: string;
			channel: string;
			axis: string;
			startValue: number;
			timer: ReturnType<typeof setTimeout> | null;
		} | null = null;

		const endLiveSession = () => {
			if (liveSession?.timer) clearTimeout(liveSession.timer);
			liveSession = null;
		};

		const pushInspect = (force = false) => {
			const now = Date.now();
			if (!force && now - lastPushTime < 30) {
				if (pushTimer) clearTimeout(pushTimer);
				pushTimer = setTimeout(() => pushInspect(true), 30);
				return;
			}
			lastPushTime = now;

			const id = this.editor.selection.primary;
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
				multi: this.editor.selection.ids.length > 1,
				count: this.editor.selection.ids.length,
			});
		};

		// ─── sub: selection ───
		const selSub = this.editor.selection.bus.on("changed", () => {
			endLiveSession();
			pushInspect(true);
		});
		const primarySub = this.editor.selection.bus.on("primaryChanged", () => pushInspect(true));

		// ─── sub: transform:changed → sync ───
		const transformSub = this.editor.bus.on("transform:changed", (payload: TransformSyncPayload) => {
			if (payload.source === "inspector") return;
			pushInspect(true);
		});

		const renameSub = this.editor.bus.on("rename:changed", () => pushInspect(true));
		const sceneSub = this.editor.bus.on("scene:loaded", () => pushInspect(true));

		// ─── sub: پیام‌ها از webview ───
		const msgSub = view.webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case "update:transform": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					if (typeof msg.value !== "number" || !Number.isFinite(msg.value)) return;

					// ─── ⭐ حالت live: آپدیت بدون command (فوری) ───
					if (msg.live) {
						const key = `${msg.nodeId}:${msg.channel}:${msg.axis}`;

						// شروع session جدید اگه channel/axis/node عوض شده
						if (!liveSession || liveSession.nodeId !== msg.nodeId || liveSession.channel !== msg.channel || liveSession.axis !== msg.axis) {
							// قبل از شروع، session قبلی رو commit کن
							endLiveSession();

							liveSession = {
								nodeId: msg.nodeId,
								channel: msg.channel,
								axis: msg.axis,
								startValue: (node.transform[msg.channel] as any)[msg.axis],
								timer: null,
							};
						}

						// ─── آپدیت مستقیم (بدون command stack) ───
						(node.transform[msg.channel] as any)[msg.axis] = msg.value;

						// ─── خبر بده به viewport ───
						this.editor.notifyTransformChanged(node, "inspector");

						// ─── dirty کن ───
						node.transform[msg.channel] = { ...node.transform[msg.channel] };
						this.editor.scene.bus.emit("scene:changed", undefined);

						// ─── تایمر: بعد از 500ms سکوت، session رو commit کن ───
						if (liveSession.timer) clearTimeout(liveSession.timer);
						liveSession.timer = setTimeout(() => {
							// یه command ثبت کن که undo بتونه برگردونه به startValue
							const currentValue = (node.transform[msg.channel] as any)[msg.axis];
							if (Math.abs(currentValue - liveSession!.startValue) < 1e-9) {
								endLiveSession();
								return;
							}

							// command معکوس: از current به start
							// (چون مقدار فعلی رو خودمون گذاشتیم، command فقط برای undo/redo ثبت می‌شه)
							this.editor.commands.recordExternalChange(node, msg.channel as any, msg.axis as any, liveSession!.startValue, currentValue, (n) => this.editor.notifyTransformChanged(n, "inspector"));

							endLiveSession();
						}, 500);
						break;
					}

					// ─── حالت غیر-live: مثل قبل ───
					await this.editor.commands.execute(
						new SetTransformCommand(node, msg.channel, msg.axis, msg.value, (n) => {
							this.editor.notifyTransformChanged(n, "inspector");
						}),
					);
					break;
				}

				case "rename": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					await this.editor.commands.execute(
						new RenameNodeCommand(node, msg.name, (n) => {
							this.editor.notifyRenamed(n);
						}),
					);
					break;
				}

				case "toggle:enabled": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					node.enabled = !node.enabled;
					this.editor.bus.emit("scene:mutated", undefined);
					pushInspect(true);
					break;
				}
			}
		});

		view.onDidDispose(() => {
			endLiveSession();
			selSub();
			primarySub();
			transformSub();
			renameSub();
			sceneSub();
			msgSub.dispose();
			if (pushTimer) clearTimeout(pushTimer);
		});

		pushInspect(true);
	}
}
