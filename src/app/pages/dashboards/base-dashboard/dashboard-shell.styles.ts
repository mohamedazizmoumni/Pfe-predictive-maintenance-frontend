export const DASHBOARD_SHELL_STYLES = `
:host {
  display: block;
  color: var(--dashboard-text, #e5eef8);
}

.dashboard-shell {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--dashboard-bg, transparent);
  color: var(--dashboard-text, #e5eef8);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.dashboard-eyebrow {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  opacity: 0.72;
}

.dashboard-title {
  margin: 0;
  font-size: 1.9rem;
  line-height: 1.1;
}

.dashboard-subtitle {
  margin: 8px 0 0;
  max-width: 70ch;
  opacity: 0.82;
}

.dashboard-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.dashboard-button {
  border: 0;
  border-radius: 999px;
  padding: 0.8rem 1.1rem;
  font-weight: 700;
  cursor: pointer;
  color: white;
  background: linear-gradient(135deg, var(--accent-solid, #2563eb), var(--accent-strong, #0ea5e9));
}

.dashboard-button.secondary {
  background: var(--dashboard-surface-alt, rgba(148, 163, 184, 0.15));
  border: 1px solid var(--dashboard-border, rgba(148, 163, 184, 0.25));
  color: var(--dashboard-text, #e5eef8);
}

.dashboard-grid,
.kpi-grid,
.split-grid,
.meta-grid {
  display: grid;
  gap: 16px;
}

.kpi-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.split-grid {
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.meta-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.card,
.chart-card,
.table-card,
.summary-card {
  border-radius: 20px;
  border: 1px solid var(--dashboard-border, rgba(148, 163, 184, 0.16));
  background: var(--dashboard-surface, rgba(15, 23, 42, 0.72));
  backdrop-filter: blur(14px);
  box-shadow: var(--dashboard-shadow-lg, 0 24px 60px rgba(15, 23, 42, 0.22));
}

.card,
.chart-card,
.table-card,
.summary-card {
  padding: 18px;
}

.kpi-card h3,
.chart-card h3,
.table-card h3,
.summary-card h3 {
  margin: 0 0 10px;
  font-size: 1.05rem;
}

.kpi-value {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
}

.kpi-note,
.card-note,
.table-note {
  margin: 6px 0 0;
  color: var(--dashboard-muted, #94a3b8);
  font-size: 0.92rem;
}

.tone {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 700;
}

.tone.good { background: rgba(16, 185, 129, 0.15); color: #86efac; }
.tone.warning { background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
.tone.critical { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
.tone.info { background: rgba(37, 99, 235, 0.15); color: #93c5fd; }

.chart-bars {
  display: grid;
  gap: 12px;
}

.chart-row {
  display: grid;
  grid-template-columns: 140px 1fr auto;
  gap: 12px;
  align-items: center;
}

.chart-track {
  height: 10px;
  border-radius: 999px;
  background: var(--dashboard-surface-alt, rgba(148, 163, 184, 0.16));
  overflow: hidden;
}

.chart-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #0ea5e9);
}

.list-table {
  width: 100%;
  border-collapse: collapse;
}

.list-table th,
.list-table td {
  padding: 0.85rem 0.7rem;
  border-bottom: 1px solid var(--dashboard-border, rgba(148, 163, 184, 0.12));
  text-align: left;
}

.list-table th {
  color: var(--dashboard-text-soft, #cbd5e1);
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.list-table td {
  color: var(--dashboard-text, #e2e8f0);
}

.empty-state {
  border: 1px dashed var(--dashboard-border, rgba(148, 163, 184, 0.25));
  border-radius: 18px;
  padding: 16px;
  color: var(--dashboard-muted, #94a3b8);
  text-align: center;
}

.dashboard-error {
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(239, 68, 68, 0.12);
  color: #fecaca;
  border: 1px solid rgba(239, 68, 68, 0.22);
}

@media (max-width: 720px) {
  .chart-row {
    grid-template-columns: 1fr;
  }

  .dashboard-shell {
    padding: 16px;
  }
}
`;
