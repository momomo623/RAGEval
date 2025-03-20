import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import ConfigModal from '../components/ConfigModal';
import { LLMConfig, RAGConfig } from '../hooks/useConfig';

// 本地存储键
const LLM_CONFIG_KEY = 'rag_eval_llm_config';
const RAG_CONFIG_KEY = 'rag_eval_rag_config';

interface ConfigContextType {
  showConfigModal: () => void;
  getLLMConfig: () => LLMConfig | null;
  getRAGConfig: () => RAGConfig | null;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfigContext = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfigContext must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [configModalVisible, setConfigModalVisible] = useState(false);

  const showConfigModal = useCallback(() => {
    setConfigModalVisible(true);
  }, []);

  const hideConfigModal = useCallback(() => {
    setConfigModalVisible(false);
  }, []);

  const getLLMConfig = useCallback((): LLMConfig | null => {
    try {
      const savedConfig = localStorage.getItem(LLM_CONFIG_KEY);
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
    } catch (error) {
      console.error('读取LLM配置失败:', error);
    }
    return null;
  }, []);

  const getRAGConfig = useCallback((): RAGConfig | null => {
    try {
      const savedConfig = localStorage.getItem(RAG_CONFIG_KEY);
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
    } catch (error) {
      console.error('读取RAG配置失败:', error);
    }
    return null;
  }, []);

  const value = {
    showConfigModal,
    getLLMConfig,
    getRAGConfig
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
      <ConfigModal visible={configModalVisible} onClose={hideConfigModal} />
    </ConfigContext.Provider>
  );
}; 