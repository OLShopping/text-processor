// ================================================================
//  数据层
// ================================================================
const DEFAULT_RULES = [
    { keyword: '内容简介', style: 'bold-big', enabled: true },
    { keyword: '作者简介', style: 'bold-big', enabled: true },
    { keyword: '重要',     style: 'bold',     enabled: true },
    { keyword: '注意',     style: 'bold-big', enabled: true },
    { keyword: '警告',     style: 'color',    enabled: true },
    { keyword: '提示',     style: 'bold',     enabled: true },
    { keyword: '关键',     style: 'bold-big', enabled: true },
];
// 默认正则规则：书名号自动加粗（可被用户关闭）
const DEFAULT_REGEX_RULES = [
    { pattern: '《[^》]+》', style: 'bold', enabled: true, label: '书名号加粗' },
];

let rules      = JSON.parse(localStorage.getItem('bookEditorRules_v3'))      || DEFAULT_RULES.map(r => ({ ...r }));
let regexRules = JSON.parse(localStorage.getItem('bookEditorRegexRules_v3')) || DEFAULT_REGEX_RULES.map(r => ({ ...r }));

// 命中统计（仅运行时，不持久化）
let hitStats = {};   // { kw_关键词: 3, rx_0: 5, ... }

// ================================================================
//  DOM 引用
// ================================================================
const $  = id => document.getElementById(id);
const inputArea    = $('inputArea');
const previewArea  = $('previewArea');
const codeArea     = $('codeArea');
const inputCount   = $('inputCount');
const previewCount = $('previewCount');

// ================================================================
//  工具函数
// ================================================================
function escapeHTML(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}
function countText(str) {
    const ch = (str.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = (str.match(/[a-zA-Z0-9]+/g)    || []).length;
    return ch + en;
}
function showToast(msg, ms = 2000) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), ms);
}

// ================================================================
//  规则存储
// ================================================================
const saveRules      = () => localStorage.setItem('bookEditorRules_v3',      JSON.stringify(rules));
const saveRegexRules = () => localStorage.setItem('bookEditorRegexRules_v3', JSON.stringify(regexRules));

// 草稿自动保存/恢复
const DRAFT_KEY = 'bookEditorDraft_v3';
const saveDraft  = () => localStorage.setItem(DRAFT_KEY, inputArea.value);
const loadDraft  = () => localStorage.getItem(DRAFT_KEY) || '';

const STYLE_LABELS = {
    bold: '加粗', big: '加大', 'bold-big': '加粗+大',
    color: '高亮', italic: '斜体', underline: '下划线', 'custom-color': '自定义色'
};

// ================================================================
//  规则渲染（含命中数）
// ================================================================
function renderRules() {
    const c = $('rulesList');
    if (!rules.length) {
        c.innerHTML = '<span class="text-muted" style="font-size:11px;">暂无规则</span>';
        return;
    }
    c.innerHTML = rules.map((r, i) => {
        const hits = hitStats['kw_' + r.keyword] || 0;
        const hitBadge = hits > 0 ? ` <span class="hit-badge">${hits}</span>` : '';
        return `<div class="chip">
            <span class="toggle" data-idx="${i}" data-type="kw">${r.enabled ? '✅' : '⛔'}</span>
            <strong>${escapeHTML(r.keyword)}</strong>
            <span style="color:var(--text-secondary);font-size:10px;">${STYLE_LABELS[r.style] || r.style}</span>
            ${hitBadge}
            <span class="rm" data-idx="${i}" data-type="kw">✕</span>
        </div>`;
    }).join('');
}
function renderRegexRules() {
    const c = $('regexRulesList');
    if (!regexRules.length) {
        c.innerHTML = '<span class="text-muted" style="font-size:11px;">暂无正则规则</span>';
        return;
    }
    c.innerHTML = regexRules.map((r, i) => {
        const hits = hitStats['rx_' + i] || 0;
        const hitBadge = hits > 0 ? ` <span class="hit-badge">${hits}</span>` : '';
        const displayLabel = r.label ? escapeHTML(r.label) : `<code style="font-size:10px;color:var(--accent);">${escapeHTML(r.pattern)}</code>`;
        return `<div class="chip">
            <span class="toggle" data-idx="${i}" data-type="rx">${r.enabled !== false ? '✅' : '⛔'}</span>
            ${displayLabel}
            <span style="color:var(--text-secondary);font-size:10px;">${STYLE_LABELS[r.style] || r.style}</span>
            ${hitBadge}
            <span class="rm" data-idx="${i}" data-type="rx">✕</span>
        </div>`;
    }).join('');
}

