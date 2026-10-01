import { log } from "../../core/logger";

const MIGRATIONS: Record<string, (data: any) => any> = {
	// v0 → v1
	"0.9": (data) => {
		data.version = "1.0";
		return data;
	},
};

export const CURRENT_SCENE_VERSION = "1.0";

export function migrateSceneData(raw: any): any {
	if (!raw || typeof raw !== "object") return raw;

	const from = String(raw.version ?? "0.9");
	if (from === CURRENT_SCENE_VERSION) return raw;

	let cur = raw;
	let ver = from;
	const visited = new Set<string>();

	while (ver !== CURRENT_SCENE_VERSION) {
		if (visited.has(ver)) {
			log.error(`migration loop detected at ${ver}`);
			break;
		}
		visited.add(ver);

		const migrator = MIGRATIONS[ver];
		if (!migrator) {
			log.warn(`no migration from ${ver} — assuming compatible`);
			cur.version = CURRENT_SCENE_VERSION;
			break;
		}
		cur = migrator(cur);
		ver = String(cur.version);
	}

	return cur;
}
