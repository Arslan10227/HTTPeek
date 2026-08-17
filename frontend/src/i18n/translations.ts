export type Language = 'en' | 'zh' | 'zh_Hant' | 'es' | 'vi' | 'th';

export interface Translations {
  requests: string;
  favorites: string;
  history: string;
  toolbox: string;
  preference: string;
  feedback: string;
  about: string;
  filter: string;
  domainFilter: string;
  hosts: string;
  requestBlock: string;
  requestRewrite: string;
  requestRewriteEnable: string;
  requestRewriteRule: string;
  requestMap: string;
  requestCrypto: string;
  script: string;
  enableScript: string;
  scriptUseDescribe: string;
  breakpoint: string;
  weakNetwork: string;
  weakNetworkRules: string;
  weakNetworkPreset: string;
  weakNetworkPresetOffline: string;
  weakNetworkPresetSlow: string;
  weakNetworkPresetWeak: string;
  externalProxy: string;
  proxy: string;
  port: string;
  setAs: string;
  systemProxy: string;
  enabledHTTP2: string;
  proxyIgnoreDomain: string;
  username: string;
  password: string;
  reset: string;
  start: string;
  stop: string;
  clear: string;
  clearConfirm: string;
  clearConfirmSubtitle: string;
  httpsProxy: string;
  setting: string;
  mobileConnect: string;
  theme: string;
  themeColor: string;
  followSystem: string;
  themeLight: string;
  themeDark: string;
  material3: string;
  language: string;
  autoStartup: string;
  autoStartupDescribe: string;
  minimizeToTrayTitle: string;
  minimizeToTraySubtitle: string;
  memoryCleanup: string;
  memoryCleanupSubtitle: string;
  domainList: string;
  sequence: string;
  search: string;
  all: string;
  add: string;
  addSuccess: string;
  edit: string;
  delete: string;
  deleteSuccess: string;
  import: string;
  export: string;
  refresh: string;
  close: string;
  cancel: string;
  confirm: string;
  save: string;
  saveSuccess: string;
  execute: string;
  send: string;
  enable: string;
  success: string;
  fail: string;
  copied: string;
  general: string;
  request: string;
  response: string;
  cookies: string;
  websocket: string;
  sse: string;
  statusCode: string;
  duration: string;
  view: string;
  encode: string;
  other: string;
  httpRequest: string;
  textDiff: string;
  textEditor: string;
  installCaLocal: string;
  installRootCa: string;
  exportCA: string;
  exportCaP12: string;
  importCaP12: string;
  generateCA: string;
  generateCADescribe: string;
  resetDefaultCA: string;
  resetDefaultCADescribe: string;
  repeat: string;
  exportHAR: string;
  exportSuccess: string;
  exportFailed: string;
  copyUrl: string;
  copyCurl: string;
  share: string;
  addFavorite: string;
  removeFavorite: string;
}

