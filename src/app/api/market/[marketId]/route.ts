import { NextResponse } from 'next/server';
import { getMarket, getCategoricalMarket, resolveSlug } from '@/lib/opinion-api';
import { cacheGet, cacheSet } from '@/lib/cache';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ marketId: string }> }
) {
    try {
        const { marketId } = await params;
        if (!marketId) {
            return NextResponse.json({ error: 'Invalid market ID' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const isCategorical = searchParams.get('type') === 'categorical';

        const cacheKey = isCategorical ? `cat_market:${marketId}` : `market:${marketId}`;
        const cached = cacheGet(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const data = isCategorical ? await getCategoricalMarket(marketId) : await getMarket(marketId);
        cacheSet(cacheKey, data, 30_000); // 30s cache
        return NextResponse.json(data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
