// ====================================================================
// Opinion Deal Calculator — Core Calculation Engine
// All functions are pure, deterministic, no side effects.
// ====================================================================

// --- Types ---

export interface OrderBookLevel {
    price: number;
    size: number;
}

export interface ParsedOrderBook {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
}

export interface Fill {
    price: number;
    size: number;
    cost: number;
}

export interface MarketOrderResult {
    avgPrice: number;
    slippage: number;        // as decimal (0.02 = 2%)
    slippagePercent: number;  // 2.0
    totalCost: number;
    positionSize: number;
    levelsFilled: number;
    fills: Fill[];
    bestPrice: number;
    fullyFilled: boolean;
    unfilledAmount: number;
}

export interface LimitOrderResult {
    instantFill: boolean;
    queuePosition: number;   // volume ahead in the queue
    volumeAhead: number;
    limitPrice: number;
}

export interface BreakEvenResult {
    breakEvenPrice: number;
    targetPrices: { percent: number; price: number }[];
}

export interface HedgeResult {
    hedgeShares: number;
    hedgeCost: number;
    hedgeAvgPrice: number;
    netResultIfYes: number;
    netResultIfNo: number;
    hedgeFills: Fill[];
    fullyHedged: boolean;
}

export interface PartialCloseResult {
    closedShares: number;
    closedValue: number;
    realizedPnl: number;
    remainingShares: number;
    newBreakEven: number;
    newMaxLoss: number;
}

export interface BankrollRiskResult {
    riskPercent: number;
    maxLoss: number;
    zone: 'green' | 'yellow' | 'red';
}

// --- Helpers ---

export function parseOrderBook(raw: { bids: { price: string; size: string }[]; asks: { price: string; size: string }[] }): ParsedOrderBook {
    return {
        bids: (raw.bids || []).map(l => ({
            price: parseFloat(l.price),
            size: parseFloat(l.size),
        })).sort((a, b) => b.price - a.price), // bids: highest first
        asks: (raw.asks || []).map(l => ({
            price: parseFloat(l.price),
            size: parseFloat(l.size),
        })).sort((a, b) => a.price - b.price), // asks: lowest first
    };
}

// --- FUNCTION 1: Market Order Simulation ---

export function simulateMarketOrder(
    orderbook: ParsedOrderBook,
    amount: number,      // in USDT
    side: 'YES' | 'NO',
    isBuy: boolean = true
): MarketOrderResult {
    // BUY YES → consume asks of YES book
    // BUY NO  → consume asks of NO book
    // SELL YES → consume bids of YES book
    // SELL NO  → consume bids of NO book
    const levels = isBuy ? [...orderbook.asks] : [...orderbook.bids];

    if (levels.length === 0) {
        return {
            avgPrice: 0, slippage: 0, slippagePercent: 0,
            totalCost: 0, positionSize: 0, levelsFilled: 0,
            fills: [], bestPrice: 0, fullyFilled: false,
            unfilledAmount: amount,
        };
    }

    const bestPrice = levels[0].price;
    let remainingAmount = amount;
    let totalSize = 0;
    let totalCost = 0;
    const fills: Fill[] = [];

    for (const level of levels) {
        if (remainingAmount <= 0) break;

        const levelCost = level.price * level.size;

        if (levelCost <= remainingAmount) {
            // Consume entire level
            fills.push({ price: level.price, size: level.size, cost: levelCost });
            totalSize += level.size;
            totalCost += levelCost;
            remainingAmount -= levelCost;
        } else {
            // Partial fill of this level
            const fillSize = remainingAmount / level.price;
            fills.push({ price: level.price, size: fillSize, cost: remainingAmount });
            totalSize += fillSize;
            totalCost += remainingAmount;
            remainingAmount = 0;
        }
    }

    const avgPrice = totalSize > 0 ? totalCost / totalSize : 0;
    const slippage = bestPrice > 0 ? (avgPrice - bestPrice) / bestPrice : 0;

    return {
        avgPrice,
        slippage,
        slippagePercent: slippage * 100,
        totalCost,
        positionSize: totalSize,
        levelsFilled: fills.length,
        fills,
        bestPrice,
        fullyFilled: remainingAmount <= 0.001,
        unfilledAmount: remainingAmount,
    };
}

