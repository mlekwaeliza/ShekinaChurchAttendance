function getISOWeekRange(weekStr) {
  const parts = weekStr.split('-W');
  const year = parseInt(parts[0]);
  const week = parseInt(parts[1]);
  
  // Find the first Thursday of the year
  const firstThursday = new Date(year, 0, 4);
  const day = firstThursday.getDay() || 7;
  firstThursday.setDate(firstThursday.getDate() - day + 4);
  
  // Find the start of the requested week
  const weekStart = new Date(firstThursday);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7 - 3);
  
  // Format as YYYY-MM-DD
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const start = formatDate(weekStart);
  const endD = new Date(weekStart);
  endD.setDate(endD.getDate() + 6);
  const end = formatDate(endD);
  
  return { start, end };
}

console.log('2026-W17:', getISOWeekRange('2026-W17'));
