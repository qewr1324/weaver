// src/webview/viewport/scripts/grid-controls.ts
// ✨ UI کنترل‌های grid در toolbar — ✅ idempotent (قابل نصب مکرر)
import { dom } from "./state";
import { buildGrid, DEFAULT_GRID, getGridOptions, setGridVisible, getGridVisible } from "./grid";
import { setStatus } from "./look-mode";

const STORAGE_KEY = "weaver.gridOptions";

interface PersistedGrid {
	size: number;
	step: number;
	majorEvery: number;
	visible: boolean;
}

function loadPersisted(): PersistedGrid {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const p = JSON.parse(raw);
			return {
				size: Number(p.size) || DEFAULT_GRID.size,
				step: Number(p.step) || DEFAULT_GRID.step,
				majorEvery: Number(p.majorEvery) || DEFAULT_GRID.majorEvery,
				visible: p.visible !== false,
			};
		}
	} catch {
		/* ignore */
	}
	return { ...DEFAULT_GRID, visible: true };
}

function savePersisted(opts: PersistedGrid): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
	} catch {
		/* ignore */
	}
}

// ✅ flag برای اینکه بدونیم یک بار نصب شده (event listener ها)
let listenersInstalled = false;

/**
 * ✅ ساخت UI کنترل‌های grid.
 * این تابع idempotent هست — هر بار صدا زده شه،
 * دکمه‌های قدیمی رو پاک می‌کنه و جدید می‌سازه.
 * (چون buildToolbar هم ممکنه snapGroup رو پاک کنه)
 */
export function installGridControls(): void {
	if (!dom.snapGroup) {
		console.warn("[Weaver:grid] snapGroup not found");
		return;
	}

	// ✅ اگه قبلاً نصب شده، پاکش کن (چون buildToolbar ممکنه snapGroup رو پاک کرده باشه)
	const existing = dom.snapGroup.querySelector(".grid-ctrl-wrap");
	if (existing) {
		existing.remove();
	}

	// ✅ element های قدیمی رو هم پاک کن (اگه listener دارن)
	const oldToggle = document.getElementById("gridToggleBtn");
	if (oldToggle) oldToggle.remove();

	const persisted = loadPersisted();

	// ─── wrapper ───
	const wrap = document.createElement("div");
	wrap.className = "grid-ctrl-wrap";
	wrap.innerHTML = `
		<button class="tb-btn grid-toggle" id="gridToggleBtn" title="Toggle Grid (Ctrl+Shift+G)">
			<span class="icon">▦</span>
			<span class="label">Grid</span>
		</button>
		<div class="grid-ctrl-inputs">
			<label class="grid-ctrl-field" title="Grid total size">
				<span class="grid-ctrl-label">Size</span>
				<input type="number" id="gridSizeInput" min="5" max="1000" step="5" value="${persisted.size}" />
			</label>
			<label class="grid-ctrl-field" title="Step between minor lines">
				<span class="grid-ctrl-label">Step</span>
				<input type="number" id="gridStepInput" min="0.1" max="10" step="0.1" value="${persisted.step}" />
			</label>
			<label class="grid-ctrl-field" title="Every N lines are major">
				<span class="grid-ctrl-label">Major</span>
				<input type="number" id="gridMajorInput" min="1" max="50" step="1" value="${persisted.majorEvery}" />
			</label>
		</div>
	`;

	dom.snapGroup.appendChild(wrap);

	// ─── elements ───
	const toggleBtn = wrap.querySelector<HTMLButtonElement>("#gridToggleBtn")!;
	const sizeInput = wrap.querySelector<HTMLInputElement>("#gridSizeInput")!;
	const stepInput = wrap.querySelector<HTMLInputElement>("#gridStepInput")!;
	const majorInput = wrap.querySelector<HTMLInputElement>("#gridMajorInput")!;

	// ─── apply ───
	const apply = (showStatus = true) => {
		const size = Math.max(5, Math.min(1000, Number(sizeInput.value) || DEFAULT_GRID.size));
		const step = Math.max(0.1, Math.min(10, Number(stepInput.value) || DEFAULT_GRID.step));
		const majorEvery = Math.max(1, Math.min(50, Math.round(Number(majorInput.value) || DEFAULT_GRID.majorEvery)));

		sizeInput.value = String(size);
		stepInput.value = String(step);
		majorInput.value = String(majorEvery);

		buildGrid({ size, step, majorEvery });

		const visible = getGridVisible();
		setGridVisible(visible);

		savePersisted({ size, step, majorEvery, visible });

		if (showStatus) {
			setStatus(`● Grid: ${size} × ${size} · step ${step}`, true);
		}
	};

	// ─── toggle button ───
	toggleBtn.addEventListener("click", () => {
		const visible = !getGridVisible();
		setGridVisible(visible);
		toggleBtn.classList.toggle("active", visible);

		const p = loadPersisted();
		savePersisted({ ...p, visible });

		setStatus(`● Grid: ${visible ? "ON" : "OFF"}`, true);
	});

	// ─── inputs ───
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const scheduleApply = () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			apply();
		}, 300);
	};

	sizeInput.addEventListener("input", scheduleApply);
	stepInput.addEventListener("input", scheduleApply);
	majorInput.addEventListener("input", scheduleApply);

	for (const inp of [sizeInput, stepInput, majorInput]) {
		inp.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				if (debounceTimer) clearTimeout(debounceTimer);
				apply();
				inp.blur();
			}
		});
	}

	// ─── initial state ───
	// ⚠️ فقط بار اول grid رو build کن
	// (بارهای بعد که buildToolbar صدا زده میشه، grid قبلاً ساخته شده)
	if (!listenersInstalled) {
		buildGrid({
			size: persisted.size,
			step: persisted.step,
			majorEvery: persisted.majorEvery,
		});
		setGridVisible(persisted.visible);
		listenersInstalled = true;
	}

	toggleBtn.classList.toggle("active", getGridVisible());

	console.log("[Weaver:grid] controls installed");
}
