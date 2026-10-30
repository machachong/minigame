const { request, formatYuan, currentYearMonth } = require('../../utils/request')

Page({
  data: {
    type: 'expense',
    yearMonth: '',
    total: '0.00',
    items: [],
    loading: true,
    listFading: false
  },

  onShow() {
    getApp().ensureLogin().then(() => this.load())
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type
    if (type === this.data.type) return
    this.setData({ type, listFading: true })
    setTimeout(() => this.load(), 100)
  },

  load() {
    const bookId = getApp().globalData.bookId
    const ym = currentYearMonth()
    this.setData({ yearMonth: ym })
    if (!bookId) {
      this.setData({ loading: false, listFading: false })
      return
    }
    request({
      url: `/api/stats/by-category?book_id=${bookId}&year_month=${ym}&type=${this.data.type}`
    }).then((data) => {
      // 先置 0 宽再下一帧拉到目标，做出过渡感
      const raw = (data.items || []).map((it) =>
        Object.assign({}, it, {
          amountYuan: formatYuan(it.amount_cents),
          pct: Math.max(1, Math.round((it.ratio || 0) * 100)),
          barPct: 0
        })
      )
      this.setData({
        total: formatYuan(data.total_cents),
        items: raw,
        loading: false,
        listFading: false
      })
      setTimeout(() => {
        this.setData({
          items: raw.map((it) => Object.assign({}, it, { barPct: Math.max(2, it.pct) }))
        })
      }, 40)
    }).catch(() => {
      this.setData({ loading: false, listFading: false })
    })
  }
})
