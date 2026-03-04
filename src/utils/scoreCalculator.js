/**
 * Calculate points earned for a question answer.
 * @param {boolean} isCorrect - whether the answer is correct
 * @param {number} timeRemaining - seconds left on the timer
 * @param {number} timeLimit - total seconds allowed
 * @param {number} basePoints - base score for a correct answer (default 1000)
 * @returns {number} score (0 to 2000)
 */
export const calculateScore = (isCorrect, timeRemaining, timeLimit, basePoints = 1000) => {
  if (!isCorrect) return 0;
  const timeBonus = Math.floor((timeRemaining / timeLimit) * basePoints);
  return Math.min(basePoints + timeBonus, 2000);
};
