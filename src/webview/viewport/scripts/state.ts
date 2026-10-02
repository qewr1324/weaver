// src/webview/viewport/scripts/state.ts
import type * as BABYLON from "@babylonjs/core";

export interface ViewportEditorState {
	transformMode: "move" | "rotate" | "scale";
	referenceMode: "world" | "object";
	shaderMode: "solid" | "wireframe" | "both";
	snapGrid: boolean;
	snapGridSize: number;
	snapObject: boolean;
}

export interface CameraState {
	yaw: number;
	pitch: number;
	baseSpeed: number;
	baseLookSpeed: number;
	sprintMult: number;
	slowMult: number;
}

export interface LookModeState {
	active: boolean;
	pointerLocked: boolean;
	mouseSens: number;
}

// ─── DOM refs ───
export const dom = {
	canvas: null as unknown as HTMLCanvasElement,
	hud: null as unknown as HTMLDivElement,
	hudLookKey: null as unknown as HTMLElement,
	fps: null as unknown as HTMLDivElement,
	status: null as unknown as HTMLDivElement,
	loading: null as unknown as HTMLDivElement,
	toolbar: null as unknown as HTMLDivElement,
	addObjWrap: null as unknown as HTMLDivElement,
	addObjBtn: null as unknown as HTMLButtonElement,
	addObjMenu: null as unknown as HTMLDivElement,
	transformGroup: null as unknown as HTMLDivElement,
	refGroup: null as unknown as HTMLDivElement,
	shaderGroup: null as unknown as HTMLDivElement,
	snapGroup: null as unknown as HTMLDivElement,
	lookModeBtn: null as unknown as HTMLButtonElement,
	lookOverlay: null as unknown as HTMLDivElement,
	crosshair: null as unknown as HTMLDivElement,
};

export function cacheDomRefs(): void {
	dom.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
	dom.hud = document.getElementById("hud") as HTMLDivElement;
	dom.hudLookKey = document.getElementById("hudLookKey") as HTMLElement;
	dom.fps = document.getElementById("fps") as HTMLDivElement;
	dom.status = document.getElementById("status") as HTMLDivElement;
	dom.loading = document.getElementById("loading") as HTMLDivElement;
	dom.toolbar = document.getElementById("toolbar") as HTMLDivElement;
	dom.addObjWrap = document.getElementById("addObjWrap") as HTMLDivElement;
	dom.addObjBtn = document.getElementById("addObjBtn") as HTMLButtonElement;
	dom.addObjMenu = document.getElementById("addObjMenu") as HTMLDivElement;
	dom.transformGroup = document.getElementById("transformGroup") as HTMLDivElement;
	dom.refGroup = document.getElementById("refGroup") as HTMLDivElement;
	dom.shaderGroup = document.getElementById("shaderGroup") as HTMLDivElement;
	dom.snapGroup = document.getElementById("snapGroup") as HTMLDivElement;
	dom.lookModeBtn = document.getElementById("lookModeBtn") as HTMLButtonElement;
	dom.lookOverlay = document.getElementById("look-overlay") as HTMLDivElement;
	dom.crosshair = document.getElementById("crosshair") as HTMLDivElement;
}

// ─── Babylon instances (set in main) ───
export let engine: any = null;
export let scene: any = null;
export let camera: any = null;
export let highlightLayer: any = null;
export let gizmoManager: any = null;

export function setEngine(e: any): void {
	engine = e;
}
export function setScene(s: any): void {
	scene = s;
}
export function setCamera(c: any): void {
	camera = c;
}
export function setHighlightLayer(h: any): void {
	highlightLayer = h;
}
export function setGizmoManager(g: any): void {
	gizmoManager = g;
}

// ─── node maps ───
export const nodeIdToMesh = new Map<string, any>();
export const nodeIdToRoot = new Map<string, any>();
export const rootToNodeId = new Map<any, string>();
export const meshToNodeId = new WeakMap<any, string>();

// ─── selection / hover ───
export let selectedIds: string[] = [];
export let hoveredMesh: any = null;

export function setSelectedIds(ids: string[]): void {
	selectedIds = ids || [];
}
export function setHoveredMesh(m: any): void {
	hoveredMesh = m;
}

// ─── gizmo state ───
export let suppressGizmoSync = false;
export function setSuppressGizmoSync(v: boolean): void {
	suppressGizmoSync = v;
}

// ⭐ track gizmoهایی که listener بهشون بسته شده
export const gizmoListenersAttached = new WeakSet<any>();

// ─── editor / camera / look ───
export const editor: ViewportEditorState = {
	transformMode: "move",
	referenceMode: "world",
	shaderMode: "solid",
	snapGrid: false,
	snapGridSize: 0.5,
	snapObject: false,
};

export const camState: CameraState = {
	yaw: -Math.PI / 4,
	pitch: -Math.PI / 8,
	baseSpeed: 0.35,
	baseLookSpeed: 1.8,
	sprintMult: 4,
	slowMult: 0.25,
};

export const lookState: LookModeState = {
	active: false,
	pointerLocked: false,
	mouseSens: 0.0035,
};

export const keys = new Set<string>();
export let shiftHeld = false;
export let spaceHeld = false;
export function setShiftHeld(v: boolean): void {
	shiftHeld = v;
}
export function setSpaceHeld(v: boolean): void {
	spaceHeld = v;
}

// ─── colors ───
export let HOVER_COLOR: any = null;
export let SELECT_COLOR: any = null;
export function setHoverColor(c: any): void {
	HOVER_COLOR = c;
}
export function setSelectColor(c: any): void {
	SELECT_COLOR = c;
}

// ─── logger ───
export function log(...a: unknown[]): void {
	console.log("[Weaver]", ...a);
}
