import { NextResponse } from 'next/server';
import { getFeeRates } from '@/lib/opinion-api';
import { cacheGet, cacheSet } from '@/lib/cache';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ tokenId: string }> }
) {
    try {
        const { tokenId } = await params;
        if (!tokenId) {
            return NextResponse.json({ error: 'Token ID required' }, { status: 400 });
        }

        const cacheKey = `fees:${tokenId}`;
        const cached = cacheGet(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        const data = await getFeeRates(tokenId);
        cacheSet(cacheKey, data, 60_000); // 60s cache
        return NextResponse.json(data);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
