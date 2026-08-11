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

// Port of Dexed EnvDisplay::paint() geometry from DXComponents.cpp.
export const dx7EnvelopeGeometry = (rates: number[], levels: number[], width: number, height: number): EnvelopePoint[] => {
  const d = [duration(rates[0], levels[3], levels[0]), duration(rates[1], levels[0], levels[1]),
    duration(rates[2], levels[1], levels[2]), duration(rates[3], levels[2], levels[3])];
  const attackDecay = d[0] + d[1] + d[2];
  const keyoff = attackDecay + 10;
  const scale = width / (keyoff + d[3]);
  const y = (level: number) => height - (height / 99) * clampIndex(level);
  return [
    { x: 0, y: y(levels[3]) },
    { x: d[0] * scale, y: y(levels[0]) },
    { x: (d[0] + d[1]) * scale, y: y(levels[1]) },
    { x: attackDecay * scale, y: y(levels[2]) },
    { x: keyoff * scale, y: y(levels[2]) },
    { x: Math.min(width, (attackDecay + keyoff + d[3]) * scale), y: y(levels[3]) },
  ];
};

export const dx7EnvelopePoints = (rates: number[], levels: number[], width: number, height: number) =>
  dx7EnvelopeGeometry(rates, levels, width, height).map(point => `${point.x},${point.y}`).join(' ');
