import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function Leaderboard({ schoolId, competitionId }) {
    const [topStudents, setTopStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [mode, setMode] = useState('competition') // competition or cumulative

    useEffect(() => {
        fetchLeaderboard()
    }, [schoolId, competitionId, mode])

    const fetchLeaderboard = async () => {
        if (!supabase) return
        setLoading(true)

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
                    student_id,
                    students!student_id (
                        id,
                        name,
                        grade_id,
                        grades!grade_id(name),
                        class_name,
                        school_id
                    )
                `)

            // Filters
            if (mode === 'competition' && competitionId) {
                query = query.eq('competition_id', competitionId)
            } else if (schoolId) {
                query = query.eq('students.school_id', schoolId)
            }

            const { data, error } = await query
                .order('score', { ascending: false })
                .order('time_spent', { ascending: true })
                .order('time_taken', { ascending: true })

            if (error) throw error

            let resultData = []

            if (mode === 'competition') {
                // Deduplicate: Keep only the best score per student
                const processedResults = (data || []).reduce((acc, current) => {
                    const studentId = current.student_id;
                    if (!studentId) return acc;

                    if (!acc[studentId]) {
                        acc[studentId] = current;
                    } else {
                        const currentTime = current.time_spent || current.time_taken || 999999;
                        const existingTime = acc[studentId].time_spent || acc[studentId].time_taken || 999999;

                        const betterScore = current.score > acc[studentId].score;
                        const sameScoreFaster = current.score === acc[studentId].score && currentTime < existingTime;

                        if (betterScore || sameScoreFaster) {
                            acc[studentId] = current;
                        }
                    }
                    return acc;
                }, {});

                resultData = Object.values(processedResults)
                    .sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        const aTime = a.time_spent || a.time_taken || 999999;
                        const bTime = b.time_spent || b.time_taken || 999999;
                        return aTime - bTime;
                    })
                    .slice(0, 10);
            } else {
                // Cumulative Mode: Aggregate score per student
                const studentAggregates = (data || []).reduce((acc, current) => {
                    const studentId = current.student_id;
                    if (!studentId) return acc;

                    if (!acc[studentId]) {
                        acc[studentId] = {
                            id: studentId,
                            students: current.students,
                            score: 0,
                            time_spent: 0,
                            attempts: 0
                        };
                    }
                    acc[studentId].score += current.score;
                    acc[studentId].time_spent += (current.time_spent || current.time_taken || 0);
                    acc[studentId].attempts += 1;
                    return acc;
                }, {});

                resultData = Object.values(studentAggregates)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10);
            }

            setTopStudents(resultData)
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
            <div className="bg-gradient-to-r from-brand-primary/10 to-transparent p-6 border-b border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">🏆 {mode === 'competition' ? 'لوحة الشرف (الأفضل)' : 'لوحة الشرف التراكمية'}</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {mode === 'competition' ? 'يتم الترتيب حسب أفضل نتيجة لكل طالب' : 'يتم الترتيب حسب إجمالي النقاط المكتسبة'}
                        </p>
                    </div>
                    <div className="text-3xl">🥇</div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setMode('competition')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'competition' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        المسابقة الحالية
                    </button>
                    <button
                        onClick={() => setMode('cumulative')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'cumulative' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        إجمالي النقاط
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                            <th className="px-6 py-4">المركز</th>
                            <th className="px-6 py-4">الطالب</th>
                            <th className="px-6 py-4">الصف / الفصل</th>
                            <th className="px-6 py-4">{mode === 'competition' ? 'الدرجة' : 'إجمالي النقاط'}</th>
                            <th className="px-6 py-4 text-center">{mode === 'competition' ? 'الوقت' : 'مشاركة'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white/40">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400 italic">جاري تحميل الأوائل...</td></tr>
                        ) : topStudents.length > 0 ? (
                            topStudents.map((result, index) => (
                                <tr key={result.id || result.students?.id} className={`hover:bg-brand-primary/5 transition-all ${index < 3 ? 'bg-yellow-50/20' : ''}`}>
                                    <td className="px-6 py-4 font-black">
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-700">{result.students?.name || 'مستخدم غير معروف'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-500">{result.students?.grades?.name || '---'}</div>
                                        <div className="text-[10px] text-brand-primary font-bold">{result.students?.class_name || 'بدون فصل'}</div>
                                    </td>
                                    <td className="px-6 py-4 font-black text-brand-primary">
                                        {result.score} {mode === 'competition' && <span className="text-[10px] text-slate-400">/ {result.total_questions}</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center font-mono text-xs font-bold text-slate-500">
                                        {mode === 'competition'
                                            ? formatTime(result.time_spent || result.time_taken)
                                            : `${result.attempts} محاولة`}
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
