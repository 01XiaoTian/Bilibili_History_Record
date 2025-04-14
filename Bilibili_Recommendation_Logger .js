// ==UserScript==
// @name         Bilibili推荐历史记录增强
// @namespace    https://github.com/01XiaoTian/Bilibili_Recommendation_Logger
// @description  为B站首页推荐添加历史记录功能，支持前进、后退、清除历史记录，支持用户自定义历史记录限制。
// @version      1.1
// @description  为B站首页推荐添加历史记录功能
// @author       Your name
// @match        https://www.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .history-btn {
            margin: 4px 0;
            background-color: #00a1d6;
            color: white;
            border: none;
            padding: 6px 8px;
            text-align: center;
            text-decoration: none;
            display: block;
            font-size: 12px;
            cursor: pointer;
            border-radius: 4px;
            width: 100%;
            max-width: 60px;
            line-height: 1.2;
            transition: background-color 0.2s;
            word-break: break-all;
            white-space: pre-line;
        }
        .history-btn:hover {
            background-color: #00b5e5;
        }
        .history-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background-color: #99a2aa;
        }
        .history-buttons {
            margin: 8px 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
        }
    `;
    document.head.appendChild(style);

    // 使用Map管理历史记录
    let history = new Map();
    let currentIndex = -1;
    let maxIndex = -1;

    // 配置项直接存储在变量中
    let historyLimit = GM_getValue('historyLimit', 5);
    let autoTrim = GM_getValue('autoTrim', true);
    let exportFormat = GM_getValue('exportFormat', 'json');
    let exportLimit = GM_getValue('exportLimit', 0); // 新增：导出数量限制，0表示无限制

    // 修改视频记录处理函数
    function processVideoCards(cardData) {
        const processed = new Set();
        const results = [];
        
        try {
            // 处理JSON字符串
            const content = typeof cardData === 'string' ? JSON.parse(cardData) : cardData;
            
            // 创建临时容器解析HTML
            const tempDiv = document.createElement('div');
            content.forEach(htmlString => {
                tempDiv.innerHTML = htmlString;
                
                // 查找所有视频卡片
                const cards = tempDiv.querySelectorAll('.feed-card, .bili-video-card, .video-card');
                
                cards.forEach(card => {
                    // 提取视频信息
                    const titleEl = card.querySelector('.bili-video-card__info--tit, .video-name');
                    const upEl = card.querySelector('.bili-video-card__info--author, .up-name');
                    const linkEl = card.querySelector('a[href*="/video/"]');

                    if (!titleEl?.textContent || !upEl?.textContent || !linkEl?.href) return;

                    const title = titleEl.textContent.trim();
                    const up = upEl.textContent.trim();
                    const link = linkEl.href;
                    const bvid = link.match(/BV\w+/)?.[0] || '';

                    if (bvid && !processed.has(bvid)) {
                        processed.add(bvid);
                        results.push({ title, up, link, bvid });
                    }
                });
                
                // 清空临时容器
                tempDiv.innerHTML = '';
            });
        } catch (error) {
            console.error('处理视频卡片失败:', error);
        }

        return results;
    }

    // 更新配置的函数
    function setHistoryLimit(value) {
        historyLimit = value;
        GM_setValue('historyLimit', value);
        updateMenuCommands();
    }

    function toggleAutoTrim() {
        autoTrim = !autoTrim;
        GM_setValue('autoTrim', autoTrim);
        updateMenuCommands();
    }

    // 新增：导出功能相关函数
    function exportToJSON() {
        const data = {
            history: Array.from(history.entries()),
            currentIndex: currentIndex,
            maxIndex: maxIndex,
            exportDate: new Date().toISOString(),
            metadata: {
                version: '1.1',
                type: 'bilibili-history'
            }
        };
        downloadFile(
            JSON.stringify(data, null, 2),
            `bilibili-history-${new Date().toLocaleDateString()}.json`,
            'application/json'
        );
    }

    function exportToMarkdown() {
        try {
            let md = `# B站推荐历史记录\n\n`;
            md += `导出时间：${new Date().toLocaleString()}\n`;
            md += `导出限制：${exportLimit > 0 ? `每页${exportLimit}个视频` : '无限制'}\n\n`;

            let totalVideos = 0;
            let totalExported = 0;

            history.forEach((content, index) => {
                const videos = processVideoCards(content);
                if (!videos || videos.length === 0) return;

                totalVideos += videos.length;
                const pageLimit = exportLimit > 0 ? exportLimit : videos.length;
                const exportedVideos = videos.slice(0, pageLimit);
                totalExported += exportedVideos.length;

                md += `## 记录 ${index + 1}\n`;
                md += `本页共有 ${videos.length} 个视频${pageLimit < videos.length ? `，导出前 ${pageLimit} 个` : ''}\n\n`;

                exportedVideos.forEach((video, vIndex) => {
                    md += `${vIndex + 1}. [${video.title}](${video.link})\n`;
                    md += `   UP主：${video.up} | BV号：${video.bvid}\n\n`;
                });

                md += '\n---\n\n';
            });

            md += `## 导出统计\n`;
            md += `总计发现：${totalVideos} 个视频\n`;
            md += `实际导出：${totalExported} 个视频\n`;

            downloadFile(md, `bilibili-history-${new Date().toLocaleDateString()}.md`, 'text/markdown');
            
            console.log(`导出成功：找到${totalVideos}个视频，导出了${totalExported}个视频`);
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败，请查看控制台获取详细信息');
        }
    }

    function exportToHTML() {
        try {
            let totalVideos = 0;
            let totalExported = 0;
            let recordsHtml = '';

            history.forEach((content, index) => {
                const videos = processVideoCards(content);
                if (videos.length === 0) return;

                totalVideos += videos.length;
                const pageLimit = exportLimit > 0 ? exportLimit : videos.length;
                totalExported += Math.min(pageLimit, videos.length);

                recordsHtml += `
                <div class="record">
                    <h2>记录 ${index + 1}</h2>
                    <p class="video-count">本页共有 ${videos.length} 个视频${
                        exportLimit > 0 ? `，导出前 ${pageLimit} 个` : ''
                    }</p>
                    <div class="video-list">`;

                videos.slice(0, pageLimit).forEach((video, vIndex) => {
                    recordsHtml += `
                        <div class="video-item">
                            <span class="index">${vIndex + 1}.</span>
                            <a href="${video.link}" class="title" target="_blank">${video.title}</a>
                            <span class="up">UP主：${video.up}</span>
                            <span class="bvid">BV号：${video.bvid}</span>
                        </div>`;
                });

                recordsHtml += `</div></div>`;
            });

            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>B站推荐历史记录</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
        .record { border: 1px solid #ddd; margin: 15px 0; padding: 15px; border-radius: 8px; }
        .title { color: #00a1d6; text-decoration: none; margin-right: 10px; }
        .title:hover { text-decoration: underline; }
        .up, .bvid { color: #666; margin-right: 10px; }
        .video-count { color: #666; font-style: italic; }
        .video-item { margin: 10px 0; padding: 5px 0; border-bottom: 1px dashed #eee; }
        .index { color: #999; margin-right: 10px; }
        .stats { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>B站推荐历史记录</h1>
    <div class="stats">
        <p>导出时间：${new Date().toLocaleString()}</p>
        <p>导出限制：${exportLimit > 0 ? `每页${exportLimit}个视频` : '无限制'}</p>
        <p>总计发现：${totalVideos} 个视频</p>
        <p>实际导出：${totalExported} 个视频</p>
    </div>
    ${recordsHtml}
</body>
</html>`;

            downloadFile(html, `bilibili-history-${new Date().toLocaleDateString()}.html`, 'text/html');
        } catch (error) {
            console.error('导出HTML失败:', error);
            alert('导出失败，请查看控制台获取详细信息');
        }
    }

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // DOM操作函数
    function getRecommendCards() {
        try {
            const feedCards = document.querySelectorAll('.feed-card, .bili-video-card, .video-card');
            const cards = Array.from(feedCards);
            return cards.filter(card => {
                const link = card.querySelector('a[href*="/video/"]');
                return link !== null;
            }).map(card => card.outerHTML);
        } catch (error) {
            console.error('获取推荐卡片失败:', error);
            return [];
        }
    }

    function setRecommendCards(contents) {
        try {
            const cards = document.querySelectorAll('.feed-card, .bili-video-card, .video-card');
            cards.forEach((card, index) => {
                if (contents[index]) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = contents[index];
                    const newCard = tempDiv.firstElementChild;
                    if (newCard) {
                        card.replaceWith(newCard);
                    }
                }
            });
        } catch (error) {
            console.error('设置推荐卡片失败:', error);
        }
    }

    function createButton(text, id, className = '') {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.id = id;
        button.className = `history-btn ${className}`;
        return button;
    }

    function insertButton(parent, button, handler) {
        button.addEventListener('click', handler);
        parent.parentNode.insertBefore(button, parent.nextSibling);
    }

    // 历史记录管理函数
    function saveCurrentState() {
        const currentContent = getRecommendCards();
        if (!currentContent || currentContent.length === 0) return;

        if (history.size > 0 && history.has(currentIndex)) {
            const lastContent = JSON.parse(history.get(currentIndex));
            if (JSON.stringify(currentContent) === JSON.stringify(lastContent)) {
                return;
            }
        }

        currentIndex++;
        maxIndex = currentIndex;
        history.set(currentIndex, JSON.stringify(currentContent));

        if (autoTrim && historyLimit > 0 && history.size > historyLimit) {
            const entriesToKeep = Array.from(history.entries())
                .slice(-historyLimit);
            history = new Map(entriesToKeep);
            currentIndex = history.size - 1;
            maxIndex = currentIndex;
        }

        updateButtonStates();
        
        console.log(`保存状态：找到${currentContent.length}个视频`);
    }

    function goBack() {
        if (currentIndex <= 0) return;
        currentIndex--;
        setRecommendCards(JSON.parse(history.get(currentIndex)));
        updateButtonStates();
    }

    function goForward() {
        if (currentIndex >= maxIndex) return;
        currentIndex++;
        setRecommendCards(JSON.parse(history.get(currentIndex)));
        updateButtonStates();
    }

    function clearHistory() {
        history.clear();
        currentIndex = -1;
        maxIndex = -1;
        updateButtonStates();
    }

    function updateButtonStates() {
        const backBtn = document.getElementById('history-back-btn');
        const forwardBtn = document.getElementById('history-forward-btn');

        if (backBtn) {
            backBtn.disabled = currentIndex <= 0;
        }

        if (forwardBtn) {
            forwardBtn.disabled = currentIndex >= maxIndex;
        }
    }

    // 菜单命令管理
    let autoTrimMenuId;
    let limitMenuId;

    function updateMenuCommands() {
        if (autoTrimMenuId) GM_unregisterMenuCommand(autoTrimMenuId);
        if (limitMenuId) GM_unregisterMenuCommand(limitMenuId);

        autoTrimMenuId = GM_registerMenuCommand(
            `${autoTrim ? '✅' : '❌'} 自动删除超出限制的记录`,
            toggleAutoTrim
        );

        limitMenuId = GM_registerMenuCommand(
            `设置历史记录限制 (当前: ${historyLimit || '无限制'})`,
            () => {
                Swal.fire({
                    title: '设置历史记录限制',
                    input: 'number',
                    inputValue: historyLimit,
                    showCancelButton: true,
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    inputValidator: (value) => {
                        const limit = parseInt(value);
                        if (isNaN(limit) || limit < 0) {
                            return '请输入一个非负整数';
                        }
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        setHistoryLimit(parseInt(result.value));
                    }
                });
            }
        );

        GM_registerMenuCommand(
            `📊 设置导出数量 (当前: ${exportLimit || '无限制'})`,
            () => {
                Swal.fire({
                    title: '设置每页导出视频数量',
                    text: '设置为0表示导出全部视频',
                    input: 'number',
                    inputValue: exportLimit,
                    showCancelButton: true,
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    inputValidator: (value) => {
                        const limit = parseInt(value);
                        if (isNaN(limit) || limit < 0) {
                            return '请输入一个非负整数';
                        }
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        exportLimit = parseInt(result.value);
                        GM_setValue('exportLimit', exportLimit);
                    }
                });
            }
        );

        GM_registerMenuCommand('📤 导出为JSON', exportToJSON);
        GM_registerMenuCommand('📝 导出为Markdown', exportToMarkdown);
        GM_registerMenuCommand('🌐 导出为HTML', exportToHTML);
    }

    // 初始化
    function initialize() {
        const observer = new MutationObserver((mutations, observer) => {
            const rollBtn = document.querySelector('.roll-btn');
            const targetNode = rollBtn ? rollBtn : document.querySelector('.bili-video-card__refresh');

            if (!targetNode) return;
            if (targetNode.dataset.enhanced) return;

            targetNode.dataset.enhanced = 'true';

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'history-buttons';

            const backButton = createButton('回到\n上页', 'history-back-btn');
            const forwardButton = createButton('进入\n下页', 'history-forward-btn');
            const clearButton = createButton('清除\n历史', 'history-clear-btn');
            const exportButton = createButton('导出\n记录', 'history-export-btn');

            backButton.addEventListener('click', goBack);
            forwardButton.addEventListener('click', goForward);
            clearButton.addEventListener('click', clearHistory);

            exportButton.addEventListener('click', () => {
                Swal.fire({
                    title: '选择导出格式',
                    showDenyButton: true,
                    showCancelButton: true,
                    confirmButtonText: 'JSON',
                    denyButtonText: 'Markdown',
                    cancelButtonText: 'HTML'
                }).then((result) => {
                    if (result.isConfirmed) {
                        exportToJSON();
                    } else if (result.isDenied) {
                        exportToMarkdown();
                    } else if (result.dismiss === Swal.DismissReason.cancel) {
                        exportToHTML();
                    }
                });
            });

            buttonContainer.appendChild(backButton);
            buttonContainer.appendChild(forwardButton);
            buttonContainer.appendChild(clearButton);
            buttonContainer.appendChild(exportButton);

            targetNode.parentNode.insertBefore(buttonContainer, targetNode.nextSibling);

            targetNode.addEventListener('click', () => {
                setTimeout(() => saveCurrentState(), 750);
            });

            saveCurrentState();
            observer.disconnect();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });

        updateMenuCommands();
    }

    initialize();
})();
