# Opinion Platform — Полная справка для разработчика

## 1. Обзор платформы

**Opinion** — prediction market на BNB Chain (chainId: 56). Маркеты бывают Binary (Yes/No) и Categorical (множество исходов). Котировочный токен — USDT (18 decimals).

**Три точки доступа:**
- **OpenAPI** (REST) — read-only данные (маркеты, цены, ордербуки, история)
- **WebSocket** — real-time стримы (ордербук, цена, трейды, ордера)
- **CLOB SDK** (Python) — полный доступ включая трейдинг (ордера, позиции, контракты)

---

## 2. Аутентификация

Один API Key работает для всех трёх интерфейсов.

**Получение ключа:** форма — https://docs.google.com/forms/d/1h7gp8UffZeXzYQ-lv4jcou9PoRNOqMAQhyW4IwZDnII

```
# REST API — заголовок
apikey: YOUR_API_KEY

# WebSocket — query параметр
wss://ws.opinion.trade?apikey=YOUR_API_KEY

# CLOB SDK — параметр клиента
client = Client(apikey='YOUR_API_KEY', ...)
```

---

## 3. OpenAPI (REST)

**Base URL:** `https://proxy.opinion.trade:8443/openapi`
**Rate limit:** 15 req/sec, max 20 items/page

### 3.1 Endpoints

| Endpoint | Method | Описание |
|---|---|---|
| `/market` | GET | Список маркетов с фильтрами |
| `/market/{marketId}` | GET | Детали бинарного маркета |
| `/market/categorical/{marketId}` | GET | Детали категориального маркета |
| `/token/latest-price?token_id=X` | GET | Последняя цена токена |
| `/token/orderbook?token_id=X` | GET | Ордербук токена |
| `/token/price-history?token_id=X` | GET | Историческая цена |
| `/quoteToken` | GET | Список котировочных токенов |
| `/positions/user/{wallet}` | GET | Позиции пользователя |
| `/trade/user/{wallet}` | GET | Трейды пользователя |

### 3.2 Параметры /market

| Параметр | Значения |
|---|---|
| `page` | int, от 1 |
| `limit` | int, max 20 |
| `status` | `activated`, `resolved` (строкой, НЕ числом — `status=4` вернёт ошибку 400) |
| `marketType` | 0=Binary, 1=Categorical (**НЕ** использовать 2=All — вызывает таймаут) |
| `sortBy` | 1=new, 2=ending soon, 3=vol desc, 4=vol asc, 5=vol24h desc, 6=vol24h asc, 7=vol7d desc, 8=vol7d asc |
| `chainId` | string |

### 3.3 Параметры /token/price-history

| Параметр | Значения |
|---|---|
| `token_id` | string (обязательный) |
| `interval` | `1m`, `1h`, `1d`, `1w`, `max` |
| `start_at` | Unix timestamp (seconds) |
| `end_at` | Unix timestamp (seconds) |

### 3.4 Модель MarketData

```
marketId: int — ID маркета
marketTitle: string — заголовок
status: 1=Created, 2=Activated, 3=Resolving, 4=Resolved, 5=Failed, 6=Deleted
marketType: 0=Binary, 1=Categorical
yesTokenId / noTokenId: string — ID токенов
conditionId: string
volume / volume24h / volume7d: string
quoteToken: string — адрес USDT
chainId: string
createdAt / cutoffAt / resolvedAt: int (timestamp)
childMarkets: array (для categorical)
```

### 3.5 Модель Orderbook

```
market: string (conditionId)
tokenId: string
timestamp: int (ms)
bids: [{price, size}] — отсортированы по цене DESC
asks: [{price, size}] — отсортированы по цене ASC
```

### 3.6 Модель PositionData

```
marketId, marketTitle, marketStatus, marketCutoffAt
rootMarketId, rootMarketTitle (для categorical)
outcome, outcomeSide (1=Yes, 2=No)
sharesOwned, sharesFrozen
unrealizedPnl, unrealizedPnlPercent
dailyPnlChange, dailyPnlChangePercent
avgEntryPrice, currentValueInQuoteToken
tokenId, conditionId, quoteToken
claimStatus: 0=CanNotClaim, 1=WaitClaim, 2=Claiming, 3=ClaimFailed, 4=Claimed
```

