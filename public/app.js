const socket = io({ transports: ['websocket'] });
const DateTime = luxon.DateTime;

let isMergedMode = true;
let isBatchMode = false;
let selectedIds = new Set();
let isUploading = false;

let serverMessages = [];
let pendingQueue = [];
let sysConfig = { maxTexts: 500, maxFilesGB: 5, authEnabled: true };
let metrics = { textCount: 0, storageSize: 0 };

let currentAuthPin = '';
let currentAdminPass = '';
let pinInputBuf = '';

const els = {
    lockScreen: document.getElementById('lockScreen'),
    pinDots: document.getElementById('pinDots').children,
    lockTitle: document.getElementById('lockTitle'),
    
    adminAuthModal: document.getElementById('adminAuthModal'),
    adminPassInput: document.getElementById('adminPassInput'),
    verifyAdminBtn: document.getElementById('verifyAdminBtn'),
    cancelAdminAuthBtn: document.getElementById('cancelAdminAuthBtn'),
    
    viewToggleBtn: document.getElementById('viewToggleBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    
    cfgAuthEnabled: document.getElementById('cfgAuthEnabled'),
    cfgPin: document.getElementById('cfgPin'),
    cfgAdminPass: document.getElementById('cfgAdminPass'),
    cfgMaxTexts: document.getElementById('cfgMaxTexts'),
    cfgMaxFilesGB: document.getElementById('cfgMaxFilesGB'),
    
    batchModeBtn: document.getElementById('batchModeBtn'),
    navNormal: document.getElementById('navNormal'),
    navBatch: document.getElementById('navBatch'),
    cancelBatchBtn: document.getElementById('cancelBatchBtn'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),

    splitView: document.getElementById('splitView'),
    mergedView: document.getElementById('mergedView'),
    
    splitMsgList: document.getElementById('splitMsgList'),
    splitFileList: document.getElementById('splitFileList'),
    splitMsgInput: document.getElementById('splitMsgInput'),
    splitSendBtn: document.getElementById('splitSendBtn'),
    splitUploadBtn: document.getElementById('splitUploadBtn'),
    
    chatStream: document.getElementById('chatStream'),
    mergedMsgInput: document.getElementById('mergedMsgInput'),
    mergedSendBtn: document.getElementById('mergedSendBtn'),
    mergedUploadBtn: document.getElementById('mergedUploadBtn'),
    
    textCount: document.getElementById('textCount'),
    storageUsage: document.getElementById('storageUsage'),
    fileInput: document.getElementById('fileInput'),
    dragOverlay: document.getElementById('dragOverlay')
};

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const escapeHTML = (str) => {
    if (typeof str !== 'string') str = String(str || '');
    return str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag));
};

const authenticatedFetch = async (url, options = {}) => {
    options.headers = { ...options.headers, 'X-Auth-PIN': currentAuthPin };
    return fetch(url, options);
};

const renderPinDots = () => {
    for (let i = 0; i < 4; i++) {
        if (i < pinInputBuf.length) els.pinDots[i].classList.add('filled');
        else els.pinDots[i].classList.remove('filled');
    }
};

window.inputPin = (val) => {
    if (val === 'back') {
        pinInputBuf = pinInputBuf.slice(0, -1);
    } else if (pinInputBuf.length < 4) {
        pinInputBuf += val;
    }
    renderPinDots();

    if (pinInputBuf.length === 4) {
        socket.emit('verify_pin', pinInputBuf);
    }
};

document.addEventListener('keydown', (e) => {
    if (!els.lockScreen.classList.contains('hidden')) {
        if (e.key >= '0' && e.key <= '9') inputPin(e.key);
        if (e.key === 'Backspace') inputPin('back');
    }
});

socket.on('require_auth', () => {
    const savedPin = localStorage.getItem('sync_pin');
    if (savedPin) {
        socket.emit('verify_pin', savedPin);
    } else {
        els.lockScreen.classList.remove('hidden');
        pinInputBuf = '';
        renderPinDots();
    }
});

socket.on('force_reauth', () => {
    localStorage.removeItem('sync_pin');
    els.lockScreen.classList.remove('hidden');
    pinInputBuf = '';
    currentAuthPin = '';
    renderPinDots();
});

socket.on('auth_success', (state) => {
    currentAuthPin = pinInputBuf || localStorage.getItem('sync_pin');
    localStorage.setItem('sync_pin', currentAuthPin);
    els.lockScreen.classList.add('hidden');
    handleStateSync(state);
});

