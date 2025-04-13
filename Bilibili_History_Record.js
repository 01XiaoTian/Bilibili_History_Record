// ==UserScript==
// @name         Bilibili推荐历史记录增强
// @namespace    https://github.com/01XiaoTian/Bilibili_History_Record
// @description  为B站首页推荐添加历史记录功能，支持前进、后退、清除历史记录，支持用户自定义历史记录限制。
// @version      1.1
// @description  为B站首页推荐添加历史记录功能
// @author       01XiaoTian
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

    // 使用数组管理历史记录
    let history = [];
    let currentIndex = -1;

    // 配置项直接存储在变量中
    let historyLimit = GM_getValue('historyLimit', 5);
    let autoTrim = GM_getValue('autoTrim', true);
    let exportFormat = GM_getValue('exportFormat', 'json');
    let exportLimit = GM_getValue('exportLimit', 0); // 新增：导出数量限制，0表示无限制

    // 添加视频记录处理函数
    function processVideoCards(cards) {
        const processed = new Set(); // 用于去重
        const results = [];

        cards.forEach(card => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = card;
            
            const titleEl = tempDiv.querySelector('.bili-video-card__info--tit a, .bili-video-card__info--tit, .video-name');
            const upEl = tempDiv.querySelector('.bili-video-card__info--author, .up-name, .bili-video-card__info--owner span');
            const linkEl = tempDiv.querySelector('a.bili-video-card__image--link');

            // 确保所有必要信息都存在
            if (!titleEl?.textContent || !upEl?.textContent || !linkEl?.href) return;

            const title = titleEl.textContent.trim();
            const up = upEl.textContent.trim();
            const link = linkEl.href;
            const bvid = link.match(/BV\w+/)?.[0] || '';

            // 使用BV号作为唯一标识进行去重
            if (bvid && !processed.has(bvid)) {
                processed.add(bvid);
                results.push({ title, up, link, bvid });
            }
        });

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
            history: history,
            currentIndex: currentIndex,
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
        let md = `# B站推荐历史记录\n\n`;
        md += `导出时间：${new Date().toLocaleString()}\n\n`;

        history.forEach((item, index) => {
            const content = JSON.parse(item);
            const videos = processVideoCards(content);
            
            if (videos.length === 0) return; // 跳过空记录

            md += `## 记录 ${index + 1} (共${videos.length}个视频)\n\n`;
            
            // 应用导出数量限制
            const limit = exportLimit > 0 ? Math.min(exportLimit, videos.length) : videos.length;
            videos.slice(0, limit).forEach(video => {
                md += `- [${video.title}](${video.link}) (UP主: ${video.up} | BV号: ${video.bvid})\n`;
            });
            md += '\n---\n\n';
        });

        downloadFile(md, `bilibili-history-${new Date().toLocaleDateString()}.md`, 'text/markdown');
    }

    function exportToHTML() {
        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>B站推荐历史记录</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .record { border: 1px solid #ddd; margin: 10px 0; padding: 10px; border-radius: 5px; }
        .title { color: #00a1d6; text-decoration: none; }
        .title:hover { text-decoration: underline; }
        .up { color: #999; }
        .bvid { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>B站推荐历史记录</h1>
    <p>导出时间：${new Date().toLocaleString()}</p>
    <p>共计${history.length}条记录</p>
`;

        history.forEach((item, index) => {
            const content = JSON.parse(item);
            const videos = processVideoCards(content);
            
            if (videos.length === 0) return; // 跳过空记录

            html += `<div class="record"><h2>记录 ${index + 1} (共${videos.length}个视频)</h2>`;
            
            // 应用导出数量限制
            const limit = exportLimit > 0 ? Math.min(exportLimit, videos.length) : videos.length;
            videos.slice(0, limit).forEach(video => {
                html += `
                    <div>
                        <a href="${video.link}" class="title" target="_blank">${video.title}</a>
                        <span class="up">(UP主: ${video.up})</span>
                        <span class="bvid">BV号: ${video.bvid}</span>
                    </div>`;
            });
            html += '</div>';
        });

        html += '</body></html>';
        downloadFile(html, `bilibili-history-${new Date().toLocaleDateString()}.html`, 'text/html');
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
            // 适配移动端
            const feedCards = document.querySelectorAll('.feed-card, .bili-video-card');
            return Array.from(feedCards).map(card => card.innerHTML);
        } catch (error) {
            console.error('获取推荐卡片失败:', error);
            return [];
        }
    }

    function setRecommendCards(contents) {
        try {
            // 适配移动端
            const cards = document.querySelectorAll('.feed-card, .bili-video-card');
            contents.forEach((content, index) => {
                if (cards[index]) {
                    cards[index].innerHTML = content;
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
        button.className = `history-btn ${className}`; // 使用新的history-btn类
        return button;
    }

    function insertButton(parent, button, handler) {
        button.addEventListener('click', handler);
        parent.parentNode.insertBefore(button, parent.nextSibling);
    }

    // 历史记录管理函数
    function saveCurrentState() {
        const currentContent = getRecommendCards();

        // 避免保存重复状态
        if (history.length > 0 && JSON.stringify(currentContent) === JSON.stringify(JSON.parse(history[currentIndex]))) {
            return;
        }

        if (currentIndex < history.length - 1) {
            history = history.slice(0, currentIndex + 1);
        }

        // 使用JSON字符串存储
        history.push(JSON.stringify(currentContent));
        currentIndex++;

        if (autoTrim && historyLimit > 0 && history.length > historyLimit) {
            history = history.slice(-historyLimit);
            currentIndex = history.length - 1;
        }

        updateButtonStates();
    }

    function goBack() {
        if (currentIndex <= 0) return;
        currentIndex--;
        setRecommendCards(JSON.parse(history[currentIndex]));
        updateButtonStates();
    }

    function goForward() {
        if (currentIndex >= history.length - 1) return;
        currentIndex++;
        setRecommendCards(JSON.parse(history[currentIndex]));
        updateButtonStates();
    }

    function clearHistory() {
        history = [];
        currentIndex = -1;
        updateButtonStates();
    }

    function updateButtonStates() {
        const backBtn = document.getElementById('history-back-btn');
        const forwardBtn = document.getElementById('history-forward-btn');

        if (backBtn) {
            backBtn.disabled = currentIndex <= 0;
        }

        if (forwardBtn) {
            forwardBtn.disabled = currentIndex >= history.length - 1;
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

        // 添加导出相关菜单
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

            // 修改按钮文字，使用\n强制换行
            const backButton = createButton('回到\n上页', 'history-back-btn');
            const forwardButton = createButton('进入\n下页', 'history-forward-btn');
            const clearButton = createButton('清除\n历史', 'history-clear-btn');
            const exportButton = createButton('导出\n记录', 'history-export-btn');

            // 为每个按钮添加点击事件
            backButton.addEventListener('click', goBack);
            forwardButton.addEventListener('click', goForward);
            clearButton.addEventListener('click', clearHistory);

            // 为导出按钮添加点击事件和下拉菜单
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

            // 将按钮添加到容器中
            buttonContainer.appendChild(backButton);
            buttonContainer.appendChild(forwardButton);
            buttonContainer.appendChild(clearButton);
            buttonContainer.appendChild(exportButton);

            // 将按钮容器插入到换一换按钮后面
            targetNode.parentNode.insertBefore(buttonContainer, targetNode.nextSibling);

            // 绑定换一换按钮事件
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

    // 启动脚本
    initialize();
})();
