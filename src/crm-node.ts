import { CrmEnv } from "./crm-env";
import { CrmFetch } from "./crm-fetch";
import { isJsonApiResponse } from "./dataguards";
import { ModulePostPayload, QueryStringArgs } from "./types";

/**
 * Efficy SDK build for requesting custom Efficy nodes (aka Webservices) on the endpoint "crm/node"
 */
export class CrmNode extends CrmFetch {
	constructor(public crmEnv = new CrmEnv()) {
		super(crmEnv)
		this.name = "CrmNode";
	}

	/**
	 * 
	 * @param nodePath The node path without the "/crm/node/"" prefix, e.g. "echo"
	 * @param payload 
	 * @param queryStringArgs 
	 * @example
	 * const payload = {msg: "Hello, this is a unit test!"};
	 * const result = await crm.crmNode<EchoResponse>("echo", payload);
	 */
	async crmNode<R>(nodePath: string, payload?: ModulePostPayload, queryStringArgs?: QueryStringArgs): Promise<R> {
		const requestUrl = this.getRequestUrl("node/" + nodePath, queryStringArgs);

		const requestOptions: RequestInit = {}
		if (payload) {
			if (payload instanceof FormData) {
				requestOptions.body = payload;
			} else if (typeof payload === "object") {
				this.initJsonFetch("POST");
				requestOptions.body = JSON.stringify(payload);
			} else if (typeof payload === 'object' && payload as any instanceof URLSearchParams) {
				const p = payload as URLSearchParams;
				requestOptions.body = p.toString();
			} else {				
				throw new Error(`${this.name}.crmNode::Unsupported payload type`);
			}
		} else {
			this.fetchOptions.method = "GET"
		}

		const response: object = await this.fetch(requestUrl, requestOptions);

		if (isJsonApiResponse(response)) {
			return response.data as R;
		} else {
			throw new Error(`${this.name}.crmNode::unexpected response`);
		}
	}
}