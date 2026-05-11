import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function TimeSpentChart({ data }: { data: { name: string, lectureMinutes: number, otherMinutes: number }[] }) {
    const maxVal = useMemo(() => {
        const highest = Math.max(...data.map(d => d.lectureMinutes + d.otherMinutes));
        return Math.ceil((highest + 30) / 30) * 30; // Round up to next 30 min
    }, [data]);

    return (
        <div className="flex flex-col h-80 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#9ca3af" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis 
                        stroke="#9ca3af" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        domain={[0, Math.max(120, maxVal)]}
                        unit="m"
                    />
                    <Tooltip 
                        contentStyle={{backgroundColor: '#161e38', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '12px'}}
                        cursor={{fill: '#ffffff05'}}
                        itemStyle={{padding: '2px 0'}}
                    />
                    <Legend 
                        verticalAlign="top" 
                        align="right" 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', paddingBottom: '20px' }}
                    />
                    <Bar dataKey="lectureMinutes" name="Lectures" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="otherMinutes" name="Self Study" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            <div className="text-[10px] font-medium mt-6 px-4 py-2 bg-white/5 rounded-lg text-center text-gray-500 border border-white/5">
                Activity summary for the current week (IST)
            </div>
        </div>
    );
}
