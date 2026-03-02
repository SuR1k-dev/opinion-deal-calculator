// Opinion REST API wrapper
// Base URL: https://proxy.opinion.trade:8443/openapi

const BASE_URL = 'https://proxy.opinion.trade:8443/openapi';

function getApiKey(): string {
    const key = process.env.OPINION_API_KEY;
    if (!key || key === 'YOUR_API_KEY_HERE') {
        throw new Error('OPINION_API_KEY is not set in .env.local');
    }
    return key;
}

async function apiFetch<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            'apikey': getApiKey(),
            'Content-Type': 'application/json',
        },
        next: { revalidate: 0 },
    });

    if (!res.ok) {
        throw new Error(`Opinion API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    // Opinion API wraps responses in { errno, errmsg, result }
    if (data.errno !== 0) {
        throw new Error(`Opinion API error ${data.errno}: ${data.errmsg}`);
    }

    return data.result as T;
}

// --- Types ---

export interface MarketData {
    marketId: number | string;
    market_id?: number | string;
    marketTitle: string;
    market_title?: string;
    status: number; // 1=Created, 2=Activated, 3=Resolving, 4=Resolved, 5=Failed, 6=Deleted
    marketType: number; // 0=Binary, 1=Categorical
    yesTokenId: string;
    yes_token_id?: string;
    yes_token?: string;
    noTokenId: string;
    no_token_id?: string;
    no_token?: string;
    conditionId: string;
    condition_id?: string;
    volume: string;
    volume24h: string;
    volume7d: string;
    quoteToken: string;
    chainId: string;
    createdAt: number;
    cutoffAt: number;
    resolvedAt: number;
    childMarkets?: MarketData[];
}

export interface OrderBookLevel {
    price: string;
    size: string;
}

export interface OrderBook {
    market: string;
    tokenId: string;
    timestamp: number;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
}

export interface PriceData {
    price: string;
    tokenId: string;
}

export interface FeeRates {
    makerFeeRate: string;
    takerFeeRate: string;
}

// --- API methods ---

export async function getMarket(marketId: number | string): Promise<MarketData> {
    if (typeof marketId === 'string' && isNaN(Number(marketId))) {
        return apiFetch<MarketData>(`/market/slug/${marketId}`);
    }
    return apiFetch<MarketData>(`/market/${marketId}`);
}

export async function getOrderbook(tokenId: string): Promise<OrderBook> {
    return apiFetch<OrderBook>(`/token/orderbook?token_id=${tokenId}`);
}

export async function getLatestPrice(tokenId: string): Promise<PriceData> {
    return apiFetch<PriceData>(`/token/latest-price?token_id=${tokenId}`);
}

export async function getFeeRates(tokenId: string): Promise<FeeRates> {
    return apiFetch<FeeRates>(`/token/fee-rates?token_id=${tokenId}`);
}

export async function getCategoricalMarket(marketId: number | string): Promise<MarketData> {
    if (typeof marketId === 'string' && isNaN(Number(marketId))) {
        return apiFetch<MarketData>(`/market/categorical/slug/${marketId}`);
    }
    return apiFetch<MarketData>(`/market/categorical/${marketId}`);
}

export async function resolveSlug(slug: string): Promise<number | null> {
    for (const status of ['activated', 'resolved']) {
        const totalPages = 30;
        const parallelBatches = 5;
        for (let batch = 0; batch < totalPages / parallelBatches; batch++) {
            const pages = Array.from({ length: parallelBatches }, (_, i) => batch * parallelBatches + i + 1);
            const responses = await Promise.all(
                pages.map(p =>
                    fetch(`${BASE_URL}/market?status=${status}&limit=20&page=${p}`, {
                        headers: { 'apikey': getApiKey(), 'Content-Type': 'application/json' },
                        next: { revalidate: 60 }
                    }).then(r => r.json()).catch(() => null)
                )
            );
            let hasData = false;
            for (const data of responses) {
                if (data && data.errno === 0 && data.result?.list?.length) {
                    hasData = true;
                    for (const m of data.result.list) {
                        if (m.slug === slug) return m.marketId || m.market_id;
                    }
                }
            }
            if (!hasData) break;
        }
    }
    return null;
}