export const translationsEn: Translations = {
  requests: 'Requests',
  favorites: 'Favorites',
  history: 'History',
  toolbox: 'Toolbox',
  preference: 'Preferences',
  feedback: 'Feedback',
  about: 'About',
  filter: 'Proxy Filter',
  domainFilter: 'Domain Filter',
  hosts: 'Hosts',
  requestBlock: 'Request Block',
  requestRewrite: 'Request Rewrite',
  requestRewriteEnable: 'Enable Request Rewrite',
  requestRewriteRule: 'Rewrite Rule',
  requestMap: 'Map Local & Remote',
  requestCrypto: 'Request Crypto',
  script: 'Script',
  enableScript: 'Enable Script',
  scriptUseDescribe: 'Intercept and modify HTTP/HTTPS traffic with JavaScript scripts',
  breakpoint: 'Breakpoint',
  weakNetwork: 'Weak Network',
  weakNetworkRules: 'Rules',
  weakNetworkPreset: 'Presets',
  weakNetworkPresetOffline: 'Offline',
  weakNetworkPresetSlow: 'Slow Network',
  weakNetworkPresetWeak: 'Weak Network',
  externalProxy: 'External Proxy',
  proxy: 'Proxy Setting',
  port: 'Port: ',
  setAs: 'Set as ',
  systemProxy: 'System Proxy',
  enabledHTTP2: 'Enable HTTP/2',
  proxyIgnoreDomain: 'Ignore Domains',
  username: 'Username',
  password: 'Password',
  reset: 'Reset',
  start: 'Start',
  stop: 'Stop',
  clear: 'Clear',
  clearConfirm: 'Clear Traffic Confirmation',
  clearConfirmSubtitle: 'Prompt before clearing the captured request list',
  httpsProxy: 'HTTPS Proxy',
  setting: 'Settings',
  mobileConnect: 'Mobile Connect',
  theme: 'Theme',
  themeColor: 'Theme Color',
  followSystem: 'Follow System',
  themeLight: 'Light',
  themeDark: 'Dark',
  material3: 'Material 3',
  language: 'Language',
  autoStartup: 'Auto Start Recording',
  autoStartupDescribe: 'Automatically start recording traffic on launch',
  minimizeToTrayTitle: 'Minimize to tray on close',
  minimizeToTraySubtitle: 'Keep ProxyPin running in system tray when closed',
  memoryCleanup: 'Memory Cleanup',
  memoryCleanupSubtitle: 'Clean early captured requests when threshold reached',
  domainList: 'Domain List',
  sequence: 'Sequence',
  search: 'Search',
  all: 'All',
  add: 'Add',
  addSuccess: 'Successfully added',
  edit: 'Edit',
  delete: 'Delete',
  deleteSuccess: 'Delete successful',
  import: 'Import',
  export: 'Export',
  refresh: 'Refresh',
  close: 'Close',
  cancel: 'Cancel',
  confirm: 'Confirm',
  save: 'Save',
  saveSuccess: 'Saved successfully',
  execute: 'Execute',
  send: 'Send',
  enable: 'Enable',
  success: 'Success',
  fail: 'Failed',
  copied: 'Copied to clipboard',
  general: 'General',
  request: 'Request',
  response: 'Response',
  cookies: 'Cookies',
  websocket: 'WebSocket',
  sse: 'SSE',
  statusCode: 'Status Code',
  duration: 'Duration',
  view: 'Viewers',
  encode: 'Encoding / Cryptography',
  other: 'Utilities',
  httpRequest: 'HTTP Request',
  textDiff: 'Text Diff',
  textEditor: 'Text Editor',
  installCaLocal: 'Install CA Locally',
  installRootCa: 'Install Root CA',
  exportCA: 'Export CA (.crt)',
  exportCaP12: 'Export CA (.p12)',
  importCaP12: 'Import CA (.p12)',
  generateCA: 'Generate New Root CA',
  generateCADescribe: 'Regenerating CA will invalidate existing certificates on connected devices.',
  resetDefaultCA: 'Reset Default Root CA',
  resetDefaultCADescribe: 'Reset to default built-in Root CA.',
  repeat: 'Repeat Request',
  exportHAR: 'Export HAR',
  exportSuccess: 'Export successful',
  exportFailed: 'Export failed',
  copyUrl: 'Copy URL',
  copyCurl: 'Copy as cURL',
  share: 'Share',
  addFavorite: 'Add to Favorites',
  removeFavorite: 'Remove from Favorites',
};

