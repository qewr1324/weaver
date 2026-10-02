// src/webview/shader/scripts/preview/matrices.ts

export type Mat4 = Float32Array;
export type Mat3 = Float32Array;

export function mat4Identity(): Mat4 {
	return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
	const out = new Float32Array(16);
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 4; j++) {
			let sum = 0;
			for (let k = 0; k < 4; k++) {
				sum += a[i * 4 + k] * b[k * 4 + j];
			}
			out[i * 4 + j] = sum;
		}
	}
	return out;
}

export function mat4Perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
	const f = 1 / Math.tan(fovY / 2);
	const nf = 1 / (near - far);
	return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

export function mat4LookAt(eye: [number, number, number], center: [number, number, number], up: [number, number, number]): Mat4 {
	const [ex, ey, ez] = eye;
	const [cx, cy, cz] = center;
	const [ux, uy, uz] = up;

	let zx = ex - cx;
	let zy = ey - cy;
	let zz = ez - cz;
	let len = Math.hypot(zx, zy, zz);
	if (len < 1e-6) return mat4Identity();
	zx /= len;
	zy /= len;
	zz /= len;

	let xx = uy * zz - uz * zy;
	let xy = uz * zx - ux * zz;
	let xz = ux * zy - uy * zx;
	len = Math.hypot(xx, xy, xz);
	if (len < 1e-6) return mat4Identity();
	xx /= len;
	xy /= len;
	xz /= len;

	const yx = zy * xz - zz * xy;
	const yy = zz * xx - zx * xz;
	const yz = zx * xy - zy * xx;

	return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1]);
}

export function mat4RotationY(angle: number): Mat4 {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

export function mat4RotationX(angle: number): Mat4 {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

export function mat4Scale(sx: number, sy: number, sz: number): Mat4 {
	return new Float32Array([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]);
}

export function mat3NormalFromMat4(m: Mat4): Mat3 {
	return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}
