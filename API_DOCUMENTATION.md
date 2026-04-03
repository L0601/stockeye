# StockEye 接口文档

本文档基于当前仓库实现整理，代码口径以 [src/api/stock.js](/Users/ltc/Desktop/front-stock/src/api/stock.js) 和 [src/views/CompanyParser.vue](/Users/ltc/Desktop/front-stock/src/views/CompanyParser.vue) 为准，重点说明：

- 哪个页面指标使用哪个接口
- 接口入参、返回字段、字段含义
- 涨跌幅、区间涨跌、振幅等指标如何计算
- A 股、港股、美股代码如何识别，前缀后缀如何转换
- 项目内代理地址与外部真实地址的对应关系

## 1. 总体架构

项目并不直接在页面里请求第三方站点，而是统一走本地代理路径：

| 项目内地址 | 真实上游 | 主要用途 |
| --- | --- | --- |
| `/api/sina/*` | `https://hq.sinajs.cn/*` | A 股 / 港股 / 美股实时行情，港股指数 |
| `/api/qq/*` | `https://web.ifzq.gtimg.cn/*` | A 股 / 港股 K 线 |
| `/api/search/*` | `https://smartbox.gtimg.cn/*` | 股票搜索 |
| `/api/qqquote/*` | `https://qt.gtimg.cn/*` | 预留，当前核心流程未直接使用 |
| `/api/ths/*` | `https://stockpage.10jqka.com.cn/*` | 公司页、财务页入口页 |
| `/api/ths-basic/*` | `https://basic.10jqka.com.cn/*` | 财务页 iframe 内容 |
| `/api/ths-basic-html/*` | `https://basic.10jqka.com.cn/*` | 处理重定向后的财务 HTML |
| `/api/yahoo/*` | `https://query1.finance.yahoo.com/*` | 美股日线 / 月线 |

代理配置见：

- [vite.config.js](/Users/ltc/Desktop/front-stock/vite.config.js)
- [api/[...path].js](/Users/ltc/Desktop/front-stock/api/[...path].js)

## 2. 页面指标和接口对应关系

### 2.1 首页列表 `Home / StockList`

来源：`batchGetStocks -> getStockQuote`

| 页面字段 | 来源接口 | 说明 |
| --- | --- | --- |
| 股票名称 `name` | 实时行情接口 | 直接取接口返回名称 |
| 股票代码 `symbol` | 本地存储 / 搜索结果 | 不由行情接口生成 |
| 当前价 `current` | 实时行情接口 | A/H/US 分市场取值 |
| 涨跌额 `change` | 实时行情接口或本地计算 | A 股为本地 `current - yesterday`，港美股直接取接口字段 |
| 涨跌幅 `changePercent` | 实时行情接口或本地计算 | A 股本地算，港美股直接取接口字段 |
| 成交量 `volume` | 实时行情接口 | 单位保持接口原始单位 |
| 成交额 `amount` | 实时行情接口 | 单位保持接口原始单位 |
| 状态 `status` | 前端本地函数 | 按市场交易时段判断，再结合 `updateTime` 校验数据是否仍是当天 |
| 更新时间 `updateTime` | 实时行情接口 | 各市场格式不同 |

### 2.2 详情页 `StockDetail`

来源：`getStockQuote + getStockKLine`

| 页面字段 | 来源接口 | 说明 |
| --- | --- | --- |
| 当前价、昨收、今开、最高、最低、成交量、成交额 | 实时行情接口 | 与首页同源 |
| 日 K 图 | `getStockKLine(symbol, market, 'daily')` | A/H 走腾讯，美股走 Yahoo |
| 月 K 图 | `getStockKLine(symbol, market, 'monthly')` | 用于展示长周期走势 |
| 长周期指标月线 | `getStockKLine(symbol, market, 'monthly', 'hfq')` | 用后复权月线算 2/3/5/10/20 年涨跌 |
| 5/20/60/120/250 日涨跌 | 日线数组本地计算 | 公式见第 7 节 |
| 2/3/5/10/20 年涨跌 | 后复权月线数组本地计算 | 公式见第 7 节 |

### 2.3 公司解析页 `CompanyParser`

来源：并发请求 5 组数据：