// --- FUNCTION 2: Limit Order Simulation ---

export function simulateLimitOrder(
    orderbook: ParsedOrderBook,
    limitPrice: number,
    isBuy: boolean
): LimitOrderResult {
    if (isBuy) {
        // If limit price >= best ask → instant fill
        const bestAsk = orderbook.asks.length > 0 ? orderbook.asks[0].price : Infinity;
        if (limitPrice >= bestAsk) {
            return { instantFill: true, queuePosition: 0, volumeAhead: 0, limitPrice };
        }
        // Calculate queue position among bids at same price
        let volumeAhead = 0;
        for (const bid of orderbook.bids) {
            if (bid.price > limitPrice) {
                // Higher priority bids
                continue;
            }
            if (Math.abs(bid.price - limitPrice) < 0.001) {
                volumeAhead += bid.size;
            }
        }
        return { instantFill: false, queuePosition: volumeAhead, volumeAhead, limitPrice };
    } else {
        // SELL: If limit price <= best bid → instant fill
        const bestBid = orderbook.bids.length > 0 ? orderbook.bids[0].price : 0;
        if (limitPrice <= bestBid) {
            return { instantFill: true, queuePosition: 0, volumeAhead: 0, limitPrice };
        }
        let volumeAhead = 0;
        for (const ask of orderbook.asks) {
            if (ask.price < limitPrice) {
                continue;
            }
            if (Math.abs(ask.price - limitPrice) < 0.001) {
                volumeAhead += ask.size;
            }
        }
        return { instantFill: false, queuePosition: volumeAhead, volumeAhead, limitPrice };
    }
}

// --- FUNCTION 3: Break-Even Calculator ---

export function calculateBreakEven(
    investment: number,    // total cost paid
    positionSize: number,  // shares received
    feeRate: number = 0,   // e.g. 0.02 = 2%
    targets: number[] = [0, 5, 10]
): BreakEvenResult {
    // On binary market, each share pays $1 if wins, $0 if loses.
    // Break-even: you need shares * price = investment + fees
    // Price at which selling covers cost:
    // breakEvenPrice = (investment + exit_fees) / positionSize
    // exit_fees = positionSize * breakEvenPrice * feeRate
    // So: breakEvenPrice = investment / (positionSize * (1 - feeRate))

    const breakEvenPrice = investment / (positionSize * (1 - feeRate));

    const targetPrices = targets.map(pct => {
        // Target: investment * (1 + pct/100) = positionSize * targetPrice * (1 - feeRate)
        const targetPrice = (investment * (1 + pct / 100)) / (positionSize * (1 - feeRate));
        return { percent: pct, price: Math.min(targetPrice, 1) }; // price capped at 1.00
    });

    return { breakEvenPrice: Math.min(breakEvenPrice, 1), targetPrices };
}

// --- FUNCTION 4: Hedge Calculator ---

