<template>
  <div ref="chartRef" style="width: 100%; height: 400px"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { createChart, ColorType } from 'lightweight-charts'

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const chartRef = ref(null)
let chart = null
let candleSeries = null
let ma5Series = null
let ma10Series = null
let ma20Series = null
let resizeObserver = null

const calcMA = (sorted, n) =>
  sorted.flatMap((item, i) => {
    if (i < n - 1) return []
    const sum = sorted.slice(i - n + 1, i + 1).reduce((acc, d) => acc + d.close, 0)
    return [{ time: item.date, value: +(sum / n).toFixed(3) }]
  })

const initChart = () => {
  if (!chartRef.value) return

  chart = createChart(chartRef.value, {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#64748b'
    },
    grid: {
      vertLines: { color: 'rgba(0,0,0,0.04)' },
      horzLines: { color: 'rgba(0,0,0,0.04)' }
    },
    rightPriceScale: { borderColor: 'rgba(0,0,0,0.1)' },
    timeScale: { borderColor: 'rgba(0,0,0,0.1)', timeVisible: false },
    width: chartRef.value.clientWidth,
    height: 400
  })

  candleSeries = chart.addCandlestickSeries({
    upColor: '#ef4444', downColor: '#22c55e',
    borderUpColor: '#ef4444', borderDownColor: '#22c55e',
    wickUpColor: '#ef4444', wickDownColor: '#22c55e'
  })
  ma5Series = chart.addLineSeries({ color: '#667eea', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false })
  ma10Series = chart.addLineSeries({ color: '#764ba2', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false })
  ma20Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false })

  resizeObserver = new ResizeObserver(() => {
    if (chart && chartRef.value) chart.applyOptions({ width: chartRef.value.clientWidth })
  })
  resizeObserver.observe(chartRef.value)

  updateChart()
}

const updateChart = () => {
  if (!chart || !props.data.length) return

  const sorted = [...props.data].sort((a, b) => a.date < b.date ? -1 : 1)
  candleSeries.setData(sorted.map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close })))
  ma5Series.setData(calcMA(sorted, 5))
  ma10Series.setData(calcMA(sorted, 10))
  ma20Series.setData(calcMA(sorted, 20))
  chart.timeScale().fitContent()
}

onMounted(initChart)
onUnmounted(() => {
  resizeObserver?.disconnect()
  chart?.remove()
})
watch(() => props.data, updateChart, { deep: true })
</script>