socket.on('auth_fail', () => {
    localStorage.removeItem('sync_pin');
    els.lockScreen.classList.remove('hidden');
    els.lockTitle.textContent = '密码错误';
    els.lockTitle.classList.add('text-red-500');
    const dots = document.getElementById('pinDots');
    dots.classList.add('shake');
    setTimeout(() => {
        dots.classList.remove('shake');
        pinInputBuf = '';
        renderPinDots();
        els.lockTitle.textContent = '输入访问密码';
        els.lockTitle.classList.remove('text-red-500');
    }, 400);
});

els.settingsBtn.addEventListener('click', () => {
    els.adminPassInput.value = '';
    els.adminAuthModal.classList.remove('hidden');
    els.adminPassInput.focus();
});

els.cancelAdminAuthBtn.addEventListener('click', () => {
    els.adminAuthModal.classList.add('hidden');
});

const submitAdminAuth = () => {
    const pass = els.adminPassInput.value;
    if (!pass) return;
    currentAdminPass = pass;
    socket.emit('verify_admin', pass);
};

els.verifyAdminBtn.addEventListener('click', submitAdminAuth);
els.adminPassInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAdminAuth();
});

socket.on('admin_success', (data) => {
    els.adminAuthModal.classList.add('hidden');
    els.cfgAuthEnabled.checked = data.authEnabled;
    els.cfgPin.value = data.pin;
    els.cfgMaxTexts.value = data.maxTexts || 500;
    els.cfgMaxFilesGB.value = data.maxFilesGB || 5;
    els.cfgAdminPass.value = ''; 
    els.settingsModal.classList.remove('hidden');
});

socket.on('admin_fail', () => {
    els.adminPassInput.value = '';
    els.adminPassInput.classList.add('border-red-500', 'shake');
    setTimeout(() => els.adminPassInput.classList.remove('border-red-500', 'shake'), 400);
});

els.closeSettingsBtn.addEventListener('click', () => els.settingsModal.classList.add('hidden'));

els.saveSettingsBtn.addEventListener('click', () => {
    socket.emit('update_config', {
        adminPass: currentAdminPass,
        authEnabled: els.cfgAuthEnabled.checked,
        newPin: els.cfgPin.value,
        newAdminPass: els.cfgAdminPass.value,
        maxTexts: els.cfgMaxTexts.value,
        maxFilesGB: els.cfgMaxFilesGB.value
    });
    els.settingsModal.classList.add('hidden');
    currentAdminPass = '';
});

const buildCheckbox = (id) => {
    if (!isBatchMode) return '';
    return `<div class="absolute left-2 top-1/2 -translate-y-1/2 z-10"><input type="checkbox" class="checkbox-custom item-checkbox" data-id="${id}" ${selectedIds.has(id)?'checked':''} onclick="toggleSelection('${id}')"></div>`;
};

const buildTextHTML = (item) => `
    <div class="bg-panel p-3 rounded border border-line w-full max-w-4xl group relative ${isBatchMode?'pl-10':''}" id="${item.id}">
        ${buildCheckbox(item.id)}
        <div class="flex justify-between items-start mb-2">
            <span class="text-xs text-gray-500 flex items-center">${DateTime.fromMillis(item.time).toFormat('MM-dd HH:mm:ss')} ${item.pending ? '<span class="spinner ml-2"></span>' : ''}</span>
            <div class="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity ${isBatchMode || item.pending ? 'hidden' : ''}">
                <button class="bg-input hover:bg-gray-600 px-3 py-1 rounded text-xs text-gray-300" onclick="copyText('${item.id}')">复制</button>
                <button class="bg-red-900/40 hover:bg-red-800/60 text-red-400 px-3 py-1 rounded text-xs" onclick="deleteText('${item.id}')">删除</button>
            </div>
        </div>
        <pre class="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed selectable">${escapeHTML(item.text)}</pre>
    </div>`;

