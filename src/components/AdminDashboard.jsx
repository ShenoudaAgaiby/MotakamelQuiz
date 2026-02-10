import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { convertMathToLatex, updateMathDisplay } from '../utils/mathUtils'
import { downloadQuestionTemplate } from '../utils/questionTemplate'

function AdminDashboard({ user, onLogout }) {
    const [activeTab, setActiveTab] = useState('schools')
    const [schools, setSchools] = useState([])
    const [teachers, setTeachers] = useState([])
    const [students, setStudents] = useState([])
    const [phases, setPhases] = useState([])
    const [grades, setGrades] = useState([])
    const [subjects, setSubjects] = useState([])
    const [masterSubjects, setMasterSubjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [teacherSearch, setTeacherSearch] = useState('')
    const [studentSearch, setStudentSearch] = useState('')
    const [allQuestions, setAllQuestions] = useState([])
    const [competitions, setCompetitions] = useState([])
    const [qFilters, setQFilters] = useState({ school: '', grade: '', subject: '', difficulty: '', term: '', week: '' })

    // Form States
    const [newSchool, setNewSchool] = useState({ name: '', school_code: '', page_link: '' })
    const [selectedPhasesForNewSchool, setSelectedPhasesForNewSchool] = useState([])
    const [editingSchool, setEditingSchool] = useState(null)
    const [selectedPhases, setSelectedPhases] = useState([])
    const [newUser, setNewUser] = useState({ name: '', code: '', school_id: '', role: 'student', grade_id: '', class_name: '', subject_id: '', master_subject_id: '', whatsapp_number: '' })
    const [newPhase, setNewPhase] = useState({ name: '' })
    const [newGrade, setNewGrade] = useState({ phase_id: '', name: '' })
    const [newMasterSubject, setNewMasterSubject] = useState({ name: '' })
    const [newSubject, setNewSubject] = useState({ grade_id: '', master_subject_id: '' })
    const [editingPhase, setEditingPhase] = useState(null)
    const [editingGrade, setEditingGrade] = useState(null)
    const [editingSubject, setEditingSubject] = useState(null)
    const [editingTeacher, setEditingTeacher] = useState(null)
    const [editingStudent, setEditingStudent] = useState(null)
    const [editingQuestion, setEditingQuestion] = useState(null)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showImportQuestionsModal, setShowImportQuestionsModal] = useState(false)
    const [importConfig, setImportConfig] = useState({ school_id: '', grade_id: '', master_subject_id: '', term: '1', week: '1' })
    const [importing, setImporting] = useState(false)
    const [newCompetition, setNewCompetition] = useState({
        title: '',
        grade_id: '',
        subject_id: '',
        term: 1,
        start_week: 1,
        end_week: 1,
        easy_q: 4,
        medium_q: 4,
        hard_q: 2,
        talented_q: 1,
        timer_type: 'total',
        duration: 600,
        max_attempts: 1
    })
    const [editingCompetition, setEditingCompetition] = useState(null)
    const [showResultsModal, setShowResultsModal] = useState(false)
    const [selectedCompetitionResults, setSelectedCompetitionResults] = useState(null)
    const [polls, setPolls] = useState([])
    const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''], is_active: true, school_id: null })
    const [pollResults, setPollResults] = useState({})
    const [pollResponses, setPollResponses] = useState([])
    const [showPollDetailsModal, setShowPollDetailsModal] = useState(null)

    // Hall of Fame (HOF) States
    const [hofMode, setHofMode] = useState('competition') // 'competition' or 'cumulative'
    const [hofSelectedGrade, setHofSelectedGrade] = useState('')
    const [hofSelectedCompetition, setHofSelectedCompetition] = useState('')
    const [hofLimit, setHofLimit] = useState(10)
    const [allResults, setAllResults] = useState([])

    // Settings & Security States
    const [settingsNewPassword, setSettingsNewPassword] = useState('')
    const [settingsConfirmPassword, setSettingsConfirmPassword] = useState('')
    const [showVerifyModal, setShowVerifyModal] = useState(false)
    const [verifyPasswordValue, setVerifyPasswordValue] = useState('')
    const [verifyCallback, setVerifyCallback] = useState(null)
    const [whatsappTemplate, setWhatsappTemplate] = useState('')

    // Helper to get available questions count based on current filters
    const getAvailableQuestions = (difficulty, config = newCompetition) => {
        if (!config.grade_id || !config.subject_id) return 0;

        return allQuestions.filter(q => {
            const week = q.content?.week || 0;

            // Normalize difficulty for comparison
            let qDiff = q.difficulty;
            let targetDiff = difficulty;
            if (qDiff === 'متفوقين') qDiff = 'talented';
            if (targetDiff === 'متفوقين') targetDiff = 'talented';

            // Grade Match
            const gradeId = q.grade_id || (typeof q.grades === 'object' ? q.grades?.id : q.grade);
            const targetGradeId = config.grade_id;

            // Subject Match
            const subjectId = q.subject_id || (typeof q.subjects === 'object' ? q.subjects?.id : q.subject);
            const targetSubjectId = config.subject_id;

            return gradeId == targetGradeId &&
                subjectId == targetSubjectId &&
                parseInt(q.term) === parseInt(config.term) &&
                (week == 0 || (week >= parseInt(config.start_week) && week <= parseInt(config.end_week))) &&
                qDiff === targetDiff;
        }).length;
    };

    useEffect(() => {
        fetchAllData()
    }, [])


    // State for Question Preview
    const [previewQuestion, setPreviewQuestion] = useState(null)


    useEffect(() => {
        if (previewQuestion) {
            setTimeout(() => updateMathDisplay(), 50)
        }
    }, [previewQuestion])




    const handleUpdateQuestionField = async (question, field, value) => {
        try {
            // Prepare updates for database
            const updates = {};

            // Handle question text update
            if (field === 'question') {
                updates.content = {
                    ...question.content,
                    question: value
                };
            }
            // Handle choice updates (choice_a, choice_b, choice_c, choice_d)
            else if (field.startsWith('choice_')) {
                const choiceIndex = { 'choice_a': 0, 'choice_b': 1, 'choice_c': 2, 'choice_d': 3 }[field];
                const newOptions = [...(question.content?.options || ['', '', '', ''])];
                newOptions[choiceIndex] = value;
                updates.content = {
                    ...question.content,
                    options: newOptions
                };
            }
            // Handle difficulty update with auto-score
            else if (field === 'difficulty') {
                const scoreMap = {
                    'easy': 1,
                    'medium': 2,
                    'hard': 3,
                    'talented': 4
                };
                updates.difficulty = value;
                updates.score = scoreMap[value] || 1;
            }
            // Handle other fields (correct_answer, score, etc.)
            else {
                updates[field] = value;
            }

            // Optimistic update for UI
            const updatedQuestion = {
                ...question,
                ...updates,
                // Also update flat fields for UI consistency
                ...(field === 'question' ? { question: value } : {}),
                ...(field.startsWith('choice_') ? { [field]: value } : {})
            };
            setPreviewQuestion(updatedQuestion);

            // Save to database
            const { error } = await supabase
                .from('questions')
                .update(updates)
                .eq('id', question.id);

            if (error) throw error;

            // Update local state with transformation
            const transformedQuestion = {
                ...updatedQuestion,
                question: updatedQuestion.content?.question || updatedQuestion.question || '',
                choice_a: updatedQuestion.content?.options?.[0] || updatedQuestion.choice_a || '',
                choice_b: updatedQuestion.content?.options?.[1] || updatedQuestion.choice_b || '',
                choice_c: updatedQuestion.content?.options?.[2] || updatedQuestion.choice_c || '',
                choice_d: updatedQuestion.content?.options?.[3] || updatedQuestion.choice_d || ''
            };

            setAllQuestions(allQuestions.map(q => q.id === question.id ? transformedQuestion : q));
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
            alert('حدث خطأ أثناء تحديث البيانات');
            // Revert changes
            setPreviewQuestion(question);
        }
    }

    // Delete Question Handler
    const handleDeleteQuestion = async (questionId) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا السؤال نهائياً؟')) return;

        try {
            const { error } = await supabase
                .from('questions')
                .delete()
                .eq('id', questionId);

            if (error) throw error;

            setAllQuestions(allQuestions.filter(q => q.id !== questionId));
            setPreviewQuestion(null); // Close preview if open
            alert('تم حذف السؤال بنجاح');
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('حدث خطأ أثناء حذف السؤال');
        }
    };

    const handleUpdateQuestion = async (e) => {
        e.preventDefault()
        try {
            // Ensure options array exists and has 4 elements if needed, though UI should handle it.
            // The editingQuestion state should already have the updated structure from the UI.

            const { error } = await supabase
                .from('questions')
                .update({
                    content: editingQuestion.content,
                    subject_id: editingQuestion.subject_id,
                    grade_id: editingQuestion.grade_id,
                    difficulty: editingQuestion.difficulty,
                    term: editingQuestion.term
                    // correct_answer is updated via Preview Modal as per user request flow
                })
                .eq('id', editingQuestion.id)

            if (error) throw error

            // Update local state
            const updatedQ = { ...editingQuestion };
            setAllQuestions(allQuestions.map(q => q.id === editingQuestion.id ? updatedQ : q))

            // Check if currently previewed question is the one being edited (shouldn't happen in this flow usually, but good for safety)
            if (previewQuestion && previewQuestion.id === editingQuestion.id) {
                setPreviewQuestion(updatedQ)
            } else {
                // Re-open/Update Preview Modal with the edited question to allow Correct Answer selection
                setPreviewQuestion(updatedQ);
            }

            setEditingQuestion(null)
            alert('تم تحديث بيانات السؤال بنجاح. يرجى "معاينة" السؤال لتحديد الإجابة الصحيحة إذا لزم الأمر.')

        } catch (error) {
            console.error('Error updating question:', error)
            alert('حدث خطأ أثناء تحديث السؤال')
        }
    }

    const handleAuditQuestion = async (question, status) => {
        try {
            const { error } = await supabase
                .from('questions')
                .update({ is_audited: status })
                .eq('id', question.id)

            if (error) throw error

            // Update local state
            setAllQuestions(allQuestions.map(q => q.id === question.id ? { ...q, is_audited: status } : q))

            // If currently previewing, update preview state too
            if (previewQuestion && previewQuestion.id === question.id) {
                setPreviewQuestion({ ...previewQuestion, is_audited: status })
            }
        } catch (error) {
            console.error('Error auditing question:', error)
            alert(`حدث خطأ أثناء تحديث حالة التدقيق:\n${error.message || error}`)
        }
    }

    const fetchAllData = async () => {
        setLoading(true)
        try {
            const { data: schoolsData, error: e1 } = await supabase.from('schools').select('*, school_phases(phase_id)').order('created_at', { ascending: false })
            const { data: teachersData, error: e2 } = await supabase.from('teachers').select('*, schools!school_id(name, school_code, page_link), master_subjects!master_subject_id(name)').order('created_at', { ascending: false })
            const { data: studentsData, error: e3 } = await supabase.from('students').select('*, schools!school_id(name, school_code, page_link), grades!grade_id(phase_id, name)').order('created_at', { ascending: false })
            const { data: phasesData, error: e4 } = await supabase.from('educational_phases').select('*').order('created_at', { ascending: true })
            const { data: gradesData, error: e5 } = await supabase.from('grades').select('*, educational_phases!phase_id(name)').order('created_at', { ascending: true })
            const { data: mSubjectsData, error: e6 } = await supabase.from('master_subjects').select('*').order('created_at', { ascending: true })
            const { data: subjectsData, error: e7 } = await supabase.from('subjects').select('*, master_subjects!master_subject_id(name), grades!grade_id(*, educational_phases!phase_id(*))').order('created_at', { ascending: true })
            const { data: questionsData, error: e8 } = await supabase.from('questions').select('*, schools!school_id(name, school_code, page_link), subjects!fk_questions_subjects(master_subjects!master_subject_id(name)), grades!fk_questions_grades(name)').order('created_at', { ascending: false })
            const { data: competitionsData, error: e9 } = await supabase.from('competitions').select('*, grades(name), subjects(master_subjects!master_subject_id(name))').order('created_at', { ascending: false })
            const { data: resultsData, error: e10 } = await supabase.from('results').select('*, students!student_id(*, schools!school_id(name, school_code, page_link)), competitions!competition_id(*)').order('created_at', { ascending: false })
            const { data: pollsData, error: ePolls } = await supabase.from('polls').select('*').order('created_at', { ascending: false })
            const { data: responsesData, error: eResponses } = await supabase.from('poll_responses').select('*, students(name, schools(name))')
            const { data: configData, error: e11 } = await supabase.from('config').select('*')

            if (e1) console.error('Error in Schools (e1):', e1)
            if (e2) console.error('Error in Teachers (e2):', e2)
            if (e3) console.error('Error in Students (e3):', e3)
            if (e4) console.error('Error in Phases (e4):', e4)
            if (e5) console.error('Error in Grades (e5):', e5)
            if (e6) console.error('Error in MasterSubjects (e6):', e6)
            if (e7) console.error('Error in Subjects (e7):', e7)
            if (e8) console.error('Error in Questions (e8):', e8)
            if (e9) console.error('Error in Competitions (e9):', e9)
            if (e10) console.error('Error in Results (e10):', e10)
            if (ePolls) console.error('Error in Polls:', ePolls)
            if (eResponses) console.error('Error in Responses:', eResponses)

            setSchools(schoolsData || [])
            setTeachers(teachersData || [])
            setStudents(studentsData || [])
            setPhases(phasesData || [])
            setGrades(gradesData || [])
            setMasterSubjects(mSubjectsData || [])
            setSubjects(subjectsData || [])

            // Transform questions data to match old preview modal format
            const transformedQuestions = (questionsData || []).map(q => ({
                ...q,
                // Extract question text from content
                question: q.content?.question || q.question || '',
                // Extract options from content.options array to choice_a/b/c/d
                choice_a: q.content?.options?.[0] || q.choice_a || '',
                choice_b: q.content?.options?.[1] || q.choice_b || '',
                choice_c: q.content?.options?.[2] || q.choice_c || '',
                choice_d: q.content?.options?.[3] || q.choice_d || ''
            }));

            setAllQuestions(transformedQuestions)
            setCompetitions(competitionsData || [])
            setAllResults(resultsData || [])
            setPolls(pollsData || [])
            setPollResponses(responsesData || [])

            // Process poll results
            const resultsMap = {}
            responsesData?.forEach(resp => {
                if (!resultsMap[resp.poll_id]) resultsMap[resp.poll_id] = {}
                resultsMap[resp.poll_id][resp.option_index] = (resultsMap[resp.poll_id][resp.option_index] || 0) + 1
            })
            setPollResults(resultsMap)

            if (configData) {
                const template = configData.find(c => c.key === 'whatsapp_template')
                if (template) setWhatsappTemplate(template.value)
            }
        } catch (err) {
            console.error('Error fetching admin data:', err)
            if (err.message) console.error('Supabase Error Msg:', err.message)
            if (err.hint) console.error('Supabase Error Hint:', err.hint)
            if (err.details) console.error('Supabase Error Details:', err.details)
        } finally {
            setLoading(false)
        }
    }

    const startSecurityChallenge = (callback) => {
        setVerifyCallback(() => callback)
        setVerifyPasswordValue('')
        setShowVerifyModal(true)
    }

    const handleVerifySecurityChallenge = () => {
        if (verifyPasswordValue === user.password_hash) {
            setShowVerifyModal(false)
            if (verifyCallback) verifyCallback()
            setVerifyCallback(null)
        } else {
            alert('كلمة المرور غير صحيحة. لا يمكن إتمام العملية.')
        }
    }

    const checkCodeUniqueness = async (code) => {
        const [
            { count: schoolCount },
            { count: teacherCount },
            { count: studentCount }
        ] = await Promise.all([
            supabase.from('schools').select('*', { count: 'exact', head: true }).eq('school_code', code),
            supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('teacher_code', code),
            supabase.from('students').select('*', { count: 'exact', head: true }).eq('student_code', code)
        ])
        return (schoolCount === 0 && teacherCount === 0 && studentCount === 0)
    }

    const generateSchoolCode = async () => {
        const code = Math.floor(10000000 + Math.random() * 90000000).toString()
        const isUnique = await checkCodeUniqueness(code)
        if (!isUnique) return generateSchoolCode()
        setNewSchool({ ...newSchool, school_code: code })
    }

    const generateGlobalCode = async () => {
        const code = Math.floor(10000000 + Math.random() * 90000000).toString()
        const isUnique = await checkCodeUniqueness(code)
        if (!isUnique) return generateGlobalCode()
        setNewUser({ ...newUser, code })
    }

    const handleAddSchool = async (e) => {
        e.preventDefault()
        try {
            // 1. Insert school
            const { data, error } = await supabase.from('schools').insert([newSchool]).select()
            if (error) throw error

            const schoolId = data[0].id

            // 2. Insert phase links
            if (selectedPhasesForNewSchool.length > 0) {
                const { error: phaseError } = await supabase.from('school_phases').insert(
                    selectedPhasesForNewSchool.map(pid => ({ school_id: schoolId, phase_id: pid }))
                )
                if (phaseError) throw phaseError
            }

            setNewSchool({ name: '', school_code: '', page_link: '' })
            setSelectedPhasesForNewSchool([])
            fetchAllData()
            alert('تم إضافة المدرسة والمراحل المرتبطة بنجاح')
        } catch (err) {
            alert('خطأ في إضافة المدرسة: ' + err.message)
        }
    }

    const handleAddUser = async (e) => {
        e.preventDefault()
        try {
            const table = newUser.role === 'student' ? 'students' : 'teachers'
            const payload = {
                name: newUser.name,
                school_id: newUser.school_id,
                [newUser.role === 'student' ? 'student_code' : 'teacher_code']: newUser.code
            }

            if (newUser.role === 'student') {
                payload.grade = grades.find(g => g.id === newUser.grade_id)?.name || ''
                payload.class_name = newUser.class_name
            } else {
                payload.master_subject_id = newUser.master_subject_id || null
            }
            payload.whatsapp_number = newUser.whatsapp_number || ''

            const { error } = await supabase.from(table).insert([payload])
            if (error) throw error

            setNewUser({ name: '', code: '', school_id: '', role: 'student', grade_id: '', class_name: '', subject_id: '', master_subject_id: '', whatsapp_number: '' })
            fetchAllData()
            alert('تم إضافة المستخدم بنجاح')
        } catch (err) {
            alert('خطأ في إضافة المستخدم: ' + err.message)
        }
    }

    const handleAddCompetition = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('competitions').insert([newCompetition])
            if (error) throw error
            setNewCompetition({
                title: '', grade_id: '', subject_id: '', term: 1, start_week: 1, end_week: 1,
                easy_q: 4, medium_q: 4, hard_q: 2, talented_q: 1,
                timer_type: 'total', duration: 600, max_attempts: 1
            })
            fetchAllData()
            alert('تم إنشاء المسابقة بنجاح!')
        } catch (err) { alert('خطأ في الإضافة: ' + err.message) }
    }

    const handleToggleCompetition = async (comp) => {
        try {
            const { error } = await supabase.from('competitions').update({ is_active: !comp.is_active }).eq('id', comp.id)
            if (error) throw error
            fetchAllData()
        } catch (err) { alert('خطأ في التحديث: ' + err.message) }
    }

    const handleUpdateCompetition = async (e) => {
        e.preventDefault()
        try {
            // Remove joined data before updating to avoid PostgREST "column not found" error
            const { grades, subjects, ...updatePayload } = editingCompetition
            const { error } = await supabase.from('competitions').update(updatePayload).eq('id', editingCompetition.id)
            if (error) throw error
            setEditingCompetition(null)
            fetchAllData()
            alert('تم تحديث المسابقة بنجاح!')
        } catch (err) { alert('خطأ في التحديث: ' + err.message) }
    }

    const handleDeleteCompetition = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذه المسابقة؟ سينتج عن ذلك حذف كافة النتائج المرتبطة بها.')) return
        try {
            const { error } = await supabase.from('competitions').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) { alert('خطأ في الحذف: ' + err.message) }
    }

    const handleAddPoll = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('polls').insert([{
                ...newPoll,
                options: newPoll.options.filter(opt => opt.trim() !== '')
            }])
            if (error) throw error
            setNewPoll({ question: '', options: ['', ''], is_active: true, school_id: null })
            fetchAllData()
            alert('تم إنشاء التصويت بنجاح!')
        } catch (err) { alert('خطأ في الإضافة: ' + err.message) }
    }

    const handleTogglePoll = async (poll) => {
        try {
            const { error } = await supabase.from('polls').update({ is_active: !poll.is_active }).eq('id', poll.id)
            if (error) throw error
            fetchAllData()
        } catch (err) { alert('خطأ في التحديث: ' + err.message) }
    }

    const handleDeletePoll = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذا التصويت؟')) return
        try {
            const { error } = await supabase.from('polls').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) { alert('خطأ في الحذف: ' + err.message) }
    }

    const handleSendWhatsAppCode = (name, code, number, role, schoolData = null) => {
        if (!number) {
            alert('لا يوجد رقم واتساب مسجل لهذا المستخدم')
            return
        }

        // Remove all non-numeric characters
        let formattedNumber = number.toString().replace(/[^\d]/g, '')

        // Handle Egyptian numbers specific case (01xxxxxxxxx -> 201xxxxxxxxx)
        if (formattedNumber.length === 11 && formattedNumber.startsWith('01')) {
            formattedNumber = '2' + formattedNumber
        }
        else if (formattedNumber.startsWith('00')) {
            formattedNumber = formattedNumber.substring(2)
        }

        // Construct the message using template
        let messageText = whatsappTemplate ||
            `مرحباً {name}\nيسعدنا انضمامك لمنصة المتكامل.\n\nبيانات الدخول الخاصة بك كـ ({role}):\nكود الدخول: *{code}*\n\nنتمنى لك تجربة ممتعة! 🌹`;

        // Replace placeholders and handle literal \n
        messageText = messageText
            .replace(/\\n/g, '\n') // Convert literal \n to actual newline
            .replace(/{name}/g, name)
            .replace(/{code}/g, code)
            .replace(/{role}/g, role === 'teacher' ? 'معلم' : 'طالب')
            .replace(/{link}/g, window.location.origin)
            .replace(/{school_code}/g, schoolData?.school_code || '')
            .replace(/{school_page}/g, schoolData?.page_link || '');

        const encodedMessage = encodeURIComponent(messageText);
        window.open(`https://wa.me/${formattedNumber}?text=${encodedMessage}`, '_blank')
    }

    const handleAddPhase = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('educational_phases').insert([newPhase])
            if (error) throw error
            setNewPhase({ name: '' })
            fetchAllData()
            alert('تم إضافة المرحلة بنجاح')
        } catch (err) {
            alert('خطأ: ' + err.message)
        }
    }

    const handleAddGrade = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('grades').insert([newGrade])
            if (error) throw error
            setNewGrade({ phase_id: '', name: '' })
            fetchAllData()
            alert('تم إضافة الصف بنجاح')
        } catch (err) {
            alert('خطأ: ' + err.message)
        }
    }

    const handleAddMasterSubject = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('master_subjects').insert([newMasterSubject])
            if (error) throw error
            setNewMasterSubject({ name: '' })
            fetchAllData()
            alert('تم إضافة المادة العامة بنجاح')
        } catch (err) {
            alert('خطأ: ' + err.message)
        }
    }

    const handleDeleteMasterSubject = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذه المادة العامة؟ سيتم حذفها من جميع الصفوف المرتبطة بها!')) return
        try {
            const { error } = await supabase.from('master_subjects').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في الحذف: ' + err.message)
        }
    }

    const handleAddSubject = async (e) => {
        e.preventDefault()
        try {
            const masterSub = masterSubjects.find(ms => ms.id === newSubject.master_subject_id)
            const payload = {
                ...newSubject,
                name: masterSub ? masterSub.name : ''
            }
            const { error } = await supabase.from('subjects').insert([payload])
            if (error) throw error
            setNewSubject({ grade_id: '', master_subject_id: '' })
            fetchAllData()
            alert('تم ربط المادة بالصف بنجاح')
        } catch (err) {
            alert('خطأ: ' + err.message)
        }
    }

    const handleDeletePhase = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذه المرحلة؟ سيتم حذف جميع الصفوف والمواد المرتبطة بها!')) return
        try {
            const { error } = await supabase.from('educational_phases').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في الحذف: ' + err.message)
        }
    }

    const handleDeleteGrade = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذا الصف؟ سيتم حذف جميع المواد المرتبطة به!')) return
        try {
            const { error } = await supabase.from('grades').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في الحذف: ' + err.message)
        }
    }

    const handleDeleteSubject = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذه المادة؟')) return
        try {
            const { error } = await supabase.from('subjects').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في الحذف: ' + err.message)
        }
    }

    const handleUpdatePhase = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('educational_phases').update({ name: editingPhase.name }).eq('id', editingPhase.id)
            if (error) throw error
            setEditingPhase(null)
            fetchAllData()
            alert('تم التحديث بنجاح')
        } catch (err) {
            alert('خطأ: ' + err.message)
        }
    }

    const handleUpdateGrade = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('grades').update({
                name: editingGrade.name,
                phase_id: editingGrade.phase_id
            }).eq('id', editingGrade.id)
            if (error) throw error
            setEditingGrade(null)
            fetchAllData()
            alert('تم التحديث بنجاح')
        } catch (err) {
            alert('خطأ: ' + err.message)
        }
    }

    const handleUpdateSubject = async (e) => {
        e.preventDefault()
        try {
            const masterSub = masterSubjects.find(ms => ms.id === editingSubject.master_subject_id)
            const { error } = await supabase.from('subjects').update({
                name: masterSub ? masterSub.name : '',
                grade_id: editingSubject.grade_id,
                master_subject_id: editingSubject.master_subject_id
            }).eq('id', editingSubject.id)
            if (error) throw error
            setEditingSubject(null)
            fetchAllData()
            alert('تم التحديث بنجاح')
        } catch (err) {
            alert('خطأ: ' + err.message)
        }
    }

    const handleToggleSchool = async (id, currentStatus) => {
        try {
            const { error } = await supabase.from('schools').update({ is_active: !currentStatus }).eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في تغيير الحالة: ' + err.message)
        }
    }

    const handleDeleteSchool = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه المدرسة؟ سيتم حذف جميع البيانات المرتبطة بها.')) return
        try {
            const { error } = await supabase.from('schools').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في الحذف: ' + err.message)
        }
    }

    const handleUpdateSchool = async (schoolId, updatedData, phaseIds) => {
        try {
            // 1. Update school details
            const { error: schoolError } = await supabase
                .from('schools')
                .update({
                    name: updatedData.name,
                    school_code: updatedData.school_code,
                    page_link: updatedData.page_link
                })
                .eq('id', schoolId)

            if (schoolError) throw schoolError

            // 2. Update phase links
            await supabase.from('school_phases').delete().eq('school_id', schoolId)
            if (phaseIds.length > 0) {
                const { error: phaseError } = await supabase.from('school_phases').insert(
                    phaseIds.map(pid => ({ school_id: schoolId, phase_id: pid }))
                )
                if (phaseError) throw phaseError
            }

            fetchAllData()
            setEditingSchool(null)
            alert('تم تحديث بيانات المدرسة بنجاح')
        } catch (err) {
            alert('خطأ في التحديث: ' + err.message)
        }
    }

    const handleToggleTeacherStatus = async (id, currentStatus) => {
        try {
            const { error } = await supabase.from('teachers').update({ is_active: !currentStatus }).eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في تغيير حالة المعلم: ' + err.message)
        }
    }

    const handleDeleteTeacher = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذا المعلم؟')) return
        try {
            const { error } = await supabase.from('teachers').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في الحذف: ' + err.message)
        }
    }


    const handleUpdateTeacher = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('teachers').update({
                name: editingTeacher.name,
                school_id: editingTeacher.school_id,
                master_subject_id: editingTeacher.master_subject_id,
                teacher_code: editingTeacher.teacher_code,
                whatsapp_number: editingTeacher.whatsapp_number
            }).eq('id', editingTeacher.id)
            if (error) throw error
            setEditingTeacher(null)
            fetchAllData()
            alert('تم تحديث بيانات المعلم بنجاح')
        } catch (err) {
            alert('خطأ في التحديث: ' + err.message)
        }
    }

    const handleToggleStudentStatus = async (id, currentStatus) => {
        try {
            const { error } = await supabase.from('students').update({ is_active: !currentStatus }).eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في تغيير حالة الطالب: ' + err.message)
        }
    }

    const handleDeleteStudent = async (id) => {
        if (!confirm('هل أنت متأكد من حذف هذا الطالب؟')) return
        try {
            const { error } = await supabase.from('students').delete().eq('id', id)
            if (error) throw error
            fetchAllData()
        } catch (err) {
            alert('خطأ في الحذف: ' + err.message)
        }
    }

    const handleUpdateStudent = async (e) => {
        e.preventDefault()
        try {
            const targetGrade = grades.find(g => g.id === editingStudent.grade_id)
            const { error } = await supabase.from('students').update({
                name: editingStudent.name,
                school_id: editingStudent.school_id,
                grade: targetGrade ? targetGrade.name : editingStudent.grade,
                class_name: editingStudent.class_name,
                student_code: editingStudent.student_code,
                grade_id: editingStudent.grade_id,
                whatsapp_number: editingStudent.whatsapp_number
            }).eq('id', editingStudent.id)
            if (error) throw error
            setEditingStudent(null)
            fetchAllData()
            alert('تم تحديث بيانات الطالب بنجاح')
        } catch (err) {
            alert('خطأ في التحديث: ' + err.message)
        }
    }



    const getSchoolStudentStats = (schoolId) => {
        const stats = {}
        students.filter(s => s.school_id === schoolId).forEach(s => {
            const phaseId = s.grades?.phase_id
            if (!phaseId) return
            const phaseName = phases.find(p => p.id === phaseId)?.name || 'أخرى'
            stats[phaseName] = (stats[phaseName] || 0) + 1
        })
        return stats
    }

    const filteredSchools = schools.filter(school => {
        const searchLower = searchTerm.toLowerCase()
        const nameMatch = school.name.toLowerCase().includes(searchLower)
        const phaseMatch = school.school_phases?.some(sp => {
            const pName = phases.find(p => p.id === sp.phase_id)?.name || ""
            return pName.toLowerCase().includes(searchLower)
        })
        return nameMatch || phaseMatch
    })

    const filteredQuestions = allQuestions.filter(q => {
        // Allow if filter is empty OR matches school_id OR (if filter is empty, show global too)
        // Actually, logic:
        // If filter.school is set: show ONLY questions for that school (local) + GLOBAL questions (null)?? 
        // User requested "All schools have same curriculum", so usually we want to see ALL global questions always?
        // Let's assume: If school filter is selected, we usually want to see questions assigned to THAT school.
        // BUT now questions are global (null). So filtering by School might be irrelevant for Global Questions.
        // Let's Update: Show question if (q.school_id === filter.school) OR (q.school_id === null).
        // If filter.school is empty -> Show ALL.

        const isGlobal = q.school_id === null
        const schoolMatch = !qFilters.school || q.school_id === qFilters.school || isGlobal // Show global questions even when a school is selected (as they apply to all)

        const gradeMatch = !qFilters.grade || q.grade_id === qFilters.grade
        const subjectMatch = !qFilters.subject || q.subject_id === qFilters.subject
        const qDiff = q.difficulty === 'متفوقين' ? 'talented' : q.difficulty
        const fDiff = qFilters.difficulty === 'متفوقين' ? 'talented' : qFilters.difficulty
        const difficultyMatch = !qFilters.difficulty || qDiff === fDiff
        const termMatch = !qFilters.term || q.term === parseInt(qFilters.term)
        const weekMatch = !qFilters.week || q.content?.week === parseInt(qFilters.week)
        const auditedMatch = !qFilters.audited || (qFilters.audited === 'true' ? q.is_audited === true : q.is_audited !== true)
        return schoolMatch && gradeMatch && subjectMatch && difficultyMatch && termMatch && weekMatch && auditedMatch
    })

    // Update MathJax when questions table is displayed
    useEffect(() => {
        if (activeTab === 'questions' && filteredQuestions.length > 0) {
            setTimeout(() => updateMathDisplay(), 100)
        }
    }, [activeTab, filteredQuestions])


    const filteredCompetitions = competitions.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getHofLeaderboard = () => {
        let pool = [...allResults]

        // 1. Grade Filter
        if (hofSelectedGrade) {
            pool = pool.filter(r => r.students?.grade_id === hofSelectedGrade)
        }

        if (hofMode === 'competition') {
            // 2. Competition Filter
            if (hofSelectedCompetition) {
                pool = pool.filter(r => r.competition_id === hofSelectedCompetition)
            }

            // Deduplicate: Keep only the best score per student for this competition
            const processedResults = pool.reduce((acc, current) => {
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

            pool = Object.values(processedResults);

            // Sort by Score DESC, then Time Spent ASC
            pool.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                const aTime = a.time_spent || a.time_taken || 999999;
                const bTime = b.time_spent || b.time_taken || 999999;
                return aTime - bTime;
            })
        } else {
            // Cumulative Logic: Group by Student
            const studentStats = {}
            pool.forEach(r => {
                const sid = r.student_id;
                if (!studentStats[sid]) {
                    studentStats[sid] = {
                        student: r.students,
                        total_score: 0,
                        total_time: 0,
                        count: 0
                    }
                }
                studentStats[sid].total_score += r.score;
                studentStats[sid].total_time += r.time_spent;
                studentStats[sid].count += 1;
            })
            pool = Object.values(studentStats).map(s => ({
                ...s,
                score: s.total_score, // Mapping for table
                time_spent: s.total_time
            }))
            // Sort by Total Score DESC
            pool.sort((a, b) => b.total_score - a.total_score)
        }

        return pool.slice(0, hofLimit)
    }

    const handleDeleteHofRecords = async () => {
        const msg = hofMode === 'competition'
            ? 'هل أنت متأكد من مسح جميع نتائج هذه المسابقة فقط؟'
            : 'هل أنت متأكد من مسح جميع نتائج الطلاب التراكمية (سيؤدي لحذف جميع النتائج من النظام)؟'

        if (!confirm(msg)) return

        startSecurityChallenge(async () => {
            try {
                let query = supabase.from('results').delete()
                if (hofMode === 'competition' && hofSelectedCompetition) {
                    query = query.eq('competition_id', hofSelectedCompetition)
                } else if (hofMode === 'cumulative' && hofSelectedGrade) {
                    // This is tricky because student_id is in student table.
                    // We'd need to filter by student_ids for that grade.
                    alert('حالياً الحذف الشامل متاح لكل المدرسة أو لمسابقة محددة فقط.')
                    return
                } else if (hofMode === 'cumulative' && !hofSelectedGrade) {
                    // Massive delete
                } else {
                    alert('يرجى تحديد مسابقة للحذف الجزئي.')
                    return
                }

                const { error } = await query
                if (error) throw error
                fetchAllData()
                alert('تم مسح السجلات بنجاح')
            } catch (err) {
                alert('خطأ في الحذف: ' + err.message)
            }
        })
    }

    const handleCSVImport = async (targetSchoolId, csvText) => {
        setImporting(true)
        try {
            const rows = csvText.split('\n').map(row => row.split(',').map(cell => cell.trim()))
            const headers = rows[0]
            const dataRows = rows.slice(1).filter(row => row.length >= 2 && row[0])

            const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name') || h.includes('الاسم'))
            const codeIdx = headers.findIndex(h => h.toLowerCase().includes('code') || h.includes('كود'))
            const gradeIdx = headers.findIndex(h => h.toLowerCase().includes('grade') || h.includes('صف'))
            const classIdx = headers.findIndex(h => h.toLowerCase().includes('class') || h.includes('فصل'))

            if (nameIdx === -1) throw new Error('الملف يجب أن يحتوي على عمود الاسم (name)')

            const studentsToInsert = dataRows.map(row => {
                return {
                    school_id: targetSchoolId,
                    name: row[nameIdx],
                    student_code: row[codeIdx] || generateSchoolCode(),
                    grade: row[gradeIdx] || '',
                    class_name: row[classIdx] || ''
                }
            })

            const { error } = await supabase.from('students').insert(studentsToInsert)
            if (error) throw error

            fetchAllData()
            setShowImportModal(false)
            alert(`تم استيراد ${studentsToInsert.length} طالب بنجاح`)
        } catch (err) {
            alert('خطأ في الاستيراد: ' + err.message)
        } finally {
            setImporting(false)
        }
    }

    const handleImportQuestions = async (jsContent) => {
        setImporting(true)
        try {
            let targetSubject = subjects.find(s => s.grade_id === importConfig.grade_id && s.master_subject_id === importConfig.master_subject_id)

            // Auto-create link if not exists
            if (!targetSubject) {
                console.log('Creating new subject link...', {
                    grade_id: importConfig.grade_id,
                    master_subject_id: importConfig.master_subject_id
                })

                const { data: newSubject, error: createError } = await supabase
                    .from('subjects')
                    .insert({
                        grade_id: importConfig.grade_id,
                        master_subject_id: importConfig.master_subject_id
                    })
                    .select()
                    .single()

                if (createError) {
                    console.error('Subject creation error:', createError)
                    throw new Error('فشل في إنشاء ربط المادة بالصف: ' + createError.message)
                }

                if (!newSubject || !newSubject.id) {
                    console.error('Subject created but no ID:', newSubject)
                    throw new Error('فشل في الحصول على معرف المادة بعد الإنشاء')
                }

                console.log('Subject created successfully:', newSubject)
                targetSubject = newSubject

                // Refresh local data and wait for it to complete
                await fetchAllData()

                // Double-check that the subject exists in the database
                const { data: verifySubject, error: verifyError } = await supabase
                    .from('subjects')
                    .select('id')
                    .eq('id', newSubject.id)
                    .single()

                if (verifyError || !verifySubject) {
                    console.error('Subject verification failed:', verifyError, verifySubject)
                    throw new Error('فشل في التحقق من إنشاء ربط المادة بالصف')
                }

                console.log('Subject verified in database:', verifySubject)
            }

            if (!targetSubject || !targetSubject.id) {
                console.error('No valid subject found:', targetSubject)
                throw new Error('لم يتم العثور على ربط المادة بالصف. يرجى التأكد من اختيار المادة والصف بشكل صحيح.')
            }

            console.log('Using subject:', targetSubject)

            // 1. Basic Cleaning
            let cleanedContent = jsContent.trim()
                .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1') // Remove comments

            // 2. Automated conversion of old-style convertMathToLatex template strings
            cleanedContent = cleanedContent.replace(/convertMathToLatex\(`(.*?)`\)/g, '"$1"')

            let questionsArray = []

            // 3. Attempt Parsing
            try {
                // Try JSON Parse first (cleanest)
                questionsArray = JSON.parse(cleanedContent)
            } catch (e) {
                // If JSON fails, it might be a JS-style object
                const arrayMatch = cleanedContent.match(/\[\s*\{[\s\S]*\}\s*\]/)
                let arrayStr = arrayMatch ? arrayMatch[0] : cleanedContent

                try {
                    // Create a "JSON-friendly" version of the string
                    const jsonReady = arrayStr
                        .replace(/([{,]\s*)["']?([a-zA-Z0-9_]+)["']?\s*:/g, '$1"$2":') // Normalize keys to "key":
                        .replace(/:\s*'([^']*)'/g, ': "$1"') // Single quotes to double for values
                        .replace(/,\s*([\]}])/g, '$1') // Remove trailing commas

                    questionsArray = JSON.parse(jsonReady)
                } catch (err2) {
                    // Fallback: Individual object extraction
                    const objectRegex = /\{[^ {}] * (["']?question["']?\s*:)[^{}]*(["'] ? answer["']?\s*:)[^{}]*\}/g
                    const matches = cleanedContent.match(objectRegex)
                    if (matches) {
                        questionsArray = matches.map(m => {
                            try {
                                const fixed = m
                                    .replace(/([{,]\s*)["']?([a-zA-Z0-9_]+)["']?\s*:/g, '$1"$2":')
                                    .replace(/'/g, '"')
                                    .replace(/,\s*([\]}])/g, '$1')
                                return JSON.parse(fixed)
                            } catch (err3) { return null }
                        }).filter(q => q !== null)
                    }
                }
            }

            if (questionsArray && !Array.isArray(questionsArray) && Array.isArray(questionsArray.questions)) {
                questionsArray = questionsArray.questions
            }

            if (!questionsArray || !Array.isArray(questionsArray) || questionsArray.length === 0) {
                if (typeof questionsArray === 'object' && !Array.isArray(questionsArray) && (questionsArray.question || questionsArray.content?.question)) {
                    questionsArray = [questionsArray]
                } else {
                    throw new Error('لم يتم العثور على أسئلة صالحة في الملف. يرجى التأكد من أن الملف يحتوي على مصفوفة من الأسئلة بالتنسيق المطلوب.')
                }
            }

            const questionsToInsert = questionsArray.map(q => {
                // Mapping legacy fields and new template fields
                const questionText = q.question || q.text || q.content?.question || q.content?.text;
                const options = q.options || q.choices || q.content?.options || q.content?.choices || [];

                // Handle correct answer - can be either index number or actual answer text
                let correctAnswer = q.answer || q.correct_answer || q.content?.correct;

                // If correct is a number (index), get the actual answer from options
                if (q.correct !== undefined && typeof q.correct === 'number') {
                    correctAnswer = options[q.correct];
                } else if (q.content?.correct !== undefined && typeof q.content.correct === 'number') {
                    correctAnswer = options[q.content.correct];
                }

                // Mapping difficulty with validation
                let difficulty = q.difficulty || 'medium';
                // Normalize legacy difficulty/level inputs
                if (difficulty === 'سهل') difficulty = 'easy';
                if (difficulty === 'متوسط') difficulty = 'medium';
                if (difficulty === 'صعب') difficulty = 'hard';
                if (difficulty === 'متفوقين' || difficulty === 'high_achievers') difficulty = 'talented';

                if (q.level === 1 || q.score === 1) difficulty = 'easy';
                if (q.level === 2 || q.score === 2) difficulty = 'medium';
                if (q.level === 3 || q.score === 3) difficulty = 'hard';
                if (q.level === 4 || q.score >= 4) difficulty = 'talented';

                // Ensure difficulty is one of the allowed values
                const validDifficulties = ['easy', 'medium', 'hard', 'talented', 'high_achievers'];
                if (!validDifficulties.includes(difficulty)) {
                    // Fallback map
                    if (difficulty === 'high_achievers') difficulty = 'talented';
                    else difficulty = 'medium';
                }

                // Auto-Calculate Score based on difficulty
                let calculatedScore = 1;
                if (difficulty === 'easy') calculatedScore = 1;
                if (difficulty === 'medium') calculatedScore = 2;
                if (difficulty === 'hard') calculatedScore = 3;
                if (difficulty === 'talented' || difficulty === 'high_achievers') calculatedScore = 4;

                return {
                    school_id: null,
                    // Legacy text columns (still required as NOT NULL)
                    grade: importConfig.grade_id,
                    subject: targetSubject.id,
                    // New UUID FK columns (for relationships)
                    grade_id: importConfig.grade_id,
                    subject_id: targetSubject.id,
                    content: {
                        question: convertMathToLatex(questionText),
                        options: options?.map(opt => convertMathToLatex(opt)),
                        image: q.image || q.content?.image || null,
                        week: parseInt(importConfig.week), // Using week from import config instead of JSON
                        score: calculatedScore // Auto-linked score
                    },
                    correct_answer: convertMathToLatex(correctAnswer),
                    difficulty: difficulty,
                    term: parseInt(q.term || importConfig.term)
                };
            }).filter(q => q.content.question && (q.correct_answer !== undefined && q.correct_answer !== null && q.correct_answer !== ""))

            if (questionsToInsert.length === 0) throw new Error('لا توجد بيانات أسئلة مكتملة في الملف.')

            if (!confirm(`سيتم استيراد ${questionsToInsert.length} سؤال كـ "محتوى عالمي". هل تريد الاستمرار؟`)) {
                setImporting(false)
                return
            }

            console.log('Questions to insert:', questionsToInsert.length)
            console.log('First question sample:', questionsToInsert[0])

            const { error } = await supabase.from('questions').insert(questionsToInsert)
            if (error) throw error

            fetchAllData()
            setShowImportQuestionsModal(false)
            alert(`تم استيراد ${questionsToInsert.length} سؤال بنجاح كـ "أسئلة عالمية"`)
        } catch (err) {
            alert('خطأ في استيراد الأسئلة: ' + err.message)
            console.error('Import Error:', err)
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col ltr">
            {/* Admin Sidebar/Topnav */}
            <header className="bg-slate-900 text-white p-6 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="bg-brand-primary p-2 rounded-lg text-2xl">⚙️</div>
                    <h1 className="text-xl font-black">لوحة الإدارة المركزية</h1>
                </div>
                <div className="flex items-center gap-6">
                    <span className="text-slate-400 text-sm">{user.full_name}</span>
                    <button onClick={onLogout} className="px-4 py-2 bg-slate-800 hover:bg-red-600 rounded-xl transition-all font-bold text-sm">
                        تسجيل الخروج
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row">
                {/* Side Navigation */}
                <nav className="w-full md:w-64 bg-white border-r border-slate-200 p-4 space-y-2">
                    <button
                        onClick={() => setActiveTab('schools')}
                        className={`w-full p-4 text-right rounded-xl font-bold transition-all flex items-center gap-3 ${activeTab === 'schools' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <span>🏫</span> المدارس
                    </button>
                    <button
                        onClick={() => setActiveTab('phases')}
                        className={`w-full p-4 text-right rounded-xl font-bold transition-all flex items-center gap-3 ${activeTab === 'phases' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <span>🎓</span> المراحل والصفوف
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full p-4 text-right rounded-xl font-bold transition-all flex items-center gap-3 ${activeTab === 'users' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <span>👥</span> المستخدمين
                    </button>
                    <button
                        onClick={() => setActiveTab('questions')}
                        className={`w-full p-4 text-right rounded-xl font-bold transition-all flex items-center gap-3 ${activeTab === 'questions' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <span>📝</span> الأسئلة
                    </button>
                    <button
                        onClick={() => setActiveTab('competitions')}
                        className={`w-full p-4 text-right rounded-xl font-bold transition-all flex items-center gap-3 ${activeTab === 'competitions' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <span>🏆</span> المسابقات
                    </button>
                    <button
                        onClick={() => setActiveTab('hall_of_fame')}
                        className={`w-full p-4 text-right rounded-xl font-bold transition-all flex items-center gap-3 ${activeTab === 'hall_of_fame' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <span>🎖️</span> لوحة الشرف
                    </button>
                    <button
                        onClick={() => setActiveTab('polls')}
                        className={`w-full p-4 text-right rounded-xl font-bold transition-all flex items-center gap-3 ${activeTab === 'polls' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <span>📊</span> التصويتات
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`w-full p-4 text-right rounded-xl font-bold transition-all flex items-center gap-3 ${activeTab === 'settings' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <span>⚙️</span> الإعدادات
                    </button>
                </nav>

                {/* Main Content Area */}
                <main className="flex-1 p-8 overflow-y-auto">
                    {activeTab === 'schools' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                            <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200 min-w-full">
                                <h3 className="text-xl font-bold mb-6 text-slate-800">إضافة مدرسة جديدة</h3>
                                <form onSubmit={handleAddSchool} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input
                                            type="text" placeholder="اسم المدرسة" required
                                            value={newSchool.name} onChange={e => setNewSchool({ ...newSchool, name: e.target.value })}
                                            className="p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                        <div className="relative">
                                            <input
                                                type="text" placeholder="كود المدرسة (8 أرقام)" required
                                                value={newSchool.school_code} onChange={e => setNewSchool({ ...newSchool, school_code: e.target.value })}
                                                className="w-full p-4 pr-28 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-mono ltr text-center tracking-widest"
                                            />
                                            <button
                                                type="button"
                                                onClick={generateSchoolCode}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all text-slate-600"
                                                title="توليد كود عشوائي"
                                            >
                                                🎲 توليد
                                            </button>
                                        </div>
                                        <input
                                            type="url" placeholder="رابط صفحة المدرسة (فيسبوك/موقع)"
                                            value={newSchool.page_link} onChange={e => setNewSchool({ ...newSchool, page_link: e.target.value })}
                                            className="p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                        <button type="submit" className="bg-slate-800 text-white rounded-xl font-bold hover:bg-brand-primary transition-all shadow-md py-4">
                                            حفظ وحفظ الربط
                                        </button>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                                        <label className="block text-sm font-bold text-slate-500 mb-4">ربط المدرسة بالمراحل التعليمية فوراً:</label>
                                        <div className="flex flex-wrap gap-3">
                                            {phases.map(phase => (
                                                <label key={phase.id} className={`flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer transition-all border ${selectedPhasesForNewSchool.includes(phase.id) ? 'bg-brand-primary border-brand-primary text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-primary'}`}>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={selectedPhasesForNewSchool.includes(phase.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedPhasesForNewSchool([...selectedPhasesForNewSchool, phase.id])
                                                            else setSelectedPhasesForNewSchool(selectedPhasesForNewSchool.filter(id => id !== phase.id))
                                                        }}
                                                    />
                                                    <span className="text-sm font-bold">{phase.name}</span>
                                                </label>
                                            ))}
                                            {phases.length === 0 && <span className="text-slate-400 text-xs italic">لا توجد مراحل دراسية مضافة حالياً</span>}
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* Quick Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-3xl text-white shadow-xl shadow-blue-200">
                                    <div className="text-3xl mb-1">🏫</div>
                                    <div className="text-3xl font-black">{schools.length}</div>
                                    <div className="text-blue-100 text-sm font-bold">إجمالي المدارس</div>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 rounded-3xl text-white shadow-xl shadow-emerald-200">
                                    <div className="text-3xl mb-1">👥</div>
                                    <div className="text-3xl font-black">{students.length}</div>
                                    <div className="text-emerald-100 text-sm font-bold">إجمالي الطلاب المسجلين</div>
                                </div>
                                <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-3xl text-white shadow-xl shadow-amber-200">
                                    <div className="text-3xl mb-1">🎓</div>
                                    <div className="text-3xl font-black">{phases.length}</div>
                                    <div className="text-amber-100 text-sm font-bold">المراحل التعليمية</div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="relative flex-1 w-full">
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40">🔍</span>
                                    <input
                                        type="text" placeholder="ابحث باسم المدرسة أو المرحلة (مثال: الإعدادية)..."
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full p-4 pr-12 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-brand-primary outline-none text-right font-bold"
                                    />
                                </div>
                            </div>

                            <div className="glass-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-700 text-lg">قائمة المدارس وتوزيع الطلاب</h3>
                                    <span className="text-xs bg-slate-200 px-3 py-1 rounded-full text-slate-600 font-bold">نتائج البحث: {filteredSchools.length}</span>
                                </div>
                                <table className="w-full text-right">
                                    <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="p-4 border-b">اسم المدرسة</th>
                                            <th className="p-4 border-b">المراحل</th>
                                            <th className="p-4 border-b">إحصائيات الطلاب (حسب المرحلة)</th>
                                            <th className="p-4 border-b">كود الدخول</th>
                                            <th className="p-4 border-b">الحالة</th>
                                            <th className="p-4 border-b text-center">الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {filteredSchools.map(school => (
                                            <tr key={school.id} className="hover:bg-slate-50">
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-700">{school.name}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1">{new Date(school.created_at).toLocaleDateString()}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {school.school_phases?.length > 0 ? (
                                                            school.school_phases.map(sp => (
                                                                <span key={sp.phase_id} className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded text-[10px] font-bold">
                                                                    {phases.find(p => p.id === sp.phase_id)?.name}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-slate-300 text-[10px]">لم يتم الربط</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        {Object.entries(getSchoolStudentStats(school.id)).length > 0 ? (
                                                            Object.entries(getSchoolStudentStats(school.id)).map(([pName, count]) => (
                                                                <div key={pName} className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                                                    <span className="text-[10px] font-bold text-slate-500">{pName}</span>
                                                                    <span className="text-[11px] font-black text-brand-primary bg-white px-2 rounded-lg shadow-sm">{count} طالباً</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="text-slate-300 text-[10px] italic pr-2">لا يوجد طلاب مسجلين</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4"><code className="bg-slate-100 px-3 py-1.5 rounded-lg text-brand-primary font-bold">{school.school_code}</code></td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${school.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {school.is_active ? 'نشط' : 'مجمدة'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => { setEditingSchool(school); setSelectedPhases(school.school_phases.map(sp => sp.phase_id)) }}
                                                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="تعديل المراحل"
                                                        >
                                                            📝
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleSchool(school.id, school.is_active)}
                                                            className={`p-2 rounded-lg transition-colors ${school.is_active ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-green-50 text-green-600'}`}
                                                            title={school.is_active ? 'تجميد المدرسة' : 'تنشيط المدرسة'}
                                                        >
                                                            {school.is_active ? '❄️' : '🔥'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSchool(school.id)}
                                                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors" title="حذف"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* School Edit Modal */}
                            {editingSchool && (
                                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 ltr">
                                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                                        <h3 className="text-xl font-bold mb-4 text-right">تعديل بيانات المدرسة</h3>

                                        <div className="space-y-4 mb-8 text-right">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2">اسم المدرسة</label>
                                                <input
                                                    type="text"
                                                    value={editingSchool.name}
                                                    onChange={e => setEditingSchool({ ...editingSchool, name: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2">كود المدرسة</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={editingSchool.school_code}
                                                        onChange={e => setEditingSchool({ ...editingSchool, school_code: e.target.value })}
                                                        className="w-full p-4 pr-28 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-mono ltr text-center tracking-widest"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingSchool({ ...editingSchool, school_code: Math.floor(10000000 + Math.random() * 90000000).toString() })}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all text-slate-600"
                                                        title="توليد كود جديد"
                                                    >
                                                        🎲 توليد جديد
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2">رابط صفحة المدرسة (فيسبوك)</label>
                                                <input
                                                    type="text"
                                                    value={editingSchool.page_link || ''}
                                                    onChange={e => setEditingSchool({ ...editingSchool, page_link: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary ltr text-left font-bold"
                                                    placeholder="https://facebook.com/your-school"
                                                />
                                            </div>

                                            <hr className="border-slate-100 my-6" />

                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2">ارتباط المراحل الدراسية</label>
                                                <div className="space-y-2 text-right">
                                                    {phases.map(phase => (
                                                        <label key={phase.id} className="flex flex-row-reverse items-center gap-3 p-3 border border-slate-50 rounded-xl hover:bg-slate-50 cursor-pointer transition-all">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedPhases.includes(phase.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedPhases([...selectedPhases, phase.id])
                                                                    else setSelectedPhases(selectedPhases.filter(id => id !== phase.id))
                                                                }}
                                                                className="w-4 h-4 accent-brand-primary"
                                                            />
                                                            <span className="text-sm font-bold">{phase.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => handleUpdateSchool(editingSchool.id, editingSchool, selectedPhases)}
                                                className="flex-1 py-3 bg-brand-primary text-white rounded-xl font-bold shadow-lg"
                                            >
                                                حفظ التغييرات
                                            </button>
                                            <button
                                                onClick={() => setEditingSchool(null)}
                                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'phases' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                            {/* Manage Phases */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200">
                                    <h3 className="text-xl font-bold mb-6 text-slate-800">إدارة المواد العامة (Master)</h3>
                                    <form onSubmit={handleAddMasterSubject} className="flex gap-4">
                                        <input
                                            type="text" placeholder="اسم المادة (مثال: رياضيات)" required
                                            value={newMasterSubject.name} onChange={e => setNewMasterSubject({ name: e.target.value })}
                                            className="flex-1 p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                        <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">إضافة</button>
                                    </form>
                                    <div className="mt-6 flex flex-wrap gap-3">
                                        {masterSubjects.map(ms => (
                                            <div key={ms.id} className="group flex items-center bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 overflow-hidden pr-4 pl-1 py-1 hover:bg-emerald-100 transition-all">
                                                <span>{ms.name}</span>
                                                <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleDeleteMasterSubject(ms.id)} className="p-1 hover:bg-white rounded-full" title="حذف">🗑️</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <hr className="my-8 border-slate-100" />

                                    <h3 className="text-xl font-bold mb-6 text-slate-800">إضافة مرحلة دراسية</h3>
                                    <form onSubmit={handleAddPhase} className="flex gap-4">
                                        <input
                                            type="text" placeholder="مثال: المرحلة الابتدائية" required
                                            value={newPhase.name} onChange={e => setNewPhase({ name: e.target.value })}
                                            className="flex-1 p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                        <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">حفظ</button>
                                    </form>
                                    <div className="mt-6 flex flex-wrap gap-3">
                                        {phases.map(p => (
                                            <div key={p.id} className="group flex items-center bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100 overflow-hidden pr-4 pl-1 py-1 hover:bg-blue-100 transition-all">
                                                <span>{p.name}</span>
                                                <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditingPhase(p)} className="p-1 hover:bg-white rounded-full" title="تعديل">✏️</button>
                                                    <button onClick={() => handleDeletePhase(p.id)} className="p-1 hover:bg-white rounded-full" title="حذف">🗑️</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200">
                                    <h3 className="text-xl font-bold mb-6 text-slate-800">إضافة صف دراسي</h3>
                                    <form onSubmit={handleAddGrade} className="space-y-4">
                                        <select
                                            required value={newGrade.phase_id} onChange={e => setNewGrade({ ...newGrade, phase_id: e.target.value })}
                                            className="w-full p-4 rounded-xl border border-slate-200 bg-white"
                                        >
                                            <option value="">اختر المرحلة</option>
                                            {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <div className="flex gap-4">
                                            <input
                                                type="text" placeholder="مثال: الصف الأول" required
                                                value={newGrade.name} onChange={e => setNewGrade({ ...newGrade, name: e.target.value })}
                                                className="flex-1 p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                            />
                                            <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">حفظ</button>
                                        </div>
                                    </form>

                                    <hr className="my-8 border-slate-100" />

                                    <h3 className="text-xl font-bold mb-6 text-slate-800">ربط مادة بصف دراسي</h3>
                                    <form onSubmit={handleAddSubject} className="space-y-4">
                                        <select
                                            required value={newSubject.grade_id} onChange={e => setNewSubject({ ...newSubject, grade_id: e.target.value })}
                                            className="w-full p-4 rounded-xl border border-slate-200 bg-white shadow-sm"
                                        >
                                            <option value="">اختر الصف الدراسي</option>
                                            {grades.map(g => <option key={g.id} value={g.id}>{g.educational_phases?.name} - {g.name}</option>)}
                                        </select>
                                        <div className="flex gap-4">
                                            <select
                                                required value={newSubject.master_subject_id} onChange={e => setNewSubject({ ...newSubject, master_subject_id: e.target.value })}
                                                className="flex-1 p-4 rounded-xl border border-slate-200 bg-white shadow-sm"
                                            >
                                                <option value="">اختر المادة العامة</option>
                                                {masterSubjects.map(ms => <option key={ms.id} value={ms.id}>{ms.name}</option>)}
                                            </select>
                                            <button type="submit" className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold shadow-md hover:bg-brand-primary/90">ربط</button>
                                        </div>
                                    </form>
                                </div>
                            </div>

                            {/* Grades & Subjects Table */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="glass-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-6 bg-slate-50 border-b border-slate-200">
                                        <h3 className="font-bold text-slate-700">دليل الصفوف الدراسية</h3>
                                    </div>
                                    <table className="w-full text-right">
                                        <thead className="bg-slate-50 text-slate-400 text-xs font-bold">
                                            <tr>
                                                <th className="p-4 border-b">المرحلة</th>
                                                <th className="p-4 border-b">الصف</th>
                                                <th className="p-4 border-b text-center">الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {grades.map(grade => (
                                                <tr key={grade.id} className="hover:bg-slate-50">
                                                    <td className="p-4"><span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500">{grade.educational_phases?.name}</span></td>
                                                    <td className="p-4 font-bold text-slate-700">{grade.name}</td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <button onClick={() => setEditingGrade(grade)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-all" title="تعديل">✏️</button>
                                                            <button onClick={() => handleDeleteGrade(grade.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all" title="حذف">🗑️</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="glass-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-6 bg-slate-50 border-b border-slate-200">
                                        <h3 className="font-bold text-slate-700">دليل المواد الدراسية</h3>
                                    </div>
                                    <table className="w-full text-right">
                                        <thead className="bg-slate-50 text-slate-400 text-xs font-bold">
                                            <tr>
                                                <th className="p-4 border-b">الصف</th>
                                                <th className="p-4 border-b">المادة</th>
                                                <th className="p-4 border-b text-center">الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {subjects.map(subject => {
                                                const gradeInfo = subject.grades
                                                const phaseName = gradeInfo?.educational_phases?.name || '---'
                                                const gradeName = gradeInfo?.name || '---'
                                                return (
                                                    <tr key={subject.id} className="hover:bg-slate-50">
                                                        <td className="p-4">
                                                            <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500 text-wrap">
                                                                {phaseName} - {gradeName}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 font-bold text-slate-700">{subject.master_subjects?.name || '---'}</td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex justify-center gap-2">
                                                                <button onClick={() => setEditingSubject(subject)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-all" title="تعديل">✏️</button>
                                                                <button onClick={() => handleDeleteSubject(subject.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all" title="حذف">🗑️</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                            <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                    <h3 className="text-xl font-bold text-slate-800">إضافة مستخدم (طالب / معلم)</h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowImportModal(true)}
                                        className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-200 transition-all flex items-center gap-2"
                                    >
                                        📥 استيراد طلاب CSV
                                    </button>
                                </div>
                                <form onSubmit={handleAddUser} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        <select
                                            value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                            className="p-4 rounded-xl border border-slate-200 bg-white font-bold"
                                        >
                                            <option value="student">طالب 🎓</option>
                                            <option value="teacher">معلم 👨‍🏫</option>
                                        </select>
                                        <select
                                            required value={newUser.school_id} onChange={e => setNewUser({ ...newUser, school_id: e.target.value })}
                                            className="p-4 rounded-xl border border-slate-200 bg-white"
                                        >
                                            <option value="">اختر المدرسة</option>
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <input
                                            type="text" placeholder="الاسم الكامل" required
                                            value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                            className="p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                        <div className="relative">
                                            <input
                                                type="text" placeholder="كود الدخول الشخصي" required
                                                value={newUser.code} onChange={e => setNewUser({ ...newUser, code: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary pl-12"
                                            />
                                            <button
                                                type="button"
                                                onClick={generateGlobalCode}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-lg"
                                                title="توليد كود تلقائي"
                                            >
                                                ✨
                                            </button>
                                        </div>
                                        <input
                                            type="text" placeholder="رقم الواتساب (اختياري)"
                                            value={newUser.whatsapp_number} onChange={e => setNewUser({ ...newUser, whatsapp_number: e.target.value })}
                                            className="p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                        />
                                    </div>
                                    {newUser.role === 'student' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <select
                                                required value={newUser.grade_id} onChange={e => setNewUser({ ...newUser, grade_id: e.target.value })}
                                                className="p-4 rounded-xl border border-slate-200 bg-white"
                                            >
                                                <option value="">اختر الصف الدراسي</option>
                                                {grades.map(g => <option key={g.id} value={g.id}>{g.educational_phases?.name} - {g.name}</option>)}
                                            </select>
                                            <input
                                                type="text" placeholder="الفصل (مثال: فصل أ)" required
                                                value={newUser.class_name} onChange={e => setNewUser({ ...newUser, class_name: e.target.value })}
                                                className="p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                            />
                                        </div>
                                    )}
                                    {newUser.role === 'teacher' && (
                                        <div className="grid grid-cols-1 gap-4">
                                            <select
                                                required value={newUser.master_subject_id} onChange={e => setNewUser({ ...newUser, master_subject_id: e.target.value })}
                                                className="p-4 rounded-xl border border-slate-200 bg-white"
                                            >
                                                <option value="">اختر التخصص (المادة العامة)</option>
                                                {masterSubjects.map(ms => (
                                                    <option key={ms.id} value={ms.id}>
                                                        {ms.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <button type="submit" className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold shadow-lg hover:scale-[1.01] transition-all">
                                        إضافة المستخدم إلى النظام
                                    </button>
                                </form>
                            </div>

                            <div className="flex flex-col gap-8">
                                {/* Teachers List */}
                                <div className="glass-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="font-bold text-slate-800">قائمة المعلمين</div>
                                        <div className="relative w-full md:w-64">
                                            <input
                                                type="text" placeholder="بحث باسم المعلم أو الكود..."
                                                value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                        </div>
                                    </div>
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                                            <tr><th className="p-4">الاسم</th><th className="p-4">المدرسة</th><th className="p-4">المادة</th><th className="p-4">الكود</th><th className="p-4">الواتساب</th><th className="p-4">الحالة</th><th className="p-4">الإجراءات</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()) || t.teacher_code.includes(teacherSearch)).map(t => (
                                                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-bold text-slate-700">{t.name}</td>
                                                    <td className="p-4 text-xs text-slate-500">{t.schools?.name}</td>
                                                    <td className="p-4 text-xs text-slate-500">{t.master_subjects?.name || <span className="text-slate-300">عام / غير محدد</span>}</td>
                                                    <td className="p-4"><code className="text-brand-primary font-bold bg-brand-primary/5 px-2 py-1 rounded-lg">{t.teacher_code}</code></td>
                                                    <td className="p-4 text-xs text-slate-500">{t.whatsapp_number || '---'}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${t.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {t.is_active !== false ? 'نشط' : 'معطل'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleSendWhatsAppCode(t.name, t.teacher_code, t.whatsapp_number, 'teacher', t.schools)}
                                                                className="p-1 hover:bg-green-50 rounded" title="إرسال عبر الواتساب"
                                                                disabled={!t.whatsapp_number}
                                                            >
                                                                📱
                                                            </button>
                                                            <button onClick={() => setEditingTeacher(t)} className="p-1 hover:bg-slate-200 rounded" title="تعديل">📝</button>
                                                            <button onClick={() => handleToggleTeacherStatus(t.id, t.is_active !== false)} className="p-1 hover:bg-slate-200 rounded" title={t.is_active !== false ? 'تعطيل' : 'تنشيط'}>
                                                                {t.is_active !== false ? '❄️' : '🔥'}
                                                            </button>
                                                            <button onClick={() => handleDeleteTeacher(t.id)} className="p-1 hover:bg-red-50 text-red-500 rounded" title="حذف">🗑️</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Students List */}
                                <div className="glass-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="font-bold text-slate-800">قائمة الطلاب</div>
                                        <div className="relative w-full md:w-64">
                                            <input
                                                type="text" placeholder="بحث باسم الطالب أو الكود..."
                                                value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                        </div>
                                    </div>
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                                            <tr><th className="p-4">الاسم</th><th className="p-4">المدرسة</th><th className="p-4">الصف / الفصل</th><th className="p-4 text-center">الكود</th><th className="p-4">الواتساب</th><th className="p-4">الحالة</th><th className="p-4">الإجراءات</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || (s.student_code && s.student_code.includes(studentSearch))).map(s => (
                                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-bold text-slate-700">{s.name}</td>
                                                    <td className="p-4 text-xs text-slate-500">{s.schools?.name}</td>
                                                    <td className="p-4 text-xs text-slate-500">{s.grade} - {s.class_name}</td>
                                                    <td className="p-4 text-center"><code className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg">{s.student_code || '---'}</code></td>
                                                    <td className="p-4 text-xs text-slate-500">{s.whatsapp_number || '---'}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${s.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {s.is_active !== false ? 'نشط' : 'معطل'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleSendWhatsAppCode(s.name, s.student_code, s.whatsapp_number, 'student', s.schools)}
                                                                className="p-1 hover:bg-green-50 rounded" title="إرسال عبر الواتساب"
                                                                disabled={!s.student_code || !s.whatsapp_number}
                                                            >
                                                                📱
                                                            </button>
                                                            <button onClick={() => setEditingStudent(s)} className="p-1 hover:bg-slate-200 rounded" title="تعديل">📝</button>
                                                            <button onClick={() => handleToggleStudentStatus(s.id, s.is_active !== false)} className="p-1 hover:bg-slate-200 rounded" title={s.is_active !== false ? 'تعطيل' : 'تنشيط'}>
                                                                {s.is_active !== false ? '❄️' : '🔥'}
                                                            </button>
                                                            <button onClick={() => handleDeleteStudent(s.id)} className="p-1 hover:bg-red-50 text-red-500 rounded" title="حذف">🗑️</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'questions' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                            <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-800">إدارة الأسئلة العالمية</h3>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={downloadQuestionTemplate}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors font-bold text-sm"
                                        >
                                            <span>📄</span>
                                            <span>تنزيل قالب الأسئلة</span>
                                        </button>
                                        <button
                                            onClick={() => setShowImportQuestionsModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors font-bold text-sm"
                                        >
                                            <span>📂</span>
                                            <span>استيراد أسئلة (JS)</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Statistics Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg">
                                    <div className="text-sm opacity-90 mb-1">إجمالي الأسئلة</div>
                                    <div className="text-3xl font-black">{allQuestions.length}</div>
                                </div>
                                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white shadow-lg">
                                    <div className="text-sm opacity-90 mb-1">أسئلة مدققة ✅</div>
                                    <div className="text-3xl font-black">{allQuestions.filter(q => q.is_audited).length}</div>
                                </div>
                                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-lg">
                                    <div className="text-sm opacity-90 mb-1">غير مدققة ⚠️</div>
                                    <div className="text-3xl font-black">{allQuestions.filter(q => !q.is_audited).length}</div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg">
                                    <div className="text-sm opacity-90 mb-1">نسبة التدقيق</div>
                                    <div className="text-3xl font-black">
                                        {allQuestions.length > 0 ? Math.round((allQuestions.filter(q => q.is_audited).length / allQuestions.length) * 100) : 0}%
                                    </div>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                                <select
                                    value={qFilters.grade}
                                    onChange={e => setQFilters({ ...qFilters, grade: e.target.value })}
                                    className="p-3 rounded-xl border border-slate-200 text-sm bg-white"
                                >
                                    <option value="">كل الصفوف</option>
                                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                                <select
                                    value={qFilters.subject}
                                    onChange={e => setQFilters({ ...qFilters, subject: e.target.value })}
                                    className="p-3 rounded-xl border border-slate-200 text-sm bg-white"
                                >
                                    <option value="">كل المواد</option>
                                    {subjects
                                        .filter(s => !qFilters.grade || s.grade_id === qFilters.grade)
                                        .map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.master_subjects?.name} {!qFilters.grade && `- ${s.grades?.name}`}
                                            </option>
                                        ))}
                                </select>
                                <select
                                    value={qFilters.difficulty}
                                    onChange={e => setQFilters({ ...qFilters, difficulty: e.target.value })}
                                    className="p-3 rounded-xl border border-slate-200 text-sm bg-white"
                                >
                                    <option value="">كل المستويات</option>
                                    <option value="easy">سهل</option>
                                    <option value="medium">متوسط</option>
                                    <option value="hard">صعب</option>
                                    <option value="talented">متفوقين</option>
                                </select>
                                <select
                                    value={qFilters.term}
                                    onChange={e => setQFilters({ ...qFilters, term: e.target.value })}
                                    className="p-3 rounded-xl border border-slate-200 text-sm bg-white"
                                >
                                    <option value="">كل الأترام</option>
                                    <option value="1">الترم الأول</option>
                                    <option value="2">الترم الثاني</option>
                                </select>
                                <select
                                    value={qFilters.week}
                                    onChange={e => setQFilters({ ...qFilters, week: e.target.value })}
                                    className="p-3 rounded-xl border border-slate-200 text-sm bg-white font-bold text-brand-primary"
                                >
                                    <option value="">كل الأسابيع</option>
                                    {[...Array(20)].map((_, i) => (
                                        <option key={i + 1} value={i + 1}>الأسبوع {i + 1}</option>
                                    ))}
                                </select>
                                <select
                                    value={qFilters.audited || ''}
                                    onChange={e => setQFilters({ ...qFilters, audited: e.target.value })}
                                    className="p-3 rounded-xl border border-slate-200 text-sm bg-white font-bold"
                                >
                                    <option value="">كل الأسئلة</option>
                                    <option value="true">مدققة فقط ✅</option>
                                    <option value="false">غير مدققة فقط ⚠️</option>
                                </select>
                            </div>

                            {/* Analytical Statistics */}
                            <div className="mb-8 animate-in fade-in slide-in-from-bottom duration-500">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-6 w-1 bg-brand-primary rounded-full"></div>
                                    <h4 className="font-black text-slate-700">إحصائيات تحليلية (حسب الفلتر) 📊</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <div className="glass-card p-4 rounded-2xl border-r-4 border-r-indigo-500 bg-indigo-50/30">
                                        <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">عدد المسابقات</div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-black text-indigo-600">
                                                {competitions.filter(c => {
                                                    const gradeMatch = !qFilters.grade || c.grade_id === qFilters.grade
                                                    const subjectMatch = !qFilters.subject || c.subject_id === qFilters.subject
                                                    const termMatch = !qFilters.term || c.term === parseInt(qFilters.term)
                                                    const weekMatch = !qFilters.week || (parseInt(qFilters.week) >= c.start_week && parseInt(qFilters.week) <= c.end_week)
                                                    return gradeMatch && subjectMatch && termMatch && weekMatch
                                                }).length}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500">مسابقة</span>
                                        </div>
                                    </div>
                                    <div className="glass-card p-4 rounded-2xl border-r-4 border-r-green-500 bg-green-50/30">
                                        <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">أسئلة سهلة</div>
                                        <div className="text-2xl font-black text-green-600">
                                            {filteredQuestions.filter(q => q.difficulty === 'easy').length}
                                        </div>
                                    </div>
                                    <div className="glass-card p-4 rounded-2xl border-r-4 border-r-blue-500 bg-blue-50/30">
                                        <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">أسئلة متوسطة</div>
                                        <div className="text-2xl font-black text-blue-600">
                                            {filteredQuestions.filter(q => q.difficulty === 'medium').length}
                                        </div>
                                    </div>
                                    <div className="glass-card p-4 rounded-2xl border-r-4 border-r-rose-500 bg-rose-50/30">
                                        <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">أسئلة صعبة</div>
                                        <div className="text-2xl font-black text-rose-600">
                                            {filteredQuestions.filter(q => q.difficulty === 'hard').length}
                                        </div>
                                    </div>
                                    <div className="glass-card p-4 rounded-2xl border-r-4 border-r-purple-500 bg-purple-50/30">
                                        <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase">أسئلة متفوقين</div>
                                        <div className="text-2xl font-black text-purple-600">
                                            {filteredQuestions.filter(q => (q.difficulty === 'talented' || q.difficulty === 'متفوقين')).length}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-slate-50 text-slate-400 font-bold border-b">
                                        <tr>
                                            <th className="p-4">نص السؤال</th>
                                            <th className="p-4">المادة/الصف</th>
                                            <th className="p-4">المستوى</th>
                                            <th className="p-4 text-center">حالة التدقيق</th>
                                            <th className="p-4 text-center">الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredQuestions.map(q => (
                                            <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 max-w-xs truncate font-bold text-slate-700" dangerouslySetInnerHTML={{ __html: convertMathToLatex(q.content?.question || '---') }}></td>
                                                <td className="p-4 text-xs text-slate-500">
                                                    {q.subjects?.master_subjects?.name || '---'} <br />
                                                    <span className="text-[10px] opacity-70">{q.grades?.name || '---'} - الترم {q.term}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                        q.difficulty === 'medium' ? 'bg-blue-100 text-blue-700' :
                                                            q.difficulty === 'hard' ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'
                                                        }`}>
                                                        {q.difficulty === 'easy' ? 'سهل' : q.difficulty === 'medium' ? 'متوسط' : q.difficulty === 'hard' ? 'صعب' : 'متفوقين'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${q.is_audited ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {q.is_audited ? '✅ مدقق' : '⚠️ غير مدقق'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => setPreviewQuestion(q)} className="p-1 hover:bg-blue-50 text-blue-500 rounded" title="معاينة">👁️</button>
                                                        <button onClick={() => handleDeleteQuestion(q.id)} className="p-1 hover:bg-red-50 text-red-500 rounded" title="حذف">🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredQuestions.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-slate-400 italic">لا توجد أسئلة تطابق هذه الفلاتر</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div >
                    )
                    }

                    {
                        activeTab === 'competitions' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                                {/* Competition Builder Card */}
                                <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200">
                                    <h3 className="text-xl font-bold mb-6 text-slate-800">إنشاء مسابقة جديدة 🏗️</h3>
                                    <form onSubmit={handleAddCompetition} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                                            <div className="md:col-span-2 lg:col-span-2">
                                                <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">عنوان المسابقة</label>
                                                <input
                                                    type="text" placeholder="مثال: مسابقة العبافرة - الأسبوع الأول" required
                                                    value={newCompetition.title} onChange={e => setNewCompetition({ ...newCompetition, title: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-bold"
                                                />
                                            </div>
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">الصف الدراسي</label>
                                                <select
                                                    required value={newCompetition.grade_id} onChange={e => setNewCompetition({ ...newCompetition, grade_id: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold"
                                                >
                                                    <option value="">اختر الصف</option>
                                                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">المادة</label>
                                                <select
                                                    required value={newCompetition.subject_id} onChange={e => setNewCompetition({ ...newCompetition, subject_id: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold"
                                                >
                                                    <option value="">اختر المادة</option>
                                                    {subjects.filter(s => s.grade_id === newCompetition.grade_id).map(s => (
                                                        <option key={s.id} value={s.id}>{s.master_subjects?.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">الترم</label>
                                                <select
                                                    value={newCompetition.term} onChange={e => setNewCompetition({ ...newCompetition, term: parseInt(e.target.value) })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold"
                                                >
                                                    <option value={1}>الترم 1</option>
                                                    <option value={2}>الترم 2</option>
                                                </select>
                                            </div>
                                            <div className="lg:col-span-1">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-2">من أسبوع</label>
                                                        <input
                                                            type="number" min="1" max="20"
                                                            value={newCompetition.start_week} onChange={e => setNewCompetition({ ...newCompetition, start_week: parseInt(e.target.value) })}
                                                            className="w-full p-4 px-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-bold text-center"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-2">إلى أسبوع</label>
                                                        <input
                                                            type="number" min="1" max="20"
                                                            value={newCompetition.end_week} onChange={e => setNewCompetition({ ...newCompetition, end_week: parseInt(e.target.value) })}
                                                            className="w-full p-4 px-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-bold text-center"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quotas Section */}
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                            <h4 className="text-sm font-black text-slate-500 mb-4 flex items-center gap-2">
                                                <span>📊</span> توزيع صعوبة الأسئلة (الكيوتة)
                                            </h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {[
                                                    { key: 'easy_q', label: 'سهل (Easy)', color: 'green', diff: 'easy' },
                                                    { key: 'medium_q', label: 'متوسط (Medium)', color: 'blue', diff: 'medium' },
                                                    { key: 'hard_q', label: 'صعب (Hard)', color: 'rose', diff: 'hard' },
                                                    { key: 'talented_q', label: 'متفوقين (Talented)', color: 'purple', diff: 'talented' }
                                                ].map(item => {
                                                    const available = getAvailableQuestions(item.diff);
                                                    const requested = newCompetition[item.key];
                                                    const isExceeded = requested > available;
                                                    return (
                                                        <div key={item.key}>
                                                            <label className={`block text-[10px] font-bold text-${item.color}-600 mb-1 mr-1`}>{item.label}</label>
                                                            <input
                                                                type="number" min="0"
                                                                value={requested}
                                                                onChange={e => setNewCompetition({ ...newCompetition, [item.key]: parseInt(e.target.value) || 0 })}
                                                                className={`w-full p-3 rounded-xl border ${isExceeded ? 'border-red-500 bg-red-50' : 'border-slate-200'} text-center font-bold`}
                                                            />
                                                            <div className={`mt-1 text-[9px] font-bold text-right px-1 ${isExceeded ? 'text-red-600' : 'text-slate-400'}`}>
                                                                متاح: {available} {isExceeded && '(غير كافٍ)'}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-4 text-[10px] text-slate-400 italic font-bold">
                                                إجمالي الأسئلة: {newCompetition.easy_q + newCompetition.medium_q + newCompetition.hard_q + newCompetition.talented_q} سؤال سيتم اختيارها عشوائياً لكل طالب.
                                            </div>
                                        </div>

                                        {/* Timer & Attempts Section */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                                                <h4 className="text-sm font-black text-amber-700 mb-4 flex items-center gap-2">
                                                    <span>⏱️</span> نظام التوقيت
                                                </h4>
                                                <div className="space-y-3">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="timer_type" value="total" checked={newCompetition.timer_type === 'total'} onChange={e => setNewCompetition({ ...newCompetition, timer_type: e.target.value })} className="accent-amber-600" />
                                                        <span className="text-xs font-bold text-amber-900">وقت كلي للمسابقة</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="timer_type" value="per_question" checked={newCompetition.timer_type === 'per_question'} onChange={e => setNewCompetition({ ...newCompetition, timer_type: e.target.value })} className="accent-amber-600" />
                                                        <span className="text-xs font-bold text-amber-900">وقت محدد لكل سؤال</span>
                                                    </label>
                                                    <div className="mt-4">
                                                        <label className="block text-[10px] font-bold text-amber-600 mb-1 mr-1">
                                                            {newCompetition.timer_type === 'total' ? 'المدة الكلية (بالدقائق)' : 'وقت السؤال الواحد (بالدقائق)'}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={Math.floor(newCompetition.duration / 60)}
                                                            onChange={e => {
                                                                const mins = parseInt(e.target.value) || 0;
                                                                setNewCompetition({ ...newCompetition, duration: mins * 60 });
                                                            }}
                                                            className="w-full p-3 rounded-xl border border-amber-200 bg-white text-center font-bold text-amber-900"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="md:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between">
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                                                        <span>🔄</span> إعدادات المحاولات
                                                    </h4>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1">
                                                            <label className="block text-[10px] font-bold text-slate-400 mb-1 mr-1">الحد الأقصى للمحاولات</label>
                                                            <input type="number" min="1" value={newCompetition.max_attempts} onChange={e => setNewCompetition({ ...newCompetition, max_attempts: parseInt(e.target.value) })} className="w-full p-4 rounded-xl border border-slate-200 text-center font-black text-slate-800" />
                                                        </div>
                                                        <p className="flex-1 text-xs text-slate-400 leading-tight">
                                                            يتحكم هذا الخيار في عدد المرات التي يسمح فيها للطالب بدخول هذه المسابقة.
                                                        </p>
                                                    </div>
                                                </div>
                                                <button type="submit" className="mt-6 w-full py-4 bg-slate-800 text-white rounded-xl font-black shadow-lg hover:bg-brand-primary hover:scale-[1.01] transition-all flex items-center justify-center gap-3">
                                                    <span>🚀</span> إنشاء المسابقة وتفعيلها لاحقاً
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </div>

                                {/* Competitions List */}
                                <div className="glass-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                        <h3 className="font-black text-slate-700 text-lg flex items-center gap-2">
                                            <span>🏁</span> المسابقات الجارية والسابقة
                                        </h3>
                                        <div className="relative">
                                            <input
                                                type="text" placeholder="بحث باسم المسابقة..."
                                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                                className="p-2 pr-10 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-brand-primary"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-right">
                                            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase">
                                                <tr>
                                                    <th className="p-4">المسابقة</th>
                                                    <th className="p-4">الصف / المادة</th>
                                                    <th className="p-4">توزيع الأسئلة</th>
                                                    <th className="p-4">نظام التوقيت</th>
                                                    <th className="p-4">المحاولات</th>
                                                    <th className="p-4 text-center">الحالة</th>
                                                    <th className="p-4 text-center">الإجراءات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {filteredCompetitions.map(comp => (
                                                    <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-4">
                                                            <div className="font-black text-slate-800">{comp.title}</div>
                                                            <div className="text-[10px] text-slate-400">تاريخ الإنشاء: {new Date(comp.created_at).toLocaleDateString()}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="text-xs font-bold text-slate-600">{comp.grades?.name}</div>
                                                            <div className="text-[10px] text-brand-primary font-black">
                                                                {comp.subjects?.master_subjects?.name} - {comp.start_week === comp.end_week ? `الأسبوع ${comp.start_week}` : `الأسابيع ${comp.start_week}-${comp.end_week}`}
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex gap-1">
                                                                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[9px] font-bold border border-green-100">S:{comp.easy_q}</span>
                                                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-100">M:{comp.medium_q}</span>
                                                                <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold border border-rose-100">H:{comp.hard_q}</span>
                                                                <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold border border-purple-100">T:{comp.talented_q}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="text-[10px] font-bold text-slate-500">
                                                                {comp.timer_type === 'total' ? '⏱️ وقت كلي:' : '⏱️ لكل سؤال:'} <span className="text-slate-800">{comp.duration / 60}د</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center font-black text-slate-700">{comp.max_attempts}</td>
                                                        <td className="p-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleCompetition(comp)}
                                                                className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${comp.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                                            >
                                                                {comp.is_active ? '✅ نشطة' : '🛑 معطلة'}
                                                            </button>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex justify-center gap-2">
                                                                <button type="button" onClick={() => setEditingCompetition(comp)} className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors" title="تعديل المسابقة">✏️</button>
                                                                <button type="button" onClick={() => { setSelectedCompetitionResults(comp); setShowResultsModal(true); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="استعراض النتائج">📊</button>
                                                                <button type="button" onClick={() => handleDeleteCompetition(comp.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors" title="حذف بالكامل">🗑️</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {filteredCompetitions.length === 0 && (
                                                    <tr>
                                                        <td colSpan="7" className="p-12 text-center text-slate-400 italic">لا توجد مسابقات حالياً. ابدأ بإنشاء واحدة!</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                    {activeTab === 'hall_of_fame' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                            {/* HOF Navigation & Filters */}
                            <div className="glass-card p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                                    <button
                                        onClick={() => setHofMode('competition')}
                                        className={`px-6 py-2.5 rounded-xl font-black transition-all ${hofMode === 'competition' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        لوحة مسابقة محددة
                                    </button>
                                    <button
                                        onClick={() => setHofMode('cumulative')}
                                        className={`px-6 py-2.5 rounded-xl font-black transition-all ${hofMode === 'cumulative' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        اللوحة التراكمية
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-3 items-center">
                                    <select
                                        value={hofSelectedGrade} onChange={e => setHofSelectedGrade(e.target.value)}
                                        className="p-3 rounded-xl border border-slate-200 bg-white font-bold text-xs outline-none"
                                    >
                                        <option value="">كل الصفوف</option>
                                        {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>

                                    {hofMode === 'competition' && (
                                        <select
                                            value={hofSelectedCompetition} onChange={e => setHofSelectedCompetition(e.target.value)}
                                            className="p-3 rounded-xl border border-slate-200 bg-white font-bold text-xs outline-none max-w-[200px]"
                                        >
                                            <option value="">اختر المسابقة</option>
                                            {competitions.filter(c => !hofSelectedGrade || c.grade_id === hofSelectedGrade).map(c => (
                                                <option key={c.id} value={c.id}>{c.title}</option>
                                            ))}
                                        </select>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400">العدد:</span>
                                        <input
                                            type="number" value={hofLimit} onChange={e => setHofLimit(parseInt(e.target.value) || 10)}
                                            className="w-16 p-2 rounded-xl border border-slate-200 text-center font-bold text-xs"
                                        />
                                    </div>

                                    <button
                                        onClick={handleDeleteHofRecords}
                                        className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                                        title="مسح السجلات المعروضة"
                                    >
                                        🗑️ مسح
                                    </button>
                                </div>
                            </div>

                            {/* Leaderboard Table */}
                            <div className="glass-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                                    <div className="text-2xl">🏆</div>
                                    <h3 className="font-black text-slate-700 text-lg">
                                        {hofMode === 'competition' ? 'أوائل المسابقة' : 'الأوائل التراكمي (إجمالي النقاط)'}
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right">
                                        <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase">
                                            <tr>
                                                <th className="p-4 text-center">المركز</th>
                                                <th className="p-4">الطالب</th>
                                                <th className="p-4">المدرسة</th>
                                                <th className="p-4">الصف - الفصل</th>
                                                <th className="p-4 text-center">{hofMode === 'cumulative' ? 'إجمالي النقاط' : 'الدرجة'}</th>
                                                {hofMode === 'competition' && <th className="p-4 text-center">الوقت المستغرق</th>}
                                                {hofMode === 'cumulative' && <th className="p-4 text-center">عدد المحاولات</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {getHofLeaderboard().map((row, index) => {
                                                const student = hofMode === 'cumulative' ? row.student : row.students;
                                                const rank = index + 1;
                                                const isMedal = rank <= 3;
                                                const medalEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';

                                                return (
                                                    <tr key={hofMode === 'cumulative' ? student?.id : row.id} className={`${isMedal ? 'bg-amber-50/30' : ''} hover:bg-slate-50 transition-colors`}>
                                                        <td className="p-4 text-center">
                                                            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm ${isMedal ? 'text-2xl' : 'bg-slate-100 text-slate-500'}`}>
                                                                {isMedal ? medalEmoji : rank}
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-black text-slate-800">{student?.name || 'مستخدم غير معروف'}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="text-xs font-bold text-slate-500">{student?.schools?.name || '---'}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="text-xs font-bold text-slate-600">
                                                                {student?.grades?.name} {student?.class_name && `- ${student.class_name}`}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className={`font-black text-lg ${rank === 1 ? 'text-amber-600' : 'text-slate-700'}`}>
                                                                {row.score}
                                                            </div>
                                                        </td>
                                                        {hofMode === 'competition' && (
                                                            <td className="p-4 text-center">
                                                                <div className="text-xs font-bold text-slate-400">
                                                                    {Math.floor(row.time_spent / 60)}د {row.time_spent % 60}ث
                                                                </div>
                                                            </td>
                                                        )}
                                                        {hofMode === 'cumulative' && (
                                                            <td className="p-4 text-center">
                                                                <div className="text-sm font-bold text-slate-500">
                                                                    {row.count} محاولة
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                            {getHofLeaderboard().length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                                                        لا توجد بيانات متاحة حالياً للعرض.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'polls' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                            <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200 min-w-full">
                                <h3 className="text-xl font-bold mb-6 text-slate-800">إنشاء تصويت جديد</h3>
                                <form onSubmit={handleAddPoll} className="space-y-6">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 mr-1">توجيه التصويت لـ:</label>
                                                <select
                                                    value={newPoll.school_id || ''}
                                                    onChange={e => setNewPoll({ ...newPoll, school_id: e.target.value || null })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-right font-bold bg-white"
                                                >
                                                    <option value="">كافة المدارس (عام) 🌍</option>
                                                    {schools.map(school => (
                                                        <option key={school.id} value={school.id}>{school.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 mr-1">سؤال التصويت:</label>
                                                <input
                                                    type="text" placeholder="مثال: ما رأيك في صعوبة مسابقة هذا الأسبوع؟" required
                                                    value={newPoll.question} onChange={e => setNewPoll({ ...newPoll, question: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-right font-bold"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-sm font-bold text-slate-500 mr-1">خيارات التصويت:</label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {newPoll.options.map((option, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <input
                                                            type="text" placeholder={`الخيار ${idx + 1}`} required
                                                            value={option} onChange={e => {
                                                                const next = [...newPoll.options]
                                                                next[idx] = e.target.value
                                                                setNewPoll({ ...newPoll, options: next })
                                                            }}
                                                            className="flex-1 p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-right"
                                                        />
                                                        {newPoll.options.length > 2 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setNewPoll({ ...newPoll, options: newPoll.options.filter((_, i) => i !== idx) })}
                                                                className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => setNewPoll({ ...newPoll, options: [...newPoll.options, ''] })}
                                                    className="p-3 border-2 border-dashed border-slate-200 text-slate-400 rounded-xl font-bold hover:border-brand-primary hover:text-brand-primary transition-all"
                                                >
                                                    + إضافة خيار جديد
                                                </button>
                                            </div>
                                        </div>

                                        <button type="submit" className="bg-slate-800 text-white rounded-xl font-bold hover:bg-brand-primary transition-all shadow-md py-4 mt-2">
                                            نشر التصويت للطلاب
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="glass-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-6 bg-slate-50 border-b border-slate-200">
                                    <h3 className="font-bold text-slate-700 text-lg">التصويتات الحالية والنتائج</h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {polls.map(poll => {
                                        const results = pollResults[poll.id] || {}
                                        const totalVotes = Object.values(results).reduce((a, b) => a + b, 0)

                                        return (
                                            <div key={poll.id} className="p-8 hover:bg-slate-50 transition-all">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => handleDeletePoll(poll.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="حذف"
                                                        >
                                                            🗑️
                                                        </button>
                                                        <button
                                                            onClick={() => setShowPollDetailsModal(poll)}
                                                            className="p-2 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded-xl transition-all"
                                                            title="عرض تفاصيل المصوتين"
                                                        >
                                                            👁️
                                                        </button>
                                                        <button
                                                            onClick={() => handleTogglePoll(poll)}
                                                            className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${poll.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}
                                                        >
                                                            {poll.is_active ? 'نشط الآن' : 'غير نشط'}
                                                        </button>
                                                    </div>
                                                    <div className="text-right flex-1 px-4">
                                                        <h4 className="font-black text-xl text-slate-800 mb-2">{poll.question}</h4>
                                                        <div className="flex justify-end gap-3 text-xs font-bold">
                                                            <span className="text-slate-400">تاريخ النشر: {new Date(poll.created_at).toLocaleDateString()}</span>
                                                            <span className="text-slate-300">|</span>
                                                            <span className="text-slate-400">إجمالي الأصوات: {totalVotes}</span>
                                                            <span className="text-slate-300">|</span>
                                                            <span className={poll.school_id ? "text-brand-primary" : "text-emerald-500"}>
                                                                🎯 الموجه لـ: {poll.school_id ? (schools.find(s => s.id === poll.school_id)?.name || 'مدرسة غير معروفة') : 'كافة المدارس'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                                    {poll.options.map((opt, idx) => {
                                                        const votes = results[idx] || 0
                                                        const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
                                                        return (
                                                            <div key={idx} className="space-y-2">
                                                                <div className="flex justify-between text-xs font-bold">
                                                                    <span className="text-brand-primary">{percent}% ({votes} صوت)</span>
                                                                    <span className="text-slate-600">{opt}</span>
                                                                </div>
                                                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                                    <div
                                                                        className="h-full bg-brand-primary transition-all duration-1000"
                                                                        style={{ width: `${percent}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {polls.length === 0 && (
                                        <div className="p-12 text-center text-slate-400 italic">لا توجد تصويتات مضافة حالياً.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Change Password Card */}
                                <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-brand-primary/10 rounded-2xl text-2xl">🔒</div>
                                        <h3 className="text-xl font-bold text-slate-800">تغيير كلمة المرور</h3>
                                    </div>
                                    <div className="space-y-4 text-right" dir="rtl">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">كلمة المرور الجديدة</label>
                                            <input
                                                type="password" value={settingsNewPassword} onChange={e => setSettingsNewPassword(e.target.value)}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-right"
                                                placeholder="أدخل كلمة المرور الجديدة"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">تأكيد كلمة المرور</label>
                                            <input
                                                type="password" value={settingsConfirmPassword} onChange={e => setSettingsConfirmPassword(e.target.value)}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-right"
                                                placeholder="أعد كتابة كلمة المرور"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (!settingsNewPassword || settingsNewPassword !== settingsConfirmPassword) {
                                                    alert('كلمات المرور غير متطابقة أو فارغة')
                                                    return
                                                }
                                                startSecurityChallenge(async () => {
                                                    const { error } = await supabase.from('admins').update({ password_hash: settingsNewPassword }).eq('id', user.id)
                                                    if (error) alert('خطأ في التحديث: ' + error.message)
                                                    else {
                                                        alert('تم تغيير كلمة المرور بنجاح. يرجى استخدامها في المرة القادمة.')
                                                        setSettingsNewPassword('')
                                                        setSettingsConfirmPassword('')
                                                    }
                                                })
                                            }}
                                            className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                        >
                                            تحديث كلمة المرور
                                        </button>
                                    </div>
                                </div>

                                {/* Global Data Management Card */}
                                <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-red-100 rounded-2xl text-2xl">⚠️</div>
                                        <h3 className="text-xl font-bold text-slate-800">إدارة البيانات العامة</h3>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-sm leading-relaxed font-bold border border-red-100 text-right">
                                            تحذير: هذه العمليات نهائية ولا يمكن التراجع عنها. سيتم حذف جميع نتائج الطلاب من كافة المسابقات.
                                        </div>
                                        <button
                                            onClick={() => {
                                                startSecurityChallenge(async () => {
                                                    if (!confirm('هل أنت متأكد من مسح جميع نتائج الطلاب بالكامل من النظام؟')) return
                                                    const { error } = await supabase.from('results').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                                                    if (error) alert('خطأ في الحذف: ' + error.message)
                                                    else {
                                                        alert('تم مسح جميع سجلات النتائج بنجاح')
                                                        fetchAllData()
                                                    }
                                                })
                                            }}
                                            className="w-full py-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 shadow-md transition-all"
                                        >
                                            🔥 مسح كافة نتائج الطلاب (تصفير اللوحة)
                                        </button>

                                        <div className="pt-4 border-t border-red-100 flex flex-col gap-3">
                                            <button
                                                onClick={() => {
                                                    startSecurityChallenge(async () => {
                                                        if (!confirm('سيتم حذف جميع حسابات الطلاب المسجلين بالكامل. هل أنت متأكد؟')) return
                                                        const { error } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                                                        if (error) alert('خطأ: ' + error.message)
                                                        else { alert('تم حذف جميع الطلاب بنجاح'); fetchAllData(); }
                                                    })
                                                }}
                                                className="w-full py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-50 transition-all"
                                            >
                                                🗑️ حذف جميع أسماء الطلاب
                                            </button>

                                            <button
                                                onClick={() => {
                                                    startSecurityChallenge(async () => {
                                                        if (!confirm('سيتم حذف جميع حسابات المعلمين المسجلين. هل أنت متأكد؟')) return
                                                        const { error } = await supabase.from('teachers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                                                        if (error) alert('خطأ: ' + error.message)
                                                        else { alert('تم حذف جميع المعلمين بنجاح'); fetchAllData(); }
                                                    })
                                                }}
                                                className="w-full py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-50 transition-all"
                                            >
                                                👨‍🏫 حذف جميع أسماء المعلمين
                                            </button>

                                            <button
                                                onClick={() => {
                                                    startSecurityChallenge(async () => {
                                                        if (!confirm('تنبيه: حذف المدارس سيؤدي لحذف كافة البيانات المرتبطة بها (طلاب، معلمين، نتائج). هل أنت متأكد تماماً؟')) return
                                                        const { error } = await supabase.from('schools').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                                                        if (error) alert('خطأ: ' + error.message)
                                                        else { alert('تم حذف جميع المدارس بنجاح'); fetchAllData(); }
                                                    })
                                                }}
                                                className="w-full py-3 bg-white text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-50 transition-all"
                                            >
                                                🏫 حذف جميع المدارس وبياناتها
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* WhatsApp Template Management Card */}
                                <div className="glass-card p-8 rounded-3xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-brand-primary/10 rounded-2xl text-2xl">📱</div>
                                        <h3 className="text-xl font-bold text-slate-800">تخصيص رسالة الواتساب</h3>
                                    </div>
                                    <div className="space-y-4 text-right" dir="rtl">
                                        <div className="p-4 bg-blue-50 text-blue-700 rounded-2xl text-[11px] font-bold leading-relaxed border border-blue-100">
                                            استخدم الرموز التالية ليتم استبدالها تلقائياً:<br />
                                            اسم الطالب/المعلم : <span className="text-brand-primary">{"{name}"}</span><br />
                                            كود الدخول : <span className="text-brand-primary">{"{code}"}</span><br />
                                            (طالب أو معلم) : <span className="text-brand-primary">{"{role}"}</span><br />
                                            رابط الموقع : <span className="text-brand-primary">{"{link}"}</span><br />
                                            كود المدرسة : <span className="text-brand-primary">{"{school_code}"}</span><br />
                                            رابط صفحة المدرسة : <span className="text-brand-primary">{"{school_page}"}</span>
                                        </div>
                                        <textarea
                                            value={whatsappTemplate}
                                            onChange={e => setWhatsappTemplate(e.target.value)}
                                            rows="6"
                                            className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-sm font-bold text-right leading-relaxed"
                                            placeholder="اكتب نص الرسالة هنا..."
                                            dir="rtl"
                                        />

                                        {/* Real-time Preview */}
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-right">
                                            <div className="text-[10px] text-slate-400 mb-2 font-bold">👁️ معاينة شكل الرسالة:</div>
                                            <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed" dir="rtl">
                                                {(whatsappTemplate || `مرحباً {name}\nيسعدنا انضمامك لمنصة المتكامل.\n\nبيانات الدخول الخاصة بك كـ ({role}):\nكود الدخول: *{code}*\n\nنتمنى لك تجربة ممتعة! 🌹`)
                                                    .replace(/\\n/g, '\n')
                                                    .replace(/{name}/g, 'أحمد محمد')
                                                    .replace(/{code}/g, '12345678')
                                                    .replace(/{role}/g, 'طالب')
                                                    .replace(/{link}/g, window.location.origin)
                                                    .replace(/{school_code}/g, 'SCH001')
                                                    .replace(/{school_page}/g, 'fb.com/school')}
                                            </div>
                                        </div>

                                        <button
                                            onClick={async () => {
                                                const { error } = await supabase.from('config').upsert({ key: 'whatsapp_template', value: whatsappTemplate })
                                                if (error) alert('خطأ في الحفظ: ' + error.message)
                                                else alert('تم حفظ قالب الرسالة بنجاح')
                                            }}
                                            className="w-full py-4 bg-brand-primary text-white rounded-xl font-bold hover:shadow-lg transition-all"
                                        >
                                            💾 حفظ قالب الرسالة
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>

                    )}

                    {/* Import Students Modal */}
                    {
                        showImportModal && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-in zoom-in duration-200">
                                    <h3 className="text-xl font-bold mb-4 text-right">استيراد بيانات الطلاب (CSV)</h3>
                                    <p className="text-sm text-slate-500 mb-6 text-right leading-relaxed">
                                        قم برفع ملف CSV يحتوي على بيانات الطلاب بالصيغة التالية:<br />
                                        <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">name,code,grade_id,class_name,whatsapp_number</code>
                                    </p>

                                    <div className="space-y-4 mb-8">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2 text-right">المدرسة المستهدفة</label>
                                            <select
                                                className="w-full p-3 rounded-xl border border-slate-200"
                                                value={importConfig.school_id}
                                                onChange={e => setImportConfig({ ...importConfig, school_id: e.target.value })}
                                            >
                                                <option value="">-- اختر المدرسة --</option>
                                                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>

                                        <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:bg-slate-50 transition-all cursor-pointer group">
                                            <input
                                                type="file"
                                                accept=".csv"
                                                onChange={(e) => {
                                                    if (!importConfig.school_id) {
                                                        alert('يرجى اختيار المدرسة أولاً')
                                                        e.target.value = null
                                                        return
                                                    }
                                                    const file = e.target.files[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onload = (event) => handleImportStudents(event.target.result)
                                                        reader.readAsText(file)
                                                    }
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <div className="text-center">
                                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📂</div>
                                                <div className="text-sm font-bold text-slate-600">اضغط لرفع ملف CSV</div>
                                                <div className="text-xs text-slate-400 mt-1">سيتم إضافة الطلاب تلقائياً</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowImportModal(false)}
                                            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Question Preview Modal */}
                    {
                        previewQuestion && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl my-8 animate-in zoom-in duration-300 relative">
                                    <button
                                        onClick={() => setPreviewQuestion(null)}
                                        className="absolute top-6 right-6 z-10 text-slate-400 hover:text-slate-600 transition-all text-xl bg-white rounded-full p-2 shadow-md"
                                    >
                                        ✕
                                    </button>

                                    {/* Modal Header */}
                                    <div className="p-6 bg-gradient-to-br from-brand-primary to-purple-600 text-white rounded-t-[2.5rem]">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="text-2xl">📝</div>
                                            <h3 className="text-2xl font-black">معاينة وتعديل السؤال</h3>
                                        </div>
                                        <p className="text-white/80 text-sm font-bold">يمكنك تعديل السؤال مباشرة من هنا</p>
                                    </div>

                                    {/* Modal Body - Question Content */}
                                    <div className="p-6 max-h-[60vh] overflow-y-auto">
                                        <div className="space-y-6">
                                            {/* Question Text */}
                                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                                                <label className="block text-sm font-bold text-slate-500 mb-3 text-right">نص السؤال</label>
                                                {/* Formatted Preview */}
                                                <div
                                                    className="w-full p-4 rounded-xl bg-blue-50 border border-blue-200 font-bold text-slate-700 text-right mb-3 min-h-[60px] text-xl leading-relaxed"
                                                    dir="rtl"
                                                    dangerouslySetInnerHTML={{ __html: convertMathToLatex(previewQuestion.question || '') }}
                                                />
                                                {/* Editable Textarea */}
                                                <textarea
                                                    className="w-full p-4 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 text-right focus:ring-2 focus:ring-blue-100 min-h-[100px] text-xl leading-relaxed"
                                                    value={previewQuestion.question || ''}
                                                    onChange={(e) => handleUpdateQuestionField(previewQuestion, 'question', e.target.value)}
                                                    dir="rtl"
                                                    placeholder="اكتب نص السؤال هنا..."
                                                />
                                            </div>

                                            {/* Choices Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {['choice_a', 'choice_b', 'choice_c', 'choice_d'].map((choiceKey, idx) => {
                                                    const isCorrect = previewQuestion.correct_answer === choiceKey.split('_')[1].toUpperCase()
                                                    return (
                                                        <div key={choiceKey} className={`p-4 rounded-2xl border-2 transition-all ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-white border-slate-200'}`}>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <input
                                                                    type="radio"
                                                                    name="correct_answer_preview"
                                                                    checked={isCorrect}
                                                                    onChange={() => handleUpdateQuestionField(previewQuestion, 'correct_answer', choiceKey.split('_')[1].toUpperCase())}
                                                                    className="accent-green-600"
                                                                />
                                                                <label className="text-xs font-bold text-slate-400">الاختيار {['أ', 'ب', 'ج', 'د'][idx]} {isCorrect && '(الإجابة الصحيحة)'}</label>
                                                            </div>
                                                            {/* Formatted Preview */}
                                                            <div
                                                                className={`w-full p-3 rounded-xl border font-bold text-slate-700 text-right text-lg mb-2 min-h-[40px] leading-relaxed ${isCorrect ? 'bg-green-100 border-green-200' : 'bg-blue-50 border-blue-200'}`}
                                                                dir="rtl"
                                                                dangerouslySetInnerHTML={{ __html: convertMathToLatex(previewQuestion[choiceKey] || '') }}
                                                            />
                                                            {/* Editable Textarea */}
                                                            <textarea
                                                                className="w-full p-3 rounded-xl bg-slate-50 border-none font-bold text-slate-700 text-right text-base focus:ring-2 focus:ring-blue-100"
                                                                value={previewQuestion[choiceKey] || ''}
                                                                onChange={(e) => handleUpdateQuestionField(previewQuestion, choiceKey, e.target.value)}
                                                                rows="2"
                                                                dir="rtl"
                                                                placeholder={`الخيار ${['أ', 'ب', 'ج', 'د'][idx]}`}
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Difficulty & Score Controls */}
                                            <div className="grid grid-cols-2 gap-6 mb-4 px-4">
                                                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                                    <label className="block text-sm font-bold text-slate-500 mb-2 text-right">مستوى السؤال (Level)</label>
                                                    <select
                                                        className="w-full p-2 rounded-xl bg-slate-50 border-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-100"
                                                        value={previewQuestion.difficulty || 'medium'}
                                                        onChange={(e) => handleUpdateQuestionField(previewQuestion, 'difficulty', e.target.value)}
                                                    >
                                                        <option value="easy">سهل (Easy)</option>
                                                        <option value="medium">متوسط (Medium)</option>
                                                        <option value="hard">صعب (Hard)</option>
                                                        <option value="talented">متفوقين (Talented)</option>
                                                    </select>
                                                </div>
                                                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                                                    <label className="block text-sm font-bold text-slate-500 mb-2 text-right">درجة السؤال (Score)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 rounded-xl bg-slate-50 border-none font-bold text-slate-700 text-center focus:ring-2 focus:ring-blue-100"
                                                        value={previewQuestion.score || 1}
                                                        onChange={(e) => handleUpdateQuestionField(previewQuestion, 'score', parseFloat(e.target.value))}
                                                        min="0.5"
                                                        step="0.5"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Modal Footer - Audit Controls */}
                                        <div className="p-6 bg-white border-t border-slate-100">
                                            <div className="flex items-center justify-between bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                                                        👨‍🏫
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800">تدقيق المعلم المختص</div>
                                                        <div className="text-sm text-slate-500">هل تمت مراجعة هذا السؤال والتأكد من صحته؟</div>
                                                    </div>
                                                </div>

                                                <div className={`px-4 py-2 rounded-xl font-bold flex items-center gap-3 transition-all ${previewQuestion.is_audited ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    <span className="text-sm">
                                                        {previewQuestion.is_audited ? 'تم التدقيق واعتماد السؤال' : 'السؤال غير مدقق حتى الآن'}
                                                    </span>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={previewQuestion.is_audited || false}
                                                            onChange={(e) => handleAuditQuestion(previewQuestion, e.target.checked)}
                                                        />
                                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }


                    {/* Import Questions Modal */}
                    {
                        showImportQuestionsModal && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                                    <h3 className="text-xl font-bold mb-4 text-right">استيراد أسئلة (JS/JSON)</h3>
                                    <p className="text-sm text-slate-500 mb-6 text-right leading-relaxed">
                                        قم برفع ملف يحتوي على مصفوفة الأسئلة. النظام سيدعم صيغة JS Object أو JSON.<br />
                                        سيتم تجاهل دالة convertMathToLatex واستخراج النص بداخلها.
                                    </p>

                                    <div className="space-y-4 mb-8">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 text-right">المادة (تخصص عام)</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border border-slate-200"
                                                    value={importConfig.master_subject_id}
                                                    onChange={e => setImportConfig({ ...importConfig, master_subject_id: e.target.value })}
                                                >
                                                    <option value="">-- اختر المادة --</option>
                                                    {masterSubjects.map(ms => <option key={ms.id} value={ms.id}>{ms.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 text-right">الصف الدراسي</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border border-slate-200"
                                                    value={importConfig.grade_id}
                                                    onChange={e => setImportConfig({ ...importConfig, grade_id: e.target.value })}
                                                >
                                                    <option value="">-- اختر الصف --</option>
                                                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 text-right">الترم</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border border-slate-200"
                                                    value={importConfig.term}
                                                    onChange={e => setImportConfig({ ...importConfig, term: e.target.value })}
                                                >
                                                    <option value="1">الترم الأول</option>
                                                    <option value="2">الترم الثاني</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 text-right">الأسبوع</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border border-slate-200"
                                                    value={importConfig.week}
                                                    onChange={e => setImportConfig({ ...importConfig, week: e.target.value })}
                                                >
                                                    {Array.from({ length: 20 }, (_, i) => i + 1).map(week => (
                                                        <option key={week} value={week}>الأسبوع {week}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:bg-slate-50 transition-all cursor-pointer group">
                                            <input
                                                type="file"
                                                accept=".js,.json,.txt"
                                                onChange={(e) => {
                                                    if (!importConfig.grade_id || !importConfig.master_subject_id) {
                                                        alert('يرجى اختيار المادة والصف أولاً')
                                                        e.target.value = null
                                                        return
                                                    }
                                                    const file = e.target.files[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onload = (event) => handleImportQuestions(event.target.result)
                                                        reader.readAsText(file)
                                                    }
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <div className="text-center">
                                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📂</div>
                                                <div className="text-sm font-bold text-slate-600">اضغط لرفع ملف الأسئلة</div>
                                                <div className="text-xs text-slate-400 mt-1">JS / JSON</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowImportQuestionsModal(false)}
                                            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* CSV Import Modal */}
                    {
                        showImportModal && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                                    <h3 className="text-xl font-bold mb-4 text-right">استيراد طلاب من ملف CSV</h3>
                                    <p className="text-sm text-slate-500 mb-6 text-right leading-relaxed">
                                        تأكد أن الملف يحتوي على أعمدة (name, code, grade, class).<br />
                                        في حال عدم وجود كود، سيقوم النظام بتوليد كود تلقائي.
                                    </p>

                                    <div className="space-y-4 mb-8">
                                        <label className="block text-sm font-bold text-slate-500 text-right">اختر المدرسة المراد الإضافة إليها:</label>
                                        <select
                                            id="import-school-select"
                                            className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-right font-bold"
                                        >
                                            <option value="">-- اختر مدرسة --</option>
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>

                                        <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:bg-slate-50 transition-all cursor-pointer group">
                                            <input
                                                type="file"
                                                accept=".csv"
                                                onChange={(e) => {
                                                    const schoolId = document.getElementById('import-school-select').value
                                                    if (!schoolId) {
                                                        alert('يرجى اختيار المدرسة أولاً')
                                                        e.target.value = null
                                                        return
                                                    }
                                                    const file = e.target.files[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onload = (event) => handleCSVImport(schoolId, event.target.result)
                                                        reader.readAsText(file)
                                                    }
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <div className="text-center">
                                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📂</div>
                                                <div className="text-sm font-bold text-slate-600">اضغط لرفع ملف طلاب CSV</div>
                                                <div className="text-xs text-slate-400 mt-1">UTF-8 encoded .csv</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowImportModal(false)}
                                            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Edit Phase Modal */}
                    {
                        editingPhase && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                                    <h3 className="text-xl font-bold mb-4 text-right">تعديل المرحلة الدراسية</h3>
                                    <form onSubmit={handleUpdatePhase} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2 text-right">اسم المرحلة</label>
                                            <input
                                                type="text"
                                                required
                                                value={editingPhase.name}
                                                onChange={e => setEditingPhase({ ...editingPhase, name: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-right"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-3 mt-8">
                                            <button type="button" onClick={() => setEditingPhase(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">إلغاء</button>
                                            <button type="submit" className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-all">حفظ التعديلات</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )
                    }

                    {/* Edit Grade Modal */}
                    {
                        editingGrade && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                                    <h3 className="text-xl font-bold mb-4 text-right">تعديل الصف الدراسي</h3>
                                    <form onSubmit={handleUpdateGrade} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2 text-right">المرحلة الدراسية</label>
                                            <select
                                                required
                                                value={editingGrade.phase_id}
                                                onChange={e => setEditingGrade({ ...editingGrade, phase_id: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 bg-white text-right font-bold"
                                            >
                                                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2 text-right">اسم الصف</label>
                                            <input
                                                type="text"
                                                required
                                                value={editingGrade.name}
                                                onChange={e => setEditingGrade({ ...editingGrade, name: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary text-right"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-3 mt-8">
                                            <button type="button" onClick={() => setEditingGrade(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">إلغاء</button>
                                            <button type="submit" className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-all">حفظ التعديلات</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )
                    }

                    {/* Edit Subject Modal */}
                    {
                        editingSubject && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                                    <h3 className="text-xl font-bold mb-4 text-right">تعديل المادة الدراسية</h3>
                                    <form onSubmit={handleUpdateSubject} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2 text-right">الصف الدراسي</label>
                                            <select
                                                required
                                                value={editingSubject.grade_id}
                                                onChange={e => setEditingSubject({ ...editingSubject, grade_id: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 bg-white text-right font-bold"
                                            >
                                                {grades.map(g => <option key={g.id} value={g.id}>{g.educational_phases?.name} - {g.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2 text-right">المادة الدراسية</label>
                                            <select
                                                required
                                                value={editingSubject.master_subject_id}
                                                onChange={e => setEditingSubject({ ...editingSubject, master_subject_id: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 bg-white text-right font-bold"
                                            >
                                                <option value="">اختر المادة العامة</option>
                                                {masterSubjects.map(ms => <option key={ms.id} value={ms.id}>{ms.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex justify-end gap-3 mt-8">
                                            <button type="button" onClick={() => setEditingSubject(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">إلغاء</button>
                                            <button type="submit" className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-all">حفظ التعديلات</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )
                    }
                    {/* Edit Teacher Modal */}
                    {
                        editingTeacher && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                                    <h3 className="text-xl font-bold mb-4 text-right">تعديل بيانات المعلم</h3>
                                    <form onSubmit={handleUpdateTeacher} className="space-y-4 text-right">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">اسم المعلم</label>
                                            <input
                                                type="text" required
                                                value={editingTeacher.name}
                                                onChange={e => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">المدرسة</label>
                                            <select
                                                required
                                                value={editingTeacher.school_id}
                                                onChange={e => setEditingTeacher({ ...editingTeacher, school_id: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 bg-white"
                                            >
                                                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">التخصص (المادة العامة)</label>
                                            <select
                                                required
                                                value={editingTeacher.master_subject_id}
                                                onChange={e => setEditingTeacher({ ...editingTeacher, master_subject_id: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 bg-white"
                                            >
                                                <option value="">اختر التخصص</option>
                                                {masterSubjects.map(ms => <option key={ms.id} value={ms.id}>{ms.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">كود الدخول</label>
                                            <input
                                                type="text" required
                                                value={editingTeacher.teacher_code}
                                                onChange={e => setEditingTeacher({ ...editingTeacher, teacher_code: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">رقم الواتساب (اختياري)</label>
                                            <input
                                                type="text"
                                                value={editingTeacher.whatsapp_number || ''}
                                                onChange={e => setEditingTeacher({ ...editingTeacher, whatsapp_number: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                                placeholder="01xxxxxxxxx"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-3 mt-8">
                                            <button type="button" onClick={() => setEditingTeacher(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">إلغاء</button>
                                            <button type="submit" className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-all">حفظ التعديلات</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )
                    }

                    {/* Edit Student Modal */}
                    {
                        editingStudent && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in duration-200">
                                    <h3 className="text-xl font-bold mb-4 text-right">تعديل بيانات الطالب</h3>
                                    <form onSubmit={handleUpdateStudent} className="space-y-4 text-right">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">اسم الطالب</label>
                                            <input
                                                type="text" required
                                                value={editingStudent.name}
                                                onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">المدرسة</label>
                                            <select
                                                required
                                                value={editingStudent.school_id}
                                                onChange={e => setEditingStudent({ ...editingStudent, school_id: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 bg-white"
                                            >
                                                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2">الصف الدراسي</label>
                                                <select
                                                    required
                                                    value={editingStudent.grade_id}
                                                    onChange={e => setEditingStudent({ ...editingStudent, grade_id: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 bg-white"
                                                >
                                                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2">اسم الفصل</label>
                                                <input
                                                    type="text" required
                                                    value={editingStudent.class_name}
                                                    onChange={e => setEditingStudent({ ...editingStudent, class_name: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">كود الدخول</label>
                                            <input
                                                type="text" required
                                                value={editingStudent.student_code}
                                                onChange={e => setEditingStudent({ ...editingStudent, student_code: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-500 mb-2">رقم الواتساب (اختياري)</label>
                                            <input
                                                type="text"
                                                value={editingStudent.whatsapp_number || ''}
                                                onChange={e => setEditingStudent({ ...editingStudent, whatsapp_number: e.target.value })}
                                                className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary"
                                                placeholder="01xxxxxxxxx"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-3 mt-8">
                                            <button type="button" onClick={() => setEditingStudent(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200">إلغاء</button>
                                            <button type="submit" className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:scale-[1.02] transition-all">حفظ التعديلات</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )
                    }




                    {/* Import Questions Modal */}
                    {
                        showImportQuestionsModal && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                                    <h3 className="text-xl font-bold mb-4 text-right">استيراد أسئلة (JS/JSON)</h3>
                                    <p className="text-sm text-slate-500 mb-6 text-right leading-relaxed">
                                        قم برفع ملف يحتوي على مصفوفة الأسئلة. النظام سيدعم صيغة JS Object أو JSON.<br />
                                        سيتم تجاهل دالة convertMathToLatex واستخراج النص بداخلها.
                                    </p>

                                    <div className="space-y-4 mb-8">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 text-right">المادة (تخصص عام)</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border border-slate-200"
                                                    value={importConfig.master_subject_id}
                                                    onChange={e => setImportConfig({ ...importConfig, master_subject_id: e.target.value })}
                                                >
                                                    <option value="">-- اختر المادة --</option>
                                                    {masterSubjects.map(ms => <option key={ms.id} value={ms.id}>{ms.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 text-right">الصف الدراسي</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border border-slate-200"
                                                    value={importConfig.grade_id}
                                                    onChange={e => setImportConfig({ ...importConfig, grade_id: e.target.value })}
                                                >
                                                    <option value="">-- اختر الصف --</option>
                                                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 text-right">الترم</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border border-slate-200"
                                                    value={importConfig.term}
                                                    onChange={e => setImportConfig({ ...importConfig, term: e.target.value })}
                                                >
                                                    <option value="1">الترم الأول</option>
                                                    <option value="2">الترم الثاني</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-500 mb-2 text-right">الأسبوع</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border border-slate-200"
                                                    value={importConfig.week}
                                                    onChange={e => setImportConfig({ ...importConfig, week: e.target.value })}
                                                >
                                                    {Array.from({ length: 20 }, (_, i) => i + 1).map(week => (
                                                        <option key={week} value={week}>الأسبوع {week}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:bg-slate-50 transition-all cursor-pointer group">
                                            <input
                                                type="file"
                                                accept=".js,.json,.txt"
                                                onChange={(e) => {
                                                    if (!importConfig.grade_id || !importConfig.master_subject_id) {
                                                        alert('يرجى اختيار المادة والصف أولاً')
                                                        e.target.value = null
                                                        return
                                                    }
                                                    const file = e.target.files[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onload = (event) => handleImportQuestions(event.target.result)
                                                        reader.readAsText(file)
                                                    }
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            <div className="text-center">
                                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📂</div>
                                                <div className="text-sm font-bold text-slate-600">اضغط لرفع ملف الأسئلة</div>
                                                <div className="text-xs text-slate-400 mt-1">JS / JSON</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={() => setShowImportQuestionsModal(false)}
                                            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                    {/* Edit Competition Modal */}
                    {
                        editingCompetition && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl p-8 animate-in zoom-in duration-200 my-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <button onClick={() => setEditingCompetition(null)} className="text-slate-400 hover:text-slate-600 p-2 bg-slate-50 rounded-xl transition-all">✕</button>
                                        <div className="text-right">
                                            <h3 className="text-2xl font-black text-slate-800">تعديل المسابقة</h3>
                                            <p className="text-slate-500 text-sm font-bold">قم بتعديل بيانات المسابقة</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleUpdateCompetition} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                                            <div className="md:col-span-2 lg:col-span-2">
                                                <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">عنوان المسابقة</label>
                                                <input
                                                    type="text" placeholder="مثال: مسابقة العباقرة - الأسبوع الأول" required
                                                    value={editingCompetition.title} onChange={e => setEditingCompetition({ ...editingCompetition, title: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-bold"
                                                />
                                            </div>
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">الصف الدراسي</label>
                                                <select
                                                    required value={editingCompetition.grade_id} onChange={e => setEditingCompetition({ ...editingCompetition, grade_id: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold"
                                                >
                                                    <option value="">اختر الصف</option>
                                                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">المادة</label>
                                                <select
                                                    required value={editingCompetition.subject_id} onChange={e => setEditingCompetition({ ...editingCompetition, subject_id: e.target.value })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold"
                                                >
                                                    <option value="">اختر المادة</option>
                                                    {subjects.filter(s => s.grade_id === editingCompetition.grade_id).map(s => (
                                                        <option key={s.id} value={s.id}>{s.master_subjects?.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-bold text-slate-400 mb-2 mr-2">الترم</label>
                                                <select
                                                    value={editingCompetition.term} onChange={e => setEditingCompetition({ ...editingCompetition, term: parseInt(e.target.value) })}
                                                    className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold"
                                                >
                                                    <option value={1}>الترم 1</option>
                                                    <option value={2}>الترم 2</option>
                                                </select>
                                            </div>
                                            <div className="lg:col-span-1">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-2">من أسبوع</label>
                                                        <input
                                                            type="number" min="1" max="20"
                                                            value={editingCompetition.start_week} onChange={e => setEditingCompetition({ ...editingCompetition, start_week: parseInt(e.target.value) })}
                                                            className="w-full p-4 px-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-bold text-center"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 mb-2 mr-2">إلى أسبوع</label>
                                                        <input
                                                            type="number" min="1" max="20"
                                                            value={editingCompetition.end_week} onChange={e => setEditingCompetition({ ...editingCompetition, end_week: parseInt(e.target.value) })}
                                                            className="w-full p-4 px-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-primary font-bold text-center"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quotas Section */}
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                            <h4 className="text-sm font-black text-slate-500 mb-4 flex items-center gap-2">
                                                <span>📊</span> توزيع صعوبة الأسئلة (الكيوتة)
                                            </h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {[
                                                    { key: 'easy_q', label: 'سهل (Easy)', color: 'green', diff: 'easy' },
                                                    { key: 'medium_q', label: 'متوسط (Medium)', color: 'blue', diff: 'medium' },
                                                    { key: 'hard_q', label: 'صعب (Hard)', color: 'rose', diff: 'hard' },
                                                    { key: 'talented_q', label: 'متفوقين (Talented)', color: 'purple', diff: 'talented' }
                                                ].map(item => {
                                                    const available = getAvailableQuestions(item.diff, editingCompetition);
                                                    const requested = editingCompetition[item.key];
                                                    const isExceeded = requested > available;
                                                    return (
                                                        <div key={item.key}>
                                                            <label className={`block text-[10px] font-bold text-${item.color}-600 mb-1 mr-1`}>{item.label}</label>
                                                            <input
                                                                type="number" min="0"
                                                                value={requested}
                                                                onChange={e => setEditingCompetition({ ...editingCompetition, [item.key]: parseInt(e.target.value) || 0 })}
                                                                className={`w-full p-3 rounded-xl border ${isExceeded ? 'border-red-500 bg-red-50' : 'border-slate-200'} text-center font-bold`}
                                                            />
                                                            <div className={`mt-1 text-[9px] font-bold text-right px-1 ${isExceeded ? 'text-red-600' : 'text-slate-400'}`}>
                                                                متاح: {available} {isExceeded && '(غير كافٍ)'}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-4 text-[10px] text-slate-400 italic font-bold">
                                                إجمالي الأسئلة: {editingCompetition.easy_q + editingCompetition.medium_q + editingCompetition.hard_q + editingCompetition.talented_q} سؤال سيتم اختيارها عشوائياً لكل طالب.
                                            </div>
                                        </div>

                                        {/* Timer & Attempts Section */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                                                <h4 className="text-sm font-black text-amber-700 mb-4 flex items-center gap-2">
                                                    <span>⏱️</span> نظام التوقيت
                                                </h4>
                                                <div className="space-y-3">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="edit_timer_type" value="total" checked={editingCompetition.timer_type === 'total'} onChange={e => setEditingCompetition({ ...editingCompetition, timer_type: e.target.value })} className="accent-amber-600" />
                                                        <span className="text-xs font-bold text-amber-900">وقت كلي للمسابقة</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="radio" name="edit_timer_type" value="per_question" checked={editingCompetition.timer_type === 'per_question'} onChange={e => setEditingCompetition({ ...editingCompetition, timer_type: e.target.value })} className="accent-amber-600" />
                                                        <span className="text-xs font-bold text-amber-900">وقت محدد لكل سؤال</span>
                                                    </label>
                                                    <div className="mt-4">
                                                        <label className="block text-[10px] font-bold text-amber-600 mb-1 mr-1">
                                                            {editingCompetition.timer_type === 'total' ? 'المدة الكلية (بالدقائق)' : 'وقت السؤال الواحد (بالدقائق)'}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={Math.floor(editingCompetition.duration / 60)}
                                                            onChange={e => {
                                                                const mins = parseInt(e.target.value) || 0;
                                                                setEditingCompetition({ ...editingCompetition, duration: mins * 60 });
                                                            }}
                                                            className="w-full p-3 rounded-xl border border-amber-200 bg-white text-center font-bold text-amber-900"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="md:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col justify-between">
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                                                        <span>🔄</span> إعدادات المحاولات
                                                    </h4>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1">
                                                            <label className="block text-[10px] font-bold text-slate-400 mb-1 mr-1">الحد الأقصى للمحاولات</label>
                                                            <input type="number" min="1" value={editingCompetition.max_attempts} onChange={e => setEditingCompetition({ ...editingCompetition, max_attempts: parseInt(e.target.value) })} className="w-full p-4 rounded-xl border border-slate-200 text-center font-black text-slate-800" />
                                                        </div>
                                                        <p className="flex-1 text-xs text-slate-400 leading-tight">
                                                            يتحكم هذا الخيار في عدد المرات التي يسمح فيها للطالب بدخول هذه المسابقة.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 mt-6">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingCompetition(null)}
                                                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                                    >
                                                        إلغاء
                                                    </button>
                                                    <button type="submit" className="flex-1 py-4 bg-brand-primary text-white rounded-xl font-black shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-3">
                                                        <span>💾</span> حفظ التعديلات
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )
                    }
                    {/* Competition Results Modal */}
                    {
                        showResultsModal && selectedCompetitionResults && (
                            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-8 animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                                    <div className="flex justify-between items-start mb-6">
                                        <button onClick={() => setShowResultsModal(false)} className="text-slate-400 hover:text-slate-600 p-2 bg-slate-50 rounded-xl transition-all">✕</button>
                                        <div className="text-right">
                                            <h3 className="text-2xl font-black text-slate-800">نتائج المسابقة: {selectedCompetitionResults.title}</h3>
                                            <p className="text-slate-500 font-bold">الصف: {selectedCompetitionResults.grades?.name} | المادة: {selectedCompetitionResults.subjects?.master_subjects?.name}</p>
                                        </div>
                                    </div>

                                    <Leaderboard competitionId={selectedCompetitionResults.id} />

                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={() => setShowResultsModal(false)}
                                            className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                                        >
                                            إغلاق
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Security Verification Modal */}
                    {
                        showVerifyModal && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                                <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm p-8 text-center border border-slate-100 animate-in zoom-in duration-300">
                                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <span className="text-4xl">🔐</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 mb-2">تأكيد الهوية</h3>
                                    <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                                        يرجى إدخال كلمة المرور الحالية لمدير النظام لتأكيد هذه العملية الحساسة.
                                    </p>

                                    <input
                                        type="password"
                                        autoFocus
                                        value={verifyPasswordValue}
                                        onChange={e => setVerifyPasswordValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleVerifySecurityChallenge()}
                                        placeholder="كلمة المرور الحالية"
                                        className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 outline-none focus:border-brand-primary transition-all text-center text-lg mb-6"
                                    />

                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={handleVerifySecurityChallenge}
                                            className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                                        >
                                            تأكيد وإرسال
                                        </button>
                                        <button
                                            onClick={() => { setShowVerifyModal(false); setVerifyCallback(null); }}
                                            className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-all"
                                        >
                                            إلغاء العملية
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    }


                    {/* Poll Details Modal */}
                    {
                        showPollDetailsModal && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
                                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl p-8 animate-in zoom-in duration-300 relative max-h-[90vh] flex flex-col">
                                    <button
                                        onClick={() => setShowPollDetailsModal(null)}
                                        className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 transition-all text-xl"
                                    >
                                        ✕
                                    </button>

                                    <div className="mb-6 text-right">
                                        <h2 className="text-2xl font-black text-slate-800 mb-2">{showPollDetailsModal.question}</h2>
                                        <p className="text-slate-500 font-bold">تفاصيل الطلاب الذين قاموا بالتصويت</p>
                                    </div>

                                    <div className="overflow-y-auto flex-1 pr-2">
                                        <table className="w-full text-right">
                                            <thead className="sticky top-0 bg-white z-10 border-b-2 border-slate-100">
                                                <tr className="text-slate-400 text-xs font-black uppercase tracking-wider">
                                                    <th className="p-4">اسم الطالب</th>
                                                    <th className="p-4">المدرسة</th>
                                                    <th className="p-4">الاختيار</th>
                                                    <th className="p-4">وقت التصويت</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {pollResponses
                                                    .filter(r => r.poll_id === showPollDetailsModal.id)
                                                    .map((resp, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-all">
                                                            <td className="p-4 font-bold text-slate-700">{resp.students?.name || 'طالب غير معروف'}</td>
                                                            <td className="p-4 text-xs text-slate-500">{resp.students?.schools?.name || '---'}</td>
                                                            <td className="p-4">
                                                                <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-lg font-black text-xs">
                                                                    {showPollDetailsModal.options[resp.option_index]}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-xs text-slate-400 font-mono">
                                                                {new Date(resp.created_at).toLocaleString('ar-EG')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                {pollResponses.filter(r => r.poll_id === showPollDetailsModal.id).length === 0 && (
                                                    <tr>
                                                        <td colSpan="4" className="p-12 text-center text-slate-400 italic">لا توجد ردود مسجلة لهذا التصويت بعد.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </main>
            </div >
        </div >

    )
}

export default AdminDashboard
