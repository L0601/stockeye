import axios from 'axios'

// 创建axios实例
const request = axios.create({
  timeout: 10000
})

// 市场类型
export const MARKET_TYPE = {
  CN: 'CN',    // A股
  HK: 'HK',    // 港股
  US: 'US'     // 美股
}

// 股票类型
export const STOCK_TYPE = {
  STOCK: 'stock',
  INDEX: 'index',
  ETF: 'etf'
}

const ADJUST_TYPE = {
  QFQ: 'qfq',
  HFQ: 'hfq'
}

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

function formatDateParts(year, month, day) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`
}

function getCNLikeDateKey(date = new Date()) {
  return formatDateParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
}

function getUSDateKey(date = new Date()) {
  const offset = isDST(date) ? 12 : 13
  const usDate = new Date(date.getTime() - offset * 60 * 60 * 1000)
  return formatDateParts(
    usDate.getUTCFullYear(),
    usDate.getUTCMonth() + 1,
    usDate.getUTCDate()
  )
}

function normalizeDateText(text) {
  return String(text || '').trim().replace(/\//g, '-').replace(/\./g, '-')
}

function extractDateKey(text, market) {
  const raw = normalizeDateText(text)
  if (!raw) return ''

  const ymd = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (ymd) {
    return formatDateParts(ymd[1], ymd[2], ymd[3])
  }

  if (market !== MARKET_TYPE.US) return ''

  const mdy = raw.match(/(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (!mdy) return ''
  return formatDateParts(mdy[3], mdy[1], mdy[2])
}

function isQuoteFreshForMarket(market, updateTime) {
  const quoteDate = extractDateKey(updateTime, market)
  if (!quoteDate) return true

  const currentDate = market === MARKET_TYPE.US
    ? getUSDateKey()
    : getCNLikeDateKey()
  return quoteDate === currentDate
}

function resolveQuoteStatus(market, updateTime, inTradingHours) {
  if (!inTradingHours) return 'closed'
  return isQuoteFreshForMarket(market, updateTime) ? 'trading' : 'closed'
}

// 判断是否是美国夏令时（3月第二个周日 - 11月第一个周日）
function isDST(date) {
  const year = date.getFullYear()

  // 3月第二个周日 2:00 AM
  const marchSecondSunday = new Date(year, 2, 1) // 3月1日
  marchSecondSunday.setDate(1 + (7 - marchSecondSunday.getDay()) + 7) // 第二个周日
  marchSecondSunday.setHours(2, 0, 0, 0)

  // 11月第一个周日 2:00 AM
  const novFirstSunday = new Date(year, 10, 1) // 11月1日
  novFirstSunday.setDate(1 + (7 - novFirstSunday.getDay())) // 第一个周日
  novFirstSunday.setHours(2, 0, 0, 0)

  return date >= marchSecondSunday && date < novFirstSunday
}

// 判断A股是否在交易时间（北京时间）
function isCNMarketOpen() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  // 周末不交易
  if (day === 0 || day === 6) return false

  // 交易时间：9:30-11:30, 13:00-15:00（北京时间）
  if ((time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500)) {
    return true
  }

  return false
}

function isCNMarketMiddayBreak() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  if (day === 0 || day === 6) return false

  return time > 1130 && time < 1300
}

// 判断港股是否在交易时间（香港时间 = 北京时间）
function isHKMarketOpen() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  // 周末不交易
  if (day === 0 || day === 6) return false

  // 交易时间：9:30-12:00, 13:00-16:00（香港时间 = 北京时间）
  if ((time >= 930 && time <= 1200) || (time >= 1300 && time <= 1600)) {
    return true
  }

  return false
}

function isHKMarketMiddayBreak() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  if (day === 0 || day === 6) return false

  return time > 1200 && time < 1300
}

// 判断美股是否在交易时间
function isUSMarketOpen() {
  const now = new Date()

  // 转换为美东时间
  // 北京时间 = UTC+8
  // 美东夏令时 EDT = UTC-4，与北京时间相差12小时
  // 美东冬令时 EST = UTC-5，与北京时间相差13小时
  const offset = isDST(now) ? 12 : 13

  // 计算美东时间
  const etHour = (now.getHours() - offset + 24) % 24
  const etMinute = now.getMinutes()
  const etTime = etHour * 100 + etMinute

  // 计算美东的星期几（可能跨天）
  let etDay = now.getDay()
  if (now.getHours() < offset) {
    etDay = (etDay - 1 + 7) % 7
  }

  // 周末不交易
  if (etDay === 0 || etDay === 6) return false

  // 美股交易时间：9:30 AM - 4:00 PM ET
  if (etTime >= 930 && etTime <= 1600) {
    return true
  }

  return false
}

export function isMarketMiddayBreak(market) {
  if (market === MARKET_TYPE.CN) {
    return isCNMarketMiddayBreak()
  }
  if (market === MARKET_TYPE.HK) {
    return isHKMarketMiddayBreak()
  }
  return false
}

function getCNExchangePrefix(symbol) {
  const code = String(symbol || '').trim()
  if (/^(5|6|9|11|13)/.test(code)) return 'sh'
  return 'sz'
}

// 获取股票实时数据
export async function getStockQuote(symbol, market, type = STOCK_TYPE.STOCK) {
  try {
    // 如果是指数类型
    if (type === STOCK_TYPE.INDEX) {
      if (market === MARKET_TYPE.HK) {
        return await getHKIndexQuote(symbol)
      }
      // 其他市场的指数暂不支持
      return null
    }

    // 股票类型
    if (market === MARKET_TYPE.CN) {
      return await getCNStockQuote(symbol)
    } else if (market === MARKET_TYPE.HK) {
      return await getHKStockQuote(symbol)
    } else if (market === MARKET_TYPE.US) {
      return await getUSStockQuote(symbol)
    }
  } catch (error) {
    console.error('获取股票数据失败:', error)
    return null
  }
}

// 获取A股实时数据（新浪接口）
async function getCNStockQuote(symbol) {
  const prefix = getCNExchangePrefix(symbol)
  const url = `/api/sina/list=${prefix}${symbol}`
  const response = await request.get(url)
  const data = response.data

  if (!data) return null

  const arr = data.split('"')[1].split(',')
  if (arr.length < 32) return null

  const updateTime = `${arr[30]} ${arr[31]}`

  return {
    symbol,
    name: arr[0],
    current: parseFloat(arr[3]),
    yesterday: parseFloat(arr[2]),
    open: parseFloat(arr[1]),
    high: parseFloat(arr[4]),
    low: parseFloat(arr[5]),
    volume: parseFloat(arr[8]),
    amount: parseFloat(arr[9]),
    change: parseFloat(arr[3]) - parseFloat(arr[2]),
    changePercent: ((parseFloat(arr[3]) - parseFloat(arr[2])) / parseFloat(arr[2]) * 100).toFixed(2),
    status: resolveQuoteStatus(MARKET_TYPE.CN, updateTime, isCNMarketOpen()),
    updateTime
  }
}

// 获取港股实时数据（新浪接口）
async function getHKStockQuote(symbol) {
  const url = `/api/sina/list=rt_hk${symbol}`
  const response = await request.get(url)
  const data = response.data

  if (!data) return null

  const arr = data.split('"')[1].split(',')
  if (arr.length < 10) return null

  const updateTime = `${arr[17]} ${arr[18]}`

  return {
    symbol,
    name: arr[1], // 使用中文名
    current: parseFloat(arr[6]),
    yesterday: parseFloat(arr[3]),
    open: parseFloat(arr[4]), // 开盘价（不在页面显示）
    high: parseFloat(arr[4]), // 最高价
    low: parseFloat(arr[5]),
    volume: parseFloat(arr[12]),
    amount: parseFloat(arr[11]),
    change: parseFloat(arr[7]),
    changePercent: parseFloat(arr[8]),
    status: resolveQuoteStatus(MARKET_TYPE.HK, updateTime, isHKMarketOpen()),
    updateTime
  }
}

// 获取港股指数实时数据（新浪接口）
async function getHKIndexQuote(symbol) {
  // 恒生科技指数的代码映射
  const indexCodeMap = {
    'HSTECH': 'hkHSTECH'
  }

  const indexCode = indexCodeMap[symbol] || symbol
  const url = `/api/sina/list=rt_${indexCode}`

  try {
    const response = await request.get(url)
    const data = response.data

    if (!data) return null

    const arr = data.split('"')[1].split(',')
    if (arr.length < 10) return null
    const updateTime = `${arr[17]} ${arr[18]}`

    return {
      symbol,
      name: arr[1] || symbol,
      current: parseFloat(arr[6]),
      yesterday: parseFloat(arr[3]),
      open: parseFloat(arr[4]),
      high: parseFloat(arr[4]),
      low: parseFloat(arr[5]),
      volume: 0, // 指数没有成交量
      amount: 0, // 指数没有成交额
      change: parseFloat(arr[7]),
      changePercent: parseFloat(arr[8]),
      status: resolveQuoteStatus(MARKET_TYPE.HK, updateTime, isHKMarketOpen()),
      updateTime
    }
  } catch (error) {
    console.error('获取指数数据失败:', error)
    return null
  }
}

// 获取美股实时数据（新浪接口）
async function getUSStockQuote(symbol) {
  // 去掉交易所后缀 (.oq, .n, .ps等)
  const cleanSymbol = symbol.split('.')[0].toLowerCase()
  const url = `/api/sina/list=gb_${cleanSymbol}`
  const response = await request.get(url)
  const data = response.data

  if (!data) return null

  const arr = data.split('"')[1].split(',')
  if (arr.length < 10) return null
  const updateTime = arr[3]

  return {
    symbol,
    name: arr[0],
    current: parseFloat(arr[1]),
    yesterday: parseFloat(arr[26]),
    open: parseFloat(arr[5]),
    high: parseFloat(arr[6]),
    low: parseFloat(arr[7]),
    volume: parseFloat(arr[10]),
    amount: parseFloat(arr[11]) || 0,
    change: parseFloat(arr[4]),
    changePercent: parseFloat(arr[2]),
    status: resolveQuoteStatus(MARKET_TYPE.US, updateTime, isUSMarketOpen()),
    updateTime
  }
}

// 获取历史K线数据
export async function getStockKLine(symbol, market, period = 'daily', adjust = ADJUST_TYPE.QFQ) {
  try {
    if (market === MARKET_TYPE.CN) return await getCNStockKLine(symbol, period, adjust)
    if (market === MARKET_TYPE.HK) return await getHKStockKLine(symbol, period, adjust)
    if (market === MARKET_TYPE.US) return await getUSStockKLine(symbol, period, adjust)
    return []
  } catch (error) {
    console.error('获取K线数据失败:', error)
    return []
  }
}

// 获取美股K线数据（Yahoo Finance）
async function getUSStockKLine(symbol, period = 'daily', adjust = ADJUST_TYPE.QFQ) {
  const clean = symbol.replace(/^US/i, '').split('.')[0].toUpperCase()
  const query = period === 'monthly'
    ? 'interval=1mo&range=20y'
    : 'interval=1d&range=2y'
  const url = `/api/yahoo/v8/finance/chart/${clean}?${query}`
  const response = await request.get(url)
  const result = response.data?.chart?.result?.[0]
  if (!result) return []
  const { timestamp, indicators } = result
  const quote = indicators.quote[0]
  const adjClose = indicators.adjclose?.[0]?.adjclose || []

  const pickClose = (index) => {
    if (adjust !== ADJUST_TYPE.HFQ) return quote.close[index]
    return Number.isFinite(adjClose[index]) ? adjClose[index] : quote.close[index]
  }

  return timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: parseFloat(quote.open[i]?.toFixed(2)),
    close: parseFloat(pickClose(i)?.toFixed(2)),
    high: parseFloat(quote.high[i]?.toFixed(2)),
    low: parseFloat(quote.low[i]?.toFixed(2)),
    volume: quote.volume[i] || 0
  })).filter(d => !isNaN(d.close))
}

// 获取港股K线数据（腾讯财经接口）
async function getHKStockKLine(symbol, period = 'daily', adjust = ADJUST_TYPE.QFQ) {
  const num = symbol.replace(/^HK/i, '').replace(/^0+/, '') || '0'
  const code = 'hk' + num.padStart(5, '0')
  const qqPeriod = period === 'monthly' ? 'month' : 'day'
  const limit = period === 'monthly' ? 320 : 320
  const url = `/api/qq/appstock/app/fqkline/get?param=${code},${qqPeriod},,,${limit},${adjust}`
  const response = await request.get(url)
  const stockData = response.data?.data?.[code]
  const klineData = period === 'monthly'
    ? stockData?.[`${adjust}month`] || stockData?.month || []
    : stockData?.[`${adjust}day`] || stockData?.day || []
  return klineData.map(item => ({
    date: item[0],
    open: parseFloat(item[1]),
    close: parseFloat(item[2]),
    high: parseFloat(item[3]),
    low: parseFloat(item[4]),
    volume: parseFloat(item[5])
  }))
}

// 获取A股K线数据
async function getCNStockKLine(symbol, period = 'daily', adjust = ADJUST_TYPE.QFQ) {
  const prefix = getCNExchangePrefix(symbol)
  const qqPeriod = period === 'monthly' ? 'month' : 'day'
  const limit = period === 'monthly' ? 320 : 320
  const url = `/api/qq/appstock/app/fqkline/get?param=${prefix}${symbol},${qqPeriod},,,${limit},${adjust}`

  const response = await request.get(url)
  const stockData = response.data?.data?.[`${prefix}${symbol}`]
  const klineData = period === 'monthly'
    ? stockData?.[`${adjust}month`] || stockData?.month || []
    : stockData?.[`${adjust}day`] || stockData?.day || []

  return klineData.map(item => ({
    date: item[0],
    open: parseFloat(item[1]),
    close: parseFloat(item[2]),
    high: parseFloat(item[3]),
    low: parseFloat(item[4]),
    volume: parseFloat(item[5])
  }))
}

// 搜索股票
export async function searchStock(keyword) {
  try {
    // 使用腾讯财经的搜索接口
    const url = `/api/search/s3/?q=${encodeURIComponent(keyword)}&t=all`
    const response = await request.get(url)
    let data = response.data

    if (!data) return []

    // 提取v_hint的值
    const match = data.match(/v_hint="([^"]*)"/)
    if (!match || !match[1]) {
      console.log('未匹配到v_hint')
      return []
    }

    console.log('原始数据:', match[1])

    // 解码Unicode转义序列
    let hintData = match[1]
    try {
      hintData = JSON.parse(`"${hintData}"`)
      console.log('解码后数据:', hintData)
    } catch (e) {
      console.error('解码失败:', e)
    }

    const results = []

    // 用^分割不同的股票，然后解析每个股票
    const items = hintData.split('^').filter(item => item)
    console.log('分割后数组:', items)

    for (const item of items) {
      const parts = item.split('~')
      if (parts.length < 3) continue

      // 判断是否是指数、ETF 或普通股票
      let itemType = STOCK_TYPE.STOCK
      if (parts[4]) {
        if (parts[4].startsWith('GP.I')) {
          itemType = STOCK_TYPE.INDEX
        } else if (parts[4] === 'ETF') {
          itemType = STOCK_TYPE.ETF
        } else if (!parts[4].startsWith('GP')) {
          // 过滤掉衍生品（如窝轮、牛熊证等）
          console.log('过滤掉:', parts[2], parts[4])
          continue
        }
      }

      console.log('添加:', parts[2], parts[1], parts[4], itemType)
      results.push({
        symbol: parts[1],
        name: parts[2],
        market: parts[0].includes('hk') ? MARKET_TYPE.HK :
                parts[0].includes('us') ? MARKET_TYPE.US : MARKET_TYPE.CN,
        code: parts[1],
        type: itemType
      })
    }

    console.log('搜索结果数量:', results.length)
    return results
  } catch (error) {
    console.error('搜索股票失败:', error)
    return []
  }
}

function normalizeCompanySymbol(symbol, market) {
  const raw = String(symbol || '').trim().toUpperCase()
  if (!raw) return ''

  if (market === MARKET_TYPE.HK) {
    return raw.startsWith('HK') ? raw : `HK${raw}`
  }

  if (market === MARKET_TYPE.US) {
    return raw.startsWith('US') ? raw : `US${raw}`
  }

  if (market === MARKET_TYPE.CN) {
    if (raw.startsWith('SH') || raw.startsWith('SZ')) {
      return raw.slice(2)
    }
  }

  return raw
}

export async function getCompanyPage(symbol, market = MARKET_TYPE.CN) {
  const normalized = normalizeCompanySymbol(symbol, market)
  if (!normalized) return ''

  let pageSymbol = market === MARKET_TYPE.US
    ? normalized.replace(/^US/i, '')
    : normalized
  if (market === MARKET_TYPE.HK) {
    const stripped = pageSymbol.replace(/^HK/i, '')
    const numeric = stripped.replace(/^0+/, '')
    pageSymbol = /^\d+$/.test(stripped) ? `HK${numeric || '0'}` : pageSymbol
  }
  const url = `/api/ths/${pageSymbol}/company/`
  const response = await request.get(url, { responseType: 'text' })
  return response.data
}

export async function getFinancePage(symbol, market = MARKET_TYPE.HK) {
  const normalized = normalizeCompanySymbol(symbol, market)
  if (!normalized) return ''

  let pageSymbol = market === MARKET_TYPE.US
    ? normalized.replace(/^US/i, '')
    : normalized
  if (market === MARKET_TYPE.HK) {
    const stripped = pageSymbol.replace(/^HK/i, '')
    const numeric = stripped.replace(/^0+/, '')
    pageSymbol = /^\d+$/.test(stripped) ? `HK${numeric || '0'}` : pageSymbol
  }
  const indexUrl = `/api/ths/${pageSymbol}/finance/`
  const indexResponse = await request.get(indexUrl, { responseType: 'text' })
  const indexHtml = indexResponse.data

  if (!indexHtml) return ''

  const iframeMatch =
    indexHtml.match(/id=\"data-ifm\"[^>]+src=\"([^\"]+)\"/) ||
    indexHtml.match(/id=\"dataifm\"[^>]+src=\"([^\"]+)\"/) ||
    indexHtml.match(/<iframe[^>]+src=\"([^\"]+finance[^\"]*)\"/)
  if (!iframeMatch || !iframeMatch[1]) return ''

  let iframeUrl = iframeMatch[1]
  if (iframeUrl.startsWith('//')) {
    iframeUrl = `https:${iframeUrl}`
  }

  if (iframeUrl.startsWith('http://')) {
    iframeUrl = iframeUrl.replace('http://', 'https://')
  }

  if (iframeUrl.startsWith('#')) {
    return ''
  }

  if (iframeUrl.includes('#')) {
    iframeUrl = iframeUrl.split('#')[0]
  }

  if (iframeUrl.startsWith('https://stockpage.10jqka.com.cn')) {
    iframeUrl = iframeUrl.replace('https://stockpage.10jqka.com.cn', '/api/ths')
  }
  if (iframeUrl.startsWith('https://basic.10jqka.com.cn')) {
    iframeUrl = iframeUrl.replace('https://basic.10jqka.com.cn', '/api/ths-basic-html')
  }
  if (iframeUrl.startsWith('/') && !iframeUrl.startsWith('/api/ths')) {
    iframeUrl = `/api/ths${iframeUrl}`
  }

  const iframeResponse = await request.get(iframeUrl, { responseType: 'text' })
  return iframeResponse.data
}

function parseJsonpPayload(text) {
  const match = String(text || '').match(/\((\{.*\})\)\s*$/)
  if (!match || !match[1]) return null
  try {
    return JSON.parse(match[1])
  } catch (error) {
    console.error('JSONP解析失败:', error)
    return null
  }
}

function loadJsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('JSONP只能在浏览器环境中使用'))
      return
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('JSONP请求超时'))
    }, 8000)

    const cleanup = () => {
      clearTimeout(timeoutId)
      if (script && script.parentNode) {
        script.parentNode.removeChild(script)
      }
      try {
        delete window[callbackName]
      } catch (error) {
        window[callbackName] = undefined
      }
    }

    const script = document.createElement('script')
    window[callbackName] = (data) => {
      cleanup()
      resolve(data)
    }
    script.src = url
    script.async = true
    script.onerror = () => {
      cleanup()
      reject(new Error('JSONP加载失败'))
    }
    document.head.appendChild(script)
  })
}

export async function getCompanyMetrics(symbol, market = MARKET_TYPE.HK) {
  const normalized = normalizeCompanySymbol(symbol, market)
  if (!normalized) return null

  const toNumber = (value) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }

  if (![MARKET_TYPE.HK, MARKET_TYPE.CN, MARKET_TYPE.US].includes(market)) {
    return null
  }

  const prefix = market === MARKET_TYPE.CN ? 'hs' : market === MARKET_TYPE.US ? 'usa' : 'hk'
  const primarySymbol = market === MARKET_TYPE.US ? normalized.replace(/^US/, '') : normalized
  const fallbackSymbol = market === MARKET_TYPE.HK ? normalized.replace(/^HK/i, '') : ''
  const strippedSymbol = market === MARKET_TYPE.HK
    ? (fallbackSymbol || primarySymbol).replace(/^0+/, '')
    : ''
  const hkStrippedSymbol = market === MARKET_TYPE.HK && strippedSymbol ? `HK${strippedSymbol}` : ''

  const fetchJsonp = async (realheadSymbol) => {
    const callbackName = `quotebridge_v6_realhead_${prefix}_${realheadSymbol}_last`
    const url = `https://d.10jqka.com.cn/v6/realhead/${prefix}_${realheadSymbol}/last.js`
    return await loadJsonp(url, callbackName)
  }

  const candidates = []
  const seen = new Set()
  const pushCandidate = (value) => {
    if (!value || seen.has(value)) return
    seen.add(value)
    candidates.push(value)
  }

  pushCandidate(primarySymbol)
  if (market === MARKET_TYPE.HK) {
    pushCandidate(fallbackSymbol)
    pushCandidate(strippedSymbol)
    pushCandidate(hkStrippedSymbol)
  }

  let payload = null
  for (const candidate of candidates) {
    try {
      payload = await fetchJsonp(candidate)
      break
    } catch (error) {
      payload = null
    }
  }

  if (!payload) {
    console.error('JSONP加载失败')
  }

  const record = payload?.items

  if (!record) return null

  const current = toNumber(record['10'])
  const open = toNumber(record['7'])
  const yesterday = toNumber(record['6']) ?? toNumber(record['70'])
  const high = toNumber(record['8'])
  const low = toNumber(record['9'])
  const volume = toNumber(record['13'])
  const amount = toNumber(record['19'])
  const turnover = toNumber(record['1968584'])
  const changePercent = toNumber(record['199112'])
  const amplitude = toNumber(record['526792'])
  const totalMarketCap = toNumber(record['3541450'])
  const floatMarketCap = toNumber(record['3475914'])
  let pe = toNumber(record['2942'])
  const pb = toNumber(record['1149395'])
  const peStatic = toNumber(record['134152'])
  if (pe === null && record['profit'] === '否') {
    pe = '亏损'
  }

  return {
    name: record.name || '',
    current,
    open,
    yesterday,
    high,
    low,
    volume,
    amount,
    turnover,
    amplitude,
    changePercent,
    totalMarketCap,
    floatMarketCap,
    pe,
    pb,
    peStatic
  }
}


// 批量获取股票数据
export async function batchGetStocks(stocks) {
  const promises = stocks.map(stock =>
    getStockQuote(stock.symbol, stock.market, stock.type || STOCK_TYPE.STOCK)
  )

  try {
    const results = await Promise.allSettled(promises)
    return results.map((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        return { ...stocks[index], ...result.value }
      }
      return stocks[index]
    })
  } catch (error) {
    console.error('批量获取数据失败:', error)
    return stocks
  }
}
