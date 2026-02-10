import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { Clock, AlertTriangle, CheckCircle, ClipboardList, IndianRupee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

interface RevenueChartProps {
  data: ChartData[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Revenue Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface AttendanceChartProps {
  data: ChartData[];
}

export function AttendanceChart({ data }: AttendanceChartProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Weekly Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="checkins" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface MembershipDistributionProps {
  data: ChartData[];
}

const COLORS = [
  '#7c3aed', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#3b82f6', // blue
  '#f97316', // orange
  '#8b5cf6', // purple
];

const renderCustomLegend = (props: any, total: number) => {
  const { payload } = props;
  return (
    <div className="flex flex-col gap-2 pl-4">
      {payload?.map((entry: any, index: number) => {
        const pct = total > 0 ? ((entry.payload.value / total) * 100).toFixed(0) : 0;
        return (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-foreground truncate max-w-[120px]">
              {entry.value}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
};

export function MembershipDistribution({ data }: MembershipDistributionProps) {
  const total = data?.reduce((sum, d) => sum + d.value, 0) || 0;

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-lg rounded-2xl border-0">
        <CardHeader>
          <CardTitle className="text-lg">Membership Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No active memberships
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg rounded-2xl border-0">
      <CardHeader>
        <CardTitle className="text-lg">Membership Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="35%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [`${value} members`, name]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                content={(props) => renderCustomLegend(props, total)}
              />
              {/* Center label */}
              <text
                x="35%"
                y="48%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-2xl font-bold"
              >
                {total}
              </text>
              <text
                x="35%"
                y="56%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs"
              >
                Members
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Hourly Attendance Chart
interface HourlyAttendanceChartProps {
  data: { hour: string; checkins: number }[];
}

export function HourlyAttendanceChart({ data }: HourlyAttendanceChartProps) {
  const hasData = data.some(d => d.checkins > 0);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent" />
          Today's Check-ins by Hour
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No check-ins recorded today
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" className="text-xs fill-muted-foreground" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs fill-muted-foreground" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="checkins" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Accounts Receivable Widget (replaces Revenue Snapshot)
interface AccountsReceivableWidgetProps {
  data: { id: string; memberName: string; memberCode: string; owed: number; status: string }[];
  totalOutstanding: number;
}

export function AccountsReceivableWidget({ data, totalOutstanding }: AccountsReceivableWidgetProps) {
  const navigate = useNavigate();

  return (
    <Card className="shadow-lg rounded-2xl border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-destructive" />
          Accounts Receivable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-destructive/10 rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold text-destructive">₹{totalOutstanding.toLocaleString()}</p>
        </div>
        {data.length === 0 ? (
          <div className="flex items-center gap-2 text-success text-sm py-4 justify-center">
            <CheckCircle className="h-4 w-4" />
            No pending dues
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate('/invoices')}
              >
                <div>
                  <p className="text-sm font-medium">{member.memberName}</p>
                  <p className="text-xs text-muted-foreground">{member.memberCode}</p>
                </div>
                <Badge variant={member.status === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                  ₹{member.owed.toLocaleString()}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// Expiring Members Widget
interface ExpiringMembersWidgetProps {
  data: { memberId: string; memberCode: string; memberName: string; hoursRemaining: number; planName: string }[];
}

export function ExpiringMembersWidget({ data }: ExpiringMembersWidgetProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-border/50 border-l-4 border-l-destructive">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Expiring in 48 Hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center gap-2 text-success text-sm py-4">
            <CheckCircle className="h-4 w-4" />
            No memberships expiring soon
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((member, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate('/members')}
              >
                <div>
                  <p className="text-sm font-medium">{member.memberName}</p>
                  <p className="text-xs text-muted-foreground">{member.planName}</p>
                </div>
                <Badge variant="destructive" className="text-xs">
                  {member.hoursRemaining}h left
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Pending Approvals Widget
interface PendingApprovalsWidgetProps {
  count: number;
}

export function PendingApprovalsWidget({ count }: PendingApprovalsWidgetProps) {
  const navigate = useNavigate();

  return (
    <Card 
      className="border-border/50 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate('/approvals')}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Pending Approvals</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
            <ClipboardList className="h-6 w-6 text-warning" />
          </div>
        </div>
        {count === 0 ? (
          <p className="text-xs text-success mt-2 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            All caught up!
          </p>
        ) : (
          <p className="text-xs text-warning mt-2">Click to review</p>
        )}
      </CardContent>
    </Card>
  );
}
