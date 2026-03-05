// src/components/charts/TerminalDistributionPanel.tsx
import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TerminalDistributionPanelProps {
  mergedData: Array<{ binCenter: number; count: number; density?: number }>;
  theoreticalDist?: {
    type: 'lognormal' | 'normal';
    mu?: number;
    sigma?: number;
    mean?: number;
    std?: number;
  } | null;
  mcTerminalPrices: number[][]; // [0] unused?, [1] = base scenario terminal values
  title?: string;
  height?: number;
}

export const TerminalDistributionPanel: React.FC<TerminalDistributionPanelProps> = ({
  mergedData,
  theoreticalDist,
  mcTerminalPrices,
  title = 'FX Spot at Maturity: MC vs Theoretical Distribution (Base Scenario)',
  height = 300,
}) => {
  // Optional: if you want to compute mergedData inside instead of passing it
  // (but for reuse, better to compute once in parent and pass down)

  const hasData = theoreticalDist && mcTerminalPrices?.[1]?.length > 0;

  const explanation = () => {
    if (!theoreticalDist) return null;

    if (theoreticalDist.type === 'lognormal') {
      return (
        <>
          Under GBM (risk-neutral), the terminal FX Spot follows a <strong>lognormal distribution</strong>:
          <br />
          ln(S_T) ~ Normal(μ = ln(S₀) + (r_dom - r_for - σ²/2)T, σ√T)
          <br />
          Parameters: μ = {theoreticalDist.mu?.toFixed(4)}, σ = {theoreticalDist.sigma?.toFixed(4)}
        </>
      );
    } else {
      return (
        <>
          Under OU, the terminal FX Spot follows a <strong>normal distribution</strong>:
          <br />
          S_T ~ Normal(mean = θ + (S₀ - θ)e^(-κT), std = √[(σ²/(2κ))(1 - e^(-2κT))])
          <br />
          Parameters: mean = {theoreticalDist.mean?.toFixed(4)}, std = {theoreticalDist.std?.toFixed(4)}
        </>
      );
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-semibold mb-4 text-center">{title}</h2>

      {/* Debug count */}
      <p className="text-center text-sm text-gray-600 mb-4">
        {mcTerminalPrices[1]?.length || 0} terminal prices in base scenario
      </p>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={mergedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="binCenter"
            type="number"
            domain={['dataMin', 'dataMax']}
            padding={{ left: 30, right: 30 }}
            tickCount={10}
            tickFormatter={(value) => value.toFixed(2)}
          />

          <YAxis yAxisId="left" orientation="left" label={{ value: 'Frequency', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Density', angle: 90, position: 'insideRight' }} />

          <Bar
            yAxisId="left"
            dataKey="count"
            fill="#8884d8"
            barSize={Math.max(4, (window.innerWidth * 0.8) / (mergedData.length || 1) / 2)}
            minPointSize={2}
            isAnimationActive={false}
            name="Monte Carlo Histogram"
          />

          {hasData && (
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
        {theoreticalDist ? (
          <>
            {explanation()}
            <p className="mt-2 text-sm text-gray-600">
              The theoretical curve is the exact analytical density at maturity, serving as a benchmark to validate the simulation.
            </p>
          </>
        ) : (
          <p className="text-gray-600">No theoretical distribution available yet.</p>
        )}
      </div>
    </div>
  );
};