### 3.7 Формат ответа

```json
{
  "errno": 0,       // 0 = success
  "errmsg": "",
  "result": { ... }
}
```

---

## 4. WebSocket API

**URL:** `wss://ws.opinion.trade?apikey=API_KEY`
**Heartbeat:** каждые 30 сек `{"action":"HEARTBEAT"}`

### 4.1 Каналы (Market)

| Канал | Описание | Подписка |
|---|---|---|
| `market.depth.diff` | Изменение ордербука | `{"action":"SUBSCRIBE","channel":"market.depth.diff","marketId":123}` |
| `market.last.price` | Изменение цены | `{"action":"SUBSCRIBE","channel":"market.last.price","marketId":123}` или `rootMarketId` |
| `market.last.trade` | Новый трейд | `{"action":"SUBSCRIBE","channel":"market.last.trade","marketId":123}` или `rootMarketId` |

**Важно:** `market.depth.diff` работает только для одного binary маркета. Для categorical — подписываться на каждый `marketId` отдельно.

### 4.2 Каналы (User)

| Канал | Описание |
|---|---|
| `trade.order.update` | Обновление ордеров (new/fill/cancel/confirm) |
| `trade.record.new` | Подтверждённый on-chain трейд |

### 4.3 Структура сообщений

**market.depth.diff:**
```json
{"marketId":2764, "tokenId":"...", "outcomeSide":1, "side":"bids", "price":"0.2", "size":"50", "msgType":"market.depth.diff"}
```

**market.last.price:**
```json
{"tokenId":"...", "outcomeSide":1, "price":"0.85", "marketId":2764, "msgType":"market.last.price"}
```

**market.last.trade:**
```json
{"tokenId":"...", "side":"Buy", "outcomeSide":1, "price":"0.85", "shares":"10", "amount":"8.5", "marketId":2764, "msgType":"market.last.trade"}
```

---

## 5. CLOB SDK (Python)

**Установка:** `pip install opinion_clob_sdk`
**Python:** 3.9.10+
**GitHub:** https://github.com/opinion-labs/opinion-clob-sdk

### 5.1 Инициализация клиента

```python
from opinion_clob_sdk import Client

client = Client(
    host='https://proxy.opinion.trade:8443',
    apikey='YOUR_KEY',
    chain_id=56,
    rpc_url='https://bsc-dataseed.binance.org',
    private_key='0x...',
    multi_sig_addr='0x...',
    # optional:
    conditional_tokens_addr='0xAD1a38cEc043e70E83a3eC30443dB285ED10D774',
    multisend_addr='0x998739BFdAAdde7C933B942a68053933098f9EDa',
    market_cache_ttl=300,
    quote_tokens_cache_ttl=3600,
)
```

**Read-only конфигурация (без трейдинга):**
```python
client = Client(
    host='https://proxy.opinion.trade:8443',
    apikey='YOUR_KEY',
    chain_id=56,
    rpc_url='',
    private_key='0x00',
    multi_sig_addr='0x0000000000000000000000000000000000000000'
)
```

### 5.2 Все методы SDK

#### Market Data (read-only, без газа):
| Метод | Описание |
|---|---|
| `get_markets(status, page, limit, topic_type, sort_by)` | Список маркетов |
| `get_market(market_id, use_cache)` | Детали бинарного маркета |
| `get_categorical_market(market_id)` | Детали категориального маркета |
| `get_quote_tokens(use_cache)` | Котировочные токены |
| `get_orderbook(token_id)` | Ордербук |
| `get_latest_price(token_id)` | Последняя цена |
| `get_price_history(token_id, interval, start_at, end_at)` | История цены |
| `get_fee_rates(token_id)` | Комиссии |

#### Trading (требует подпись, без газа):
| Метод | Описание |
|---|---|
| `enable_trading()` | Активация торговли (один раз) |
| `place_order(PlaceOrderDataInput)` | Разместить ордер |
| `place_orders_batch(list)` | Пакетное размещение |
| `cancel_order(order_id)` | Отменить ордер |
| `cancel_orders_batch(order_ids)` | Пакетная отмена |
| `cancel_all_orders(market_id, token_id)` | Отменить все ордера |

