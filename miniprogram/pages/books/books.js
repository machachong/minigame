const { request } = require('../../utils/request')

Page({
  data: {
    tab: 'all',
    books: [],
    filtered: [],
    currentId: null
  },

  onShow() {
    getApp().ensureLogin().then(() => this.load())
  },

  load() {
    const app = getApp()
    request({ url: '/api/books' }).then((books) => {
      this.setData({
        books: books || [],
        currentId: app.globalData.bookId
      })
      this.applyFilter()
    })
  },

  applyFilter() {
    const { tab, books } = this.data
    let filtered = books
    if (tab === 'personal') filtered = books.filter((b) => b.kind === 'personal')
    if (tab === 'family') filtered = books.filter((b) => b.kind === 'family')
    this.setData({ filtered })
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
    this.applyFilter()
  },

  selectBook(e) {
    const { id, name } = e.currentTarget.dataset
    const app = getApp()
    app.globalData.bookId = id
    app.globalData.bookName = name
    wx.setStorageSync('bookId', id)
    wx.setStorageSync('bookName', name)
    this.setData({ currentId: id })
    wx.showToast({ title: '已切换', icon: 'success' })
  },

  goFamily(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/family/family?id=${id}` })
  },

  createPersonal() {
    this._create('personal', '个人账本')
  },

  createFamily() {
    this._create('family', '家庭账本')
  },

  _create(kind, placeholder) {
    wx.showModal({
      title: kind === 'family' ? '创建家庭账本' : '新建个人账本',
      editable: true,
      placeholderText: placeholder,
      success: (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim() || placeholder
        request({
          url: '/api/books',
          method: 'POST',
          data: { name, kind }
        }).then((book) => {
          wx.showToast({ title: '已创建', icon: 'success' })
          this.load()
          if (kind === 'family') {
            wx.navigateTo({ url: `/pages/family/family?id=${book.id}` })
          }
        })
      }
    })
  }
})
