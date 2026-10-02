// src/webview/inspector/scripts/keyboard-nav.ts
// ✨ جدید — Enter → فیلد بعدی، ↑↓ بین row ها
export function installKeyboardNav(root: HTMLElement): void {
	root.addEventListener("keydown", (e) => {
		const inp = e.target as HTMLInputElement;
		if (!inp.matches?.("input[data-ch], input[data-prop], input[data-prop-num]")) return;

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			moveFocus(root, inp, 1);
			return;
		}

		if (e.key === "ArrowDown" && !e.altKey && !e.ctrlKey && !e.metaKey) {
			const isNumber = inp.type === "number" || inp.hasAttribute("data-prop-num");
			if (!isNumber) {
				e.preventDefault();
				moveFocus(root, inp, 1);
			}
		}

		if (e.key === "ArrowUp" && !e.altKey && !e.ctrlKey && !e.metaKey) {
			const isNumber = inp.type === "number" || inp.hasAttribute("data-prop-num");
			if (!isNumber) {
				e.preventDefault();
				moveFocus(root, inp, -1);
			}
		}
	});
}

function moveFocus(root: HTMLElement, current: HTMLInputElement, dir: 1 | -1): void {
	const all = Array.from(root.querySelectorAll<HTMLInputElement>("input[data-ch], input[data-prop], input[data-prop-num]"));
	const idx = all.indexOf(current);
	if (idx === -1) return;
	const next = all[idx + dir];
	if (next) {
		next.focus();
		next.select?.();
	}
}
