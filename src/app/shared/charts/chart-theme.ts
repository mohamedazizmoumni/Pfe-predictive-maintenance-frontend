// Shared Chart.js styling so charts across the app (Manager Dashboard,
// Inventory Analytics, etc.) read as one system. Colors depend on the active
// app theme (light/dark) so charts stay legible whichever the user selects.

export function axisTicks(isDark: boolean) {
  return { color: isDark ? '#94A3B8' : '#475569', font: { size: 11 } };
}

export function gridLine(isDark: boolean): string {
  return isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
}

export function xScale(isDark: boolean, showGrid = false) {
  return {
    ticks: axisTicks(isDark),
    grid: { display: showGrid, color: gridLine(isDark) },
    border: { display: false },
  };
}

export function yScale(isDark: boolean, showGrid = true) {
  return {
    ticks: axisTicks(isDark),
    grid: { display: showGrid, color: gridLine(isDark) },
    border: { display: false },
  };
}

export function legendColor(isDark: boolean): string {
  return isDark ? '#94A3B8' : '#475569';
}

export function tooltipTheme(isDark: boolean) {
  return {
    backgroundColor: isDark ? '#0f172a' : '#0f172a',
    titleColor: '#E2E8F0',
    bodyColor: '#94A3B8',
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 10,
    displayColors: true,
    boxPadding: 4,
  };
}
