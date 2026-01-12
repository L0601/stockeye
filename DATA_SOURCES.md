# Company Parser Data Sources

This document lists the data sources and field mappings used by the Company Parser page.

## 1) Real-time quote / valuation (10jqka realhead)

The primary data source for A-share, HK, and US markets is the 10jqka `realhead` JSONP endpoint.

### Endpoints

- A-share: `https://d.10jqka.com.cn/v6/realhead/hs_{SYMBOL}/last.js`
  - Example: `https://d.10jqka.com.cn/v6/realhead/hs_000547/last.js`
- HK: `https://d.10jqka.com.cn/v6/realhead/hk_{SYMBOL}/last.js`
  - Example: `https://d.10jqka.com.cn/v6/realhead/hk_HK9988/last.js`
- US: `https://d.10jqka.com.cn/v6/realhead/usa_{SYMBOL}/last.js`
  - Example: `https://d.10jqka.com.cn/v6/realhead/usa_TSLA/last.js`

### JSONP shape

```
quotebridge_v6_realhead_{prefix}_{symbol}_last({
  "items": {
    ...fields...
  }
})
```

### Field mapping (items)

- `10` -> Current price (当前)
- `7` -> Open price (今开)
- `6` or `70` -> Previous close (昨收)
  - Code uses `6` first, fallback to `70`
- `8` -> High (最高)
- `9` -> Low (最低)
- `13` -> Volume (成交量)
- `19` -> Amount/Turnover value (成交额)
- `1968584` -> Turnover rate (换手率, %)
- `526792` -> Amplitude % (振幅)
- `199112` -> Change percent % (涨幅)
- `3541450` -> Total market cap (总市值)
- `3475914` -> Float market cap (流通市值)
- `134152` -> PE (static) (市盈率(静))
- `2942` -> PE (市盈率(动))
  - If empty and `profit` == "否", UI shows "亏损"
- `1149395` -> PB (市净率)
- `name` -> Stock name
- `profit` -> Profit flag (used for PE "亏损" display)

## 2) Company page (industry)

Industry is parsed from the stockpage company HTML. This is only used to fill the "所属行业" field.

### Endpoints

- A-share: `https://stockpage.10jqka.com.cn/{SYMBOL}/company/`
  - Example: `https://stockpage.10jqka.com.cn/000547/company/`
- HK: `https://stockpage.10jqka.com.cn/{SYMBOL}/company/`
  - Example: `https://stockpage.10jqka.com.cn/HK9988/company/`
- US: `https://stockpage.10jqka.com.cn/{SYMBOL}/company/`
  - Example: `https://stockpage.10jqka.com.cn/TSLA/company/`

### Extraction rules

1) First try CSS selector:
   - `li.industry a` -> text
2) If not found, fallback to text match:
   - Regex: `所属行业[:：]\\s*([^\\s]+)`

## 3) HTML fallback parsing (not primary)

The code can parse the company page text for these labels when needed:

- "换手"/"换手率" -> Turnover rate
- "成交量" -> Volume
- "成交额" -> Amount

Note: The primary source for these values is the `realhead` endpoint. The HTML fallback exists to avoid empty UI if API data is missing.
