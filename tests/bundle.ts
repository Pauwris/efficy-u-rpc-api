import { CrmApi, CrmEnv, CrmEnvConfig, CrmNode, CrmRpc, EntitySearch, GetSearchResultPayload, ListSummaryPayload, ModulePostPayload, QueryStringArgs, UnityKey, CrmUtils, PublicApi } from '../build/efficy-u-rpc-api-bundle.js'

import test from 'ava';
import process from 'process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

// Constants depending on the tested environment
const url = new URL(process.env.CRM_ORIGIN ?? "");
const compKeyEfficy = "00010Q0u00001Nvm";
const workingFolder = "C:\\Kristof\\github-pauwris\\efficy-u-rpc-api\\assets\\"
const pdfFilePath = path.join(workingFolder, "Welcome to Word.pdf")
const pngFilePath = path.join(workingFolder, "screenshot.png")
const searchedContact = "Kristof Pauwels";
const exampleDocuWithFile1 = {
	docuKey: '00011G2i001BQPN6',
	fileKey: '00010ID2001BQOkQ'
}
const barcelonaPictures = '00011G2i0001U9e5'; // 2206 - Official Pictures Barcelona '22.2

test('process.env', t => {
	t.is(process.env.CRM_ORIGIN, url.origin + "/");
});

const crmEnvConfigBasic: CrmEnvConfig = {
	url: process.env.CRM_ORIGIN,
	customer: process.env.CRM_CUSTOMER,
	retryWithNewSession: true,
	useCookies: false
}

const crmEnvConfigPassword = Object.freeze({...crmEnvConfigBasic, ...{
	user: process.env.CRM_USER,
	pwd: process.env.CRM_PWD,
}})

const crmEnvConfigApiKey = Object.freeze({...crmEnvConfigBasic, ...{
	apiKey: process.env.CRM_APIKEY,
}})

const crmEnvConfig = crmEnvConfigApiKey ?? crmEnvConfigPassword;
const crmEnv = new CrmEnv(crmEnvConfig)

if (typeof process.env.CRM_USER !== "string" || !process.env.CRM_USER.toLowerCase()) throw Error("Check .env configuration")
const currentUserCode = process.env.CRM_USER.toLowerCase();

test('crmEnv', t => {
	t.is(crmEnv.url, url.origin);
});

function myLogFunction(message: string) {
	//console.log(`myLogFunction::${message}`)
}

test('CrmUtils: parseRecordKey()', async (t) => {
	const good = CrmUtils.parseRecordKey(compKeyEfficy)
	if (!good) throw Error("parseRecordKey failed")

	t.deepEqual(good.licenseCode, 1);
	t.deepEqual(good.stblKTable, 100000);
	t.deepEqual(good.stblName, 'Company');
	t.assert(good.nextKey && good.nextKey > 0)

	const failed1 = CrmUtils.parseRecordKey('123454')
	t.deepEqual(failed1, null);
});

test('CrmRpc: Settings and session properties', async (t) => {
	const crm = new CrmRpc(crmEnv);
	const cuc = crm.currentUserCode;
	const setts = crm.getSystemSettings();

	const defaultCurrency = crm.getSetting("Efficy", "defaultCurrency");
	await crm.executeBatch();

	t.deepEqual(cuc.result.toLowerCase(), currentUserCode);
	t.deepEqual(setts.map.get("FileBase"), "efficy/")
	t.deepEqual(defaultCurrency.result, "EUR")
});

