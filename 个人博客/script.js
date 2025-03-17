document.addEventListener('DOMContentLoaded', function () {
    // 加载mammoth.js库，用于解析Word文档
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js')
        .then(() => console.log('Mammoth.js加载成功'))
        .catch(err => console.error('Mammoth.js加载失败:', err));

    // 加载外部脚本的辅助函数
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 获取DOM元素
    const themeToggle = document.querySelector('.theme-toggle');
    const searchToggle = document.querySelector('.search-toggle');
    const searchPanel = document.querySelector('.search-panel');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const aiFloatBtn = document.querySelector('.ai-float-btn');
    const aiPanel = document.querySelector('.ai-panel');
    const panelToggle = document.querySelector('.panel-toggle');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const viewButtons = document.querySelectorAll('.view-btn');
    const articlesGrid = document.querySelector('.articles-grid');
    const chatInput = document.querySelector('.chat-input');
    const sendBtn = document.querySelector('.send-btn');
    const chatMessages = document.querySelector('.chat-messages');
    const toolCards = document.querySelectorAll('.tool-card');
    const summaryButtons = document.querySelectorAll('[data-action="summary"]');
    const loadMoreBtn = document.querySelector('.load-more-btn');

    // 存储上传的文件内容
    const uploadedFiles = new Map();
    const knowledgeBaseJSON = {}; // 存储JSON格式的知识库

    // API请求的控制器，用于需要时取消请求
    let currentController = null;

    // 初始化页面
    function init() {
        // 检查主题偏好
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);

        // 从localStorage加载知识库
        loadKnowledgeBase();

        // 设置事件监听器
        setupEventListeners();

        // 淡入动画
        document.body.classList.add('loaded');

        // 添加增强功能
        initEnhancements();

        // 初始化文件上传功能
        initFileUpload();

        // 添加知识库上传UI
        createKnowledgeBaseUI();
    }

    // 创建文件上传区域
    function createKnowledgeBaseUI() {
        // 检查聊天容器是否存在
        const chatContainer = document.querySelector('.chat-input-container');
        if (!chatContainer) return;

        // 创建文件上传区域 - 深色简约设计
        const fileUploadArea = document.createElement('div');
        fileUploadArea.className = 'file-upload-area';
        fileUploadArea.innerHTML = `
            <div class="uploaded-files">
                <div class="screenshot-view">
                    <div class="robot-placeholder">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="file-list"></div>
                </div>
                <div class="upload-controls">
                    <label class="upload-btn">
                        <i class="fas fa-cloud-upload-alt"></i> 上传文件
                        <input type="file" id="file-upload" multiple accept=".txt,.doc,.docx" style="display: none;">
                    </label>
                    <button class="clear-all-btn"><i class="fas fa-trash-alt"></i> 清空</button>
                </div>
            </div>
        `;

        // 将上传区域插入到聊天输入框之前
        chatContainer.parentNode.insertBefore(fileUploadArea, chatContainer);

        // 添加清空按钮事件
        const clearAllBtn = fileUploadArea.querySelector('.clear-all-btn');
        clearAllBtn.addEventListener('click', clearAllFiles);

        // 初始更新文件列表状态
        updateFileListUI();
    }

    // 清空所有上传的文件
    function clearAllFiles() {
        uploadedFiles.clear();

        // 清空UI
        const fileList = document.querySelector('.file-list');
        if (fileList) {
            fileList.innerHTML = '';
        }

        // 保存到localStorage
        saveKnowledgeBase();
        showToast('已清空所有文件');

        // 更新UI状态
        updateFileListUI();
    }

    // 更新文件列表UI状态
    function updateFileListUI() {
        const fileList = document.querySelector('.file-list');
        const robotPlaceholder = document.querySelector('.robot-placeholder');

        if (!fileList || !robotPlaceholder) return;

        if (uploadedFiles.size === 0) {
            // 没有文件时显示机器人
            robotPlaceholder.style.display = 'block';
            fileList.style.display = 'none';
        } else {
            // 有文件时显示文件列表
            robotPlaceholder.style.display = 'none';
            fileList.style.display = 'flex';
        }
    }

    // 从localStorage加载知识库
    function loadKnowledgeBase() {
        try {
            const savedFiles = JSON.parse(localStorage.getItem('knowledgeBase')) || {};

            // 加载文件内容到Map
            Object.entries(savedFiles).forEach(([filename, content]) => {
                if (typeof content === 'object' && content.content) {
                    // 新格式：包含元数据的对象
                    uploadedFiles.set(filename, content.content);
                } else {
                    // 旧格式：直接字符串内容
                    uploadedFiles.set(filename, content);
                }
                addFileToList(filename);
            });

            // 更新UI状态
            updateFileListUI();
        } catch (error) {
            console.error('加载文件失败:', error);
        }
    }

    // 保存知识库到localStorage
    function saveKnowledgeBase() {
        try {
            // 将文件内容保存为包含元数据的对象
            const filesObject = {};
            uploadedFiles.forEach((content, filename) => {
                filesObject[filename] = {
                    content: content,
                    type: getFileType(filename),
                    size: content.length,
                    created_at: new Date().toISOString()
                };
            });

            localStorage.setItem('knowledgeBase', JSON.stringify(filesObject));
        } catch (error) {
            console.error('保存文件失败:', error);
            showToast('保存文件失败，请检查文件大小');
        }
    }

    // 初始化文件上传功能
    function initFileUpload() {
        document.addEventListener('change', async (e) => {
            if (e.target.id === 'file-upload') {
                const files = e.target.files;
                for (const file of files) {
                    try {
                        const content = await readFile(file);
                        uploadedFiles.set(file.name, content);
                        addFileToList(file.name);
                        // 保存到localStorage
                        saveKnowledgeBase();
                        showToast(`文件 ${file.name} 已上传`);
                    } catch (error) {
                        console.error(`无法读取文件 ${file.name}:`, error);
                        showToast(`无法读取文件 ${file.name}: ${error.message}`);
                    }
                }

                // 更新UI状态
                updateFileListUI();
            }
        });

        // 文件列表的点击事件委托（用于删除文件）
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-file') || e.target.closest('.remove-file')) {
                const fileName = e.target.closest('.file-item')?.dataset.filename;
                if (fileName) {
                    removeFile(fileName);
                    // 保存到localStorage
                    saveKnowledgeBase();
                    showToast(`文件 ${fileName} 已删除`);

                    // 更新UI状态
                    updateFileListUI();
                }
            }
        });
    }

    // 读取文件内容
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            // 检查文件类型
            if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
                // 如果是Word文档
                reader.onload = async (e) => {
                    try {
                        // 确认mammoth库已加载
                        if (typeof mammoth === 'undefined') {
                            // 如果库未加载，尝试等待3秒
                            console.log('等待mammoth.js加载...');
                            await new Promise(resolve => setTimeout(resolve, 3000));

                            // 再次检查
                            if (typeof mammoth === 'undefined') {
                                throw new Error('无法加载Word文档解析库');
                            }
                        }

                        // 使用mammoth解析Word文档
                        const arrayBuffer = e.target.result;
                        const result = await mammoth.extractRawText({ arrayBuffer });

                        // 获取纯文本内容
                        const text = result.value;

                        // 解析警告
                        if (result.messages.length > 0) {
                            console.warn('Word文档解析警告:', result.messages);
                        }

                        resolve(text);
                    } catch (error) {
                        console.error('Word文档解析失败:', error);
                        reject(new Error(`无法解析Word文档: ${error.message}`));
                    }
                };

                // 以ArrayBuffer格式读取文件
                reader.readAsArrayBuffer(file);
            } else if (file.type.includes('pdf')) {
                // 如果是PDF文件，暂不支持
                reject(new Error('暂不支持PDF文件'));
            } else {
                // 其他文件（txt等）作为文本读取
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('文件读取失败'));
                reader.readAsText(file);
            }

            // 通用错误处理
            reader.onerror = (e) => reject(new Error('文件读取失败'));
        });
    }

    // 添加文件到列表
    function addFileToList(fileName) {
        const fileList = document.querySelector('.file-list');
        if (!fileList) return;

        // 检查是否已存在
        if (fileList.querySelector(`.file-item[data-filename="${fileName}"]`)) {
            return;
        }

        // 隐藏机器人图标
        const robotPlaceholder = document.querySelector('.robot-placeholder');
        if (robotPlaceholder) {
            robotPlaceholder.style.display = 'none';
        }

        // 显示文件列表
        fileList.style.display = 'flex';

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.filename = fileName;

        // 使用深色设计
        const fileIcon = getFileIconByType(fileName);
        const fileSize = uploadedFiles.get(fileName)?.length || 0;
        const formattedSize = formatFileSize(fileSize);

        fileItem.innerHTML = `
            <div class="file-preview">
                <span class="file-icon">${fileIcon}</span>
                <span class="file-name">${fileName}</span>
            </div>
            <div class="file-meta">
                <span class="file-size">${formattedSize}</span>
                <button class="remove-file" title="删除文件"><i class="fas fa-times"></i></button>
            </div>
        `;
        fileList.appendChild(fileItem);

        // 添加文件预览点击事件
        const filePreview = fileItem.querySelector('.file-preview');
        filePreview.addEventListener('click', () => {
            previewFileContent(fileName);
        });
    }

    // 获取文件图标
    function getFileIconByType(fileName) {
        if (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')) {
            return '<i class="fas fa-file-word"></i>';
        } else if (fileName.toLowerCase().endsWith('.txt')) {
            return '<i class="fas fa-file-alt"></i>';
        } else {
            return '<i class="fas fa-file"></i>';
        }
    }

    // 格式化文件大小
    function formatFileSize(size) {
        if (size < 1024) {
            return size + ' B';
        } else if (size < 1024 * 1024) {
            return (size / 1024).toFixed(1) + ' KB';
        } else {
            return (size / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }

    // 预览文件内容
    function previewFileContent(fileName) {
        const content = uploadedFiles.get(fileName);
        if (!content) return;

        // 创建预览对话框
        const modal = document.createElement('div');
        modal.className = 'preview-modal';

        // 截断长文件内容以避免性能问题
        const maxDisplayChars = 5000;
        const displayContent = content.length > maxDisplayChars
            ? content.substring(0, maxDisplayChars) + '...(内容过长，已截断)'
            : content;

        modal.innerHTML = `
            <div class="preview-dialog">
                <div class="preview-header">
                    <h3>${fileName}</h3>
                    <button class="close-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="preview-content">
                    <pre>${escapeHtml(displayContent)}</pre>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加关闭事件
        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // 点击模态框外部也关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // 转义HTML以安全显示文本内容
    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 从列表和存储中移除文件
    function removeFile(fileName) {
        const fileItem = document.querySelector(`.file-item[data-filename="${fileName}"]`);
        if (fileItem) {
            fileItem.remove();
            uploadedFiles.delete(fileName);

            // 更新UI状态
            updateFileListUI();
        }
    }

    // 设置所有事件监听器
    function setupEventListeners() {
        // 主题切换
        themeToggle.addEventListener('click', toggleTheme);

        // 搜索面板
        searchToggle.addEventListener('click', toggleSearchPanel);
        document.addEventListener('click', closeSearchOnClickOutside);

        // 移动端侧边栏
        sidebarToggle.addEventListener('click', toggleSidebar);

        // AI面板
        aiFloatBtn.addEventListener('click', showMobileAiPanel);
        panelToggle.addEventListener('click', toggleAiPanel);

        // 标签页切换
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn));
        });

        // 视图切换
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => switchView(btn));
        });

        // 聊天发送
        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') sendMessage();
        });

        // AI工具卡片
        toolCards.forEach(card => {
            card.addEventListener('click', () => useAiTool(card));
        });

        // 摘要按钮
        summaryButtons.forEach(btn => {
            btn.addEventListener('click', e => generateSummary(e));
        });

        // 加载更多
        loadMoreBtn.addEventListener('click', loadMoreArticles);
    }

    // 切换主题
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        updateThemeIcon(newTheme);
    }

    // 更新主题图标
    function updateThemeIcon(theme) {
        const icon = themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    // 切换搜索面板
    function toggleSearchPanel(e) {
        e.stopPropagation();
        searchPanel.style.display = searchPanel.style.display === 'block' ? 'none' : 'block';
    }

    // 点击外部关闭搜索面板
    function closeSearchOnClickOutside(e) {
        if (searchPanel.style.display === 'block' &&
            !searchPanel.contains(e.target) &&
            !searchToggle.contains(e.target)) {
            searchPanel.style.display = 'none';
        }
    }

    // 切换移动端侧边栏
    function toggleSidebar() {
        sidebar.classList.toggle('open');
    }

    // 显示移动版AI面板
    function showMobileAiPanel() {
        // 创建移动版AI面板
        const mobileAiPanel = document.createElement('div');
        mobileAiPanel.className = 'mobile-ai-panel';
        mobileAiPanel.innerHTML = `
            <div class="mobile-ai-header">
                <h3>AI助手</h3>
                <button class="close-mobile-ai"><i class="fas fa-times"></i></button>
            </div>
            <div class="mobile-ai-content">
                <div class="chat-messages"></div>
                <div class="chat-input-container">
                    <input type="text" class="chat-input" placeholder="输入你的问题...">
                    <button class="send-btn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        document.body.appendChild(mobileAiPanel);

        // 添加关闭事件
        const closeBtn = mobileAiPanel.querySelector('.close-mobile-ai');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(mobileAiPanel);
        });

        // 添加发送消息事件
        const mobileInput = mobileAiPanel.querySelector('.chat-input');
        const mobileSend = mobileAiPanel.querySelector('.send-btn');
        const mobileChatMessages = mobileAiPanel.querySelector('.chat-messages');

        // 添加欢迎消息
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'message ai-message';
        welcomeMessage.innerHTML = '<div class="message-content"><p>你好！我是你的AI助手，有什么我能帮助你的吗？</p></div>';
        mobileChatMessages.appendChild(welcomeMessage);

        mobileSend.addEventListener('click', () => {
            const message = mobileInput.value.trim();
            if (message) {
                addMessage(message, 'user', mobileChatMessages);
                mobileInput.value = '';

                // 调用AI接口
                callAI(message, mobileChatMessages);
            }
        });

        mobileInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                const message = mobileInput.value.trim();
                if (message) {
                    addMessage(message, 'user', mobileChatMessages);
                    mobileInput.value = '';

                    // 调用AI接口
                    callAI(message, mobileChatMessages);
                }
            }
        });
    }

    // 切换AI面板显示状态
    function toggleAiPanel() {
        aiPanel.classList.toggle('collapsed');

        const icon = panelToggle.querySelector('i');
        if (aiPanel.classList.contains('collapsed')) {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-left');
        } else {
            icon.classList.remove('fa-chevron-left');
            icon.classList.add('fa-chevron-right');
        }
    }

    // 切换标签页
    function switchTab(clickedTab) {
        const tabId = clickedTab.getAttribute('data-tab');

        // 更新标签按钮状态
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        clickedTab.classList.add('active');

        // 更新内容可见性
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabId}-tab`).classList.add('active');
    }

    // 切换文章列表视图
    function switchView(clickedView) {
        const viewType = clickedView.getAttribute('data-view');

        // 更新按钮状态
        viewButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        clickedView.classList.add('active');

        // 更新文章列表样式
        if (viewType === 'list') {
            articlesGrid.classList.add('list-view');
        } else {
            articlesGrid.classList.remove('list-view');
        }
    }

    // 发送聊天消息
    function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // 添加用户消息到界面
        addMessage(message, 'user', chatMessages);
        chatInput.value = '';

        // 取消任何正在进行的请求
        if (currentController) {
            currentController.abort();
            currentController = null;
        }

        // 调用AI接口
        callAI(message, chatMessages);
    }

    // 添加消息到聊天窗口
    function addMessage(content, sender, targetContainer, typingEffect = true) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ai-message');

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        // 如果是AI消息，添加操作按钮
        if (sender === 'ai') {
            // 添加工具栏
            const toolBar = document.createElement('div');
            toolBar.className = 'message-toolbar';
            toolBar.innerHTML = `
                <button class="tool-btn copy-btn" title="复制回答">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="tool-btn share-btn" title="分享对话">
                    <i class="fas fa-share-alt"></i>
                </button>
            `;
            messageDiv.appendChild(toolBar);

            // 添加事件监听器
            setTimeout(() => {
                const copyBtn = messageDiv.querySelector('.copy-btn');
                const shareBtn = messageDiv.querySelector('.share-btn');

                copyBtn.addEventListener('click', () => {
                    const textToCopy = messageContent.textContent;
                    copyToClipboard(textToCopy);
                    showToast('已复制到剪贴板');
                });

                shareBtn.addEventListener('click', () => {
                    shareContent(messageContent.textContent);
                });
            }, 100);
        }

        messageDiv.appendChild(messageContent);
        targetContainer.appendChild(messageDiv);

        // 滚动到最新消息
        targetContainer.scrollTop = targetContainer.scrollHeight;

        // 如果需要打字机效果且是AI消息
        if (typingEffect && sender === 'ai') {
            const formattedContent = formatAIResponse(content);

            // 如果包含HTML标签，使用innerHTML，否则使用打字机效果
            if (/<[a-z][\s\S]*>/i.test(formattedContent)) {
                messageContent.innerHTML = ''; // 清空
                typeWriterHTML(messageContent, formattedContent, 0, 15);
            } else {
                messageContent.textContent = '';
                typeWriter(messageContent, formattedContent, 0, 15);
            }
        } else {
            // 如果不需要打字机效果或是用户消息，直接显示
            messageContent.innerHTML = formatAIResponse(content);
        }
    }

    // 纯文本打字机效果
    function typeWriter(element, text, index, speed) {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            index++;
            setTimeout(() => typeWriter(element, text, index, speed), speed);
        }
    }

    // HTML内容打字机效果
    function typeWriterHTML(element, html, index, speed) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const textContent = tempDiv.textContent;

        if (index < textContent.length) {
            // 先显示部分文本
            const partialText = textContent.substring(0, index + 1);
            // 替换HTML中的文本为部分文本
            const displayHTML = replaceTextInHTML(html, partialText);
            element.innerHTML = displayHTML;

            index++;
            setTimeout(() => typeWriterHTML(element, html, index, speed), speed);
        } else {
            // 完成时，显示完整HTML
            element.innerHTML = html;
        }
    }

    // 辅助函数：在HTML中替换文本，保留标签
    function replaceTextInHTML(html, newText) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        function processNode(node, textSoFar, remainingText) {
            if (node.nodeType === Node.TEXT_NODE) {
                const nodeText = node.textContent;
                if (remainingText.length <= nodeText.length) {
                    node.textContent = remainingText;
                    return [textSoFar + remainingText, ''];
                } else {
                    node.textContent = nodeText;
                    return [textSoFar + nodeText, remainingText.substring(nodeText.length)];
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                let currentText = textSoFar;
                let currentRemaining = remainingText;

                for (let i = 0; i < node.childNodes.length && currentRemaining.length > 0; i++) {
                    const [newTextSoFar, newRemainingText] = processNode(
                        node.childNodes[i],
                        currentText,
                        currentRemaining
                    );
                    currentText = newTextSoFar;
                    currentRemaining = newRemainingText;
                }

                return [currentText, currentRemaining];
            }

            return [textSoFar, remainingText];
        }

        processNode(tempDiv, '', newText);
        return tempDiv.innerHTML;
    }

    // 复制到剪贴板
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('无法复制文本: ', err);
            // 备用方案
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    }

    // 显示提示消息
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        document.body.appendChild(toast);

        // 淡入
        setTimeout(() => toast.classList.add('show'), 10);

        // 淡出并移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 2000);
    }

    // 分享内容
    function shareContent(content) {
        // 检查Web Share API可用性
        if (navigator.share) {
            navigator.share({
                title: '来自思维花园的AI对话',
                text: content,
                url: window.location.href
            }).catch(err => {
                console.error('分享失败:', err);
                showShareDialog(content);
            });
        } else {
            showShareDialog(content);
        }
    }

    // 显示自定义分享对话框
    function showShareDialog(content) {
        // 创建模态对话框
        const modal = document.createElement('div');
        modal.className = 'share-modal';

        const shortContent = content.length > 100 ? content.substring(0, 100) + '...' : content;

        modal.innerHTML = `
            <div class="share-dialog">
                <div class="share-header">
                    <h3>分享内容</h3>
                    <button class="close-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="share-content">
                    <p>${shortContent}</p>
                    <div class="share-platforms">
                        <button class="share-btn" data-platform="weixin"><i class="fab fa-weixin"></i> 微信</button>
                        <button class="share-btn" data-platform="weibo"><i class="fab fa-weibo"></i> 微博</button>
                        <button class="share-btn" data-platform="qq"><i class="fab fa-qq"></i> QQ</button>
                        <button class="share-btn" data-platform="twitter"><i class="fab fa-twitter"></i> Twitter</button>
                    </div>
                    <div class="share-link">
                        <input type="text" value="${window.location.href}" readonly>
                        <button class="copy-link-btn">复制链接</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加事件监听器
        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        const copyLinkBtn = modal.querySelector('.copy-link-btn');
        copyLinkBtn.addEventListener('click', () => {
            const linkInput = modal.querySelector('.share-link input');
            copyToClipboard(linkInput.value);
            showToast('链接已复制');
        });

        const shareBtns = modal.querySelectorAll('.share-btn');
        shareBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const platform = btn.getAttribute('data-platform');
                // 这里可以根据平台实现不同的分享逻辑

                // 显示成功消息
                showToast(`已分享到${btn.textContent.trim()}`);
                document.body.removeChild(modal);
            });
        });
    }

    // 使用AI工具
    function useAiTool(toolCard) {
        const toolType = toolCard.getAttribute('data-tool');
        let prompt = '';

        // 根据工具类型设置不同的提示词
        switch (toolType) {
            case 'summary':
                prompt = '请为我生成一篇短文的摘要，适合在博客中展示。请提供示例。';
                break;
            case 'inspiration':
                prompt = '请给我一些有创意的博客文章主题灵感，针对技术和AI领域。';
                break;
            case 'title':
                prompt = '请针对一篇关于"AI辅助内容创作"的文章，提供5个吸引人的标题建议。';
                break;
            case 'seo':
                prompt = '请提供一些技术博客SEO优化的实用建议。';
                break;
            case 'rewrite':
                prompt = '请提供内容改写的技巧，以及一个简短的示例。';
                break;
            case 'hashtags':
                prompt = '请为一篇关于"人工智能在内容创作中的应用"的文章生成合适的标签。';
                break;
            default:
                prompt = '你好，我需要一些写作帮助。';
        }

        // 切换到聊天标签
        switchTab(document.querySelector('[data-tab="chat"]'));

        // 添加用户消息
        addMessage(prompt, 'user', chatMessages);

        // 调用AI接口
        callAI(prompt, chatMessages);
    }

    // 生成文章摘要
    function generateSummary(e) {
        const article = e.target.closest('.article-card') || e.target.closest('.featured-article');
        const articleText = article.querySelector('p').textContent;
        const articleTitle = article.querySelector('h3')?.textContent || article.querySelector('h2').textContent;

        // 构建提示词
        const prompt = `请为以下文章生成一个简洁的摘要(50字左右)：\n标题: ${articleTitle}\n内容: ${articleText}`;

        // 切换到AI助手
        if (window.innerWidth > 1024) {
            // 桌面版：切换到聊天标签
            switchTab(document.querySelector('[data-tab="chat"]'));

            // 添加用户请求
            addMessage(`我想要这篇文章的摘要：${articleTitle}`, 'user', chatMessages);

            // 设置按钮加载状态
            e.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // 调用AI接口
            callAI(prompt, chatMessages, () => {
                // 恢复按钮状态
                e.target.innerHTML = e.target.hasAttribute('data-action') ?
                    '<i class="fas fa-file-alt"></i>' :
                    '<i class="fas fa-robot"></i> AI摘要';
            });
        } else {
            // 移动版：打开移动AI面板
            showMobileAiPanel();

            // 获取移动版聊天容器
            const mobileChatMessages = document.querySelector('.mobile-ai-panel .chat-messages');

            // 添加用户请求
            addMessage(`我想要这篇文章的摘要：${articleTitle}`, 'user', mobileChatMessages);

            // 调用AI接口
            callAI(prompt, mobileChatMessages);
        }
    }

    // 加载更多文章
    function loadMoreArticles() {
        // 显示加载状态
        loadMoreBtn.querySelector('span').style.display = 'none';
        loadMoreBtn.querySelector('i').style.display = 'inline-block';

        // 模拟加载延迟
        setTimeout(() => {
            // 这里通常会发送AJAX请求来加载更多内容
            // 为了演示，我们直接克隆现有卡片
            const existingCards = document.querySelectorAll('.article-card');
            const container = document.querySelector('.articles-grid');

            existingCards.forEach(card => {
                const clone = card.cloneNode(true);
                container.appendChild(clone);

                // 重新绑定事件
                const summaryBtn = clone.querySelector('[data-action="summary"]');
                if (summaryBtn) {
                    summaryBtn.addEventListener('click', e => generateSummary(e));
                }

                const relatedBtn = clone.querySelector('[data-action="related"]');
                if (relatedBtn) {
                    relatedBtn.addEventListener('click', e => findRelatedContent(e));
                }
            });

            // 恢复按钮状态
            loadMoreBtn.querySelector('span').style.display = 'inline-block';
            loadMoreBtn.querySelector('i').style.display = 'none';
        }, 1500);
    }

    // 查找相关内容
    function findRelatedContent(e) {
        const article = e.target.closest('.article-card');
        const articleText = article.querySelector('p').textContent;
        const articleTitle = article.querySelector('h3').textContent;

        // 构建提示词
        const prompt = `请基于这篇文章的主题，推荐3个相关的内容主题：\n标题: ${articleTitle}\n内容: ${articleText}`;

        // 切换到AI助手
        if (window.innerWidth > 1024) {
            // 桌面版
            switchTab(document.querySelector('[data-tab="chat"]'));
            addMessage(`请推荐与《${articleTitle}》相关的内容`, 'user', chatMessages);

            // 设置按钮加载状态
            e.target.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // 调用AI接口
            callAI(prompt, chatMessages, () => {
                // 恢复按钮状态
                e.target.innerHTML = '<i class="fas fa-link"></i>';
            });
        } else {
            // 移动版
            showMobileAiPanel();
            const mobileChatMessages = document.querySelector('.mobile-ai-panel .chat-messages');
            addMessage(`请推荐与《${articleTitle}》相关的内容`, 'user', mobileChatMessages);
            callAI(prompt, mobileChatMessages);
        }
    }

    // 调用AI接口
    async function callAI(message, targetMessageContainer, callback = null) {
        try {
            // 显示思考状态
            const thinkingMessage = "正在思考...";
            const thinkingMessageDiv = addMessage(thinkingMessage, 'ai', targetMessageContainer, false);

            // 创建一个新的AbortController
            currentController = new AbortController();
            const signal = currentController.signal;

            // 设置超时（2分钟）
            const timeoutId = setTimeout(() => {
                if (currentController) {
                    currentController.abort();
                    console.log('请求超时，已取消');
                }
            }, 120000);

            // 准备系统提示和用户消息
            let systemPrompt = "你是一个有用的AI助手。";
            let userMessageWithContext = message;

            // 有上传文件时，将文件内容添加到用户消息中
            if (uploadedFiles.size > 0) {
                console.log(`上传的文件数: ${uploadedFiles.size}`);

                // 合并所有文件内容
                let combinedContent = "";

                for (const [fileName, fileContent] of uploadedFiles.entries()) {
                    // 限制每个文件内容长度
                    const truncatedContent = fileContent.length > 10000 ?
                        fileContent.substring(0, 10000) + "..." :
                        fileContent;

                    combinedContent += `【${fileName}】\n${truncatedContent}\n\n`;
                }

                // 设置系统提示
                systemPrompt = `你是一个智能助手。请基于提供的文件内容回答用户问题。如果文件中没有相关信息，请说明你不知道而不是编造答案。`;

                // 将文件内容添加到用户消息中
                userMessageWithContext = `我上传了以下文件：
                
${combinedContent}

基于上面的文件内容，请回答我的问题：${message}`;
            }

            try {
                // 移除思考消息，创建新的AI回复消息
                if (targetMessageContainer.contains(thinkingMessageDiv)) {
                    targetMessageContainer.removeChild(thinkingMessageDiv);
                }

                // 创建AI消息容器
                const messageContent = document.createElement('div');
                messageContent.classList.add('message-content');

                const messageDiv = document.createElement('div');
                messageDiv.classList.add('message', 'ai-message');

                // 添加操作按钮
                const toolBar = document.createElement('div');
                toolBar.className = 'message-toolbar';
                toolBar.innerHTML = `
                    <button class="tool-btn copy-btn" title="复制回答">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="tool-btn share-btn" title="分享对话">
                        <i class="fas fa-share-alt"></i>
                    </button>
                `;
                messageDiv.appendChild(toolBar);
                messageDiv.appendChild(messageContent);
                targetMessageContainer.appendChild(messageDiv);

                // 滚动到最新消息
                targetMessageContainer.scrollTop = targetMessageContainer.scrollHeight;

                // 显示加载指示器
                let loadingDots = "";
                const loadingInterval = setInterval(() => {
                    loadingDots = (loadingDots.length >= 3) ? "" : loadingDots + ".";
                    messageContent.textContent = "生成回复中" + loadingDots;
                }, 300);

                // 选择模型 - 首选更强大的模型处理文件内容
                let selectedModel = "gpt-4o-mini";

                // 如果消息非常长，使用16k模型
                if (userMessageWithContext.length > 15000) {
                    selectedModel = "gpt-3.5-turbo-16k";
                }

                console.log(`使用模型: ${selectedModel}, 消息长度: ${userMessageWithContext.length}`);

                // 构建请求体
                const requestBody = {
                    model: selectedModel,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: userMessageWithContext
                        }
                    ],
                    stream: true,
                    temperature: 0.5
                };

                // 使用流式请求
                const response = await fetch('https://free.v36.cm/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer sk-vGD78RmVYMVXqkncA1306f47C57c4f45A0Ec5266100c27Bf'
                    },
                    body: JSON.stringify(requestBody),
                    signal: signal
                });

                if (!response.ok) {
                    throw new Error(`API返回错误: ${response.status}`);
                }

                // 清除加载指示器
                clearInterval(loadingInterval);
                messageContent.textContent = '';

                // 处理流式响应
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let responseText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // 解码二进制数据
                    const chunk = decoder.decode(value, { stream: true });

                    // 处理SSE格式的数据流
                    const lines = chunk.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        try {
                            // 检查是否为数据行
                            if (line.startsWith('data: ')) {
                                const dataContent = line.substring(6);

                                // 检查是否是流结束标志
                                if (dataContent === '[DONE]') {
                                    continue;
                                }

                                // 解析JSON数据
                                const data = JSON.parse(dataContent);

                                // 获取内容增量
                                if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                                    const contentDelta = data.choices[0].delta.content;
                                    responseText += contentDelta;

                                    // 更新显示内容
                                    const formattedContent = formatAIResponse(responseText);
                                    messageContent.innerHTML = formattedContent;

                                    // 滚动到最新回复
                                    targetMessageContainer.scrollTop = targetMessageContainer.scrollHeight;
                                }
                            }
                        } catch (error) {
                            console.warn('解析流式响应出错:', error);
                        }
                    }
                }

                // 添加事件监听器
                setTimeout(() => {
                    const copyBtn = messageDiv.querySelector('.copy-btn');
                    const shareBtn = messageDiv.querySelector('.share-btn');

                    copyBtn.addEventListener('click', () => {
                        const textToCopy = messageContent.textContent;
                        copyToClipboard(textToCopy);
                        showToast('已复制到剪贴板');
                    });

                    shareBtn.addEventListener('click', () => {
                        shareContent(messageContent.textContent);
                    });
                }, 100);

            } catch (err) {
                // 清除思考消息
                if (targetMessageContainer.contains(thinkingMessageDiv)) {
                    targetMessageContainer.removeChild(thinkingMessageDiv);
                }

                // 处理错误
                if (err.name === 'AbortError') {
                    console.log('请求被取消');
                    addMessage("请求时间过长，已取消。请尝试使用更简短的提问或减少文件大小。", 'ai', targetMessageContainer, false);
                } else {
                    console.error('AI调用失败:', err);
                    addMessage(`抱歉，AI服务暂时无法访问: ${err.message}`, 'ai', targetMessageContainer, false);

                    // 尝试使用模拟响应
                    setTimeout(() => {
                        const mockResponse = mockAIResponse(message);
                        addMessage("由于API暂时不可用，以下是模拟回复：\n\n" + mockResponse, 'ai', targetMessageContainer, true);
                    }, 1000);
                }
            }

            // 清除超时
            clearTimeout(timeoutId);

            // 执行回调函数（如果有）
            if (callback) callback();

        } catch (error) {
            console.error('函数调用失败:', error);

            // 删除"正在思考..."消息
            const thinkingDiv = targetMessageContainer.querySelector('.ai-message:last-child');
            if (thinkingDiv && thinkingDiv.textContent.includes('正在思考')) {
                targetMessageContainer.removeChild(thinkingDiv);
            }

            // 显示错误消息
            addMessage(`抱歉，发生了错误。错误信息: ${error.message}`, 'ai', targetMessageContainer, false);

            // 执行回调函数（如果有）
            if (callback) callback();
        } finally {
            // 重置控制器
            currentController = null;
        }
    }

    // 在开发环境中模拟AI接口响应（当本地服务不可用时）
    function mockAIResponse(message) {
        // 根据不同的问题返回不同的模拟回答
        if (message.includes('摘要') || message.includes('summary')) {
            return "这篇文章主要探讨了大型语言模型的最新发展及其局限性，分析了实现真正通用人工智能的技术挑战，并对未来发展方向提出了见解。";
        } else if (message.includes('灵感') || message.includes('inspiration')) {
            return "💡 博客灵感：\n1. 「AI模型微调的实用指南：从理论到实践」\n2. 「构建个人知识管理系统的5种方法」\n3. 「深度学习模型可解释性的前沿进展」";
        } else if (message.includes('相关') || message.includes('related')) {
            return "基于当前文章主题，以下是三个相关内容推荐：\n\n1. **深度学习框架性能对比**：探讨不同场景下各框架的优劣势\n\n2. **模型部署最佳实践**：从开发环境到生产环境的优化策略\n\n3. **机器学习工程化挑战**：大规模AI系统的工程实践与经验总结";
        } else {
            return "我是一个AI助手，很高兴能帮助你解答问题、提供写作建议或讨论技术话题。你可以询问我关于编程、AI、内容创作等方面的问题，或者使用右侧的AI工具来辅助你的创作过程。";
        }
    }

    // 初始化粒子背景
    function initParticles() {
        if (typeof particlesJS !== 'undefined') {
            particlesJS("particles-js", {
                "particles": {
                    "number": {
                        "value": 80,
                        "density": {
                            "enable": true,
                            "value_area": 800
                        }
                    },
                    "color": {
                        "value": "#6366f1"
                    },
                    "shape": {
                        "type": "circle",
                        "stroke": {
                            "width": 0,
                            "color": "#000000"
                        },
                        "polygon": {
                            "nb_sides": 5
                        }
                    },
                    "opacity": {
                        "value": 0.5,
                        "random": false,
                        "anim": {
                            "enable": false,
                            "speed": 1,
                            "opacity_min": 0.1,
                            "sync": false
                        }
                    },
                    "size": {
                        "value": 3,
                        "random": true,
                        "anim": {
                            "enable": false,
                            "speed": 40,
                            "size_min": 0.1,
                            "sync": false
                        }
                    },
                    "line_linked": {
                        "enable": true,
                        "distance": 150,
                        "color": "#6366f1",
                        "opacity": 0.4,
                        "width": 1
                    },
                    "move": {
                        "enable": true,
                        "speed": 2,
                        "direction": "none",
                        "random": false,
                        "straight": false,
                        "out_mode": "out",
                        "bounce": false,
                        "attract": {
                            "enable": false,
                            "rotateX": 600,
                            "rotateY": 1200
                        }
                    }
                },
                "interactivity": {
                    "detect_on": "canvas",
                    "events": {
                        "onhover": {
                            "enable": true,
                            "mode": "grab"
                        },
                        "onclick": {
                            "enable": true,
                            "mode": "push"
                        },
                        "resize": true
                    },
                    "modes": {
                        "grab": {
                            "distance": 140,
                            "line_linked": {
                                "opacity": 1
                            }
                        },
                        "bubble": {
                            "distance": 400,
                            "size": 40,
                            "duration": 2,
                            "opacity": 8,
                            "speed": 3
                        },
                        "repulse": {
                            "distance": 200,
                            "duration": 0.4
                        },
                        "push": {
                            "particles_nb": 4
                        },
                        "remove": {
                            "particles_nb": 2
                        }
                    }
                },
                "retina_detect": true
            });
        }
    }

    // 添加图片懒加载功能
    function setupLazyLoading() {
        const lazyImages = document.querySelectorAll('img[data-src]');

        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.add('loaded');
                        imageObserver.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // 回退方案
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
            });
        }
    }

    // 添加动态图标效果
    function setupFloatingIcons() {
        const icons = document.querySelectorAll('.floating-icon');

        icons.forEach(icon => {
            // 随机动画延迟
            const delay = Math.random() * 2;
            icon.style.animationDelay = `${delay}s`;
        });
    }

    // 添加图片浏览功能
    function setupImageLightbox() {
        const articleImages = document.querySelectorAll('.article-card img, .featured-article img');

        articleImages.forEach(img => {
            img.addEventListener('click', () => {
                // 创建灯箱效果
                const lightbox = document.createElement('div');
                lightbox.className = 'lightbox';

                const imgClone = document.createElement('img');
                imgClone.src = img.src;

                const closeBtn = document.createElement('button');
                closeBtn.className = 'lightbox-close';
                closeBtn.innerHTML = '<i class="fas fa-times"></i>';

                lightbox.appendChild(imgClone);
                lightbox.appendChild(closeBtn);
                document.body.appendChild(lightbox);

                // 添加动画效果
                setTimeout(() => lightbox.classList.add('active'), 10);

                // 关闭灯箱
                closeBtn.addEventListener('click', () => {
                    lightbox.classList.remove('active');
                    setTimeout(() => document.body.removeChild(lightbox), 300);
                });

                // 点击背景也关闭
                lightbox.addEventListener('click', (e) => {
                    if (e.target === lightbox) {
                        lightbox.classList.remove('active');
                        setTimeout(() => document.body.removeChild(lightbox), 300);
                    }
                });
            });
        });
    }

    // 添加AI助手头像动画
    function setupAIAvatarEffects() {
        const aiAvatars = document.querySelectorAll('.ai-avatar img');

        aiAvatars.forEach(avatar => {
            avatar.addEventListener('mouseover', () => {
                avatar.classList.add('animate__animated', 'animate__pulse');
            });

            avatar.addEventListener('animationend', () => {
                avatar.classList.remove('animate__animated', 'animate__pulse');
            });
        });
    }

    // 添加AI打字动画效果增强
    function enhanceTypingEffect() {
        // 添加光标闪烁
        const addCursorBlink = (element) => {
            element.classList.add('typing');
            element.addEventListener('animationend', () => {
                setTimeout(() => {
                    element.classList.remove('typing');
                }, 500);
            });
        };

        // 增强typeWriter函数
        window.originalTypeWriter = window.typeWriter;
        window.typeWriter = function (element, text, index, speed) {
            if (index === 0) {
                addCursorBlink(element);
            }

            if (index < text.length) {
                // 添加打字音效
                if (index % 3 === 0) {
                    const typeSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-keyboard-tap-2546.mp3');
                    typeSound.volume = 0.1;
                    typeSound.playbackRate = 2.5;
                    typeSound.play().catch(e => console.log('无法播放音效:', e));
                }

                element.textContent += text.charAt(index);
                index++;

                // 随机化打字速度，更自然
                const randomSpeed = speed * (0.8 + Math.random() * 0.4);
                setTimeout(() => typeWriter(element, text, index, speed), randomSpeed);
            } else {
                element.classList.remove('typing');
            }
        };
    }

    // 添加AI助手表情动画
    function setupAIEmotions() {
        const emotions = [
            { emotion: '思考中', emoji: '🤔', class: 'thinking' },
            { emotion: '有灵感了', emoji: '💡', class: 'idea' },
            { emotion: '解释中', emoji: '👨‍🏫', class: 'explaining' },
            { emotion: '很高兴', emoji: '😊', class: 'happy' }
        ];

        const aiMessages = document.querySelectorAll('.ai-message');

        aiMessages.forEach(msg => {
            // 随机选择一个表情
            const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

            const emotionBubble = document.createElement('div');
            emotionBubble.className = `emotion-bubble ${randomEmotion.class}`;
            emotionBubble.textContent = randomEmotion.emoji;

            msg.appendChild(emotionBubble);

            // 动画效果
            setTimeout(() => {
                emotionBubble.classList.add('show');

                // 3秒后隐藏
                setTimeout(() => {
                    emotionBubble.classList.remove('show');
                }, 3000);
            }, 500);
        });
    }

    // 初始化所有增强功能
    function initEnhancements() {
        initParticles();
        setupLazyLoading();
        setupFloatingIcons();
        setupImageLightbox();
        setupAIAvatarEffects();
        enhanceTypingEffect();
        setupAIEmotions();
    }

    // 初始化
    init();

    // 设置智能搜索
    setupSmartSearch();

    // 设置阅读进度指示器
    setupReadingProgress();

    // 设置主题切换过渡效果
    setupThemeTransition();

    // 设置滚动触发动画
    setupScrollAnimations();

    // 添加页面加载完成后的渐入效果
    document.body.classList.add('page-loaded');

    // 鼠标跟踪小人效果
    const follower = document.querySelector('.cursor-follower');

    if (follower) {
        document.addEventListener('mousemove', function (e) {
            const x = e.clientX;
            const y = e.clientY;

            // 添加一点延迟让跟随更自然
            setTimeout(() => {
                follower.style.transform = `translate(${x}px, ${y}px)`;
            }, 50);
        });

        // 鼠标离开页面时隐藏
        document.addEventListener('mouseout', function () {
            follower.style.display = 'none';
        });

        document.addEventListener('mouseover', function () {
            follower.style.display = 'block';
        });
    }

    // 获取文件类型
    function getFileType(filename) {
        if (filename.toLowerCase().endsWith('.docx') || filename.toLowerCase().endsWith('.doc')) {
            return 'document';
        } else if (filename.toLowerCase().endsWith('.txt')) {
            return 'text';
        } else {
            return 'unknown';
        }
    }

    // 格式化AI回复（处理换行等）
    function formatAIResponse(response) {
        // 将换行符转换为HTML换行
        return response.replace(/\n/g, '<br>');
    }
});