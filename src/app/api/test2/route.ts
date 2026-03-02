import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const BASE_URL = 'https://proxy.opinion.trade:8443/openapi';
    const key = process.env.OPINION_API_KEY;

    try {
        const slug = 'who-will-trump-nominate-as-fed-chair';

        // Let's try categorical specific slug endpoints
        const res1 = await fetch(`${BASE_URL}/market/categorical/slug/${slug}`, { headers: { apikey: key! } });
        const d1 = await res1.json().catch(() => null);

        const res2 = await fetch(`${BASE_URL}/market/categorical?slug=${slug}`, { headers: { apikey: key! } });
        const d2 = await res2.json().catch(() => null);

        return NextResponse.json({
            categorical_slug: d1,
            categorical_query: d2
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