const buildFileHTML = (item) => {
    const rawName = item.name.substring(item.name.indexOf('-') + 1);
    const ext = rawName.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
    const fileUrl = `/download/${encodeURIComponent(item.name)}?pin=${currentAuthPin}`;
    const safeName = escapeHTML(rawName);
    
    const preview = isImage && !item.pending
        ? `<a href="${fileUrl}" target="_blank" class="${isBatchMode?'pointer-events-none':''}"><img src="${fileUrl}" class="max-w-xs md:max-w-md max-h-64 object-contain rounded bg-input border border-line mt-2"></a>`
        : `<div class="mt-2 bg-input border border-line rounded p-3 flex items-center gap-3">
             <div class="w-10 h-10 bg-panel rounded flex items-center justify-center text-xs font-bold text-gray-400 uppercase">${escapeHTML(ext.substring(0,4))}</div>
             <span class="text-sm font-bold truncate flex-1 text-gray-300" title="${safeName}">${safeName}</span>
           </div>`;

    return `
    <div class="bg-panel p-3 rounded border border-line w-full max-w-4xl group relative ${isBatchMode?'pl-10':''}" id="${item.id}">
        ${buildCheckbox(item.id)}
        <div class="flex justify-between items-start mb-1">
            <div class="flex gap-3 items-center text-xs text-gray-500">
                <span class="flex items-center">${DateTime.fromMillis(item.time).toFormat('MM-dd HH:mm:ss')} ${item.pending ? '<span class="spinner ml-2"></span>' : ''}</span>
                <span>${formatBytes(item.size)}</span>
            </div>
            <div class="flex gap-2 transition-opacity opacity-100 md:opacity-0 group-hover:opacity-100 ${isBatchMode || item.pending ? 'hidden' : ''}">
                <a href="${fileUrl}" download class="bg-input hover:bg-gray-600 text-gray-200 px-3 py-1 rounded text-xs border border-line">下载</a>
                <button class="bg-red-900/40 hover:bg-red-800/60 text-red-400 px-3 py-1 rounded text-xs" onclick="deleteFile('${encodeURIComponent(item.name)}', '${item.id}')">删除</button>
            </div>
        </div>
        ${preview}
    </div>`;
};

const forceScrollBottom = () => {
    requestAnimationFrame(() => {
        if (isMergedMode) els.chatStream.scrollTop = els.chatStream.scrollHeight;
        else els.splitMsgList.scrollTop = els.splitMsgList.scrollHeight;
    });
};

const renderDisplay = () => {
    const serverIds = new Set(serverMessages.map(m => m.id));
    pendingQueue = pendingQueue.filter(m => !serverIds.has(m.id));

    const allMessages = [...serverMessages, ...pendingQueue].sort((a, b) => a.time - b.time);

    els.textCount.textContent = `${metrics.textCount}/${sysConfig.maxTexts}`;
    els.storageUsage.textContent = `${formatBytes(metrics.storageSize)}/${sysConfig.maxFilesGB} GB`;

    if (isMergedMode) {
        els.chatStream.innerHTML = allMessages.map(m => m.type === 'text' ? buildTextHTML(m) : buildFileHTML(m)).join('');
    } else {
        const texts = allMessages.filter(m => m.type === 'text');
        const files = allMessages.filter(m => m.type === 'file');
        els.splitMsgList.innerHTML = texts.map(buildTextHTML).join('');
        els.splitFileList.innerHTML = [...files].reverse().map(buildFileHTML).join('');
    }

    if (isBatchMode) {
        els.deleteSelectedBtn.textContent = `删除 (${selectedIds.size})`;
        document.querySelectorAll('.item-checkbox').forEach(cb => {
            cb.checked = selectedIds.has(cb.dataset.id);
        });
    }
};

const applyViewMode = () => {
    if (isMergedMode) {
        els.splitView.classList.add('hidden');
        els.mergedView.classList.remove('hidden');
        els.mergedView.classList.add('flex');
    } else {
        els.mergedView.classList.add('hidden');
        els.mergedView.classList.remove('flex');
        els.splitView.classList.remove('hidden');
    }
    renderDisplay();
    forceScrollBottom();
};

window.toggleSelection = (id) => {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    renderDisplay();
};

window.copyText = (id) => {
    const item = serverMessages.find(m => m.id === id) || pendingQueue.find(m => m.id === id);
    if (item && item.text) navigator.clipboard.writeText(item.text);
};

window.deleteText = (id) => {
    serverMessages = serverMessages.filter(m => m.id !== id);
    pendingQueue = pendingQueue.filter(m => m.id !== id);
    renderDisplay();
    socket.emit('delete_text', id);
};

window.deleteFile = async (encodedName, domId) => {
    serverMessages = serverMessages.filter(m => m.id !== domId);
    pendingQueue = pendingQueue.filter(m => m.id !== domId);
    renderDisplay();
    await authenticatedFetch(`/api/files/${encodedName}`, { method: 'DELETE' });
};

const sendText = (inputEl) => {
    const text = inputEl.value.trim();
    if (!text || text.length > 10000) return;

    const msgId = 'txt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    pendingQueue.push({
        id: msgId,
        type: 'text',
        text: text,
        time: Date.now(),
        pending: true
    });
    
    renderDisplay();
    forceScrollBottom();

    socket.emit('send_text', { id: msgId, text: text });
    
    inputEl.value = '';
    inputEl.style.height = inputEl.id === 'mergedMsgInput' ? '48px' : '64px';
};

