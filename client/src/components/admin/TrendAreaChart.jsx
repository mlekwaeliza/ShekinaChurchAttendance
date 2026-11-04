import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Brand teal for the series; grid and axis colors are themed centrally in
// index.css (see the recharts overrides at the bottom of the utilities layer).
const TrendAreaChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={260}>
    <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
      <defs>
        <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14a896" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#14a896" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#c7c7cc" strokeOpacity={0.6} />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 11, fill: '#8e8e93' }}
        tickLine={false}
        axisLine={false}
      />
      <YAxis
        tick={{ fontSize: 11, fill: '#8e8e93' }}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
      />
      <Tooltip
        formatter={(v) => [`${v} present`, 'Attendance']}
        labelStyle={{ fontSize: 12, fontWeight: 600 }}
        contentStyle={{
          borderRadius: 10,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 8px 28px rgba(16,24,40,0.12)',
          fontSize: 12
        }}
      />
      <Area
        type="monotone"
        dataKey="present"
        stroke="#14a896"
        strokeWidth={2}
        fill="url(#presentGrad)"
      />
    </AreaChart>
  </ResponsiveContainer>
);

export default TrendAreaChart;
