import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Mock data based on user engagement style
const data = [
    { day: 'Mon', focus: 65 },
    { day: 'Tue', focus: 78 },
    { day: 'Wed', focus: 92 },
    { day: 'Thu', focus: 85 },
    { day: 'Fri', focus: 70 },
    { day: 'Sat', focus: 95 },
    { day: 'Sun', focus: 80 },
];

export default function FocusAnalytics() {
    return (
        <div className="w-full h-48 mt-6">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                    <YAxis hide />
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
