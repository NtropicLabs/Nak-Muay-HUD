import {
  STRIKE_LABELS,
  STRIKE_TYPES,
  type RoundData,
  type StrikeType,
} from "@/lib/session/types";

interface RoundTableProps {
  rounds: RoundData[];
  fatiguePercent: number;
}

export function RoundTable({ rounds, fatiguePercent }: RoundTableProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-text-primary tracking-widest">
          [ROUND_BREAKDOWN]
        </span>
        <div className="flex-grow h-px bg-structural/30" />
      </div>
      <div className="bg-panel-bg border border-structural/40 overflow-hidden">
        <table className="w-full font-mono text-[10px] text-left">
          <thead>
            <tr className="text-structural border-b border-structural/30">
              <th className="px-4 py-3 font-medium">[RND]</th>
              <th className="px-4 py-3 font-medium">[STRIKES]</th>
              <th className="px-4 py-3 font-medium">[STR/MIN]</th>
              <th className="px-4 py-3 font-medium">[TOP_STRIKE]</th>
            </tr>
          </thead>
          <tbody className="text-text-primary">
            {rounds.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-4 text-structural/60 text-center"
                >
                  [NO_ROUNDS_RECORDED]
                </td>
              </tr>
            )}
            {rounds.map((r) => {
              const topStrike = topStrikeForRound(r);
              return (
                <tr
                  key={r.roundNumber}
                  className="border-b border-structural/20"
                >
                  <td className="px-4 py-3">R{r.roundNumber}</td>
                  <td className="px-4 py-3">{r.strikes.length}</td>
                  <td className="px-4 py-3">{r.strikesPerMinute.toFixed(1)}</td>
                  <td className="px-4 py-3 text-status">
                    {topStrike
                      ? `${STRIKE_LABELS[topStrike.type]} (${topStrike.count})`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rounds.length >= 2 && (
        <p
          className={
            "font-mono text-[9px] tracking-tight " +
            (fatiguePercent > 0 ? "text-hazard" : "text-status")
          }
        >
          [NOTE: {fatiguePercent >= 0 ? "-" : "+"}
          {Math.abs(fatiguePercent).toFixed(1)}% STRIKE_RATE{" "}
          {fatiguePercent >= 0 ? "DECLINE" : "GAIN"} R1→R{rounds.length}]
        </p>
      )}
    </section>
  );
}

function topStrikeForRound(
  r: RoundData
): { type: StrikeType; count: number } | null {
  const tally: Partial<Record<StrikeType, number>> = {};
  for (const s of r.strikes) tally[s.type] = (tally[s.type] ?? 0) + 1;
  let best: { type: StrikeType; count: number } | null = null;
  for (const t of STRIKE_TYPES) {
    const c = tally[t] ?? 0;
    if (c > 0 && (!best || c > best.count)) best = { type: t, count: c };
  }
  return best;
}
