import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface OccupancyGaugeProps {
  currentlyIn: number;
  capacity?: number;
}

export function OccupancyGauge({ currentlyIn, capacity = 50 }: OccupancyGaugeProps) {
  const percentage = capacity > 0 ? (currentlyIn / capacity) * 100 : 0;
  const gaugeColor = percentage >= 80 ? '#f59e0b' : percentage >= 50 ? '#3b82f6' : '#10b981';

  const data = [
    { name: 'Occupied', value: currentlyIn },
    { name: 'Available', value: Math.max(capacity - currentlyIn, 0) },
  ];

  return (
    <Card className="shadow-lg rounded-2xl border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" style={{ color: gaugeColor }} />
          Live Occupancy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="75%"
                startAngle={180}
                endAngle={0}
                innerRadius={70}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={gaugeColor} />
                <Cell fill="#e5e7eb" />
              </Pie>
              <text
                x="50%"
                y="65%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-2xl font-bold"
              >
                {currentlyIn}
              </text>
              <text
                x="50%"
                y="78%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs"
              >
                of {capacity} capacity
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center mt-[-20px]">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{
              backgroundColor: `${gaugeColor}20`,
              color: gaugeColor,
            }}
          >
            {percentage.toFixed(0)}% Full
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
