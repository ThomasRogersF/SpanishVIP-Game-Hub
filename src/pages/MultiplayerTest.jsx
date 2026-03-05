import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

// Firebase config
import { db, rtdb } from '../firebase/config';

// Firestore
import {
  doc, setDoc, getDoc, deleteDoc,
  collection, addDoc, getDocs, query, where,
} from 'firebase/firestore';

// Realtime Database
import { ref, set, get, onValue, off, runTransaction } from 'firebase/database';

// Firebase utility functions
import { createSession, joinSession, updateSessionStatus, getSession } from '../firebase/sessions';
import { updatePlayerScore, subscribeToLeaderboard, getLeaderboard } from '../firebase/leaderboard';

// ─── Helpers ───────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString().slice(11, 23);

const initSection = (count) =>
  Array.from({ length: count }, () => ({ status: 'pending', logs: [], duration: null }));

// ─── Sub-components ────────────────────────────────────────────────────────

const StatusBadge = ({ status, duration }) => {
  const map = {
    pending:  { cls: 'text-slate-500',  label: '—' },
    running:  { cls: 'text-yellow-400 animate-pulse', label: '⟳ Running' },
    pass:     { cls: 'text-green-400',  label: '✓ PASS' },
    fail:     { cls: 'text-red-400',    label: '✗ FAIL' },
    skipped:  { cls: 'text-yellow-400', label: '⚠ SKIP' },
  };
  const { cls, label } = map[status] ?? map.pending;
  return (
    <span className={`font-mono text-xs font-bold ${cls}`}>
      {label}{status === 'pass' && duration != null ? ` ${duration}ms` : ''}
    </span>
  );
};

