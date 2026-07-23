import dictionary from 'dictionary-es';
import nspell from 'nspell';

const checker = nspell(dictionary);

[
    'antropometría', 'antropométrico', 'antropométrica', 'bioimpedancia',
    'cacahuate', 'cacahuates',
    'cardiometabólico', 'colación', 'dietético', 'dietética', 'glucemia',
    'hipercalórico', 'hipocalórico', 'kilocaloría', 'kilocalorías',
    'macronutriente', 'macronutrientes', 'microbiota', 'nutrióloga',
    'nutriólogo', 'nutricional', 'somatometría', 'suplementación',
    'triglicéridos', 'vegetariano', 'vegetariana'
].forEach(word => checker.add(word));

const WORD_PATTERN = /[\p{L}]+(?:[’'-][\p{L}]+)*/gu;

const addText = (target, value) => {
    if (typeof value === 'string' && value.trim()) target.push(value);
};

const addTextList = (target, value) => {
    if (!Array.isArray(value)) return;
    value.forEach(item => {
        if (typeof item === 'string') addText(target, item);
    });
};

const collectPlanTexts = (plan) => {
    const texts = [];

    addText(texts, plan.nombre);
    addText(texts, plan.notasGenerales);
    addText(texts, plan.notasClinicasRecientes);
    addText(texts, plan.notasLibresRecientes);
    addText(texts, plan.esqueHidratacionReciente);
    addTextList(texts, plan.lineamientosRecientes);
    addTextList(texts, plan.suplementacionReciente);
    addTextList(texts, plan.evitarReciente);
    addTextList(texts, plan.hidratacionReciente);
    addTextList(texts, plan.alimentosPersonales);

    if (Array.isArray(plan.temarioReciente)) {
        plan.temarioReciente.forEach(item => {
            addText(texts, item?.tema);
            addText(texts, item?.detalle);
        });
    }

    if (plan.competenciaReciente && typeof plan.competenciaReciente === 'object') {
        Object.values(plan.competenciaReciente).forEach(value => addText(texts, value));
    }

    if (Array.isArray(plan.suplementosTabla)) {
        plan.suplementosTabla.forEach(item => {
            addText(texts, item?.nombre);
            addText(texts, item?.indicaciones);
        });
    }

    if (Array.isArray(plan.menus)) {
        plan.menus.forEach(menu => {
            addText(texts, menu?.nombre);
            const tiempos = menu?.tiemposComida || menu?.tiempos || [];
            tiempos.forEach(tiempo => {
                addText(texts, tiempo?.nombre);
                addText(texts, tiempo?.notaPie || tiempo?.nota);
                addText(texts, tiempo?.bebida);
                addText(texts, tiempo?.suplTiempo);
                addText(texts, tiempo?.suplNotas);
                addText(texts, tiempo?.ademas);
                (tiempo?.ingredientes || []).forEach(ingrediente => {
                    addText(texts, ingrediente?.descripcion);
                    addText(texts, ingrediente?.platillo);
                });
            });
        });
    }

    return texts;
};

const properNameWords = (plan) => {
    const words = new Set();
    const addNames = (value) => {
        if (typeof value !== 'string') return;
        (value.match(WORD_PATTERN) || []).forEach(word => words.add(word.toLocaleLowerCase('es-MX')));
    };

    addNames(plan?.paciente?.nombre);
    addNames(plan?.paciente?.apellido);
    return words;
};

const shouldIgnore = (word, ignoredWords) => {
    if (word.length < 3) return true;
    if (ignoredWords.has(word.toLocaleLowerCase('es-MX'))) return true;
    return word.length <= 6 && word === word.toLocaleUpperCase('es-MX');
};

export const collectPlanSpellingIssues = (plan) => {
    const issues = new Map();
    const ignoredWords = properNameWords(plan);

    collectPlanTexts(plan).forEach(text => {
        const words = text.match(WORD_PATTERN) || [];
        words.forEach(word => {
            if (shouldIgnore(word, ignoredWords)) return;
            const normalized = word.toLocaleLowerCase('es-MX');
            if (checker.correct(word) || checker.correct(normalized)) return;
            const current = issues.get(normalized);
            issues.set(normalized, {
                word: current?.word || word,
                count: (current?.count || 0) + 1,
                suggestions: current?.suggestions || checker.suggest(normalized).slice(0, 5)
            });
        });
    });

    return [...issues.values()];
};
