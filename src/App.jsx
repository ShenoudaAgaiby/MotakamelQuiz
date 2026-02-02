import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import StudentDashboard from './components/StudentDashboard'
import TeacherDashboard from './components/TeacherDashboard'
import AdminDashboard from './components/AdminDashboard'
import './index.css'

function App() {
  const [view, setView] = useState('landing')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [schoolCode, setSchoolCode] = useState('')
  const [personalCode, setPersonalCode] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    if (view === 'landing') {
      setSchoolCode('')
      setPersonalCode('')
      setAdminUsername('')
      setAdminPassword('')
      setRememberMe(false)
    } else if (view === 'login-student') {
      const s = localStorage.getItem('remember_school_code') || ''
      const c = localStorage.getItem('remember_student_code') || ''
      setSchoolCode(s)
      setPersonalCode(c)
      setRememberMe(!!(s && c))
    } else if (view === 'login-teacher') {
      const s = localStorage.getItem('remember_school_code') || ''
      const c = localStorage.getItem('remember_teacher_code') || ''
      setSchoolCode(s)
      setPersonalCode(c)
      setRememberMe(!!(s && c))
    } else if (view === 'login-admin') {
      const u = localStorage.getItem('remember_admin_username') || ''
      setAdminUsername(u)
      setRememberMe(!!u)
    }
  }, [view])

  const handleLogin = async (role) => {
    if (!supabase) {
      setError('جاري تهيئة قاعدة البيانات... يرجى التأكد من إعداد ملف .env')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let userData = null
      let sessionUser = null

      if (role === 'admin') {
        const { data: admin, error: adminError } = await supabase
          .from('admins')
          .select('*')
          .eq('username', adminUsername)
          .eq('password_hash', adminPassword)
          .single()

        if (adminError || !admin) throw new Error('بيانات دخول المدير غير صحيحة')

        userData = admin
        sessionUser = {
          ...userData,
          role: 'admin',
          schoolName: 'الإدارة العامة'
        }
      } else {
        // 1. Find the school first
        const { data: school, error: schoolError } = await supabase
          .from('schools')
          .select('id, is_active')
          .eq('school_code', schoolCode)
          .single()

        if (schoolError || !school) {
          throw new Error('كود المدرسة غير صحيح')
        }

        if (!school.is_active) {
          throw new Error('تم تجميد نشاط هذه المدرسة مؤقتاً. يرجى مراجعة الإدارة.')
        }

        // 2. Find the user (teacher or student)
        const tableName = role === 'student' ? 'students' : 'teachers'
        const codeColumn = role === 'student' ? 'student_code' : 'teacher_code'

        const { data: userRecord, error: userError } = await supabase
          .from(tableName)
          .select('*')
          .eq('school_id', school.id)
          .eq(codeColumn, personalCode)
          .single()

        if (userError || !userRecord) throw new Error('بيانات الدخول غير صحيحة')

        userData = userRecord
        sessionUser = {
          ...userData,
          role: role,
          schoolName: schoolCode
        }
      }

      setUser(sessionUser)

      // Save or Remove Credentials
      if (rememberMe) {
        if (role === 'student') {
          localStorage.setItem('remember_school_code', schoolCode)
          localStorage.setItem('remember_student_code', personalCode)
        } else if (role === 'teacher') {
          localStorage.setItem('remember_school_code', schoolCode)
          localStorage.setItem('remember_teacher_code', personalCode)
        } else if (role === 'admin') {
          localStorage.setItem('remember_admin_username', adminUsername)
        }
      } else {
        if (role === 'student') {
          localStorage.removeItem('remember_school_code')
          localStorage.removeItem('remember_student_code')
        } else if (role === 'teacher') {
          localStorage.removeItem('remember_school_code')
          localStorage.removeItem('remember_teacher_code')
        } else if (role === 'admin') {
          localStorage.removeItem('remember_admin_username')
        }
      }

      setView(role === 'student' ? 'student-dashboard' : role === 'teacher' ? 'teacher-dashboard' : 'admin-dashboard')
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setUser(null)
    setView('landing')
  }

  if (view === 'student-dashboard') return <StudentDashboard user={user} onLogout={handleLogout} />
  if (view === 'teacher-dashboard') return <TeacherDashboard user={user} onLogout={handleLogout} />
  if (view === 'admin-dashboard') return <AdminDashboard user={user} onLogout={handleLogout} />

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {view === 'landing' && (
        <div className="max-w-md w-full glass-card rounded-3xl p-8 text-center animate-in fade-in zoom-in duration-500">
          <h1 className="text-4xl font-bold text-brand-primary mb-2">منصة متكامل</h1>
          <p className="text-slate-600 mb-8 text-lg">نظام المسابقات والتقييم الذكي</p>

          <div className="grid gap-4">


            <button
              onClick={() => setView('login-student')}
              className="w-full py-4 px-6 bg-brand-primary text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer text-xl"
            >
              دخول الطلاب 🎓
            </button>



            <button
              onClick={() => setView('login-teacher')}
              className="w-full py-4 px-6 bg-white text-brand-primary border-2 border-brand-primary rounded-2xl font-bold hover:bg-slate-50 transition-all cursor-pointer text-xl"
            >
              بوابة المعلمين 👨‍🏫
            </button>

            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100">


              <button
                onClick={() => setView('login-admin')}
                className="text-slate-400 hover:text-brand-primary text-sm font-bold transition-all"
              >
                الدخول كإدارة بالنظام ⚙️
              </button>
              <div className="flex gap-2">


                <button
                  onClick={() => {
                    setUser({ id: 'demo', name: 'أحمد محمد', role: 'student', schoolName: 'القدس الدولية' })
                    setView('student-dashboard')
                  }}
                  className="flex-1 py-2 text-xs bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
                >
                  تصفح كطالب (تخطي)
                </button>


                <button
                  onClick={() => {
                    setUser({ id: 'demo', name: 'إبراهيم حسن', role: 'teacher', schoolName: 'منارة المستقبل' })
                    setView('teacher-dashboard')
                  }}
                  className="flex-1 py-2 text-xs bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
                >
                  تصفح كمعلم (تخطي)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-slate-400 text-sm">
            نظام متطور يدعم تعدد المدارس والمراحل الدراسية
          </div>
        </div>
      )}

      {(view === 'login-student' || view === 'login-teacher' || view === 'login-admin') && (
        <div className="max-w-md w-full glass-card rounded-3xl p-8 animate-in slide-in-from-bottom duration-500">
          <button onClick={() => setView('landing')} className="mb-6 text-brand-primary font-bold flex items-center gap-2">
            <span>→</span> العودة للرئيسية
          </button>
          <h2 className="text-2xl font-bold mb-6 text-slate-800">
            {view === 'login-student' ? 'دخول الطالب' : view === 'login-teacher' ? 'دخول المعلم' : 'دخول مدير النظام'}
          </h2>

          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-500 rounded-lg text-sm">{error}</div>}

            {view !== 'login-admin' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">كود المدرسة</label>
                  <input
                    type="text"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    placeholder="مثال: SCHOOL-123"
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-secondary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {view === 'login-student' ? 'كود الطالب' : 'كود المعلم'}
                  </label>
                  <input
                    type="text"
                    value={personalCode}
                    onChange={(e) => setPersonalCode(e.target.value)}
                    placeholder="أدخل الكود الخاص بك"
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-secondary outline-none transition-all"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم المستخدم</label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="أدخل اسم المستخدم"
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-secondary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-secondary outline-none transition-all"
                  />
                </div>
              </>
            )}





            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 text-brand-primary rounded focus:ring-brand-primary accent-brand-primary cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-slate-600 font-bold select-none cursor-pointer">
                تذكر بيانات الدخول
              </label>
            </div>

            <button
              onClick={() => handleLogin(view === 'login-student' ? 'student' : view === 'login-teacher' ? 'teacher' : 'admin')}
              disabled={loading || (view !== 'login-admin' && (!schoolCode || !personalCode)) || (view === 'login-admin' && (!adminUsername || !adminPassword))}
              className={`w-full py-4 bg-brand-primary text-white rounded-xl font-bold shadow-md transition-all mt-4 ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-brand-secondary'}`}
            >
              {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
            </button>



            <button className="w-full text-brand-secondary font-medium text-sm hover:underline py-2">
              نسيت الكود؟ أرسله على الواتساب 💬
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