// 委托事件（避免 inline onclick）
$('rulesList').addEventListener('click', e => {
    const el = e.target;
    const idx = parseInt(el.dataset.idx);
    if (isNaN(idx)) return;
    if (el.classList.contains('toggle')) {
        rules[idx].enabled = !rules[idx].enabled;
        saveRules(); renderRules(); processText();
    } else if (el.classList.contains('rm')) {
        rules.splice(idx, 1);
        saveRules(); renderRules(); processText(); showToast('已删除规则');
    }
});
$('regexRulesList').addEventListener('click', e => {
    const el = e.target;
    const idx = parseInt(el.dataset.idx);
    if (isNaN(idx)) return;
    if (el.classList.contains('toggle')) {
        regexRules[idx].enabled = regexRules[idx].enabled !== false ? false : true;
        saveRegexRules(); renderRegexRules(); processText();
    } else if (el.classList.contains('rm')) {
        regexRules.splice(idx, 1);
        saveRegexRules(); renderRegexRules(); processText(); showToast('已删除正则规则');
    }
});

$('addRuleBtn').addEventListener('click', () => {
    const kw    = $('newKeyword').value.trim();
    const style = $('newStyle').value;
    if (!kw) return showToast('请输入关键词');
    if (rules.some(r => r.keyword === kw && r.style === style)) return showToast('规则已存在');
    // 自定义颜色样式时，读取颜色值
    const entry = { keyword: kw, style, enabled: true };
    if (style === 'custom-color') entry.customColor = $('kwCustomColor').value || '#e74c3c';
    rules.push(entry);
    saveRules(); renderRules(); $('newKeyword').value = ''; processText(); showToast('✅ 规则已添加');
});
$('clearRulesBtn').addEventListener('click', () => {
    if (!confirm('确定清空所有关键词规则吗？')) return;
    rules = []; saveRules(); renderRules(); processText(); showToast('已清空关键词规则');
});
$('addRegexBtn').addEventListener('click', () => {
    const pattern = $('newRegexPattern').value.trim();
    const style   = $('newRegexStyle').value;
    if (!pattern) return showToast('请输入正则表达式');
    try { new RegExp(pattern); } catch(e) { return showToast('❌ 正则不合法: ' + e.message); }
    if (regexRules.some(r => r.pattern === pattern && r.style === style)) return showToast('规则已存在');
    const entry = { pattern, style, enabled: true };
    if (style === 'custom-color') entry.customColor = $('rxCustomColor').value || '#e74c3c';
    regexRules.push(entry);
    saveRegexRules(); renderRegexRules(); $('newRegexPattern').value = ''; processText(); showToast('✅ 正则规则已添加');
});
$('clearRegexBtn').addEventListener('click', () => {
    if (!confirm('确定清空所有正则规则吗？')) return;
    regexRules = []; saveRegexRules(); renderRegexRules(); processText(); showToast('已清空正则规则');
});

// 自定义颜色 picker 显示/隐藏
$('newStyle').addEventListener('change', e => {
    $('kwCustomColorRow').style.display = e.target.value === 'custom-color' ? 'flex' : 'none';
});
$('newRegexStyle').addEventListener('change', e => {
    $('rxCustomColorRow').style.display = e.target.value === 'custom-color' ? 'flex' : 'none';
});

