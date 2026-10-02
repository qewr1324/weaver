// src/webview/viewport/scripts/undo-redo.ts
import { postToExtension } from "./messaging";
import { setStatus } from "./look-mode";

let installed = false;

export function installUndoRedo(): void {
	if (installed) return;
	installed = true;

	window.addEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const inInput = target?.tagName === "INPUT";

			// ✅ لاگ برای debug
			if (e.ctrlKey || e.metaKey) {
				console.log("[Weaver:undo-redo] keydown", {
					code: e.code,
					ctrl: e.ctrlKey,
					meta: e.metaKey,
					shift: e.shiftKey,
					inInput,
				});
			}

			if (inInput) return;

			const code = e.code;
			const ctrl = e.ctrlKey || e.metaKey;

			if (ctrl && !e.shiftKey && code === "KeyZ") {
				e.preventDefault();
				e.stopPropagation();
				console.log("[Weaver:undo-redo] → undo");
				postToExtension({ type: "undo" });
				setStatus("● Undo", true);
				return;
			}

			if (ctrl && e.shiftKey && code === "KeyZ") {
				e.preventDefault();
				e.stopPropagation();
				console.log("[Weaver:undo-redo] → redo");
				postToExtension({ type: "redo" });
				setStatus("● Redo", true);
				return;
			}

			if (ctrl && !e.shiftKey && code === "KeyY") {
				e.preventDefault();
				e.stopPropagation();
				console.log("[Weaver:undo-redo] → redo (Y)");
				postToExtension({ type: "redo" });
				setStatus("● Redo", true);
				return;
			}
		},
		{ capture: true },
	);

	console.log("[Weaver:undo-redo] installed");
}