test('CrmRpc: Interceptors', async (t) => {
	let onRequestUrlOrigin: string = "";
	let onResponseCustomHeader: string = "";
	let onErrorEx: Error | null = null;

	const myCrmEnv = new CrmEnv(crmEnvConfig);
	myCrmEnv.interceptors.onRequest.use(async(request: Request) => {
		onRequestUrlOrigin = new URL(request.url).origin;
	})
	myCrmEnv.interceptors.onPositiveResponse.use(async(response: Response) => {
		onResponseCustomHeader = response.headers.get("x-efficy-status") ?? "";
	})
	myCrmEnv.interceptors.onError.use(async(e: Error, request: Request, requestPayload: ModulePostPayload | undefined, response: Response | null) => {
		onErrorEx = e;
	})

	const crm = new CrmRpc(myCrmEnv);
	const cuc = crm.currentUserCode;
	await crm.executeBatch();

	t.deepEqual(cuc.result.toLowerCase(), currentUserCode);
	t.deepEqual(onRequestUrlOrigin, url.origin, "onRequest interceptor enabled");
	t.deepEqual(onResponseCustomHeader, "success");

	crm.executeSqlQuery("select * from fakeTable")

	try {
		await crm.executeBatch();
	} catch(e) {
		onErrorEx = e;
	}

	myCrmEnv.interceptors.onRequest.clear();
	onRequestUrlOrigin = "";
	crm.currentUserCode;
	await crm.executeBatch();

	t.deepEqual(onRequestUrlOrigin, "", "onRequest interceptor disabled");
	t.assert(onErrorEx?.message.includes("EEfficyServerError"), "onError interceptor");
});

test('CrmRpc: Multiple queries', async (t) => {
	const crm = new CrmRpc(crmEnv);

	const query1 = crm.executeSqlQuery("select top(10) compKey, compName from <#TABLE NAME=Company>", undefined, false, 5);
	const query2 = crm.executeSqlQuery("select top(1) fileKey, fileFileSize, fileStream from <#TABLE NAME=File> where fileFileSize is not null", undefined, true, 1);
	await crm.executeBatch();

	t.assert(query1.items.length === 5);
	t.assert(query2.items[0]["fileKey"]);
	t.assert(query2.items[0]["fileStream"]?.toString() != null);
});

test('CrmRpc: DataSet extended operations', async (t) => {
	const crm = new CrmRpc(crmEnv);

	const userList = crm.getUserList()
	const favoList = crm.consultFavorites();
	const recentsList = crm.consultRecent();
	const catgs = crm.getCategoryCollection("comp");
	await crm.executeBatch();

	const adminUser = userList.items.find(user => typeof user["USERCODE"] === "string" && user["USERCODE"].toLowerCase() === currentUserCode);

	t.assert(adminUser?.key != "", "getUserList");
	t.assert(favoList.items.pop()?.favoKey != "", "consultFavorites");
	t.assert(recentsList.items.pop()?.TEXT != "", "consultRecent")
	t.assert(catgs.items.pop()?.kCategory, "getCategoryCollection")

	try {
		crm.getCategoryCollection("dummy");
		await crm.executeBatch();
	} catch (ex) {
		if (ex instanceof Error) {
			t.deepEqual(ex.message, 'EEfficyException - Invalid Entity "dummy" - TAGS-2108', "Error on getCategoryCollection")
		} else {
			console.error(ex);
		}
	}
});

test('CrmRpc: Consult operations', async (t) => {
	const crm = new CrmRpc(crmEnv);

	const comp = crm.openConsultObject("comp", compKeyEfficy);
	const dsComp = comp.getMasterDataSet();
	const dsCompCustomer = comp.getCategoryDataSet("COMP$CUSTOMER");
	const dsLinkedContacts = comp.getDetailDataSet("cont");
	await crm.executeBatch();
	const linkedOppo = comp.getDetailDataSet("oppo");
	await crm.executeBatch();

	t.deepEqual(dsComp.item?.compName, "Efficy", "compName");
	t.deepEqual(dsCompCustomer.item?.compcustCompanyKey, compKeyEfficy, "dsCompCustomer");
	t.assert(dsLinkedContacts.items.length > 100, "linkedContacts")
	t.assert(linkedOppo.items.length > 10, "linkedOppo")
});

