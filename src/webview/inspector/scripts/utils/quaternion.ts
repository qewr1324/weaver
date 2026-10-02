// src/webview/inspector/scripts/utils/quaternion.ts
export interface Quat {
	x: number;
	y: number;
	z: number;
	w: number;
}

export interface Euler {
	x: number;
	y: number;
	z: number;
}

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

export function quatToEuler(q: Quat): Euler {
	const { x, y, z, w } = q;

	const sinP = 2 * (w * x - y * z);
	let ex: number;
	if (Math.abs(sinP) >= 1) {
		ex = (Math.sign(sinP) * Math.PI) / 2;
	} else {
		ex = Math.asin(sinP);
	}

	const ey = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
	const ez = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z));

	return {
		x: ex * RAD2DEG,
		y: ey * RAD2DEG,
		z: ez * RAD2DEG,
	};
}

export function eulerToQuat(e: Euler): Quat {
	const hx = (e.x * DEG2RAD) / 2;
	const hy = (e.y * DEG2RAD) / 2;
	const hz = (e.z * DEG2RAD) / 2;

	const cx = Math.cos(hx);
	const sx = Math.sin(hx);
	const cy = Math.cos(hy);
	const sy = Math.sin(hy);
	const cz = Math.cos(hz);
	const sz = Math.sin(hz);

	const qy = { x: 0, y: sy, z: 0, w: cy };
	const qx = { x: sx, y: 0, z: 0, w: cx };
	const qz = { x: 0, y: 0, z: sz, w: cz };

	function mul(a: Quat, b: Quat): Quat {
		return {
			w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
			x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
			y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
			z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
		};
	}

	return mul(mul(qy, qx), qz);
}