```js
getCompanyMetrics(symbol, market)
getFinancePage(symbol, market)
getStockKLine(symbol, market)
getStockKLine(symbol, market, 'monthly')
getStockKLine(symbol, market, 'monthly', 'hfq')
```

必要时还会补一次：

```js
getCompanyPage(symbol, market)
```

| 页面模块 | 来源接口 | 说明 |
| --- | --- | --- |
| 当前价、今开、昨收、最高、最低 | 同花顺 `realhead` JSONP | 主来源 |
| 换手率、振幅、总市值、流通市值、PE、PB | 同花顺 `realhead` JSONP | 主来源 |
| 所属行业 | 公司页 HTML | `li.industry a` 或正则兜底 |
| 成交量、成交额 | 同花顺 `realhead` 为主，公司页 HTML 为兜底 | 页面最终展示前会统一格式化 |
| 财务数据（营业收入、归母净利润、毛利、营业利润率） | 财务 iframe HTML 中的 `#keyindex` JSON | 解析为 `periods + rows` |
| 技术指标 | 日线 / 月线本地计算 | 与详情页一致 |

## 3. 市场识别与代码规范

### 3.1 市场识别规则

前端通过 `detectMarket` 判断输入属于哪个市场：

| 输入形式 | 判定市场 | 示例 |
| --- | --- | --- |
| 以 `HK` 开头 | 港股 | `HK1810` |
| 全大写英文 | 美股 | `TSLA`、`QQQ` |
| 大写英文 + `.` | 美股 | `BRK.B` |
| 6 位数字 | A 股 | `000547`、`601939` |
| 4~5 位数字 | 港股 | `1810`、`9988`、`01810` |
| 其他情况 | 默认港股 | 为了尽量兜底 |

说明：

- `detectMarket` 只用于前端交互判断，不等于第三方接口的最终编码规则。
- A 股如果传入 `SH601939` / `SZ000001`，后续会被规范化成纯数字代码。
- 美股页面内部会移除 `US` 前缀，仅保留真实 ticker。

### 3.2 各市场代码的标准输入口径

| 市场 | 用户输入推荐 | 项目内部常见形式 | 备注 |
| --- | --- | --- | --- |
| A 股 | `000547`、`601939` | `000547` / `601939` | 公司页可接受 `SH/SZ` 前缀输入，但内部最终去掉 |
| 港股 | `01810`、`9988`、`HK1810` | 列表多为纯数字，财务/公司页多转为 `HKxxxx` | 是否补零取决于接口 |
| 美股 | `TSLA`、`AAPL`、`BRK.B` | `TSLA`、`AAPL` | 新浪实时接口会转小写并拼 `gb_` 前缀 |

### 3.3 各接口实际使用的代码转换规则

#### A 股

| 用途 | 项目入参 | 请求时实际代码 |
| --- | --- | --- |
| 新浪实时行情 | `601939` | `sh601939` |
| 新浪实时行情 | `000547` | `sz000547` |
| 腾讯 K 线 | `601939` | `sh601939` |
| 腾讯 K 线 | `000547` | `sz000547` |
| 同花顺 `realhead` | `601939` | `hs_601939` |
| 公司页 / 财务页 | `SH601939` | `601939` |

A 股交易所前缀规则由 `getCNExchangePrefix` 决定：

- 代码首位是 `5/6/9/11/13` 时，视为 `sh`
- 其他默认 `sz`

也就是说当前项目是按“代码段首位”推断上交所 / 深交所，不额外查询交易所映射表。

#### 港股

| 用途 | 项目入参 | 请求时实际代码 |
| --- | --- | --- |
| 新浪实时行情 | `01810` | `rt_hk01810` |
| 腾讯 K 线 | `01810` | `hk01810` |
| 同花顺 `realhead` | `01810` / `HK1810` | 会依次尝试 `hk_HK01810`、`hk_01810`、`hk_1810`、`hk_HK1810` 等候选 |
| 公司页 / 财务页 | `01810` | `HK1810` |

港股规则要点：

- 公司页 / 财务页偏向 `HK` 前缀，并且会去掉数字前导零，例如 `01810 -> HK1810`。
- 腾讯 K 线要求 `hk` 小写前缀并补成 5 位数字，例如 `1810 -> hk01810`。
- 同花顺 `realhead` 为了兼容不同页面口径，做了多候选重试，所以港股是三地里代码处理最复杂的一类。

