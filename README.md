# Chinese Xiangqi AI Arena

一个基于 `React + TypeScript + Vite` 的中国象棋前端项目。它不是静态棋盘演示，而是一个完整的本地规则引擎 + 搜索型 AI 对战系统，支持浏览器内直接运行、完整走子校验、AI 自动应招、局势评估与胜率走势展示。

## 1. 项目定位

项目目标分成三层：

- 规则层：完整实现中国象棋标准走法、将军、将死、将帅照面与非法走法过滤。
- 引擎层：通过本地搜索型 AI 在浏览器内完成对弈，不依赖后端。
- 表现层：提供可交互棋盘、走法提示、悔棋、最近走法、胜率折线图与局面解释。

当前实现强调两点：

- 玩家始终操作楚河汉界上侧棋子，AI 始终操作下侧棋子。
- 先手切换时，棋盘显示颜色同步变换，确保“谁先手谁执红”的展示逻辑成立。

## 2. 安装与运行

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

## 3. 项目结构

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

## 4. 规则引擎实现思路

### 4.1 棋盘与状态

项目用二维数组 `Board` 表示 9x10 棋盘，每个格子是 `Piece | null`。

核心类型定义在：

- `src/types/chess.ts`

其中包括：

- `Side`：`red | black`
- `PieceType`：将、士、象、马、车、炮、兵的统一类型
- `Move`：一步走法，包含起点、终点、吃子信息
- `GameSnapshot`：完整局面快照，用于悔棋与状态恢复
- `WinProbabilityPoint`：每一步的局势评估点，用于折线图

### 4.2 走法规则

单子规则在：

- `src/engine/rules.ts`

实现要点：

- 车：横竖直线移动，不能隔子
- 马：日字走法，判断蹩马腿
- 象 / 相：田字走法，判断塞象眼，不可过河
- 士 / 仕：九宫内斜走一格
- 将 / 帅：九宫内横竖走一格
- 炮：平走不吃子不能隔子，吃子必须隔一个炮架
- 卒 / 兵：过河前只能前进，过河后允许横走，不可后退

### 4.3 合法走法过滤

合法走法不是直接由“单子规则”得到，而是两阶段处理：

1. `rules.ts` 先生成伪合法走法
2. `moveGenerator.ts` 对每一步进行“落子后自检”，凡是导致己方被将军的走法都会被剔除

关键文件：

- `src/engine/moveGenerator.ts`
- `src/engine/check.ts`

这样可以统一处理：

- 将军状态下只能走解将步
- 将帅照面禁止
- 任何自杀性走法都不能执行

## 5. AI 引擎实现思路

### 5.1 搜索框架

当前 AI 使用的是浏览器本地搜索引擎，不是随机走子，也不是大模型生成走法。

核心实现位于：

- `src/engine/ai.ts`
- `src/workers/aiWorker.ts`

当前搜索结构包括：

- `Negamax + Alpha-Beta`
- `Iterative Deepening` 迭代加深
- `Aspiration Window` 窄窗搜索
- `Transposition Table` 置换表缓存
- `Zobrist Hash` 局面哈希
- `Killer Moves`
- `History Heuristic`
- `Quiescence Search` 静态搜索延伸
- `Null Move Pruning`
- `Late Move Reduction`
- 将军延伸

这些机制的目标不是只“加深层数”，而是在相同时间预算下，把搜索更集中地投入到关键着法上。

### 5.2 Web Worker

AI 搜索放在：

- `src/workers/aiWorker.ts`

原因：

- 避免主线程阻塞
- 避免浏览器出现“页面无响应”
- 让棋盘交互和渲染保持流畅

### 5.3 评估函数

评估函数在：

- `src/engine/evaluation.ts`

当前主要综合以下因素：

- 子力价值与位置分
- 过河兵加成
- 中路控制
- 将帅安全
- 重子直线压迫
- 子力展开速度
- 将军与对将惩奖

评估拆解会同时提供：

- `material`
- `kingSafety`
- `centerControl`
- `openLinePressure`
- `development`

这不仅供 AI 使用，也供界面上的胜率图解释使用。

### 5.4 胜率折线图

胜率图数据来源于：

- `src/engine/probability.ts`

设计原则：

- 每下一步棋，就生成一个新的局势评估点
- 红黑胜率天然对称，因此图上只画一条“优势线”
- `50%` 是均势线
- 高于 `50%` 说明显示中的红方更优
- 低于 `50%` 说明显示中的黑方更优
- 一旦形成绝杀，胜率直接跳到 `100% / 0%`

图表组件位于：

- `src/components/WinProbabilityChart.tsx`

这份胜率并不追求国际象棋引擎那种严格统计意义上的精确概率，而是强调：

- 能随着局面明显波动
- 与引擎评估一致
- 能给出可解释依据

## 6. 前端交互设计

主流程在：

- `src/App.tsx`

它负责串联：

- 开局与先手选择
- 玩家点击选子 / 落子
- AI 回合触发
- 完整局面快照保存
- 悔棋恢复
- 走法记录
- 胜率折线图更新

棋盘组件：

- `src/components/ChessBoard.tsx`

信息组件：

- `src/components/GameInfo.tsx`
- `src/components/MoveHistory.tsx`
- `src/components/WinProbabilityChart.tsx`

样式文件：

- `src/styles/board.css`

## 7. 悔棋机制

项目不是只存 `Move`，而是使用完整局面快照：

- `GameSnapshot`

每次成功落子后，都会保存：

- 棋盘
- 当前回合
- 最近走法
- 将军 / 将死状态
- 胜者
- 胜率历史

这样悔棋时不仅能回到正确局面，也能同步恢复：

- 状态面板
- 最近走法
- 胜率图

## 8. 当前可调参数

主要引擎参数位于：

- `src/engine/ai.ts`

例如：

```ts
export const AI_SEARCH_DEPTH = 8;
export const AI_THINK_TIME_MS = 12000;
export const AI_MAX_TIME_MS = 55000;
```

建议理解：

- `AI_SEARCH_DEPTH`：理论最大深度上限
- `AI_THINK_TIME_MS`：单步常规思考预算
- `AI_MAX_TIME_MS`：保护性上限，确保不超过可接受等待时间

## 9. 后续可继续强化的方向

如果继续提升棋力，最值得做的是：

- 更完整的开局库
- 长将 / 长捉 / 重复局面规则
- 更强残局专项评估
- 增量走棋与增量评估
- 更成熟的主变搜索与置换表复用策略

## 10. 版本记录

### v0.3.0

- 新增实时胜率折线图
- 胜率图改为以 `50%` 为中线的单线优势图
- 绝杀时胜率直接跳到 `100%`
- AI 搜索升级：aspiration window、null move pruning、late move reduction
- README 重写为工程说明文档

### v0.2.0

- 新增胜率评估与局面解释
- AI 增强一档，补充更强评估与开局偏好
- 新增胜率走势组件

### v0.1.0

- 初始化 React + TypeScript + Vite 项目
- 完成中国象棋基础规则引擎
- 完成本地搜索型 AI 与可交互棋盘
- 支持悔棋、最近走法、AI 自动应招
