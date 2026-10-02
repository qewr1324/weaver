// src/webview/shared/throttle.ts

export function throttle<F extends (...args: any[]) => void>(fn: F, ms: number): F & { cancel(): void } {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: any[] | null = null;

	const wrapped = ((...args: any[]) => {
		lastArgs = args;
		if (timer) return;
		timer = setTimeout(() => {
			timer = null;
			const a = lastArgs!;
			lastArgs = null;
			fn(...a);
		}, ms);
	}) as F & { cancel(): void };

	wrapped.cancel = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		lastArgs = null;
	};

	return wrapped;
}

export function debounce<F extends (...args: any[]) => void>(fn: F, ms: number): F & { cancel(): void } {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const wrapped = ((...args: any[]) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			fn(...args);
		}, ms);
	}) as F & { cancel(): void };

	wrapped.cancel = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	};

	return wrapped;
}
