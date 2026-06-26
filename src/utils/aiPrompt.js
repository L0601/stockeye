// 股票分析 prompt 构建（纯函数，便于单测）
// 数据源为解析页 displayText：已含概览/技术走势/财务三段，且技术走势带复权口径说明

const SYSTEM_PROMPT = `你是一位资深的证券分析师，熟悉 A 股、港股、美股。请基于用户提供的【股票数据】做客观分析，要求如下：

1. 严格基于给定数据进行分析，不要臆造数据中没有的信息；数据不足时请明确指出。
2. 用 Markdown 分段输出，依次包含以下小节（用二级标题）：
   - 情绪面：当前市场情绪、量价配合、换手与振幅反映的活跃度
   - 短期（数日~数周）：趋势与可能方向
   - 中期（数月~一年）：趋势与可能方向
   - 支撑位：给出具体价位区间及依据
   - 压力位：给出具体价位区间及依据
   - 风险提示：需要关注的风险点
3. 数据口径说明（务必据此理解，不要混淆）：
   - 涨跌幅按区间起止价的收盘价口径计算；但最新一期的"现价端"为该交易日的最近成交价，若当日尚未收盘则为盘中实时价、并非最终收盘价。
   - 1 年及以内的涨幅按【前复权】口径计算，2 年及以上的涨幅按【后复权】口径计算。
   - 估值历史分位（PE/PB/PS）为当前值在该周期历史分布中的百分位，越低代表估值相对越便宜；仅 A 股提供，港股/美股暂无该数据。
   - 成交活跃度中的"量比"为近 5 日均量 / 近一年日均量；"当日量/MA5(10/20)"为当日成交量相对近 5/10/20 日均量的倍数，>1 放量、<1 缩量（盘中当日量尚未走完，倍数会偏低，需结合时段判断）。
   - 均线体系基于复权收盘价：偏离% 为当前价相对该均线的乖离；"多头排列"指短期均线在上（趋势向上），"空头排列"反之，"纠缠"表示无明显趋势。
   - 价格位置中"区间位置"为当前价在近一年高低点之间的百分位（0% 贴近最低、100% 贴近最高）。
   - 风险指标：年化波动率越高波动越剧烈；最大回撤为近一年从高点到低点的最大跌幅（负值）。
   - 财务同比增速(YoY)为该报告期相对上年同期的营收/净利增速。
   - 页面行情数据约有 30 分钟延迟。
4. 结论要给出明确判断和理由，避免空泛套话；估值判断请结合 PE 历史分位。`

// 根据是否盘中、当前日期，生成对"最新价是否为收盘价"的明确提示
function buildContextNote({ marketOpen, dateStr }) {
  const lines = []
  if (dateStr) lines.push(`当前日期：${dateStr}。`)
  if (marketOpen) {
    lines.push('重要：该股票当前正处于交易时段，最新一个数据点（含"当前"价以及最近一段涨跌幅的现价端）为盘中实时价，并非最终收盘价，收盘后仍可能变化。请在分析中明确指出这一不确定性，不要把它当作已确定的收盘价。')
  } else {
    lines.push('该股票当前不在交易时段，最新数据点为最近一个交易日的收盘价。')
  }
  return lines.join('\n')
}

// 构造发送给模型的消息数组
export function buildAnalysisMessages(displayText, { name, marketOpen = false, dateStr = '', extraData = '' } = {}) {
  const title = name ? `股票【${name}】` : '该股票'
  const note = buildContextNote({ marketOpen, dateStr })
  const extra = extraData ? `\n\n补充指标：\n${extraData}` : ''
  const userContent = `请分析${title}。\n\n${note}\n\n以下是页面解析到的全部数据：\n\n${displayText || ''}${extra}`
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ]
}

// 将消息数组拼成可直接复制粘贴的纯文本 prompt（便于在外部 AI 中复用）
const ROLE_LABELS = { system: '系统提示', user: '用户输入', assistant: '助手' }
export function formatMessagesAsPrompt(messages = []) {
  return messages
    .map((m) => `【${ROLE_LABELS[m.role] || m.role}】\n${m.content}`)
    .join('\n\n')
}
