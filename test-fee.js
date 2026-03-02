const fs = require('fs');

async function run() {
    const key = fs.readFileSync('.env.local', 'utf-8')
        .split('\n')
        .find(l => l.includes('OPINION_API_KEY'))
        .split('=')[1]
        .trim();

    const res = await fetch('https://proxy.opinion.trade:8443/openapi/token/fee-rates?token_id=46905476398127901044691849165146855335495458488719477111437299966035237825795', {
        headers: { 'apikey': key }
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log(JSON.stringify(data, null, 2));
}

run();
