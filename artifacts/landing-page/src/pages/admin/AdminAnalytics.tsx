import { useState, useEffect, useCallback } from "react";
import { fetchAnalytics, type AnalyticsData } from "@/lib/adminApi";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Legend,
} from "recharts";
import { RefreshCw, TrendingUp, MapPin, Clock, Globe, Eye, AlertCircle, ArrowUpRight, ShoppingCart, CreditCard } from "lucide-react";

const G = "#1B5E20";
const GOLD = "#C9A14A";
const PIE_COLORS = [G, GOLD, "#2196F3", "#FF5722", "#9C27B0", "#00BCD4", "#4CAF50", "#FF9800"];
const CITY_COLORS = ["#1B5E20", "#C9A14A", "#2196F3", "#FF5722", "#9C27B0", "#00BCD4", "#4CAF50", "#FF9800", "#795548", "#607D8B"];

function hourLabel(h: number) { return `${h % 12 || 12}${h < 12 ? "AM" : "PM"}`; }

const CITY_COORDS: Record<string, [number, number]> = {
  "delhi": [52, 28], "new delhi": [52, 28], "mumbai": [30, 52], "bombay": [30, 52],
  "bangalore": [42, 70], "bengaluru": [42, 70], "hyderabad": [48, 58], "chennai": [52, 71],
  "madras": [52, 71], "kolkata": [75, 44], "calcutta": [75, 44], "jaipur": [38, 32],
  "ahmedabad": [26, 46], "pune": [34, 54], "lucknow": [55, 30], "surat": [26, 50],
  "kanpur": [55, 31], "nagpur": [50, 48], "bhopal": [44, 41], "amritsar": [37, 17],
  "chandigarh": [40, 20], "patna": [65, 36], "bhubaneswar": [65, 56], "kochi": [40, 75],
  "coimbatore": [42, 73], "indore": [38, 44], "agra": [53, 32], "varanasi": [61, 35],
  "meerut": [54, 28], "jodhpur": [28, 36],
};

