/** Date-aware conflict hints for source observations. This does not confer legal recognition. */
export interface ObservedTemporalFact {
  id: string;
  subjectId: string;
  key: string;
  logicalId: string;
  periodStart?: string;
  periodEnd?: string;
}
function validCalendarDay(day: string | undefined): day is string {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
function provenDisjoint(a: ObservedTemporalFact, b: ObservedTemporalFact): boolean {
  if (![a.periodStart, a.periodEnd, b.periodStart, b.periodEnd].every(validCalendarDay)) return false;
  const aStart = a.periodStart!, aEnd = a.periodEnd!, bStart = b.periodStart!, bEnd = b.periodEnd!;
  if (aStart > aEnd || bStart > bEnd) return false;
  return aEnd < bStart || bEnd < aStart;
}
/** Only complete, valid, non-overlapping ranges can suppress an apparent disagreement. */
export function conflictingObservedFactIds<T extends ObservedTemporalFact>(
  facts: readonly T[],
  displayValue: (fact: T) => string,
): Set<string> {
  const groups = new Map<string, T[]>();
  for (const fact of facts) {
    const groupKey = fact.key === "statement.text" && fact.logicalId.includes(":paragraph:")
      ? fact.subjectId + "\0" + fact.logicalId
      : fact.subjectId + "\0" + fact.key;
    const group = groups.get(groupKey) ?? [];
    group.push(fact);
    groups.set(groupKey, group);
  }
  const conflicting = new Set<string>();
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i]!, b = group[j]!;
      if (displayValue(a) !== displayValue(b) && !provenDisjoint(a, b)) {
        conflicting.add(a.id);
        conflicting.add(b.id);
      }
    }
  }
  return conflicting;
}
