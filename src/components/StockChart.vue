<template>
  <div ref="chartRef" style="width: 100%; height: 400px"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
})

const chartRef = ref(null)
let chartInstance = null

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.dispose()
  }
})

watch(() => props.data, () => {
  updateChart()
}, { deep: true })

const initChart = () => {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chartInstance || !props.data.length) return

  const dates = props.data.map(item => item.date)
  const values = props.data.map(item => [
    item.open,
    item.close,
    item.low,
    item.high
  ])

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#667eea',
      borderWidth: 1,
      textStyle: {
        color: '#333'
      },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); border-radius: 8px;'
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '10%'
    },
    xAxis: {
      type: 'category',
      data: dates,
      scale: true,
      boundaryGap: true,
      axisLine: {
        onZero: false,
        lineStyle: {
          color: '#667eea',
          width: 1
        }
      },
      axisLabel: {
        color: '#666',
        fontSize: 12
      },
      splitLine: { show: false },
      splitNumber: 20,
      min: 'dataMin',
      max: 'dataMax'
    },
    yAxis: {
      scale: true,
      axisLine: {
        lineStyle: {
          color: '#667eea',
          width: 1
        }
      },
      axisLabel: {
        color: '#666',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(102, 126, 234, 0.1)',
          type: 'dashed'
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(255, 255, 255, 0.02)', 'rgba(102, 126, 234, 0.02)']
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 50,
        end: 100
      },
      {
        show: true,
        type: 'slider',
        top: '90%',
        start: 50,
        end: 100
      }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: values,
        itemStyle: {
          color: '#ef4444',
          color0: '#22c55e',
          borderColor: '#ef4444',
          borderColor0: '#22c55e'
        }
      },
      {
        name: 'MA5',
        type: 'line',
        data: calculateMA(5, props.data),
        smooth: true,
        lineStyle: {
          color: '#667eea',
          opacity: 0.8,
          width: 2
        },
        symbol: 'none'
      },
      {
        name: 'MA10',
        type: 'line',
        data: calculateMA(10, props.data),
        smooth: true,
        lineStyle: {
          color: '#764ba2',
          opacity: 0.8,
          width: 2
        },
        symbol: 'none'
      },
      {
        name: 'MA20',
        type: 'line',
        data: calculateMA(20, props.data),
        smooth: true,
        lineStyle: {
          color: '#f59e0b',
          opacity: 0.8,
          width: 2
        },
        symbol: 'none'
      }
    ]
  }

  chartInstance.setOption(option)
}

const calculateMA = (dayCount, data) => {
  const result = []
  for (let i = 0; i < data.length; i++) {
    if (i < dayCount - 1) {
      result.push('-')
      continue
    }
    let sum = 0
    for (let j = 0; j < dayCount; j++) {
      sum += data[i - j].close
    }
    result.push((sum / dayCount).toFixed(2))
  }
  return result
}
</script>
