// Initialize MathJax from local node_modules
window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true
    },
    options: {
        enableMenu: false
    },
    startup: {
        ready: () => {
            console.log('MathJax loaded locally');
            MathJax.startup.defaultReady();
        }
    }
};

// Load MathJax from node_modules
import('mathjax/es5/tex-mml-chtml.js').catch(err => {
    console.error('Failed to load MathJax:', err);
});
