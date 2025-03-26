import { DockerOutlined } from '@ant-design/icons';
import { message } from 'antd';

// 配置类型
export interface RAGRequestConfig {
  url: string;
  headers: Record<string, string>;
  requestTemplate: any;
  responsePath: string;
  isStream?: boolean;
  streamEventField?: string;
  streamEventValue?: string;
}

// 执行结果类型
export interface RAGResponse {
  success: boolean;
  content: string;
  firstResponseTime: number;
  totalResponseTime: number;
  characterCount: number;
  charactersPerSecond: number;
  retrievedDocs?: any[];
  error?: any;
}

/**
 * 从嵌套对象提取值
 */
const extractFromPath = (obj: any, path: string): any => {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  
  return current;
};

/**
 * 执行RAG请求并处理响应
 * @param question 用户问题
 * @param config RAG请求配置
 * @param onProgress 流式响应进度回调
 * @returns 请求结果
 */
export const executeRAGRequest = async (
  question: string,
  config: RAGRequestConfig,
  onProgress?: (chunk: string) => void
): Promise<RAGResponse> => {
  const startTime = performance.now();
  let firstChunkTime = 0;
  let fullContent = '';
  
  try {
    // 替换请求模板中的问题
    let requestBody = JSON.parse(JSON.stringify(config.requestTemplate));
    // 递归替换问题占位符
    const replaceInObj = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace(/{{question}}/g, question);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          replaceInObj(obj[key]);
        }
      }
    };
    replaceInObj(requestBody);
    
    // 标准响应处理
    if (!config.isStream) {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }
      
      const responseData = await response.json();
      const content = extractFromPath(responseData, config.responsePath) || '';
      const endTime = performance.now();
      firstChunkTime = endTime - startTime; // 非流式响应，首次响应时间等于总时间
      
      return {
        success: true,
        content,
        firstResponseTime: (endTime - startTime) / 1000,
        totalResponseTime: (endTime - startTime) / 1000,
        characterCount: content.length,
        charactersPerSecond: content.length / ((endTime - startTime) / 1000),
      };
    } 
    // 流式响应处理
    else {
      return new Promise<RAGResponse>(async (resolve, reject) => {
        let content = '';
        let hasReceivedFirstChunk = false;
        let buffer = '';
        const decoder = new TextDecoder();
        
        fetch(config.url, {
          method: 'POST',
          headers: config.headers,
          body: JSON.stringify(requestBody)
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
          }
          
          if (!response.body) {
            throw new Error('响应不包含可读流');
          }
          
          const reader = response.body.getReader();
          
          // 处理流
          const processStream = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  break;
                }
                // 解码二进制数据
                buffer += decoder.decode(value, { stream: true });
                
                // 按行分割并处理
                let lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留可能不完整的最后一行
                
                for (const line of lines) {
                  if (line.trim() === '' || !line.startsWith('data: ')) continue;
                  
                  try {
                    // 提取JSON部分，去掉"data: "前缀
                    const jsonStr = line.substring(6);
                    const eventData = JSON.parse(jsonStr);
                    // 检查是否匹配指定事件类型
                    if (eventData[config.streamEventField || '']  ===  config.streamEventValue) {
                      
                      // 使用responsePath从流事件中提取内容块
                      const chunkText = extractFromPath(eventData, config.responsePath || '') || '';
                      
                      if (chunkText) {
                        if (!hasReceivedFirstChunk) {
                          firstChunkTime = performance.now() - startTime;
                          hasReceivedFirstChunk = true;
                        }
                        
                        content += chunkText;
                        
                        // 调用进度回调
                        if (onProgress) {
                          onProgress(chunkText);
                        }
                      }
                    }
                  } catch (error) {
                    console.warn('解析流式响应数据失败:', line, error);
                  }
                }
              }
              
              // 处理剩余buffer中的内容
              if (buffer.trim() && buffer.startsWith('data: ')) {
                try {
                  const jsonStr = buffer.substring(6);
                  const eventData = JSON.parse(jsonStr);
                  
                  if (extractFromPath(eventData, config.streamEventField || '') === 
                      config.streamEventValue) {
                    
                    const chunkText = extractFromPath(eventData, config.responsePath || '') || '';
                    
                    if (chunkText) {
                      content += chunkText;
                      if (onProgress) onProgress(chunkText);
                    }
                  }
                } catch (error) {
                  // 忽略不完整数据的解析错误
                }
              }
              
              // 处理完成，返回结果
              const endTime = performance.now();
              resolve({
                success: true,
                content,
                firstResponseTime: hasReceivedFirstChunk ? firstChunkTime / 1000 : (endTime - startTime) / 1000,
                totalResponseTime: (endTime - startTime) / 1000,
                characterCount: content.length,
                charactersPerSecond: content.length / ((endTime - startTime) / 1000),
              });
            } catch (processError) {
              reject(processError);
            }
          };
          
          processStream();
        })
        .catch(error => {
          console.error('流式请求失败:', error);
          reject(error);
        });
      });
    }
  } catch (error) {
    console.error('RAG请求执行失败:', error);
    return {
      success: false,
      content: '',
      firstResponseTime: 0,
      totalResponseTime: (performance.now() - startTime) / 1000,
      characterCount: 0,
      charactersPerSecond: 0,
      error
    };
  }
}; 