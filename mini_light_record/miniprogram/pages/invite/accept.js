const { request } = require('../../utils/request')

Page({
  data: {
    code: '',
    preview: null,
    error: '',
    phone: ''
  },

  onLoad(query) {
    const code = (query.code || '').trim()
    this.setData({ code })
    getApp().ensureLogin().then(() => {
      const user = getApp().globalData.user || {}
      this.setData({ phone: user.phone || '' })
      if (code) this.loadPreview()
      else this.setData({ error: '缺少邀请码' })
    })
  },

  loadPreview() {
    request({ url: `/api/invites/${this.data.code}` })
      .then((preview) => this.setData({ preview, error: '' }))
      .catch(() => this.setData({ error: '邀请不存在或已失效', preview: null }))
  },

  accept() {
    request({
      url: `/api/invites/${this.data.code}/accept`,
      method: 'POST'
    })
      .then((res) => {
        wx.showToast({ title: '已加入', icon: 'success' })
        const app = getApp()
        app.globalData.bookId = res.book_id
        wx.setStorageSync('bookId', res.book_id)
        setTimeout(() => {
          wx.switchTab({ url: '/pages/home/home' })
        }, 500)
      })
      .catch((err) => {
        wx.showToast({ title: (err && err.detail) || '加入失败', icon: 'none' })
        this.loadPreview()
      })
  },

  bindPhone() {
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
            getApp().globalData.user = user
            wx.setStorageSync('user', user)
            this.setData({ phone: user.phone })
            wx.showToast({ title: '已绑定', icon: 'success' })
          })
          .catch((err) => {
            wx.showToast({ title: (err && err.detail) || '绑定失败', icon: 'none' })
          })
      }
    })
  }
})
