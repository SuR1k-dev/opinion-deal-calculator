import { NextResponse } from 'next/server';
import { getCategoricalMarket, resolveSlug } from '@/lib/opinion-api';
import { cacheGet, cacheSet } from '@/lib/cache';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ marketId: string }> }
) {
    try {
        const { marketId } = await params;
        if (!marketId) {
            return NextResponse.json({ error: 'Invalid market ID' }, { status: 400 });
        }

        const cacheKey = `cat_market:${marketId}`;
        const cached = cacheGet(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const data = await getCategoricalMarket(marketId);
        cacheSet(cacheKey, data, 30_000); // 30s cache
        return NextResponse.json(data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
