const { request, formatYuan, currentYearMonth } = require('../../utils/request')

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatDay(dateStr) {
  const parts = String(dateStr).split('-')
  if (parts.length !== 3) return { dateLabel: dateStr, weekLabel: '' }
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  const dt = new Date(y, m - 1, d)
  return {
    dateLabel: `${m}月${d}日`,
    weekLabel: WEEK[dt.getDay()] || ''
  }
}

Page({
  data: {
    yearMonth: '',
    expense: '0.00',
    income: '0.00',
    groups: [],
    loading: true
  },

  onShow() {
    getApp().ensureLogin().then(() => this.load())
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  load() {
    const bookId = getApp().globalData.bookId
    const ym = currentYearMonth()
    this.setData({ yearMonth: ym })
    if (!bookId) {
      this.setData({ loading: false })
      return Promise.resolve()
    }

    return Promise.all([
      request({ url: `/api/stats/summary?book_id=${bookId}&year_month=${ym}` }),
      request({ url: `/api/records?book_id=${bookId}&year_month=${ym}&limit=200` })
    ]).then(([summary, records]) => {
      const map = {}
      ;(records || []).forEach((r) => {
        const d = r.record_date
        if (!map[d]) map[d] = { date: d, items: [], expenseCents: 0, incomeCents: 0 }
        const item = Object.assign({}, r, { amountYuan: formatYuan(r.amount_cents) })
        map[d].items.push(item)
        if (r.type === 'expense') map[d].expenseCents += r.amount_cents
        else map[d].incomeCents += r.amount_cents
      })
      const groups = Object.keys(map)
        .sort((a, b) => (a < b ? 1 : -1))
        .map((k) => {
          const labels = formatDay(map[k].date)
          return {
            date: map[k].date,
            dateLabel: labels.dateLabel,
            weekLabel: labels.weekLabel,
            items: map[k].items,
            expense: formatYuan(map[k].expenseCents),
            income: formatYuan(map[k].incomeCents),
            expenseCents: map[k].expenseCents,
            incomeCents: map[k].incomeCents
          }
        })
      this.setData({
        expense: formatYuan(summary.expense_cents),
        income: formatYuan(summary.income_cents),
        groups,
        loading: false
      })
    }).catch(() => {
      this.setData({ loading: false })
    })
  }
})
