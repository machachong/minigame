const { baseURL } = require('./config')

function getToken() {
  const app = getApp()
  return (app && app.globalData.token) || wx.getStorageSync('token') || ''
}

function request(options) {
  const token = getToken()
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseURL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: Object.assign(
        {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        options.header || {}
      ),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('token')
          const app = getApp()
          if (app) app.globalData.token = ''
          reject(res.data || { detail: '未登录' })
        } else {
          reject(res.data || { detail: '请求失败' })
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

/** wx.login + 可选昵称/头像发给后端 */
function login(profile) {
  const extra = profile || {}
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        const code = loginRes.code || 'dev'
        const data = { code }
        if (extra.nickname) data.nickname = extra.nickname
        if (extra.avatar_url) data.avatar_url = extra.avatar_url
        wx.request({
          url: baseURL + '/api/auth/login',
          method: 'POST',
          data,
          header: { 'Content-Type': 'application/json' },
          success(res) {
            if (res.statusCode === 200 && res.data.token) {
              resolve(res.data)
            } else {
              reject(res.data || { detail: '登录失败' })
            }
          },
          fail: reject
        })
      },
      fail: reject
    })
  })
}

function formatYuan(cents) {
  const n = (Number(cents) || 0) / 100
  return n.toFixed(2)
}

function currentYearMonth() {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}`
}

module.exports = { request, login, formatYuan, currentYearMonth, baseURL }
