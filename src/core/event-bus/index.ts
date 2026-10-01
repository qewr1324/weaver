export type EventMap = Record<string, unknown>;
export type EventHandler<T> = (payload: T) => void;
export type Unsubscribe = () => void;

export class EventBus<TEvents extends EventMap> {
	private handlers = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

	on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe {
		let set = this.handlers.get(event);
		if (!set) {
			set = new Set();
			this.handlers.set(event, set);
		}
		set.add(handler as EventHandler<unknown>);
		return () => this.off(event, handler);
	}

	off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
		const set = this.handlers.get(event);
		if (!set) return;
		set.delete(handler as EventHandler<unknown>);
		if (set.size === 0) this.handlers.delete(event);
	}

	emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
		const set = this.handlers.get(event);
		if (!set) return;
		for (const handler of [...set]) {
			try {
				(handler as EventHandler<TEvents[K]>)(payload);
			} catch (err) {
				console.error(`[EventBus] handler error for "${String(event)}"`, err);
			}
		}
	}

	clear(): void {
		this.handlers.clear();
	}
}
