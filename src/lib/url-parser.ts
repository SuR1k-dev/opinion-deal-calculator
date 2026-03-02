// Parse Opinion market URL to extract marketId or slug
// Format: https://app.opinion.trade/detail?topicId=1234
// Format: https://app.opinion.trade/market/megaeth-airdrop-by

export function parseMarketUrl(url: string): string | null {
    try {
        const urlObj = new URL(url);

        if (!urlObj.hostname.includes('opinion.trade') && !urlObj.hostname.includes('opinion')) {
            const rawId = url.trim();
            return rawId ? rawId : null;
        }

        const topicId = urlObj.searchParams.get('topicId');
        if (topicId) {
            return topicId;
        }

        const pathMatch = urlObj.pathname.match(/\/(?:detail|market|topic)\/([^/]+)/);
        if (pathMatch) {
            return pathMatch[1];
        }

        return null;
    } catch {
        const rawId = url.trim();
        return rawId ? rawId : null;
    }
}
