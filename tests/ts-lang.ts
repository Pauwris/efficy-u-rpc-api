import { CrmEnv, CrmRpc, Crm } from '../build/efficy-u-rpc-api-bundle-es.js'
//import { CrmEnv, CrmRpc, Crm, UKey } from '../src/index.js'

import test from 'ava';
import process from 'process';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

// Constants depending on the tested environment
const url = new URL("https://submariners.efficytest.cloud/");
const customerAlias = "submariners";
const compKeyEfficy = "00010Q0u00001Nvm";
const pdfFilePath = "C:\\Temp\\efficy-u-rpc-api\\Welcome to Word.pdf";

const kristof: UKey = "string";

test('process.env', t => {
	t.is(process.env.CRM_ORIGIN, url.origin + "/");
});

const crmEnv = new CrmEnv({
	"url": process.env.CRM_ORIGIN,
	"user": process.env.CRM_USER,
	"pwd": process.env.CRM_PWD,
	"customer": process.env.CRM_CUSTOMER
})

if (typeof process.env.CRM_USER !== "string" || !process.env.CRM_USER.toLowerCase()) throw Error("Check .env configuration")
const currentUserCode = process.env.CRM_USER.toLowerCase();

test('crmEnv', t => {
	t.is(crmEnv.url, url.origin);
});


test('Settings and session properties', async (t) => {
	const crm = new CrmRpc(crmEnv);
	const currentDatabaseAlias = crm.currentDatabaseAlias;
	const currentLicenseName = crm.currentUserCode;
	const setts = crm.getSystemSettings();

	const defaultCurrency = crm.getSetting("Efficy", "defaultCurrency");
	await crm.executeBatch();

	t.deepEqual(currentDatabaseAlias.result, customerAlias);
	t.deepEqual(currentLicenseName.result.toLowerCase(), currentUserCode);
	t.deepEqual(setts.map.get("FileBase"), "efficy/")
	t.deepEqual(defaultCurrency.result, "EUR")
});

test('Multiple queries', async (t) => {
	const crm = new CrmRpc(crmEnv);

	const sqlQueryText = "select top 5 userKey, userFullname from <#TABLE NAME=User>";
	const query1 = crm.executeSqlQuery(sqlQueryText);
	const query2 = crm.executeDatabaseQuery("00011g3c000OCOlJ", undefined, false, 5);
	await crm.executeBatch();

	t.assert(
		query1.items.length === 5 && query2.items.length === 10000
	);
});

test('DataSet extended operations', async (t) => {
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
		t.deepEqual(ex.message, 'EEfficyException - Invalid Entity "dummy" - TAGS-2108', "Error on getCategoryCollection")
	}
});


test('Consult operations', async (t) => {
	const crm = new CrmRpc(crmEnv);

	const comp = crm.openConsultObject("comp", compKeyEfficy);
	const dsComp = comp.getMasterDataSet();
	const dsCompCustomer = comp.getCategoryDataSet("COMP$CUSTOMER");
	const linkedContacts = comp.getDetailDataSet("cont");
	await crm.executeBatch();
	const linkedOppo = comp.getDetailDataSet("oppo");
	await crm.executeBatch();

	t.deepEqual(dsComp.item?.compName, "Efficy", "compName");
	t.deepEqual(dsCompCustomer.item?.compcustCompanyKey, compKeyEfficy, "dsCompCustomer");
	t.assert(linkedContacts.items.length > 100, "linkedContacts")
	t.assert(linkedOppo.items.length > 10, "linkedOppo")
});


test('Edit operations', async (t) => {
	const crm = new CrmRpc(crmEnv);

	const userList = crm.getUserList();
	await crm.executeBatch();
	const userKey = userList.items?.filter(user => user.KIND === Crm.constants.account_kind.user).pop()?.K_USER;
	const groupKey = userList.items?.filter(user => user.KIND === Crm.constants.account_kind.group).pop()?.K_USER;

	const comp = crm.openConsultObject("comp", compKeyEfficy);
	const linkedContacts = comp.getDetailDataSet("cont");
	await crm.executeBatch();
	const contKey = linkedContacts.items?.pop()?.contKey;

	const docu = crm.openEditObject("Docu");
	docu.updateField("name", "Unittest");
	docu.insertDetail("Comp", compKeyEfficy);
	docu.insertDetail("Cont", contKey, true, true);
	docu.commitChanges();
	docu.activateCategory("DOCU$INVOICING");
	docu.updateCategoryFields("DOCU$INVOICING", {
		"invoiceDate": "2021-01-08T00:00:00",
		"communication": "Hello World!"
	});
	docu.updateCategoryField("DOCU$INVOICING", "expenses", 123.456)
	docu.clearDetail("Comp");
	docu.insertDetail("Comp", compKeyEfficy);
	docu.insertDetail("Cont", contKey);
	docu.setUsers([userKey], true);
	docu.setUserSecurity(groupKey, Crm.constants.access_code.fullcontrol);
	docu.commitChanges();
	await crm.executeBatch();
	const docuKey = docu.key;

	crm.deleteEntity("Docu", [docuKey]);
	await crm.executeBatch();

	t.assert(docuKey != "", "Edit + Delete docu")
});

test('Attachments', async (t) => {
	const fileName = path.basename(pdfFilePath);
	const base64String = "";

	const crm = new CrmRpc(crmEnv);
	const docu = crm.openEditObject("Docu");
	docu.updateField("name", "Unittest - Attachment");
	docu.insertAttachment(crm.constants.file_type.embedded, fileName);
	docu.updateAttachment("", base64String)
	docu.commitChanges();
	await crm.executeBatch();
	const docuKey = docu.key;
});