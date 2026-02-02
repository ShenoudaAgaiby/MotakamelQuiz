import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { updateMathDisplay } from '../utils/mathUtils'

function QuizInterface({ questions: legacyQuestions, competition, user, onComplete, onCancel }) {
    // Determine source of questions
    const questions = competition ? competition.questions : legacyQuestions
    const isCompetition = !!competition

    const [currentIndex, setCurrentIndex] = useState(0)
    const [answers, setAnswers] = useState({})

    // Timer Logic
    const getInitialTime = () => {
        if (isCompetition) {
            return competition.duration // Already in seconds from competition config
        }
        return questions.length * 60 // 1 minute per question for legacy
    }

    const [timeLeft, setTimeLeft] = useState(getInitialTime())
    const [isFinished, setIsFinished] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [startTime] = useState(Date.now())

    useEffect(() => {
        if (timeLeft <= 0) {
            if (isCompetition && competition.timer_type === 'per_question') {
                // Auto advance or submit if last
                if (currentIndex < questions.length - 1) {
                    setCurrentIndex(prev => prev + 1)
                    setTimeLeft(competition.duration)
                } else {
                    handleSubmit()
                }
            } else {
                handleSubmit()
            }
            return
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
        return () => clearInterval(timer)
    }, [timeLeft, currentIndex])

    // Update time when switching questions in 'per_question' mode
    useEffect(() => {
        if (isCompetition && competition.timer_type === 'per_question') {
            setTimeLeft(competition.duration)
        }
    }, [currentIndex])

    //Typeset math on question change
    useEffect(() => {
        const timer = setTimeout(() => {
            updateMathDisplay();
        }, 100);
        return () => clearTimeout(timer);
    }, [currentIndex]);

    const currentQuestion = questions[currentIndex]

    const handleSelectOption = (option) => {
        setAnswers({ ...answers, [currentIndex]: option })
    }

    const handleSubmit = async () => {
        if (submitting) return
        setSubmitting(true)

        let score = 0
        questions.forEach((q, index) => {
            if (answers[index] === q.correct_answer) {
                score++
            }
        })

        const totalTimeSpent = Math.floor((Date.now() - startTime) / 1000)
        const questionsSeenIds = questions.map(q => q.id)

        if (!supabase) {
            console.error('Supabase not initialized')
            onComplete({ score, total: questions.length })
            return
        }

        try {
            const entry = {
                student_id: user.id,
                subject: questions[0]?.subjects?.master_subjects?.name || questions[0]?.subject || 'عام',
                score: score,
                total_questions: questions.length,
                time_spent: totalTimeSpent,
                competition_id: isCompetition ? competition.id : null,
                questions_seen: questionsSeenIds
            }

            const { error } = await supabase.from('results').insert(entry)
            if (error) throw error

            setIsFinished(true)
        } catch (err) {
            console.error('Error saving results:', err)
            alert('حدث خطأ أثناء حفظ النتيجة. سيتم عرض النتيجة محلياً.')
            setIsFinished(true)
        } finally {
            setSubmitting(false)
        }
    }

    if (isFinished) {
        const score = questions.reduce((acc, q, i) => answers[i] === q.correct_answer ? acc + 1 : acc, 0)
        return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
                    <div className="text-6xl mb-4">🎊</div>
                    <h2 className="text-2xl font-bold mb-2 text-slate-800">أحسنت يا {user.name}!</h2>
                    <p className="text-slate-600 mb-6 font-bold">{isCompetition ? `لقد أكملت "${competition.title}"` : 'لقد أتممت التدريب بنجاح.'}</p>
                    <div className="bg-slate-50 rounded-2xl p-6 mb-8">
                        <div className="text-sm text-slate-500 mb-1">درجتك النهائية</div>
                        <div className="text-4xl font-black text-brand-primary">{score} / {questions.length}</div>
                    </div>
                    <button
                        onClick={() => onComplete({ score, total: questions.length })}
                        className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] transition-all"
                    >
                        العودة للوحة التحكم
                    </button>
                </div>
            </div>
        )
    }

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const progress = ((currentIndex + 1) / questions.length) * 100

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col z-50 overflow-y-auto ltr">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto flex justify-between items-center">
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-2">
                        <span className="text-2xl">✕</span>
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                            {isCompetition && competition.timer_type === 'per_question' ? 'وقت السؤال' : 'الوقت المتبقي'}
                        </span>
                        <span className={`text-xl font-mono font-black ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">التقدم</span>
                        <span className="text-sm font-black text-brand-primary">{currentIndex + 1}/{questions.length}</span>
                    </div>
                </div>
                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 h-1.5 bg-slate-100 w-full">
                    <div
                        className="h-full bg-brand-primary transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            {/* Content */}
            <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center">
                <div className="mb-10 text-center">
                    {isCompetition && (
                        <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black mb-4 border border-amber-200 shadow-sm">
                            🏆 {competition.title}
                        </span>
                    )}
                    <h2 className="text-2xl md:text-4xl font-black text-slate-800 leading-tight rtl">
                        {currentQuestion.content?.question || currentQuestion.content?.text || 'سؤال بدون نص'}
                    </h2>
                    {currentQuestion.content?.image && (
                        <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200 shadow-inner max-w-md mx-auto">
                            <img src={currentQuestion.content.image} alt="Question Graphic" className="w-full h-auto" />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 mb-10 rtl">
                    {currentQuestion.content?.options?.map((option, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSelectOption(option)}
                            className={`p-6 rounded-2xl border-2 text-right transition-all flex items-center gap-4 group ${answers[currentIndex] === option
                                ? 'border-brand-primary bg-brand-primary/5 shadow-md ring-4 ring-brand-primary/10'
                                : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-colors ${answers[currentIndex] === option
                                ? 'bg-brand-primary text-white'
                                : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                }`}>
                                {idx + 1}
                            </span>
                            <span className={`flex-1 text-lg font-bold ${answers[currentIndex] === option ? 'text-brand-primary' : 'text-slate-700'}`}>
                                {option}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center mt-auto py-8">
                    <button
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0 || (isCompetition && competition.timer_type === 'per_question')}
                        className="px-8 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-black disabled:opacity-30 hover:bg-slate-100 transition-all"
                    >
                        السابق
                    </button>
                    {currentIndex === questions.length - 1 ? (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-12 py-4 bg-brand-primary text-white rounded-2xl font-black shadow-xl shadow-brand-primary/30 hover:scale-105 active:scale-95 transition-all text-lg"
                        >
                            {submitting ? 'جاري الحفظ...' : 'إنهاء المسابقة ✨'}
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                            className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black hover:scale-105 active:scale-95 transition-all text-lg"
                        >
                            التالي
                        </button>
                    )}
                </div>
            </main>
        </div>
    )
}

export default QuizInterface