function IndiaSalesMap({ cities }: { cities: { city: string; count: number; revenue: number }[] }) {
  const maxCount = Math.max(...cities.map((c) => c.count), 1);
  const plotted = cities.slice(0, 10).map((c) => {
    const key = c.city.toLowerCase().trim();
    const coords = CITY_COORDS[key];
    if (!coords) {
      const matchKey = Object.keys(CITY_COORDS).find((k) => key.includes(k) || k.includes(key));
      return { ...c, x: matchKey ? CITY_COORDS[matchKey][0] : null, y: matchKey ? CITY_COORDS[matchKey][1] : null };
    }
    return { ...c, x: coords[0], y: coords[1] };
  }).filter((c) => c.x !== null && c.y !== null);

  return (
    <div className="relative w-full" style={{ paddingBottom: "85%" }}>
      <svg viewBox="0 0 100 85" className="absolute inset-0 w-full h-full" style={{ background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)" }}>
        <rect x="0" y="0" width="100" height="85" rx="8" fill="#e8f5e9" />
        <path d="M38,2 L45,4 L55,3 L62,6 L68,10 L70,14 L72,18 L80,22 L82,28 L80,34 L78,38 L82,44 L80,50 L78,56 L75,62 L68,68 L62,72 L56,76 L50,80 L44,78 L38,74 L32,68 L26,62 L22,56 L20,50 L22,44 L20,38 L18,32 L20,26 L22,20 L26,14 L30,10 L34,6 Z"
          fill="white" stroke="#1B5E20" strokeWidth="0.8" opacity="0.7" />
        <path d="M45,4 L50,2 L55,3" fill="none" stroke="#1B5E20" strokeWidth="0.5" opacity="0.4" />
        <path d="M68,10 L72,8 L76,12" fill="none" stroke="#1B5E20" strokeWidth="0.5" opacity="0.4" />
        <path d="M22,20 L16,22 L14,28" fill="none" stroke="#1B5E20" strokeWidth="0.5" opacity="0.4" />
        <path d="M56,76 L58,82 L54,84" fill="none" stroke="#1B5E20" strokeWidth="0.5" opacity="0.4" />
        <path d="M44,78 L42,84 L38,82" fill="none" stroke="#1B5E20" strokeWidth="0.5" opacity="0.4" />
        {plotted.map((city, i) => {
          const r = 1.5 + (city.count / maxCount) * 4;
          return (
            <g key={city.city}>
              <circle cx={city.x ?? 50} cy={city.y ?? 42} r={r + 1} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.25} />
              <circle cx={city.x ?? 50} cy={city.y ?? 42} r={r} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.85} />
              <text x={(city.x ?? 50) + r + 1} y={(city.y ?? 42) + 1} fontSize="3" fill="#1B5E20" fontWeight="bold" opacity={0.9}>
                {city.city.length > 8 ? city.city.substring(0, 8) + "…" : city.city}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); fetchAnalytics().then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data) return <div className="text-center text-gray-400 py-16"><AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Could not load analytics</p></div>;

  const hourlyData = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: hourLabel(h), count: data.ordersByHour.find((x) => x.hour === h)?.count ?? 0 }));
  const peakHour = [...hourlyData].sort((a, b) => b.count - a.count)[0];
  const totalRevenue = data.topCities.reduce((sum, c) => sum + c.revenue, 0) + data.ordersBySource.reduce((s, x) => s + x.count, 0) * 999;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Visitors Today", value: data.visitors.today, cls: "bg-blue-50 border-blue-200 text-blue-800", icon: <Eye className="w-4 h-4" />, sub: "page views" },
          { label: "Yesterday", value: data.visitors.yesterday, cls: "bg-indigo-50 border-indigo-200 text-indigo-800", icon: <Eye className="w-4 h-4" />, sub: "page views" },
          { label: "Last 7 Days", value: data.visitors.last7, cls: "bg-purple-50 border-purple-200 text-purple-800", icon: <TrendingUp className="w-4 h-4" />, sub: "page views" },
          { label: "Repeat Customers", value: data.repeatCustomers, cls: "bg-amber-50 border-amber-200 text-amber-800", icon: <ShoppingCart className="w-4 h-4" />, sub: "unique phones" },
        ].map(({ label, value, cls, icon, sub }) => (
          <div key={label} className={`rounded-xl p-4 border ${cls} flex flex-col gap-1`}>
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase opacity-70">{label}</p><div className="opacity-40">{icon}</div></div>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs opacity-60">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{ label: "Today", d: data.conversion.today }, { label: "Last 7 Days", d: data.conversion.last7 }, { label: "Last 30 Days", d: data.conversion.last30 }].map(({ label, d }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{label}</p>
            <div className="flex items-end justify-between">
              <div><p className="text-2xl font-bold text-gray-900">{d.rate}%</p><p className="text-xs text-gray-500">conversion</p></div>
              <div className="text-right text-xs text-gray-500">
                <p><span className="font-semibold text-gray-700">{d.visitors.toLocaleString()}</span> visitors</p>
                <p><span className="font-semibold text-green-700">{d.orders.toLocaleString()}</span> orders</p>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.rate * 5)}%`, background: `linear-gradient(to right, ${G}, ${GOLD})` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-green-600" /> Daily Orders — Last 30 Days</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.ordersByDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={G} stopOpacity={0.2} /><stop offset="95%" stopColor={G} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${String(v)} orders`]} />
            <Area type="monotone" dataKey="count" stroke={G} strokeWidth={2} fill="url(#ag)" dot={false} activeDot={{ r: 4, fill: G }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> Orders by Hour of Day</h3>
          {peakHour && peakHour.count > 0 && <p className="text-xs text-gray-500 mb-3">Peak: <span className="font-semibold text-orange-600">{hourLabel(peakHour.hour)}</span> ({peakHour.count} orders)</p>}
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyData} margin={{ top: 0, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="count" name="Orders" fill={GOLD} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Payment Methods</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={[
                { name: "COD", value: data.paymentStats.cod },
                { name: "Razorpay", value: data.paymentStats.razorpay },
                { name: "Cashfree", value: data.paymentStats.cashfree },
              ].filter((d) => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={2}>
                {[G, GOLD, "#2196F3"].map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-4 text-xs text-gray-600">
            <span>COD: <strong className="text-gray-900">{data.paymentStats.cod}</strong></span>
            <span>Razorpay: <strong className="text-gray-900">{data.paymentStats.razorpay}</strong></span>
            <span>Paid: <strong className="text-green-700">{data.paymentStats.paid}</strong></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> Live Sales Map — Top Cities</h3>
          {data.topCities.length === 0 ? <p className="text-xs text-gray-400 text-center py-12">Not enough data yet</p> : <IndiaSalesMap cities={data.topCities} />}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> Top 10 Cities — Revenue</h3>
          {data.topCities.length === 0 ? <p className="text-xs text-gray-400 text-center py-12">Not enough data yet</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 font-semibold">#</th>
                    <th className="text-left py-2 font-semibold">City</th>
                    <th className="text-right py-2 font-semibold">Orders</th>
                    <th className="text-right py-2 font-semibold">Revenue</th>
                    <th className="py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.topCities.map((c, i) => {
                    const max = data.topCities[0]?.count ?? 1;
                    return (
                      <tr key={c.city} className="hover:bg-green-50/30">
                        <td className="py-2 text-gray-400 font-bold">{i + 1}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: CITY_COLORS[i % CITY_COLORS.length] }} />
                            <span className="font-medium text-gray-800">{c.city}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right font-bold text-gray-900">{c.count}</td>
                        <td className="py-2 text-right font-bold text-green-700">₹{c.revenue.toLocaleString()}</td>
                        <td className="py-2 pl-2">
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: CITY_COLORS[i % CITY_COLORS.length] }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="py-2 text-xs text-gray-500 font-semibold">Total (top cities)</td>
                    <td className="py-2 text-right font-bold text-green-800">₹{data.topCities.reduce((sum, c) => sum + c.revenue, 0).toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Orders by Source</h3>
        {data.ordersBySource.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">No data yet</p> : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={data.ordersBySource} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={2}>
                  {data.ordersBySource.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {data.ordersBySource.map((s, i) => {
                const t = data.ordersBySource.reduce((sum, x) => sum + x.count, 0);
                const pct = t > 0 ? ((s.count / t) * 100).toFixed(1) : "0";
                return (
                  <div key={s.source} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-gray-600 flex-1">{s.source}</span>
                    <span className="text-xs font-bold text-gray-800">{s.count}</span>
                    <span className="text-xs text-gray-400">({pct}%)</span>
                    <span className="text-xs font-semibold text-green-700">₹{(999 * s.count).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
