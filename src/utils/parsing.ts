import { JSONPrimitiveObject } from "src/types.js";

// Variables that are primitive are accessed by value
export const isPrimitive = (val: any) => {
	return val !== Object(val);
}
export const ParseGentle = {
	fieldsObj(inputObj: JSONPrimitiveObject) {
		const outputObj: JSONPrimitiveObject = {};

		if (!inputObj || typeof inputObj !== "object" || Array.isArray(inputObj)) return outputObj;
		Object.keys(inputObj).forEach(key => {
			if (isPrimitive(inputObj[key])) {
				outputObj[key] = inputObj[key];
			}
		})
		return outputObj;
	},
	numberProperties(inputObj: JSONPrimitiveObject, numberProperties: string[]) {
		numberProperties.forEach(name => {
			if (inputObj[name] && isNaN(parseFloat(String(inputObj[name]))) === false) {
				inputObj[name] = parseFloat(String(inputObj[name]));
			}
		})

		return inputObj;
	}
}

export const ParseHard = {
	isFieldValue(value: any) {
		if (isPrimitive(value) === false) throw new TypeError(`ParseHard.isFieldValue::argument 'value' is not a primitive value`);
	}
}