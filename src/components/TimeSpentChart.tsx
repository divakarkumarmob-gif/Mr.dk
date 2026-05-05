import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function TimeSpentChart({ data }: { data: { name: string, lectureMinutes: number, otherMinutes: number }[] }) {
    const totals = useMemo(() => {
        let total = 0;
        let lecture = 0;
        data.forEach(d => {
            total += (d.lectureMinutes + d.otherMinutes);
            lecture += d.lectureMinutes;
        });
        return { total, lecture };
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
            <div className="flex justify-between text-sm font-bold mt-4 px-2">
                <p>Total Time: <span className="text-white">{totals.total} min</span></p>
                <p>Study Time: <span className="text-green-500">{totals.lecture} min</span></p>
            </div>
        </div>
    );
}