#### 美股

| 用途 | 项目入参 | 请求时实际代码 |
| --- | --- | --- |
| 新浪实时行情 | `TSLA` | `gb_tsla` |
| 新浪实时行情 | `AAPL.oq` | `gb_aapl` |
| Yahoo K 线 | `TSLA` | `TSLA` |
| Yahoo K 线 | `USTSLA` | `TSLA` |
| 同花顺 `realhead` | `USTSLA` / `TSLA` | `usa_TSLA` |
| 公司页 / 财务页 | `USTSLA` | `TSLA` |

美股规则要点：

- 新浪实时接口会先去掉交易所后缀，如 `.oq`、`.n`，再转小写。
- Yahoo K 线也会去掉 `US` 前缀和 `.xxx` 后缀。
- 同花顺 `realhead` 使用 `usa_` 前缀，不使用 `gb_`。

## 4. 实时行情接口

统一入口：`getStockQuote(symbol, market, type)`

### 4.1 A 股实时行情

项目方法：`getCNStockQuote`

- 项目地址：`/api/sina/list={prefix}{symbol}`
- 真实地址：`https://hq.sinajs.cn/list={prefix}{symbol}`
- 示例：`/api/sina/list=sh601939`

#### 入参

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `symbol` | `string` | 纯数字 A 股代码，如 `601939` |
| `market` | `'CN'` | A 股 |
| `type` | `'stock'` | 当前只按普通股票逻辑处理 |

#### 返回字段

| 返回字段 | 新浪数组下标 | 含义 |
| --- | --- | --- |
| `name` | `arr[0]` | 股票名称 |
| `open` | `arr[1]` | 今开 |
| `yesterday` | `arr[2]` | 昨收 |
| `current` | `arr[3]` | 当前价 |
| `high` | `arr[4]` | 最高价 |
| `low` | `arr[5]` | 最低价 |
| `volume` | `arr[8]` | 成交量 |
| `amount` | `arr[9]` | 成交额 |
| `change` | 本地计算 | `current - yesterday` |
| `changePercent` | 本地计算 | `(current - yesterday) / yesterday * 100`，保留 2 位小数 |
| `status` | 本地计算 | 根据北京时间交易时段判断，并校验 `updateTime` 日期 |
| `updateTime` | `arr[30] + arr[31]` | 更新日期时间 |

#### 交易时段判断

- 周一到周五
- 09:30-11:30
- 13:00-15:00

### 4.2 港股实时行情

项目方法：`getHKStockQuote`

- 项目地址：`/api/sina/list=rt_hk{symbol}`
- 真实地址：`https://hq.sinajs.cn/list=rt_hk{symbol}`
- 示例：`/api/sina/list=rt_hk01810`

#### 返回字段

| 返回字段 | 新浪数组下标 | 含义 |
| --- | --- | --- |
| `name` | `arr[1]` | 中文名 |
| `yesterday` | `arr[3]` | 昨收 |
| `open` | `arr[4]` | 今开 |
| `high` | `arr[4]` | 当前实现中与 `open` 使用同一字段 |
| `low` | `arr[5]` | 最低 |
| `current` | `arr[6]` | 当前价 |
| `change` | `arr[7]` | 涨跌额 |
| `changePercent` | `arr[8]` | 涨跌幅，接口已给出百分数值 |
| `amount` | `arr[11]` | 成交额 |
| `volume` | `arr[12]` | 成交量 |
| `updateTime` | `arr[17] + arr[18]` | 更新时间 |
| `status` | 本地计算 | 根据香港交易时段判断，并校验 `updateTime` 日期 |

#### 交易时段判断

- 周一到周五
- 09:30-12:00
- 13:00-16:00

### 4.3 港股指数实时行情

项目方法：`getHKIndexQuote`

目前只显式映射：

| 业务代码 | 实际请求代码 |
| --- | --- |
| `HSTECH` | `hkHSTECH` |

请求格式：

- 项目地址：`/api/sina/list=rt_{indexCode}`
- 示例：`/api/sina/list=rt_hkHSTECH`

返回字段与港股实时行情一致，但：

- `volume = 0`
- `amount = 0`

### 4.4 美股实时行情

项目方法：`getUSStockQuote`

