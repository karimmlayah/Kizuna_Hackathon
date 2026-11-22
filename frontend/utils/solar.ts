export function sizeSolar(annual: number, area: number, watts: number) {
  const safeWatts = Math.max(100, Number.isFinite(watts) ? watts : 450);
  const desired = Math.ceil(Math.max(0, annual) / 1650 / (safeWatts / 1000));
  const panels = Math.min(desired, Math.floor(Math.max(0, area) / 2.2));
  const kwp = (panels * safeWatts) / 1000;
  return {
    panels,
    kwp,
    production: kwp * 1650,
    area: panels * 2.2,
    limited: panels < desired,
  };
}
export function finance(
  kwp: number,
  consumption: number,
  tariff: number,
  unitCost: number,
  selfUse: number,
) {
  const production = kwp * 1650,
    cost = kwp * unitCost;
  const annual = Math.min(production * selfUse, consumption) * tariff;
  const maintenance = cost * 0.01;
  const points = Array.from({ length: 26 }, (_, year) => ({
    year,
    value:
      -cost +
      Array.from(
        { length: year },
        (_, i) => annual * Math.pow(0.995, i) - maintenance,
      ).reduce((a, b) => a + b, 0),
  }));
  return {
    cost,
    annual,
    maintenance,
    payback: annual > maintenance ? cost / (annual - maintenance) : null,
    points,
    carbon: (production * 0.45) / 1000,
  };
}
