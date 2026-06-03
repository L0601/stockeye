import { describe, it, expect } from 'vitest'
import { buildAnalysisMessages } from './aiPrompt.js'

describe('buildAnalysisMessages', () => {
  it('builds_system_and_user_messages_with_correct_roles', () => {
    const msgs = buildAnalysisMessages('概览数据', { name: '贵州茅台' })
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].role).toBe('user')
  })

  it('embeds_displayText_and_stock_name_in_user_message', () => {
    const msgs = buildAnalysisMessages('涨幅 5%\n换手率 2%', { name: '贵州茅台' })
    const user = msgs[1].content
    expect(user).toContain('贵州茅台')
    expect(user).toContain('涨幅 5%')
    expect(user).toContain('换手率 2%')
  })

  it('system_prompt_states_adjust_mode_convention', () => {
    const msgs = buildAnalysisMessages('数据', {})
    const system = msgs[0].content
    // 必须告知模型复权口径，否则长短期涨幅会被误读
    expect(system).toContain('前复权')
    expect(system).toContain('后复权')
  })

  it('system_prompt_requires_sentiment_support_resistance_sections', () => {
    const system = buildAnalysisMessages('数据', {})[0].content
    expect(system).toContain('情绪面')
    expect(system).toContain('支撑位')
    expect(system).toContain('压力位')
  })

  it('warns_latest_price_is_intraday_when_market_open', () => {
    const user = buildAnalysisMessages('数据', { marketOpen: true, dateStr: '2026-06-03' })[1].content
    // 盘中必须提示最新价为实时价、非最终收盘价
    expect(user).toContain('盘中实时价')
    expect(user).toContain('并非最终收盘价')
    expect(user).toContain('2026-06-03')
  })

  it('states_latest_price_is_close_when_market_closed', () => {
    const user = buildAnalysisMessages('数据', { marketOpen: false, dateStr: '2026-06-03' })[1].content
    expect(user).toContain('收盘价')
    expect(user).not.toContain('盘中实时价')
  })
})
