// Question Template Download Function for Motakamel Platform
// This function generates and downloads a comprehensive JSON template

export const downloadQuestionTemplate = () => {
    const template = {
        "_instructions_ar": "📋 تعليمات الاستخدام:\n\n⚠️ ملاحظة هامة: لا تحتاج لإضافة الصف أو المادة أو الترم أو الأسبوع في الملف!\nسيتم اختيارهم تلقائياً من نافذة رفع الملف في المنصة.\n\n✅ ما تحتاج إضافته فقط:\n1. نص السؤال (text)\n2. الخيارات (choices) - مصفوفة من 2 إلى 4 خيارات\n3. رقم الإجابة الصحيحة (correct) - يبدأ من 0\n4. مستوى الصعوبة (difficulty): easy, medium, hard, talented\n5. صورة توضيحية (image) - اختياري\n\n📸 لإضافة صورة:\n• حوّل الصورة إلى Base64 من: https://www.base64-image.de\n• أو استخدم: https://base64.guru/converter/encode/image\n• انسخ النتيجة كاملة (data:image/png;base64,...) وضعها في حقل image\n• الصور مفيدة جداً في الهندسة والعلوم والدراسات\n\n💡 استخدم $ للرموز الرياضية (LaTeX)\nمثال: $\\frac{1}{2}$ أو $x^2$ أو $\\sqrt{16}$",

        "_instructions_en": "📋 Usage Instructions:\n\n⚠️ Important Note: You DON'T need to add grade, subject, term, or week in the file!\nThey will be selected automatically from the upload window.\n\n✅ What you need to add:\n1. Question text (text)\n2. Choices (choices) - array of 2 to 4 options\n3. Correct answer index (correct) - starts from 0\n4. Difficulty level (difficulty): easy, medium, hard, talented\n5. Image (image) - optional\n\n📸 To add an image:\n• Convert image to Base64 at: https://www.base64-image.de\n• Or use: https://base64.guru/converter/encode/image\n• Copy the full result (data:image/png;base64,...) and paste in image field\n• Images are very useful for geometry, science, and social studies\n\n💡 Use $ for math symbols (LaTeX)\nExample: $\\frac{1}{2}$ or $x^2$ or $\\sqrt{16}$",

        "questions": [
            {
                "difficulty": "easy",
                "text": "احسب: $\\frac{3}{4} + \\frac{1}{4} = ?$",
                "choices": ["$\\frac{4}{4}$", "$\\frac{4}{8}$", "$1$", "$\\frac{2}{4}$"],
                "correct": 2,
                "_note": "مثال رياضيات مع LaTeX - استخدم $ للرموز الرياضية"
            },
            {
                "difficulty": "medium",
                "text": "في المثلث القائم الزاوية الموضح في الصورة، احسب طول الوتر:",
                "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bWFya2VyIGlkPSJhcnJvdyIgbWFya2VyV2lkdGg9IjEwIiBtYXJrZXJIZWlnaHQ9IjEwIiByZWZYPSI1IiByZWZZPSIzIiBvcmllbnQ9ImF1dG8iPjxwYXRoIGQ9Ik0wLDAgTDAsNiBMOSwzIHoiIGZpbGw9IiMzMzMiLz48L21hcmtlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyNTAiIGZpbGw9IiNmOGY5ZmEiLz48cG9seWdvbiBwb2ludHM9IjUwLDIwMCAyNTAsMjAwIDUwLDUwIiBmaWxsPSJub25lIiBzdHJva2U9IiMyNTYzZWIiIHN0cm9rZS13aWR0aD0iMyIvPjxyZWN0IHg9IjQ1IiB5PSIxOTUiIHdpZHRoPSIxNSIgaGVpZ2h0PSIxNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjU2M2ViIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSIzMCIgeT0iMTI1IiBmb250LXNpemU9IjE4IiBmaWxsPSIjMTExIiBmb250LXdlaWdodD0iYm9sZCI+M2NtPC90ZXh0Pjx0ZXh0IHg9IjE1MCIgeT0iMjMwIiBmb250LXNpemU9IjE4IiBmaWxsPSIjMTExIiBmb250LXdlaWdodD0iYm9sZCI+NGNtPC90ZXh0Pjx0ZXh0IHg9IjE0MCIgeT0iMTEwIiBmb250LXNpemU9IjE4IiBmaWxsPSIjZGMyNjI2IiBmb250LXdlaWdodD0iYm9sZCI+PzwvdGV4dD48L3N2Zz4=",
                "choices": ["5 cm", "6 cm", "7 cm", "8 cm"],
                "correct": 0,
                "_note": "مثال هندسة مع صورة توضيحية - مثلث قائم الزاوية 3-4-5"
            },
            {
                "difficulty": "medium",
                "text": "ما نوع الزاوية الموضحة في الصورة؟",
                "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjUwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxsaW5lIHgxPSI1MCIgeTE9IjE1MCIgeDI9IjIwMCIgeTI9IjE1MCIgc3Ryb2tlPSIjMjU2M2ViIiBzdHJva2Utd2lkdGg9IjMiLz48bGluZSB4MT0iNTAiIHkxPSIxNTAiIHgyPSIxNTAiIHkyPSI1MCIgc3Ryb2tlPSIjMjU2M2ViIiBzdHJva2Utd2lkdGg9IjMiLz48cGF0aCBkPSJNIDgwIDE1MCBBIDMwIDMwIDAgMCAxIDY1IDEyNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZGMyNjI2IiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSI5MCIgeT0iMTM1IiBmb250LXNpemU9IjE2IiBmaWxsPSIjZGMyNjI2IiBmb250LXdlaWdodD0iYm9sZCI+NjDCsDwvdGV4dD48L3N2Zz4=",
                "choices": ["زاوية حادة", "زاوية قائمة", "زاوية منفرجة", "زاوية مستقيمة"],
                "correct": 0,
                "_note": "مثال هندسة - زاوية 60 درجة (حادة)"
            },
            {
                "difficulty": "medium",
                "text": "ما نوع الخلية الموضحة في الصورة؟",
                "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE2IiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+UpyDYrti12YjYsSDYrtmE2YrYqTwvdGV4dD48L3N2Zz4=",
                "choices": ["خلية نباتية", "خلية حيوانية", "خلية بكتيرية", "خلية فطرية"],
                "correct": 0,
                "_note": "مثال علوم مع صورة - استبدل بصورة حقيقية للخلية"
            },
            {
                "difficulty": "hard",
                "text": "أين تقع الدلتا الموضحة في الخريطة؟",
                "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U4ZjVlOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE2IiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+XuO+4jyDYrtix2YrYt9ipPC90ZXh0Pjwvc3ZnPg==",
                "choices": ["شمال مصر", "جنوب مصر", "شرق مصر", "غرب مصر"],
                "correct": 0,
                "_note": "مثال دراسات مع خريطة - استبدل بخريطة حقيقية"
            },
            {
                "difficulty": "easy",
                "text": "ما إعراب كلمة 'محمدٌ' في جملة: 'محمدٌ طالبٌ مجتهدٌ'؟",
                "choices": ["مبتدأ مرفوع", "خبر مرفوع", "فاعل مرفوع", "مفعول به منصوب"],
                "correct": 0,
                "_note": "مثال لغة عربية - نص فقط بدون صور"
            },
            {
                "difficulty": "medium",
                "text": "Choose the correct answer: She ___ to school every day.",
                "choices": ["go", "goes", "going", "went"],
                "correct": 1,
                "_note": "English language example - text only"
            },
            {
                "difficulty": "easy",
                "text": "الأرض كروية الشكل",
                "choices": ["صح", "خطأ"],
                "correct": 0,
                "_note": "مثال صح/خطأ - خيارين فقط"
            },
            {
                "difficulty": "talented",
                "text": "حل المعادلة: $x^2 - 5x + 6 = 0$",
                "choices": ["$x = 2$ أو $x = 3$", "$x = 1$ أو $x = 6$", "$x = -2$ أو $x = -3$", "$x = 0$ أو $x = 5$"],
                "correct": 0,
                "_note": "مثال للمتفوقين - مستوى صعب جداً"
            },
            {
                "difficulty": "medium",
                "text": "في الشكل الهندسي، ما مساحة المستطيل؟",
                "image": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y4ZjlmYSIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlMGYyZmUiIHN0cm9rZT0iIzI1NjNlYiIgc3Ryb2tlLXdpZHRoPSIzIi8+PHRleHQgeD0iMTUwIiB5PSIzNSIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzExMSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPjEwIGNtPC90ZXh0Pjx0ZXh0IHg9IjI3MCIgeT0iMTA1IiBmb250LXNpemU9IjE4IiBmaWxsPSIjMTExIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iYm9sZCI+NSBjbTwvdGV4dD48L3N2Zz4=",
                "choices": ["50 cm²", "15 cm²", "100 cm²", "25 cm²"],
                "correct": 0,
                "_note": "مثال هندسة - مساحة مستطيل 10×5"
            }
        ]
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'question_template_motakamel.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('تم تنزيل قالب الأسئلة بنجاح! 📥\nيمكنك الآن تعديله وإضافة أسئلتك الخاصة.');
};
