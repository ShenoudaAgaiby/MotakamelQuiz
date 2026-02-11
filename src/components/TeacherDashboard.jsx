import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import Leaderboard from './Leaderboard'
import { convertMathToLatex, updateMathDisplay, normalizeArabic } from '../utils/mathUtils'

function TeacherDashboard({ user, onLogout }) {
    const [questions, setQuestions] = useState([])
    const [counts, setCounts] = useState({ students: 0, questions: 0 })
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({})

    const [activeView, setActiveView] = useState('leaderboard')
    const [grades, setGrades] = useState([])
    const [filters, setFilters] = useState({
        grade: '',
        term: '',
        difficulty: ''
    })
    const [teacherSubject, setTeacherSubject] = useState('')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchDashboardData()
    }, [user])

    useEffect(() => {
        if (!loading && (activeView === 'audited' || activeView === 'unaudited')) {
            // Give the DOM a moment to render the questions list
            const timer = setTimeout(() => {
                updateMathDisplay()
            }, 300)
            return () => clearTimeout(timer)
        }
    }, [loading, questions, editingId, activeView, filters, searchTerm])

    const fetchDashboardData = async () => {
        if (!supabase || !user.school_id) {
            setLoading(false)
            return
        }

        try {
            // Fetch Teacher Data (Subject)
            const { data: teacherData } = await supabase
                .from('teachers')
                .select('*, master_subjects(id, name)')
                .eq('school_id', user.school_id)
                .eq('teacher_code', user.teacher_code)
                .single()

            let subjectFilter = null;
            let subjectName = '';

            if (teacherData && teacherData.master_subjects) {
                subjectFilter = teacherData.master_subjects.id;
                subjectName = teacherData.master_subjects.name;
                setTeacherSubject(subjectName);
            } else {
                setTeacherSubject('تخصص غير محدد');
            }

            // Fetch Counts
            const { count: studentCount } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', user.school_id)

            let questionQuery = supabase
                .from('questions')
                .select('*, subjects!fk_questions_subjects!inner(master_subjects!master_subject_id(name, id)), grades!fk_questions_grades(name)', { count: 'exact' })
                .is('school_id', null)
                .order('created_at', { ascending: false })

            if (subjectFilter) {
                // Filter questions by master subject
                // We use !inner on subjects to filter rows based on the joined table
                questionQuery = questionQuery.eq('subjects.master_subject_id', subjectFilter)
            }

            const { data: questionsData, count: questionCount, error: qError } = await questionQuery;

            if (qError) {
                console.error('TeacherDashboard Question Query Error:', qError)
            }

            // Fetch Grades for Filter
            const { data: gradesData } = await supabase
                .from('grades')
                .select('id, name')
                .order('name')

            setCounts({ students: studentCount || 0, questions: questionCount || 0 })
            setQuestions(questionsData || [])
            setGrades(gradesData || [])

            // Trigger math rendering after state update
            setTimeout(() => updateMathDisplay(), 300)
        } catch (err) {
            console.error('Error fetching dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    const getCorrectAnswerText = (q) => {
        const ans = q.correct_answer;
        const options = q.content?.options || [];
        if (ans === 'A') return options[0] || ans;
        if (ans === 'B') return options[1] || ans;
        if (ans === 'C') return options[2] || ans;
        if (ans === 'D') return options[3] || ans;
        return ans;
    }

    const handleEditClick = (q) => {
        setEditingId(q.id)
        let initialCorrect = 'A';
        const options = q.content?.options || [];

        // Determine the letter for the current correct answer
        if (['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
            initialCorrect = q.correct_answer;
        } else {
            const idx = options.indexOf(q.correct_answer);
            if (idx !== -1) initialCorrect = ['A', 'B', 'C', 'D'][idx];
        }

        setEditForm({
            correct_answer: initialCorrect,
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
            alert('تم التحديث بنجاح')
        } catch (err) {
            alert('حدث خطأ أثناء التحديث')
            console.error(err)
        }
    }

    const filteredQuestions = questions.filter(q => {
        // Base filter: Audited vs Unaudited
        if (activeView === 'audited' && !q.is_audited) return false
        if (activeView === 'unaudited' && q.is_audited) return false

        // Apply extra filters ONLY for 'audited' view (as requested)
        if (activeView === 'audited') {
            if (filters.grade && q.grade_id !== filters.grade) return false
            if (filters.term && q.term !== parseInt(filters.term)) return false
            if (filters.difficulty && q.difficulty !== filters.difficulty) return false

            // Search filter
            if (searchTerm) {
                const normalizedSearch = normalizeArabic(searchTerm.toLowerCase());
                const questionText = normalizeArabic((q.content?.question || q.content?.text || '').toLowerCase());
                return questionText.includes(normalizedSearch);
            }
        }

        return true
    })

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
            <div className="max-w-7xl w-full">
                <header className="flex justify-between items-center mb-8 glass-card p-6 rounded-2xl">
                    <div>
                        <h1 className="text-2xl font-bold text-brand-primary border-r-4 border-brand-primary pr-4">لوحة المعلم والمدقق 🛡️</h1>
                        <p className="text-slate-600">أهلاً بك، {user.name} | {user.schoolName} {teacherSubject && <span className="mr-2 text-brand-primary font-bold">({teacherSubject})</span>}</p>
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

                <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Sidebar Navigation */}
                    <aside className="w-full lg:w-64 glass-card p-4 rounded-2xl shrink-0 space-y-2 sticky top-6">
                        <button
                            onClick={() => setActiveView('leaderboard')}
                            className={`w-full text-right px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-3 ${activeView === 'leaderboard' ? 'bg-brand-primary text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`}
                        >
                            <span>🏆</span> لوحة الشرف
                        </button>
                        <button
                            onClick={() => setActiveView('audited')}
                            className={`w-full text-right px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-3 ${activeView === 'audited' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`}
                        >
                            <span>✅</span> الأسئلة المدققة
                        </button>
                        <button
                            onClick={() => setActiveView('unaudited')}
                            className={`w-full text-right px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-3 ${activeView === 'unaudited' ? 'bg-amber-500 text-white shadow-lg' : 'hover:bg-slate-100 text-slate-600'}`}
                        >
                            <span>⚠️</span> الأسئلة غير المدققة
                        </button>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 w-full">
                        {activeView === 'leaderboard' && (
                            <div className="animate-in fade-in slide-in-from-right duration-300">
                                <Leaderboard schoolId={user.school_id} />
                            </div>
                        )}

                        {(activeView === 'audited' || activeView === 'unaudited') && (
                            <section className="glass-card rounded-2xl overflow-hidden shadow-lg border border-slate-100 animate-in fade-in slide-in-from-right duration-300">
                                <div className="p-6 border-b border-slate-100 bg-white/50 flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-bold text-slate-800">
                                            {activeView === 'audited' ? '✅ الأسئلة المدققة' : '⚠️ الأسئلة التي تحتاج مراجعة'}
                                        </h2>
                                        <span className="text-xs bg-slate-100 text-slate-400 px-3 py-1 rounded-full font-bold uppercase tracking-tighter">
                                            {activeView === 'audited' ? 'Approved' : 'Pending Review'}
                                        </span>
                                    </div>

                                    {/* Filters Bar - Only for Audited Questions */}
                                    {activeView === 'audited' && (
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="بحث في الأسئلة..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pr-10 pl-4 py-2 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary w-full md:w-64"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                            </div>
                                            <select
                                                value={filters.grade}
                                                onChange={(e) => setFilters({ ...filters, grade: e.target.value })}
                                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary"
                                            >
                                                <option value="">كل المراحل</option>
                                                {grades.map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={filters.term}
                                                onChange={(e) => setFilters({ ...filters, term: e.target.value })}
                                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary"
                                            >
                                                <option value="">كل التيرمات</option>
                                                <option value="1">الترم الأول</option>
                                                <option value="2">الترم الثاني</option>
                                            </select>
                                            <select
                                                value={filters.difficulty}
                                                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-primary"
                                            >
                                                <option value="">كل المستويات</option>
                                                <option value="easy">سهل</option>
                                                <option value="medium">متوسط</option>
                                                <option value="hard">صعب</option>
                                                <option value="high_achievers">متفوقين</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {loading ? (
                                        <div className="p-12 text-center text-slate-400 italic">جاري تحميل الأسئلة...</div>
                                    ) : filteredQuestions.length > 0 ? (
                                        filteredQuestions.map((q) => (
                                            <div key={q.id} className="p-6 hover:bg-slate-50 transition-all">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex-1">
                                                        <h4
                                                            className="font-bold text-slate-800 text-lg leading-snug"
                                                            dangerouslySetInnerHTML={{ __html: convertMathToLatex(q.content?.question || q.content?.text) }}
                                                        />
                                                        <div className="flex gap-2 mt-2">
                                                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold">{q.grades?.name || 'غير محدد'}</span>
                                                            {q.term && <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold">ترم {q.term}</span>}
                                                        </div>
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
                                                                {q.content.options.map((opt, i) => {
                                                                    const letter = ['A', 'B', 'C', 'D'][i];
                                                                    return (
                                                                        <option key={i} value={letter}>{letter} - {opt}</option>
                                                                    )
                                                                })}
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
                                                                <option value="talented">متفوقين (قديم)</option>
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
                                                            <span className="font-bold text-green-600" dangerouslySetInnerHTML={{ __html: convertMathToLatex(getCorrectAnswerText(q)) }}></span>
                                                        </div>
                                                        <div className="text-xs border-r pr-4 text-slate-400">
                                                            <span>المستوى: </span>
                                                            <span className={`font-bold ${q.difficulty === 'high_achievers' || q.difficulty === 'talented' ? 'text-purple-600' :
                                                                q.difficulty === 'hard' ? 'text-red-500' :
                                                                    q.difficulty === 'medium' ? 'text-blue-500' : 'text-green-500'
                                                                }`}>
                                                                {q.difficulty === 'high_achievers' || q.difficulty === 'talented' ? 'متفوقين' :
                                                                    q.difficulty === 'hard' ? 'صعب' :
                                                                        q.difficulty === 'medium' ? 'متوسط' : 'سهل'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-12 text-center text-slate-300 italic">لا توجد أسئلة تطابق الفلاتر الحالية.</div>
                                    )}
                                </div>
                            </section>
                        )}
                    </main>
                </div>
            </div>
        </div>
    )
}

export default TeacherDashboard
