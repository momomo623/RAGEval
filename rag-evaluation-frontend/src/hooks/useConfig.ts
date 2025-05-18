// import { useState, useCallback } from 'react';
//
// // 本地存储键
// const LLM_CONFIG_KEY = 'rag_eval_llm_config';
// const RAG_CONFIG_KEY = 'rag_eval_rag_config';
//
// // 类型定义
// export interface LLMConfig {
//   baseUrl: string;
//   apiKey: string;
//   modelName: string;
//   additionalParams: Record<string, any>;
// }
//
// export interface RAGConfig {
//   url: string;
//   authType: 'none' | 'apiKey' | 'basic';
//   apiKey?: string;
//   username?: string;
//   password?: string;
//   requestTemplate: string;
//   responsePath: string;
// }
//
// export function useConfig() {
//   const [configModalVisible, setConfigModalVisible] = useState(false);
//
//   const showConfigModal = useCallback(() => {
//     setConfigModalVisible(true);
//   }, []);
//
//   const hideConfigModal = useCallback(() => {
//     setConfigModalVisible(false);
//   }, []);
//
//   const getLLMConfig = useCallback((): LLMConfig | null => {
//     try {
//       const savedConfig = localStorage.getItem(LLM_CONFIG_KEY);
//       if (savedConfig) {
//         return JSON.parse(savedConfig);
//       }
//     } catch (error) {
//       console.error('读取LLM配置失败:', error);
//     }
//     return null;
//   }, []);
//
//   const getRAGConfig = useCallback((): RAGConfig | null => {
//     try {
//       const savedConfig = localStorage.getItem(RAG_CONFIG_KEY);
//       if (savedConfig) {
//         return JSON.parse(savedConfig);
//       }
//     } catch (error) {
//       console.error('读取RAG配置失败:', error);
//     }
//     return null;
//   }, []);
//
//   return {
//     configModalVisible,
//     showConfigModal,
//     hideConfigModal,
//     getLLMConfig,
//     getRAGConfig
//   };
// }