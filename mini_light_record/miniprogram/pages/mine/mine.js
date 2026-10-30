const { request, login, currentYearMonth } = require('../../utils/request')

Page({
  data: {
    user: {},
    bookName: '',
    editNickname: '',
    pendingAvatar: '',
    avatarLetter: '轻',
    nameFocused: false
  },

  onShow() {
    const app = getApp()
    app.ensureLogin().then(() => this.syncUser())
  },

  syncUser() {
    const app = getApp()
    const user = app.globalData.user || {}
    const nick = user.nickname || '轻记用户'
    this.setData({
      user,
      bookName: app.globalData.bookName || '',
      editNickname: nick,
      pendingAvatar: user.avatar_url || '',
      avatarLetter: nick.slice(0, 1)
    })
  },

  applyUser(user) {
    const app = getApp()
    app.globalData.user = user
    wx.setStorageSync('user', user)
    this.syncUser()
  },

  onChooseAvatar(e) {
    const url = (e.detail && e.detail.avatarUrl) || ''
    if (!url) return
    this.setData({ pendingAvatar: url })
    // 本地预览；正式环境可先上传再 PATCH avatar_url
    const user = Object.assign({}, this.data.user, { avatar_url: url })
    this.setData({ user })
  },

  onNicknameChange(e) {
    this.setData({ editNickname: e.detail.value || '' })
  },

  onNameFocus() {
    this.setData({ nameFocused: true })
  },

  onNicknameBlur(e) {
    const v = (e.detail.value || '').trim()
    const patch = { nameFocused: false }
    if (v) {
      patch.editNickname = v
      patch.avatarLetter = v.slice(0, 1)
    }
    this.setData(patch)
  },

  saveProfile() {
    const nickname = (this.data.editNickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    const data = { nickname }
    if (this.data.pendingAvatar) data.avatar_url = this.data.pendingAvatar
    request({ url: '/api/me', method: 'PATCH', data })
      .then((user) => {
        this.applyUser(user)
        wx.showToast({ title: '已保存', icon: 'success' })
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.detail) || '保存失败', icon: 'none' })
      })
  },

  oneClickLogin() {
    const nickname = (this.data.editNickname || '').trim()
    const profile = {}
    if (nickname) profile.nickname = nickname
    if (this.data.pendingAvatar) profile.avatar_url = this.data.pendingAvatar
    login(profile)
      .then((data) => {
        const app = getApp()
        app.globalData.token = data.token
        app.globalData.user = data.user
        wx.setStorageSync('token', data.token)
        wx.setStorageSync('user', data.user)
        return app.loadDefaultBook().then(() => data.user)
      })
      .then((user) => {
        this.applyUser(user)
        wx.showToast({ title: '登录成功', icon: 'success' })
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.detail) || '登录失败', icon: 'none' })
      })
  },

  onGetPhoneNumber(e) {
    const detail = e.detail || {}
    if (detail.errMsg && detail.errMsg.indexOf('ok') < 0) {
      wx.showToast({ title: '未授权手机号', icon: 'none' })
      return
    }
    const code = detail.code
    if (!code) {
      // 开发者工具可能无 code，引导手动绑定
      wx.showToast({ title: '无 phone code，请用手动绑定', icon: 'none' })
      return
    }
    request({
      url: '/api/auth/phone',
      method: 'POST',
      data: { code }
    })
      .then((user) => {
        this.applyUser(user)
        wx.showToast({ title: '已绑定手机', icon: 'success' })
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.detail) || '绑定失败', icon: 'none' })
      })
  },

  bindPhoneManual() {
    wx.showModal({
      title: '绑定手机号',
      editable: true,
      placeholderText: '11 位手机号',
      success: (res) => {
        if (!res.confirm) return
        const phone = (res.content || '').trim()
        request({
          url: '/api/me/phone',
          method: 'POST',
          data: { phone }
        })
          .then((user) => {
            this.applyUser(user)
            wx.showToast({ title: '已绑定', icon: 'success' })
          })
          .catch((err) => {
            wx.showToast({ title: (err && err.detail) || '失败', icon: 'none' })
          })
      }
    })
  },

  goBooks() {
    wx.navigateTo({ url: '/pages/books/books' })
  },

  showBooks() {
    request({ url: '/api/books' }).then((books) => {
      const names = books.map((b) => {
        const tag = b.kind === 'family' ? '家庭' : '个人'
        return `${b.name}（${tag}）`
      })
      wx.showActionSheet({
        itemList: names,
        success: (res) => {
          const b = books[res.tapIndex]
          const app = getApp()
          app.globalData.bookId = b.id
          app.globalData.bookName = b.name
          wx.setStorageSync('bookId', b.id)
          wx.setStorageSync('bookName', b.name)
          this.setData({ bookName: b.name })
          wx.showToast({ title: '已切换', icon: 'success' })
        }
      })
    })
  },

  setBudget() {
    const bookId = getApp().globalData.bookId
    const ym = currentYearMonth()
    wx.showModal({
      title: '设置本月预算（元）',
      editable: true,
      placeholderText: '例如 3000',
      success: (res) => {
        if (!res.confirm) return
        const yuan = parseFloat(res.content)
        if (isNaN(yuan) || yuan < 0) {
          wx.showToast({ title: '金额无效', icon: 'none' })
          return
        }
        request({
          url: '/api/budgets',
          method: 'POST',
          data: {
            book_id: bookId,
            year_month: ym,
            amount_cents: Math.round(yuan * 100)
          }
        }).then(() => wx.showToast({ title: '已保存', icon: 'success' }))
      }
    })
  },

  reLogin() {
    wx.removeStorageSync('token')
    wx.removeStorageSync('user')
    wx.removeStorageSync('bookId')
    const app = getApp()
    app.globalData.token = ''
    app.globalData.bookId = null
    app.ensureLogin().then(() => {
      this.syncUser()
      wx.showToast({ title: '已登录', icon: 'success' })
    })
  }
})
