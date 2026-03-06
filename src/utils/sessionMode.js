// Determines if we're in demo mode or live mode
export const isDemo = (sessionId) => {
  return !sessionId || sessionId === "demo";
};

// Get player info from localStorage
export const getPlayerInfo = () => ({
  nickname: localStorage.getItem("svip_nickname") || "Player",
  sessionId: localStorage.getItem("svip_session_id"),
  playerId: localStorage.getItem("svip_player_id"),
  gameType: localStorage.getItem("svip_game_type"),
});
