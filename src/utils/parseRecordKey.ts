import { ParsedRecordKey } from "../types.js";
import { SysTableIdList } from "./constants.js";


/**
 * Decodes a Base62 encoded string to a number. Based65 is used for Maxo keys
 */
export function base62Decode(recordKey: string): number | null {
	const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	const base = alphabet.length;
	let decoded = 0;

	for (let i = 0; i < recordKey.length; i++) {
		const char = recordKey[i];
		const index = alphabet.indexOf(char);

		if (index === -1) return null;

		decoded = decoded * base + index;
	}

	return decoded;
}


/**
 * Parses a Record Key (16 characters) into its components: license code, table key, and next key
 * The table name is derived from the table key using a predefined mapping.
 * Warning, newer and custmon tables are not included in the mapping.
 */
export function parseRecordKey(recordKey: string): ParsedRecordKey | null {
	// Validate input
	if (!recordKey || recordKey.length !== 16) {
		return null;
	}

	const licenseCode = base62Decode(recordKey.substring(0, 4));
	const stblKTable = base62Decode(recordKey.substring(4, 8));
	const stblName = stblKTable ? getTableNameById(stblKTable) : null;
	const nextKey = base62Decode(recordKey.substring(8, 16));

	return {
		licenseCode,
		stblKTable,
		stblName,
		nextKey,
	};
}

// Type-safe function to get the table name by ID
export function getTableNameById(id: number): string | null {
	return SysTableIdList[id as keyof typeof SysTableIdList] ?? null;
}
