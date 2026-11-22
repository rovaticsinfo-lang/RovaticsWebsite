/* One play session of one level: move history, undo, restart, checkpoints and the hint ladder. Pure logic (no rendering). */
import { apply, solved, solve, clone } from './logic.js';

export class Session {
  constructor(initial, sol, par) {
    this.initial = clone(initial); this.state = clone(initial); this.sol = sol || null; this.par = par || (sol ? sol.length : 0);
    this.history = []; this.moveLog = []; this.moves = 0; this.hints = 0; this.hintStage = 0; this.undos = 0; this.restarts = 0; this.checkpoint = null; this.won = false;
  }
  /* Applies a move. Returns true if the move changed the puzzle. The win is decided by the rule engine, never by a button press. */
  play(m) {
    if (this.won) return false; const n = apply(this.state, m); if (n === this.state) return false;
    this.history.push(this.state); this.moveLog.push(m); this.state = n; this.moves++; this.hintStage = 0;
    if (solved(this.state)) this.won = true; else if (this.moves % 6 === 0) this.saveCheckpoint(true);
    return true;
  }
  undo() { if (this.won || !this.history.length) return false; this.state = this.history.pop(); this.moveLog.pop(); this.undos++; this.hintStage = 0; return true; }
  restart() { this.state = clone(this.initial); this.history = []; this.moveLog = []; this.moves = 0; this.restarts++; this.hintStage = 0; this.won = false; }
  saveCheckpoint(auto) { this.checkpoint = { state: clone(this.state), history: this.history.map(clone), moveLog: clone(this.moveLog), moves: this.moves, auto: !!auto }; }
  restoreCheckpoint() { if (!this.checkpoint || this.won) return false; const c = this.checkpoint; this.state = clone(c.state); this.history = c.history.map(clone); this.moveLog = clone(c.moveLog); this.moves = c.moves; this.hintStage = 0; return true; }
  /* The next move of the known solution, valid while the player's moves are an exact prefix of it. Otherwise the engine solves the current state afresh. */
  nextMove() {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (this.sol && this.moveLog.length <= this.sol.length && this.moveLog.every((m, i) => same(m, this.sol[i]))) return this.sol[this.moveLog.length] || null;
    const st = this.state, inner = st.t === 'multi' ? st.stages[st.cur] : st;
    if (inner.t === 'echo' && inner.phase === 'rec') return null;   // re-planning a half-recorded echo is too slow: the hint asks for an undo instead
    const s = solve(st); return s && s.length ? s[0] : null;
  }
  /* Progressive hint: 1 observe, 2 interpret, 3 demonstrate. */
  askHint() { this.hintStage = Math.min(3, this.hintStage + 1); this.hints++; return this.hintStage; }
  serialize() { return { state: this.state, history: this.history, moveLog: this.moveLog, moves: this.moves, hints: this.hints, undos: this.undos, restarts: this.restarts, checkpoint: this.checkpoint }; }
  static restore(initial, sol, par, data) {
    const s = new Session(initial, sol, par);
    if (data && data.state) Object.assign(s, { state: data.state, history: data.history || [], moveLog: data.moveLog || [], moves: data.moves || 0, hints: data.hints || 0, undos: data.undos || 0, restarts: data.restarts || 0, checkpoint: data.checkpoint || null });
    return s;
  }
}
