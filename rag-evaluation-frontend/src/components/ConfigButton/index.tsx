import React from 'react';
import { Button, Tooltip } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useConfigContext } from '../../contexts/ConfigContext';

interface ConfigButtonProps {
  text?: string;
  tooltip?: string;
  type?: 'primary' | 'default' | 'link' | 'text' | 'dashed';
  icon?: boolean;
  size?: 'small' | 'middle' | 'large';
  className?: string;
}

const ConfigButton: React.FC<ConfigButtonProps> = ({
  text = '',
  tooltip = '系统配置',
  type = 'default',
  icon = true,
  size = 'middle',
  className = '',
}) => {
  const { showConfigModal } = useConfigContext();

  const button = (
    <Button 
      // 取消边框
      style={{ border: 'none' }}
      type={type} 
      onClick={showConfigModal} 
      size={size}
      className={className}
      icon={icon ? <SettingOutlined /> : undefined}
    >
      {text}
    </Button>
  );

  if (tooltip) {
    return <Tooltip title={tooltip}>{button}</Tooltip>;
  }

  return button;
};

export default ConfigButton; 