#### Portfolio:
| Метод | Описание |
|---|---|
| `get_my_orders(market_id, status, page, limit)` | Мои ордера |
| `get_order_by_id(order_id)` | Ордер по ID |
| `get_my_balances()` | Балансы |
| `get_my_positions(page, limit)` | Позиции |
| `get_my_trades(market_id, page, limit)` | Трейды |

#### Контрактные операции (требуют BNB для газа):
| Метод | Описание |
|---|---|
| `split(market_id, amount)` | USDT → Yes + No токены |
| `merge(market_id, amount)` | Yes + No → USDT |
| `redeem(market_id)` | Выкупить выигрыш |

### 5.3 Размещение ордера

```python
from opinion_clob_sdk.chain.py_order_utils.model.order import PlaceOrderDataInput
from opinion_clob_sdk.chain.py_order_utils.model.sides import OrderSide
from opinion_clob_sdk.chain.py_order_utils.model.order_type import LIMIT_ORDER, MARKET_ORDER

# Limit buy
order = PlaceOrderDataInput(
    marketId=123,
    tokenId='yes_token_id',
    side=OrderSide.BUY,      # 0
    orderType=LIMIT_ORDER,    # 2
    price='0.55',
    makerAmountInQuoteToken=10  # 10 USDT
)
result = client.place_order(order)

# Market sell
order = PlaceOrderDataInput(
    marketId=123,
    tokenId='yes_token_id',
    side=OrderSide.SELL,      # 1
    orderType=MARKET_ORDER,   # 1
    price='0',
    makerAmountInBaseToken=50  # 50 токенов
)
```

### 5.4 Enums

```python
from opinion_clob_sdk.model import TopicType, TopicStatus, TopicStatusFilter

TopicType.BINARY = 0       # Binary (Yes/No)
TopicType.CATEGORICAL = 1  # Categorical

TopicStatus.CREATED = 1
TopicStatus.ACTIVATED = 2
TopicStatus.RESOLVING = 3
TopicStatus.RESOLVED = 4

TopicStatusFilter.ALL = None
TopicStatusFilter.ACTIVATED = "activated"
TopicStatusFilter.RESOLVED = "resolved"
```

### 5.5 Обработка ошибок

```python
from opinion_clob_sdk import InvalidParamError, OpenApiError
from opinion_clob_sdk.chain.exception import BalanceNotEnough, NoPositionsToRedeem, InsufficientGasBalance

response = client.get_markets()
if response.errno == 0:
    markets = response.result.list
else:
    print(f"Error {response.errno}: {response.errmsg}")
```

---

## 6. Smart Contracts (BNB Chain)

| Контракт | Адрес |
|---|---|
| ConditionalTokens | `0xAD1a38cEc043e70E83a3eC30443dB285ED10D774` |
| MultiSend | `0x998739BFdAAdde7C933B942a68053933098f9EDa` |
| USDT | BNB Chain native USDT |
| GnosisSafeProxyFactory | `0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2` |

---

## 7. Ключевые ограничения

- **Rate limit REST:** 15 req/sec
- **Pagination:** max 20 items/page
- **Цены:** 0.01 — 0.99 (вероятность)
- **Decimals:** 18 (все токены)
- **Blockchain:** только BNB Chain (56)
- **WebSocket heartbeat:** каждые 30 сек
- **CLOB SDK:** только Python

---

## 8. Типичные паттерны

### Получить все активные маркеты с ценами
```python
# 1. Получить маркеты
markets = client.get_markets(status=TopicStatusFilter.ACTIVATED, limit=20)

# 2. Для каждого получить цену
for m in markets.result.list:
    price = client.get_latest_price(m.yes_token_id)
```

