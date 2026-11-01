const numberOrNull = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
export function normalizeRatingHistory(data = []) {
  return data.map(row => {
    const date = Date.parse(row.date || row.week_start || '');
    const rank = numberOrNull(row.rank ?? row.world_rank);
    return { ...row, date: Number.isFinite(date) ? date : null,
      rating: numberOrNull(row.rating ?? row.points), rank: rank > 0 ? rank : null };
  }).filter(row => row.date !== null).sort((a,b) => a.date-b.date).map((row,index,rows) => ({
    ...row,
    pointsChange: index && row.rating !== null && rows[index-1].rating !== null ? row.rating-rows[index-1].rating : null,
    rankChange: index && row.rank !== null && rows[index-1].rank !== null ? rows[index-1].rank-row.rank : null,
  }));
}
export function filterRatingHistory(rows, months) {
  if (!months || !rows.length) return rows;
  const end = new Date(rows.at(-1).date);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth()-months);
  const maxDay = new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
  end.setUTCDate(Math.min(day,maxDay));
  return rows.filter(row => row.date >= end.getTime());
}
export function ratingHistoryChange(rows, metric) {
  const first = rows[0]?.[metric], last = rows.at(-1)?.[metric];
  if (rows.length < 2 || first == null || last == null) return null;
  return metric === 'rank' ? first-last : last-first;
}