els.viewToggleBtn.addEventListener('click', () => {
    isMergedMode = !isMergedMode;
    applyViewMode();
});

els.batchModeBtn.addEventListener('click', () => {
    isBatchMode = true;
    selectedIds.clear();
    els.navNormal.classList.add('hidden');
    els.navBatch.classList.remove('hidden');
    renderDisplay();
});

els.cancelBatchBtn.addEventListener('click', () => {
    isBatchMode = false;
    selectedIds.clear();
    els.navBatch.classList.add('hidden');
    els.navNormal.classList.remove('hidden');
    renderDisplay();
});

els.selectAllBtn.addEventListener('click', () => {
    const totalCount = serverMessages.length;
    if (selectedIds.size === totalCount) {
        selectedIds.clear();
    } else {
        serverMessages.forEach(m => selectedIds.add(m.id));
    }
    renderDisplay();
});

els.deleteSelectedBtn.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    
    const textIds = [];
    const fileNames = [];
    
    serverMessages.forEach(m => {
        if (selectedIds.has(m.id)) {
            if (m.type === 'text') textIds.push(m.id);
            if (m.type === 'file') fileNames.push(m.name);
        }
    });

    serverMessages = serverMessages.filter(m => !selectedIds.has(m.id));
    pendingQueue = pendingQueue.filter(m => !selectedIds.has(m.id));

    if (textIds.length > 0) socket.emit('delete_batch_texts', textIds);
    if (fileNames.length > 0) {
        await authenticatedFetch('/api/files/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: fileNames })
        });
    }

    isBatchMode = false;
    selectedIds.clear();
    els.navBatch.classList.add('hidden');
    els.navNormal.classList.remove('hidden');
    renderDisplay();
});

els.splitSendBtn.addEventListener('click', () => sendText(els.splitMsgInput));
els.mergedSendBtn.addEventListener('click', () => sendText(els.mergedMsgInput));

[els.splitMsgInput, els.mergedMsgInput].forEach(input => {
    input.addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            sendText(input); 
        }
    });
    input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
});

const handleFileUpload = async (file) => {
    if (!file || isUploading) return;
    isUploading = true;
    const btn = isMergedMode ? els.mergedUploadBtn : els.splitUploadBtn;
    btn.style.opacity = '0.5';

    const tempId = 'file-pending-' + Date.now();
    pendingQueue.push({
        id: tempId,
        type: 'file',
        name: 'temp-' + file.name,
        size: file.size,
        time: Date.now(),
        pending: true
    });
    
    renderDisplay();
    forceScrollBottom();

    const formData = new FormData();
    formData.append('file', file);
    try {
        await authenticatedFetch('/api/upload', { method: 'POST', body: formData });
    } catch (err) {}
    
    pendingQueue = pendingQueue.filter(m => m.id !== tempId);
    els.fileInput.value = '';
    isUploading = false;
    btn.style.opacity = '1';
    renderDisplay();
};

const triggerUpload = () => { if (!isUploading && !isBatchMode) els.fileInput.click(); };
els.splitUploadBtn.addEventListener('click', triggerUpload);
els.mergedUploadBtn.addEventListener('click', triggerUpload);
els.fileInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));

const handleStateSync = (state) => {
    const streamEl = isMergedMode ? els.chatStream : els.splitMsgList;
    const isBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 150;
    const oldServerLength = serverMessages.length;
    
    serverMessages = state.messages;
    metrics.textCount = state.textCount;
    metrics.storageSize = state.storageSize;
    sysConfig = state.config;
    
    renderDisplay();
    
    if (!isBatchMode && (isBottom || serverMessages.length > oldServerLength)) {
        forceScrollBottom();
    }
};

socket.on('sync_state', handleStateSync);

let dragCounter = 0;

document.body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (!els.lockScreen.classList.contains('hidden')) return;
    if (!isBatchMode && !isUploading) els.dragOverlay.classList.remove('hidden');
});

document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) els.dragOverlay.classList.add('hidden');
});

document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    els.dragOverlay.classList.add('hidden');

    if (!els.lockScreen.classList.contains('hidden')) return;
    if (isBatchMode || isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        handleFileUpload(files[0]);
    }
});

document.addEventListener('paste', (e) => {
    if (!els.lockScreen.classList.contains('hidden')) return;
    if (isBatchMode || isUploading) return;
    var cd = e.clipboardData || window.clipboardData;
    if (!cd || !cd.items) return;
    for (var i = 0; i < cd.items.length; i++) {
        if (cd.items[i].kind === 'file') {
            e.preventDefault();
            var file = cd.items[i].getAsFile();
            if (file) handleFileUpload(file);
            return;
        }
    }
});

applyViewMode();