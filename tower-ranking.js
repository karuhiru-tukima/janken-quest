/* Historical tower records: one personal best per player. */
(() => {
  'use strict';
  const valid = value => value && Number.isInteger(value.f) && value.f >= 1 && value.f <= 9999
    && Number.isFinite(value.t) && value.t >= 0;

  function summarize(records, uid) {
    const rows = records.filter(valid).map(value => ({
      uid: String(value.uid), n: String(value.n || '名無し').slice(0, 12),
      f: value.f, t: value.t, me: value.uid === uid,
    }));
    rows.sort((a, b) => b.f - a.f || a.t - b.t || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    rows.forEach((row, index) => { row.rank = index + 1; });
    const mine = rows.find(row => row.me) || null;
    return { top: rows.slice(0, 10), mine, total: rows.length };
  }

  // Called inside a Firebase transaction, including retries. Never replace a
  // higher cloud record, or change its first-arrival time on a rename/retry.
  function record(current, attempt, timestamp) {
    if (!Number.isInteger(attempt.f) || attempt.f < 1 || attempt.f > 9999) return;
    const n = String(attempt.n || '名無し').slice(0, 12);
    if (valid(current) && current.f >= attempt.f) return { n, f: current.f, t: current.t };
    return { n, f: attempt.f, t: timestamp };
  }

  window.JQTowerRanking = Object.freeze({ summarize, record });
})();
