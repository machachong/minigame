const { request } = require('../../utils/request')

function canSaveFrom(data) {
  const cents = Math.round(parseFloat(data.amountStr) * 100)
  return !!(cents && cents > 0 && !isNaN(cents) && data.selectedCategoryId && data.accountId)
}

Page({
  data: {
    type: 'expense',
    categoryTree: [],
    parentCategories: [],
    childCategories: [],
    selectedParentId: null,
    selectedCategoryId: null,
    accounts: [],
    accountId: null,
    accountName: '',
    amountStr: '0',
    note: '',
    canSave: false,
    catFading: false,
    childAnimKey: 0,
    amountPulse: false,
    noteFocused: false,
    saving: false
  },

  onShow() {
    getApp().ensureLogin().then(() => this.loadMeta())
  },

  _syncCanSave(extra) {
    const next = Object.assign({}, this.data, extra || {})
    const canSave = canSaveFrom(next)
    if (extra) {
      extra.canSave = canSave
      this.setData(extra)
    } else {
      this.setData({ canSave })
    }
  },

  loadMeta() {
    const bookId = getApp().globalData.bookId
    if (!bookId) return
    const type = this.data.type
    Promise.all([
      request({ url: `/api/categories?book_id=${bookId}&type=${type}` }),
      request({ url: `/api/accounts?book_id=${bookId}` })
    ]).then(([tree, accs]) => {
      const roots = tree || []
      const parent = roots[0] || null
      const children = parent && parent.children ? parent.children : []
      const leaf = children[0] || null
      const account = (accs || []).find((a) => a.id === this.data.accountId) || (accs && accs[0])
      this._syncCanSave({
        categoryTree: roots,
        parentCategories: roots,
        childCategories: children,
        selectedParentId: parent ? parent.id : null,
        selectedCategoryId: leaf ? leaf.id : null,
        accounts: accs || [],
        accountId: account ? account.id : null,
        accountName: account ? account.name : '',
        childAnimKey: this.data.childAnimKey + 1,
        catFading: false
      })
    })
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type
    if (type === this.data.type) return
    this.setData({ type, catFading: true, selectedParentId: null, selectedCategoryId: null, childCategories: [], canSave: false })
    setTimeout(() => {
      this.loadMeta()
    }, 120)
  },

  selectParent(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.selectedParentId) return
    const parent = (this.data.categoryTree || []).find((p) => p.id === id)
    const children = parent && parent.children ? parent.children : []
    const leaf = children[0] || null
    this._syncCanSave({
      selectedParentId: id,
      childCategories: children,
      selectedCategoryId: leaf ? leaf.id : null,
      childAnimKey: this.data.childAnimKey + 1
    })
  },

  selectCategory(e) {
    const id = e.currentTarget.dataset.id
    this._syncCanSave({ selectedCategoryId: id })
  },

  pickAccount() {
    const names = this.data.accounts.map((a) => a.name)
    if (!names.length) {
      wx.showToast({ title: '暂无账户', icon: 'none' })
      return
    }
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const a = this.data.accounts[res.tapIndex]
        this._syncCanSave({ accountId: a.id, accountName: a.name })
      }
    })
  },

  onNote(e) {
    this.setData({ note: e.detail.value })
  },
  onNoteFocus() {
    this.setData({ noteFocused: true })
  },
  onNoteBlur() {
    this.setData({ noteFocused: false })
  },

  _pulseAmount() {
    this.setData({ amountPulse: true })
    setTimeout(() => this.setData({ amountPulse: false }), 120)
  },

  onKey(e) {
    const k = e.currentTarget.dataset.k
    let s = this.data.amountStr
    if (k === '.') {
      if (s.indexOf('.') >= 0) return
      s = s + '.'
    } else if (k === '00') {
      if (s === '0') return
      const parts = s.split('.')
      if (parts[1] !== undefined) {
        const remain = 2 - parts[1].length
        if (remain <= 0) return
        s = s + '0'.repeat(remain)
      } else {
        if (s.length >= 8) return
        s = s + '00'
      }
    } else {
      if (s === '0') s = k
      else {
        const parts = s.split('.')
        if (parts[1] && parts[1].length >= 2) return
        if (!parts[1] && parts[0].length >= 8) return
        s = s + k
      }
    }
    this._syncCanSave({ amountStr: s })
    this._pulseAmount()
  },

  onDel() {
    let s = this.data.amountStr
    if (s.length <= 1) s = '0'
    else s = s.slice(0, -1)
    if (s === '' || s === '.') s = '0'
    this._syncCanSave({ amountStr: s })
    this._pulseAmount()
  },

  onClear() {
    this._syncCanSave({ amountStr: '0' })
    this._pulseAmount()
  },

  onSave() {
    if (this.data.saving) return
    const cents = Math.round(parseFloat(this.data.amountStr) * 100)
    if (!cents || cents <= 0 || isNaN(cents)) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    if (!this.data.selectedCategoryId) {
      wx.showToast({ title: '请选择小类', icon: 'none' })
      return
    }
    if (!this.data.accountId) {
      wx.showToast({ title: '请选择账户', icon: 'none' })
      return
    }
    const bookId = getApp().globalData.bookId
    this.setData({ saving: true })
    request({
      url: '/api/records',
      method: 'POST',
      data: {
        book_id: bookId,
        account_id: this.data.accountId,
        category_id: this.data.selectedCategoryId,
        type: this.data.type,
        amount_cents: cents,
        note: this.data.note || ''
      }
    })
      .then(() => {
        try {
          wx.vibrateShort({ type: 'light' })
        } catch (e) { /* ignore */ }
        wx.showToast({ title: '已记一笔', icon: 'success' })
        this._syncCanSave({ amountStr: '0', note: '', saving: false })
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 450)
      })
      .catch((err) => {
        this.setData({ saving: false })
        wx.showToast({ title: (err && err.detail) || '保存失败', icon: 'none' })
      })
  }
})