- 项目地址：`/api/sina/list=gb_{symbol}`
- 真实地址：`https://hq.sinajs.cn/list=gb_{symbol}`
- 示例：`/api/sina/list=gb_tsla`

#### 代码转换

```js
const cleanSymbol = symbol.split('.')[0].toLowerCase()
```

例如：

- `AAPL` -> `gb_aapl`
- `AAPL.oq` -> `gb_aapl`
- `TSLA.n` -> `gb_tsla`

#### 返回字段

| 返回字段 | 新浪数组下标 | 含义 |
| --- | --- | --- |
| `name` | `arr[0]` | 名称 |
| `current` | `arr[1]` | 当前价 |
| `changePercent` | `arr[2]` | 涨跌幅 |
| `updateTime` | `arr[3]` | 更新时间 |
| `change` | `arr[4]` | 涨跌额 |
| `open` | `arr[5]` | 今开 |
| `high` | `arr[6]` | 最高 |
| `low` | `arr[7]` | 最低 |
| `volume` | `arr[10]` | 成交量 |
| `amount` | `arr[11]` | 成交额，空值时置 0 |
| `yesterday` | `arr[26]` | 昨收 |
| `status` | 本地计算 | 根据美东交易时段判断，并校验 `updateTime` 日期 |

#### 交易时段判断

- 按前端 `isDST` 逻辑估算美东夏令时
- 夏令时：北京时间与美东相差 12 小时
- 冬令时：北京时间与美东相差 13 小时
- 美东周一到周五 09:30-16:00 视为交易中

说明：这里只是前端本地时钟判断，没有处理美股休市日。

## 5. K 线接口

统一入口：`getStockKLine(symbol, market, period = 'daily', adjust = 'qfq')`

### 5.1 A 股 / 港股 K 线（腾讯财经）

#### A 股

- 项目地址：`/api/qq/appstock/app/fqkline/get?param={code},{period},,,{limit},{adjust}`
- 示例：`/api/qq/appstock/app/fqkline/get?param=sh601939,day,,,320,qfq`

#### 港股

- 项目地址：`/api/qq/appstock/app/fqkline/get?param={code},{period},,,{limit},{adjust}`
- 示例：`/api/qq/appstock/app/fqkline/get?param=hk01810,month,,,320,hfq`

#### 入参

| 字段 | 值 | 说明 |
| --- | --- | --- |
| `period` | `day` / `month` | 日线 / 月线 |
| `limit` | `320` | 当前实现固定 320 条 |
| `adjust` | `qfq` / `hfq` | 前复权 / 后复权 |

#### 返回字段

腾讯接口解析后统一输出：

| 字段 | 来源数组下标 | 含义 |
| --- | --- | --- |
| `date` | `item[0]` | 日期 |
| `open` | `item[1]` | 开盘价 |
| `close` | `item[2]` | 收盘价 |
| `high` | `item[3]` | 最高价 |
| `low` | `item[4]` | 最低价 |
| `volume` | `item[5]` | 成交量 |

#### 取值规则

| 周期 | 优先字段 | 兜底字段 |
| --- | --- | --- |
| 日线 | `${adjust}day` | `day` |
| 月线 | `${adjust}month` | `month` |

### 5.2 美股 K 线（Yahoo Finance）

- 项目地址：`/api/yahoo/v8/finance/chart/{symbol}?{query}`
- 示例日线：`/api/yahoo/v8/finance/chart/TSLA?interval=1d&range=2y`
- 示例月线：`/api/yahoo/v8/finance/chart/TSLA?interval=1mo&range=20y`

#### 查询参数

| 业务周期 | Yahoo 参数 |
| --- | --- |
| `daily` | `interval=1d&range=2y` |
| `monthly` | `interval=1mo&range=20y` |

#### 返回字段

项目从 Yahoo `chart.result[0]` 中读取：

| 字段 | 来源 |
| --- | --- |
| `timestamp` | K 线时间戳数组 |
| `indicators.quote[0].open` | 开盘数组 |
| `indicators.quote[0].close` | 收盘数组 |
| `indicators.quote[0].high` | 最高数组 |
| `indicators.quote[0].low` | 最低数组 |
| `indicators.quote[0].volume` | 成交量数组 |
| `indicators.adjclose[0].adjclose` | 复权收盘价数组 |

