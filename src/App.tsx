// src/App.tsx
import React, { useEffect, useMemo } from 'react';
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
} from 'recharts';

interface StatsPoint {
  time: number;
  mean: number;
  p5: number;
  p95: number;
  scenario: string; // "Down -20%", "Base 0%", "Up +20%"
}


// Helper to generate smooth theoretical density points for plotting
const generateDensityCurve = (
  dist: { type: 'lognormal' | 'normal'; mu?: number; sigma?: number; mean?: number; std?: number },
  prices: number[],
  numPoints = 200
) => {
  if (!dist) return [];

  const min = Math.min(...prices) * 0.8;
  const max = Math.max(...prices) * 1.2;
  const step = (max - min) / numPoints;
  const points = [];

  for (let x = min; x <= max; x += step) {
    let density = 0;
    if (dist.type === 'lognormal' && dist.mu !== undefined && dist.sigma !== undefined) {
      if (x <= 0) continue; // lognormal undefined for x <= 0
      const logX = Math.log(x);
      density =
        (1 / (dist.sigma * x * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * Math.pow((logX - dist.mu) / dist.sigma, 2));
    } else if (dist.type === 'normal' && dist.mean !== undefined && dist.std !== undefined) {
      density =
        (1 / (dist.std * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * Math.pow((x - dist.mean) / dist.std, 2));
    }
    points.push({ x, density });
  }
  return points;
};

const binTerminalPrices = (prices: number[], numBins = 30) => {
  if (prices.length === 0) return [];

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const binWidth = (max - min) / numBins;
  const bins = new Array(numBins).fill(0);

  prices.forEach(price => {
    let binIndex = Math.floor((price - min) / binWidth);
    binIndex = Math.min(binIndex, numBins - 1); // clamp
    bins[binIndex]++;
  });

  return bins.map((count, i) => ({
    binCenter: min + (i + 0.5) * binWidth,
    count,
  }));
};

function App() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5053';
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Model selection
  const [modelType, setModelType] = useState<'gbm' | 'ou'>('gbm');

  //FX Forward parameters
  const [strike, setStrike] = useState(1.10);           // K – fixed forward rate
  const [notional, setNotional] = useState(1000000);    // amount in foreign currency
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');  // buy = receive foreign, sell = receive domestic

  // Shared parameters
  const [maturity, setMaturity] = useState(1.0);
  const [r_dom, setR_dom] = useState(0.03);
  const [r_for, setR_for] = useState(0.01);

  // GBM-specific defaults
  const [gbmSpot, setGbmSpot] = useState(1.10);
  const [gbmSigma, setGbmSigma] = useState(0.15);
  const [gbmMu, setGbmMu] = useState(0.05);

  // OU-specific defaults
  const [ouSpot, setOuSpot] = useState(1.10);
  const [ouKappa, setOuKappa] = useState(3.0);
  const [ouTheta, setOuTheta] = useState(1.10);
  const [ouSigma, setOuSigma] = useState(0.12);

  // Sensitivity controls
  const [shockParam, setShockParam] = useState<'spot' | 'vol'>('spot');
  const [shiftPct, setShiftPct] = useState<10 | 20 | 50>(20);

  // Chart data – now arrays of StatsPoint with scenario field
  const [underlyingStats, setUnderlyingStats] = useState<StatsPoint[]>([]);
  const [pvStats, setPvStats] = useState<StatsPoint[]>([]);

  // Simulated distribution  
  const [mcTerminalPrices, setMcTerminalPrices] = useState<number[][]>([]); // [scenario][path] at maturity
  const [theoreticalDist, setTheoreticalDist] = useState<any>(null); // { type: 'lognormal' or 'normal', mu, sigma }

  const binnedData = useMemo(
    () => binTerminalPrices(mcTerminalPrices[1] || [], 30),
    [mcTerminalPrices]
  );

  const runSensitivity = async () => {
    setLoading(true);
    setErrorMsg(null);
    setUnderlyingStats([]);
    setPvStats([]);
    setMcTerminalPrices([]);
    setTheoreticalDist(null);

    try {
      const baseSpot = modelType === 'gbm' ? gbmSpot : ouSpot;
      const baseVol = modelType === 'gbm' ? gbmSigma : ouSigma;

      const shiftFactors = [
        1 - shiftPct / 100,
        1,
        1 + shiftPct / 100,
      ];

      const scenarioLabels = [
        `Down -${shiftPct}%`,
        'Base 0%',
        `Up +${shiftPct}%`,
      ];

      const allUnderlying: StatsPoint[] = [];
      const allPv: StatsPoint[] = [];
      const terminalPricesPerScenario = [];

      for (let i = 0; i < 3; i++) {
        const factor = shiftFactors[i];
        const currentSpot = shockParam === 'spot' ? baseSpot * factor : baseSpot;
        const currentVol = shockParam === 'vol' ? baseVol * factor : baseVol;

        let url = `${API_BASE}/api/simulation/fx-forward-paths?`;
        url += `model=${modelType}&paths=200&steps=200&maturity=${maturity}`;
        url += `&r_dom=${r_dom}&r_for=${r_for}&spot=${currentSpot.toFixed(6)}`;
        url += `&strike=${strike.toFixed(6)}&notional=${notional}&direction=${direction}`;

        if (modelType === 'gbm') {
          url += `&sigma_gbm=${currentVol.toFixed(6)}`;
        } else {
          url += `&sigma_ou=${currentVol.toFixed(6)}&kappa=${ouKappa}&theta=${ouTheta}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Scenario ${scenarioLabels[i]} failed: ${res.status}`);

        const data = await res.json();

        // Tag each stats point with scenario
        const underlyingTagged = data.underlyingStats.map((p: any) => ({
          ...p,
          scenario: scenarioLabels[i],
        }));

        const pvTagged = data.pvStats.map((p: any) => ({
          ...p,
          scenario: scenarioLabels[i],
        }));

        allUnderlying.push(...underlyingTagged);
        allPv.push(...pvTagged);

        const scenarioData = data; // from Promise.all fetch
        const terminal = scenarioData.underlyingPaths.map((path: any) => path[path.length - 1]);
        terminalPricesPerScenario.push(terminal);
      }

      setUnderlyingStats(allUnderlying);
      setPvStats(allPv);
      setMcTerminalPrices(terminalPricesPerScenario);

      // Compute theoretical params (for base case only – or per scenario if you want)
      const riskNeutralDrift = r_dom - r_for;

      let theo;
      if (modelType === 'gbm') {
        // Lognormal: ln(S_T) ~ Normal(mu = ln(S0) + (r-q - σ²/2)T, σ√T)
        const mu = Math.log(baseSpot) + (riskNeutralDrift - 0.5 * baseVol ** 2) * maturity;
        const sigma = baseVol * Math.sqrt(maturity);
        theo = { type: 'lognormal', mu, sigma };
      } else {
        // OU: Normal(mean = θ + (S0 - θ)e^(-κT), variance = (σ²/(2κ))(1 - e^(-2κT)))
        const expDecay = Math.exp(-ouKappa * maturity);
        const mean = ouTheta + (baseSpot - ouTheta) * expDecay;
        const variance = (ouSigma ** 2 / (2 * ouKappa)) * (1 - Math.exp(-2 * ouKappa * maturity));
        theo = { type: 'normal', mean, std: Math.sqrt(variance) };
      }
      setTheoreticalDist(theo);

      console.log('base scenario terminal prices:', mcTerminalPrices?.[1]);
      console.log('formatted data for bars:', mcTerminalPrices?.[1]?.map(price => ({ value: price })) || []);
      console.log('binnedData:', binTerminalPrices(mcTerminalPrices[1] || [], 30));
      console.log('density curve points:', generateDensityCurve(theoreticalDist, mcTerminalPrices[1]) || []);

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to run sensitivity');
      console.error(err);
    } finally {
      setLoading(false);
    }

    

  };

  const scenarios = ['Down', 'Base', 'Up'];
  const colors = ['#ef4444', '#3b82f6', '#10b981']; // red, blue, green

  const densityData = useMemo(() => {
    if (!theoreticalDist) return [];
    if (!mcTerminalPrices || !Array.isArray(mcTerminalPrices[1]) || mcTerminalPrices[1].length === 0) {
      return [];
    }

    return generateDensityCurve(theoreticalDist, mcTerminalPrices[1]);
  }, [theoreticalDist, mcTerminalPrices]);


  const mergedData = binnedData.map(bin => {
    // Find closest density point or interpolate if needed
    const closestDensity = densityData.reduce((prev, curr) =>
      Math.abs(curr.x - bin.binCenter) < Math.abs(prev.x - bin.binCenter) ? curr : prev
    );
    return {
      binCenter: bin.binCenter,
      count: bin.count,
      density: closestDensity?.density ?? 0,  
    };
  });


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-10 text-gray-800">
          FX Forward Exposure
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls panel */}
          <div className="bg-white p-6 rounded-xl shadow h-fit">

            {/* FX Forward contract */}
            <div className="mb-6 space-y-4">
              <h3 className="text-lg font-medium">FX Forward Contract</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strike (fixed rate at maturity)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={strike}
                  onChange={(e) => setStrike(Number(e.target.value))}
                  className="w-full border rounded p-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notional (foreign currency amount)
                </label>
                <input
                  type="text"
                  value={notional.toLocaleString('en-US')}  // adds commas: 1000000 → "1,000,000"
                  onChange={(e) => {
                    // Remove commas and non-digits, convert to number
                    const rawValue = e.target.value.replace(/[^0-9]/g, '');
                    const newNotional = rawValue === '' ? 0 : Number(rawValue);
                    setNotional(newNotional);
                  }}
                  placeholder="1,000,000"
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Direction
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="direction"
                      value="buy"
                      checked={direction === 'buy'}
                      onChange={() => setDirection('buy')}
                      className="mr-2"
                    />
                    Buy foreign
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="direction"
                      value="sell"
                      checked={direction === 'sell'}
                      onChange={() => setDirection('sell')}
                      className="mr-2"
                    />
                    Sell foreign
                  </label>
                </div>
              </div>
            </div>

            {/* Shared parameters */}
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maturity (years)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={maturity}
                  onChange={(e) => setMaturity(Number(e.target.value))}
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domestic rate (r_dom)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={r_dom}
                  onChange={(e) => setR_dom(Number(e.target.value))}
                  className="w-full border rounded p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Foreign rate (r_for)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={r_for}
                  onChange={(e) => setR_for(Number(e.target.value))}
                  className="w-full border rounded p-2"
                />
              </div>
            </div>

            {/* Model */}
            <div className="mb-6">
              <h3 className="text-lg font-medium">Simulation Model for FX spot</h3>
              <select
                value={modelType}
                onChange={(e) => setModelType(e.target.value as 'gbm' | 'ou')}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="gbm">Geometric Brownian Motion</option>
                <option value="ou">Ornstein-Uhlenbeck</option>
              </select>
            </div>

            {/* ShockParam */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parameter to shock
              </label>
              <div className="flex gap-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="shockParam"
                    value="spot"
                    checked={shockParam === 'spot'}
                    onChange={() => setShockParam('spot')}
                    className="mr-2"
                  />
                  Spot price
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="shockParam"
                    value="vol"
                    checked={shockParam === 'vol'}
                    onChange={() => setShockParam('vol')}
                    className="mr-2"
                  />
                  Volatility
                </label>
              </div>
            </div>

            {/* Model-specific parameters */}
            {modelType === 'gbm' ? (
              <div className="mb-6 space-y-4">
                <h3 className="text-lg font-medium">GBM Parameters</h3>
                <div>
                  <label className="block text-sm mb-1">Initial spot</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gbmSpot}
                    onChange={(e) => setGbmSpot(Number(e.target.value))}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Volatility (σ)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gbmSigma}
                    onChange={(e) => setGbmSigma(Number(e.target.value))}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Drift (μ)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gbmMu}
                    onChange={(e) => setGbmMu(Number(e.target.value))}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>
            ) : (
              <div className="mb-6 space-y-4">
                <h3 className="text-lg font-medium">OU Parameters</h3>
                <div>
                  <label className="block text-sm mb-1">Initial spot</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ouSpot}
                    onChange={(e) => setOuSpot(Number(e.target.value))}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Kappa (reversion speed)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ouKappa}
                    onChange={(e) => setOuKappa(Number(e.target.value))}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Theta (long-term mean)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ouTheta}
                    onChange={(e) => setOuTheta(Number(e.target.value))}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Sigma (volatility)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ouSigma}
                    onChange={(e) => setOuSigma(Number(e.target.value))}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>
            )}

            {/* Shift size */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Symmetric percentage shift</label>
              <div className="flex gap-6">
                {[10, 20, 50].map((pct) => (
                  <label key={pct} className="flex items-center">
                    <input
                      type="radio"
                      name="shiftPct"
                      value={pct}
                      checked={shiftPct === pct}
                      onChange={() => setShiftPct(pct as 10 | 20 | 50)}
                      className="mr-2"
                    />
                    ±{pct}%
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={runSensitivity}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Running…' : 'Run Sensitivity'}
            </button>

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Charts area */}
          <div className="lg:col-span-2 space-y-10">
            {/* Underlying FX Spot Chart */}
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-semibold mb-4 text-center">
                Underlying FX Spot
              </h2>
              <ResponsiveContainer width="100%" height={450}>
                <LineChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="time"
                    label={{ value: 'Time (years)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'FX Rate', angle: -90, position: 'insideLeft' }} />
                  <Legend verticalAlign="top" height={70} iconType="plainline" />
                  

                  {scenarios.map((label, i) => {
                    const color = colors[i];
                    const filteredData = underlyingStats.filter((d) => d.scenario.includes(label));

                    return (
                      <React.Fragment key={label}>
                        <Line
                          type="monotone"
                          data={filteredData}
                          dataKey="mean"
                          name={`Mean ${label}`}
                          stroke={color}
                          strokeWidth={2.5}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          data={filteredData}
                          dataKey="p95"
                          name={`95th ${label}`}
                          stroke={color}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          data={filteredData}
                          dataKey="p5"
                          name={`5th ${label}`}
                          stroke={color}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                      </React.Fragment>
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* PV Chart */}
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-semibold mb-4 text-center">
                PV of FX Forward
              </h2>
              <ResponsiveContainer width="100%" height={450}>
                <LineChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="time"
                    label={{ value: 'Time (years)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'Present Value', angle: -90, position: 'insideLeft' }} />
                  <Legend verticalAlign="top" height={70} iconType="plainline" />

                  {scenarios.map((label, i) => {
                    const color = colors[i];
                    const filteredData = pvStats.filter((d) => d.scenario.includes(label));

                    return (
                      <React.Fragment key={label}>
                        <Line
                          type="monotone"
                          data={filteredData}
                          dataKey="mean"
                          name={`Mean ${label}`}
                          stroke={color}
                          strokeWidth={2.5}
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          data={filteredData}
                          dataKey="p95"
                          name={`95th ${label}`}
                          stroke={color}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          data={filteredData}
                          dataKey="p5"
                          name={`5th ${label}`}
                          stroke={color}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                      </React.Fragment>
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
              <p className="text-center text-sm text-gray-500 mt-3">
                Plots show the impact of the selected shock applied to{' '}
                <span className="font-medium">
                  {shockParam === 'spot' ? 'initial FX Spot' : 'volatility'}
                </span>
              </p>
            </div>

            {/* Comparison of realised and theoretical distributions */}
            <div className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-semibold mb-4 text-center">
                FX Spot at Maturity: MC vs Theoretical Distribution (Base Scenario)
              </h2>

              {/* Debug count */}
              <p className="text-center text-sm text-gray-600 mb-4">
                {mcTerminalPrices[1]?.length || 0} terminal prices in base scenario
              </p>

              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={mergedData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="binCenter"
                    type="number"
                    // Remove scale="band" — let it be continuous numeric
                    domain={['dataMin', 'dataMax']}           // Ensures full range coverage
                    padding={{ left: 30, right: 30 }}          // ← Key: Adds space on edges so first/last bars aren't cut off + gives room for all bars
                    tickCount={10}                             // Optional: nicer tick spacing
                    // tickFormatter={(val) => val.toFixed(2)} // Optional: clean up labels if too many decimals
                  />

                  <YAxis yAxisId="left" orientation="left" label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Density', angle: 90, position: 'insideRight' }} />

                  <Bar
                    yAxisId="left"
                    dataKey="count"
                    fill="#8884d8"
                    barSize={Math.max(4, (window.innerWidth * 0.8) / mergedData.length / 2)}  // Dynamic: ~half the available slot per bin
                    // or fixed: barSize={12}  // Start with 8–20 px, adjust based on bin count (30 bins → ~10–15 px good)
                    minPointSize={2}           // Ensures tiny counts (e.g. 1–2) are still visible
                    isAnimationActive={false}
                  />

                  {/* Your Line remains the same */}
                  {theoreticalDist && mcTerminalPrices?.[1]?.length > 0 && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="density"
                      name="Theoretical Density"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="5 5"
                      isAnimationActive={false}
                    />
                  )}

                  <Tooltip />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Text panel */}
              <div className="mt-6 p-4 bg-gray-50 border rounded-lg">
                <h3 className="text-lg font-medium mb-2">Theoretical Distribution at Maturity (Base Case)</h3>
                {theoreticalDist && (
                  <>
                    {theoreticalDist.type === 'lognormal' ? (
                      <p>
                        Under GBM (risk-neutral), the terminal FX Spot follows a <strong>lognormal distribution</strong>:
                        <br />
                        ln(S_T) ~ Normal(μ = ln(S₀) + (r_dom - r_for - σ²/2)T, σ√T)
                        <br />
                        Parameters: μ = {theoreticalDist.mu?.toFixed(4)}, σ = {theoreticalDist.sigma?.toFixed(4)}
                      </p>
                    ) : (
                      <p>
                        Under OU, the terminal FX Spot follows a <strong>normal distribution</strong>:
                        <br />
                        S_T ~ Normal(mean = θ + (S₀ - θ)e^(-κT), std = √[(σ²/(2κ))(1 - e^(-2κT))])
                        <br />
                        Parameters: mean = {theoreticalDist.mean?.toFixed(4)}, std = {theoreticalDist.std?.toFixed(4)}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-gray-600">
                      The MC paths are simulated under the risk-neutral measure. The theoretical curve is the exact analytical density at maturity, serving as a benchmark to validate the simulation.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

//const scenarios = ['Down', 'Base', 'Up'];
//const colors = ['#ef4444', '#3b82f6', '#10b981'];

export default App;