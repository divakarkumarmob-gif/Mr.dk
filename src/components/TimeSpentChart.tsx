import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function TimeSpentChart({ data }: { data: { name: string, lectureMinutes: number, otherMinutes: number }[] }) {
    const totals = useMemo(() => {
        // We probably don't want a "Total of all 7 days" in a daily graph, 
        // but let's just make it show the total for the displayed period as it's labeled
        return { total: data.length }; 
    }, [data]);

    return (
        <div className="flex flex-col h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                        stroke="#9ca3af" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        ticks={[0, 30, 60, 90, 120, 150]}
                    />
                    <Tooltip 
                        contentStyle={{backgroundColor: '#0f172a', border: '1px solid #ffffff20', borderRadius: '8px'}}
                        cursor={{fill: '#ffffff10'}}
                    />
                    <Bar dataKey="lectureMinutes" name="Lecture" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="otherMinutes" name="App Usage" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
            <div className="text-sm font-bold mt-4 px-2 text-center text-gray-400">
                Data for last 7 days
            </div>
        </div>
    );
}
