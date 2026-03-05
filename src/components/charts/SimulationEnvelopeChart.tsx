// src/components/charts/SimulationEnvelopeChart.tsx
import React from 'react';
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

interface TimeSeriesPoint {
  time: number;
  mean: number;
  p5: number;
  p95: number;
  scenario?: string; // optional, used for filtering if needed
}

interface SimulationEnvelopeChartProps {
  data: TimeSeriesPoint[]; // full array with all scenarios
  scenarios: string[];     // e.g. ['Base', '+10% Spot', '-10% Spot']
  colors: string[];        // matching length to scenarios, e.g. ['#8884d8', '#82ca9d', '#ffc658']
  title: string;
  yAxisLabel: string;
  caption?: string;        // dynamic text below chart
  height?: number;
  valueFormatter?: (value: number | undefined) => string;
}

export const SimulationEnvelopeChart: React.FC<SimulationEnvelopeChartProps> = ({
  data,
  scenarios,
  colors,
  title,
  yAxisLabel,
  caption,
  height = 450,
  valueFormatter = (v) => (v !== undefined ? v.toFixed(4) : '—'),
}) => {
  if (!data?.length || !scenarios.length) {
    return <div className="text-center text-gray-500 py-10">Chart will appear here</div>;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-semibold mb-4 text-center">{title}</h2>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="time"
            label={{ value: 'Time (years)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            tickFormatter={valueFormatter}
          />
          <Legend
            verticalAlign="top"
            height={70}
            iconType="plainline"
            wrapperStyle={{ paddingTop: 0, paddingBottom: 10 }}
          />
          <Tooltip formatter={valueFormatter} />

          {scenarios.map((label, i) => {
            const color = colors[i] || '#8884d8'; // fallback
            const filteredData = data.filter((d) => d.scenario === label);

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
                  // Remove connectNulls unless you really need it – avoids weird diagonals
                  // connectNulls
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

      {caption && (
        <p className="text-center text-sm text-gray-500 mt-3">{caption}</p>
      )}
    </div>
  );
};