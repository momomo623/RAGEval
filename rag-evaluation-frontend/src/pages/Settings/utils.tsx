import React from 'react';
import { Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

export const labelWithTip = (label: string, tip: string) => (
  <span>
    {label}
    <Tooltip title={tip}>
      <QuestionCircleOutlined style={{ marginLeft: 4, color: '#888' }} />
    </Tooltip>
  </span>
); 