import { CrmApi, CrmEnv } from '../../index.js'

import test from 'ava';
import process from 'process';
import dotenv from 'dotenv';
import { GetSearchResultPayload } from '../types';
dotenv.config();

const crmEnv = new CrmEnv({
	"url": process.env.CRM_ORIGIN,
	"user": process.env.CRM_USER,
	"pwd": process.env.CRM_PWD,
	"customer": process.env.CRM_CUSTOMER
})

test('searchGlobal', async (t) => {
	const crmApi = new CrmApi(crmEnv);
	const searchResult = crmApi.searchGlobal({} as GetSearchResultPayload);

	t.deepEqual(1 === 1, "searchGlobal")
});