test('CrmRpc: Edit operations', async (t) => {
	const crm = new CrmRpc(crmEnv);

	const userList = crm.getUserList();
	await crm.executeBatch();
	const userKey = userList.items?.filter(user => user.KIND === crm.constants.account_kind.user).pop()?.K_USER as string;
	const groupKey = userList.items?.filter(user => user.KIND === crm.constants.account_kind.group).pop()?.K_USER as string;

	const comp = crm.openConsultObject("comp", compKeyEfficy);
	const linkedContacts = comp.getDetailDataSet("cont");
	await crm.executeBatch();
	const contKey = linkedContacts.items?.pop()?.contKey as string;

	const docuinvcExpenses = 123.456;
	const docuinvcInvoiceDate = "2021-01-08T00:00:00.000Z";
	const docuinvcCommunication = "Hello World!";

	const docu = crm.openEditObject("Docu");
	docu.updateField("name", "Unittest");
	docu.insertDetail("Comp", compKeyEfficy);
	docu.insertDetail("Cont", contKey, true, true);
	docu.commitChanges();
	docu.activateCategory("DOCU$INVOICING");
	docu.updateCategoryFields("DOCU$INVOICING", {
		"docuinvcInvoiceDate": docuinvcInvoiceDate,
		"docuinvcCommunication": docuinvcCommunication
	});
	docu.updateCategoryField("DOCU$INVOICING", "docuinvcExpenses", docuinvcExpenses)
	docu.clearDetail("Comp");
	docu.insertDetail("Comp", compKeyEfficy);
	docu.insertDetail("Cont", contKey);
	docu.setUsers([userKey], true);
	docu.setUserSecurity(groupKey, crm.constants.access_code.fullcontrol);
	docu.commitChanges();
	await crm.executeBatch();
	const docuKey = docu.key;

	// Verify data correctness
	const dbData = crm.executeSqlQuery("Select docuinvcExpenses, docuinvcInvoiceDate, docuinvcCommunication from DOCU$INVOICING where docuinvcDocumentKey=:p1", [docuKey]);
	await crm.executeBatch();

	if (dbData.item) {
		t.deepEqual(dbData.item["docuinvcExpenses"], docuinvcExpenses, "docuinvcExpenses")
		t.deepEqual(dbData.item["docuinvcInvoiceDate"], docuinvcInvoiceDate, "docuinvcInvoiceDate")
		t.deepEqual(dbData.item["docuinvcCommunication"], docuinvcCommunication, "docuinvcCommunication")
	}

	crm.deleteEntity("Docu", [docuKey]);
	await crm.executeBatch();

	t.assert(docuKey != "", "Edit + Delete docu")
});

test('CrmRpc: Attachments PDF', async (t) => {
	const fileName = path.basename(pdfFilePath);
	const buffer = await fs.promises.readFile(pdfFilePath);
	const base64String = buffer.toString('base64');

	const crm = new CrmRpc(crmEnv);
	const docu = crm.openEditObject("Docu");
	docu.updateField("name", "Unittest - Attachment");
	docu.insertAttachment(crm.constants.file_type.embedded, fileName);
	docu.updateAttachment("", base64String)
	docu.commitChanges();
	await crm.executeBatch();
	const lastResponseObject = crm.lastResponseObject;
	const docuKey = docu.key;

	//console.log(`${url.origin}/docu/${docuKey}`)

	crm.deleteEntity("Docu", [docuKey]);
	await crm.executeBatch();

	t.assert(docuKey != "", "Attachments")
});

test('CrmRpc: Attachments PNG', async (t) => {
	const fileName = path.basename(pngFilePath);
	const buffer = await fs.promises.readFile(pngFilePath);
	const base64String = buffer.toString('base64');

	const crm = new CrmRpc(crmEnv);
	const docu = crm.openEditObject("Docu");
	docu.updateField("name", "Unittest - Attachment");
	docu.insertAttachment(crm.constants.file_type.embedded, fileName);
	docu.updateAttachment("", base64String)
	docu.commitChanges();
	await crm.executeBatch();
	const docuKey = docu.key;

	//console.log(`${url.origin}/docu/${docuKey}`)

	crm.deleteEntity("Docu", [docuKey]);
	await crm.executeBatch();

	t.assert(docuKey != "", "Attachments")
});

