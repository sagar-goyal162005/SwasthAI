'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const data = [
  { day: 'Mon', score: 10 },
  { day: 'Tue', score: 12 },
  { day: 'Wed', score: 9 },
  { day: 'Thu', score: 14 },
  { day: 'Fri', score: 13 },
];

export function ChallengesChart() {
  return (
    <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5">
      <h2 className="text-lg font-medium mb-4 text-[var(--text-primary)]">Your Challenges</h2>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <XAxis dataKey="day" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--card-bg)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              color: 'var(--text-primary)',
            }}
          />
          <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
