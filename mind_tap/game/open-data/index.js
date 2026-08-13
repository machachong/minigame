// 开放数据域:好友功德榜渲染
// 运行在独立上下文,只能访问 wx.getFriendCloudStorage / wx.getUserCloudStorage
// 主域通过 postMessage 通信(传入渲染区域宽高与 dpr,避免画布被拉伸变形)

let WIDTH = 375;
let HEIGHT = 500;
let dpr = 1;
let myMerit = 0;
let running = false;
let renderTimer = null;

wx.onMessage((data) => {
  if (data.type === 'renderRank') {
    dpr = data.dpr || 1;
    WIDTH = data.width || 375;
    HEIGHT = data.height || 500;
    myMerit = data.myMerit || 0;
    // 按传入尺寸 + dpr 设置画布物理分辨率,主域按等比绘制不再拉伸
    const canvas = wx.getSharedCanvas();
    canvas.width = Math.floor(WIDTH * dpr);
    canvas.height = Math.floor(HEIGHT * dpr);
    startRender();
  } else if (data.type === 'stop') {
    stopRender();
  }
});

function startRender() {
  if (running) return;
  running = true;
  fetchAndDraw();
  // 每 30s 刷新一次
  renderTimer = setInterval(fetchAndDraw, 30000);
}

function stopRender() {
  running = false;
  if (renderTimer) {
    clearInterval(renderTimer);
    renderTimer = null;
  }
}

function fetchAndDraw() {
  wx.getFriendCloudStorage({
    keyList: ['merit', 'level'],
    success: (res) => {
      const list = (res.data || [])
        .map((u) => ({
          nickname: u.nickname || '同修',
          avatarUrl: u.avatarUrl || '',
          merit: parseInt(getKV(u.KVDataList, 'merit') || '0', 10),
          level: getKV(u.KVDataList, 'level') || '凡夫',
        }))
        .sort((a, b) => b.merit - a.merit);
      drawRank(list);
    },
    fail: (e) => {
      console.warn('[open-data] 获取好友数据失败:', e);
      drawRank([]);
    },
  });
}

function getKV(kvList, key) {
  if (!kvList) return null;
  const item = kvList.find((kv) => kv.key === key);
  return item ? item.value : null;
}

function drawRank(list) {
  const canvas = wx.getSharedCanvas();
  const ctx = canvas.getContext('2d');
  // 逻辑坐标 = 物理像素 / dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = WIDTH - 32;
  const h = HEIGHT;

  // 清空
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // 顶部:我的功德
  ctx.fillStyle = '#C9B98A';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`我的功德 ${myMerit}`, WIDTH / 2, 22);

  if (!list.length) {
    ctx.fillStyle = '#9A8F74';
    ctx.font = '14px sans-serif';
    ctx.fillText('暂无好友数据,分享给好友一起修行吧', w / 2, 80);
    return;
  }

  const rowH = 52;
  const startY = 44;

  list.slice(0, 20).forEach((user, i) => {
    const y = startY + i * rowH;

    // 背景条
    ctx.fillStyle = i < 3 ? 'rgba(232,184,75,0.1)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, y, w, rowH - 4);

    // 排名
    ctx.fillStyle = i < 3 ? '#E8B84B' : '#9A8F74';
    ctx.font = i < 3 ? 'bold 16px sans-serif' : '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), 12, y + rowH / 2 - 2);

    // 昵称
    ctx.fillStyle = '#F5EDD8';
    ctx.font = '15px sans-serif';
    ctx.fillText(user.nickname, 44, y + rowH / 2 - 2);

    // 境界
    ctx.fillStyle = '#9A8F74';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(user.level, w - 100, y + rowH / 2 - 2);

    // 功德
    ctx.fillStyle = '#E8B84B';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(String(user.merit), w - 12, y + rowH / 2 - 2);
    ctx.textAlign = 'left';
  });
}
