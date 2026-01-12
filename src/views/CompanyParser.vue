<template>
  <div class="company-container">
    <header class="header">
      <div class="header-content">
        <button class="action-btn ghost" @click="router.push('/')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>返回</span>
        </button>
        <div class="title-group">
          <h1>公司指标解析</h1>
        </div>
        <div class="header-spacer"></div>
      </div>
    </header>

    <main class="main-content">
      <section class="panel input-panel">
        <div class="input-row">
          <div class="field grow">
            <label>股票代码</label>
            <input
              v-model.trim="symbol"
              placeholder="例如：HK9988 / 600519 / TSLA"
              @keydown.enter="handleFetch"
            />
          </div>
          <div class="field">
            <label>市场</label>
            <div class="market-pill">{{ marketLabel }}</div>
          </div>
          <button class="action-btn solid" :disabled="loading" @click="handleFetch">
            <span>{{ loading ? '解析中...' : '开始解析' }}</span>
          </button>
        </div>
        <div class="hint">
          解析来源：https://stockpage.10jqka.com.cn/<span class="mono">{{ normalizedPreview }}</span>/company/
        </div>
        <div v-if="error" class="error">{{ error }}</div>
      </section>

      <section class="panel result-panel">
        <div class="panel-header">
          <h2>解析结果</h2>
          <div class="panel-actions">
            <button class="action-btn ghost" :disabled="!displayText" @click="handleCopy">
              一键复制
            </button>
          </div>
        </div>

        <div v-if="result" class="result-sections">
          <div class="section section-overview">
            <div class="section-header">
              <span>概览</span>
            </div>
            <div class="section-grid">
              <div class="metric wide">
                <span class="metric-label">所属行业</span>
                <span class="metric-value">{{ result.industry || '-' }}</span>
              </div>
              <div class="metric highlight">
                <span class="metric-label">当前</span>
                <span class="metric-value">{{ result.current || '-' }}</span>
              </div>
              <div :class="['metric', getChangeClass(result.changePercent)]">
                <span class="metric-label">涨幅</span>
                <span class="metric-value">{{ result.changePercent || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">振幅</span>
                <span class="metric-value">{{ result.amplitude || '-' }}</span>
              </div>
            </div>
          </div>

          <div class="section section-quote">
            <div class="section-header">
              <span>行情</span>
            </div>
            <div class="section-grid">
              <div class="metric">
                <span class="metric-label">今开</span>
                <span class="metric-value">{{ result.open || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">昨收</span>
                <span class="metric-value">{{ result.yesterday || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">最高</span>
                <span class="metric-value">{{ result.high || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">最低</span>
                <span class="metric-value">{{ result.low || '-' }}</span>
              </div>
            </div>
          </div>

          <div class="section section-trade">
            <div class="section-header">
              <span>成交</span>
            </div>
            <div class="section-grid">
              <div class="metric">
                <span class="metric-label">成交量</span>
                <span class="metric-value">{{ result.volume || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">成交额</span>
                <span class="metric-value">{{ result.amount || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">换手</span>
                <span class="metric-value">{{ result.turnover || '-' }}</span>
              </div>
            </div>
          </div>

          <div class="section section-value">
            <div class="section-header">
              <span>估值</span>
            </div>
            <div class="section-grid">
              <div class="metric">
                <span class="metric-label">总市值</span>
                <span class="metric-value">{{ result.totalMarketCap || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">流通市值</span>
                <span class="metric-value">{{ result.floatMarketCap || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">市盈率(动)</span>
                <span class="metric-value">{{ result.pe || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">市盈率(静)</span>
                <span class="metric-value">{{ result.peStatic || '-' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">市净率</span>
                <span class="metric-value">{{ result.pb || '-' }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M4 5H20M4 12H20M4 19H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <p>填写代码后点击“开始解析”</p>
        </div>

        <div v-if="displayText" class="copy-block">
          <div class="copy-label">可复制内容</div>
          <pre class="copy-text">{{ displayText }}</pre>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { getCompanyMetrics, getCompanyPage, MARKET_TYPE } from '@/api/stock'

const router = useRouter()
const message = useMessage()

const symbol = ref('')
const loading = ref(false)
const error = ref('')
const result = ref(null)

const detectMarket = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return MARKET_TYPE.HK
  if (raw.startsWith('HK')) return MARKET_TYPE.HK
  if (/^[A-Z]+$/.test(raw)) return MARKET_TYPE.US
  if (/^[A-Z.]+$/.test(raw)) return MARKET_TYPE.US
  if (/^\d{6}$/.test(raw)) return MARKET_TYPE.CN
  if (/^\d{4,5}$/.test(raw)) return MARKET_TYPE.HK
  return MARKET_TYPE.HK
}

const market = computed(() => detectMarket(symbol.value))
const marketLabel = computed(() => {
  if (market.value === MARKET_TYPE.CN) return 'A股'
  if (market.value === MARKET_TYPE.US) return '美股'
  return '港股'
})

const normalizedPreview = computed(() => {
  const raw = symbol.value.trim()
  if (!raw) return '...'
  if (market.value === MARKET_TYPE.HK) return raw.startsWith('HK') ? raw : `HK${raw}`
  if (market.value === MARKET_TYPE.US) return raw.replace(/^US/i, '')
  if (market.value === MARKET_TYPE.CN && (raw.startsWith('SH') || raw.startsWith('SZ'))) {
    return raw.slice(2)
  }
  return raw
})

const displayText = computed(() => {
  if (!result.value) return ''
  const symbolText = symbol.value.trim().toUpperCase() || '-'
  const fields = [
    ['股票代码', symbolText],
    ['所属行业', result.value.industry],
    ['当前', result.value.current],
    ['今开', result.value.open],
    ['昨收', result.value.yesterday],
    ['最高', result.value.high],
    ['最低', result.value.low],
    ['成交量', result.value.volume],
    ['成交额', result.value.amount],
    ['换手', result.value.turnover],
    ['振幅', result.value.amplitude],
    ['涨幅', result.value.changePercent],
    ['总市值', result.value.totalMarketCap],
    ['流通市值', result.value.floatMarketCap],
    ['市盈率(动)', result.value.pe],
    ['市盈率(静)', result.value.peStatic],
    ['市净率', result.value.pb]
  ]
  return fields
    .map(([label, value]) => `${label}: ${value || '-'}`)
    .join('\n')
})

const formatLarge = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return value ? String(value) : ''
  if (num >= 1e8) return `${(num / 1e8).toFixed(2).replace(/\.00$/, '')}亿`
  if (num >= 1e4) return `${(num / 1e4).toFixed(2).replace(/\.00$/, '')}万`
  return num.toFixed(2).replace(/\.00$/, '')
}

const formatTurnover = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return value ? String(value) : ''
  return `${num.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`
}

const formatPrice = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return value ? String(value) : ''
  return num.toFixed(3)
}

const formatPercent = (value, digits = 2) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return value ? String(value) : ''
  return `${num.toFixed(digits)}%`
}

const normalizeMetrics = (metrics) => ({
  industry: metrics.industry || '',
  current: formatPrice(metrics.current),
  open: formatPrice(metrics.open),
  yesterday: formatPrice(metrics.yesterday),
  high: formatPrice(metrics.high),
  low: formatPrice(metrics.low),
  volume: formatLarge(metrics.volume),
  amount: formatLarge(metrics.amount),
  turnover: formatTurnover(metrics.turnover),
  amplitude: formatPercent(metrics.amplitude, 3),
  changePercent: formatPercent(metrics.changePercent, 2),
  totalMarketCap: formatLarge(metrics.totalMarketCap),
  floatMarketCap: formatLarge(metrics.floatMarketCap),
  pe: Number(metrics.pe) > 0
    ? Number(metrics.pe).toFixed(3).replace(/\.?0+$/, '')
    : (metrics.pe || ''),
  pb: Number(metrics.pb) > 0 ? Number(metrics.pb).toFixed(3).replace(/\.?0+$/, '') : '',
  peStatic: Number(metrics.peStatic) > 0 ? Number(metrics.peStatic).toFixed(3).replace(/\.?0+$/, '') : ''
})

const getChangeClass = (value) => {
  const num = Number(String(value || '').replace('%', ''))
  if (!Number.isFinite(num)) return ''
  return num >= 0 ? 'metric-positive' : 'metric-negative'
}

const extractValue = (text, labels) => {
  for (const label of labels) {
    const patterns = [
      new RegExp(`${label}\\s*[:：]?\\s*([0-9.+-]+\\s*(?:%|万|亿|万股|亿股|万手|亿手)?)`),
      new RegExp(`${label}\\s*[:：]?\\s*([0-9.+-]+\\s*[\\u4e00-\\u9fa5%]*)`)
    ]
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].replace(/\s+/g, '')
      }
    }
  }
  return ''
}

const parseCompanyHtml = (html) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim()
  const industryNode = doc.querySelector('li.industry a')
  let industry = industryNode?.textContent?.replace(/\s+/g, ' ').trim() || ''
  if (!industry) {
    const match = text.match(/所属行业[:：]\s*([^\s]+)/)
    if (match && match[1]) {
      industry = match[1].trim()
    }
  }

  return {
    turnover: extractValue(text, ['换手', '换手率']),
    volume: extractValue(text, ['成交量']),
    amount: extractValue(text, ['成交额']),
    industry
  }
}

const handleFetch = async () => {
  error.value = ''
  result.value = null

  if (!symbol.value.trim()) {
    error.value = '请输入股票代码'
    return
  }

  loading.value = true
  try {
    const metrics = await getCompanyMetrics(symbol.value, market.value)
    if (metrics && (
      metrics.turnover ||
      metrics.volume ||
      metrics.amount ||
      metrics.current ||
      metrics.open
    )) {
      let industry = ''
      try {
        if (market.value === MARKET_TYPE.HK || market.value === MARKET_TYPE.CN) {
          const html = await getCompanyPage(symbol.value, market.value)
          if (html) {
            industry = parseCompanyHtml(html).industry
          }
        }
      } catch (err) {
        console.error(err)
      }

      result.value = normalizeMetrics({ ...metrics, industry })
      return
    }

    const html = (market.value === MARKET_TYPE.HK || market.value === MARKET_TYPE.CN)
      ? await getCompanyPage(symbol.value, market.value)
      : ''
    if (!html) {
      error.value = market.value === MARKET_TYPE.HK
        ? '未获取到接口数据，请稍后重试'
        : market.value === MARKET_TYPE.CN
          ? '未获取到接口数据，请稍后重试'
          : '暂不支持该市场解析'
      return
    }

    const parsed = parseCompanyHtml(html)
    if (!parsed.turnover && !parsed.volume && !parsed.amount && !parsed.industry) {
      error.value = '未解析到换手/成交量/成交额，可能页面结构变化'
      return
    }
    result.value = normalizeMetrics(parsed)
  } catch (err) {
    console.error(err)
    error.value = '解析失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const handleCopy = async () => {
  if (!displayText.value) return
  try {
    await navigator.clipboard.writeText(displayText.value)
    message.success('已复制到剪贴板')
  } catch (err) {
    console.error(err)
    const textarea = document.createElement('textarea')
    textarea.value = displayText.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    message.success('已复制到剪贴板')
  }
}
</script>

<style scoped>
* {
  letter-spacing: -0.02em;
}

.company-container {
  min-height: 100vh;
  background: #f6f6f4;
  position: relative;
  overflow-x: hidden;
}

.company-container::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 1;
}

.company-container::after {
  content: '';
  position: fixed;
  top: -30%;
  left: -20%;
  width: 140%;
  height: 140%;
  background: radial-gradient(circle at 20% 30%, rgba(249, 168, 212, 0.12) 0%, transparent 55%),
              radial-gradient(circle at 80% 20%, rgba(196, 181, 253, 0.12) 0%, transparent 45%),
              radial-gradient(circle at 60% 80%, rgba(125, 211, 252, 0.12) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(18px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 32px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 20px;
  align-items: center;
}

.title-group h1 {
  margin: 0;
  font-size: 22px;
  color: #18181b;
}

.title-group p {
  margin: 4px 0 0;
  color: #71717a;
  font-size: 13px;
}

.header-spacer {
  width: 40px;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 32px 80px;
  position: relative;
  z-index: 2;
  display: grid;
  gap: 24px;
}

.panel {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
}

.input-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 140px;
}

.field.grow {
  flex: 1;
  min-width: 220px;
}

label {
  font-size: 12px;
  font-weight: 600;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

select,
input {
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 0 14px;
  font-size: 15px;
  color: #18181b;
  background: #fff;
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
}

select:focus,
input:focus {
  border-color: #0f172a;
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1);
}

.market-pill {
  height: 42px;
  border-radius: 999px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  background: rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.12);
}

.hint {
  margin-top: 14px;
  font-size: 12px;
  color: #71717a;
}

.mono {
  font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.error {
  margin-top: 10px;
  color: #dc2626;
  font-size: 13px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}

.action-btn.ghost {
  background: rgba(0, 0, 0, 0.04);
  color: #3f3f46;
  border-color: rgba(0, 0, 0, 0.08);
}

.action-btn.solid {
  background: #0f172a;
  color: #f8fafc;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.2);
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.result-panel {
  display: grid;
  gap: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  color: #18181b;
}

.result-sections {
  display: grid;
  gap: 20px;
}

.section {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(15, 23, 42, 0.06);
  border-radius: 22px;
  padding: 18px;
  display: grid;
  gap: 16px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.section-overview {
  background: linear-gradient(135deg, rgba(255, 243, 237, 0.85), rgba(255, 255, 255, 0.75));
  border-color: rgba(249, 115, 22, 0.15);
}

.section-quote {
  background: linear-gradient(135deg, rgba(236, 254, 255, 0.85), rgba(255, 255, 255, 0.75));
  border-color: rgba(6, 182, 212, 0.18);
}

.section-trade {
  background: linear-gradient(135deg, rgba(237, 233, 254, 0.85), rgba(255, 255, 255, 0.75));
  border-color: rgba(129, 140, 248, 0.18);
}

.section-value {
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.85), rgba(255, 255, 255, 0.75));
  border-color: rgba(16, 185, 129, 0.18);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.section-header::before {
  content: '';
  width: 28px;
  height: 2px;
  background: linear-gradient(90deg, rgba(15, 23, 42, 0.6), transparent);
  border-radius: 999px;
}

.section-overview .section-header::before {
  background: linear-gradient(90deg, rgba(249, 115, 22, 0.7), transparent);
}

.section-quote .section-header::before {
  background: linear-gradient(90deg, rgba(6, 182, 212, 0.7), transparent);
}

.section-trade .section-header::before {
  background: linear-gradient(90deg, rgba(129, 140, 248, 0.7), transparent);
}

.section-value .section-header::before {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.7), transparent);
}

.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 18px;
}

.metric {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.7));
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.metric::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, rgba(15, 23, 42, 0.15), transparent);
}

.metric:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgba(15, 23, 42, 0.1);
}

.metric.wide {
  grid-column: span 2;
}

.metric.highlight {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
}

.metric.highlight .metric-label {
  color: rgba(248, 250, 252, 0.7);
}

.metric.highlight .metric-value {
  color: #f8fafc;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  font-variant-numeric: tabular-nums;
}

.metric-positive {
  border-color: rgba(239, 68, 68, 0.35);
  background: linear-gradient(135deg, rgba(254, 226, 226, 0.92), rgba(254, 242, 242, 0.7));
}

.metric-positive .metric-label {
  color: #b91c1c;
}

.metric-positive .metric-value {
  color: #991b1b;
}

.metric-negative {
  border-color: rgba(59, 130, 246, 0.35);
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.92), rgba(239, 246, 255, 0.7));
}

.metric-negative .metric-label {
  color: #1d4ed8;
}

.metric-negative .metric-value {
  color: #1e3a8a;
}

.copy-block {
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
  padding-top: 16px;
  display: grid;
  gap: 10px;
}

.copy-label {
  font-size: 12px;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.copy-text {
  background: #0f172a;
  color: #f8fafc;
  padding: 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #a1a1aa;
}

@media (max-width: 768px) {
  .header-content {
    grid-template-columns: 1fr;
  }

  .header-spacer {
    display: none;
  }

  .main-content {
    padding: 32px 20px 60px;
  }

  .metric.wide {
    grid-column: span 1;
  }
}
</style>
