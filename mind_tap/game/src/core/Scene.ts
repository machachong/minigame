// 场景基类 + 栈式场景管理
// 约定:全屏场景用 replace 切换;弹层面板用 push/pop(仅栈顶接收输入,渲染只画栈顶)
import type { Game } from '../Game';

export abstract class Scene {
  protected game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  /** 进入场景(push/replace 后调用) */
  abstract enter(params?: any): void;
  /** 离开场景(被 pop/replace 时调用) */
  abstract exit(): void;
  abstract update(dtMs: number): void;
  abstract render(ctx: CanvasRenderingContext2D): void;
  /** 返回 true 表示触摸已被消费 */
  onTouchStart(_x: number, _y: number): boolean {
    return false;
  }
  onTouchMove(_x: number, _y: number): void {}
  onTouchEnd(_x: number, _y: number): void {}
}

export class SceneManager {
  private stack: Scene[] = [];

  get top(): Scene | null {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
  }

  replace(scene: Scene, params?: any): void {
    while (this.stack.length) this.stack.pop()!.exit();
    this.stack.push(scene);
    scene.enter(params);
  }

  push(scene: Scene, params?: any): void {
    this.stack.push(scene);
    scene.enter(params);
  }

  pop(): void {
    const s = this.stack.pop();
    s?.exit();
  }

  update(dtMs: number): void {
    this.top?.update(dtMs);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.top?.render(ctx);
  }
}
