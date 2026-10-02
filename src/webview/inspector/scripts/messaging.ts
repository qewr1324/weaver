// src/webview/inspector/scripts/messaging.ts
import { onExtensionMessage, postToExtension } from "../../shared/vscode-api";
import { pingLive } from "./live-sync";

/**
 * صف transform updates با throttle.
 */
interface TransformMsg {
	nodeId: string;
	channel: string;
	axis: string;
	value: number;
}

const THROTTLE_MS = 16;

const pending = new Map<string, TransformMsg>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(final: boolean): void {
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	for (const msg of pending.values()) {
		postToExtension({
			type: "update:transform",
			nodeId: msg.nodeId,
			channel: msg.channel,
			axis: msg.axis,
			value: msg.value,
			live: !final,
		});
	}
	pending.clear();
	pingLive();
}

export const Messaging = {
	scheduleTransformUpdate(msg: TransformMsg): void {
		const key = `${msg.nodeId}:${msg.channel}:${msg.axis}`;
		pending.set(key, msg);
		if (flushTimer) return;
		flushTimer = setTimeout(() => {
			flushTimer = null;
			flush(false);
		}, THROTTLE_MS);
	},

	flushTransformUpdates(): void {
		flush(true);
	},

	updateProperty(nodeId: string | undefined, prop: string, value: unknown, live: boolean): void {
		postToExtension({ type: "update:property", nodeId, prop, value, live });
	},

	rename(nodeId: string, name: string): void {
		postToExtension({ type: "rename", nodeId, name });
	},

	onMessage(handler: (msg: any) => void): () => void {
		return onExtensionMessage(handler);
	},
};
