# Chinese Xiangqi AI Arena

一个基于 `React + TypeScript + Vite` 的中国象棋 AI 对战项目。它在浏览器本地完成规则校验、AI 搜索、局面评估与交互渲染，不依赖后端。

## 快速开始

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

构建生产版本：

```bash
npm run build
```

## 项目目标

项目不是单纯的棋盘演示，而是一个完整的本地对弈系统，包含：

- 中国象棋标准规则引擎
- 本地搜索型 AI
- 可视化交互棋盘
- 悔棋与历史局面恢复
- 局势评估与胜率走势展示

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
    probability.ts
    ai.ts
  components/
    ChessBoard.tsx
    ChessPiece.tsx
    GameInfo.tsx
    MoveHistory.tsx
    WinProbabilityChart.tsx
  utils/
    presentation.ts
  workers/
    aiWorker.ts
```

## 实现思路

### 1. 规则引擎

规则引擎拆成三层：

- `rules.ts`
  负责单个棋子的伪合法走法生成
- `check.ts`
  负责将军、将死、将帅照面判断
- `moveGenerator.ts`
  负责过滤掉会导致己方被将军的非法走法

这样设计的好处是：

- 单子规则清晰
- 合法性校验统一
- 便于后续扩展 AI 搜索和评估

支持的规则包括：

- 车：横竖直线移动，不能隔子
- 马：日字走法，判断蹩马腿
- 象 / 相：田字走法，判断塞象眼，不能过河
- 士 / 仕：九宫内斜走一格
- 将 / 帅：九宫内横竖走一格，且将帅不能照面
- 炮：平走不吃子不能隔子，吃子必须隔一个炮架
- 卒 / 兵：未过河只能向前，过河后可左右移动，不能后退
- 将军与将死：任何导致己方被将军的走法都会被过滤

### 2. AI 引擎

AI 不是随机走子，而是本地搜索型引擎。

核心文件：

- `src/engine/ai.ts`
- `src/workers/aiWorker.ts`

当前搜索结构包括：

- `Negamax + Alpha-Beta`
- `Iterative Deepening`
- `Transposition Table`
- `Zobrist Hash`
- `Killer Moves`
- `History Heuristic`
- `Quiescence Search`
- `Null Move Pruning`
- `Late Move Reduction`
- 将军延伸
- 轻量开局偏好
- 软截止 + 硬截止双时间控制
- 根节点退让策略
- 静态搜索节点限流

这些机制的目标是：

- 在有限时间内尽量搜索得更深
- 优先把时间花在关键变化上
- 避免中后期复杂局面长时间无响应

### 3. 时间控制

AI 搜索有两个关键时间参数：

```ts
export const AI_SEARCH_DEPTH = 8;
export const AI_THINK_TIME_MS = 12000;
export const AI_MAX_TIME_MS = 58000;
```

含义：

- `AI_SEARCH_DEPTH`
  理论最大深度上限
- `AI_THINK_TIME_MS`
  单步常规搜索预算
- `AI_MAX_TIME_MS`
  硬保护上限，确保单步思考不会超过 1 分钟

当前的时间控制思路：

- 常规情况下优先在 `AI_THINK_TIME_MS` 内结束
- 若局面复杂，会先保住当前已完成深度的最好着法
- 若搜索继续膨胀，也会被 `AI_MAX_TIME_MS` 强制截断
- 中后期复杂局面会自动减少根节点后段分支的深入搜索量

### 4. 局面评估

评估逻辑位于：

- `src/engine/evaluation.ts`

当前评估维度包括：

- 子力与位置分
- 将帅安全
- 中路控制
- 重子直线压迫
- 子力展开速度
- 将军与对将惩奖

### 5. 胜率走势

胜率数据来自：

- `src/engine/probability.ts`

设计原则：

- 每下一步棋生成一个新的评估点
- 图上只画一条优势线
- `50%` 为均势中线
- 高于 `50%` 表示当前显示中的红方更优
- 低于 `50%` 表示当前显示中的黑方更优
- 如果形成绝杀，折线会直接跳到 `100% / 0%`

胜率不是严格统计学意义上的真实概率，而是引擎评估分的可视化映射，重点是：

- 能反映局面趋势
- 有解释依据
- 与引擎判断方向一致

### 6. 前端交互

主流程在：

- `src/App.tsx`

它负责串联：

- 先手选择与开局
- 玩家点击交互
- AI 回合调度
- 完整局面快照保存
- 悔棋恢复
- 胜率历史更新

棋盘相关组件：

- `ChessBoard.tsx`
- `ChessPiece.tsx`

信息与分析面板：

- `GameInfo.tsx`
- `MoveHistory.tsx`
- `WinProbabilityChart.tsx`

### 7. 悔棋机制

项目不是只存一步 `Move`，而是存完整 `GameSnapshot`。

这样悔棋时可以完整恢复：

- 棋盘局面
- 当前回合
- 最近走法
- 将军 / 将死状态
- 胜率折线图

## 当前局限

当前版本已经具备完整本地搜索能力和较强规则性，但如果要继续逼近专业象棋软件，还有以下方向可继续强化：

- 更完整的开局库
- 长将 / 长捉 / 重复局面规则
- 更强残局专项评估
- 增量走棋与增量评估
- 更成熟的主变搜索与置换表复用

## 版本记录

### v0.3.2

- AI 增加软截止与硬截止双时间控制
- 中后期复杂局面加入根节点退让策略
- 静态搜索加入节点上限，避免长时间卡住
- README 更新为当前工程实现说明并补充版本记录

### v0.3.1

- 胜率图改为以 `50%` 为中线的单线优势图
- 绝杀时胜率直接跳到 `100%`
- AI 搜索升级：aspiration window、null move pruning、late move reduction

### v0.3.0

- 新增实时胜率折线图
- 引入局面解释依据
- AI 增强一档，补充更强评估与开局偏好

### v0.2.0

- 新增界面强化与棋盘视觉升级
- 支持玩家 / AI 先手切换
- 支持颜色显示同步翻转

### v0.1.0

- 初始化 React + TypeScript + Vite 项目
- 完成中国象棋基础规则引擎
- 完成本地搜索型 AI 与可交互棋盘
- 支持悔棋、最近走法、AI 自动应招