项目输出结构：

| 字段 | 说明 |
| --- | --- |
| `date` | `timestamp` 转 `YYYY-MM-DD` |
| `open` | 保留 2 位小数 |
| `close` | `qfq` 取 `quote.close`；`hfq` 优先取 `adjclose` |
| `high` | 保留 2 位小数 |
| `low` | 保留 2 位小数 |
| `volume` | 原始成交量 |

说明：

- 当前实现里，美股 `hfq` 实际含义更接近“使用调整后收盘价”，只作用在 `close`，并不会同步改写 `open/high/low`。
- 如果 `adjclose` 缺失，则回退到普通 `close`。

## 6. 搜索接口

项目方法：`searchStock`

- 项目地址：`/api/search/s3/?q={keyword}&t=all`
- 真实地址：`https://smartbox.gtimg.cn/s3/?q={keyword}&t=all`

### 6.1 入参

| 字段 | 说明 |
| --- | --- |
| `keyword` | 股票代码或公司名关键字 |

### 6.2 响应解析

返回值不是标准 JSON，项目从原始文本里提取：

```txt
v_hint="..."
```

然后做两步处理：

1. 用 `JSON.parse("\"...\")` 解码 Unicode 转义
2. 按 `^` 拆股票，按 `~` 拆字段

### 6.3 项目输出字段

| 输出字段 | 来源 | 含义 |
| --- | --- | --- |
| `symbol` | `parts[1]` | 股票代码 |
| `name` | `parts[2]` | 名称 |
| `market` | `parts[0]` | 包含 `hk` 判港股，包含 `us` 判美股，否则判 A 股 |
| `code` | `parts[1]` | 与 `symbol` 同值 |
| `type` | `parts[4]` | `GP.I*` 视为指数，`ETF` 视为 ETF，其他非 `GP*` 衍生品过滤掉 |

### 6.4 搜索类型判断

| `parts[4]` | 项目类型 |
| --- | --- |
| `GP.I...` | `index` |
| `ETF` | `etf` |
| `GP...` | `stock` |
| 非 `GP...` 且非 `ETF` | 过滤，不加入结果 |

## 7. 公司信息与经营指标接口

### 7.1 公司页 HTML

项目方法：`getCompanyPage`

- 项目地址：`/api/ths/{symbol}/company/`
- 真实地址：`https://stockpage.10jqka.com.cn/{symbol}/company/`

#### 代码规范化

| 市场 | 输入 | 请求页代码 |
| --- | --- | --- |
| A 股 | `SH601939` | `601939` |
| A 股 | `000547` | `000547` |
| 港股 | `01810` | `HK1810` |
| 美股 | `USTSLA` | `TSLA` |

#### 当前解析字段

`parseCompanyHtml` 只提取下面几类信息：

| 字段 | 提取方式 |
| --- | --- |
| `industry` | `li.industry a` 优先；`所属行业[:：]` 正则兜底 |
| `turnover` | 文本正则匹配 `换手` / `换手率` |
| `volume` | 文本正则匹配 `成交量` |
| `amount` | 文本正则匹配 `成交额` |

说明：

- `turnover / volume / amount` 在公司页只作为兜底数据。
- 主来源仍然是同花顺 `realhead`。

### 7.2 财务页 HTML

项目方法：`getFinancePage`

请求过程分两步：

1. 访问 `/api/ths/{symbol}/finance/` 获取入口页
2. 从入口页中找到 iframe `src`，再请求真正的财务内容页

#### iframe 提取规则

依次匹配：

```html
id="data-ifm"
id="dataifm"
<iframe ... src="...finance...">
```

#### 地址改写规则

| 原始地址前缀 | 改写后 |
| --- | --- |
| `https://stockpage.10jqka.com.cn` | `/api/ths` |
| `https://basic.10jqka.com.cn` | `/api/ths-basic-html` |
| 纯相对路径 `/...` | `/api/ths/...` |

### 7.3 财务数据解析结构

项目方法：`parseFinanceHtml`

解析点：

- `#keyindex` 文本
- 若不存在，则兜底 `#main`

解析后要求存在：

- `data.title`
- `data.report`

项目最终结构：

