/**
 * Normalize a string: strip accents, lowercase, trim whitespace.
 * Handles Spanish accented characters (á é í ó ú ü ñ).
 * @param {string} str
 * @returns {string}
 */
export const normalizeString = (str) =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Check whether a student's answer matches any accepted answer.
 * Case-insensitive and accent-insensitive.
 * @param {string} studentAnswer
 * @param {string[]} acceptedAnswers
 * @returns {boolean}
 */
export const checkAnswer = (studentAnswer, acceptedAnswers) =>
  acceptedAnswers.some(
    (accepted) => normalizeString(accepted) === normalizeString(studentAnswer)
  );
