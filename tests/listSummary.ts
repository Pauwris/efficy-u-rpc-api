import { CrmEnv, CrmApi, GetSearchResultPayload, EntitySearch, ListSummaryPayload, UnityKey } from '../build/efficy-u-rpc-api-bundle-es.js'

import test from 'ava';
import process from 'process';
import dotenv from 'dotenv';
dotenv.config();

const crmEnv = new CrmEnv({
	"url": process.env.CRM_ORIGIN,
	"user": process.env.CRM_USER,
	"pwd": process.env.CRM_PWD,
	"customer": process.env.CRM_CUSTOMER
})

if (typeof process.env.CRM_USER !== "string" || !process.env.CRM_USER.toLowerCase()) throw Error("Check .env configuration")

test('CrmApi: listSummary Currency', async t => {
	interface Crcy {
		crcyName: string;
		crcyCode: string;
		crcySymbol: string;
		crcyKey: UnityKey;
	}

	const crm = new CrmApi(crmEnv);
	const payload: ListSummaryPayload = {
		fields: ["crcyName", "crcyCode", "crcySymbol", "crcyCode", "crcyKey"],
		tableName: "Currency",
		query: [["crcyIsDisabled = 0"]]
	};

	try {
		const result = await crm.listSummary<Crcy>(payload);
		const euro = result?.list.find(item => item.crcyCode === "EUR");
		t.assert(euro?.crcyName === "Euro");
	} catch (ex) {
		console.error(ex)
	}
});

test('CrmApi: listSummary Company', async t => {
	interface Company {
		compKey: UnityKey;
		compName: string;		
	}

	const crm = new CrmApi(crmEnv);
	const payload: ListSummaryPayload = {
		fields: ["compKey", "compName"],
		tableName: "Company",
		query: [["compArchived = 1","compName like 'Efficy%'"]]
	};

	try {
		const result = await crm.listSummary<Company>(payload);
		const efficyGent = result?.list.find(item => item.compName === "Efficy Gent");
		t.assert(efficyGent?.compKey != null);
	} catch (ex) {
		console.error(ex)
	}
});