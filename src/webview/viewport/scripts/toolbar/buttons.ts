// src/webview/viewport/scripts/toolbar/buttons.ts

export function makeButton(icon: string, label: string, onClick: () => void, active: boolean): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.className = "tb-btn" + (active ? " active" : "");
	btn.innerHTML = '<span class="icon">' + icon + '</span><span class="label">' + label + "</span>";
	btn.title = label;
	btn.addEventListener("click", onClick);
	return btn;
}

export function setActiveInGroup(group: HTMLElement, mode: string): void {
	group.querySelectorAll(".tb-btn").forEach((b: any) => {
		if (b.dataset.mode) b.classList.toggle("active", b.dataset.mode === mode);
	});
}

export function clearGroup(group: HTMLElement, keepLabels: boolean): void {
	const kids = Array.from(group.children);
	for (const k of kids) {
		if (keepLabels && k.classList.contains("tb-label")) continue;
		group.removeChild(k);
	}
}
