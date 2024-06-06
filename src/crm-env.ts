import { CrmFetchErrorInterceptor, CrmFetchRequestInterceptor, CrmFetchResponseInterceptor } from "./crm-fetch-Interceptor";
import { Cookie, CrmEnvConfig } from "./types";

/**
 * Defines the connection properties for your Efficy web API
 */
export class CrmEnv {
	private name = "CrmEnv";

	url?: string;
	customer?: string;
	apiKey?: string;
	user?: string;
	pwd?: string;
	cookies?: Cookie[];

	logOff?: boolean
	useFetchQueue?: boolean;
	retryWithNewSession?: boolean;

	/**
	 * Creates a CrmEnv instance.
	 * @param env The definition object of the targeted CRM environment.
	 */
	constructor(private env?: CrmEnvConfig) {
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
	setEnv(env: CrmEnvConfig): void {
		this.url = env.url || "";
		this.customer = env.customer || "";

		// Sensitive properties
		this.apiKey = env.apiKey || "";
		this.user = env.user || "";
		this.pwd = env.pwd || "";
		this.cookies = Array.isArray(env.cookies) ? env.cookies : [];

		// Booleans
		this.logOff = typeof env.logOff === "boolean" ? env.logOff : false;
		this.useFetchQueue = typeof env.useFetchQueue === "boolean" ? env.useFetchQueue : false;
		this.retryWithNewSession = typeof env.retryWithNewSession === "boolean" ? env.retryWithNewSession : false;

		// Remove trailing slash from url
		this.url = this.url.replace(/\/$/, "");
	}

	clearCookies() {
		this.cookies = [];
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

	readonly interceptors = Object.freeze({
		onRequest: new CrmFetchRequestInterceptor(),
		onPositiveResponse: new CrmFetchResponseInterceptor(),
		onError: new CrmFetchErrorInterceptor(),
	})
}
