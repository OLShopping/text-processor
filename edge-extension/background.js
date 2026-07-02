// background.js - Service Worker for 书籍简介文字处理工具
// 注册侧边栏，点击扩展图标时打开/关闭侧边栏

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('sidePanel setPanelBehavior error:', error));
