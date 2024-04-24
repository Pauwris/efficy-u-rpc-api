import { CrmEnv, CrmApi } from '../build/efficy-u-rpc-api-bundle-es.js';
import test from 'ava';
import process from 'process';
import dotenv from 'dotenv';
dotenv.config();
const crmEnv = new CrmEnv({
    "url": process.env.CRM_ORIGIN,
    "user": process.env.CRM_USER,
    "pwd": process.env.CRM_PWD,
    "customer": process.env.CRM_CUSTOMER
});
if (typeof process.env.CRM_USER !== "string" || !process.env.CRM_USER.toLowerCase())
    throw Error("Check .env configuration");
const currentUserCode = process.env.CRM_USER.toLowerCase();
test('search', t => {
    debugger;
    const crm = new CrmApi(crmEnv);
    crm.searchGlobal();
    t.assert(true, "searchGlobal");
});
