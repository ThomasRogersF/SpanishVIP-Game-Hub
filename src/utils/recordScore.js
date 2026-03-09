import { getCurrentTeacher } from "../firebase/teachers";
import { recordGameScore } from "../firebase/teachers";

export const recordScoreIfLoggedIn = async (finalScore) => {
  const account = getCurrentTeacher();
  if (!account || !account.teacherId || !finalScore) return;
  if (account.role !== "student" && account.role !== "teacher") return;

  await recordGameScore(account.teacherId, finalScore);
};
