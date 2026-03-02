import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    console.log("Starting test...");
    const BASE_URL = 'https://proxy.opinion.trade:8443/openapi';
    let found = null;
    let foundStatus = '';

    for (const status of ['activated', 'resolved']) {
        for (let p = 1; p <= 30; p++) {
            const res = await fetch(`${BASE_URL}/market?status=${status}&limit=20&page=${p}`, {
                headers: { 'apikey': process.env.OPINION_API_KEY as string, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.errno !== 0 || !data.result?.list?.length) break;

            for (const m of data.result.list) {
                if (m.slug === 'will-khamenei-leave-iran-by') {
                    found = m.marketId || m.market_id;
                    foundStatus = status;
                    break;
                }
            }
            if (found) break;
        }
        if (found) break;
    }
    console.log('Found:', found, 'Status:', foundStatus);
}
test();
