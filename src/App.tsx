// src/App.tsx
import React from 'react';
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface StatsPoint {
  time: number;
  mean: number;
  p5: number;
  p95: number;
  scenario: string; // "Down -20%", "Base 0%", "Up +20%"
}

function App() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5053';
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Model selection
  const [modelType, setModelType] = useState<'gbm' | 'ou'>('gbm');

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

  const runSensitivity = async () => {
    setLoading(true);
    setErrorMsg(null);
    setUnderlyingStats([]);
    setPvStats([]);

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

      for (let i = 0; i < 3; i++) {
        const factor = shiftFactors[i];
        const currentSpot = shockParam === 'spot' ? baseSpot * factor : baseSpot;
        const currentVol = shockParam === 'vol' ? baseVol * factor : baseVol;

        let url = `${API_BASE}/api/simulation/fx-forward-paths?`;
        url += `model=${modelType}&paths=200&steps=200&maturity=${maturity}`;
        url += `&r_dom=${r_dom}&r_for=${r_for}&spot=${currentSpot.toFixed(4)}`;

        if (modelType === 'gbm') {
          url += `&sigma_gbm=${currentVol.toFixed(4)}`;
        } else {
          url += `&sigma_ou=${currentVol.toFixed(4)}&kappa=${ouKappa}&theta=${ouTheta}`;
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
      }

      setUnderlyingStats(allUnderlying);
      setPvStats(allPv);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to run sensitivity');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const scenarios = ['Down', 'Base', 'Up'];
  const colors = ['#ef4444', '#3b82f6', '#10b981']; // red, blue, green

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-10 text-gray-800">
          FX Forward Sensitivity Analysis
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls panel */}
          <div className="bg-white p-6 rounded-xl shadow h-fit">
            <h2 className="text-xl font-semibold mb-6">Controls</h2>

            {/* Model */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Simulation Model
              </label>
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
                Underlying FX Spot – Sensitivity
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="time"
                    label={{ value: 'Time (years)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'FX Rate', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(v: number | undefined) => v?.toFixed(4) ?? '–'} />
                  <Legend verticalAlign="top" height={36} iconType="plainline" />

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
                PV of FX Forward – Sensitivity
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="time"
                    label={{ value: 'Time (years)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'Present Value', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(v: number | undefined) => v?.toFixed(4) ?? '–'} />
                  <Legend verticalAlign="top" height={36} iconType="plainline" />

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
                PV starts near 0 (fair forward at inception) — sensitivity shows impact of shocks
              </p>
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