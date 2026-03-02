'use client';

import { useState, useCallback } from 'react';
import { parseMarketUrl } from '@/lib/url-parser';
import {
    parseOrderBook,
    simulateMarketOrder,
    simulateLimitOrder,
    calculateBreakEven,
    calculateHedge,
    calculatePartialClose,
    calculateBankrollRisk,
    stressTestSlippage,
    formatUsd,
    formatPrice,
    formatPercent,
    formatShares,
    type ParsedOrderBook,
    type MarketOrderResult,
    type LimitOrderResult,
    type BreakEvenResult,
    type HedgeResult,
    type PartialCloseResult,
    type BankrollRiskResult,
} from '@/lib/calculations';
import Accordion from '@/components/Accordion';

// ==================== TYPES ====================

interface MarketInfo {
    marketId: number | string;
    marketTitle: string;
    status: number;
    yesTokenId: string;
    noTokenId: string;
    cutoffAt: number;
    volume: string;
    childMarkets?: MarketInfo[];
}

// ==================== MAIN PAGE ====================

export default function Home() {
    // --- State: Input ---
    const [urlInput, setUrlInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // --- State: Market Data ---
    const [market, setMarket] = useState<MarketInfo | null>(null);
    const [parentTitle, setParentTitle] = useState('');
    const [outcomes, setOutcomes] = useState<MarketInfo[]>([]);

    const [yesPrice, setYesPrice] = useState(0);
    const [noPrice, setNoPrice] = useState(0);
    const [yesBook, setYesBook] = useState<ParsedOrderBook | null>(null);
    const [noBook, setNoBook] = useState<ParsedOrderBook | null>(null);
    const [feeRate, setFeeRate] = useState(0);

    // --- State: Trade Input ---
    const [tradeAmount, setTradeAmount] = useState('');
    const [tradeSide, setTradeSide] = useState<'YES' | 'NO'>('YES');

    // --- State: Results ---
    const [marketOrderResult, setMarketOrderResult] = useState<MarketOrderResult | null>(null);
    const [limitPrice, setLimitPrice] = useState('');
    const [limitResult, setLimitResult] = useState<LimitOrderResult | null>(null);
    const [breakEvenResult, setBreakEvenResult] = useState<BreakEvenResult | null>(null);
    const [hedgeResult, setHedgeResult] = useState<HedgeResult | null>(null);
    const [partialPercent, setPartialPercent] = useState(50);
    const [partialResult, setPartialResult] = useState<PartialCloseResult | null>(null);
    const [bankroll, setBankroll] = useState('');
    const [bankrollResult, setBankrollResult] = useState<BankrollRiskResult | null>(null);
    const [stressPercent, setStressPercent] = useState(20);
    const [stressResult, setStressResult] = useState<MarketOrderResult | null>(null);

    // ==================== LOAD MARKET ====================

    const loadMarket = useCallback(async (overrideId?: number | string) => {
        setError('');
        if (!overrideId) {
            setMarket(null);
            setParentTitle('');
            setOutcomes([]);
        }
        setMarketOrderResult(null);

        const marketId = overrideId || parseMarketUrl(urlInput);
        if (!marketId) {
            setError('Invalid URL or Market ID. Use format: https://app.opinion.trade/market/slug');
            return;
        }

        setLoading(true);
        try {
            let rawData: any;
            let isParent = false;

            // 1. Try fetching Categorical if "type=multi" is in URL
            if (!overrideId && urlInput.includes('type=multi')) {
                try {
                    const res = await fetch(`/api/market/${marketId}?type=categorical`);
                    if (res.ok) {
                        rawData = await res.json();
                        isParent = true;
                    }
                } catch { /* ignore */ }
            }

            // 2. Try fetching Normal (or handle 10200 fallback)
            if (!rawData) {
                const res = await fetch(`/api/market/${marketId}`);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    // Check for Error 10200, 10218, 10003 -> Try Categorical
                    const errMsg = JSON.stringify(errData).toLowerCase();
                    if (res.status === 500 && (errMsg.includes('10200') || errMsg.includes('10218') || errMsg.includes('10003') || errMsg.includes('not a binary market'))) {
                        console.log('Categorical market error detected, trying categorical endpoint...');
                        const catRes = await fetch(`/api/market/${marketId}?type=categorical`);
                        if (!catRes.ok) {
                            const catErrData = await catRes.json().catch(() => ({}));
                            throw new Error(catErrData.error || `Failed to load market (${catRes.status})`);
                        }
                        rawData = await catRes.json();
                        isParent = true;
                    } else {
                        throw new Error(errData.error || `Failed to load market (${res.status})`);
                    }
                } else {
                    rawData = await res.json();
                }
            }

            const source = rawData.data ? rawData.data : rawData;

            let mSource: any = {};
            let childMarketsList: any[] = [];
            let isParentFound = isParent;

            if (Array.isArray(source)) {
                // Return is directly a list of options
                mSource = { marketTitle: urlInput.split('/').pop() || 'Categorical Market' };
                childMarketsList = source;
                isParentFound = true;
            } else {
                mSource = source?.market || source || {};
                const foundChildren = source?.childMarkets || source?.child_markets || mSource?.childMarkets || mSource?.child_markets || source?.list || mSource?.list;
                if (Array.isArray(foundChildren)) {
                    childMarketsList = foundChildren;
                }
                if (childMarketsList.length > 0) {
                    isParentFound = true;
                }
            }

            // Normalize
            const marketData: MarketInfo = {
                marketId: mSource.marketId ?? mSource.market_id ?? mSource.id ?? 0,
                marketTitle: mSource.marketTitle ?? mSource.market_title ?? mSource.title ?? 'Categorical Market',
                status: mSource.status ?? 0,
                yesTokenId: mSource.yesTokenId || mSource.yes_token_id || mSource.yes_token || mSource.yes_token_addr || mSource.yesToken || mSource.token_yes,
                noTokenId: mSource.noTokenId || mSource.no_token_id || mSource.no_token || mSource.no_token_addr || mSource.noToken || mSource.token_no,
                cutoffAt: (mSource.cutoffAt ?? mSource.cutoff_at ?? mSource.end_time) || 0,
                volume: String(mSource.volume ?? mSource.total_volume ?? mSource.vol ?? '0'),
                childMarkets: childMarketsList
            };

            if (isParentFound || childMarketsList.length > 0) {
                setParentTitle(marketData.marketTitle);
                const children = childMarketsList.map((c: any) => ({
                    marketId: c.marketId ?? c.market_id ?? c.id,
                    marketTitle: c.marketTitle ?? c.market_title ?? c.title,
                    status: c.status,
                    yesTokenId: c.yesTokenId ?? c.yes_token_id ?? c.yes_token,
                    noTokenId: c.noTokenId ?? c.no_token_id ?? c.no_token,
                    cutoffAt: c.cutoffAt ?? c.end_time ?? c.cutoff_at,
                    volume: String(c.volume ?? c.total_volume ?? '0')
                })).sort((a: any, b: any) => parseFloat(String(b.volume)) - parseFloat(String(a.volume)));

                setOutcomes(children);
                setMarket(null);
                setLoading(false);
                return;
            }

            if (!marketData.yesTokenId || !marketData.noTokenId) {
                const keys = Object.keys(source).join(', ');
                console.error('API Response Source:', source);
                throw new Error(`Market tokens (YES/NO) not found. Keys in source: [${keys}]`);
            }

            setMarket(marketData);

            // Fetch prices and orderbooks in parallel
            const [yesPriceRes, noPriceRes, yesBookRes, noBookRes, feesRes] = await Promise.allSettled([
                fetch(`/api/price/${marketData.yesTokenId}`).then(r => r.json()),
                fetch(`/api/price/${marketData.noTokenId}`).then(r => r.json()),
                fetch(`/api/orderbook/${marketData.yesTokenId}`).then(r => r.json()),
                fetch(`/api/orderbook/${marketData.noTokenId}`).then(r => r.json()),
                fetch(`/api/fees/${marketData.yesTokenId}`).then(r => r.json()),
            ]);

            if (yesPriceRes.status === 'fulfilled') setYesPrice(parseFloat(yesPriceRes.value.price || '0'));
            if (noPriceRes.status === 'fulfilled') setNoPrice(parseFloat(noPriceRes.value.price || '0'));
            if (yesBookRes.status === 'fulfilled') setYesBook(parseOrderBook(yesBookRes.value));
            if (noBookRes.status === 'fulfilled') setNoBook(parseOrderBook(noBookRes.value));
            if (feesRes.status === 'fulfilled') {
                const rate = parseFloat(feesRes.value.takerFeeRate || '0');
                setFeeRate(rate);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load market data');
        } finally {
            setLoading(false);
        }
    }, [urlInput]);

    // ==================== CALCULATE ====================

    const calculate = useCallback(() => {
        const amount = parseFloat(tradeAmount);
        if (!amount || amount <= 0) return;

        const book = tradeSide === 'YES' ? yesBook : noBook;
        const oppositeBook = tradeSide === 'YES' ? noBook : yesBook;
        if (!book) return;

        // Market order simulation
        const moResult = simulateMarketOrder(book, amount, tradeSide, true);
        setMarketOrderResult(moResult);

        // Break-even
        if (moResult.positionSize > 0) {
            const beResult = calculateBreakEven(moResult.totalCost, moResult.positionSize, feeRate);
            setBreakEvenResult(beResult);

            // Hedge
            if (oppositeBook) {
                const hResult = calculateHedge(tradeSide, moResult.avgPrice, moResult.positionSize, moResult.totalCost, oppositeBook, feeRate);
                setHedgeResult(hResult);
            }

            // Partial close (default 50%)
            const currentPrice = tradeSide === 'YES' ? yesPrice : noPrice;
            const pcResult = calculatePartialClose(moResult.positionSize, moResult.avgPrice, partialPercent, currentPrice, feeRate);
            setPartialResult(pcResult);

            // Bankroll risk
            const bk = parseFloat(bankroll);
            if (bk > 0) {
                const brResult = calculateBankrollRisk(moResult.totalCost, bk);
                setBankrollResult(brResult);
            }

            // Stress test
            const stResult = stressTestSlippage(book, stressPercent, amount, tradeSide, true);
            setStressResult(stResult);
        }
    }, [tradeAmount, tradeSide, yesBook, noBook, feeRate, yesPrice, noPrice, partialPercent, bankroll, stressPercent]);

    // ==================== HELPERS ====================

    const recalcPartial = (pct: number) => {
        setPartialPercent(pct);
        if (marketOrderResult && marketOrderResult.positionSize > 0) {
            const currentPrice = tradeSide === 'YES' ? yesPrice : noPrice;
            setPartialResult(calculatePartialClose(marketOrderResult.positionSize, marketOrderResult.avgPrice, pct, currentPrice, feeRate));
        }
    };

    const recalcBankroll = (val: string) => {
        setBankroll(val);
        const bk = parseFloat(val);
        if (bk > 0 && marketOrderResult) {
            setBankrollResult(calculateBankrollRisk(marketOrderResult.totalCost, bk));
        }
    };

    const recalcStress = (pct: number) => {
        setStressPercent(pct);
        const amount = parseFloat(tradeAmount);
        const book = tradeSide === 'YES' ? yesBook : noBook;
        if (amount > 0 && book) {
            setStressResult(stressTestSlippage(book, pct, amount, tradeSide, true));
        }
    };

    const recalcLimit = (price: string) => {
        setLimitPrice(price);
        const p = parseFloat(price);
        const book = tradeSide === 'YES' ? yesBook : noBook;
        if (p > 0 && book) {
            setLimitResult(simulateLimitOrder(book, p, true));
        }
    };

    const expiryDate = market?.cutoffAt
        ? new Date(market.cutoffAt * 1000).toLocaleString()
        : '—';

    const riskColor = (zone: string) => {
        if (zone === 'green') return 'text-risk-green';
        if (zone === 'yellow') return 'text-risk-yellow';
        return 'text-risk-red';
    };

    const riskBg = (zone: string) => {
        if (zone === 'green') return 'bg-risk-green/10 border-risk-green/30';
        if (zone === 'yellow') return 'bg-risk-yellow/10 border-risk-yellow/30';
        return 'bg-risk-red/10 border-risk-red/30';
    };

    const formatSlippage = (value: number) => formatPercent(-Math.abs(value));
    const slippageColor = (value: number) => {
        const abs = Math.abs(value);
        if (abs > 2) return 'text-loss';
        if (abs > 0.5) return 'text-risk-yellow';
        return 'text-profit';
    };

    // ==================== RENDER ====================

    return (
        <main className="min-h-screen bg-bg-primary">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-xl border-b border-border/50">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <img src="/icon.png" alt="Icon" className="w-9 h-9 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)] shadow-accent/20" />
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Deal Calculator</h1>
                        <p className="text-xs text-text-muted">opinion.trade</p>
                    </div>
                </div>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
                {/* ========== STEP 1: Market URL Input ========== */}
                <section className="space-y-3">
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        Market Link or ID
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={urlInput}
                            onChange={e => setUrlInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadMarket()}
                            placeholder="https://app.opinion.trade/market/megaeth-airdrop-by"
                            className="flex-1 bg-bg-card border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
                        />
                        <button
                            onClick={() => loadMarket()}
                            disabled={loading || !urlInput.trim()}
                            className="px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-all active:scale-95"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
                                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            ) : 'Load'}
                        </button>
                    </div>
                    {error && (
                        <p className="text-sm text-loss bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">{error}</p>
                    )}
                </section>

                {/* ========== PARENT MARKET / OUTCOMES ========== */}
                {outcomes.length > 0 && !market && (
                    <section className="space-y-4 animate-fade-in mt-4">
                        <div className="px-1">
                            <h2 className="text-sm font-bold text-text-primary leading-tight mb-1">{parentTitle}</h2>
                            <p className="text-xs text-text-muted">Select an outcome to calculate:</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {outcomes.map(child => (
                                <button
                                    key={child.marketId}
                                    onClick={() => loadMarket(child.marketId)}
                                    className="flex items-center justify-between p-3 rounded-xl bg-bg-card border border-border hover:border-accent hover:bg-bg-secondary transition-all text-left group"
                                >
                                    <div className="truncate flex-1 pr-3">
                                        <span className="block font-medium text-sm text-text-primary group-hover:text-white transition-colors truncate">
                                            {child.marketTitle}
                                        </span>
                                        <span className="text-[10px] text-text-muted uppercase tracking-wider">ID: {child.marketId}</span>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs font-mono text-text-secondary group-hover:text-accent-foreground transition-colors">
                                            ${parseFloat(child.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <div className="text-[10px] text-text-muted">Vol</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* ========== MARKET INFO HEADER ========== */}
                {market && (
                    <section className="bg-bg-card border border-border rounded-xl p-4 animate-fade-in space-y-3">
                        <h2 className="font-bold text-base leading-snug">{market.marketTitle}</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Stat label="YES" value={formatPrice(yesPrice)} color="text-yes" />
                            <Stat label="NO" value={formatPrice(noPrice)} color="text-no" />
                            <Stat label="Volume" value={`$${parseFloat(market.volume || '0').toLocaleString()}`} />
                            <Stat label="Expires" value={expiryDate} small />
                        </div>
                        {feeRate > 0 && (
                            <p className="text-xs text-text-muted">Taker fee: {(feeRate * 100).toFixed(2)}%</p>
                        )}
                    </section>
                )}

                {/* ========== STEP 2: Trade Input ========== */}
                {market && (
                    <section className="space-y-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        {/* Side selector */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTradeSide('YES')}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${tradeSide === 'YES'
                                    ? 'bg-yes/20 border-2 border-yes text-yes'
                                    : 'bg-bg-card border-2 border-border text-text-secondary hover:border-yes/40'
                                    }`}
                            >
                                BUY YES
                            </button>
                            <button
                                onClick={() => setTradeSide('NO')}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${tradeSide === 'NO'
                                    ? 'bg-no/20 border-2 border-no text-no'
                                    : 'bg-bg-card border-2 border-border text-text-secondary hover:border-no/40'
                                    }`}
                            >
                                BUY NO
                            </button>
                        </div>

                        {/* Amount + Calculate */}
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                                <input
                                    type="number"
                                    value={tradeAmount}
                                    onChange={e => setTradeAmount(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && calculate()}
                                    placeholder="10,000"
                                    className="w-full bg-bg-card border border-border rounded-xl pl-8 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus transition-colors"
                                />
                            </div>
                            <button
                                onClick={calculate}
                                disabled={!tradeAmount || parseFloat(tradeAmount) <= 0}
                                className="px-6 py-3 bg-gradient-to-r from-accent to-purple-500 hover:from-accent-hover hover:to-purple-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all active:scale-95 animate-pulse-glow"
                            >
                                Calculate
                            </button>
                        </div>
                    </section>
                )}

                {/* ========== RESULTS ========== */}
                {marketOrderResult && marketOrderResult.positionSize > 0 && (
                    <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>

                        {/* ===== Market Order Result ===== */}
                        <section className="bg-bg-card border border-border rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">📊</span>
                                <h3 className="font-bold text-sm">Market Order Simulation</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <BigStat label="Avg Entry Price" value={formatPrice(marketOrderResult.avgPrice)} />
                                <BigStat
                                    label="Slippage"
                                    value={formatSlippage(marketOrderResult.slippagePercent)}
                                    color={slippageColor(marketOrderResult.slippagePercent)}
                                />
                                <Stat label="Position Size" value={formatShares(marketOrderResult.positionSize) + ' shares'} />
                                <Stat label="Total Cost" value={formatUsd(marketOrderResult.totalCost)} />
                                <Stat label="Levels Filled" value={String(marketOrderResult.levelsFilled)} />
                                <Stat label="Best Price" value={formatPrice(marketOrderResult.bestPrice)} />
                            </div>
                            {!marketOrderResult.fullyFilled && (
                                <p className="text-xs text-risk-yellow bg-risk-yellow/10 rounded-lg px-3 py-2">
                                    ⚠ Not enough liquidity. Unfilled: {formatUsd(marketOrderResult.unfilledAmount)}
                                </p>
                            )}
                        </section>

                        {/* ===== Limit Order Simulation ===== */}
                        <Accordion title="Limit Order Simulation" icon="📋">
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={limitPrice}
                                        onChange={e => recalcLimit(e.target.value)}
                                        placeholder="Limit price (e.g. 0.42)"
                                        step="0.01"
                                        min="0.01"
                                        max="0.99"
                                        className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-border-focus"
                                    />
                                </div>
                                {limitResult && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Stat
                                            label="Instant Fill"
                                            value={limitResult.instantFill ? '✅ Yes' : '❌ No'}
                                        />
                                        <Stat label="Volume Ahead" value={formatShares(limitResult.volumeAhead)} />
                                    </div>
                                )}
                            </div>
                        </Accordion>

                        {/* ===== Break-Even ===== */}
                        {breakEvenResult && (
                            <Accordion title="Break-Even Calculator" icon="💰" defaultOpen>
                                <div className="space-y-3">
                                    <BigStat label="Break-Even Price" value={formatPrice(breakEvenResult.breakEvenPrice)} />
                                    <div className="flex gap-2">
                                        {breakEvenResult.targetPrices.map(t => (
                                            <div key={t.percent} className="flex-1 bg-bg-card rounded-lg p-3 text-center border border-border">
                                                <p className="text-xs text-text-muted mb-1">
                                                    {t.percent === 0 ? 'Exit 0%' : `+${t.percent}%`}
                                                </p>
                                                <p className={`text-lg font-bold ${t.percent === 0 ? 'text-text-primary' : 'text-profit'}`}>
                                                    {formatPrice(t.price)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Accordion>
                        )}

                        {/* ===== Hedge Calculator ===== */}
                        {hedgeResult && (
                            <Accordion title="Hedge Calculator" icon="🛡">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Stat
                                            label={`Buy ${tradeSide === 'YES' ? 'NO' : 'YES'}`}
                                            value={formatShares(hedgeResult.hedgeShares) + ' shares'}
                                        />
                                        <Stat label="Hedge Cost" value={formatUsd(hedgeResult.hedgeCost)} />
                                        <Stat label="Hedge Avg Price" value={formatPrice(hedgeResult.hedgeAvgPrice)} />
                                        <Stat
                                            label="Fully Hedged"
                                            value={hedgeResult.fullyHedged ? '✅' : '❌ Partial'}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className={`rounded-lg p-3 text-center border ${hedgeResult.netResultIfYes >= 0 ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'}`}>
                                            <p className="text-xs text-text-muted mb-1">If YES wins</p>
                                            <p className={`text-lg font-bold ${hedgeResult.netResultIfYes >= 0 ? 'text-profit' : 'text-loss'}`}>
                                                {formatUsd(hedgeResult.netResultIfYes)}
                                            </p>
                                        </div>
                                        <div className={`rounded-lg p-3 text-center border ${hedgeResult.netResultIfNo >= 0 ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'}`}>
                                            <p className="text-xs text-text-muted mb-1">If NO wins</p>
                                            <p className={`text-lg font-bold ${hedgeResult.netResultIfNo >= 0 ? 'text-profit' : 'text-loss'}`}>
                                                {formatUsd(hedgeResult.netResultIfNo)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Accordion>
                        )}

                        {/* ===== Partial Close ===== */}
                        <Accordion title="Partial Close" icon="✂️">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="5"
                                        max="95"
                                        step="5"
                                        value={partialPercent}
                                        onChange={e => recalcPartial(parseInt(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="text-sm font-bold w-12 text-right">{partialPercent}%</span>
                                </div>
                                {partialResult && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Stat label="Closed Shares" value={formatShares(partialResult.closedShares)} />
                                        <Stat label="Closed Value" value={formatUsd(partialResult.closedValue)} />
                                        <Stat
                                            label="Realized P&L"
                                            value={formatUsd(partialResult.realizedPnl)}
                                            color={partialResult.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}
                                        />
                                        <Stat label="Remaining" value={formatShares(partialResult.remainingShares)} />
                                        <Stat label="New Break-Even" value={formatPrice(partialResult.newBreakEven)} />
                                        <Stat label="New Max Loss" value={formatUsd(partialResult.newMaxLoss)} />
                                    </div>
                                )}
                            </div>
                        </Accordion>

                        {/* ===== Bankroll Risk ===== */}
                        <Accordion title="Bankroll Risk" icon="🏦">
                            <div className="space-y-3">
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                                    <input
                                        type="number"
                                        value={bankroll}
                                        onChange={e => recalcBankroll(e.target.value)}
                                        placeholder="Your total deposit"
                                        className="w-full bg-bg-card border border-border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-border-focus"
                                    />
                                </div>
                                {bankrollResult && (
                                    <div className={`rounded-xl p-4 border ${riskBg(bankrollResult.zone)} text-center`}>
                                        <p className="text-xs text-text-muted mb-1">Risk of Deposit</p>
                                        <p className={`text-3xl font-black ${riskColor(bankrollResult.zone)}`}>
                                            {bankrollResult.riskPercent.toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-text-muted mt-1">
                                            Max loss: {formatUsd(bankrollResult.maxLoss)}
                                        </p>
                                        <div className="flex justify-center gap-4 mt-2 text-xs">
                                            <span className="text-risk-green">🟢 &lt;5%</span>
                                            <span className="text-risk-yellow">🟡 5-15%</span>
                                            <span className="text-risk-red">🔴 &gt;15%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Accordion>

                        {/* ===== Slippage Stress Test ===== */}
                        <Accordion title="Slippage Stress Test" icon="📈">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-text-muted whitespace-nowrap">Liquidity drop:</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="80"
                                        step="5"
                                        value={stressPercent}
                                        onChange={e => recalcStress(parseInt(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="text-sm font-bold w-12 text-right text-loss">-{stressPercent}%</span>
                                </div>
                                {stressResult && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Stat label="Stressed Avg Price" value={formatPrice(stressResult.avgPrice)} />
                                        <Stat
                                            label="Stressed Slippage"
                                            value={formatSlippage(stressResult.slippagePercent)}
                                            color={slippageColor(stressResult.slippagePercent)}
                                        />
                                        <Stat label="Position Size" value={formatShares(stressResult.positionSize)} />
                                        {!stressResult.fullyFilled && (
                                            <Stat label="Unfilled" value={formatUsd(stressResult.unfilledAmount)} color="text-loss" />
                                        )}
                                    </div>
                                )}
                                {stressResult && marketOrderResult && (
                                    <div className="bg-bg-card rounded-lg p-3 border border-border">
                                        <p className="text-xs text-text-muted mb-1">Price Impact vs Normal</p>
                                        <p className={`text-sm font-bold ${stressResult.avgPrice > marketOrderResult.avgPrice ? 'text-loss' : 'text-profit'}`}>
                                            {formatPrice(stressResult.avgPrice - marketOrderResult.avgPrice)} ({formatPercent(((stressResult.avgPrice - marketOrderResult.avgPrice) / marketOrderResult.avgPrice) * 100)})
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Accordion>

                        {/* ===== Decision Summary ===== */}
                        <section className="bg-gradient-to-br from-accent/10 to-purple-500/10 border border-accent/30 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">📦</span>
                                <h3 className="font-bold text-sm">Decision Summary</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                <SummaryRow label="Avg Entry" value={formatPrice(marketOrderResult.avgPrice)} />
                                <SummaryRow label="Slippage" value={formatSlippage(marketOrderResult.slippagePercent)} valueColor={slippageColor(marketOrderResult.slippagePercent)} />
                                {breakEvenResult && (
                                    <SummaryRow label="Break-Even" value={formatPrice(breakEvenResult.breakEvenPrice)} />
                                )}
                                {breakEvenResult && breakEvenResult.targetPrices[1] && (
                                    <SummaryRow label="Target +5%" value={formatPrice(breakEvenResult.targetPrices[1].price)} valueColor="text-profit" />
                                )}
                                {hedgeResult && (
                                    <>
                                        <SummaryRow label="Hedge Cost" value={formatUsd(hedgeResult.hedgeCost)} />
                                        <SummaryRow label="Hedged P&L" value={formatUsd(hedgeResult.netResultIfYes)} valueColor={hedgeResult.netResultIfYes >= 0 ? 'text-profit' : 'text-loss'} />
                                    </>
                                )}
                                {bankrollResult && (
                                    <SummaryRow label="Bank Risk" value={`${bankrollResult.riskPercent.toFixed(1)}%`} valueColor={riskColor(bankrollResult.zone)} />
                                )}
                                <SummaryRow label="Max Loss" value={formatUsd(marketOrderResult.totalCost)} valueColor="text-loss" />
                            </div>
                        </section>

                    </div>
                )}

                {/* Footer */}
                <footer className="text-center text-xs text-text-muted py-6">
                    Opinion Deal Calculator • Not financial advice • All calculations are estimates
                </footer>
            </div>
        </main>
    );
}

// ==================== SUB-COMPONENTS ====================

function Stat({ label, value, color = 'text-text-primary', small = false }: {
    label: string;
    value: string;
    color?: string;
    small?: boolean;
}) {
    return (
        <div>
            <p className="text-xs text-text-muted mb-0.5">{label}</p>
            <p className={`${small ? 'text-xs' : 'text-sm'} font-semibold ${color} truncate`}>{value}</p>
        </div>
    );
}

function BigStat({ label, value, color = 'text-text-primary' }: {
    label: string;
    value: string;
    color?: string;
}) {
    return (
        <div>
            <p className="text-xs text-text-muted mb-0.5">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
        </div>
    );
}

function SummaryRow({ label, value, valueColor = 'text-text-primary' }: {
    label: string;
    value: string;
    valueColor?: string;
}) {
    return (
        <>
            <span className="text-text-muted">{label}</span>
            <span className={`font-semibold text-right ${valueColor}`}>{value}</span>
        </>
    );
}
