// src/editor/commands/file-sync.ts
import type { Command } from "../command-stack";
import type { SceneDocument } from "../scene-document";

/**
 * Command رو wrap می‌کنه تا بعد از هر execute/undo،
 * فایل روی دیسک هم sync بشه.
 *
 * ⚠️ دیگه لازم نیست چون SceneDocument خودش debounced flush می‌کنه.
 * فقط برای سازگاری نگه داشته شده.
 */
export class FileSyncCommand implements Command {
	readonly label: string;

	constructor(
		private inner: Command,
		private doc: SceneDocument,
		private onChange?: () => void,
	) {
		this.label = inner.label;
	}

	async execute(): Promise<void> {
		await this.inner.execute();
		await this.doc.flushToDocument();
		this.onChange?.();
	}

	async undo(): Promise<void> {
		await this.inner.undo();
		await this.doc.flushToDocument();
		this.onChange?.();
	}
}
