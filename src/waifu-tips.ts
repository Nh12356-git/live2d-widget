/**
 * @file 主入口模块，统一导出所有公共 API
 * @module index
 */

// 拖拽功能：允许用户拖动看板娘位置
export { default as registerDrag } from './drag.js';
// 日志工具：统一的日志输出控制
export { default as logger, LogLevel } from './logger.js';

// 工具栏：一言、截图、切换模型等功能
export * from './tools.js';
// 消息系统：显示消息、欢迎语、来路检测
export * from './message.js';
// 模型管理：本地模型加载和切换
export * from './model.js';
// 工具函数：随机选择、资源加载等
export * from './utils.js';
// 小部件：初始化和事件注册
export * from './widget.js';
