import { RemoteAPI } from "src/remote-api.js";
import { RemoteObject } from "./remote-object.js";
import { JSONPrimitiveObject, UKey } from "src/types.js";

export class AttachmentList extends RemoteObject {
	private attachments: AttachmentObject[] = [];

	constructor(remoteAPI: RemoteAPI) {
		super(remoteAPI);
		this.resetState();
	}

	/**
	 * Request attachment from File table
	 * @param fileKey
	 */
	getAttachment(fileKey: UKey): AttachmentObject {
		const key = fileKey;
		const attachment = new AttachmentObject(key);
		this.attachments.push(attachment);
		return attachment;
	}

	resetState() {
		this.attachments = [];
	}

	get funcs() {
		return this.attachments.map(item => item.func);
	}

	setResponseObject(value: object) {
		this.responseObject = value;
	}

	afterExecute() {
		this.attachments.forEach(attachment => {
			const result = this.findAttachment(this.responseObject, attachment.key);
            if (result && typeof result["#result"] === "string") {
                attachment.setStream(result["#result"]);
            }
		})
	}
}

/**
 * Class representing a remotely fetched Attachment
 */
export class AttachmentObject {
	private stream: string = "";

	constructor(public key: UKey) {
	}

	setStream(stream: string) {
		this.stream = stream;
	}

	/**
	 * get the base64 encoded attachment stream
	 */
	get base64Stream() {
		return this.stream;
	}

	get func() {
		const func: JSONPrimitiveObject = {};
		func["@name"] = "attachment";
		func["key"] = this.key;
		return func;
	};
}
