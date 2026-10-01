import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";

export class Selection extends Disposable {
	private selected = new Set<string>();
	readonly bus = new EventBus<{ changed: string[] }>();

	get ids(): string[] {
		return [...this.selected];
	}

	set(ids: string[]): void {
		this.selected = new Set(ids);
		this.bus.emit("changed", this.ids);
	}

	clear(): void {
		this.selected.clear();
		this.bus.emit("changed", this.ids);
	}

	dispose(): void {
		this.clear();
		super.dispose();
	}
}
