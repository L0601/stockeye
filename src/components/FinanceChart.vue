<template>
  <div ref="wrap" class="finance-chart-wrap">
    <div ref="el" class="finance-chart"></div>
    <div v-if="tooltip.visible" class="finance-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
      <div class="tooltip-period">{{ tooltip.period }}</div>
      <div v-if="visible.revenue && tooltip.revenue" class="tooltip-row" style="color:#f97316">营收: {{ tooltip.revenue }}</div>
      <div v-if="visible.profit && tooltip.profit" class="tooltip-row" style="color:#1d4ed8">归母净利润: {{ tooltip.profit }}</div>
      <div v-if="visible.margin && tooltip.margin" class="tooltip-row" style="color:#059669">营业利润率: {{ tooltip.margin }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { createChart, ColorType, LineSeries } from 'lightweight-charts'

const props = defineProps({
  periods:       { type: Array,  default: () => [] },
  revenue:       { type: Array,  default: () => [] },
  profit:        { type: Array,  default: () => [] },
  margin:        { type: Array,  default: () => [] },
  revenueLabels: { type: Array,  default: () => [] },
  profitLabels:  { type: Array,  default: () => [] },
  marginLabels:  { type: Array,  default: () => [] },
  visible:       { type: Object, default: () => ({ revenue: true, profit: true, margin: true }) }
})

const wrap = ref(null)
const el = ref(null)
let chart = null
let revSeries = null
let profitSeries = null
let marginSeries = null
let resizeObserver = null
let timeIndexMap = {}

const tooltip = reactive({ visible: false, x: 0, y: 0, period: '', revenue: '', profit: '', margin: '' })

const toTime = (period) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period
  const m = period.match(/^(\d{4})/)
  return m ? `${m[1]}-12-31` : '2000-01-01'
}

const makeSeries = (periods, nums) =>
  periods
    .map((p, i) => ({ time: toTime(p), value: nums[i] }))
    .filter(d => Number.isFinite(d.value))

const onCrosshairMove = (param) => {
  if (!param.time || !param.point) {
    tooltip.visible = false
    return
  }
  const idx = timeIndexMap[param.time]
  if (idx === undefined) { tooltip.visible = false; return }

  const chartWidth = el.value?.clientWidth ?? 300
  tooltip.visible = true
  tooltip.x = param.point.x > chartWidth - 140 ? param.point.x - 145 : param.point.x + 12
  tooltip.y = Math.max(4, param.point.y - 44)
  tooltip.period = props.periods[idx]
  tooltip.revenue = props.revenueLabels[idx] ?? ''
  tooltip.profit  = props.profitLabels[idx]  ?? ''
  tooltip.margin  = props.marginLabels[idx]  ?? ''
}

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
    leftPriceScale: { visible: false },
    rightPriceScale: { visible: false },
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

  const scaleMargins = { top: 0.1, bottom: 0.1 }
  revSeries = chart.addSeries(LineSeries, {
    color: '#f97316', lineWidth: 2,
    priceScaleId: 'rev', lastValueVisible: false, priceLineVisible: false
  })
  chart.priceScale('rev').applyOptions({ visible: false, scaleMargins })

  profitSeries = chart.addSeries(LineSeries, {
    color: '#1d4ed8', lineWidth: 2,
    priceScaleId: 'profit', lastValueVisible: false, priceLineVisible: false
  })
  chart.priceScale('profit').applyOptions({ visible: false, scaleMargins })

  marginSeries = chart.addSeries(LineSeries, {
    color: '#059669', lineWidth: 2,
    priceScaleId: 'margin', lastValueVisible: false, priceLineVisible: false
  })
  chart.priceScale('margin').applyOptions({ visible: false, scaleMargins })

  chart.subscribeCrosshairMove(onCrosshairMove)
  updateData()

  resizeObserver = new ResizeObserver(() => {
    if (chart && el.value) chart.applyOptions({ width: el.value.clientWidth })
  })
  resizeObserver.observe(wrap.value)
}

const updateData = () => {
  if (!chart) return
  timeIndexMap = {}
  props.periods.forEach((p, i) => { timeIndexMap[toTime(p)] = i })

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
.finance-chart-wrap { position: relative; width: 100%; }
.finance-chart { width: 100%; }
.finance-tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.7;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  white-space: nowrap;
  z-index: 10;
}
.tooltip-period { font-weight: 600; color: #374151; margin-bottom: 1px; font-size: 11px; }
</style>
