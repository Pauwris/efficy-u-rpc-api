import test from 'ava';

import CrmEnv from "../dist/crm-env.js"
import CrmRpc from "../dist/crm-rpc.js"
import process from 'process';
import dotenv from 'dotenv';
dotenv.config();

// Constants depending on the tested environment
const url = new URL("https://submariners.efficytest.cloud/");
const customerAlias = "submariners";

test('process.env', t => {
  t.is(process.env.CRM_ORIGIN, url.origin + "/");
});

const crmEnv = new CrmEnv({
  "url": process.env.CRM_ORIGIN,
  "user": process.env.CRM_USER,
  "pwd": process.env.CRM_PWD,
  "customer": process.env.CRM_CUSTOMER
})

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
  t.deepEqual(currentLicenseName.result.toLowerCase(), process.env.CRM_USER.toLowerCase());
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

  const adminUser = userList.items.find(user => user["USERCODE"].toLowerCase() === process.env.CRM_USER.toLowerCase());

  t.assert(adminUser.key != "", "getUserList");
  t.assert(favoList.items.pop()?.favoKey != "", "consultFavorites");
  t.assert(recentsList.items.pop()?.TEXT != "", "consultRecent")
  t.assert(catgs.items.pop()?.kCategory > 0, "getCategoryCollection")

  try {
    crm.getCategoryCollection("dummy");
    await crm.executeBatch();
  } catch(ex) {
    t.deepEqual(ex.message, 'EEfficyException - Invalid Entity "dummy" - TAGS-2108', "Error on getCategoryCollection")    
  }  
});

