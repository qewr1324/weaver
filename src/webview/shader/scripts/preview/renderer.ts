// src/webview/shader/scripts/preview/renderer.ts
import type { ShaderDefinition } from "../../../../scene/shader/types";
import { CHANNEL_ORDER } from "../../../../scene/shader/defaults";
import { generateFragmentShader, generateVertexShader } from "./shaders";
import { createSphere, createBox, createPlane, type MeshData } from "./geometry";
import { registerGL, uploadAllToGPU, bindTexture } from "../texture-store";
import { mat4Multiply, mat4Perspective, mat4LookAt, mat4RotationY, mat4RotationX, mat3NormalFromMat4, type Mat4 } from "./matrices";

export type PreviewShape = "sphere" | "box" | "plane";

export interface PreviewState {
	shape: PreviewShape;
	autoRotate: boolean;
	showGrid: boolean;
}

export class ShaderPreviewRenderer {
	private gl: WebGLRenderingContext | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private program: WebGLProgram | null = null;
	private meshes: Record<PreviewShape, MeshData>;
	private buffers: {
		position?: WebGLBuffer;
		normal?: WebGLBuffer;
		uv?: WebGLBuffer;
		index?: WebGLBuffer;
	} = {};
	private indexCount = 0;
	private rafHandle = 0;
	private currentShader: ShaderDefinition | null = null;
	private uniformLocations: Map<string, WebGLUniformLocation | null> = new Map();
	private attribLocations: {
		aPosition: number;
		aNormal: number;
		aUV: number;
	} = { aPosition: -1, aNormal: -1, aUV: -1 };

	private rotY = 0;
	private rotX = 0;
	private isDragging = false;
	private lastMouse = { x: 0, y: 0 };

	public state: PreviewState = {
		shape: "sphere",
		autoRotate: true,
		showGrid: false,
	};

	constructor() {
		this.meshes = {
			sphere: createSphere(1, 48, 48),
			box: createBox(1.4),
			plane: createPlane(2),
		};
	}

	public init(canvas: HTMLCanvasElement): void {
		this.canvas = canvas;
		this.gl = canvas.getContext("webgl", { antialias: true, alpha: false }) as WebGLRenderingContext | null;
		if (!this.gl) {
			console.error("[Weaver:preview] WebGL not supported");
			return;
		}

		const gl = this.gl;
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);
		gl.clearColor(0.1, 0.12, 0.15, 1);

		// ✅ register GL context برای texture store
		registerGL(gl);

