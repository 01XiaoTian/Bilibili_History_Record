# Bilibili_History_Record
# Bilibili推荐历史记录增强

一个用于增强B站首页推荐功能的浏览器用户脚本，支持推荐历史记录、导出等功能。

## 功能特点

- 📝 记录推荐历史：保存浏览过的推荐内容
- ⏮️ 前进/后退：可以在历史推荐之间切换  
- 🔄 自动更新：点击"换一换"时自动保存记录
- 📊 多格式导出：支持JSON、Markdown和HTML格式导出
- ⚙️ 可配置性：支持自定义历史记录数量和导出条数限制

## 安装使用

1. 安装浏览器的用户脚本管理器(如 Tampermonkey)
2. 点击[安装链接]()安装此脚本
3. 访问 bilibili.com，页面右侧会出现历史记录控制按钮

## 配置选项

在油猴扩展的菜单中可以找到以下配置项：

- ⚡ 自动删除超出限制的记录：开启/关闭自动清理
- 📋 历史记录数量限制：设置保存的最大记录数
- 🔢 导出数量限制：设置每页导出的最大视频数量

## 导出功能

支持以下格式导出历史记录：

- JSON: 完整的数据导出,包含所有元数据
- Markdown: 简洁的列表格式,适合笔记和分享
- HTML: 美观的网页格式,可直接在浏览器查看

## 依赖

- Tampermonkey 或其他用户脚本管理器
- SweetAlert2 (用于界面交互)

## 技术实现
### 数据管理
- 使用数组 `history[]`存储所有历史记录,每条记录为JSON字符串
- `currentIndex`追踪当前浏览位置
- 通过`GM_getValue/GM_setValue`持久化配置项
- 配置项包括
  ```javasccript
  historyLimit    // 历史记录上限
  autoTrim        // 是否自动清理过期记录  
  exportFormat    // 导出格式
  exportLimit     // 每页导出数量限制
  ```
### DOM操作
- `MutationObserver` 监听页面变化
- 使用 `querySelector `定位关键元素
- 动态创建和插入按钮
- `CSS`样式隔离,避免污染
  ```javascript
  .history-btn {
  margin: 4px 0;
  background-color: #00a1d6;
  /* ...其他样式... */
  }
  ```
### 历史记录处理
 ```javascript
function saveCurrentState() {
  const currentContent = getRecommendCards();
  // 避免重复记录
  if (isDuplicate(currentContent)) return;
  
  // 更新历史记录
  history.push(JSON.stringify(currentContent));
  currentIndex++;

  // 自动清理
  if (shouldTrim()) {
    trimHistory();
  }
}
```
## 导出功能
支持三种格式
### JSON
```javascript
{
  history: [...],
  currentIndex: n,
  exportDate: "ISO时间戳",
  metadata: {
    version: "1.1",
    type: "bilibili-history"
  }
}
```

### Markdown
```javascript
# B站推荐历史记录
导出时间: xxx
## 记录 1 (共n个视频) 
- [视频标题](链接) (UP主: xxx | BV号: xxx)
```

### HTML
- 包含完整样式的静态页面
- 支持链接跳转
- 响应式布局

## 许可证

MIT License

## 更新日志

### v1.1
- 新增多格式导出功能
- 新增导出数量限制设置
- 优化按钮布局和样式

### v1.0  
- 首次发布
- 实现基本的历史记录功能
