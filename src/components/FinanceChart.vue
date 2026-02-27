<template>
  <div ref="el" class="finance-chart"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { createChart, ColorType } from 'lightweight-charts'

const props = defineProps({
  periods: { type: Array, default: () => [] },
  revenue: { type: Array, default: () => [] },
  profit:  { type: Array, default: () => [] },
  margin:  { type: Array, default: () => [] },
  visible: { type: Object, default: () => ({ revenue: true, profit: true, margin: true }) }
})

const el = ref(null)
let chart = null
let revSeries = null
let profitSeries = null
let marginSeries = null
let resizeObserver = null

const toTime = (period) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period
  const m = period.match(/^(\d{4})/)
  return m ? `${m[1]}-12-31` : '2000-01-01'
}

const makeSeries = (periods, nums) =>
  periods
    .map((p, i) => ({ time: toTime(p), value: nums[i] }))
    .filter(d => Number.isFinite(d.value))

const init = () => {
  if (!el.value) return

  chart = createChart(el.value, {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#94a3b8',
      fontSize: 11
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: 'rgba(0,0,0,0.06)' }
    },
    leftPriceScale: {
      visible: true,
      borderColor: 'rgba(0,0,0,0.08)',
      scaleMargins: { top: 0.12, bottom: 0.08 }
    },
    rightPriceScale: {
      visible: true,
      borderColor: 'rgba(0,0,0,0.08)',
      scaleMargins: { top: 0.12, bottom: 0.08 }
    },
    timeScale: {
      borderColor: 'rgba(0,0,0,0.08)',
      timeVisible: false
    },
    crosshair: {
      vertLine: { color: 'rgba(0,0,0,0.15)', width: 1, style: 3 },
      horzLine: { visible: false }
    },
    handleScroll: false,
    handleScale: false,
    width: el.value.clientWidth,
    height: 220
  })

  revSeries = chart.addLineSeries({
    color: '#f97316', lineWidth: 2,
    priceScaleId: 'left', lastValueVisible: false, priceLineVisible: false
  })
  profitSeries = chart.addLineSeries({
    color: '#1d4ed8', lineWidth: 2,
    priceScaleId: 'left', lastValueVisible: false, priceLineVisible: false
  })
  marginSeries = chart.addLineSeries({
    color: '#059669', lineWidth: 2,
    priceScaleId: 'right', lastValueVisible: false, priceLineVisible: false
  })

  updateData()

  resizeObserver = new ResizeObserver(() => {
    if (chart && el.value) chart.applyOptions({ width: el.value.clientWidth })
  })
  resizeObserver.observe(el.value)
}

const updateData = () => {
  if (!chart) return
  revSeries?.setData(makeSeries(props.periods, props.revenue))
  revSeries?.applyOptions({ visible: props.visible.revenue })
  profitSeries?.setData(makeSeries(props.periods, props.profit))
  profitSeries?.applyOptions({ visible: props.visible.profit })
  marginSeries?.setData(makeSeries(props.periods, props.margin))
  marginSeries?.applyOptions({ visible: props.visible.margin })
  chart.timeScale().fitContent()
}

onMounted(init)
onUnmounted(() => {
  resizeObserver?.disconnect()
  chart?.remove()
})
watch(() => [props.periods, props.revenue, props.profit, props.margin, props.visible], updateData, { deep: true })
</script>

<style scoped>
.finance-chart { width: 100%; }
</style>
