# RAG服务使用说明

本文档介绍了RAG（检索增强生成）服务的使用方法，包括新的统一接口和性能测试执行器。

## 文件结构

- `ragRequestService.ts` - 统一的RAG请求服务，提供流式请求接口
- `questionBufferManager.ts` - 问题缓冲区管理器，用于高效加载和管理问题
- `performanceExecutorNew.ts` - 新的性能测试执行器，使用上述两个服务

## 使用方法

### 1. 导入服务

```typescript
// 导入RAG请求服务
import { ragRequestService } from '../services/ragRequestService';

// 导入性能测试执行器
import { executePerformanceTest, TestProgress } from '../services/performanceExecutorNew';

// 导入问题缓冲区管理器
import { QuestionBufferManager } from '../services/questionBufferManager';
```

### 2. 发送RAG请求

```typescript
// 使用流式接口
async function streamExample() {
  const question = "这是一个测试问题";
  const configKey = "dify_flow/我的配置";  // 格式为 "type/name"

  // 方式1: 使用for await循环
  for await (const chunk of ragRequestService.streamRequest(configKey, question)) {
    console.log("收到回答片段:", chunk);
    // 处理每个回答片段
  }

  // 方式2: 收集完整回答
  let fullAnswer = '';
  for await (const chunk of ragRequestService.streamRequest(configKey, question)) {
    fullAnswer += chunk;
  }
  console.log("完整回答:", fullAnswer);
}
```

### 3. 测试RAG配置

```typescript
async function testConfig() {
  const configKey = "custom/我的自定义RAG";

  try {
    const result = await ragRequestService.testRAGConfig(configKey);
    if (result.success) {
      console.log("测试成功:", result.content);
    } else {
      console.error("测试失败:", result.error);
    }
  } catch (error) {
    console.error("测试异常:", error);
  }
}
```

### 4. 执行性能测试

```typescript
import { executePerformanceTest, TestProgress } from '../services/ragService';

async function runPerformanceTest() {
  const test = {
    id: "test-123",
    dataset_id: "dataset-456",
    concurrency: 3,
    // 其他测试配置...
  };

  // 进度回调函数
  const progressCallback = (progress: TestProgress) => {
    console.log(`进度: ${progress.completed}/${progress.total}, 成功: ${progress.success}, 失败: ${progress.failed}`);
    // 更新UI显示进度
  };

  // 执行测试
  const success = await executePerformanceTest(
    test,
    [],  // 空数组表示从数据集动态加载问题
    progressCallback
  );

  if (success) {
    console.log("测试执行成功");
  } else {
    console.error("测试执行失败");
  }
}
```

## 支持的RAG系统类型

1. **ragflow_chat** - RAGFlow聊天系统
   - 需要配置: address, chatId, apiKey

2. **dify_chatflow** - Dify聊天流系统
   - 需要配置: url, apiKey

3. **dify_flow** - Dify工作流系统
   - 需要配置: url, apiKey, inputs(可选)

4. **custom** - 自定义RAG系统
   - 需要配置: url, requestHeaders, requestTemplate, responsePath, streamEventField(可选), streamEventValue(可选)

## 注意事项

1. 所有RAG请求都使用流式接口，提供更好的用户体验
2. 配置键格式为 "type/name"，用于从配置管理器中查找配置
3. 性能测试支持两种模式：预加载问题列表或从数据集动态加载问题
4. 问题缓冲区管理器自动处理分页加载和缓存，提高性能测试效率

## 迁移指南

如果您正在使用旧的`performanceExecutor.ts`和`rag-request.ts`，请按照以下步骤迁移到新的服务：

1. 将导入从旧文件更改为新的服务文件：
   ```typescript
   // 旧的导入
   import { executePerformanceTest, TestProgress } from '../services/performanceExecutor';
   import { streamRAGResponse } from '../pages/Settings/RAGTemplates/rag-request';

   // 新的导入
   import { executePerformanceTest, TestProgress } from '../services/performanceExecutorNew';
   import { ragRequestService } from '../services/ragRequestService';
   ```

2. 将`streamRAGResponse`调用替换为`ragRequestService.streamRequest`：
   ```typescript
   // 旧的调用
   for await (const chunk of streamRAGResponse(ragConfig, question)) {
     // 处理chunk
   }

   // 新的调用
   for await (const chunk of ragRequestService.streamRequest(`${ragConfig.type}/${ragConfig.name}`, question)) {
     // 处理chunk
   }
   ```

3. 使用新的测试函数：
   ```typescript
   // 旧的调用
   const result = await testRAGConfig(config, "测试问题", config.type);

   // 新的调用
   const result = await ragRequestService.testRAGConfig(`${config.type}/${config.name}`);
   ```
