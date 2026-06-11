import { describe, it, expect } from 'vitest'
import { computePercentile, pePercentiles, volumeStats } from './stockStats.js'

describe('computePercentile', () => {
  it('returns_100_when_current_is_max', () => {
    expect(computePercentile([1, 2, 3, 4], 4)).toBe(100)
  })

  it('returns_25_when_only_smallest_is_le_current', () => {
    expect(computePercentile([10, 20, 30, 40], 10)).toBe(25)
  })

  it('returns_null_for_empty_or_invalid', () => {
    expect(computePercentile([], 5)).toBeNull()
    expect(computePercentile([1, 2], NaN)).toBeNull()
  })
})

// 构造跨多年的历史序列（倒序，最新在前），按天步进，i=0 为最新
function buildHistory(asOf, years, peFn) {
  const out = []
  const start = new Date(`${asOf}T00:00:00`)
  const days = Math.round(years * 365)
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() - i)
    out.push({ date: d.toISOString().slice(0, 10), peTTM: peFn(i) })
  }
  return out
}

describe('pePercentiles', () => {
  it('takes_latest_as_current_and_differs_by_window', () => {
    // 最新 PE=50（偏高）；近1年其它都 < 50，更早(>5年)出现 70 高位
    const asOf = '2026-06-01'
    const hist = buildHistory(asOf, 10, (i) => {
      if (i === 0) return 50
      return i < 365 ? 30 : (i > 1825 ? 70 : 35)
    })
    const r = pePercentiles(hist, asOf)
    expect(r.current).toBe(50)
    // 近1年：50 高于全部样本 → 接近 100
    expect(r.p1y).toBeGreaterThan(95)
    // 近10年：存在大量 70 的高位 → 当前 50 的分位明显更低
    expect(r.p10y).toBeLessThan(r.p1y)
  })

  it('returns_null_window_when_history_does_not_span_window', () => {
    const asOf = '2026-06-01'
    const hist = buildHistory(asOf, 1.4, () => 25) // 仅 ~1.4 年数据
    const r = pePercentiles(hist, asOf)
    expect(r.p1y).not.toBeNull()
    expect(r.p10y).toBeNull() // 数据没有回溯到 10 年前 → 该窗口无意义
  })

  it('returns_null_for_empty_history', () => {
    expect(pePercentiles([], '2026-06-01')).toBeNull()
  })
})

describe('volumeStats', () => {
  it('computes_avg_ratio_and_percentile', () => {
    // 250 天，前245天量=100，最后5天量=200 → 量比≈接近2，当前为最大→分位100
    const kline = []
    for (let i = 0; i < 245; i++) kline.push({ volume: 100 })
    for (let i = 0; i < 5; i++) kline.push({ volume: 200 })
    const s = volumeStats(kline)
    expect(s.recentRatio).toBeGreaterThan(1.5)
    expect(s.currentPercentile).toBe(100)
    expect(s.avgVol).toBeGreaterThan(100)
  })

  it('returns_null_when_too_few_days', () => {
    expect(volumeStats([{ volume: 100 }])).toBeNull()
    expect(volumeStats([])).toBeNull()
  })
})
