<template>
  <div ref="chartRef" style="width: 100%; height: 400px"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts/dist/echarts.esm.mjs'

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const chartRef = ref(null)
let chartInstance = null

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
      extraCssText: 'box-shadow:0 4px 12px rgba(0,0,0,0.1);border-radius:8px;'
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
</script>
