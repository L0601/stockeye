import { describe, it, expect } from 'vitest'
import {
  computePercentile,
  pePercentiles,
  metricPercentiles,
  volumeStats,
  maStats,
  priceRangeStats,
  riskStats,
  computeYoY
} from './stockStats.js'

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

  it('compares_current_volume_against_ma5_ma10_ma20', () => {
    // 前 15 天量=100，后 5 天量=200，当日(最后一根)=200
    const kline = []
    for (let i = 0; i < 15; i++) kline.push({ volume: 100 })
    for (let i = 0; i < 5; i++) kline.push({ volume: 200 })
    const s = volumeStats(kline)
    // MA5=200 → 当日/MA5=1；MA10=(5*200+5*100)/10=150 → 200/150≈1.33；MA20=(15*100+5*200)/20=125 → 1.6
    expect(s.currentVsMa5).toBeCloseTo(1, 2)
    expect(s.currentVsMa10).toBeCloseTo(200 / 150, 2)
    expect(s.currentVsMa20).toBeCloseTo(200 / 125, 2)
  })
})

describe('metricPercentiles', () => {
  it('computes_percentile_for_arbitrary_metric_key', () => {
    // 倒序：最新 pb=5（最高），其余=2 → 分位接近 100
    const hist = [{ date: '2026-06-01', pb: 5 }]
    for (let i = 1; i < 400; i++) {
      const d = new Date('2026-06-01T00:00:00')
      d.setDate(d.getDate() - i)
      hist.push({ date: d.toISOString().slice(0, 10), pb: 2 })
    }
    const r = metricPercentiles(hist, '2026-06-01', 'pb')
    expect(r.current).toBe(5)
    expect(r.p1y).toBeGreaterThan(95)
  })

  it('returns_null_when_current_metric_missing', () => {
    const hist = [{ date: '2026-06-01', pb: NaN }, { date: '2026-05-01', pb: 2 }]
    expect(metricPercentiles(hist, '2026-06-01', 'pb')).toBeNull()
  })
})

describe('maStats', () => {
  it('flags_bull_arrangement_when_price_trends_up', () => {
    // 收盘单调上升 → 短均线高于长均线（多头排列），当前价高于所有均线
    const kline = Array.from({ length: 250 }, (_, i) => ({ close: i + 1 }))
    const s = maStats(kline)
    expect(s.current).toBe(250)
    expect(s.arrangement).toBe('多头')
    expect(s.mas.every(m => m.value <= s.current)).toBe(true)
  })

  it('flags_bear_arrangement_when_price_trends_down', () => {
    const kline = Array.from({ length: 250 }, (_, i) => ({ close: 250 - i }))
    const s = maStats(kline)
    expect(s.arrangement).toBe('空头')
  })

  it('returns_null_when_too_few_days', () => {
    expect(maStats([{ close: 10 }])).toBeNull()
  })
})

describe('priceRangeStats', () => {
  it('computes_year_high_low_and_position', () => {
    // close 从 1 升到 100；high=close+1, low=close-1
    const kline = Array.from({ length: 100 }, (_, i) => ({
      close: i + 1, high: i + 2, low: i
    }))
    const s = priceRangeStats(kline)
    expect(s.high).toBe(101) // i=99 → high=101
    expect(s.low).toBe(0) // i=0 → low=0
    expect(s.current).toBe(100)
    // 当前接近年内高点 → 位置接近 100%
    expect(s.position).toBeGreaterThan(95)
  })

  it('returns_null_when_no_valid_bars', () => {
    expect(priceRangeStats([])).toBeNull()
  })
})

describe('riskStats', () => {
  it('computes_max_drawdown_from_peak_to_trough', () => {
    // 先从 100 升到 200，再跌到 100 → 最大回撤 = (100-200)/200 = -50%
    const up = Array.from({ length: 11 }, (_, i) => ({ close: 100 + i * 10 })) // 100..200
    const down = Array.from({ length: 10 }, (_, i) => ({ close: 190 - i * 10 })) // 190..100
    const s = riskStats([...up, ...down])
    expect(s.maxDrawdown).toBeCloseTo(-0.5, 2)
    expect(s.annualVol).toBeGreaterThanOrEqual(0)
  })

  it('returns_null_when_too_few_days', () => {
    expect(riskStats([{ close: 10 }])).toBeNull()
  })
})

describe('computeYoY', () => {
  it('matches_same_period_prior_year_and_computes_growth', () => {
    const periods = ['2025-12-31', '2024-12-31', '2023-12-31']
    const values = ['120', '100', '80']
    const r = computeYoY(periods, values)
    expect(r[0]).toBeCloseTo(20, 2) // 120 vs 100
    expect(r[1]).toBeCloseTo(25, 2) // 100 vs 80
    expect(r[2]).toBeNull() // 2022 缺失
  })

  it('returns_null_for_period_without_prior_year_match', () => {
    const r = computeYoY(['2025-03-31'], ['100'])
    expect(r[0]).toBeNull()
  })
})
