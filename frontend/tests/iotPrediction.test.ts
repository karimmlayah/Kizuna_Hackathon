import test from "node:test";
import assert from "node:assert/strict";

// Deterministic prediction formula matching backend/services/iot_service.py
function calculatePrediction(
  targetKwh: number,
  currentKwh: number,
  currentDay: number,
  totalDays: number = 30
) {
  const dailyAvg = currentKwh / currentDay;
  const forecastMonthEnd = dailyAvg * totalDays;
  const forecastOverrun = Math.max(0, forecastMonthEnd - targetKwh);
  const remainingDays = totalDays - currentDay;
  const remainingAllowed = Math.max(0, targetKwh - currentKwh);
  const maxRemainingDaily = remainingDays > 0 ? remainingAllowed / remainingDays : 0;
  const consumedPct = (currentKwh / targetKwh) * 100;
  const reductionReqPct =
    dailyAvg > 0 ? Math.max(0, ((dailyAvg - maxRemainingDaily) / dailyAvg) * 100) : 0;
  const isOverrunRisk = forecastMonthEnd > targetKwh;

  return {
    monthly_target_kwh: targetKwh,
    current_consumption_kwh: currentKwh,
    current_day: currentDay,
    total_days_in_month: totalDays,
    remaining_days: remainingDays,
    consumed_pct: Number(consumedPct.toFixed(1)),
    daily_avg_kwh: Number(dailyAvg.toFixed(2)),
    forecast_month_end_kwh: Number(forecastMonthEnd.toFixed(1)),
    forecast_overrun_kwh: Number(forecastOverrun.toFixed(1)),
    remaining_allowed_kwh: Number(remainingAllowed.toFixed(1)),
    max_remaining_daily_kwh: Number(maxRemainingDaily.toFixed(2)),
    reduction_req_pct: Number(reductionReqPct.toFixed(1)),
    is_overrun_risk: isOverrunRisk,
  };
}

test("Deterministic Prediction Engine: Mandatory Reference Test Case (1200 / 900 / 15 / 30)", () => {
  const res = calculatePrediction(1200, 900, 15, 30);

  assert.equal(res.monthly_target_kwh, 1200);
  assert.equal(res.current_consumption_kwh, 900);
  assert.equal(res.current_day, 15);
  assert.equal(res.total_days_in_month, 30);
  assert.equal(res.remaining_days, 15);
  assert.equal(res.consumed_pct, 75.0);
  assert.equal(res.daily_avg_kwh, 60.0);
  assert.equal(res.forecast_month_end_kwh, 1800.0);
  assert.equal(res.forecast_overrun_kwh, 600.0);
  assert.equal(res.remaining_allowed_kwh, 300.0);
  assert.equal(res.max_remaining_daily_kwh, 20.0);
  assert.equal(res.reduction_req_pct, 66.7);
  assert.equal(res.is_overrun_risk, true);
});

test("Deterministic Prediction Engine: On-Track Scenario (1200 / 400 / 15 / 30)", () => {
  const res = calculatePrediction(1200, 400, 15, 30);

  assert.equal(res.forecast_month_end_kwh, 800.0);
  assert.equal(res.forecast_overrun_kwh, 0.0);
  assert.equal(res.is_overrun_risk, false);
  assert.equal(res.reduction_req_pct, 0.0);
});
