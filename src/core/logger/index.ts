export enum LogLevel {
	Debug = 0,
	Info = 1,
	Warn = 2,
	Error = 3,
	Silent = 4,
}

export class Logger {
	private static globalLevel: LogLevel = LogLevel.Info;

	static setLevel(level: LogLevel): void {
		Logger.globalLevel = level;
	}

	constructor(private readonly scope: string) {}

	private log(level: LogLevel, method: "log" | "warn" | "error", args: unknown[]): void {
		if (level < Logger.globalLevel) return;
		console[method](`[Weaver:${this.scope}]`, ...args);
	}

	debug(...a: unknown[]): void {
		this.log(LogLevel.Debug, "log", a);
	}
	info(...a: unknown[]): void {
		this.log(LogLevel.Info, "log", a);
	}
	warn(...a: unknown[]): void {
		this.log(LogLevel.Warn, "warn", a);
	}
	error(...a: unknown[]): void {
		this.log(LogLevel.Error, "error", a);
	}
}

export const log = new Logger("Extension");
