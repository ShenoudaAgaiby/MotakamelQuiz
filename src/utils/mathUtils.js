/**
 * دالة لتحويل التعابير الرياضية إلى تنسيق LaTeX متوافق مع MathJax
 */
export function convertMathToLatex(text) {
    if (!text) return text;

    let result = String(text);

    // الحفاظ على الصيغ التي بداخل $ بالفعل
    const mathParts = [];
    const placeholder = '\x00MATH_PLACEHOLDER_';
    let mathIndex = 0;

    // استخراج الصيغ الموجودة بالفعل
    result = result.replace(/\$[^$]*\$/g, (match) => {
        mathParts.push(match);
        return placeholder + mathIndex++ + '\x00';
    });

    // 1. تحويل الكسور: \frac{3}{4} → $\frac{3}{4}$
    result = result.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '$\\frac{$1}{$2}$');

    // 2. تحويل الجذور: \sqrt{2} → $\sqrt{2}$
    result = result.replace(/\\sqrt\s*\{([^}]+)\}/g, '$\\sqrt{$1}$');

    // 3. تحويل الرموز الرياضية
    result = result.replace(/\\times/g, ' × ');
    result = result.replace(/\\div/g, ' ÷ ');
    result = result.replace(/\\pi/g, 'π');
    result = result.replace(/\\alpha/g, 'α');
    result = result.replace(/\\beta/g, 'β');
    result = result.replace(/\\gamma/g, 'γ');
    result = result.replace(/\\leq/g, '≤');
    result = result.replace(/\\geq/g, '≥');

    // إعادة إدراج الصيغ المحفوظة
    mathParts.forEach((math, idx) => {
        result = result.replace(placeholder + idx + '\x00', math);
    });

    return result;
}

/**
 * تحديث عرض الرموز الرياضية في الصفحة أو عنصر معين
 */
export function updateMathDisplay(element = null) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        if (element) {
            window.MathJax.typesetPromise([element]).catch((err) => console.error('MathJax error:', err));
        } else {
            window.MathJax.typesetPromise().catch((err) => console.error('MathJax error:', err));
        }
    }
}
