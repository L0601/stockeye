<template>
  <div class="stock-chart-panel">
    <div class="ma-strip">
      <span class="ma-item ma5">MA5 {{ latestMa.ma5 }}</span>
      <span class="ma-item ma10">MA10 {{ latestMa.ma10 }}</span>
      <span class="ma-item ma20">MA20 {{ latestMa.ma20 }}</span>
    </div>
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as echarts from 'echarts/dist/echarts.esm.mjs'

const props = defineProps({
  data: { type: Array, default: () => [] },
  period: { type: String, default: 'daily' }
})

const chartRef = ref(null)
let chartInstance = null

const calcMAValue = (n) => {
  if (props.data.length < n) return '-'
  const sum = props.data.slice(-n).reduce((acc, item) => acc + item.close, 0)
  return (sum / n).toFixed(2)
}

const latestMa = computed(() => ({
  ma5: calcMAValue(5),
  ma10: calcMAValue(10),
  ma20: calcMAValue(20)
}))

const formatPrice = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(2) : '-'
}

const formatChange = (value) => {
  if (!Number.isFinite(value)) return '-'
  const text = value.toFixed(2)
  return `${value >= 0 ? '+' : ''}${text}%`
}

const parsePeriodPoint = (value, period) => {
  const text = String(value || '')
  if (period === 'yearly') {
    const year = Number(text)
    return Number.isFinite(year) ? { year, month: 1 } : null
  }

  if (period === 'quarterly') {
    const match = text.match(/^(\d{4})-Q([1-4])$/)
    if (!match) return null
    return {
      year: Number(match[1]),
      month: (Number(match[2]) - 1) * 3 + 1
    }
  }

  const match = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3] || 1)
  }
}

const formatRangeText = (start, end, period, distance) => {
  const startPoint = parsePeriodPoint(start, period)
  const endPoint = parsePeriodPoint(end, period)
  if (!startPoint || !endPoint) return `${distance}期`

  if (period === 'yearly') {
    return `${Math.max(endPoint.year - startPoint.year, distance)}年`
  }

  const monthDiff = (endPoint.year - startPoint.year) * 12 + (endPoint.month - startPoint.month)
  if (period === 'quarterly') {
    return `${Math.max(Math.round(monthDiff / 3), distance)}季`
  }

  if (period === 'monthly') {
    return `${Math.max(monthDiff, distance)}个月`
  }

  if (period === 'daily') {
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return `${distance}日`
    }
    const dayDiff = Math.round((endDate - startDate) / (24 * 60 * 60 * 1000))
    return `${Math.max(dayDiff, distance)}天`
  }

  return `${distance}期`
}

const initChart = () => {
  if (!chartRef.value) return
  if (chartRef.value.clientWidth === 0) {
    setTimeout(initChart, 50)
    return
  }
  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chartInstance || !props.data.length) return

  const dates = props.data.map(d => d.date)
  const values = props.data.map(d => [d.open, d.close, d.low, d.high])

  chartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#667eea',
      borderWidth: 1,
      textStyle: { color: '#333' },
      extraCssText: 'box-shadow:0 4px 12px rgba(0,0,0,0.1);border-radius:8px;',
      formatter: (params) => {
        const candle = params.find(item => item.seriesType === 'candlestick')
        if (!candle) return ''

        const index = candle.dataIndex
        const point = props.data[index]
        const latest = props.data[props.data.length - 1]
        const latestIndex = props.data.length - 1
        const change = point?.close
          ? ((latest.close - point.close) / point.close) * 100
          : NaN
        const rangeText = formatRangeText(
          point?.date,
          latest?.date,
          props.period,
          Math.max(latestIndex - index, 0)
        )

        return [
          `<div>${candle.axisValue}</div>`,
          `<div>开 ${formatPrice(point?.open)} 收 ${formatPrice(point?.close)}</div>`,
          `<div>高 ${formatPrice(point?.high)} 低 ${formatPrice(point?.low)}</div>`,
          `<div>到当前: ${formatChange(change)} / ${rangeText}</div>`
        ].join('')
      }
    },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '10%' },
    xAxis: {
      type: 'category',
      data: dates,
      scale: true,
      boundaryGap: true,
      axisLine: { onZero: false, lineStyle: { color: '#667eea', width: 1 } },
      axisLabel: { color: '#666', fontSize: 12 },
      splitLine: { show: false },
      min: 'dataMin',
      max: 'dataMax'
    },
    yAxis: {
      scale: true,
      axisLine: { lineStyle: { color: '#667eea', width: 1 } },
      axisLabel: { color: '#666', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(102,126,234,0.1)', type: 'dashed' } },
      splitArea: { show: true, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(102,126,234,0.02)'] } }
    },
    dataZoom: [
      { type: 'inside', start: 50, end: 100 },
      { show: true, type: 'slider', top: '90%', start: 50, end: 100 }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: values,
        itemStyle: {
          color: '#ef4444', color0: '#22c55e',
          borderColor: '#ef4444', borderColor0: '#22c55e'
        }
      },
      {
        name: 'MA5', type: 'line',
        data: calcMA(5),
        smooth: true,
        lineStyle: { color: '#667eea', opacity: 0.8, width: 2 },
        symbol: 'none'
      },
      {
        name: 'MA10', type: 'line',
        data: calcMA(10),
        smooth: true,
        lineStyle: { color: '#764ba2', opacity: 0.8, width: 2 },
        symbol: 'none'
      },
      {
        name: 'MA20', type: 'line',
        data: calcMA(20),
        smooth: true,
        lineStyle: { color: '#f59e0b', opacity: 0.8, width: 2 },
        symbol: 'none'
      }
    ]
  })
}

const calcMA = (n) =>
  props.data.map((_, i) => {
    if (i < n - 1) return '-'
    const sum = props.data.slice(i - n + 1, i + 1).reduce((acc, d) => acc + d.close, 0)
    return (sum / n).toFixed(2)
  })

onMounted(() => setTimeout(initChart, 50))
onUnmounted(() => chartInstance?.dispose())
watch(() => props.data, updateChart, { deep: true })
watch(() => props.period, updateChart)
</script>

<style scoped>
.stock-chart-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ma-strip {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 600;
}

.ma-item {
  display: inline-flex;
  align-items: center;
}

.ma5 {
  color: #667eea;
}

.ma10 {
  color: #764ba2;
}

.ma20 {
  color: #f59e0b;
}

.chart {
  width: 100%;
  height: 400px;
}
</style>
