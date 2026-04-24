# 中国象棋 AI 对战项目

这是一个基于 `React + TypeScript + Vite` 的本地前端项目，内置完整的中国象棋规则引擎与搜索型 AI。

项目特点：

- 玩家固定执上侧黑方，AI 固定执下侧红方
- AI 默认先手，且走法全部经过合法性校验
- 支持将军、将死、将帅照面、蹩马腿、塞象眼、炮架等规则
- AI 使用 `Minimax + Alpha-Beta Pruning`
- 支持最近走法显示、AI 上一步高亮、重新开始、回退一步
- 悔棋基于 `historyStack` 完整局面快照恢复，不只撤销单个 `Move`

## 安装与运行

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```

## AI 搜索深度

默认搜索深度定义在：

- `src/engine/ai.ts`

你可以调整：

```ts
export const AI_SEARCH_DEPTH = 3;
```

建议：

- `3`：速度与体验较平衡
- `4`：更强，但浏览器计算压力会明显上升

## 项目结构

```text
src/
  App.tsx
  main.tsx
  styles/
    board.css
  types/
    chess.ts
  constants/
    initialBoard.ts
    pieceValues.ts
  engine/
    rules.ts
    moveGenerator.ts
    check.ts
    evaluation.ts
    ai.ts
  components/
    ChessBoard.tsx
    ChessPiece.tsx
    GameInfo.tsx
    MoveHistory.tsx
```

## 规则说明

本项目实现了以下核心规则：

- 车：横竖直线走，不能隔子
- 马：走日字，判断蹩马腿
- 象 / 相：走田字，判断塞象眼，不能过河
- 士 / 仕：九宫内斜走一格
- 将 / 帅：九宫内横竖走一格，且将帅不能照面
- 炮：平走不吃子不能隔子，吃子必须隔一个炮架
- 卒 / 兵：未过河只能前进，过河后可左右平移，永不后退
- 非法走法过滤：任何会让己方处于被将军状态的走法都会被判定为非法

## 悔棋说明

- 若 AI 仅完成开局第一步，点击“回退一步”会回到初始局面
- 常规情况下点击一次“回退一步”，会同时撤销最近的玩家一步和 AI 一步
- 若游戏已结束，仍可回退，回退后会重新恢复为可继续对局的状态
