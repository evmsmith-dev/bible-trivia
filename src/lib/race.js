// Online multiplayer scoring: who got each question, the scoreboard and the round's winners.
// Pure functions of the stored game, so every phone works out exactly the same result from the
// same answers, and no phone (not even the host's) can award points.
//
// Speed: each answer carries the phone's own reaction time (`ms`, from when its answers
// unlocked to the tap) and the server's arrival time (`at`). The phone's figure takes out
// network lag, but it's only trusted within CLAMP_MS of what the server saw, so a tampered app
// can gain at most that much.
// Ties: everyone right within TIE_MS of the fastest right answer counts as first.
import { answersFor, questionKey, roundIds, roundKey, roundNumber, seatsTaken, timing } from "../online/common.js";

export const CLAMP_MS = 300;
export const TIE_MS = 250;

/** Reaction time used for ranking (ms). */
export function effectiveMs(answer, opensAt) {
  const own = Math.max(0, Number(answer?.ms) || 0);
  if (!Number.isFinite(answer?.at) || !Number.isFinite(opensAt)) return own;
  const server = Math.max(0, answer.at - opensAt);
  return Math.max(0, Math.min(server, Math.max(own, server - CLAMP_MS)));
}

/**
 * One question's result.
 * `answers`: { seat: { c, ms, at } }; `correctChoice`: the right option's original index;
 * `opensAt`: server time the answers unlocked; `rule`: "first" or "everyone".
 * Returns { bySeat: { seat: { choice, correct, ms, first, points } }, firsts: [seats], fastestMs }.
 */
export function questionResult(answers, correctChoice, opensAt, rule = "first") {
  const bySeat = {};
  for (const [seat, answer] of Object.entries(answers || {})) {
    bySeat[seat] = { choice: answer.c, correct: answer.c === correctChoice, ms: effectiveMs(answer, opensAt), first: false, points: 0 };
  }
  const right = Object.entries(bySeat).filter(([, a]) => a.correct);
  const fastestMs = right.length ? Math.min(...right.map(([, a]) => a.ms)) : null;
  const firsts = [];
  for (const [seat, a] of right) {
    if (a.ms <= fastestMs + TIE_MS) {
      a.first = true;
      firsts.push(seat);
    }
    a.points = a.first ? (rule === "everyone" ? 2 : 1) : (rule === "everyone" ? 1 : 0);
  }
  firsts.sort((x, y) => bySeat[x].ms - bySeat[y].ms);
  return { bySeat, firsts, fastestMs };
}

const correctChoiceOf = (questionsById, id) => questionsById.get(id)?.ans;

/** The result of question `n` of round `r` ("r0"), or null if that question isn't known. */
export function resultOf(game, questionsById, r, n) {
  const id = roundIds(game, r)[n];
  if (id === undefined || !questionsById.has(id)) return null;
  const i = questionKey(n);
  const shownAt = game.qa?.[r]?.[i];
  const opensAt = Number.isFinite(shownAt) ? shownAt + timing(game.set.m).lockMs : NaN;
  return questionResult(answersFor(game, r, i), correctChoiceOf(questionsById, id), opensAt, game.set.s);
}

/** How many questions of round `r` count so far: all of them once the round is over. */
function questionsPlayed(game, r) {
  if (game.q?.r !== r) return roundIds(game, r).length;
  return game.st === "over" ? game.set.n : game.q.n + 1;
}

/**
 * The scoreboard for round `r`, best first: [{ seat, points, correct, ms, rank }].
 * Ties: most points, then most right answers, then the lowest total time on right answers.
 * Players level on all three share a rank. `upTo` limits it to the first questions.
 */
export function standings(game, questionsById, r = game.q?.r, upTo = questionsPlayed(game, r)) {
  const rows = new Map(seatsTaken(game).map((seat) => [seat, { seat, points: 0, correct: 0, ms: 0 }]));
  for (let n = 0; n < upTo; n++) {
    const result = resultOf(game, questionsById, r, n);
    if (!result) continue;
    for (const [seat, a] of Object.entries(result.bySeat)) {
      const row = rows.get(seat);
      if (!row) continue;
      row.points += a.points;
      if (a.correct) {
        row.correct += 1;
        row.ms += a.ms;
      }
    }
  }
  const order = (a, b) => b.points - a.points || b.correct - a.correct || a.ms - b.ms;
  const list = [...rows.values()].sort((a, b) => order(a, b) || a.seat.localeCompare(b.seat));
  list.forEach((row, index) => {
    row.rank = index > 0 && order(list[index - 1], row) === 0 ? list[index - 1].rank : index + 1;
  });
  return list;
}

/** Seats that won round `r` (more than one when they're level on every tie-break). Empty if nobody scored. */
export function roundWinners(game, questionsById, r) {
  const list = standings(game, questionsById, r);
  if (!list.length || (list[0].points === 0 && list[0].correct === 0)) return [];
  return list.filter((row) => row.rank === 1).map((row) => row.seat);
}

/** Round wins per seat across every finished round in this game ("Wins tonight"). */
export function winsTonight(game, questionsById) {
  const wins = {};
  if (!game?.q) return wins;
  const current = roundNumber(game.q.r);
  const last = game.st === "over" ? current : current - 1;
  for (let n = 0; n <= last; n++) {
    for (const seat of roundWinners(game, questionsById, roundKey(n))) wins[seat] = (wins[seat] || 0) + 1;
  }
  return wins;
}

/** Every question id used in this game so far, so a rematch can pick new ones. */
export function usedIds(game) {
  return Object.values(game?.qs || {}).flatMap((ids) => String(ids).split(",").filter(Boolean).map(Number));
}