```js
{
  periods: data.report[0],
  rows: {
    行名1: data.report[1],
    行名2: data.report[2],
    ...
  }
}
```

### 7.4 当前使用的财务行

页面和复制文案主要消费这些科目：

| 业务指标 | 优先行名 | 备选行名 |
| --- | --- | --- |
| 营业收入 | `营业收入` | `营业总收入` |
| 归母净利润 | `归母净利润` | `净利润` |
| 毛利 | `毛利` | `营业毛利` |
| 营业利润率 | `营业利润率` | `销售净利率`、`销售利润率` |

## 8. 同花顺 `realhead` 指标接口

项目方法：`getCompanyMetrics`

- 地址模板：`https://d.10jqka.com.cn/v6/realhead/{prefix}_{symbol}/last.js`
- 返回格式：JSONP

### 8.1 各市场前缀

| 市场 | 前缀 |
| --- | --- |
| A 股 | `hs` |
| 港股 | `hk` |
| 美股 | `usa` |

### 8.2 JSONP 结构

```js
quotebridge_v6_realhead_{prefix}_{symbol}_last({
  items: {
    ...
  }
})
```

### 8.3 港股候选代码重试

港股会按如下顺序尝试，直到某个接口成功返回：

1. `primarySymbol`
2. `fallbackSymbol`
3. `strippedSymbol`
4. `hkStrippedSymbol`

例如输入 `01810` 时，可能依次尝试：

1. `HK01810`
2. `01810`
3. `1810`
4. `HK1810`

### 8.4 字段映射

项目只读取 `items` 里的这些字段：

| `items` 键 | 项目字段 | 含义 |
| --- | --- | --- |
| `name` | `name` | 名称 |
| `10` | `current` | 当前价 |
| `7` | `open` | 今开 |
| `6` | `yesterday` | 昨收，优先值 |
| `70` | `yesterday` | 昨收兜底值 |
| `8` | `high` | 最高 |
| `9` | `low` | 最低 |
| `13` | `volume` | 成交量 |
| `19` | `amount` | 成交额 |
| `1968584` | `turnover` | 换手率 |
| `526792` | `amplitude` | 振幅 |
| `199112` | `changePercent` | 涨跌幅 |
| `3541450` | `totalMarketCap` | 总市值 |
| `3475914` | `floatMarketCap` | 流通市值 |
| `2942` | `pe` | 市盈率(动) |
| `1149395` | `pb` | 市净率 |
| `134152` | `peStatic` | 市盈率(静) |
| `profit` | `pe` 兜底逻辑 | 若 `2942` 为空且 `profit === "否"`，展示 `亏损` |

### 8.5 页面展示前格式化

公司解析页会把原始指标再格式化一次：

| 字段 | 格式化方式 |
| --- | --- |
| `current/open/yesterday/high/low` | 保留 3 位小数 |
| `volume/amount/totalMarketCap/floatMarketCap` | 转 `万` / `亿` |
| `turnover` | 百分比，最多保留 3 位有效小数 |
| `amplitude` | 百分比，保留 3 位 |
| `changePercent` | 百分比，保留 2 位 |
| `pe/pb/peStatic` | 最多保留 3 位小数 |

## 9. 指标计算公式

### 9.1 实时涨跌额

#### A 股

由前端本地计算：

```txt
涨跌额 = 当前价 - 昨收价
```

#### 港股 / 美股

直接使用新浪接口返回字段：

```txt
涨跌额 = 接口数组中的 change 字段
```

### 9.2 实时涨跌幅

#### A 股

```txt
涨跌幅(%) = (当前价 - 昨收价) / 昨收价 * 100
```

代码中保留 2 位小数，返回字符串。

#### 港股 / 美股

直接使用第三方返回的百分比数值。

### 9.3 振幅

项目不自行计算振幅，直接使用同花顺 `realhead.items['526792']`。

常见金融口径通常是：

```txt
振幅(%) = (最高价 - 最低价) / 昨收价 * 100
```

但在本项目里，展示值以第三方接口原值为准。

### 9.4 换手率

项目不自行计算换手率，直接使用同花顺 `realhead.items['1968584']`。

常见口径通常是：

```txt
换手率(%) = 成交量 / 流通股本 * 100
```

但页面展示仍以接口返回值为准。

### 9.5 区间涨跌（5 日 / 20 日 / 60 日 / 120 日 / 250 日）

