const RISE_DURATION = [
  38,34.96,31.92,28.88,25.84,22.8,20.64,18.48,16.32,14.16,12,11.1,10.2,9.3,8.4,7.5,6.96,6.42,5.88,5.34,
  4.8,4.38,3.96,3.54,3.12,2.7,2.52,2.34,2.16,1.98,1.8,1.7,1.6,1.5,1.4,1.3,1.22962,1.15925,1.08887,1.0185,
  .94813,.87775,.80737,.737,.69633,.65567,.615,.57833,.54167,.505,.473,.441,.409,.37967,.35033,.321,.28083,.24067,.2005,.16033,
  .12017,.08,.07583,.07167,.0675,.06333,.05917,.055,.0435,.032,.02933,.02667,.024,.022,.02,.018,.01667,.01533,.014,.013,
  .012,.011,.01,.009,.008,.008,.008,.008,.00767,.00733,.007,.00633,.00567,.005,.00433,.00367,.003,.003,.003,.003,
];
const DECAY_DURATION = [
  318,283.75,249.5,215.25,181,167.8,154.60001,141.39999,128.2,115,104.6,94.2,83.8,73.4,63,58.34,53.68,49.02,44.36,39.7,
  35.76,31.82,27.88,23.94,20,18.24,16.48,14.72,12.96,11.2,10.36,9.52,8.68,7.84,7,6.8325,6.665,6.4975,6.33,6.1625,
  5.995,5.8275,5.66,5.1,4.54,3.98,3.64833,3.31667,2.985,2.65333,2.32167,1.99,1.77333,1.55667,1.34,1.22333,1.10667,.99,.89667,.80333,
  .71,.65,.59,.53,.47,.41,.32333,.23667,.15,.127,.104,.081,.07667,.07233,.068,.061,.054,.047,.04367,.04033,
  .037,.033,.029,.025,.02333,.02167,.02,.01767,.01533,.013,.01133,.00967,.008,.008,.008,.008,.008,.008,.008,.008,
];
const LEVEL_PERCENT = [
  .00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,
  .00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00001,.00501,.01001,.015,.02,.028,.036,.044,.052,
  .06,.068,.076,.084,.092,.1,.108,.116,.124,.132,.14,.15,.16,.17,.18,.19,.2,.21,.22,.23,
  .24,.251,.262,.273,.284,.295,.306,.317,.328,.339,.35,.365,.38,.395,.41,.425,.44,.455,.47,.485,
  .5,.52,.54,.56,.58,.6,.62,.64,.66,.68,.7,.732,.764,.796,.828,.86,.895,.93,.965,1,
];

export interface EnvelopePoint { x: number; y: number }

const clampIndex = (value: number) => Math.max(0, Math.min(99, Math.round(value)));
const duration = (rate: number, fromLevel: number, toLevel: number) => {
  const from = clampIndex(fromLevel), to = clampIndex(toLevel);
  const table = to > from ? RISE_DURATION : DECAY_DURATION;
  return table[clampIndex(rate)] * Math.abs(LEVEL_PERCENT[to] - LEVEL_PERCENT[from]);
};

/** Display hold after L3. DX7 has no sustain time; level stays until key off. */
const SUSTAIN_TIME = 10;
/** Fixed time window for the graph. Scale never depends on the current rates. */
const VIEW_TIME = 32;

export const dx7EnvelopeGeometry = (
  rates: number[],
  levels: number[],
  width: number,
  height: number,
  padding = 8,
): EnvelopePoint[] => {
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const d = [duration(rates[0], levels[3], levels[0]), duration(rates[1], levels[0], levels[1]),
    duration(rates[2], levels[1], levels[2]), duration(rates[3], levels[2], levels[3])];
  const scale = innerWidth / VIEW_TIME;
  const times = [0, d[0], d[0] + d[1], d[0] + d[1] + d[2], d[0] + d[1] + d[2] + SUSTAIN_TIME];
  times.push(times[4] + d[3]);
  const vertexLevels = [levels[3], levels[0], levels[1], levels[2], levels[2], levels[3]];
  const yAt = (level: number) => padding + innerHeight - (innerHeight / 99) * clampIndex(level);
  const xAt = (time: number) => padding + time * scale;
  const points: EnvelopePoint[] = [{ x: xAt(0), y: yAt(vertexLevels[0]) }];
  for (let index = 0; index < 5; index += 1) {
    const start = times[index];
    const end = times[index + 1];
    const from = vertexLevels[index];
    const to = vertexLevels[index + 1];
    if (start >= VIEW_TIME) break;
    if (end <= VIEW_TIME) {
      points.push({ x: xAt(end), y: yAt(to) });
      continue;
    }
    const u = (VIEW_TIME - start) / Math.max(end - start, 1e-9);
    points.push({ x: padding + innerWidth, y: yAt(from + (to - from) * u) });
    break;
  }
  while (points.length < 6) points.push(points[points.length - 1]);
  return points;
};

export const dx7EnvelopePoints = (rates: number[], levels: number[], width: number, height: number, padding = 8) =>
  dx7EnvelopeGeometry(rates, levels, width, height, padding).map(point => `${point.x},${point.y}`).join(' ');

export const dx7EnvelopeMarks = (
  rates: number[],
  levels: number[],
  width: number,
  height: number,
  padding = 8,
) => {
  const points = dx7EnvelopeGeometry(rates, levels, width, height, padding);
  const innerHeight = Math.max(1, height - padding * 2);
  const yAt = (level: number) => padding + innerHeight - (innerHeight / 99) * clampIndex(level);
  const levelMarks = [0, 1, 2, 3].map(index => ({
    label: `L${index + 1}`,
    y: yAt(levels[index] ?? 0),
    labelY: yAt(levels[index] ?? 0),
  }));
  const placed = [...levelMarks].sort((a, b) => a.y - b.y);
  let lastY = -Infinity;
  for (const mark of placed) {
    mark.labelY = Math.max(mark.y, lastY + 10);
    lastY = mark.labelY;
  }
  const ratePairs = [[0, 1], [1, 2], [2, 3], [4, 5]] as const;
  const rateMarks = ratePairs.map(([fromIndex, toIndex], index) => {
    const from = points[fromIndex];
    const to = points[toIndex];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    let nx = 0;
    let ny = -1;
    let angle = 0;
    if (len > 0.5) {
      nx = -dy / len;
      ny = dx / len;
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
    }
    return {
      label: `R${index + 1}`,
      x: Math.min(width - 12, Math.max(12, (from.x + to.x) / 2 + nx * 10)),
      y: Math.min(height - 8, Math.max(8, (from.y + to.y) / 2 + ny * 10)),
      angle,
    };
  });
  return { points, levelMarks: placed, rateMarks };
};
