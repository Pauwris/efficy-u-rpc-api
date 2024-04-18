import test from 'ava';

import CrmEnv from "../dist/crm-env.js"
import CrmRpc from "../dist/crm-rpc.js"
import process from 'process';
import dotenv from 'dotenv';
dotenv.config();

// Temporary workaround for "unable to verify the first certificate" errors of Node.js
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

test('process.env', t => {
  t.is(process.env.CRM_ORIGIN, "https://submariners.efficytest.cloud/");
});

const crmEnv = new CrmEnv({
  "url": process.env.CRM_ORIGIN,
  "user": process.env.CRM_USER,
  "pwd": process.env.CRM_PWD,
  "customer": process.env.CRM_CUSTOMER
})

test('crmEnv', t => {
  t.is(crmEnv.url, "https://submariners.efficytest.cloud");
});

async function runQuery() {
  const crm = new CrmRpc(crmEnv);
  const sqlQueryText = "select top 5 userKey, userFullname from <#TABLE NAME=User>";
  const svnQuery = crm.executeSqlQuery(sqlQueryText);
  await crm.executeBatch();
  return svnQuery.items.length === 5;
}

test('runQuery', async t => {
  t.assert(await runQuery())
});
