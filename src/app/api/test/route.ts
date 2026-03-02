import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const BASE_URL = 'https://proxy.opinion.trade:8443/openapi';
    const key = process.env.OPINION_API_KEY;

    try {
        const slug = 'who-will-trump-nominate-as-fed-chair';

        // Let's try multiple endpoints
        const res1 = await fetch(`${BASE_URL}/market/categorical/${slug}`, { headers: { apikey: key! } });
        const d1 = await res1.json().catch(() => null);

        const res2 = await fetch(`${BASE_URL}/market/slug/${slug}`, { headers: { apikey: key! } });
        const d2 = await res2.json().catch(() => null);

        const res3 = await fetch(`${BASE_URL}/market?slug=${slug}`, { headers: { apikey: key! } });
        const d3 = await res3.json().catch(() => null);

        const res4 = await fetch(`${BASE_URL}/market/${slug}`, { headers: { apikey: key! } });
        const d4 = await res4.json().catch(() => null);

        const res5 = await fetch(`${BASE_URL}/market?title=${slug}`, { headers: { apikey: key! } });
        const d5 = await res5.json().catch(() => null);

        return NextResponse.json({
            categorical: d1,
            market_slug: d2,
            market_query_slug: d3,
            market_direct: d4,
            market_query_title: d5
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
