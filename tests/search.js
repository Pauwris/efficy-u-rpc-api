import { CrmEnv, CrmApi } from '../build/efficy-u-rpc-api-bundle-es.js';
import test from 'ava';
import process from 'process';
import dotenv from 'dotenv';
dotenv.config();
// Constants depending on the tested environment
const searchedContact = "Kristof Pauwels";
const crmEnv = new CrmEnv({
    "url": process.env.CRM_ORIGIN,
    "user": process.env.CRM_USER,
    "pwd": process.env.CRM_PWD,
    "customer": process.env.CRM_CUSTOMER
});
if (typeof process.env.CRM_USER !== "string" || !process.env.CRM_USER.toLowerCase())
    throw Error("Check .env configuration");
test.skip('search', async (t) => {
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