### Мониторинг ордербука в реальном времени
```python
import websocket, json

ws = websocket.WebSocket()
ws.connect("wss://ws.opinion.trade?apikey=KEY")
ws.send(json.dumps({"action":"SUBSCRIBE","channel":"market.depth.diff","marketId":123}))

while True:
    msg = json.loads(ws.recv())
    if msg.get("msgType") == "market.depth.diff":
        # обновить локальный ордербук
        pass
```

### Пагинация всех маркетов
```python
page = 1
all_markets = []
while True:
    resp = client.get_markets(page=page, limit=20)
    if resp.errno != 0:
        break
    all_markets.extend(resp.result.list)
    if len(resp.result.list) < 20:
        break
    page += 1
```

---

## 9. Opinion Builders Program

Официальная программа для разработчиков. При вступлении дают:
- **API Key с elevated rate limit** (по запросу выше 15 req/sec)
- Доступ к real-time данным (маркеты, трейды, позиции)
- **Гранты и награды** привязанные к usage и ecosystem impact
- Маркетинг через каналы Opinion
- Приватный Discord канал + инженерная поддержка
- Ранний доступ к новым фичам

**Подача:** форма на сайте → получаешь API key + Discord → запрашиваешь elevated limits если нужно.

---

## 10. TypeScript SDK

**Пакет:** `@opinion-labs/opinion-clob-sdk`
**NPM:** https://www.npmjs.com/package/@opinion-labs/opinion-clob-sdk
**Node.js:** 18+, ESM-only (`"type": "module"` в package.json)
**Зависимость:** viem (вместо web3.py)

```bash
npm install @opinion-labs/opinion-clob-sdk
```

```typescript
import { Client, TopicType, TopicStatus, CHAIN_ID_BNB_MAINNET } from '@opinion-labs/opinion-clob-sdk';
```

**Те же методы** что и Python SDK + встроенный WebSocket клиент:
- `createWebSocketClient()` → WS клиент
- `subscribeMarketDepthDiff(marketId, callback)` — ордербук
- `subscribeMarketLastPrice({marketId}, callback)` — цена
- `subscribeMarketLastTrade({marketId}, callback)` — трейды
- `subscribeTradeOrderUpdate({marketId}, callback)` — ордера
- `subscribeTradeRecordNew({marketId}, callback)` — записи трейдов

**Преимущество TS SDK:** WS подписки встроены прямо в SDK, не нужно руками управлять websocket.

---

## 11. Дополнительные REST Endpoints (не в локальных docs)

### Order endpoints (требуют авторизацию — свои ордера)

| Endpoint | Method | Описание |
|---|---|---|
| `/order` | GET | Список своих ордеров (page, limit, marketId, status) |
| `/order/{orderId}` | GET | Детали ордера + связанные трейды |

**Status ордера:** 1=pending, 2=filled, 3=canceled, 4=expired, 5=failed

**OrderData поля:** orderId, status, marketId, marketTitle, side, tradingMethod, outcome, price, orderShares, orderAmount, filledShares, filledAmount, profit, quoteToken, createdAt, expiresAt, trades[]

---

## 12. Проекты (20 штук)

Все проекты строятся на данных Opinion prediction market. Категории: **Data & Stats** (аналитика/визуализация) и **Alpha Signals** (сигналы/алерты).

### 9.1 PulseMap — Category Index
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Real-time индекс категорий — куда идёт внимание и капитал.
**Что делает:** Агрегирует sentiment, объём и ROI по категориям маркетов. Строит live индекс с метриками ротации и моментума.
**API:** `GET /market` (sortBy volume, volume24h, volume7d) → группировка по категориям → расчёт momentum/rotation.

### 9.2 MirrorSpread — Cross-Platform Pricing
**Категория:** Data & Stats | **DAU:** 100-1000
**Суть:** Зеркало цен одного и того же маркета на разных платформах.
**Что делает:** Трекает divergence, сжатие спреда, ценовое лидерство между Opinion и другими платформами (Polymarket, Kalshi, PredictFun).
**API:** Opinion `/token/latest-price` + `/token/orderbook` + API других платформ → сравнение.
**БАЗА:** Готовый проект `E:\Сursor\askterisk\claude\spread` (ForkPO). Упрощённая версия: только Poly+Opinion+Kalshi (без PredictFun), убрать % matching из UI. Нужно: ребрендинг, добавить историю спредов (графики divergence по времени), метрику price leadership, визуализацию spread compression/expansion, заменить торговую лексику на аналитическую.