		this.setupInput();
		this.loop();
	}

	public setShader(shader: ShaderDefinition): void {
		if (!this.gl) return;
		this.currentShader = shader;
		this.buildProgram(shader);
		// ✅ texture ها رو دوباره آپلود کن
		uploadAllToGPU();
	}

	public setShape(shape: PreviewShape): void {
		this.state.shape = shape;
		this.uploadMesh(shape);
	}

	public dispose(): void {
		if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
	}

	// ─── input ───
	private setupInput(): void {
		if (!this.canvas) return;

		this.canvas.addEventListener("mousedown", (e) => {
			this.isDragging = true;
			this.lastMouse = { x: e.clientX, y: e.clientY };
		});

		window.addEventListener("mousemove", (e) => {
			if (!this.isDragging) return;
			const dx = e.clientX - this.lastMouse.x;
			const dy = e.clientY - this.lastMouse.y;
			this.lastMouse = { x: e.clientX, y: e.clientY };
			this.rotY += dx * 0.01;
			this.rotX += dy * 0.01;
			this.rotX = Math.max(-1.5, Math.min(1.5, this.rotX));
		});

		window.addEventListener("mouseup", () => {
			this.isDragging = false;
		});

		this.canvas.addEventListener(
			"wheel",
			(e) => {
				e.preventDefault();
			},
			{ passive: false },
		);
	}

	// ─── build program ───
	private buildProgram(shader: ShaderDefinition): void {
		const gl = this.gl;
		if (!gl) return;

		const vsSource = generateVertexShader();
		const fsSource = generateFragmentShader(shader);

		const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
		const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
		if (!vs || !fs) return;

		const prog = gl.createProgram();
		if (!prog) return;

		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);

		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			console.error("[Weaver:preview] link error:", gl.getProgramInfoLog(prog));
			return;
		}

		gl.deleteShader(vs);
		gl.deleteShader(fs);

		if (this.program) gl.deleteProgram(this.program);
		this.program = prog;

		// attribs
		this.attribLocations.aPosition = gl.getAttribLocation(prog, "aPosition");
		this.attribLocations.aNormal = gl.getAttribLocation(prog, "aNormal");
		this.attribLocations.aUV = gl.getAttribLocation(prog, "aUV");

		// uniforms
		this.uniformLocations.clear();
		const uniformNames = ["uProjection", "uView", "uModel", "uNormalMatrix", "uCameraPos", "uLightDir", "uLightColor", "uLightIntensity"];

		for (const key of CHANNEL_ORDER) {
			uniformNames.push(`u_${key}_color`);
			uniformNames.push(`u_${key}_number`);
			uniformNames.push(`u_${key}_texture`);
			uniformNames.push(`u_${key}_hasTexture`);
			uniformNames.push(`u_${key}_intensity`);
		}

		for (const name of uniformNames) {
			this.uniformLocations.set(name, gl.getUniformLocation(prog, name));
		}

		this.uploadMesh(this.state.shape);
	}

	private compileShader(type: number, source: string): WebGLShader | null {
		const gl = this.gl;
		if (!gl) return null;

		const sh = gl.createShader(type);
		if (!sh) return null;

		gl.shaderSource(sh, source);
		gl.compileShader(sh);

		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
			console.error("[Weaver:preview] compile error:", gl.getShaderInfoLog(sh));
			console.error("[Weaver:preview] source:", source);
			gl.deleteShader(sh);
			return null;
		}
		return sh;
	}

	// ─── upload mesh ───
	private uploadMesh(shape: PreviewShape): void {
		const gl = this.gl;
		if (!gl) return;

		const mesh = this.meshes[shape];

		if (!this.buffers.position) this.buffers.position = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
		gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

		if (!this.buffers.normal) this.buffers.normal = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.normal);
		gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

		if (!this.buffers.uv) this.buffers.uv = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.uv);
		gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.STATIC_DRAW);

		if (!this.buffers.index) this.buffers.index = gl.createBuffer()!;
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

		this.indexCount = mesh.indices.length;
	}

	// ─── loop ───
	private loop = (): void => {
		this.rafHandle = requestAnimationFrame(this.loop);
		this.draw();
	};

	private draw(): void {
		const gl = this.gl;
		const canvas = this.canvas;
		if (!gl || !canvas || !this.program) return;

		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}

		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.useProgram(this.program);

		const aspect = canvas.width / canvas.height;
		const proj = mat4Perspective(Math.PI / 4, aspect, 0.1, 100);

		if (this.state.autoRotate && !this.isDragging) {
			this.rotY += 0.005;
		}

		const radius = this.state.shape === "plane" ? 3 : 3.2;
		const camX = Math.sin(0) * radius;
		const camY = 0.6;
		const camZ = Math.cos(0) * radius;

		const view = mat4LookAt([camX, camY, camZ], [0, 0, 0], [0, 1, 0]);

		const rotY = mat4RotationY(this.rotY);
		const rotX = mat4RotationX(this.rotX);
		const model = mat4Multiply(rotY, rotX);

		const normal = mat3NormalFromMat4(model);

		this.setUniformMat4("uProjection", proj);
		this.setUniformMat4("uView", view);
		this.setUniformMat4("uModel", model);
		this.setUniformMat3("uNormalMatrix", normal);

		this.setUniform3f("uCameraPos", camX, camY, camZ);
		this.setUniform3f("uLightDir", -0.5, -1, -0.3);
		this.setUniform3f("uLightColor", 1, 1, 1);
		this.setUniform1f("uLightIntensity", 1.2);

		if (this.currentShader) {
			this.applyChannelUniforms(this.currentShader);
		}

		this.setAttrib("aPosition", this.buffers.position, 3);
		this.setAttrib("aNormal", this.buffers.normal, 3);
		this.setAttrib("aUV", this.buffers.uv, 2);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index!);
		gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
	}

	private setAttrib(name: "aPosition" | "aNormal" | "aUV", buf: WebGLBuffer | undefined, size: number): void {
		const gl = this.gl;
		if (!gl || !buf) return;
		const loc = this.attribLocations[name];
		if (loc < 0) return;
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
	}

	private setUniformMat4(name: string, m: Mat4): void {
		const loc = this.uniformLocations.get(name);
		if (loc) this.gl?.uniformMatrix4fv(loc, false, m);
	}

	private setUniformMat3(name: string, m: Float32Array): void {
		const loc = this.uniformLocations.get(name);
		if (loc) this.gl?.uniformMatrix3fv(loc, false, m);
	}

	private setUniform1f(name: string, v: number): void {
		const loc = this.uniformLocations.get(name);
		if (loc) this.gl?.uniform1f(loc, v);
	}

	private setUniform3f(name: string, x: number, y: number, z: number): void {
		const loc = this.uniformLocations.get(name);
		if (loc) this.gl?.uniform3f(loc, x, y, z);
	}

	private setUniform4f(name: string, x: number, y: number, z: number, w: number): void {
		const loc = this.uniformLocations.get(name);
		if (loc) this.gl?.uniform4f(loc, x, y, z, w);
	}

	private setUniform1i(name: string, v: number): void {
		const loc = this.uniformLocations.get(name);
		if (loc) this.gl?.uniform1i(loc, v);
	}

	private applyChannelUniforms(shader: ShaderDefinition): void {
		const gl = this.gl;
		if (!gl) return;

		let textureUnit = 0;

		for (const key of CHANNEL_ORDER) {
			const ch = shader.channels[key];
			if (!ch.enabled) continue;

			if (ch.source === "color" || ch.source === "color-texture") {
				const c = ch.color ?? [0.5, 0.5, 0.5, 1];
				this.setUniform4f(`u_${key}_color`, c[0], c[1], c[2], c[3]);
			}

			if (ch.source === "number" || ch.source === "number-texture") {
				this.setUniform1f(`u_${key}_number`, ch.number ?? 0);
			}

			if (ch.source === "texture" || ch.source === "color-texture" || ch.source === "number-texture") {
				// ✅ تلاش برای bind texture
				uploadAllToGPU();
				const bound = bindTexture(key, textureUnit);

				this.setUniform1i(`u_${key}_texture`, textureUnit);
				this.setUniform1i(`u_${key}_hasTexture`, bound ? 1 : 0);

				if (bound) textureUnit++;
			}

			if (ch.source === "color-texture" || ch.source === "number-texture") {
				this.setUniform1f(`u_${key}_intensity`, ch.intensity ?? 1);
			}
		}
	}
}
