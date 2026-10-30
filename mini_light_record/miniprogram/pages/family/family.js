const { request } = require('../../utils/request')

Page({
  data: {
    bookId: null,
    book: {},
    members: [],
    canInvite: false,
    canManage: false,
    lastInvite: null
  },

  onLoad(query) {
    this.setData({ bookId: Number(query.id) })
  },

  onShow() {
    getApp().ensureLogin().then(() => this.load())
  },

  onShareAppMessage() {
    const inv = this.data.lastInvite
    if (inv) {
      return {
        title: `邀请你加入「${this.data.book.name}」一起记账`,
        path: inv.path
      }
    }
    return {
      title: '轻记 · 家庭记账',
      path: '/pages/home/home'
    }
  },

  load() {
    const id = this.data.bookId
    if (!id) return
    Promise.all([
      request({ url: `/api/books/${id}` }),
      request({ url: `/api/books/${id}/members` })
    ]).then(([book, members]) => {
      const canInvite = book.role === 'owner' || book.role === 'admin'
      this.setData({
        book,
        members: members || [],
        canInvite,
        canManage: canInvite
      })
    })
  },

  inviteShare() {
    request({
      url: `/api/books/${this.data.bookId}/invites`,
      method: 'POST',
      data: { channel: 'share' }
    }).then((inv) => {
      this.setData({ lastInvite: inv })
      wx.setClipboardData({ data: inv.code })
      wx.showToast({ title: '口令已复制', icon: 'success' })
    })
  },

  invitePhone() {
    wx.showModal({
      title: '手机号邀请',
      editable: true,
      placeholderText: '请输入对方手机号',
      success: (res) => {
        if (!res.confirm) return
        const phone = (res.content || '').trim()
        if (!phone) {
          wx.showToast({ title: '请填写手机号', icon: 'none' })
          return
        }
        request({
          url: `/api/books/${this.data.bookId}/invites`,
          method: 'POST',
          data: { channel: 'phone', phone }
        }).then((inv) => {
          this.setData({ lastInvite: inv })
          wx.showToast({ title: '邀请已创建', icon: 'success' })
        }).catch((err) => {
          wx.showToast({ title: (err && err.detail) || '失败', icon: 'none' })
        })
      }
    })
  },

  copyInvite() {
    const inv = this.data.lastInvite
    if (!inv) return
    wx.setClipboardData({ data: inv.code })
  },

  removeMember(e) {
    const uid = e.currentTarget.dataset.uid
    wx.showModal({
      title: '移除成员？',
      success: (res) => {
        if (!res.confirm) return
        request({
          url: `/api/books/${this.data.bookId}/members/${uid}`,
          method: 'DELETE'
        }).then(() => {
          wx.showToast({ title: '已移除', icon: 'success' })
          this.load()
        })
      }
    })
  }
})
