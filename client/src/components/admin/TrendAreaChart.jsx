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

const TrendAreaChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={260}>
    <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
      <defs>
        <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
      <Tooltip formatter={(v) => [`${v} present`, 'Attendance']} labelStyle={{ fontSize: 12 }} />
      <Area
        type="monotone"
        dataKey="present"
        stroke="#6366f1"
        strokeWidth={2.5}
        fill="url(#presentGrad)"
      />
    </AreaChart>
  </ResponsiveContainer>
);

export default TrendAreaChart;
