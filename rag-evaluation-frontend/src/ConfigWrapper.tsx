import React from 'react';
import { ConfigProvider as ConfigContextProvider } from './contexts/ConfigContext';

interface ConfigWrapperProps {
  children: React.ReactNode;
}

const ConfigWrapper: React.FC<ConfigWrapperProps> = ({ children }) => {
  return (
    <ConfigContextProvider>
      {children}
    </ConfigContextProvider>
  );
};

export default ConfigWrapper; 