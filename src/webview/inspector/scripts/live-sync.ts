// src/webview/inspector/scripts/live-sync.ts
/**
 * live-dot ping + flush throttle برای transform updates.
 * messaging.ts از این استفاده می‌کنه.
 */

let liveDotEl: HTMLElement | null = null;
let liveDotTimer: ReturnType<typeof setTimeout> | null = null;

export function registerLiveDot(el: HTMLElement | null): void {
	liveDotEl = el;
}

export function pingLive(): void {
	if (!liveDotEl) return;
	liveDotEl.style.background = "#ffd166";
	liveDotEl.style.boxShadow = "0 0 8px #ffd166cc";
	if (liveDotTimer) clearTimeout(liveDotTimer);
	liveDotTimer = setTimeout(() => {
		if (liveDotEl) {
			liveDotEl.style.background = "#22c55e";
			liveDotEl.style.boxShadow = "0 0 4px #22c55e88";
		}
	}, 180);
}
