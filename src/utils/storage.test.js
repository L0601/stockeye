import { describe, it, expect, beforeEach } from 'vitest'

// 最小 localStorage stub，避免为单测引入 jsdom
function installLocalStorage() {
  const store = new Map()
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key),
    clear: () => store.clear()
  }
}

let aiSettings
beforeEach(async () => {
  installLocalStorage()
  // storage 模块在导入时不读 localStorage，安装 stub 后再导入即可
  ;({ aiSettings } = await import('./storage.js'))
})

describe('aiSettings.isValid', () => {
  it('returns_false_when_baseUrl_missing', () => {
    aiSettings.setConfig({ apiKey: 'k', baseUrl: '', model: 'gpt-4' })
    expect(aiSettings.isValid()).toBe(false)
  })

  it('returns_false_when_model_missing', () => {
    aiSettings.setConfig({ apiKey: 'k', baseUrl: 'https://x/v1', model: '' })
    expect(aiSettings.isValid()).toBe(false)
  })

  it('returns_true_when_baseUrl_and_model_present_even_without_apiKey', () => {
    aiSettings.setConfig({ apiKey: '', baseUrl: 'https://x/v1', model: 'gpt-4' })
    expect(aiSettings.isValid()).toBe(true)
    // 同时验证持久化结果可读回
    expect(aiSettings.getConfig().model).toBe('gpt-4')
  })
})
