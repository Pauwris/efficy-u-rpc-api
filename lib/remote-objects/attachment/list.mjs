import RemoteObject from '../remote-object.mjs'
import Attachment from './type.mjs'

class AttachmentList extends RemoteObject {
	#attachments;

	constructor(remoteAPI) {
		super(remoteAPI);
		this.resetState();
	}

	/**
	 * Request attachment from FILES table
	 * @param {string} fileKey
	 * @param {number} [version=0]
	 * @returns {Attachment}
	 */
	getAttachment(fileKey, fileVersion = 0) {
		if (!fileKey) throw new TypeError("AttachmentList.getAttachment::fileKey is required");
		if (typeof fileVersion !== "number") throw new TypeError("AttachmentList.getAttachment::fileVersion is not a number");

		const key = `${fileKey}_${fileVersion}`;
		const attachment = new Attachment(key);
		this.#attachments.push(attachment);
		return attachment;
	}

	resetState() {
		this.#attachments = [];
	}

	get funcs() {
		return this.#attachments.map(item => item.func);
	}

	setResponseObject(value) {
		this.responseObject = value;
	}

	afterExecute() {
		this.#attachments.forEach(attachment => {
			const result = this.api.findAttachment(this.responseObject, attachment.key);
			result && attachment.setStream(result["#result"]);
		})
	}
}

export default AttachmentList;