import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import Leaderboard from './Leaderboard'
import { convertMathToLatex, updateMathDisplay } from '../utils/mathUtils'

function TeacherDashboard({ user, onLogout }) {
    const [questions, setQuestions] = useState([])
    const [counts, setCounts] = useState({ students: 0, questions: 0 })
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({})

    useEffect(() => {
        fetchDashboardData()
    }, [user])

    useEffect(() => {
        if (!loading && questions.length > 0) {
            setTimeout(() => updateMathDisplay(), 100)
        }
    }, [loading, questions, editingId])

    const fetchDashboardData = async () => {
        if (!supabase || !user.school_id) {
            setLoading(false)
            return
        }

        try {
            // Fetch Counts
            const { count: studentCount } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', user.school_id)

            const { data: questionsData, count: questionCount, error: qError } = await supabase
                .from('questions')
                .select('*, subjects!fk_questions_subjects(master_subjects!master_subject_id(name)), grades!fk_questions_grades(name)', { count: 'exact' })
                .is('school_id', null)
                .order('created_at', { ascending: false })

            if (qError) {
                console.error('TeacherDashboard Question Query Error:', qError)
            }

            setCounts({ students: studentCount || 0, questions: questionCount || 0 })
            setQuestions(questionsData || [])
        } catch (err) {
            console.error('Error fetching dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleEditClick = (q) => {
        setEditingId(q.id)
        setEditForm({
            correct_answer: q.correct_answer,
            difficulty: q.difficulty
        })
    }

    const handleSaveEdit = async (id) => {
        try {
            const { error } = await supabase
                .from('questions')
                .update({
                    correct_answer: editForm.correct_answer,
                    difficulty: editForm.difficulty
                })
                .eq('id', id)

            if (error) throw error

            setEditingId(null)
            fetchDashboardData() // Refresh list
        } catch (err) {
            alert('حدث خطأ أثناء التحديث')
            console.error(err)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
            <div className="max-w-5xl w-full">
                <header className="flex justify-between items-center mb-8 glass-card p-6 rounded-2xl">
                    <div>
                        <h1 className="text-2xl font-bold text-brand-primary border-r-4 border-brand-primary pr-4">لوحة المعلم والمدقق 🛡️</h1>
                        <p className="text-slate-600">أهلاً بك، {user.name} | {user.schoolName}</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all shadow-sm"
                    >
                        تسجيل الخروج
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="glass-card p-6 rounded-2xl border-b-4 border-blue-500">
                        <div className="flex items-center gap-4">
                            <div className="text-3xl">👥</div>
                            <div className="text-right">
                                <h3 className="text-2xl font-black text-slate-800">{counts.students}</h3>
                                <p className="text-xs text-slate-400 font-bold">إجمالي الطلاب</p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-6 rounded-2xl border-b-4 border-green-500">
                        <div className="flex items-center gap-4">
                            <div className="text-3xl">❓</div>
                            <div className="text-right">
                                <h3 className="text-2xl font-black text-slate-800">{counts.questions}</h3>
                                <p className="text-xs text-slate-400 font-bold">الأسئلة النشطة</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Questions Auditor Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <section className="glass-card rounded-2xl overflow-hidden shadow-lg border border-slate-100">
                            <div className="p-6 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-slate-800">🛠️ مدقق الأسئلة والمحتوى</h2>
                                <span className="text-xs bg-slate-100 text-slate-400 px-3 py-1 rounded-full font-bold uppercase tracking-tighter cursor-help" title="يمكنك مراجعة وتصحيح الأسئلة التي أنشأتها المنصة">تدقيق ذكي</span>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {loading ? (
                                    <div className="p-12 text-center text-slate-400 italic">جاري تحميل الأسئلة للمراجعة...</div>
                                ) : questions.length > 0 ? (
                                    questions.map((q) => (
                                        <div key={q.id} className="p-6 hover:bg-slate-50 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <h4
                                                        className="font-bold text-slate-800 text-lg leading-snug"
                                                        dangerouslySetInnerHTML={{ __html: convertMathToLatex(q.content?.question || q.content?.text) }}
                                                    />
                                                </div>
                                                {editingId !== q.id && (
                                                    <button
                                                        onClick={() => handleEditClick(q)}
                                                        className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all"
                                                        title="تعديل الإجابة أو المستوى"
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                            </div>

                                            {editingId === q.id ? (
                                                <div className="bg-slate-100 p-4 rounded-xl space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-2">الاجابة الصحيحة:</label>
                                                        <select
                                                            value={editForm.correct_answer}
                                                            onChange={(e) => setEditForm({ ...editForm, correct_answer: e.target.value })}
                                                            className="w-full p-2 rounded-lg border border-slate-200 text-sm font-bold"
                                                        >
                                                            {q.content.options.map((opt, i) => (
                                                                <option key={i} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-2">مستوى السؤال:</label>
                                                        <select
                                                            value={editForm.difficulty}
                                                            onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                                                            className="w-full p-2 rounded-lg border border-slate-200 text-sm font-bold"
                                                        >
                                                            <option value="easy">سهل</option>
                                                            <option value="medium">متوسط</option>
                                                            <option value="hard">صعب</option>
                                                            <option value="high_achievers">متفوقين 🌟</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleSaveEdit(q.id)}
                                                            className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold text-sm shadow-md"
                                                        >
                                                            حفظ
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="px-4 py-2 bg-slate-400 text-white rounded-lg font-bold text-sm"
                                                        >
                                                            إلغاء
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex gap-4">
                                                    <div className="text-xs">
                                                        <span className="text-slate-400">الإجابة الصحيحة: </span>
                                                        <span className="font-bold text-green-600" dangerouslySetInnerHTML={{ __html: convertMathToLatex(q.correct_answer) }}></span>
                                                    </div>
                                                    <div className="text-xs border-r pr-4 text-slate-400">
                                                        <span>المستوى: </span>
                                                        <span className={`font-bold ${q.difficulty === 'high_achievers' ? 'text-purple-600' :
                                                            q.difficulty === 'hard' ? 'text-red-500' :
                                                                q.difficulty === 'medium' ? 'text-blue-500' : 'text-green-500'
                                                            }`}>
                                                            {q.difficulty === 'high_achievers' ? 'متفوقين' :
                                                                q.difficulty === 'hard' ? 'صعب' :
                                                                    q.difficulty === 'medium' ? 'متوسط' : 'سهل'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-12 text-center text-slate-300 italic">لا توجد أسئلة حالية للمراجعة.</div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Leaderboard Section */}
                    <div className="lg:col-span-1">
                        <Leaderboard schoolId={user.school_id} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TeacherDashboard
