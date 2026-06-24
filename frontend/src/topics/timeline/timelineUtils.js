export const hasTimelineDate = (entry) => Boolean(entry?.start_date);

export const sortTimelineEntries = (entries) => {
  const list = [...(entries || [])];
  const dated = list
    .filter(hasTimelineDate)
    .sort((a, b) => {
      const dateCompare = String(a.start_date).localeCompare(String(b.start_date));
      if (dateCompare !== 0) return dateCompare;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
  const undated = list
    .filter((entry) => !hasTimelineDate(entry))
    .sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
  return [...dated, ...undated];
};
