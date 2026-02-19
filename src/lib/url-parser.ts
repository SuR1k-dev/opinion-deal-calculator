// Parse Opinion market URL to extract marketId
// Format: https://app.opinion.trade/detail?topicId=1234

export function parseMarketUrl(url: string): number | null {
    try {
        // Try parsing as full URL
        const parsed = new URL(url);

        // Check it's opinion.trade domain
        if (!parsed.hostname.includes('opinion.trade') && !parsed.hostname.includes('opinion')) {
            // Maybe it's just a number
            const num = parseInt(url.trim(), 10);
            return isNaN(num) ? null : num;
        }

        // Extract topicId from query params
        const topicId = parsed.searchParams.get('topicId');
        if (topicId) {
            const id = parseInt(topicId, 10);
            return isNaN(id) ? null : id;
        }

        // Try path-based: /detail/1234 or /market/1234
        const pathMatch = parsed.pathname.match(/\/(?:detail|market|topic)\/(\d+)/);
        if (pathMatch) {
            return parseInt(pathMatch[1], 10);
        }

        return null;
    } catch {
        // If URL parsing fails, try as plain number
        const num = parseInt(url.trim(), 10);
        return isNaN(num) ? null : num;
    }
}