// ================================================================
//  导入 / 导出
// ================================================================
$('exportBtn').addEventListener('click', () => {
    const data = { version: 3, exportedAt: new Date().toISOString(), rules, regexRules };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'book-editor-rules-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('✅ 规则已导出');
});
$('importBtn').addEventListener('click', () => $('importFileInput').click());
$('importFileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.rules || !data.regexRules) throw new Error('格式错误');
            rules      = data.rules.map(r =>      ({ ...r, enabled: r.enabled !== false }));
            regexRules = data.regexRules.map(r => ({ ...r, enabled: r.enabled !== false }));
            saveRules(); saveRegexRules();
            renderRules(); renderRegexRules();
            processText();
            showToast('✅ 已导入 ' + rules.length + ' 条关键词 + ' + regexRules.length + ' 条正则规则');
        } catch (err) { showToast('❌ 导入失败: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// ================================================================
//  核心：文本处理（含命中统计）
// ================================================================
function getHighlightColor() {
    return $('highlightColor').value || '#f9e2af';
}
function applyStyle(text, style, customColor) {
    const hc = getHighlightColor();
    switch (style) {
        case 'bold':         return `<b>${text}</b>`;
        case 'big':          return `<span style="font-size:1.3em;font-weight:400;">${text}</span>`;
        case 'bold-big':     return `<b style="font-size:1.3em;">${text}</b>`;
        case 'color':        return `<span style="color:${hc};">${text}</span>`;
        case 'italic':       return `<em>${text}</em>`;
        case 'underline':    return `<u>${text}</u>`;
        case 'custom-color': return `<span style="color:${customColor || '#e74c3c'};">${text}</span>`;
        default:             return text;
    }
}

function processText() {
    const raw = inputArea.value;
    if (!raw.trim()) {
        previewArea.innerHTML = '<p class="text-muted">请输入文字内容...</p>';
        codeArea.textContent  = '<!-- 暂无内容 -->';
        previewCount.textContent = '0 字';
        hitStats = {};
        renderRules();
        renderRegexRules();
        return;
    }

    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/).filter(p => p.trim());
    const htmlParts  = [];

    // 重置统计
    hitStats = {};

    paragraphs.forEach(para => {
        const lines = para.trim().split('\n').filter(l => l.trim());
        if (!lines.length) return;

        const processed = lines.map(line => {
            let s = escapeHTML(line);

            // 正则规则（含书名号预设）
            regexRules.filter(r => r.enabled !== false).forEach((rule, idx) => {
                try {
                    const re = new RegExp(rule.pattern, 'g');
                    let count = 0;
                    s = s.replace(re, m => { count++; return applyStyle(m, rule.style, rule.customColor); });
                    if (count) hitStats['rx_' + idx] = (hitStats['rx_' + idx] || 0) + count;
                } catch (_) {}
            });

            // 关键词规则（按长度降序，避免短词先匹配截断长词）
            [...rules]
                .filter(r => r.enabled !== false)
                .sort((a, b) => b.keyword.length - a.keyword.length)
                .forEach(rule => {
                    const escKw = escapeHTML(rule.keyword);
                    const regex = new RegExp(escKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                    let count = 0;
                    s = s.replace(regex, () => { count++; return applyStyle(escKw, rule.style, rule.customColor); });
                    if (count) hitStats['kw_' + rule.keyword] = (hitStats['kw_' + rule.keyword] || 0) + count;
                });

            return s;
        });

        htmlParts.push(`<p>${processed.join('<br>')}</p>`);
    });

    const finalHtml = htmlParts.join('\n');
    previewArea.innerHTML = htmlParts.join('');
    codeArea.textContent  = finalHtml;

    previewCount.textContent = countText(previewArea.innerText) + ' 字';
    updatePreviewStyle();

    // 更新命中统计徽章
    renderRules();
    renderRegexRules();
}

// ================================================================
//  预览样式
// ================================================================
function updatePreviewStyle() {
    const fs     = $('previewFontSize').value;
    const sp     = $('paragraphSpacing').value;
    const indent = $('textIndent').value;
    $('fontSizeVal').textContent = fs + 'px';
    $('spacingVal').textContent  = sp + 'em';
    $('indentVal').textContent   = indent + 'em';
    previewArea.style.fontSize   = fs + 'px';
    previewArea.querySelectorAll('p').forEach(p => {
        p.style.marginBottom = sp + 'em';
        p.style.textIndent   = indent + 'em';
    });
}
['previewFontSize', 'paragraphSpacing', 'textIndent'].forEach(id =>
    $(id).addEventListener('input', updatePreviewStyle)
);
$('highlightColor').addEventListener('change', processText);

// ================================================================
//  输入区事件（input + paste + 草稿自动保存）
// ================================================================
let debounceTimer;
function onInputChange() {
    inputCount.textContent = countText(inputArea.value) + ' 字';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        processText();
        saveDraft();
    }, 300);
}
inputArea.addEventListener('input', onInputChange);
inputArea.addEventListener('paste', () => {
    setTimeout(() => {
        onInputChange();
        clearTimeout(debounceTimer);
        processText();
        saveDraft();
    }, 50);
});

// ================================================================
//  文件上传 / 拖拽
// ================================================================
function loadText(text, name) {
    inputArea.value = text;
    onInputChange();
    showToast('✅ 已加载: ' + (name || '文件'));
}
$('dropZone').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => loadText(ev.target.result, file.name);
    reader.readAsText(file);
    e.target.value = '';
});
const dz = $('dropZone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('dragover'); });
dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && /\.(txt|md)$/i.test(file.name)) {
        const reader = new FileReader();
        reader.onload = ev => loadText(ev.target.result, file.name);
        reader.readAsText(file);
    } else {
        showToast('⚠️ 请拖入 .txt 或 .md 文件');
    }
});

// ================================================================
//  按钮操作
// ================================================================
$('templateBtn').addEventListener('click', () => {
    const tpl = `书名：《》\n作者：\n出版社：\n出版时间：\n译者：\nISBN：\n丛书名：\n\n【内容简介】\n\n【作者简介】\n\n`;
    const s = inputArea.selectionStart, e = inputArea.selectionEnd;
    inputArea.value = inputArea.value.slice(0, s) + tpl + inputArea.value.slice(e);
    inputArea.selectionStart = inputArea.selectionEnd = s + tpl.length;
    onInputChange();
    showToast('📖 模板已插入');
});