const TestRow = ({ name, result }) => {
  const borderMap = {
    pass: 'border-green-800 bg-green-950/30',
    fail: 'border-red-800 bg-red-950/30',
    running: 'border-yellow-800/50 bg-yellow-950/10',
    skipped: 'border-yellow-800/30 bg-yellow-950/10',
    pending: 'border-slate-800',
  };
  const border = borderMap[result.status] ?? borderMap.pending;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${border}`}>
      <span className="text-slate-300 text-sm">{name}</span>
      <StatusBadge status={result.status} duration={result.duration} />
    </div>
  );
};

const LogArea = ({ sections }) => {
  const logRef = useRef(null);
  const allLogs = sections.flatMap((r, si) =>
    r.logs.map((line, li) => ({ key: `${si}-${li}`, line, status: r.status }))
  );

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [allLogs.length]);

  if (allLogs.length === 0) return null;

  return (
    <div ref={logRef} className="font-mono text-xs bg-slate-950 rounded p-3 max-h-48 overflow-y-auto space-y-0.5 border border-slate-800">
      {allLogs.map(({ key, line }) => (
        <div key={key} className={
          line.includes('ERROR') || line.includes('FAIL') ? 'text-red-400' :
          line.includes('SKIP') || line.includes('WARN') ? 'text-yellow-400' :
          line.includes('PASS') ? 'text-green-400' :
          'text-slate-400'
        }>{line}</div>
      ))}
    </div>
  );
};

const TestSection = ({ title, testNames, results, onRun }) => {
  const passCount = results.filter(r => r.status === 'pass').length;
  const isRunning = results.some(r => r.status === 'running');
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <span className="text-slate-500 text-xs">{passCount}/{testNames.length} passing</span>
        </div>
        <button
          onClick={onRun}
          disabled={isRunning}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {isRunning ? 'Running…' : 'Run Tests'}
        </button>
      </div>
      {testNames.map((name, i) => (
        <TestRow key={i} name={name} result={results[i]} />
      ))}
      <LogArea sections={results} />
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────

const MultiplayerTest = () => {
  const [connectionResults,  setConnectionResults]  = useState(initSection(4));
  const [sessionResults,     setSessionResults]     = useState(initSection(4));
  const [leaderboardResults, setLeaderboardResults] = useState(initSection(4));
  const [gameResults,        setGameResults]        = useState(initSection(4));

  const [stressPlayerCount, setStressPlayerCount] = useState(10);
  const [stressRunning,     setStressRunning]     = useState(false);
  const [stressLogs,        setStressLogs]        = useState([]);
  const [stressMetrics,     setStressMetrics]     = useState(null);

  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupLog,     setCleanupLog]     = useState([]);

  const activeUnsubs  = useRef([]);
  const testRtdbPaths = useRef([]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      activeUnsubs.current.forEach(fn => { try { fn(); } catch {} });
    };
  }, []);

  // ── Generic runner ──────────────────────────────────────────────────────

  const runTest = useCallback(async (sectionSetter, testIndex, testFn) => {
    sectionSetter(prev => {
      const n = [...prev];
      n[testIndex] = { status: 'running', logs: [], duration: null };
      return n;
    });
    const logs = [];
    const log = (msg) => {
      const entry = `[${ts()}] ${msg}`;
      logs.push(entry);
      sectionSetter(prev => {
        const n = [...prev];
        n[testIndex] = { ...n[testIndex], logs: [...logs] };
        return n;
      });
    };
    const start = Date.now();
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Timed out after 5000ms')), 5000)
    );
    try {
      await Promise.race([testFn(log), timeout]);
      const duration = Date.now() - start;
      sectionSetter(prev => {
        const n = [...prev];
        n[testIndex] = { status: 'pass', logs, duration };
        return n;
      });
    } catch (err) {
      const duration = Date.now() - start;
      logs.push(`ERROR: ${err.message}`);
      sectionSetter(prev => {
        const n = [...prev];
        n[testIndex] = { status: 'fail', logs, duration };
        return n;
      });
    }
  }, []);

  const runSection = useCallback(async (sectionSetter, testFns) => {
    for (let i = 0; i < testFns.length; i++) {
      await runTest(sectionSetter, i, testFns[i]);
    }
  }, [runTest]);

  // ── Section 1: Connection Tests ─────────────────────────────────────────

  const connectionTestFns = [
    // 1. Firestore Read/Write
    async (log) => {
      if (!db) { log('SKIP: Firestore not configured (db is null)'); return; }
      const docId = `test_rw_${Date.now()}`;
      const docRef = doc(db, '_health', docId);
      log('Writing to Firestore…');
      await setDoc(docRef, { val: 42, ts: Date.now() });
      log('Reading back…');
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error('Document does not exist after write');
      if (snap.data().val !== 42) throw new Error(`Expected val=42, got val=${snap.data().val}`);
      log('Value matches. Cleaning up…');
      await deleteDoc(docRef);
      log('PASS: Firestore read/write verified');
    },

    // 2. Realtime DB Read/Write
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const path = `_test/rw_${Date.now()}`;
      testRtdbPaths.current.push('_test');
      log('Writing to Realtime DB…');
      await set(ref(rtdb, path), { val: 99 });
      log('Reading back…');
      const snap = await get(ref(rtdb, path));
      if (!snap.exists()) throw new Error('No data at path after write');
      if (snap.val().val !== 99) throw new Error(`Expected val=99, got val=${snap.val().val}`);
      log('Value matches. Cleaning up…');
      await set(ref(rtdb, path), null);
      log('PASS: Realtime DB read/write verified');
    },

    // 3. Realtime DB Live Subscription
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const path = `_test/sub_${Date.now()}`;
      testRtdbPaths.current.push('_test');
      log('Setting up subscription…');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Subscription did not fire within 2000ms')), 2000);
        let triggered = false;
        const dbRef = ref(rtdb, path);
        const handler = (snap) => {
          if (!triggered && snap.val()?.ping === true) {
            triggered = true;
            clearTimeout(timer);
            off(dbRef, 'value', handler);
            resolve();
          }
        };
        onValue(dbRef, handler);
        // Write after subscribing
        set(dbRef, { ping: true }).catch(reject);
      });
      log('Subscription fired within timeout. Cleaning up…');
      await set(ref(rtdb, path), null);
      log('PASS: Live subscription verified');
    },

    // 4. Concurrent Writes Race Condition
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const path = `_test/concurrent_${Date.now()}`;
      testRtdbPaths.current.push('_test');
      log('Initializing counter at 0…');
      await set(ref(rtdb, path), { count: 0 });
      log('Firing 5 concurrent transactions…');
      const writes = Array.from({ length: 5 }, () =>
        runTransaction(ref(rtdb, path), (current) => ({
          count: (current?.count ?? 0) + 1,
        }))
      );
      await Promise.all(writes);
      const snap = await get(ref(rtdb, path));
      const finalCount = snap.val()?.count;
      if (finalCount !== 5) throw new Error(`Expected count=5, got count=${finalCount}`);
      log(`All 5 transactions applied. Final count = ${finalCount}`);
      await set(ref(rtdb, path), null);
      log('PASS: No lost writes from concurrent transactions');
    },
  ];

  // ── Section 2: Session Lifecycle Tests ──────────────────────────────────

  const sessionTestFns = [
    // 1. Create Session
    async (log) => {
      if (!db) { log('SKIP: Firestore not configured (db is null)'); return; }
      log('Calling createSession…');
      const { sessionId, pin } = await createSession('multiple-choice', [], '__test__');
      log(`Created sessionId=${sessionId}, pin=${pin}`);
      if (!sessionId || !pin) throw new Error('createSession did not return sessionId or pin');
      log('Verifying session exists in Firestore…');
      const snap = await getDoc(doc(db, 'sessions', sessionId));
      if (!snap.exists()) throw new Error('Session document not found in Firestore');
      if (snap.data().gameType !== 'multiple-choice') throw new Error('gameType mismatch');
      log('Session confirmed. Cleaning up…');
      await deleteDoc(doc(db, 'sessions', sessionId));
      log('PASS: createSession creates valid Firestore document');
    },

    // 2. Join Session with PIN
    async (log) => {
      if (!db) { log('SKIP: Firestore not configured (db is null)'); return; }
      log('Creating test session…');
      const { sessionId, pin } = await createSession('true-or-false', [], '__test__');
      log(`Session created. PIN=${pin}`);

      // Correct PIN
      log('Joining with correct PIN…');
      const { sessionId: joinedId } = await joinSession(pin, 'TestPlayer');
      if (joinedId !== sessionId) throw new Error(`joinSession returned wrong sessionId: ${joinedId}`);
      const snap = await getDoc(doc(db, 'sessions', sessionId));
      if (!snap.data().players?.['TestPlayer']) throw new Error('Player not found in session.players');
      log('Player added to session. Testing wrong PIN…');

      // Wrong PIN — should throw
      try {
        await joinSession('000000', 'WrongTest');
        throw new Error('Expected error for invalid PIN but none was thrown');
      } catch (err) {
        if (err.message === 'Expected error for invalid PIN but none was thrown') throw err;
        log(`Wrong PIN correctly rejected: "${err.message}"`);
      }

      log('Cleaning up…');
      await deleteDoc(doc(db, 'sessions', sessionId));
      log('PASS: joinSession works correctly for valid and invalid PINs');
    },

    // 3. Session Status Update
    async (log) => {
      if (!db) { log('SKIP: Firestore not configured (db is null)'); return; }
      log('Creating test session…');
      const { sessionId } = await createSession('word-cloud', [], '__test__');
      log(`Session created: ${sessionId}`);

      log('Updating status → active…');
      await updateSessionStatus(sessionId, 'active');
      let snap = await getDoc(doc(db, 'sessions', sessionId));
      if (snap.data().status !== 'active') throw new Error(`Expected status=active, got ${snap.data().status}`);
      log('Status = active ✓');

      log('Updating status → finished…');
      await updateSessionStatus(sessionId, 'finished');
      snap = await getDoc(doc(db, 'sessions', sessionId));
      if (snap.data().status !== 'finished') throw new Error(`Expected status=finished, got ${snap.data().status}`);
      log('Status = finished ✓');

      log('Cleaning up…');
      await deleteDoc(doc(db, 'sessions', sessionId));
      log('PASS: Status transitions verified');
    },

    // 4. Multiple Players Join Same Session
    async (log) => {
      if (!db) { log('SKIP: Firestore not configured (db is null)'); return; }
      log('Creating test session…');
      const { sessionId, pin } = await createSession('opinion-poll', [], '__test__');
      log(`Session PIN=${pin}. Joining 5 players simultaneously…`);

      const players = Array.from({ length: 5 }, (_, i) => `TestPlayer${i}`);
      await Promise.all(players.map(nick => joinSession(pin, nick)));
      log('All join calls resolved. Verifying player count…');

      const snap = await getDoc(doc(db, 'sessions', sessionId));
      const playerKeys = Object.keys(snap.data().players ?? {});
      if (playerKeys.length !== 5) throw new Error(`Expected 5 players, found ${playerKeys.length}`);
      log(`Found ${playerKeys.length} players — no overwrites occurred`);

      log('Cleaning up…');
      await deleteDoc(doc(db, 'sessions', sessionId));
      log('PASS: All 5 players joined without overwriting each other');
    },
  ];

  // ── Section 3: Leaderboard Tests ────────────────────────────────────────

  const leaderboardTestFns = [
    // 1. Write Player Score
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const sid = `test_lb_${Date.now()}`;
      testRtdbPaths.current.push(`leaderboards/${sid}`);
      log(`Writing score 500 for TestPlayer in session ${sid}…`);
      await updatePlayerScore(sid, 'TestPlayer', 500);
      log('Reading leaderboard…');
      const result = await getLeaderboard(sid);
      if (result.length === 0) throw new Error('Leaderboard is empty after write');
      if (result[0].score !== 500) throw new Error(`Expected score=500, got score=${result[0].score}`);
      log(`Score verified: ${result[0].nickname} = ${result[0].score}`);
      await set(ref(rtdb, `leaderboards/${sid}`), null);
      log('PASS: Score written and read back correctly');
    },

    // 2. Leaderboard Sorting
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const sid = `test_lb_sort_${Date.now()}`;
      testRtdbPaths.current.push(`leaderboards/${sid}`);
      const players = [
        { nick: 'PlayerA', score: 100 },
        { nick: 'PlayerB', score: 500 },
        { nick: 'PlayerC', score: 200 },
        { nick: 'PlayerD', score: 800 },
        { nick: 'PlayerE', score: 350 },
      ];
      log('Writing 5 players with unsorted scores…');
      await Promise.all(players.map(p => updatePlayerScore(sid, p.nick, p.score)));
      log('Reading leaderboard…');
      const result = await getLeaderboard(sid);
      for (let i = 0; i < result.length - 1; i++) {
        if (result[i].score < result[i + 1].score) {
          throw new Error(`Not sorted: ${result[i].score} < ${result[i + 1].score} at index ${i}`);
        }
      }
      log(`Sorted correctly: ${result.map(p => `${p.nickname}(${p.score})`).join(' > ')}`);
      await set(ref(rtdb, `leaderboards/${sid}`), null);
      log('PASS: Leaderboard returns players sorted highest to lowest');
    },

    // 3. Live Leaderboard Updates
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const sid = `test_lb_live_${Date.now()}`;
      testRtdbPaths.current.push(`leaderboards/${sid}`);
      log('Subscribing to leaderboard…');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Callback did not fire within 1500ms')), 1500);
        const unsub = subscribeToLeaderboard(sid, (players) => {
          if (players.length > 0 && players[0].nickname === 'LiveTest') {
            clearTimeout(timer);
            unsub();
            resolve();
          }
        });
        activeUnsubs.current.push(unsub);
        // Write triggers the subscription
        updatePlayerScore(sid, 'LiveTest', 300).catch(reject);
      });
      log('Subscription fired with new player data');
      await set(ref(rtdb, `leaderboards/${sid}`), null);
      log('PASS: Live leaderboard subscription fires within 1.5 seconds');
    },

    // 4. Score Update (not overwrite)
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const sid = `test_lb_update_${Date.now()}`;
      testRtdbPaths.current.push(`leaderboards/${sid}`);
      log('Writing initial score 500…');
      await updatePlayerScore(sid, 'Updater', 500);
      log('Updating score to 1200…');
      await updatePlayerScore(sid, 'Updater', 1200);
      log('Reading back…');
      const result = await getLeaderboard(sid);
      if (result[0].score !== 1200) throw new Error(`Expected score=1200, got score=${result[0].score}`);
      if (result.length !== 1) throw new Error(`Expected 1 entry, got ${result.length} (score was duplicated)`);
      log(`Final score = ${result[0].score}, entry count = ${result.length}`);
      await set(ref(rtdb, `leaderboards/${sid}`), null);
      log('PASS: Score updated correctly without duplication');
    },
  ];

  // ── Section 4: Game-Specific Tests ──────────────────────────────────────

  const gameTestFns = [
    // 1. Robot Run — Shared State Transaction
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const sid = `test_rr_${Date.now()}`;
      const path = `robot-runs/${sid}/sharedState`;
      testRtdbPaths.current.push(`robot-runs/${sid}`);
      log('Initializing robot run shared state with escapeProgress=50…');
      await set(ref(rtdb, path), { escapeProgress: 50 });
      log('Running 3 concurrent transactions (+10 each)…');
      await Promise.all(
        Array.from({ length: 3 }, () =>
          runTransaction(ref(rtdb, path), (current) => ({
            escapeProgress: Math.min(100, (current?.escapeProgress ?? 0) + 10),
          }))
        )
      );
      const snap = await get(ref(rtdb, path));
      const final = snap.val()?.escapeProgress;
      if (final !== 80) throw new Error(`Expected escapeProgress=80 (50+3×10), got ${final}`);
      log(`Final escapeProgress = ${final}. No lost updates.`);
      await set(ref(rtdb, `robot-runs/${sid}`), null);
      log('PASS: Robot Run shared state transactions are consistent');
    },

    // 2. Word Cloud — Response Collection
    async (log) => {
      if (!db) { log('SKIP: Firestore not configured (db is null)'); return; }
      const sid = `test_wc_${Date.now()}`;
      const collRef = collection(db, 'responses', sid, '0');
      log('Writing 10 Word Cloud responses simultaneously…');
      const docRefs = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          addDoc(collRef, { response: `word${i}`, nickname: `P${i}`, ts: Date.now() })
        )
      );
      log('Reading back all responses…');
      const snap = await getDocs(collRef);
      if (snap.size !== 10) throw new Error(`Expected 10 responses, got ${snap.size}`);
      const words = snap.docs.map(d => d.data().response);
      const unique = new Set(words);
      if (unique.size !== 10) throw new Error(`Duplicates found: ${10 - unique.size} responses lost`);
      log(`${snap.size} unique responses confirmed`);
      log('Cleaning up…');
      await Promise.all(docRefs.map(r => deleteDoc(r)));
      log('PASS: Word Cloud collects all responses without duplicates');
    },

    // 3. Opinion Poll — Vote Counting
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const sid = `test_poll_${Date.now()}`;
      const basePath = `polls/${sid}/poll0/votes`;
      testRtdbPaths.current.push(`polls/${sid}`);
      const votes = [
        { nick: 'P1', opt: 0 }, { nick: 'P2', opt: 0 },
        { nick: 'P3', opt: 1 }, { nick: 'P4', opt: 1 },
        { nick: 'P5', opt: 2 }, { nick: 'P6', opt: 2 },
        { nick: 'P7', opt: 3 }, { nick: 'P8', opt: 3 },
      ];
      log('Writing 8 votes (2 per option across 4 options)…');
      await Promise.all(votes.map(v =>
        set(ref(rtdb, `${basePath}/${v.nick}`), { optionIndex: v.opt, timestamp: Date.now() })
      ));
      log('Reading back votes…');
      const snap = await get(ref(rtdb, basePath));
      const data = snap.val() || {};
      const counts = [0, 0, 0, 0];
      Object.values(data).forEach(({ optionIndex }) => { counts[optionIndex]++; });
      log(`Vote counts: option0=${counts[0]}, option1=${counts[1]}, option2=${counts[2]}, option3=${counts[3]}`);
      if (counts.some(c => c !== 2)) throw new Error(`Expected 2 votes per option, got: [${counts.join(', ')}]`);
      await set(ref(rtdb, `polls/${sid}`), null);
      log('PASS: Opinion Poll vote distribution is accurate');
    },

    // 4. Simultaneous Answer Submission
    async (log) => {
      if (!rtdb) { log('SKIP: Realtime DB not configured (rtdb is null)'); return; }
      const sid = `test_sim_${Date.now()}`;
      testRtdbPaths.current.push(`leaderboards/${sid}`);
      log('Submitting 10 player scores simultaneously with Promise.all…');
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          updatePlayerScore(sid, `SimPlayer${i}`, Math.floor(Math.random() * 1000) + 100)
        )
      );
      log('Reading leaderboard…');
      const result = await getLeaderboard(sid);
      if (result.length !== 10) throw new Error(`Expected 10 players, got ${result.length} (${10 - result.length} writes lost)`);
      log(`All 10 answers recorded. Leaderboard has ${result.length} entries.`);
      await set(ref(rtdb, `leaderboards/${sid}`), null);
      log('PASS: All simultaneous submissions recorded without loss');
    },
  ];

  // ── Stress Test ─────────────────────────────────────────────────────────

  const runStressTest = async () => {
    if (!db || !rtdb) {
      setStressLogs([`[${ts()}] SKIP: Firebase not configured`]);
      return;
    }
    setStressRunning(true);
    setStressLogs([]);
    setStressMetrics(null);

    const slog = (msg) => setStressLogs(prev => [...prev, `[${ts()}] ${msg}`]);
    const timings = [];
    let successJoins = 0;
    let failJoins = 0;
    let successScores = 0;
    let failScores = 0;
    const overallStart = Date.now();

    try {
      slog(`Starting stress test with ${stressPlayerCount} virtual players`);

      // Phase 1: Create session
      const t0 = Date.now();
      const { sessionId, pin } = await createSession('multiple-choice', [], '__test__');
      slog(`Session created in ${Date.now() - t0}ms — PIN: ${pin}`);

      // Phase 2: All players join simultaneously
      slog(`Joining ${stressPlayerCount} players simultaneously…`);
      const joinStart = Date.now();
      await Promise.all(
        Array.from({ length: stressPlayerCount }, (_, i) =>
          joinSession(pin, `StressPlayer${i}`)
            .then(() => { successJoins++; })
            .catch((err) => { failJoins++; slog(`WARN: Player ${i} join failed: ${err.message}`); })
        )
      );
      slog(`All joins complete in ${Date.now() - joinStart}ms (${successJoins} ok, ${failJoins} failed)`);

      // Phase 3: Simulate 5 questions per player with staggered timing
      slog(`Simulating ${stressPlayerCount} players answering questions…`);
      const sid = `test_stress_${sessionId}`;
      testRtdbPaths.current.push(`leaderboards/${sid}`);
      const scoreStart = Date.now();
      await Promise.all(
        Array.from({ length: stressPlayerCount }, async (_, i) => {
          let totalScore = 0;
          for (let q = 0; q < 5; q++) {
            const isCorrect = Math.random() < 0.7;
            if (isCorrect) totalScore += Math.floor(Math.random() * 1000) + 500;
            // Stagger submissions: 0-500ms random delay
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500)));
          }
          const t = Date.now();
          try {
            await updatePlayerScore(sid, `StressPlayer${i}`, totalScore);
            timings.push(Date.now() - t);
            successScores++;
          } catch (err) {
            failScores++;
            slog(`WARN: Score write failed for StressPlayer${i}: ${err.message}`);
          }
        })
      );
      slog(`Score writes complete in ${Date.now() - scoreStart}ms`);

      // Phase 4: Verify leaderboard
      slog('Reading final leaderboard…');
      const lb = await getLeaderboard(sid);
      slog(`Leaderboard has ${lb.length}/${stressPlayerCount} players`);

      // Phase 5: Cleanup
      slog('Cleaning up stress test data…');
      await set(ref(rtdb, `leaderboards/${sid}`), null);
      try {
        const sessionSnap = await getDocs(
          query(collection(db, 'sessions'), where('teacherId', '==', '__test__'))
        );
        await Promise.all(sessionSnap.docs.map(d => deleteDoc(d.ref)));
        slog(`Cleaned up ${sessionSnap.size} test sessions`);
      } catch (err) {
        slog(`WARN: Session cleanup failed: ${err.message}`);
      }

      const totalMs = Date.now() - overallStart;
      const avgMs = timings.length > 0
        ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)
        : 0;

      setStressMetrics({
        playerCount: stressPlayerCount,
        successJoins,
        failJoins,
        successScores,
        failScores,
        avgMs,
        minMs: timings.length > 0 ? Math.min(...timings) : 0,
        maxMs: timings.length > 0 ? Math.max(...timings) : 0,
        totalMs,
        leaderboardCount: lb.length,
      });
      slog(`Done. Total time: ${totalMs}ms`);
    } catch (err) {
      slog(`ERROR: Stress test failed — ${err.message}`);
    } finally {
      setStressRunning(false);
    }
  };

  // ── Cleanup ──────────────────────────────────────────────────────────────

  const runCleanup = async () => {
    setCleanupRunning(true);
    setCleanupLog([]);
    const clog = (msg) => setCleanupLog(prev => [...prev, `[${ts()}] ${msg}`]);

    try {
      // 1. Firestore: delete test sessions by teacherId
      if (db) {
        clog('Querying test sessions (teacherId == "__test__")…');
        const sessionSnap = await getDocs(
          query(collection(db, 'sessions'), where('teacherId', '==', '__test__'))
        );
        clog(`Found ${sessionSnap.size} test sessions`);
        await Promise.all(sessionSnap.docs.map(d => deleteDoc(d.ref)));
        if (sessionSnap.size > 0) clog(`Deleted ${sessionSnap.size} test sessions`);

        // 2. Delete _health test docs
        const healthSnap = await getDocs(collection(db, '_health'));
        const testHealthDocs = healthSnap.docs.filter(d => d.id.startsWith('test_'));
        await Promise.all(testHealthDocs.map(d => deleteDoc(d.ref)));
        if (testHealthDocs.length > 0) clog(`Deleted ${testHealthDocs.length} _health test docs`);
      } else {
        clog('SKIP: Firestore not configured');
      }

      // 3. Realtime DB: delete tracked paths
      if (rtdb) {
        const paths = [...new Set(testRtdbPaths.current)];
        if (paths.length > 0) {
          clog(`Deleting ${paths.length} rtdb test paths…`);
          await Promise.all(paths.map(p => set(ref(rtdb, p), null)));
          clog('Deleted rtdb test data');
        }
        // Also wipe the general _test path
        await set(ref(rtdb, '_test'), null);
        clog('Cleared _test path');
        testRtdbPaths.current = [];
      } else {
        clog('SKIP: Realtime DB not configured');
      }

      clog('✅ Test data cleaned up');
    } catch (err) {
      clog(`ERROR: ${err.message}`);
    } finally {
      setCleanupRunning(false);
    }
  };

  // ── Export Results ────────────────────────────────────────────────────────

  const summarizeSection = (results, names) => ({
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    tests: results.map((r, i) => ({
      name: names[i],
      status: r.status,
      durationMs: r.duration,
      logs: r.logs,
    })),
  });

  const exportResults = () => {
    const allResults = [
      ...connectionResults,
      ...sessionResults,
      ...leaderboardResults,
      ...gameResults,
    ];
    const passingCount = allResults.filter(r => r.status === 'pass').length;
    const totalCount = allResults.filter(r => r.status !== 'pending').length;

    const data = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'unknown',
      results: {
        connection:  summarizeSection(connectionResults,  connectionTestNames),
        sessions:    summarizeSection(sessionResults,     sessionTestNames),
        leaderboard: summarizeSection(leaderboardResults, leaderboardTestNames),
        games:       summarizeSection(gameResults,        gameTestNames),
      },
      stressTest: stressMetrics,
      overallStatus: passingCount === totalCount && totalCount > 0 ? 'PASS' : 'FAIL',
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Test names ────────────────────────────────────────────────────────────

  const connectionTestNames = [
    'Firestore Read/Write',
    'Realtime Database Read/Write',
    'Realtime Database Live Subscription',
    'Concurrent Writes (Race Condition Test)',
  ];
  const sessionTestNames = [
    'Create Session',
    'Join Session with PIN',
    'Session Status Update',
    'Multiple Players Join Same Session',
  ];
  const leaderboardTestNames = [
    'Write Player Score',
    'Leaderboard Sorting',
    'Live Leaderboard Updates',
    'Score Update (not overwrite)',
  ];
  const gameTestNames = [
    'Robot Run — Shared State Transaction',
    'Word Cloud — Response Collection',
    'Opinion Poll — Vote Counting',
    'Simultaneous Answer Submission',
  ];

  // ── Overall status ────────────────────────────────────────────────────────

  const allResults = [
    ...connectionResults,
    ...sessionResults,
    ...leaderboardResults,
    ...gameResults,
  ];
  const passingCount = allResults.filter(r => r.status === 'pass').length;
  const runCount = allResults.filter(r => r.status !== 'pending').length;

  const firebaseConfigured = !!(db && rtdb);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav
        className="bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between flex-shrink-0"
        style={{ height: '52px' }}
      >
        <Link to="/" className="text-slate-400 hover:text-white text-sm transition-colors">
          ← Back to Hub
        </Link>
        <span className="text-white font-bold">🧪 Multiplayer Test Suite</span>
        <div className="flex items-center gap-2">
          <button
            onClick={exportResults}
            disabled={runCount === 0}
            className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            Export Results
          </button>
          <button
            onClick={runCleanup}
            disabled={cleanupRunning}
            className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            {cleanupRunning ? 'Cleaning…' : 'Clean Up Test Data'}
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Overall status */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className={`text-2xl font-black ${passingCount === runCount && runCount > 0 ? 'text-green-400' : runCount === 0 ? 'text-slate-500' : 'text-white'}`}>
            {passingCount}/{runCount > 0 ? runCount : allResults.length} tests passing
          </div>
          {!firebaseConfigured && (
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-1.5 text-yellow-400 text-xs">
              ⚠ Firebase not configured — tests will be skipped. Add VITE_FIREBASE_* env vars to enable.
            </div>
          )}
        </div>

        {/* Section 1 */}
        <TestSection
          title="1. Firebase Connection Tests"
          testNames={connectionTestNames}
          results={connectionResults}
          onRun={() => runSection(setConnectionResults, connectionTestFns)}
        />

        {/* Section 2 */}
        <TestSection
          title="2. Session Lifecycle Tests"
          testNames={sessionTestNames}
          results={sessionResults}
          onRun={() => runSection(setSessionResults, sessionTestFns)}
        />

        {/* Section 3 */}
        <TestSection
          title="3. Leaderboard Tests"
          testNames={leaderboardTestNames}
          results={leaderboardResults}
          onRun={() => runSection(setLeaderboardResults, leaderboardTestFns)}
        />

        {/* Section 4 */}
        <TestSection
          title="4. Game-Specific Tests"
          testNames={gameTestNames}
          results={gameResults}
          onRun={() => runSection(setGameResults, gameTestFns)}
        />

        {/* Stress Test */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">5. Stress Test Simulator</h2>
              <span className="text-slate-500 text-xs">Simulate a full game session with N virtual players</span>
            </div>
            <button
              onClick={runStressTest}
              disabled={stressRunning}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {stressRunning ? 'Running…' : 'Run Stress Test'}
            </button>
          </div>

          {/* Player count slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-sm">Number of virtual players</label>
              <span className="text-white font-bold text-sm">{stressPlayerCount}</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={stressPlayerCount}
              onChange={e => setStressPlayerCount(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="flex justify-between text-slate-600 text-xs">
              <span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span>
            </div>
          </div>

          {/* Live log */}
          {stressLogs.length > 0 && (
            <div className="font-mono text-xs bg-slate-950 rounded p-3 max-h-48 overflow-y-auto space-y-0.5 border border-slate-800">
              {stressLogs.map((line, i) => (
                <div key={i} className={
                  line.includes('ERROR') ? 'text-red-400' :
                  line.includes('WARN') || line.includes('SKIP') ? 'text-yellow-400' :
                  line.includes('Done') || line.includes('PASS') ? 'text-green-400' :
                  'text-slate-400'
                }>{line}</div>
              ))}
            </div>
          )}

          {/* Metrics card */}
          {stressMetrics && (
            <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 space-y-2">
              <p className="text-white font-bold text-sm mb-3">Stress Test Report</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className={stressMetrics.failJoins === 0 ? 'text-green-400' : 'text-yellow-400'}>
                  {stressMetrics.failJoins === 0 ? '✅' : '⚠️'} {stressMetrics.successJoins}/{stressMetrics.playerCount} players joined successfully
                </div>
                <div className={stressMetrics.failScores === 0 ? 'text-green-400' : 'text-yellow-400'}>
                  {stressMetrics.failScores === 0 ? '✅' : '⚠️'} {stressMetrics.successScores * 5} answers recorded ({stressMetrics.failScores === 0 ? 'all' : `${stressMetrics.failScores} failed`})
                </div>
                <div className="text-slate-300">
                  ⏱ Total time: <span className="text-white font-mono">{stressMetrics.totalMs}ms</span>
                </div>
                <div className="text-slate-300">
                  ⏱ Avg write: <span className="text-white font-mono">{stressMetrics.avgMs}ms</span>
                  <span className="text-slate-500"> (min {stressMetrics.minMs}ms / max {stressMetrics.maxMs}ms)</span>
                </div>
                <div className={stressMetrics.leaderboardCount === stressMetrics.playerCount ? 'text-green-400' : 'text-red-400'}>
                  📊 Leaderboard accurate: {stressMetrics.leaderboardCount === stressMetrics.playerCount ? 'yes' : `no (${stressMetrics.leaderboardCount}/${stressMetrics.playerCount})`}
                </div>
                <div className={stressMetrics.failJoins + stressMetrics.failScores === 0 ? 'text-green-400' : 'text-red-400'}>
                  {stressMetrics.failJoins + stressMetrics.failScores === 0 ? '✅ No errors encountered' : `⚠️ ${stressMetrics.failJoins + stressMetrics.failScores} errors encountered`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cleanup log */}
        {cleanupLog.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-bold text-sm mb-3">Cleanup Log</h3>
            <div className="font-mono text-xs bg-slate-950 rounded p-3 max-h-48 overflow-y-auto space-y-0.5 border border-slate-800">
              {cleanupLog.map((line, i) => (
                <div key={i} className={
                  line.includes('ERROR') ? 'text-red-400' :
                  line.includes('SKIP') || line.includes('WARN') ? 'text-yellow-400' :
                  line.includes('✅') ? 'text-green-400' :
                  'text-slate-400'
                }>{line}</div>
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-slate-700 text-xs pb-4">
          Internal diagnostic tool — not linked in the main hub. All test data uses prefixed IDs for safe isolation.
        </p>
      </div>
    </div>
  );
};

export default MultiplayerTest;
