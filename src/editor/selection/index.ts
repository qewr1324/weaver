import { Disposable } from "../../core/disposable";
import { EventBus } from "../../core/event-bus";

export class Selection extends Disposable {
	private selected = new Set<string>();
	private _primary: string | null = null;

	readonly bus = new EventBus<{
		changed: string[];
		primaryChanged: string | null;
	}>();

	get ids(): string[] {
		return [...this.selected];
	}

	get primary(): string | null {
		return this._primary;
	}

	set(ids: string[]): void {
		this.selected = new Set(ids);
		this._primary = ids[0] ?? null;
		this.emit();
	}

	add(id: string): void {
		if (this.selected.has(id)) return;
		this.selected.add(id);
		this._primary = id;
		this.emit();
	}

	remove(id: string): void {
		if (!this.selected.has(id)) return;
		this.selected.delete(id);
		if (this._primary === id) {
			this._primary = this.ids[0] ?? null;
		}
		this.emit();
	}

	toggle(id: string): void {
		if (this.selected.has(id)) this.remove(id);
		else this.add(id);
	}

	setPrimary(id: string): void {
		if (!this.selected.has(id)) return;
		this._primary = id;
		this.bus.emit("primaryChanged", id);
	}

	has(id: string): boolean {
		return this.selected.has(id);
	}

	clear(): void {
		this.selected.clear();
		this._primary = null;
		this.emit();
	}

	private emit(): void {
		this.bus.emit("changed", this.ids);
		this.bus.emit("primaryChanged", this._primary);
	}

	dispose(): void {
		this.clear();
		super.dispose();
	}
}
