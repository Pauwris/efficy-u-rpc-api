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
test.skip('listSummary', async (t) => {
    const crm = new CrmApi(crmEnv);
    const payload = {
        fields: ["crcyName", "crcyCode", "crcySymbol", "crcyCode", "crcyKey"],
        tableName: "Currency",
        query: [["crcyIsDisabled = 0"]]
    };
    try {
        const result = await crm.listSummary(payload);
        const euro = result?.list.find(item => item.crcyCode === "EUR");
        t.assert(euro?.crcyName === "Euro", "Query Currency");
    }
    catch (ex) {
        console.error(ex);
    }
    t.assert(true, "listSummary");
});
