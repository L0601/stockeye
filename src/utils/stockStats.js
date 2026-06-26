// 股票统计指标（纯函数，便于单测）：PE 历史分位、成交活跃度

// 百分位：历史中 ≤ 当前值的占比（0-100）。空数组返回 null
export function computePercentile(values, current) {
  const arr = (values || []).filter(Number.isFinite)
  if (arr.length === 0 || !Number.isFinite(current)) return null
  const countLE = arr.filter(v => v <= current).length
  return (countLE / arr.length) * 100
}

// 把日期串往前推 n 年（支持小数），返回 YYYY-MM-DD
function minusYears(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() - Math.round(n * 365))
  const pad = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 通用历史分位：history 为 [{date, [key]:value}]（按日期倒序，最新在前）
// 取最新一条为当前值，按 1/3/5/10 年窗口分别算分位
// 窗口仅在数据实际回溯到接近其起点（留半年容差）时才有效，否则返回 null（不杜撰长周期分位）
export function metricPercentiles(history, asOfDateStr, key = 'peTTM') {
  if (!Array.isArray(history) || history.length === 0) return null
  const current = history[0][key]
  if (!Number.isFinite(current)) return null
  const asOf = asOfDateStr || history[0].date
  const earliest = history[history.length - 1].date
  const windowPercentile = (years) => {
    // 数据必须回溯到至少 (years - 0.5) 年前，该窗口才算覆盖充分
    if (earliest > minusYears(asOf, Math.max(years - 0.5, 0.5))) return null
    const from = minusYears(asOf, years)
    const vals = history.filter(h => h.date >= from).map(h => h[key]).filter(Number.isFinite)
    if (vals.length < 30) return null
    return computePercentile(vals, current)
  }
  return {
    current,
    p1y: windowPercentile(1),
    p3y: windowPercentile(3),
    p5y: windowPercentile(5),
    p10y: windowPercentile(10),
    totalDays: history.length
  }
}

// PE 历史分位（向后兼容包装，等价于 metricPercentiles(history, asOf, 'peTTM')）
export function pePercentiles(history, asOfDateStr) {
  return metricPercentiles(history, asOfDateStr, 'peTTM')
}

// 取数组末 n 项的均值（n 超过长度则用全部），空数组返回 NaN
function tailMean(arr, n) {
  const slice = arr.slice(-n)
  return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : NaN
}

// 成交活跃度：基于日 K（[{date, volume}]，按日期升序）的近一年（~250 个交易日）
// 返回 年均量、量比（近5日均量/年均量）、当前量在近一年的分位、
// 当日量相对 MA5/MA10/MA20 的倍数（>1 放量，<1 缩量）；数据不足返回 null
export function volumeStats(klineData) {
  const vols = (klineData || []).map(k => k.volume).filter(Number.isFinite)
  if (vols.length < 20) return null
  const yearVols = vols.slice(-250)
  const avg = tailMean(yearVols, yearVols.length)
  if (!(avg > 0)) return null
  const current = vols[vols.length - 1]
  return {
    avgVol: avg,
    recentRatio: tailMean(vols, 5) / avg,
    currentPercentile: computePercentile(yearVols, current),
    currentVsMa5: current / tailMean(vols, 5),
    currentVsMa10: current / tailMean(vols, 10),
    currentVsMa20: current / tailMean(vols, 20),
    sampleDays: yearVols.length
  }
}

// 均线体系：基于日 K（[{close}]，升序）算 MA5/10/20/60/120/250、
// 当前价相对各均线的偏离%、以及多/空头/纠缠排列；数据不足返回 null
const MA_PERIODS = [5, 10, 20, 60, 120, 250]
export function maStats(klineData) {
  const closes = (klineData || []).map(k => k.close).filter(Number.isFinite)
  if (closes.length < 20) return null
  const current = closes[closes.length - 1]
  const mas = MA_PERIODS
    .filter(n => closes.length >= n)
    .map(period => {
      const value = tailMean(closes, period)
      return { period, value, deviation: (current - value) / value * 100 }
    })
  return { current, mas, arrangement: classifyArrangement(mas.map(m => m.value)) }
}

// 均线排列：值序列（短→长）严格递减为多头、严格递增为空头，否则纠缠
function classifyArrangement(values) {
  if (values.length < 2) return '纠缠'
  let desc = true, asc = true
  for (let i = 1; i < values.length; i++) {
    if (values[i] >= values[i - 1]) desc = false
    if (values[i] <= values[i - 1]) asc = false
  }
  if (desc) return '多头'
  if (asc) return '空头'
  return '纠缠'
}

// 价格位置：近一年（~250 日）最高/最低（取 K 线 high/low），
// 当前价（最新收盘）距高低点的%及在区间中的位置；数据不足返回 null
export function priceRangeStats(klineData) {
  const arr = (klineData || []).slice(-250)
  const highs = arr.map(k => k.high).filter(Number.isFinite)
  const lows = arr.map(k => k.low).filter(Number.isFinite)
  const closes = arr.map(k => k.close).filter(Number.isFinite)
  if (highs.length < 20 || lows.length < 20 || !closes.length) return null
  const high = Math.max(...highs)
  const low = Math.min(...lows)
  const current = closes[closes.length - 1]
  const span = high - low
  return {
    high,
    low,
    current,
    fromHigh: high > 0 ? (current - high) / high * 100 : null,
    fromLow: low > 0 ? (current - low) / low * 100 : null,
    position: span > 0 ? (current - low) / span * 100 : null
  }
}

// 风险指标：近一年（~250 日）日收益年化波动率 + 最大回撤（负值）；数据不足返回 null
export function riskStats(klineData) {
  const closes = (klineData || []).slice(-250).map(k => k.close).filter(Number.isFinite)
  if (closes.length < 20) return null
  const rets = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(closes[i] / closes[i - 1] - 1)
  }
  const mean = tailMean(rets, rets.length)
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length
  let peak = closes[0]
  let maxDrawdown = 0
  for (const c of closes) {
    if (c > peak) peak = c
    const dd = (c - peak) / peak
    if (dd < maxDrawdown) maxDrawdown = dd
  }
  return { annualVol: Math.sqrt(variance) * Math.sqrt(250), maxDrawdown }
}

// 财务同比增速：periods/values 为对齐数组（periods 形如 YYYY-MM-DD）
// 对每个报告期匹配上一年同月日的值，返回同比增速%数组（缺失上年同期或非正基数返回 null）
export function computeYoY(periods, values) {
  const valueOf = (p) => {
    const idx = periods.indexOf(p)
    return idx >= 0 ? parseFloat(values[idx]) : NaN
  }
  return periods.map((period) => {
    const cur = parseFloat(values[periods.indexOf(period)])
    const prevPeriod = `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`
    const prev = valueOf(prevPeriod)
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null
    return (cur - prev) / Math.abs(prev) * 100
  })
}