export const translationsZh: Translations = {
  requests: '抓包',
  favorites: '收藏',
  history: '历史',
  toolbox: '工具箱',
  preference: '偏好设置',
  feedback: '意见反馈',
  about: '关于',
  filter: '代理过滤',
  domainFilter: '域名过滤',
  hosts: 'Hosts',
  requestBlock: '请求屏蔽',
  requestRewrite: '请求重写',
  requestRewriteEnable: '启用请求重写',
  requestRewriteRule: '重写规则',
  requestMap: '请求映射',
  requestCrypto: '请求加解密',
  script: '脚本',
  enableScript: '启用脚本',
  scriptUseDescribe: '使用 JavaScript 脚本拦截并修改 HTTP/HTTPS 流量',
  breakpoint: '断点',
  weakNetwork: '弱网模拟',
  weakNetworkRules: '规则列表',
  weakNetworkPreset: '预设',
  weakNetworkPresetOffline: '断网',
  weakNetworkPresetSlow: '慢网',
  weakNetworkPresetWeak: '弱网',
  externalProxy: '外部代理',
  proxy: '代理设置',
  port: '端口: ',
  setAs: '设置为',
  systemProxy: '系统代理',
  enabledHTTP2: '启用 HTTP/2',
  proxyIgnoreDomain: '跳过域名',
  username: '用户名',
  password: '密码',
  reset: '重置',
  start: '启动',
  stop: '停止',
  clear: '清空',
  clearConfirm: '清空抓包确认',
  clearConfirmSubtitle: '清空请求列表前弹出二次确认对话框',
  httpsProxy: 'HTTPS 抓包',
  setting: '设置',
  mobileConnect: '手机连接',
  theme: '主题',
  themeColor: '主题颜色',
  followSystem: '跟随系统',
  themeLight: '浅色',
  themeDark: '深色',
  material3: 'Material 3',
  language: '语言',
  autoStartup: '启动时自动抓包',
  autoStartupDescribe: '软件打开时默认开始监听并抓包',
  minimizeToTrayTitle: '关闭时最小化到系统托盘',
  minimizeToTraySubtitle: '点击关闭窗口保留在托盘后台运行',
  memoryCleanup: '内存清理',
  memoryCleanupSubtitle: '请求数达到上限时自动清理早期数据',
  domainList: '域名列表',
  sequence: '请求序列',
  search: '搜索',
  all: '全部',
  add: '添加',
  addSuccess: '添加成功',
  edit: '编辑',
  delete: '删除',
  deleteSuccess: '删除成功',
  import: '导入',
  export: '导出',
  refresh: '刷新',
  close: '关闭',
  cancel: '取消',
  confirm: '确认',
  save: '保存',
  saveSuccess: '保存成功',
  execute: '执行',
  send: '发送',
  enable: '启用',
  success: '成功',
  fail: '失败',
  copied: '已复制到剪贴板',
  general: '概览',
  request: '请求',
  response: '响应',
  cookies: 'Cookies',
  websocket: 'WebSocket',
  sse: 'SSE',
  statusCode: '状态码',
  duration: '耗时',
  view: '视图工具',
  encode: '编解码 / 加密',
  other: '常用工具',
  httpRequest: 'HTTP 请求',
  textDiff: '文本比对',
  textEditor: '文本编辑器',
  installCaLocal: '安装根证书到本地',
  installRootCa: '安装根证书',
  exportCA: '导出根证书 (.crt)',
  exportCaP12: '导出根证书 (.p12)',
  importCaP12: '导入根证书 (.p12)',
  generateCA: '重新生成根证书',
  generateCADescribe: '重新生成根证书后，之前已信任该证书的设备需要重新安装并信任。',
  resetDefaultCA: '恢复默认根证书',
  resetDefaultCADescribe: '重置为软件默认内置的根证书。',
  repeat: '重发请求',
  exportHAR: '导出 HAR',
  exportSuccess: '导出成功',
  exportFailed: '导出失败',
  copyUrl: '复制 URL',
  copyCurl: '复制为 cURL',
  share: '分享',
  addFavorite: '添加收藏',
  removeFavorite: '取消收藏',
};

export const dictionaries: Record<string, Translations> = {
  en: translationsEn,
  zh: translationsZh,
  zh_Hant: translationsZh,
};
