// src/webview/inspector/scripts/state.ts

export interface InspectorTransform {
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number; w: number };
	scale: { x: number; y: number; z: number };
}

export interface InspectorComponent {
	id?: string;
	type: string;
	[k: string]: unknown;
}

export interface InspectorPayload {
	id: string;
	name: string;
	enabled: boolean;
	transform: InspectorTransform;
	components: InspectorComponent[];
}

export interface InspectorState {
	current: InspectorPayload | null;
	isMulti: boolean;
	count: number;
	multiNames: string[];
	focusedFieldId: string | null;
	propertyFilter: string;
	/** ⭐ cache از Euler rotation برای نمایش و ویرایش */
	localEuler: { x: number; y: number; z: number };
	/** ✨ جدید — آرایه‌ی payload همه‌ی selection ها برای multi-edit */
	multiData: InspectorPayload[];
}

export const state: InspectorState = {
	current: null,
	isMulti: false,
	count: 0,
	multiNames: [],
	focusedFieldId: null,
	propertyFilter: "",
	localEuler: { x: 0, y: 0, z: 0 },
	multiData: [], // ✨ جدید
};

export function setSelection(
	payload: InspectorPayload | null,
	opts: {
		multi: boolean;
		count: number;
		names: string[];
		/** ✨ جدید — اگه extension آرایه‌ی کامل رو فرستاد */
		all?: InspectorPayload[];
	},
): void {
	state.current = payload;
	state.isMulti = opts.multi;
	state.count = opts.count;
	state.multiNames = opts.names;
	state.multiData = opts.all || (payload ? [payload] : []); // ✨ جدید
}

export const AXES = ["x", "y", "z"] as const;
export type Axis = (typeof AXES)[number];

export const CHANNELS = [
	{ key: "position", label: "Position", default: 0 },
	{ key: "rotation", label: "Rotation", default: 0 },
	{ key: "scale", label: "Scale", default: 1 },
] as const;

export type ChannelKey = (typeof CHANNELS)[number]["key"];
