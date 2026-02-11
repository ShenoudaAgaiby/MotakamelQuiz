import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import QuizInterface from './QuizInterface'
import Leaderboard from './Leaderboard'

function StudentDashboard({ user, onLogout }) {
    const [activeCompetitions, setActiveCompetitions] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeCompetition, setActiveCompetition] = useState(null) // For the competition flow
    const [userStats, setUserStats] = useState({ score: 0, completed: 0 })
    const [activePolls, setActivePolls] = useState([])
    const [userResponses, setUserResponses] = useState({})
    const [pollResults, setPollResults] = useState({})

    useEffect(() => {
        fetchCompetitions()
        fetchUserStats()
        fetchPolls()
    }, [user])


    const fetchCompetitions = async () => {
        if (!supabase || !user.grade_id) {
            setLoading(false)
            return
        }
        try {
            // 1. Fetch active competitions for this grade
            const { data: cData, error: cError } = await supabase
                .from('competitions')
                .select('*, subjects!subject_id(master_subjects!master_subject_id(name))')
                .eq('is_active', true)
                .eq('grade_id', user.grade_id)

            if (cError) throw cError

            // 2. Fetch student attempts for these competitions
            const { data: rData, error: rError } = await supabase
                .from('results')
                .select('competition_id')
                .eq('student_id', user.id)

            if (rError) throw rError

            // Map attempts to competitions
            const competitionsWithAttempts = cData.map(comp => {
                const attempts = rData.filter(r => r.competition_id === comp.id).length
                return { ...comp, attempts_made: attempts }
            })

            setActiveCompetitions(competitionsWithAttempts)
        } catch (err) {
            console.error('Error fetching competitions:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchUserStats = async () => {
        if (!supabase) return
        try {
            const { data, error } = await supabase
                .from('results')
                .select('score')
                .eq('student_id', user.id)

            if (!error && data) {
                const totalScore = data.reduce((sum, r) => sum + r.score, 0)
                setUserStats({ score: totalScore, completed: data.length })
            }
        } catch (err) {
            console.error('Error fetching stats:', err)
        }
    }

    const fetchPolls = async () => {
        try {
            const { data: pollsData } = await supabase.from('polls')
                .select('*')
                .eq('is_active', true)
                .or(`school_id.is.null,school_id.eq.${user.school_id}`)
            const { data: responsesData } = await supabase.from('poll_responses').select('*').eq('student_id', user.id)
            const { data: allResponses } = await supabase.from('poll_responses').select('*')

            const responseMap = {}
            responsesData?.forEach(r => responseMap[r.poll_id] = r.option_index)
            setUserResponses(responseMap)

            const resultsMap = {}
            allResponses?.forEach(resp => {
                if (!resultsMap[resp.poll_id]) resultsMap[resp.poll_id] = {}
                resultsMap[resp.poll_id][resp.option_index] = (resultsMap[resp.poll_id][resp.option_index] || 0) + 1
            })
            setPollResults(resultsMap)
            setActivePolls(pollsData || [])
        } catch (err) { console.error('Error polls:', err) }
    }

    const handleVote = async (pollId, optionIndex) => {
        try {
            const { error } = await supabase.from('poll_responses').insert([{
                poll_id: pollId,
                student_id: user.id,
                option_index: optionIndex
            }])
            if (error) throw error
            fetchPolls() // Refresh
        } catch (err) { alert('خطأ في التصويت: ' + err.message) }
    }

    const handleStartCompetition = async (comp) => {
        setLoading(true)
        try {
            // 1. Get already seen questions across ALL competitions to prevent repetition
            const { data: previousResults } = await supabase
                .from('results')
                .select('questions_seen')
                .eq('student_id', user.id)
            // ✅ Removed .eq('competition_id', comp.id) to track across all competitions

            const alreadySeenIds = new Set()
            previousResults?.forEach(r => {
                if (Array.isArray(r.questions_seen)) {
                    r.questions_seen.forEach(id => alreadySeenIds.add(id))
                }
            })

            // 2. Fetch all eligible questions
            const { data: allAvailableQuestions, error: qError } = await supabase
                .from('questions')
                .select('*')
                .eq('grade_id', comp.grade_id)
                .eq('subject_id', comp.subject_id)
                .eq('term', comp.term)

            if (qError) throw qError

            // 3. Random selection based on quotas
            const selectedQuestions = []
            const difficulties = [
                { key: 'easy', quota: comp.easy_q },
                { key: 'medium', quota: comp.medium_q },
                { key: 'hard', quota: comp.hard_q },
                { key: 'talented', quota: comp.talented_q }
            ]

            difficulties.forEach(({ key, quota }) => {
                if (quota <= 0) return

                // Filter by difficulty, week range, and exclude already seen questions
                let pool = allAvailableQuestions.filter(q => {
                    const week = q.content?.week || 0;
                    const qDiff = q.difficulty === 'متفوقين' ? 'talented' : q.difficulty;
                    return qDiff === key &&
                        week >= comp.start_week &&
                        week <= comp.end_week &&
                        !alreadySeenIds.has(q.id);
                })

                let chosen = []
                if (pool.length >= quota) {
                    // We have enough new questions
                    chosen = pool.sort(() => 0.5 - Math.random()).slice(0, quota)
                } else {
                    // Not enough new questions, need to reuse some seen questions
                    const seenPool = allAvailableQuestions.filter(q => {
                        const week = q.content?.week || 0;
                        const qDiff = q.difficulty === 'متفوقين' ? 'talented' : q.difficulty;
                        return qDiff === key &&
                            week >= comp.start_week &&
                            week <= comp.end_week &&
                            alreadySeenIds.has(q.id);
                    })
                    chosen = [...pool, ...seenPool.sort(() => 0.5 - Math.random()).slice(0, quota - pool.length)]
                }
                selectedQuestions.push(...chosen)
            })

            if (selectedQuestions.length === 0) {
                alert('لا توجد أسئلة كافية في بنك الأسئلة لهذه المسابقة حالياً.')
                return
            }

            // Shuffle final list
            const shuffled = selectedQuestions.sort(() => 0.5 - Math.random())

            setActiveCompetition({
                ...comp,
                questions: shuffled
            })
        } catch (err) {
            console.error('Error starting competition:', err)
            alert('حدث خطأ أثناء تحميل المسابقة. يرجى المحاولة مرة أخرى.')
        } finally {
            setLoading(false)
        }
    }

    const handleQuizComplete = (result) => {
        setActiveCompetition(null)
        fetchUserStats() // Refresh points
        fetchCompetitions() // Refresh attempts count
    }

    if (activeCompetition) {
        return (
            <QuizInterface
                competition={activeCompetition}
                user={user}
                onComplete={handleQuizComplete}
                onCancel={() => setActiveCompetition(null)}
            />
        )
    }


    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
            <div className="max-w-4xl w-full">
                <header className="flex justify-between items-center mb-8 glass-card p-6 rounded-2xl">
                    <div>
                        <h1 className="text-2xl font-bold text-brand-primary">لوحة الطالب 🎓</h1>
                        <p className="text-slate-600">أهلاً بك، {user.name} | {user.grades?.name || '...'} - {user.class_name || '...'} | {user.schoolName || 'المدرسة النموذجية'}</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-all font-bold"
                    >
                        تسجيل الخروج
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="glass-card p-6 rounded-2xl text-center">
                        <div className="text-4xl mb-4">🏆</div>
                        <h3 className="font-bold mb-1 text-2xl text-brand-primary">{userStats.score}</h3>
                        <p className="text-sm text-slate-500">مجموع النقاط</p>
                    </div>
                    <div className="glass-card p-6 rounded-2xl text-center">
                        <div className="text-4xl mb-4">📝</div>
                        <h3 className="font-bold mb-1 text-2xl text-brand-primary">{userStats.completed}</h3>
                        <p className="text-sm text-slate-500">مسابقات مكتملة</p>
                    </div>
                    <div className="glass-card p-6 rounded-2xl text-center">
                        <div className="text-4xl mb-4">📊</div>
                        <h3 className="font-bold mb-1 text-2xl text-brand-primary">{activeCompetitions.length}</h3>
                        <p className="text-sm text-slate-500">مسابقات متاحة</p>
                    </div>
                </div>

                {activePolls.length > 0 && (
                    <div className={`grid grid-cols-1 ${activePolls.length > 1 ? 'md:grid-cols-2' : ''} gap-6 mb-8`}>
                        {activePolls.map(poll => {
                            const hasVoted = userResponses[poll.id] !== undefined;
                            const results = pollResults[poll.id] || {};
                            const totalVotes = Object.values(results).reduce((a, b) => a + b, 0);

                            return (
                                <div key={poll.id} className="glass-card p-6 rounded-2xl border-2 border-brand-primary/10 hover:border-brand-primary/30 transition-all">
                                    <h3 className="font-black text-slate-800 mb-4 text-center">{poll.question}</h3>

                                    <div className="space-y-3">
                                        {poll.options.map((opt, idx) => {
                                            const votes = results[idx] || 0;
                                            const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                            const isSelected = userResponses[poll.id] === idx;

                                            if (hasVoted) {
                                                return (
                                                    <div key={idx} className="space-y-1">
                                                        <div className="flex justify-between text-[11px] font-bold">
                                                            <span className="text-slate-500">{opt}</span>
                                                            <span className={isSelected ? 'text-brand-primary font-black' : 'text-slate-400'}>{percent}% {isSelected && '✓'}</span>
                                                        </div>
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full transition-all duration-1000 ${isSelected ? 'bg-brand-primary' : 'bg-slate-300'}`} style={{ width: `${percent}%` }} />
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleVote(poll.id, idx)}
                                                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-brand-primary hover:bg-brand-primary/5 font-bold text-slate-600 transition-all text-sm"
                                                >
                                                    {opt}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {hasVoted && (
                                        <p className="mt-4 text-center text-[10px] text-slate-400 font-bold">شكرًا لمشاركتك! تم تسجيل صوتك بنجاح.</p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                <section className="glass-card rounded-2xl overflow-hidden mb-8">
                    <div className="p-6 border-b border-slate-100 bg-brand-primary/5">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span>🏆</span> المسابقات الرسمية المتاحة ({user.grades?.name || '...'})
                        </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            <div className="p-12 text-center text-slate-400">جاري تحميل المسابقات...</div>
                        ) : activeCompetitions.length > 0 ? (
                            activeCompetitions.map((comp) => (
                                <div key={comp.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                                    <div className="flex gap-4 items-center">
                                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-inner">
                                            🏁
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{comp.title}</h4>
                                            <div className="flex gap-2 items-center mt-1">
                                                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500">{comp.subjects?.master_subjects?.name}</span>
                                                <span className="text-[10px] bg-blue-50 px-2 py-0.5 rounded-full font-bold text-blue-600">
                                                    الأسبوع {comp.start_week === comp.end_week ? comp.start_week : `${comp.start_week} - ${comp.end_week}`}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400">{comp.easy_q + comp.medium_q + comp.hard_q + comp.talented_q} سؤال</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-left hidden md:block">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">المحاولات</div>
                                            <div className="text-sm font-black text-slate-700">{comp.attempts_made} / {comp.max_attempts}</div>
                                        </div>
                                        <button
                                            disabled={comp.attempts_made >= comp.max_attempts}
                                            onClick={() => handleStartCompetition(comp)}
                                            className={`px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all ${comp.attempts_made >= comp.max_attempts ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-amber-500 text-white hover:bg-amber-600 hover:scale-105'}`}
                                        >
                                            {comp.attempts_made >= comp.max_attempts ? 'انتهت المحاولات' : 'ابدأ المسابقة'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 text-center text-slate-400 italic text-sm">لا توجد مسابقات رسمية نشطة حالياً.</div>
                        )}
                    </div>
                </section>


                <Leaderboard schoolId={user.school_id} />
            </div>
        </div>
    )
}

export default StudentDashboard
