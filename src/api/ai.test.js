import { describe, it, expect } from 'vitest'
import { parseSSEData, splitSSEBuffer, buildUrl, buildProxyRequest } from './ai.js'

describe('buildUrl', () => {
  it('joins_with_single_slash_when_base_has_trailing_slash', () => {
    expect(buildUrl('https://api.openai.com/v1/', 'models')).toBe('https://api.openai.com/v1/models')
    expect(buildUrl('https://api.openai.com/v1', '/models')).toBe('https://api.openai.com/v1/models')
  })
})

describe('buildProxyRequest', () => {
  it('routes_through_same_origin_proxy_with_target_in_header', () => {
    const { url, headers } = buildProxyRequest({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-x' }, 'models')
    // 必须打到同源代理，而非直连目标，否则浏览器会跨域
    expect(url).toBe('/api/ai-proxy')
    expect(headers['x-ai-target']).toBe('https://api.openai.com/v1/models')
  })

  it('includes_bearer_auth_when_apiKey_present', () => {
    const { headers } = buildProxyRequest({ baseUrl: 'https://x/v1', apiKey: 'sk-abc' }, 'chat/completions')
    expect(headers.Authorization).toBe('Bearer sk-abc')
  })

  it('omits_auth_header_when_apiKey_empty', () => {
    const { headers } = buildProxyRequest({ baseUrl: 'https://x/v1', apiKey: '' }, 'models')
    expect(headers.Authorization).toBeUndefined()
    expect(headers['x-ai-target']).toBe('https://x/v1/models')
  })
})

describe('parseSSEData', () => {
  it('marks_done_when_payload_is_DONE', () => {
    const res = parseSSEData('[DONE]')
    expect(res.done).toBe(true)
    expect(res.delta).toBe('')
  })

  it('extracts_delta_when_chunk_has_content', () => {
    const chunk = JSON.stringify({ choices: [{ delta: { content: '你好' } }] })
    const res = parseSSEData(chunk)
    expect(res.done).toBe(false)
    expect(res.delta).toBe('你好')
  })

  it('returns_empty_delta_without_throwing_when_json_invalid', () => {
    const res = parseSSEData('{ not valid json')
    expect(res.done).toBe(false)
    expect(res.delta).toBe('')
  })

  it('returns_empty_delta_when_chunk_has_no_content', () => {
    const chunk = JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] })
    const res = parseSSEData(chunk)
    expect(res.delta).toBe('')
    expect(res.done).toBe(false)
  })
})

describe('splitSSEBuffer', () => {
  it('splits_complete_events_and_keeps_trailing_partial_as_rest', () => {
    const buffer = 'data: a\n\ndata: b\n\ndata: c'
    const { events, rest } = splitSSEBuffer(buffer)
    expect(events).toEqual(['data: a', 'data: b'])
    // 半包必须保留，不能丢
    expect(rest).toBe('data: c')
  })

  it('keeps_whole_buffer_as_rest_when_no_blank_line', () => {
    const { events, rest } = splitSSEBuffer('data: partial')
    expect(events).toEqual([])
    expect(rest).toBe('data: partial')
  })
})
