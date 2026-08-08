// 渲染器:Canvas 封装、DPR 高清适配、安全区
export class Renderer {
  canvas: any = null;
  ctx!: CanvasRenderingContext2D;
  /** 逻辑像素尺寸(UI 坐标系) */
  width = 0;
  height = 0;
  dpr = 1;
  safeTop = 0;
  safeBottom = 0;
  /** 低端机标记:降低粒子与帧率 */
  lowEnd = false;

  init(): void {
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    const info = wx.getWindowInfo();
    this.dpr = info.pixelRatio || 1;
    this.width = info.windowWidth;
    this.height = info.windowHeight;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);

    const safe = info.safeArea;
    if (safe) {
      this.safeTop = safe.top;
      this.safeBottom = Math.max(0, info.windowHeight - safe.bottom);
    }

    // 低端机探测:屏幕小或 DPR 低的设备降配
    this.lowEnd = this.width * this.height * this.dpr < 750 * 1334 * 1.5;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /** 内容安全区域(避开刘海/Home 指示条) */
  get contentTop(): number {
    return this.safeTop + 8;
  }
  get contentBottom(): number {
    return this.height - this.safeBottom - 8;
  }
  get cx(): number {
    return this.width / 2;
  }
}
