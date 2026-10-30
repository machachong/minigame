const { request, formatYuan, currentYearMonth } = require('../../utils/request')

Page({
  data: {
    yearMonth: '',
    bookName: '',
    expense: '0.00',
    income: '0.00',
    budget: '0.00',
    budgetCents: 0,
    ratioPct: 0,
    ratioText: '0%',
    recent: [],
    loading: true
  },

  onShow() {
    const app = getApp()
    app.ensureLogin().then(() => this.load()).catch((e) => {
      this.setData({ loading: false })
      wx.showToast({ title: (e && e.detail) || '登录失败', icon: 'none' })
    })
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  load() {
    const app = getApp()
    const bookId = app.globalData.bookId
    const ym = currentYearMonth()
    this.setData({ yearMonth: ym, bookName: app.globalData.bookName || '日常账本' })
    if (!bookId) {
      this.setData({ loading: false })
      return Promise.resolve()
    }

    return Promise.all([
      request({ url: `/api/stats/summary?book_id=${bookId}&year_month=${ym}` }),
      request({ url: `/api/records?book_id=${bookId}&year_month=${ym}&limit=8` })
    ]).then(([summary, records]) => {
      const ratio = Math.min(100, Math.round((summary.budget_used_ratio || 0) * 100))
      this.setData({
        expense: formatYuan(summary.expense_cents),
        income: formatYuan(summary.income_cents),
        budget: formatYuan(summary.budget_cents),
        budgetCents: summary.budget_cents,
        ratioPct: ratio,
        ratioText: ratio + '%',
        recent: (records || []).map((r) => Object.assign({}, r, { amountYuan: formatYuan(r.amount_cents) })),
        loading: false
      })
    }).catch((e) => {
      this.setData({ loading: false })
      wx.showToast({ title: (e && e.detail) || '加载失败', icon: 'none' })
    })
  },

  goLedger() {
    wx.switchTab({ url: '/pages/ledger/ledger' })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/record' })
  }
})
