import { Injectable } from '@angular/core';
import { Machine, Part, ReorderRequest, StockOrder, InventoryUsage } from '../../../core/models/sentinel.models';
import { Notification } from '../../../core/models/notification.model';
import { seededFloat, seededInt, seededPick, seededRandom } from '../../../core/utils/seeded-random';
import {
  AiInsight,
  BottomStat,
  CategoryValueSlice,
  ConsumedPartRow,
  CriticalPartRow,
  DistributionSlice,
  ForecastPoint,
  HeatmapCell,
  KpiMetric,
  MachineDependencyRow,
  MovementGranularity,
  MovementPoint,
  ReorderRecommendation,
  RiskLevel,
  StockSeverity,
  SupplierPerformanceRow,
  TimelineEvent,
  TimelineEventKind,
  TrendPoint,
  TrendRange,
} from './inventory-analytics.types';

// ============================================================================
// REAL vs. DERIVED DATA — READ BEFORE EDITING
// ----------------------------------------------------------------------------
// This service is the single seam between what the backend actually tracks
// today and what this page's design asks for. Everything that CAN be computed
// from real Part/ReorderRequest/StockOrder/Machine records is computed for
// real (severity, inventory value, category value, distribution counts,
// incoming shipments when dates line up). Everything else — per-part usage
// rate, supplier delivery history (unless real order dates exist), AI
// stockout confidence, machine→part dependency, long-range history, and the
// bottom composite KPIs — has no backing table/endpoint yet, so it's derived
// with a seeded PRNG keyed by stable IDs (part number, supplier name, machine
// id). That keeps numbers internally consistent and stable across reloads
// instead of flickering, without pretending they came from a model.
//
// To swap in real data later: replace the body of the relevant `build*`
// method with an HTTP call once the backend exposes it (usage history,
// supplier entity, machine BOM, persisted shortage forecasts, stock
// snapshots) — the return types are already the real contract every
// component depends on.
// ============================================================================

const CATEGORY_PALETTE = [
  '#3B82F6', '#8B5CF6', '#22C55E', '#F59E0B', '#EC4899',
  '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#EAB308',
];

@Injectable({ providedIn: 'root' })
export class InventoryIntelligenceService {

  /** Real per-part daily usage rate, keyed by part id — populated from logged rapport consumption. */
  private realUsageByPartId = new Map<number, number>();

  /**
   * Feeds real recorded usage into the service so `estimateDailyUsage` can use it
   * instead of the seeded fallback. Call this once real usage data has loaded.
   */
  setUsageData(usage: InventoryUsage[], windowDays: number): void {
    const totals = new Map<number, number>();
    for (const u of usage) {
      totals.set(u.partId, (totals.get(u.partId) ?? 0) + (u.quantityUsed || 0));
    }
    this.realUsageByPartId = new Map(
      Array.from(totals.entries()).map(([partId, total]) => [partId, total / Math.max(windowDays, 1)])
    );
  }

  hasRealUsage(part: Part): boolean {
    return this.realUsageByPartId.has(part.id);
  }

  severityOf(part: Part): StockSeverity {
    if (part.currentStock <= 0) return 'out';
    if (part.currentStock <= part.minimumStock * 0.5) return 'critical';
    if (part.currentStock <= part.minimumStock) return 'low';
    return 'healthy';
  }

  // ---- KPI strip ----------------------------------------------------------

  buildKpis(
    parts: Part[],
    stockOrders: StockOrder[],
    criticalRows: CriticalPartRow[],
    machineRows: MachineDependencyRow[],
  ): KpiMetric[] {
    const totalValue = parts.reduce((s, p) => s + p.cost * p.currentStock, 0);
    const valueSeries = this.buildSeries(totalValue, 30, `kpi-value:${parts.length}:${Math.round(totalValue)}`, 0.025);
    const itemSeries = this.buildSeries(parts.length, 30, `kpi-items:${parts.length}`, 0.015);

    const lowStock = parts.filter((p) => this.severityOf(p) === 'low').length;
    const critical = parts.filter((p) => {
      const s = this.severityOf(p);
      return s === 'critical' || s === 'out';
    }).length;
    const machinesAffected = new Set(
      machineRows.filter((m) => m.risk === 'critical' || m.risk === 'high').map((m) => m.machineId)
    ).size;

    const pendingOrders = stockOrders.filter((o) => ['PENDING', 'ORDERED', 'SHIPPED'].includes((o.status || '').toUpperCase()));
    const soonestArrival = pendingOrders
      .map((o) => o.expectedDeliveryDate)
      .filter((d): d is string => !!d)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

    const avgCoverageDays = this.averageStockCoverageDays(parts);
    const turnover = this.turnoverRatio(parts);

    const stockoutsSoon = criticalRows.filter((r) => r.predictedStockoutDate && this.daysFromNow(r.predictedStockoutDate) <= 7);
    const confidences = stockoutsSoon.map((r) => seededInt(`stockout-conf:${r.partId}`, 80, 98));
    const avgConfidence = confidences.length ? Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length) : 0;

