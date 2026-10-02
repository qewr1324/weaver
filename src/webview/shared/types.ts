// src/webview/shared/types.ts
export interface TransformDTO {
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number; w: number };
	scale: { x: number; y: number; z: number };
}

export interface ComponentDTO {
	id?: string;
	type: string;
	[k: string]: unknown;
}

export interface InspectorPayload {
	id: string;
	name: string;
	enabled: boolean;
	transform: TransformDTO;
	components: ComponentDTO[];
}

export interface InspectMessage {
	type: "inspect";
	payload: InspectorPayload | null;
	multi: boolean;
	count: number;
	names?: string[];
}
