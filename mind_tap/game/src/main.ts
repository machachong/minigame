// 入口
import { Game } from './Game';

const game = new Game();
game.start().catch((e) => {
  console.error('[main] 启动失败:', e);
});
