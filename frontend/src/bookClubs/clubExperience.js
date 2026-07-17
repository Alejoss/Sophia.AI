/**
 * Helpers for the reading-club experience journey (member hub).
 */

export const resolveExperiencePhase = ({ club, progress, nextMission, now = new Date() }) => {
  const startsAt = club?.starts_at ? new Date(club.starts_at) : null;
  const endsAt = club?.ends_at ? new Date(club.ends_at) : null;
  const total = progress?.total_nodes || 0;
  const completed = progress?.completed_nodes || 0;
  const isCompleted = Boolean(progress?.is_completed);

  if (club?.status === 'closed' || (endsAt && now > endsAt) || (isCompleted && total > 0)) {
    return 'finished';
  }
  if (club?.status === 'draft' || (startsAt && now < startsAt)) {
    return 'pre';
  }
  // Ahead of schedule: finished everything available, next is locked or missing missions
  if (
    nextMission?.locked ||
    (total > 0 && completed > 0 && !nextMission && !isCompleted)
  ) {
    return 'between';
  }
  if (total > 0 && completed >= total && !nextMission) {
    return 'between';
  }
  return 'active';
};

export const resolveWeekLabel = ({ club, progress, now = new Date() }) => {
  const total = Math.max(progress?.total_nodes || 0, 1);
  const completed = progress?.completed_nodes || 0;
  const currentWeek = Math.min(Math.max(completed + 1, 1), total);

  const startsAt = club?.starts_at ? new Date(club.starts_at) : null;
  const endsAt = club?.ends_at ? new Date(club.ends_at) : null;
  if (startsAt && endsAt && endsAt > startsAt) {
    const totalMs = endsAt - startsAt;
    const elapsed = Math.max(0, now - startsAt);
    const weeks = Math.max(1, Math.round(totalMs / (7 * 24 * 60 * 60 * 1000)));
    const weekNum = Math.min(weeks, Math.max(1, Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)) + 1));
    return { weekNum, weeksTotal: weeks, missionIndex: currentWeek, missionsTotal: total };
  }

  return { weekNum: currentWeek, weeksTotal: total, missionIndex: currentWeek, missionsTotal: total };
};

export const shortTagline = (description, fallback = 'Leemos, cuestionamos y debatimos juntos.') => {
  if (!description?.trim()) return fallback;
  const oneLine = description.trim().replace(/\s+/g, ' ');
  if (oneLine.length <= 140) return oneLine;
  return `${oneLine.slice(0, 137)}…`;
};

export const daysUntil = (iso, now = new Date()) => {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target - now) / (24 * 60 * 60 * 1000));
};
