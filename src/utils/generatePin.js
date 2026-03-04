/**
 * Generate a random 6-digit PIN string.
 * @returns {string} e.g. "482916"
 */
export const generatePin = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