$('clearBtn').addEventListener('click', () => {
    if (!confirm('确定清空所有内容吗？')) return;
    inputArea.value = '';
    previewArea.innerHTML = '<p class="text-muted">处理后的预览将在此显示...</p>';
    codeArea.textContent  = '<!-- 暂无内容 -->';
    inputCount.textContent   = '0 字';
    previewCount.textContent = '0 字';
    localStorage.removeItem(DRAFT_KEY);
    showToast('已清空');
});

$('copyHtmlBtn').addEventListener('click', () => {
    const html = codeArea.textContent;
    if (!html.trim() || html.includes('暂无内容')) return showToast('没有可复制的内容');
    navigator.clipboard.writeText(html)
        .then(() => showToast('✅ HTML 已复制'))
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = html; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
            showToast('✅ HTML 已复制');
        });
});
$('copyTextBtn').addEventListener('click', () => {
    const text = previewArea.innerText;
    if (!text.trim() || text.includes('请输入')) return showToast('没有可复制的内容');
    navigator.clipboard.writeText(text)
        .then(() => showToast('✅ 纯文本已复制'))
        .catch(() => showToast('❌ 复制失败'));
});

const SAMPLE = `《思考的藝術》——52個思考錯誤，讓你不再只靠直覺決定一切\n\n内容简介\n\n本书是德国率先击败《贾伯斯传》的著作，连续48周位居畅销榜Top 5。由全球最大商业书摘网站getAbstract创办人撰写，获《黑天鹅效应》作者塔雷伯鼎力推荐。\n\n作者简介\n\n鲁尔夫·多贝里（Rolf Dobelli），瑞士作家，毕业于圣加仑大学，全球最大商业书摘平台 getAbstract 创办人。\n\n重要：本书揭示了52种常见的思考错误，帮助你在决策时不再依赖直觉陷阱。\n\n提示：你可以在设置面板中添加自定义关键词规则，让特定文字自动加粗、加大或高亮显示。`;
$('sampleBtn').addEventListener('click', () => { inputArea.value = SAMPLE; onInputChange(); showToast('🔄 已加载示例'); });

// ================================================================
//  快捷键
// ================================================================
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); $('copyHtmlBtn').click(); }
});

// ================================================================
//  设置面板
// ================================================================
let settingsOpen = false;
$('settingsBtn').addEventListener('click', () => {
    settingsOpen = !settingsOpen;
    $('settingsPanel').classList.toggle('open', settingsOpen);
    $('settingsBtn').textContent = settingsOpen ? '⚙️ 收起' : '⚙️ 设置';
});

// ================================================================
//  代码面板折叠
// ================================================================
let codeCollapsed = true;
$('codePanelHeader').addEventListener('click', () => {
    codeCollapsed = !codeCollapsed;
    $('codePanel').classList.toggle('collapsed', codeCollapsed);
    $('codeToggleIcon').textContent = codeCollapsed ? '▶' : '▼';
});

// ================================================================
//  上下分割线拖拽
// ================================================================
const inputSection = $('inputSection');
const resizeHandle = $('resizeHandle');
let isResizing = false, rStartY = 0, rStartH = 0;
resizeHandle.addEventListener('mousedown', e => {
    isResizing = true;
    rStartY = e.clientY;
    rStartH = inputSection.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
});
document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const dy = e.clientY - rStartY;
    const newH = Math.max(60, Math.min(window.innerHeight * 0.75, rStartH + dy));
    inputSection.style.flex = 'none';
    inputSection.style.height = newH + 'px';
});
document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
});

// ================================================================
//  主题
// ================================================================
const THEME_KEY = 'bookEditorTheme_v2';
const mq = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme);
}
$('themeSelect').addEventListener('change', e => {
    localStorage.setItem(THEME_KEY, e.target.value);
    applyTheme(e.target.value);
});
mq.addEventListener('change', () => {
    if (localStorage.getItem(THEME_KEY) === 'system') applyTheme('system');
});
function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    $('themeSelect').value = saved;
    applyTheme(saved);
}

// ================================================================
//  初始化（含草稿恢复）
// ================================================================
function init() {
    initTheme();
    renderRules();
    renderRegexRules();

    // 恢复草稿，无草稿时加载示例
    const draft = loadDraft();
    if (draft) {
        inputArea.value = draft;
        inputCount.textContent = countText(draft) + ' 字';
        processText();
        showToast('📄 已恢复上次草稿', 2500);
    } else {
        inputArea.value = SAMPLE;
        inputCount.textContent = countText(SAMPLE) + ' 字';
        processText();
    }
}
init();
