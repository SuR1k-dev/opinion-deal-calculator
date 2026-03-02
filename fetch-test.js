const fs = require('fs');

async function run() {
    const key = fs.readFileSync('.env.local', 'utf-8')
        .split('\n')
        .find(l => l.includes('OPINION_API_KEY'))
        .split('=')[1]
        .trim();

    const res = await fetch('https://proxy.opinion.trade:8443/openapi/market/categorical/will-khamenei-leave-iran-by', {
        headers: { 'apikey': key }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