### 9.3 MarketDNA — Lifecycle Analytics
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Как маркеты эволюционируют от запуска до резолюции.
**Что делает:** Анализирует lifecycle паттерны: ранний bias, спайки волатильности, поздние развороты. Структурные инсайты.
**API:** `/token/price-history` (interval=1h, max) + `/market` (resolved маркеты) → анализ паттернов.

### 9.4 SparkIndex — Early Market Detection
**Категория:** Alpha Signals | **DAU:** 100-1000
**Суть:** Детектит маркеты которые начинают «зажигаться».
**Что делает:** Ранжирует новые маркеты по velocity объёма, росту трейдеров, расширению ликвидности.
**API:** `/market` (sortBy=1 new) → отслеживание volume24h delta → ранжирование.

### 9.5 DepthScope — Liquidity Analysis
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Глубокий анализ качества ликвидности и структуры ордербука.
**Что делает:** Трекает стабильность спреда, дисбаланс ордербука, смещения ликвидности.
**API:** `/token/orderbook` + WS `market.depth.diff` → метрики spread stability, imbalance, depth.

### 9.6 MomentumGrid — Momentum Signals
**Категория:** Alpha Signals | **DAU:** 100-1000
**Суть:** Сетка real-time momentum сигналов по всем маркетам.
**Что делает:** Статистические модели для детекции ускоряющихся сдвигов вероятности и аномального объёма.
**API:** `/token/price-history` + WS `market.last.price` → расчёт momentum (rate of change, z-score).

### 9.7 SignalBeacon — Custom Alerts
**Категория:** Alpha Signals | **DAU:** 1-100
**Суть:** Кастомные алерты на резкие движения и всплески волатильности.
**Что делает:** Пользователь задаёт триггеры (price jump, volume spike, spread change) → мгновенные уведомления.
**API:** WS `market.last.price` + `market.last.trade` + `market.depth.diff` → мониторинг → Telegram/Discord.

### 9.8 RiskAtlas — Portfolio Risk Map
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Визуальная карта экспозиции портфеля и концентрации риска.
**Что делает:** Агрегирует открытые позиции, считает экспозицию, категорийную концентрацию, worst-case loss.
**API:** `/positions/user/{wallet}` → группировка → расчёт risk metrics.

### 9.9 CompareX — Market Comparison
**Категория:** Data & Stats | **DAU:** 100-1000
**Суть:** Сравнение маркетов бок о бок без переключения вкладок.
**Что делает:** Оценка volatility, ликвидности, pricing bias по выбранным маркетам в одном интерфейсе.
**API:** `/market/{id}` + `/token/orderbook` + `/token/price-history` для каждого маркета.

### 9.10 EchoBrief — Weekly Intelligence
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Еженедельная сводка по prediction markets.
**Что делает:** Автогенерация лаконичных отчётов: главные мувры, структурные изменения, тренды категорий.
**API:** `/market` (все маркеты, sortBy volume) + `/token/price-history` → LLM-суммаризация или шаблоны.

### 9.11 FlowShift — Sector Rotation
**Категория:** Alpha Signals | **DAU:** 1-100
**Суть:** Трекинг ротации между секторами в реальном времени.
**Что делает:** Мониторит изменения агрегированного sentiment и потока капитала по категориям.
**API:** `/market` (volume24h по категориям) → отслеживание delta → детекция ротации.

### 9.12 BookPulse — Orderbook Visualization
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Визуализация поведения ордербука.
**Что делает:** Захватывает дисбаланс ордербука и эволюцию глубины по времени.
**API:** WS `market.depth.diff` → сбор snapshots → визуализация heatmap/timeline.

### 9.13 TimeVault — Resolved Markets Archive
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Чистый архив разрезолвленных маркетов.
**Что делает:** Организует прошлые маркеты с фильтрами по категории, волатильности, распределению исходов.
**API:** `/market` (status=resolved) → хранение + фильтрация.