export function calculateHedge(
    side: 'YES' | 'NO',
    entryPrice: number,       // average entry price
    positionSize: number,     // shares owned
    totalCost: number,        // total investment
    oppositeOrderbook: ParsedOrderBook,  // orderbook for the opposite side
    feeRate: number = 0
): HedgeResult {
    // Binary market: YES + NO = $1 per share
    // If you own Q shares of YES at avg price Pe, total cost = Q * Pe
    // To hedge: buy H shares of NO
    //
    // If YES wins: profit = Q * 1 - totalCost - hedgeCost = Q - totalCost - hedgeCost
    // If NO wins:  profit = H * 1 - totalCost - hedgeCost = H - totalCost - hedgeCost
    // (here totalCost includes original investment)
    //
    // For perfect hedge (equal outcome):
    // Q - totalCost - hedgeCost = H - totalCost - hedgeCost
    // => Q = H
    // So we need H = Q shares of opposite side.
    //
    // But hedgeCost depends on the orderbook for opposite side.

    const hedgeResult = simulateMarketOrder(oppositeOrderbook, Infinity, side === 'YES' ? 'NO' : 'YES', true);

    // We want H = positionSize shares of opposite
    // Walk the opposite asks to get H shares
    const oppositeAsks = [...oppositeOrderbook.asks];
    let remainingShares = positionSize;
    let hedgeCost = 0;
    const hedgeFills: Fill[] = [];

    for (const level of oppositeAsks) {
        if (remainingShares <= 0) break;

        if (level.size <= remainingShares) {
            const cost = level.price * level.size;
            hedgeFills.push({ price: level.price, size: level.size, cost });
            hedgeCost += cost;
            remainingShares -= level.size;
        } else {
            const cost = level.price * remainingShares;
            hedgeFills.push({ price: level.price, size: remainingShares, cost });
            hedgeCost += cost;
            remainingShares = 0;
        }
    }

    const hedgeShares = positionSize - remainingShares;
    const hedgeAvgPrice = hedgeShares > 0 ? hedgeCost / hedgeShares : 0;

    // Fee on hedge purchase
    const hedgeFee = hedgeCost * feeRate;
    const totalHedgeCost = hedgeCost + hedgeFee;

    // Outcomes:
    // If YES wins: positionSize * 1 - totalCost - totalHedgeCost
    // If NO wins: hedgeShares * 1 - totalCost - totalHedgeCost
    const totalInvestment = totalCost + totalHedgeCost;
    const netResultIfYes = positionSize * 1 - totalInvestment;
    const netResultIfNo = hedgeShares * 1 - totalInvestment;

    return {
        hedgeShares,
        hedgeCost: totalHedgeCost,
        hedgeAvgPrice,
        netResultIfYes,
        netResultIfNo,
        hedgeFills,
        fullyHedged: remainingShares <= 0.001,
    };
}

// --- FUNCTION 5: Partial Close Calculator ---

export function calculatePartialClose(
    positionSize: number,
    avgEntryPrice: number,
    closePercent: number,     // 0-100
    currentPrice: number,
    feeRate: number = 0
): PartialCloseResult {
    const closedShares = positionSize * (closePercent / 100);
    const remainingShares = positionSize - closedShares;

    // Value when selling at current price
    const closedValue = closedShares * currentPrice * (1 - feeRate);
    const costBasis = closedShares * avgEntryPrice;
    const realizedPnl = closedValue - costBasis;

    // New break-even for remaining position
    const remainingCost = remainingShares * avgEntryPrice;
    const adjustedCost = remainingCost - Math.max(0, realizedPnl); // profit reduces cost basis
    const newBreakEven = remainingShares > 0
        ? Math.max(0, adjustedCost / (remainingShares * (1 - feeRate)))
        : 0;

    // Max loss = remaining investment (if market resolves to 0)
    const newMaxLoss = remainingShares * avgEntryPrice;

    return {
        closedShares,
        closedValue,
        realizedPnl,
        remainingShares,
        newBreakEven: Math.min(newBreakEven, 1),
        newMaxLoss,
    };
}

// --- FUNCTION 6: Bankroll Risk ---

export function calculateBankrollRisk(
    maxLoss: number,
    bankroll: number
): BankrollRiskResult {
    if (bankroll <= 0) {
        return { riskPercent: 100, maxLoss, zone: 'red' };
    }
    const riskPercent = (maxLoss / bankroll) * 100;
    let zone: 'green' | 'yellow' | 'red';
    if (riskPercent < 5) zone = 'green';
    else if (riskPercent <= 15) zone = 'yellow';
    else zone = 'red';

    return { riskPercent, maxLoss, zone };
}

// --- FUNCTION 7: Slippage Stress Test ---

export function stressTestSlippage(
    orderbook: ParsedOrderBook,
    liquidityDropPercent: number, // 0-100
    amount: number,
    side: 'YES' | 'NO',
    isBuy: boolean = true
): MarketOrderResult {
    const factor = 1 - liquidityDropPercent / 100;
    const stressedBook: ParsedOrderBook = {
        bids: orderbook.bids.map(l => ({ ...l, size: l.size * factor })),
        asks: orderbook.asks.map(l => ({ ...l, size: l.size * factor })),
    };
    return simulateMarketOrder(stressedBook, amount, side, isBuy);
}

// --- Formatting helpers ---

export function formatUsd(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatPrice(value: number): string {
    if (value >= 1) return '1.00';
    if (value <= 0) return '0.00';
    return value.toFixed(4);
}

export function formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatShares(value: number): string {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value);
}
