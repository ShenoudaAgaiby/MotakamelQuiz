import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function Leaderboard({ schoolId, competitionId }) {
    const [topStudents, setTopStudents] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLeaderboard()
    }, [schoolId, competitionId])

    const fetchLeaderboard = async () => {
        if (!supabase) return

        try {
            let query = supabase
                .from('results')
                .select(`
                    id,
                    score,
                    time_spent,
                    time_taken,
                    total_questions,
                    competition_id,
                    students!student_id (
                        name,
                        grade_id,
                        grades!grade_id(name),
                        class_name,
                        school_id
                    )
                `)

            // Filters
            if (competitionId) {
                query = query.eq('competition_id', competitionId)
            } else if (schoolId) {
                query = query.eq('students.school_id', schoolId)
            }

            // Ranking
            const { data, error } = await query
                .order('score', { ascending: false })
                .order('time_spent', { ascending: true }) // New column
                .order('time_taken', { ascending: true }) // Legacy column fallback
                .limit(10)

            if (error) throw error
            setTopStudents(data || [])
        } catch (err) {
            console.error('Error fetching leaderboard:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatTime = (seconds) => {
        if (!seconds) return '0:00'
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="glass-card rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-gradient-to-r from-brand-primary/10 to-transparent p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">🏆 لوحة الشرف (الـ 10 الأوائل)</h2>
                    <p className="text-xs text-slate-500 mt-1">يتم الترتيب حسب الدرجة ثم وقت الحل</p>
                </div>
                <div className="text-3xl">🥇</div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                            <th className="px-6 py-4">المركز</th>
                            <th className="px-6 py-4">الطالب</th>
                            <th className="px-6 py-4">الصف / الفصل</th>
                            <th className="px-6 py-4">الدرجة</th>
                            <th className="px-6 py-4 text-center">الوقت</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white/40">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">جاري تحميل الأوائل...</td></tr>
                        ) : topStudents.length > 0 ? (
                            topStudents.map((result, index) => (
                                <tr key={result.id} className={`hover:bg-brand-primary/5 transition-all ${index < 3 ? 'bg-yellow-50/20' : ''}`}>
                                    <td className="px-6 py-4 font-black">
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{result.students.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-500">{result.students.grades?.name || '---'}</div>
                                        <div className="text-[10px] text-brand-primary font-bold">{result.students.class_name || 'بدون فصل'}</div>
                                    </td>
                                    <td className="px-6 py-4 font-black text-brand-primary">
                                        {result.score} <span className="text-[10px] text-slate-400">/ {result.total_questions}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-xs font-bold text-slate-500">
                                        {formatTime(result.time_spent || result.time_taken)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">لا توجد نتائج مسجلة حتى الآن.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default Leaderboard