### 9.14 CoMove — Correlation Heatmaps
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Корреляционные heatmaps для prediction markets.
**Что делает:** Rolling correlations между ценовыми сериями, визуализация кластеров связанных маркетов.
**API:** `/token/price-history` для множества маркетов → расчёт rolling correlation matrix.

### 9.15 Voltiq — Volatility Scoring
**Категория:** Alpha Signals | **DAU:** 1-100
**Суть:** Скоринг волатильности, адаптированный для binary pricing.
**Что делает:** Ранжирует маркеты по short-term и long-term волатильности для подсветки нестабильности.
**API:** `/token/price-history` (1m, 1h, 1d) → расчёт std dev / ATR-like метрик.

### 9.16 FilterForge — Custom Market Filtering
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Кастомная фильтрация по измеряемым сигналам.
**Что делает:** Фильтрация по ликвидности, волатильности, sentiment acceleration, возрасту маркета.
**API:** `/market` + `/token/orderbook` + `/token/price-history` → composite filters.

### 9.17 ResolveLens — Resolution Bias Analytics
**Категория:** Data & Stats | **DAU:** 1-100
**Суть:** Аналитика bias в резолюциях и исторических исходах.
**Что делает:** Изучает исторические паттерны резолюций по категориям.
**API:** `/market` (status=resolved, все страницы) → статистика по resultTokenId.

### 9.18 BinarySignals Lab — Quant Indicators
**Категория:** Alpha Signals | **DAU:** 1-100
**Суть:** Квант-индикаторы переосмысленные для prediction markets.
**Что делает:** RSI, breakout detection, probability momentum — адаптированные для binary outcomes.
**API:** `/token/price-history` → расчёт RSI, Bollinger-like bands, momentum indicators.

### 9.19 FinalHour Engine — End-of-Market Analysis
**Категория:** Alpha Signals | **DAU:** 1-100
**Суть:** Анализ поведения в финальной фазе маркетов.
**Что делает:** Трекит ускорение, развороты и необычный объём перед резолюцией.
**API:** `/market` (cutoffAt близко) + `/token/price-history` + WS → анализ паттернов в последние часы.

### 9.20 ProbFlow — Probability Curves
**Категория:** Data & Stats | **DAU:** 100-1000
**Суть:** Графики вероятности, лёгкие для чтения.
**Что делает:** Визуализация сглаженной эволюции вероятности с overlay momentum changes.
**API:** `/token/price-history` → smoothing (EMA/SMA) → визуализация с D3/Chart.js.

---

## 13. Общий стек для проектов

**Backend:** Python (FastAPI) или Node.js
**Frontend:** HTML + Chart.js/D3.js или React
**Data:** Opinion REST API + WebSocket для real-time
**Хранение:** SQLite/PostgreSQL для исторических данных (если нужно)
**Уведомления:** Telegram Bot API / Discord Webhooks

---

## 14. Подводные камни API (Gotchas)

1. **Формат ответа** — поля `errno` и `errmsg`, НЕ `code` и `msg`. Проверять `data.errno !== 0` для ошибки.
2. **status параметр** — строка `"activated"` или `"resolved"`. Числовой `status=4` вернёт `400 Bad Request`.
3. **marketType=2 (All)** — вызывает таймаут/зависание. Не использовать. Без `marketType` API и так вернёт все типы.
4. **Пагинация** — max `limit=20`, `page` начинается с 1. Если маркетов 263, нужно 14 страниц.
5. **Volume** — строка, не число. Нужно `parseFloat(m.volume || '0')`.
6. **Timestamps** — `createdAt`, `resolvedAt`, `cutoffAt` — Unix seconds (не milliseconds).
7. **Categorical markets** — `marketType=1`, дочерние в `childMarkets[]`. У дочерних свои `marketId`, `volume`, `resultTokenId`.
8. **URL API** — только `https://proxy.opinion.trade:8443/openapi`, старый `openapi.opinion.trade` отключён.
9. **URL маркета (фронтенд)** — `https://app.opinion.trade/detail?topicId={marketId}`. Для categorical — `marketId` дочернего маркета.
