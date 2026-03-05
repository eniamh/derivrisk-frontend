// src/pages/RateSimulationComparison.tsx
import React, { useState } from 'react';
// Import your shared chart components later
// import SimulationEnvelopeChart from '../components/SimulationEnvelopeChart';
// import TerminalDistributionPanel from '../components/TerminalDistributionPanel';

const RateSimulationComparison: React.FC = () => {
  const [model, setModel] = useState<'vasicek' | 'hullwhite' | 'cir' | 'blackkarasinski'>('vasicek');
  const [r0, setR0] = useState(0.03);
  const [kappa, setKappa] = useState(0.5);
  const [theta, setTheta] = useState(0.04);
  const [sigma, setSigma] = useState(0.02);
  const [maturity, setMaturity] = useState(5);
  const [numPaths, setNumPaths] = useState(10000);

  // TODO: Add fetch to backend /api/simulation/short-rate-paths
  // Use useEffect or a button handler to run simulation
  // Store results in state: rateStats, terminalRates, etc.

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Short-Rate Model Comparison</h1>

      {/* Parameter Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Model */}
        <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <select
            value={model}
            onChange={(e) => setModel(e.target.value as typeof model)}
            className="w-full p-2 border rounded"
            >
            <option value="vasicek">Vasicek</option>
            <option value="hullwhite">Hull-White</option>
            <option value="cir">CIR</option>
            <option value="blackkarasinski">Black-Karasinski</option>
            </select>
        </div>

        {/* Initial rate */}
        <div>
            <label className="block text-sm font-medium mb-1">Initial Rate r₀</label>
            <input
            type="number"
            step="0.001"
            value={r0}
            onChange={(e) => setR0(Number(e.target.value))}
            className="w-full p-2 border rounded"
            />
        </div>

        {/* Mean reversion speed */}
        <div>
            <label className="block text-sm font-medium mb-1">Mean Reversion κ</label>
            <input
            type="number"
            step="0.01"
            value={kappa}
            onChange={(e) => setKappa(Number(e.target.value))}
            className="w-full p-2 border rounded"
            />
        </div>

        {/* Long-term mean */}
        <div>
            <label className="block text-sm font-medium mb-1">Long-term Mean θ</label>
            <input
            type="number"
            step="0.001"
            value={theta}
            onChange={(e) => setTheta(Number(e.target.value))}
            className="w-full p-2 border rounded"
            />
        </div>

        {/* Volatility */}
        <div>
            <label className="block text-sm font-medium mb-1">Volatility σ</label>
            <input
            type="number"
            step="0.001"
            value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))}
            className="w-full p-2 border rounded"
            />
        </div>

        {/* Maturity */}
        <div>
            <label className="block text-sm font-medium mb-1">Maturity (years)</label>
            <input
            type="number"
            step="0.1"
            value={maturity}
            onChange={(e) => setMaturity(Number(e.target.value))}
            className="w-full p-2 border rounded"
            />
        </div>

        {/* Number of paths */}
        <div>
            <label className="block text-sm font-medium mb-1">Number of Paths</label>
            <input
            type="number"
            step="1000"
            min="1000"
            value={numPaths}
            onChange={(e) => setNumPaths(Number(e.target.value))}
            className="w-full p-2 border rounded"
            />
        </div>
      </div>

      <button
        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 mb-8"
        // onClick={handleRunSimulation}
      >
        Run Simulation
      </button>

      {/* Placeholder for charts */}
      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Short Rate Envelope</h2>
          {/* <SimulationEnvelopeChart data={rateStats} /> */}
          <p className="text-gray-500">Chart coming soon...</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Terminal Distribution</h2>
          {/* <TerminalDistributionPanel terminalData={terminalRates} model={model} /> */}
          <p className="text-gray-500">Histogram + density coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default RateSimulationComparison;