test('CrmApi: searchGlobal', async t => {
	const crm = new CrmApi(crmEnv);
	const payload: GetSearchResultPayload = {
		identifier: "",
		search: {
			entities: ["cont"],
			value: searchedContact.toLocaleLowerCase(),
			offset: 0,
			quantity: 5,
			refinedOptions: {
				onlyItemsLinkedToMe: false
			}
		}
	}
	const searchResult = await crm.searchGlobal(payload);
	console.log(searchResult);
	const contSearch = searchResult?.cont;
	t.assert(contSearch?.entity === 'cont', "Search entity is 'cont'");

	const [cont] = contSearch?.rows || [];
	t.assert(cont !== undefined, "Has at least one search result");
	t.assert(cont.name === "Kristof Pauwels");
	t.assert(cont.archived === false, "Contact is not archived");
	t.assert(Object.keys(cont.links ?? {}).includes('company'), "Contact has link to company");
	t.assert(cont.score > 50, `Contact has a score (${cont.score}) above 50`);

});

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
		const euro = result?.list.find(item => item.crcyCode === "EUR")
		t.assert(euro?.crcyName === "Euro")
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
		const efficyGent = result?.list.find(item => item.compName === "Efficy Gent")

		t.assert(efficyGent?.compKey != null)
	} catch (ex) {
		console.error(ex)
	}
});

test('CrmApi: listSummary query', async t => {
	interface Query {
		querKey: UnityKey;
		querName: string;
		querComment: string;
	}

	const crm = new CrmApi(crmEnv);
	const payload: ListSummaryPayload = {
		fields: ["querKey", "querName", "querComment"],
		tableName: "Query",
		query: [["querComment = 'ehubQueryList'"]]
	};

	try {
		const result = await crm.listSummary<Query>(payload);
		const efficyCache = result?.list.find(item => item.querComment === "ehubQueryList")

		t.assert(efficyCache?.querKey != null)
	} catch (ex) {
		console.error(ex)
	}
});

test('PublicApi: getDocumentFile', async t => {
	const crm = new PublicApi.v1.Api(crmEnv);

	try {
		const existingFile = await crm.getDocumentFile(exampleDocuWithFile1.docuKey, exampleDocuWithFile1.fileKey);
		t.assert(existingFile?.name === 'SSLException.png');

		const dummyFile = await crm.getDocumentFile('???', '???');
		t.assert(dummyFile === null);
	} catch (ex) {
		console.error(ex);
	}
});

test.skip('PublicApi: getDocumentFiles', async t => {
	const crm = new PublicApi.v1.Api(crmEnv);

	try {
		const queryArgs: PublicApi.v1.QueryParams = {
			limit: 2
		}
		const existingFile = await crm.getDocumentFiles(barcelonaPictures, queryArgs);
		t.assert(existingFile?.records_found && existingFile?.records_found >= 2100);
	} catch (ex) {
		console.error(ex);
	}
});


test.skip('CrmApi: system', async t => {
	const crmApi = new CrmApi(crmEnv);
	await crmApi.logon();
	const result = await crmApi.systemClearCaches();

	t.deepEqual(result.message, "Caches cleared")

	const references = await crmApi.systemReference(true);
	t.deepEqual(references.references["00010EZE000009h9"].refCode, "DOC")
});

test.skip('CrmNode: POST json echo', async t => {
	const crm = new CrmNode(crmEnv);

	interface EchoResponse {
		content: string;
		method: string;
		path: string
	}

	const payload = {
		msg: "Hello, this is a JSON POST unit test!"
	};

	try {
		const result = await crm.crmNodeData<EchoResponse>("echo", payload);

		t.deepEqual(JSON.parse(result.content).msg, payload.msg, "msg");
		t.deepEqual(result.method, "POST", "method")
		t.deepEqual(result.path, "/node/echo", "path")
	} catch (ex) {
		console.error(ex)
	}

	try {
		const result = await crm.crmNode("echo", payload);
		t.assert(result && typeof result.data === "object")
	} catch (ex) {
		console.error(ex)
	}
});

test.skip('CrmNode: GET echo', async t => {
	const crm = new CrmNode(crmEnv);

	interface EchoResponse {
		method: string;
		path: string
		query: string
	}

	const queryStringArgs: QueryStringArgs = {
		"msg": "Hello, this is a GET unit test!"
	}

	try {
		const result = await crm.crmNodeData<EchoResponse>("echo", undefined, queryStringArgs);

		t.deepEqual(result.method, "GET", "method")
		t.deepEqual(result.path, "/node/echo", "path")
		t.deepEqual(result.query, `msg=Hello%2C+this+is+a+GET+unit+test%21&customer=${crmEnv.customer}`, "query")
	} catch (ex) {
		console.error(ex)
	}
});