export interface IDisposable {
	dispose(): void;
	readonly disposed: boolean;
}

export class DisposableStore implements IDisposable {
	private items: IDisposable[] = [];
	private _disposed = false;

	get disposed(): boolean {
		return this._disposed;
	}

	add<T extends IDisposable>(item: T): T {
		if (this._disposed) {
			item.dispose();
			return item;
		}
		this.items.push(item);
		return item;
	}

	dispose(): void {
		if (this._disposed) return;
		this._disposed = true;
		for (const item of this.items) {
			try {
				item.dispose();
			} catch (err) {
				console.error("[DisposableStore]", err);
			}
		}
		this.items.length = 0;
	}
}

export abstract class Disposable implements IDisposable {
	protected readonly _store = new DisposableStore();
	private _disposed = false;

	get disposed(): boolean {
		return this._disposed;
	}

	protected register<T extends IDisposable>(item: T): T {
		return this._store.add(item);
	}

	dispose(): void {
		if (this._disposed) return;
		this._disposed = true;
		this._store.dispose();
	}
}
