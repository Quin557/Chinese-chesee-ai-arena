import type { Side } from "../types/chess";
import type { StarterChoice } from "../utils/presentation";

interface GameInfoProps {
  currentTurn: Side;
  playerSide: Side;
  aiSide: Side;
  hasStarted: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  winner?: Side;
  statusMessage: string;
  aiThinking: boolean;
  canUndo: boolean;
  selectedStarter: StarterChoice;
  onRestart: () => void;
  onUndo: () => void;
  onStartGame: () => void;
  onSelectStarter: (starter: StarterChoice) => void;
}

function sideText(side: Side): string {
  return side === "red" ? "红方" : "黑方";
}

function GameInfo({
  currentTurn,
  playerSide,
  aiSide,
  hasStarted,
  isCheck,
  isCheckmate,
  winner,
  statusMessage,
  aiThinking,
  canUndo,
  selectedStarter,
  onRestart,
  onUndo,
  onStartGame,
  onSelectStarter,
}: GameInfoProps) {
  return (
    <section className="panel">
      <h2>对局信息</h2>
      <div className="info-grid">
        <div>
          <span>当前回合</span>
          <strong>{hasStarted ? sideText(currentTurn) : "未开始"}</strong>
        </div>
        <div>
          <span>玩家阵营</span>
          <strong>{sideText(playerSide)}</strong>
        </div>
        <div>
          <span>AI 阵营</span>
          <strong>{sideText(aiSide)}</strong>
        </div>
        <div>
          <span>被将军</span>
          <strong>{isCheck ? "是" : "否"}</strong>
        </div>
        <div>
          <span>游戏结束</span>
          <strong>{isCheckmate ? "是" : "否"}</strong>
        </div>
        <div>
          <span>胜者</span>
          <strong>{winner ? sideText(winner) : "未分胜负"}</strong>
        </div>
      </div>

      <div className="status-box">
        <p>{aiThinking ? "AI 正在计算凶狠攻势..." : statusMessage}</p>
      </div>

      {!hasStarted ? (
        <>
          <div className="starter-group" role="group" aria-label="选择先手方">
            <button
              className={[
                "choice-button",
                selectedStarter === "player" ? "choice-button-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectStarter("player")}
              type="button"
              disabled={aiThinking}
            >
              玩家先手
            </button>
            <button
              className={[
                "choice-button",
                selectedStarter === "ai" ? "choice-button-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectStarter("ai")}
              type="button"
              disabled={aiThinking}
            >
              AI 先手
            </button>
          </div>

          <div className="button-row">
            <button className="action-button action-button-primary" onClick={onStartGame} type="button" disabled={aiThinking}>
              开始游戏
            </button>
            <button className="action-button" onClick={onRestart} type="button" disabled={aiThinking}>
              重置布局
            </button>
          </div>
        </>
      ) : (
        <div className="button-row">
          <button className="action-button" onClick={onUndo} type="button" disabled={!canUndo || aiThinking}>
            回退一步
          </button>
          <button className="action-button action-button-primary" onClick={onRestart} type="button">
            重新开始
          </button>
        </div>
      )}
    </section>
  );
}

export default GameInfo;
