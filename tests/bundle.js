import { CrmApi, CrmEnv, CrmNode, CrmRpc } from '../build/efficy-u-rpc-api-bundle-es.js';
import test from 'ava';
import process from 'process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config();
// Constants depending on the tested environment
const url = new URL("https://submariners.efficytest.cloud/");
const customerAlias = "submariners";
const compKeyEfficy = "00010Q0u00001Nvm";
const pdfFilePath = "C:\\Temp\\efficy-u-rpc-api\\Welcome to Word.pdf";
const searchedContact = "Kristof Pauwels";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
test('process.env', t => {
    t.is(process.env.CRM_ORIGIN, url.origin + "/");
});
const crmEnv = new CrmEnv({
    "url": process.env.CRM_ORIGIN,
    "user": process.env.CRM_USER,
    "pwd": process.env.CRM_PWD,
    "customer": process.env.CRM_CUSTOMER
});
if (typeof process.env.CRM_USER !== "string" || !process.env.CRM_USER.toLowerCase())
    throw Error("Check .env configuration");
const currentUserCode = process.env.CRM_USER.toLowerCase();
test('crmEnv', t => {
    t.is(crmEnv.url, url.origin);
});
function myLogFunction(message) {
    //console.log(`myLogFunction::${message}`)
}
test('CrmRpc: Settings and session properties', async (t) => {
    const crm = new CrmRpc(crmEnv, myLogFunction);
    const currentDatabaseAlias = crm.currentDatabaseAlias;
    const currentLicenseName = crm.currentUserCode;
    const setts = crm.getSystemSettings();
    const defaultCurrency = crm.getSetting("Efficy", "defaultCurrency");
    await crm.executeBatch();
    t.deepEqual(currentDatabaseAlias.result, customerAlias);
    t.deepEqual(currentLicenseName.result.toLowerCase(), currentUserCode);
    t.deepEqual(setts.map.get("FileBase"), "efficy/");
    t.deepEqual(defaultCurrency.result, "EUR");
});
test('CrmRpc: Multiple queries', async (t) => {
    const crm = new CrmRpc(crmEnv);
    const sqlQueryText = "select top 5 userKey, userFullname from <#TABLE NAME=User>";
    const query1 = crm.executeSqlQuery(sqlQueryText);
    const query2 = crm.executeDatabaseQuery("00011g3c000OCOlJ", undefined, false, 5);
    await crm.executeBatch();
    t.assert(query1.items.length === 5 && query2.items.length === 10000);
});
test('CrmRpc: DataSet extended operations', async (t) => {
    const crm = new CrmRpc(crmEnv);
    const userList = crm.getUserList();
    const favoList = crm.consultFavorites();
    const recentsList = crm.consultRecent();
    const catgs = crm.getCategoryCollection("comp");
    await crm.executeBatch();
    const adminUser = userList.items.find(user => typeof user["USERCODE"] === "string" && user["USERCODE"].toLowerCase() === currentUserCode);
    t.assert(adminUser?.key != "", "getUserList");
    t.assert(favoList.items.pop()?.favoKey != "", "consultFavorites");
    t.assert(recentsList.items.pop()?.TEXT != "", "consultRecent");
    t.assert(catgs.items.pop()?.kCategory, "getCategoryCollection");
    try {
        crm.getCategoryCollection("dummy");
        await crm.executeBatch();
    }
    catch (ex) {
        if (ex instanceof Error) {
            t.deepEqual(ex.message, 'EEfficyException - Invalid Entity "dummy" - TAGS-2108', "Error on getCategoryCollection");
        }
        else {
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
    t.assert(dsLinkedContacts.items.length > 100, "linkedContacts");
    t.assert(linkedOppo.items.length > 10, "linkedOppo");
});
test('CrmRpc: Edit operations', async (t) => {
    const crm = new CrmRpc(crmEnv);
    const userList = crm.getUserList();
    await crm.executeBatch();
    const userKey = userList.items?.filter(user => user.KIND === crm.constants.account_kind.user).pop()?.K_USER;
    const groupKey = userList.items?.filter(user => user.KIND === crm.constants.account_kind.group).pop()?.K_USER;
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
    docu.updateCategoryField("DOCU$INVOICING", "expenses", 123.456);
    docu.clearDetail("Comp");
    docu.insertDetail("Comp", compKeyEfficy);
    docu.insertDetail("Cont", contKey);
    docu.setUsers([userKey], true);
    docu.setUserSecurity(groupKey, crm.constants.access_code.fullcontrol);
    docu.commitChanges();
    await crm.executeBatch();
    const docuKey = docu.key;
    crm.deleteEntity("Docu", [docuKey]);
    await crm.executeBatch();
    t.assert(docuKey != "", "Edit + Delete docu");
});
test('CrmRpc: Attachments', async (t) => {
    const dirname = path.dirname(pdfFilePath);
    const fileName = path.basename(pdfFilePath);
    const base64FileName = path.join(dirname, fileName + ".txt");
    const data = await fs.promises.readFile(pdfFilePath);
    const base64String = Buffer.from(data).toString('base64');
    await fs.promises.writeFile(base64FileName, base64String);
    const crm = new CrmRpc(crmEnv);
    const docu = crm.openEditObject("Docu");
    docu.updateField("name", "Unittest - Attachment");
    docu.insertAttachment(crm.constants.file_type.embedded, fileName);
    docu.updateAttachment("", base64String);
    docu.commitChanges();
    await crm.executeBatch();
    const lastResponseObject = crm.lastResponseObject;
    const docuKey = docu.key;
    //console.log(`${url.origin}/docu/${docuKey}`)
    await sleep(1000); // Avoids concurrency error
    crm.deleteEntity("Docu", [docuKey]);
    await crm.executeBatch();
    t.assert(docuKey != "", "Attachments");
});
test('CrmApi: searchGlobal', async (t) => {
    const crm = new CrmApi(crmEnv);
    const payload = {
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
    };
    const searchResult = await crm.searchGlobal(payload);
    t.assert(searchResult.length > 0, "Has at least one search result");
    const cont = searchResult[0];
    t.assert(cont.rows[0].name === "Kristof Pauwels");
});
test('CrmApi: listSummary Currency', async (t) => {
    const crm = new CrmApi(crmEnv);
    const payload = {
        fields: ["crcyName", "crcyCode", "crcySymbol", "crcyCode", "crcyKey"],
        tableName: "Currency",
        query: [["crcyIsDisabled = 0"]]
    };
    try {
        const result = await crm.listSummary(payload);
        const euro = result?.list.find(item => item.crcyCode === "EUR");
        t.assert(euro?.crcyName === "Euro");
    }
    catch (ex) {
        console.error(ex);
    }
});
test('CrmApi: listSummary Company', async (t) => {
    const crm = new CrmApi(crmEnv);
    const payload = {
        fields: ["compKey", "compName"],
        tableName: "Company",
        query: [["compArchived = 1", "compName like 'Efficy%'"]]
    };
    try {
        const result = await crm.listSummary(payload);
        const efficyGent = result?.list.find(item => item.compName === "Efficy Gent");
        t.assert(efficyGent?.compKey != null);
    }
    catch (ex) {
        console.error(ex);
    }
});
test('CrmNode: POST json echo', async (t) => {
    const crm = new CrmNode(crmEnv);
    const payload = {
        msg: "Hello, this is a JSON POST unit test!"
    };
    try {
        const result = await crm.crmNode("echo", payload);
        t.deepEqual(JSON.parse(result.content).msg, payload.msg, "msg");
        t.deepEqual(result.method, "POST", "method");
        t.deepEqual(result.path, "/node/echo", "path");
    }
    catch (ex) {
        console.error(ex);
    }
});
test('CrmNode: GET echo', async (t) => {
    const crm = new CrmNode(crmEnv);
    const queryStringArgs = {
        "msg": "Hello, this is a GET unit test!"
    };
    try {
        const result = await crm.crmNode("echo", undefined, queryStringArgs);
        t.deepEqual(result.method, "GET", "method");
        t.deepEqual(result.path, "/node/echo", "path");
        t.deepEqual(result.query, 'msg=Hello%2C+this+is+a+GET+unit+test%21', "query");
    }
    catch (ex) {
        console.error(ex);
    }
});
