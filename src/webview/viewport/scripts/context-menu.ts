// src/webview/viewport/scripts/context-menu.ts
// ✨ جدید — راست‌کلیک روی mesh → menu
import { scene, dom, lookState, selectedIds, meshToNodeId, setSelectedIds } from "./state";
import { postToExtension } from "./messaging";
import { refreshHighlights } from "./highlighting";
import { applyGizmoMode } from "./gizmo";
import { focusOnSelection } from "./focus";
import { setStatus } from "./look-mode";

interface CtxItem {
	label: string;
	icon: string;
	action: () => void;
	danger?: boolean;
	separator?: boolean;
}

let menuEl: HTMLDivElement | null = null;
let currentNodeId: string | null = null;

function ensureMenu(): HTMLDivElement {
	if (menuEl) return menuEl;
	menuEl = document.createElement("div");
	menuEl.className = "vp-ctx-menu";
	menuEl.style.display = "none";
	document.body.appendChild(menuEl);
	return menuEl;
}

function hideMenu(): void {
	if (menuEl) menuEl.style.display = "none";
}

function showMenu(x: number, y: number, items: CtxItem[]): void {
	const el = ensureMenu();
	el.innerHTML = "";

	for (const it of items) {
		if (it.separator) {
			const sep = document.createElement("div");
			sep.className = "vp-ctx-sep";
			el.appendChild(sep);
			continue;
		}

		const row = document.createElement("div");
		row.className = "vp-ctx-item" + (it.danger ? " danger" : "");
		row.innerHTML = `<span class="vp-ctx-icon">${it.icon}</span>${it.label}`;
		row.addEventListener("click", (e) => {
			e.stopPropagation();
			hideMenu();
			it.action();
		});
		el.appendChild(row);
	}

	el.style.display = "block";
	el.style.left = `${x}px`;
	el.style.top = `${y}px`;

	const rect = el.getBoundingClientRect();
	if (rect.right > window.innerWidth) el.style.left = `${window.innerWidth - rect.width - 4}px`;
	if (rect.bottom > window.innerHeight) el.style.top = `${window.innerHeight - rect.height - 4}px`;
}

export function installViewportContextMenu(): void {
	document.addEventListener("click", hideMenu);
	document.addEventListener("scroll", hideMenu, true);

	// راست‌کلیک روی canvas
	dom.canvas.addEventListener("contextmenu", (e: MouseEvent) => {
		e.preventDefault();
		if (lookState.active) return;
		if (!scene) return;

		const BABYLON = (window as any).BABYLON;
		const pick = scene.pick(scene.pointerX, scene.pointerY, (m: any) => {
			if (!m || !m.isPickable) return false;
			if (m.name === "__grid") return false;
			return meshToNodeId.has(m);
		});

		const nodeId = pick?.pickedMesh ? meshToNodeId.get(pick.pickedMesh) : null;
		currentNodeId = nodeId;

		// اگه روی mesh نبود، فقط "Add Object"
		if (!nodeId) {
			showMenu(e.clientX, e.clientY, [
				{
					label: "Add Object…",
					icon: "➕",
					action: () => {
						dom.addObjWrap.classList.toggle("open");
					},
				},
				{
					label: "Focus Scene",
					icon: "🎯",
					action: () => {
						setSelectedIds([]);
						refreshHighlights();
						applyGizmoMode();
						focusOnSelection();
					},
				},
			]);
			return;
		}

		// اگه روی mesh بود
		const isSelected = selectedIds.includes(nodeId);

		const items: CtxItem[] = [];

		if (!isSelected) {
			items.push({
				label: "Select",
				icon: "👆",
				action: () => {
					postToExtension({ type: "select", ids: [nodeId] });
				},
			});
		}

		items.push(
			{
				label: "Focus",
				icon: "🎯",
				action: () => {
					if (!isSelected) {
						postToExtension({ type: "select", ids: [nodeId] });
					}
					setTimeout(() => focusOnSelection(), 50);
				},
			},
			{
				label: "Duplicate",
				icon: "📋",
				action: () => postToExtension({ type: "duplicate:node", nodeId }),
			},
			{ label: "", icon: "", action: () => {}, separator: true },
			{
				label: "Delete",
				icon: "🗑",
				danger: true,
				action: () => postToExtension({ type: "remove:node", nodeId }),
			},
		);

		showMenu(e.clientX, e.clientY, items);
	});
}