详情页与公司解析页都使用同一套公式：

```txt
区间涨跌(%) = (最新收盘价 - N期前收盘价) / N期前收盘价 * 100
```

其中：

- 短周期使用日线数组 `klineData`
- `N=5/20/60/120/250`
- 若数据长度不足或历史收盘价为 0，则返回 `null`

### 9.6 长周期涨跌（2 年 / 3 年 / 5 年 / 10 年 / 20 年）

公式不变，但数据源换成“后复权月线”：

```txt
长周期涨跌(%) = (最新月收盘 - N月前月收盘) / N月前月收盘 * 100
```

其中：

- 数据源：`getStockKLine(symbol, market, 'monthly', 'hfq')`
- `N=24/36/60/120/240`

### 9.7 财务指标图表

公司解析页财务图不是“接口现成指标”，而是把财务页里的原始表格行重新映射后绘图：

| 图表项 | 原始行 |
| --- | --- |
| 营收 | `营业收入` 或 `营业总收入` |
| 归母净利润 | `归母净利润` 或 `净利润` |
| 营业利润率 | `营业利润率` / `销售净利率` / `销售利润率` |

## 10. 交易状态计算

项目的 `status` 并不是第三方返回，而是本地推导：

| 市场 | 状态逻辑 |
| --- | --- |
| A 股 | 先按工作日 09:30-11:30、13:00-15:00 判断理论开盘，再校验 `updateTime` 是否仍为今天 |
| 港股 | 先按工作日 09:30-12:00、13:00-16:00 判断理论开盘，再校验 `updateTime` 是否仍为今天 |
| 美股 | 先按夏令时估算美东工作日 09:30-16:00 判断理论开盘，再校验 `updateTime` 是否仍为当天美东日期 |

补充：

- A 股和港股另有午休判断函数 `isMarketMiddayBreak`
- 如果当前处于理论开盘时段，但第三方返回的 `updateTime` 仍停留在前一个交易日，项目会将状态修正为 `closed`
- 当前实现不使用本地节假日日历，而是采用“正常开闭市规则 + 更新时间校验”的双重判断

## 11. 当前实现里的几个口径注意点

### 11.1 港股实时 `high`

当前代码中：

```js
high: parseFloat(arr[4])
```

也就是说港股 `high` 与 `open` 使用了相同下标。文档这里按“当前实现”记录，如果后续要修正，建议一并核对新浪港股字段定义。

### 11.2 美股后复权只影响收盘价

Yahoo 的 `hfq` 在当前实现中只替换 `close`，不会同步替换 `open/high/low`。所以长周期涨跌可用，但若要做严格复权 K 线展示，需要进一步增强。

### 11.3 公司页成交数据只是兜底

`parseCompanyHtml` 能从 HTML 文本里抓 `换手/成交量/成交额`，但主数据源仍是 `realhead`。如果两边冲突，以 `realhead` 为主。

### 11.4 代码规范化不完全等同于搜索返回值

搜索接口返回的 `symbol` 可以直接入库，但不同接口发请求时还会继续做二次转换，所以看到同一只股票在不同请求里出现：

- `01810`
- `HK1810`
- `hk01810`
- `rt_hk01810`
- `hk_HK1810`

这是当前实现的正常现象，不是重复股票。

## 12. 代码定位

如需继续维护，优先看这些文件：

- [src/api/stock.js](/Users/ltc/Desktop/front-stock/src/api/stock.js)
- [src/views/StockDetail.vue](/Users/ltc/Desktop/front-stock/src/views/StockDetail.vue)
- [src/views/CompanyParser.vue](/Users/ltc/Desktop/front-stock/src/views/CompanyParser.vue)
- [vite.config.js](/Users/ltc/Desktop/front-stock/vite.config.js)
- [api/[...path].js](/Users/ltc/Desktop/front-stock/api/[...path].js)

## 13. 后续可补充项

如果后面要把这份文档继续升级，建议补下面三块：

1. 给新浪 / 腾讯 / 同花顺各市场字段下标补官方或实际抓包样例。
2. 若后续需要更高准确度，再补充半日市、临时休市、停牌等特殊交易状态。
3. 把“接口原始返回示例”整理成附录，方便联调和排查字段变动。