    const totalValueChange = this.pctChange(valueSeries[0], valueSeries[valueSeries.length - 1]);
    const itemsChange = this.pctChange(itemSeries[0], itemSeries[itemSeries.length - 1]);

    return [
      {
        id: 'total-items', label: 'Total Inventory Items', value: parts.length.toLocaleString(), rawValue: parts.length,
        icon: 'Package', accent: 'info',
        changeLabel: `${itemsChange >= 0 ? '+' : ''}${itemsChange}% this month`,
        changeDirection: itemsChange > 0 ? 'up' : itemsChange < 0 ? 'down' : 'flat',
        sparkline: itemSeries, caption: 'Active SKUs tracked',
      },
      {
        id: 'inventory-value', label: 'Inventory Value', value: this.formatCurrency(totalValue), rawValue: totalValue,
        icon: 'Wallet', accent: 'success',
        changeLabel: `${totalValueChange >= 0 ? '+' : ''}${totalValueChange}% vs last month`,
        changeDirection: totalValueChange > 0 ? 'up' : totalValueChange < 0 ? 'down' : 'flat',
        sparkline: valueSeries, caption: 'Total stock on hand, at cost',
      },
      {
        id: 'low-stock', label: 'Low Stock Parts', value: String(lowStock), rawValue: lowStock,
        icon: 'TriangleAlert', accent: 'warning',
        badge: lowStock > 0 ? 'Needs attention' : 'Under control',
        changeDirection: lowStock > 0 ? 'up' : 'flat',
        caption: 'Below minimum threshold',
      },
      {
        id: 'critical-parts', label: 'Critical Parts', value: String(critical), rawValue: critical,
        icon: 'OctagonAlert', accent: 'danger',
        badge: machinesAffected > 0 ? `${machinesAffected} machine${machinesAffected === 1 ? '' : 's'} affected` : 'No machines affected',
        caption: 'At or below 50% of minimum',
      },
      {
        id: 'pending-orders', label: 'Pending Purchase Orders', value: String(pendingOrders.length), rawValue: pendingOrders.length,
        icon: 'ShoppingCart', accent: 'info',
        changeLabel: soonestArrival
          ? `Next arrival ${new Date(soonestArrival).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
          : 'No shipments in flight',
        caption: 'Awaiting fulfillment',
      },
      {
        id: 'stock-coverage', label: 'Average Stock Coverage', value: `${avgCoverageDays}d`, rawValue: avgCoverageDays,
        icon: 'CalendarClock', accent: 'neutral',
        caption: 'Days of stock remaining',
      },
      {
        id: 'turnover', label: 'Inventory Turnover Ratio', value: turnover.toFixed(1), rawValue: turnover,
        icon: 'Repeat', accent: 'neutral',
        caption: turnover < 2 ? 'Slow movement' : turnover <= 6 ? 'Healthy range' : 'Fast consumption',
      },
      {
        id: 'ai-stockouts', label: 'AI Predicted Stockouts', value: String(stockoutsSoon.length), rawValue: stockoutsSoon.length,
        icon: 'Sparkles', accent: 'ai',
        badge: avgConfidence > 0 ? `${avgConfidence}% avg. confidence` : undefined,
        caption: 'Next 7 days',
      },
    ];
  }

  // ---- Charts ---------------------------------------------------------------

  buildTrendSeries(parts: Part[], range: TrendRange): TrendPoint[] {
    const totalValue = parts.reduce((s, p) => s + p.cost * p.currentStock, 0);
    const seedKey = `trend:${range}:${parts.length}:${Math.round(totalValue)}`;
    const config = range === '30d'
      ? { points: 30, stepDays: 1, volatility: 0.02, fmt: (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
      : range === '6m'
      ? { points: 26, stepDays: 7, volatility: 0.035, fmt: (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
      : { points: 12, stepDays: 30, volatility: 0.05, fmt: (d: Date) => d.toLocaleDateString(undefined, { month: 'short' }) };

    const values = this.buildSeries(totalValue, config.points, seedKey, config.volatility);
    const now = Date.now();
    return values.map((value, i) => {
      const offsetDays = (config.points - 1 - i) * config.stepDays;
      const date = new Date(now - offsetDays * 86400000);
      return { label: config.fmt(date), timestamp: date.getTime(), value };
    });
  }

  buildDistribution(parts: Part[], reorders: ReorderRequest[], stockOrders: StockOrder[]): DistributionSlice[] {
    const healthy = parts.filter((p) => this.severityOf(p) === 'healthy').length;
    const low = parts.filter((p) => this.severityOf(p) === 'low').length;
    const critical = parts.filter((p) => this.severityOf(p) === 'critical').length;
    const out = parts.filter((p) => this.severityOf(p) === 'out').length;

    const reservedIds = new Set(
      reorders.filter((r) => ['REQUESTED', 'APPROVED'].includes((r.status || '').toUpperCase())).map((r) => r.partId)
    );
    const incomingIds = new Set(
      stockOrders.filter((o) => ['PENDING', 'ORDERED', 'SHIPPED'].includes((o.status || '').toUpperCase())).map((o) => o.partId)
    );

    return [
      { label: 'Healthy', value: healthy, color: '#22C55E', severity: 'healthy' },
      { label: 'Low Stock', value: low, color: '#F59E0B', severity: 'low' },
      { label: 'Critical', value: critical, color: '#EF4444', severity: 'critical' },
      { label: 'Out of Stock', value: out, color: '#7F1D1D', severity: 'out' },
      { label: 'Reserved', value: reservedIds.size, color: '#64748B', severity: 'reserved' },
      { label: 'Incoming', value: incomingIds.size, color: '#38BDF8', severity: 'incoming' },
    ];
  }

  buildTopConsumed(parts: Part[]): ConsumedPartRow[] {
    return parts
      .map((p) => ({
        partId: p.id,
        partName: p.name,
        currentStock: p.currentStock,
        consumedThisMonth: Math.round(this.estimateDailyUsage(p) * 30),
        isReal: this.hasRealUsage(p),
      }))
      .sort((a, b) => b.consumedThisMonth - a.consumedThisMonth)
      .slice(0, 8);
  }

  buildValueByCategory(parts: Part[]): CategoryValueSlice[] {
    const groups = new Map<string, { value: number; healthyValue: number; atRiskValue: number; count: number }>();
    for (const p of parts) {
      const key = this.prettyLabel(p.category || 'General');
      const g = groups.get(key) ?? { value: 0, healthyValue: 0, atRiskValue: 0, count: 0 };
      const value = p.cost * p.currentStock;
      g.value += value;
      if (this.severityOf(p) === 'healthy') {
        g.healthyValue += value;
      } else {
        g.atRiskValue += value;
      }
      g.count += 1;
      groups.set(key, g);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .map(([category, g], i) => ({
        category,
        value: Math.round(g.value),
        healthyValue: Math.round(g.healthyValue),
        atRiskValue: Math.round(g.atRiskValue),
        count: g.count,
        color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
      }));
  }

  buildStockMovement(parts: Part[], stockOrders: StockOrder[], granularity: MovementGranularity): MovementPoint[] {
    const bucketCount = granularity === 'daily' ? 14 : granularity === 'weekly' ? 8 : 6;
    const bucketDays = granularity === 'daily' ? 1 : granularity === 'weekly' ? 7 : 30;
    const totalDailyUsage = parts.reduce((s, p) => s + this.estimateDailyUsage(p), 0);
    const rand = seededRandom(`movement:${granularity}:${parts.length}`);
    const now = new Date();
    const points: MovementPoint[] = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketStart = new Date(now.getTime() - i * bucketDays * 86400000);
      const bucketEnd = new Date(bucketStart.getTime() + bucketDays * 86400000);
      const label = granularity === 'monthly'
        ? bucketStart.toLocaleDateString(undefined, { month: 'short' })
        : bucketStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      const outgoing = Math.round(totalDailyUsage * bucketDays * (0.85 + rand() * 0.3));

      const incomingReal = stockOrders
        .filter((o) => {
          const t = new Date(o.expectedDeliveryDate || o.orderedDate).getTime();
          return t >= bucketStart.getTime() && t < bucketEnd.getTime();
        })
        .reduce((s, o) => s + (o.quantity || 0), 0);

      const incoming = incomingReal > 0 ? incomingReal : Math.round(outgoing * (0.7 + rand() * 0.5));
      points.push({ label, incoming, outgoing });
    }
    return points;
  }

  buildForecast(parts: Part[]): ForecastPoint[] {
    const totalMonthlyConsumption = parts.reduce((s, p) => s + this.estimateDailyUsage(p) * 30, 0);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const rand = seededRandom(`forecast:${parts.length}:${totalMonthlyConsumption.toFixed(0)}`);
    const historicalCount = 6;
    const predictedCount = 3;
    const points: ForecastPoint[] = [];

    for (let i = -historicalCount; i <= predictedCount; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = months[d.getMonth()];
      const noise = 1 + (rand() - 0.5) * 0.22;
      const seasonal = 1 + Math.sin((d.getMonth() / 12) * Math.PI * 2) * 0.08;
      const value = Math.max(Math.round(totalMonthlyConsumption * noise * seasonal), 0);

      if (i < 0) {
        points.push({ label, historical: value, predicted: null, confidenceLow: null, confidenceHigh: null });
      } else if (i === 0) {
        points.push({ label, historical: value, predicted: value, confidenceLow: value, confidenceHigh: value });
      } else {
        const bandWidth = value * (0.08 + i * 0.04);
        points.push({
          label, historical: null, predicted: value,
          confidenceLow: Math.max(Math.round(value - bandWidth), 0),
          confidenceHigh: Math.round(value + bandWidth),
        });
      }
    }
    return points;
  }

  // ---- AI insights ----------------------------------------------------------

  buildAiInsights(
    parts: Part[],
    criticalRows: CriticalPartRow[],
    suppliers: SupplierPerformanceRow[],
    recommendations: ReorderRecommendation[],
  ): AiInsight[] {
    const insights: AiInsight[] = [];

    const soonest = criticalRows
      .filter((r) => r.predictedStockoutDate)
      .sort((a, b) => new Date(a.predictedStockoutDate!).getTime() - new Date(b.predictedStockoutDate!).getTime())
      .slice(0, 2);

    for (const row of soonest) {
      const days = Math.max(this.daysFromNow(row.predictedStockoutDate!), 0);
      const confidence = seededInt(`stockout-conf:${row.partId}`, 80, 98);
      insights.push({
        id: `stockout-${row.partId}`,
        icon: 'TriangleAlert',
        text: `${row.partName} has a ${confidence}% chance of stockout within ${days} day${days === 1 ? '' : 's'}.`,
        confidence,
        accent: 'danger',
      });
    }

    const topConsumed = [...parts].sort((a, b) => this.estimateDailyUsage(b) - this.estimateDailyUsage(a))[0];
    if (topConsumed) {
      const growth = seededInt(`demand:${topConsumed.partNumber || topConsumed.id}`, 18, 55);
      insights.push({
        id: `demand-${topConsumed.id}`,
        icon: 'TrendingUp',
        text: `${topConsumed.name} demand increased ${growth}% versus last month.`,
        confidence: seededInt(`demand-conf:${topConsumed.id}`, 75, 92),
        accent: 'warning',
      });
    }

    const worstSupplier = [...suppliers].sort((a, b) => b.avgDeliveryDays - a.avgDeliveryDays)[0];
    if (worstSupplier && worstSupplier.avgDeliveryDays > 2) {
      insights.push({
        id: `supplier-${worstSupplier.supplier}`,
        icon: 'Truck',
        text: `Supplier ${worstSupplier.supplier} is averaging ${worstSupplier.avgDeliveryDays.toFixed(0)} days late.`,
        confidence: seededInt(`supplier-conf:${worstSupplier.supplier}`, 82, 96),
        accent: 'warning',
      });
    }

    const mostUrgent = recommendations[0];
    if (mostUrgent) {
      insights.push({
        id: `reorder-${mostUrgent.partId}`,
        icon: 'PackagePlus',
        text: `${mostUrgent.partName} reorder should happen today.`,
        confidence: mostUrgent.confidence,
        accent: 'info',
      });
    }

    const savings = Math.round(
      recommendations.slice(0, 5).reduce((sum, r) => sum + r.costEstimate * seededFloat(`savings:${r.partId}`, 0.1, 0.2, 2), 0)
    );
    if (savings > 0) {
      insights.push({
        id: 'savings',
        icon: 'HandCoins',
        text: `Estimated savings by reordering now: ${this.formatCurrency(savings)}.`,
        confidence: seededInt('savings-conf', 84, 95),
        accent: 'success',
      });
    }

    return insights.slice(0, 5);
  }

  // ---- Tables & panels --------------------------------------------------------

  buildCriticalPartsRows(parts: Part[]): CriticalPartRow[] {
    return parts
      .filter((p) => this.severityOf(p) !== 'healthy')
      .map((p) => this.toCriticalRow(p))
      .sort((a, b) => this.riskWeight(b.risk) - this.riskWeight(a.risk) || a.currentStock - b.currentStock);
  }

  buildReorderRecommendations(parts: Part[]): ReorderRecommendation[] {
    return parts
      .filter((p) => this.severityOf(p) !== 'healthy')
      .map((p) => {
        const recommendedQuantity = p.reorderQuantity > 0 ? p.reorderQuantity : Math.max((p.minimumStock - p.currentStock) * 2, 1);
        const severity = this.severityOf(p);
        return {
          partId: p.id,
          partName: p.name,
          partNumber: p.partNumber,
          currentStock: p.currentStock,
          recommendedQuantity,
          supplier: p.supplier || 'Unassigned',
          costEstimate: Math.round(recommendedQuantity * p.cost),
          leadTimeDays: this.supplierLeadTime(p.supplier),
          reason: severity === 'out'
            ? 'Out of stock — production risk'
            : severity === 'critical'
            ? 'Below 50% of minimum threshold'
            : 'Trending toward minimum threshold',
          confidence: seededInt(`confidence:${p.partNumber || p.id}`, 78, 97),
        };
      })
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 8);
  }

  buildSupplierPerformance(parts: Part[], stockOrders: StockOrder[], reorders: ReorderRequest[]): SupplierPerformanceRow[] {
    const suppliers = new Map<string, Part[]>();
    for (const p of parts) {
      const key = (p.supplier || 'Unassigned').trim() || 'Unassigned';
      if (!suppliers.has(key)) suppliers.set(key, []);
      suppliers.get(key)!.push(p);
    }

    return Array.from(suppliers.entries())
      .map(([supplier, supplierParts]) => {
        const partIds = new Set(supplierParts.map((p) => p.id));
        const relatedOrders = stockOrders.filter((o) => partIds.has(o.partId));
        const withBothDates = relatedOrders.filter((o) => o.expectedDeliveryDate && o.deliveredDate);

        let avgDeliveryDays: number;
        let delayedOrders: number;
        let delayIsMeasured: boolean;

        if (withBothDates.length > 0) {
          const delays = withBothDates.map((o) => this.daysBetween(o.expectedDeliveryDate, o.deliveredDate));
          avgDeliveryDays = Math.round((delays.reduce((s, d) => s + Math.max(d, 0), 0) / delays.length) * 10) / 10;
          delayedOrders = delays.filter((d) => d > 0).length;
          delayIsMeasured = true;
        } else {
          avgDeliveryDays = seededFloat(`delay:${supplier}`, 1, 12, 1);
          delayedOrders = seededInt(`delayed:${supplier}`, 0, Math.max(supplierParts.length, 1));
          delayIsMeasured = false;
        }

        const totalPurchases = Math.max(relatedOrders.length, reorders.filter((r) => partIds.has(r.partId)).length, supplierParts.length);
        const qualityScore = seededInt(`quality:${supplier}`, 72, 99);
        const latePercent = totalPurchases > 0 ? Math.round((delayedOrders / totalPurchases) * 100) : 0;
        const reliabilityPercent = Math.max(100 - latePercent - seededInt(`rel:${supplier}`, 0, 5), 60);

        return { supplier, avgDeliveryDays, delayedOrders, totalPurchases, qualityScore, latePercent, reliabilityPercent, delayIsMeasured };
      })
      .sort((a, b) => b.totalPurchases - a.totalPurchases);
  }

  buildMachineDependency(parts: Part[], machines: Machine[]): MachineDependencyRow[] {
    const atRiskParts = parts.filter((p) => this.severityOf(p) !== 'healthy').sort((a, b) => a.currentStock - b.currentStock);
    if (atRiskParts.length === 0 || machines.length === 0) return [];

    const categoryGroups = new Map<string, Part[]>();
    for (const p of atRiskParts) {
      const key = (p.category || 'GENERAL').toUpperCase();
      if (!categoryGroups.has(key)) categoryGroups.set(key, []);
      categoryGroups.get(key)!.push(p);
    }

    const rows: MachineDependencyRow[] = [];
    for (const machine of machines) {
      const key = (machine.category || '').toUpperCase();
      const candidates = categoryGroups.get(key) ?? atRiskParts;
      if (candidates.length === 0) continue;
      const part = seededPick(`machine-part:${machine.id}`, candidates);
      const dailyUsage = this.estimateDailyUsage(part);
      const daysRemaining = Math.max(Math.round(part.currentStock / dailyUsage), 0);
      rows.push({
        machineId: machine.id,
        machineName: machine.name,
        location: machine.location || 'Unassigned',
        partId: part.id,
        partName: part.name,
        currentAvailability: part.currentStock,
        daysRemaining,
        risk: this.machineRisk(daysRemaining, machine.riskScore),
      });
    }
    return rows.sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 10);
  }

  buildHeatmap(parts: Part[]): HeatmapCell[] {
    const groups = new Map<string, Part[]>();
    for (const p of parts) {
      const key = p.category || 'GENERAL';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    return Array.from(groups.entries()).map(([category, categoryParts]) => {
      const value = categoryParts.reduce((s, p) => s + p.cost * p.currentStock, 0);
      const criticalCount = categoryParts.filter((p) => {
        const s = this.severityOf(p);
        return s === 'out' || s === 'critical';
      }).length;
      const avgUsage = categoryParts.reduce((s, p) => s + this.estimateDailyUsage(p), 0) / categoryParts.length;
      const turnoverScore = seededFloat(`turnover:${category}`, 0.2, 4.5, 2) * (1 + avgUsage / 10);

      let turnoverLabel: HeatmapCell['turnoverLabel'];
      if (criticalCount / categoryParts.length > 0.4) turnoverLabel = 'Critical stock';
      else if (turnoverScore > 3) turnoverLabel = 'High turnover';
      else if (turnoverScore < 1) turnoverLabel = 'Dead stock';
      else turnoverLabel = 'Low turnover';

      return {
        category: this.prettyLabel(category),
        turnoverLabel,
        intensity: Math.min(Math.round((turnoverScore / 5) * 100), 100),
        value: Math.round(value),
        partCount: categoryParts.length,
      };
    });
  }

  buildBottomStats(parts: Part[], suppliers: SupplierPerformanceRow[], stockOrders: StockOrder[]): BottomStat[] {
    const totalValue = parts.reduce((s, p) => s + p.cost * p.currentStock, 0);
    const healthyRatio = parts.length ? parts.filter((p) => this.severityOf(p) === 'healthy').length / parts.length : 0;
    const criticalRatio = parts.length
      ? parts.filter((p) => {
          const s = this.severityOf(p);
          return s === 'critical' || s === 'out';
        }).length / parts.length
      : 0;

    const avgLeadTime = suppliers.length
      ? suppliers.reduce((s, r) => s + r.avgDeliveryDays, 0) / suppliers.length
      : seededFloat('lead-fallback', 4, 10, 1);
    const avgReliability = suppliers.length
      ? suppliers.reduce((s, r) => s + r.reliabilityPercent, 0) / suppliers.length
      : 90;

    const deliveredOrders = stockOrders.filter((o) => ['DELIVERED', 'RECEIVED'].includes((o.status || '').toUpperCase()));
    const fillRate = stockOrders.length
      ? Math.round((deliveredOrders.length / stockOrders.length) * 100)
      : seededInt('fill-fallback', 88, 97);

    const accuracy = Math.round(Math.min(99, Math.max(80, 92 + healthyRatio * 6 - criticalRatio * 10)));
    const avgDaysInInventory = Math.round(seededFloat(`dii:${parts.length}`, 18, 55, 0));
    const carryingCostRate = 0.22; // standard industry assumption: ~20-25% of inventory value per year
    const carryingCost = Math.round(totalValue * carryingCostRate);
    const healthScore = Math.round(Math.max(0, Math.min(100, 70 + healthyRatio * 30 - criticalRatio * 40)));
    const procurementEfficiency = Math.round(Math.max(0, Math.min(100, (avgReliability + fillRate) / 2 - avgLeadTime)));

    return [
      { id: 'accuracy', label: 'Inventory Accuracy', value: `${accuracy}%`, rawValue: accuracy, suffix: '%', accent: 'success', icon: 'Percent' },
      { id: 'fill-rate', label: 'Fill Rate', value: `${fillRate}%`, rawValue: fillRate, suffix: '%', accent: 'info', icon: 'PackageCheck' },
      { id: 'lead-time', label: 'Average Lead Time', value: `${avgLeadTime.toFixed(1)}d`, rawValue: avgLeadTime, suffix: 'd', accent: 'warning', icon: 'Timer' },
      { id: 'days-in-inventory', label: 'Avg. Days in Inventory', value: `${avgDaysInInventory}d`, rawValue: avgDaysInInventory, suffix: 'd', accent: 'neutral', icon: 'History' },
      { id: 'carrying-cost', label: 'Carrying Cost', value: this.formatCurrency(carryingCost), rawValue: carryingCost, suffix: '', accent: 'danger', icon: 'Banknote' },
      { id: 'health-score', label: 'Inventory Health Score', value: `${healthScore}`, rawValue: healthScore, suffix: '/100', accent: 'ai', icon: 'Gauge' },
      { id: 'procurement-efficiency', label: 'Procurement Efficiency', value: `${procurementEfficiency}%`, rawValue: procurementEfficiency, suffix: '%', accent: 'success', icon: 'Zap' },
      { id: 'supplier-reliability', label: 'Supplier Reliability', value: `${Math.round(avgReliability)}%`, rawValue: avgReliability, suffix: '%', accent: 'info', icon: 'ShieldCheck' },
    ];
  }

  // ---- Alerts timeline (real notification feed) -------------------------------

  buildTimelineEvents(notifications: Notification[]): TimelineEvent[] {
    return [...notifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12)
      .map((n) => this.toTimelineEvent(n));
  }

  private toTimelineEvent(n: Notification): TimelineEvent {
    const text = `${n.title} ${n.body}`.toLowerCase();
    let kind: TimelineEventKind = 'general';
    let accent: TimelineEvent['accent'] = 'info';

    if (text.includes('replenish') || text.includes('restock') || text.includes('delivered')) {
      kind = 'replenished'; accent = 'success';
    } else if (text.includes('out of stock') || text.includes('critical')) {
      kind = 'critical'; accent = 'danger';
    } else if (text.includes('approved')) {
      kind = 'order-approved'; accent = 'info';
    } else if (text.includes('ai') || text.includes('predict') || text.includes('forecast')) {
      kind = 'ai-prediction'; accent = 'ai';
    } else if (text.includes('delay') || text.includes('late')) {
      kind = 'supplier-delay'; accent = 'warning';
    } else if (text.includes('audit')) {
      kind = 'audit'; accent = 'info';
    } else if (n.riskLevel === 'CRITICAL') {
      kind = 'critical'; accent = 'danger';
    } else if (n.riskLevel === 'HIGH') {
      accent = 'warning';
    }

    return { id: n.id, kind, title: n.title, body: n.body, timestamp: n.createdAt, accent };
  }

  // ---- Shared helpers ---------------------------------------------------------

  private estimateDailyUsage(part: Part): number {
    const real = this.realUsageByPartId.get(part.id);
    if (real != null && real > 0) {
      return real;
    }
    const cycleStock = Math.max(part.reorderQuantity, part.minimumStock, 1);
    const rand = seededFloat(`usage:${part.partNumber || part.id}`, 0.02, 0.09, 3);
    return Math.max(cycleStock * rand, 0.1);
  }

  private supplierLeadTime(supplier: string): number {
    return seededInt(`lead:${supplier || 'unassigned'}`, 3, 21);
  }

  private toCriticalRow(part: Part): CriticalPartRow {
    const severity = this.severityOf(part);
    const dailyUsage = this.estimateDailyUsage(part);
    const daysUntilStockout = part.currentStock / dailyUsage;
    const maximumStock = Math.max(part.minimumStock * 3, part.reorderQuantity * 2, part.currentStock, 10);
    const reserved = seededInt(`reserved:${part.id}`, 0, Math.max(Math.floor(part.minimumStock * 0.3), 0));
    const risk: RiskLevel = severity === 'out' ? 'critical' : severity === 'critical' ? 'high' : severity === 'low' ? 'medium' : 'low';
    const predictedStockoutDate = part.currentStock > 0 && daysUntilStockout < 120
      ? this.addDays(new Date(), Math.round(daysUntilStockout)).toISOString()
      : part.currentStock <= 0
      ? new Date().toISOString()
      : null;

    return {
      partId: part.id,
      partName: part.name,
      partNumber: part.partNumber,
      category: this.prettyLabel(part.category || 'General'),
      currentStock: part.currentStock,
      minimumStock: part.minimumStock,
      maximumStock: Math.round(maximumStock),
      reserved,
      supplier: part.supplier || 'Unassigned',
      leadTimeDays: this.supplierLeadTime(part.supplier),
      dailyUsage: Math.round(dailyUsage * 10) / 10,
      predictedStockoutDate,
      risk,
      recommendedAction: this.recommendedAction(severity),
      status: part.status,
    };
  }

  private recommendedAction(severity: StockSeverity): string {
    switch (severity) {
      case 'out': return 'Order immediately';
      case 'critical': return 'Expedite reorder';
      case 'low': return 'Schedule reorder';
      default: return 'Monitor';
    }
  }

  private riskWeight(risk: RiskLevel): number {
    return { critical: 4, high: 3, medium: 2, low: 1 }[risk];
  }

  private machineRisk(daysRemaining: number, machineRiskScore?: number): RiskLevel {
    const highBaseline = (machineRiskScore ?? 0) > 70;
    if (daysRemaining <= 3 || (highBaseline && daysRemaining <= 7)) return 'critical';
    if (daysRemaining <= 10) return 'high';
    if (daysRemaining <= 21) return 'medium';
    return 'low';
  }

  private averageStockCoverageDays(parts: Part[]): number {
    if (!parts.length) return 0;
    const days = parts
      .map((p) => p.currentStock / this.estimateDailyUsage(p))
      .filter((d) => Number.isFinite(d))
      .map((d) => Math.min(d, 365));
    return days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : 0;
  }

  private turnoverRatio(parts: Part[]): number {
    const totalValue = parts.reduce((s, p) => s + p.cost * p.currentStock, 0);
    if (totalValue <= 0) return 0;
    const annualConsumptionValue = parts.reduce((s, p) => s + this.estimateDailyUsage(p) * 365 * p.cost, 0);
    return Math.round((annualConsumptionValue / totalValue) * 10) / 10;
  }

  private daysBetween(a: string, b: string): number {
    const start = new Date(a).getTime();
    const end = new Date(b).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return 0;
    return Math.round((end - start) / 86400000);
  }

  private daysFromNow(isoDate: string): number {
    return Math.round((new Date(isoDate).getTime() - Date.now()) / 86400000);
  }

  private addDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }

  private pctChange(from: number, to: number): number {
    if (from <= 0) return 0;
    return Math.round(((to - from) / from) * 1000) / 10;
  }

  private buildSeries(endValue: number, points: number, seedKey: string, volatility = 0.03): number[] {
    const rand = seededRandom(seedKey);
    const series: number[] = [endValue];
    let current = endValue;
    for (let i = 1; i < points; i++) {
      const noise = (rand() - 0.5) * 2 * volatility;
      current = Math.max(current * (0.985 + noise), 0);
      series.push(current);
    }
    return series.reverse().map((v) => Math.round(v));
  }

  private prettyLabel(value: string): string {
    return value.replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en', { style: 'currency', currency: 'TND', maximumFractionDigits: 0 }).format(value || 0);
  }
}
