import React from 'react';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

// 设置dayjs插件和语言
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface TimeAgoProps {
  date: string | Date;
  tooltipFormat?: string;
}

export const TimeAgo: React.FC<TimeAgoProps> = ({ 
  date, 
  tooltipFormat = 'YYYY-MM-DD HH:mm:ss' 
}) => {
  if (!date) return null;
  
  const dateObj = dayjs(date);
  const relativeTimeStr = dateObj.fromNow();
  
  return (
    <Tooltip title={dateObj.format(tooltipFormat)}>
      <span>{relativeTimeStr}</span>
    </Tooltip>
  );
}; 