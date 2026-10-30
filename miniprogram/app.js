const { login } = require('./utils/request')

App({
  globalData: {
    token: '',
    user: null,
    bookId: null,
    bookName: '日常账本',
    pendingInviteCode: ''
  },

  onLaunch(options) {
    const token = wx.getStorageSync('token')
    const user = wx.getStorageSync('user')
    const bookId = wx.getStorageSync('bookId')
    if (token) {
      this.globalData.token = token
      this.globalData.user = user
      this.globalData.bookId = bookId
      this.globalData.bookName = wx.getStorageSync('bookName') || '日常账本'
    }

    const inviteCode = this._extractInviteCode(options)
    if (inviteCode) {
      this.globalData.pendingInviteCode = inviteCode
    }

    this.ensureLogin().then(() => {
      if (this.globalData.pendingInviteCode) {
        const code = this.globalData.pendingInviteCode
        this.globalData.pendingInviteCode = ''
        wx.navigateTo({ url: `/pages/invite/accept?code=${code}` })
      }
    })
  },

  _extractInviteCode(options) {
    if (!options) return ''
    const q = options.query || {}
    if (q.code) return String(q.code)
    // 从分享 path 进入：pages/invite/accept?code=XXX
    const path = options.path || ''
    const m = /[?&]code=([A-Za-z0-9]+)/.exec(path)
    if (m) return m[1]
    if (options.scene) {
      // 扫码等场景可后续扩展
    }
    return ''
  },

  ensureLogin() {
    return new Promise((resolve, reject) => {
      if (this.globalData.token && this.globalData.bookId) {
        resolve(this.globalData)
        return
      }
      login()
        .then((data) => {
          this.globalData.token = data.token
          this.globalData.user = data.user
          wx.setStorageSync('token', data.token)
          wx.setStorageSync('user', data.user)
          return this.loadDefaultBook()
        })
        .then(() => resolve(this.globalData))
        .catch(reject)
    })
  },

  loadDefaultBook() {
    const { request } = require('./utils/request')
    return request({ url: '/api/books', method: 'GET' }).then((books) => {
      if (books && books.length) {
        const def = books.find((b) => b.is_default) || books[0]
        this.globalData.bookId = def.id
        this.globalData.bookName = def.name
        wx.setStorageSync('bookId', def.id)
        wx.setStorageSync('bookName', def.name)
      }
    })
  }
})
