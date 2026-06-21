import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function FocusAnalytics({ data }: { data: { day: string; focus: number }[] }) {
    if (!data || data.length === 0) return <div className="text-gray-500 text-xs">No activity yet.</div>;
    return (
        <div className="w-full h-48 mt-6">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                    <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{backgroundColor: '#1f2937', borderRadius: '8px', border: 'none', color: '#fff'}}
                    />
                    <Bar dataKey="focus" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.focus > 80 ? '#10b981' : '#3b82f6'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
