/**
 * Class to define the parameters of the Efficy U server
 */
export class CrmEnv {
	private name = "CrmEnv";

	url?: string;
	customer?: string;
	logOff?: boolean
	useFetchQueue?: boolean;
	apiKey?: string;
	user?: string;
	pwd?: string;
	cookies?: ICookie[];

	/**
	 * Creates a CrmEnv instance.
	 * @param env The definition object of the targeted CRM environment.
	 */
	constructor(private env?: ICrmEnvConfig) {
		if (typeof env === "object") {
			this.setEnv(env);
		} else {
			this.setEnv({
				url: window.location.origin
			});
		}
	}

	/**
	 * Updates the CRM environment configuration.
	 * @param env The definition object of the targeted CRM environment.
	 */
	setEnv(env: ICrmEnvConfig): void {
		this.url = env.url || "";
		this.customer = env.customer || "";
		this.logOff = typeof env.logOff === "boolean" ? env.logOff : false;
		this.useFetchQueue = typeof env.useFetchQueue === "boolean" ? env.useFetchQueue : false;

		// Sensitive properties
		this.apiKey = env.apiKey || "";
		this.user = env.user || "";
		this.pwd = env.pwd || "";
		this.cookies = Array.isArray(env.cookies) ? env.cookies : [];

		// Remove trailing slash from url
		this.url = this.url.replace(/\/$/, "");
	}

	/**
	 * Returns the request header for cookies.
	 */
	get cookieHeader(): string {
		if (!Array.isArray(this.cookies)) return "";

		const validCookies = this.cookies.filter(cookie => new Date() < new Date(cookie.expires ?? ""));
		const header = validCookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
		return header;
	}

	/**
	 * Returns the session ID from cookies.
	 */
	get sessionId(): string {
		return Array.isArray(this.cookies) && this.cookies.length > 0 ? this.cookies[0].value ?? "" : "";
	}

	/**
	 * Returns the first part of the session ID.
	 */
	get shortSessionId(): string {
		const str = this.sessionId;
		return str.split("-")[0] || "";
	}
}

export interface ICrmEnvConfig {
	url?: string;
	customer?: string;
	logOff?: boolean;
	useFetchQueue?: boolean;
	apiKey?: string;
	user?: string;
	pwd?: string;
	cookies?: ICookie[];
}

export interface ICookie {
	name: string;
	value: string;
	expires?: string;
}
