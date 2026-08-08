// 自研轻量 UI 树:节点基类(绝对定位、命中测试、触摸分发)
export type TouchPhase = 'start' | 'move' | 'end';

export abstract class UINode {
  x = 0;
  y = 0;
  w = 0;
  h = 0;
  visible = true;
  children: UINode[] = [];
  parent: UINode | null = null;

  add<T extends UINode>(child: T): T {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(child: UINode): void {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
  }

  removeAll(): void {
    this.children.length = 0;
  }

  get absX(): number {
    return (this.parent ? this.parent.absX : 0) + this.x;
  }
  get absY(): number {
    return (this.parent ? this.parent.absY : 0) + this.y;
  }

  hitTest(px: number, py: number): boolean {
    return (
      this.visible &&
      px >= this.absX &&
      px <= this.absX + this.w &&
      py >= this.absY &&
      py <= this.absY + this.h
    );
  }

  /** 子类实现绘制 */
  protected abstract draw(ctx: CanvasRenderingContext2D): void;

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.visible) return;
    ctx.save();
    this.draw(ctx);
    for (const c of this.children) c.render(ctx);
    ctx.restore();
  }

  /** 触摸分发:后添加的子节点优先(顶层优先) */
  dispatchTouch(phase: TouchPhase, px: number, py: number): boolean {
    if (!this.visible) return false;
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.children[i].dispatchTouch(phase, px, py)) return true;
    }
    return this.onTouch(phase, px, py);
  }

  protected onTouch(_phase: TouchPhase, _px: number, _py: number): boolean {
    return false;
  }
}

/** 容器节点(自身不绘制) */
export class UIContainer extends UINode {
  protected draw(): void {}
}
