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

// PE 历史分位：history 为 [{date, peTTM}]（按日期倒序，最新在前）
// 取最新一条为当前 PE，按 1/3/5/10 年窗口分别算分位
// 窗口仅在数据实际回溯到接近其起点（留半年容差）时才有效，否则返回 null（不杜撰长周期分位）
export function pePercentiles(history, asOfDateStr) {
  if (!Array.isArray(history) || history.length === 0) return null
  const current = history[0].peTTM
  if (!Number.isFinite(current)) return null
  const asOf = asOfDateStr || history[0].date
  const earliest = history[history.length - 1].date
  const windowPercentile = (years) => {
    // 数据必须回溯到至少 (years - 0.5) 年前，该窗口才算覆盖充分
    if (earliest > minusYears(asOf, Math.max(years - 0.5, 0.5))) return null
    const from = minusYears(asOf, years)
    const vals = history.filter(h => h.date >= from).map(h => h.peTTM)
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

// 成交活跃度：基于日 K（[{date, volume}]，按日期升序）的近一年（~250 个交易日）
// 返回 年均量、量比（近5日均量/年均量）、当前量在近一年的分位；数据不足返回 null
export function volumeStats(klineData) {
  const vols = (klineData || []).map(k => k.volume).filter(Number.isFinite)
  if (vols.length < 20) return null
  const yearVols = vols.slice(-250)
  const avg = yearVols.reduce((a, b) => a + b, 0) / yearVols.length
  if (!(avg > 0)) return null
  const recent = vols.slice(-5)
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const current = vols[vols.length - 1]
  return {
    avgVol: avg,
    recentRatio: recentAvg / avg,
    currentPercentile: computePercentile(yearVols, current),
    sampleDays: yearVols.length
  }
}
