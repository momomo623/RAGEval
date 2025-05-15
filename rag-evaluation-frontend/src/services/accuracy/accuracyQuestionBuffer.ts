/**
 * 精度测试问题缓冲区管理器模块
 *
 * 该模块提供了高效的问题数据加载和缓存管理功能，专门用于精度测试场景。
 * 通过分页加载和预加载机制，减少内存占用并提高测试执行效率。
 * 支持版本过滤和只加载有RAG结果的问题。
 *
 * @module accuracyQuestionBuffer
 * @author 模型评测团队
 * @version 1.0.0
 */

import { api } from '@utils/api';

/**
 * 精度测试问题缓冲区管理器类
 *
 * 该类负责从API加载问题数据，并提供高效的缓冲区管理，
 * 支持分页加载、预加载和并发访问，专为精度测试场景优化。
 * 支持版本过滤和只加载有RAG结果的问题。
 */
export class AccuracyQuestionBuffer {
  /** 数据集ID */
  private datasetId: string;

  /** 问题缓冲区 */
  questions: any[] = []; // 注意：这里改为public，以便外部访问

  /** 当前页码 */
  private currentPage: number = 1;

  /** 每页大小 */
  private pageSize: number = 50;

  /** 并发数 */
  private concurrency: number = 5;

  /** 缓冲区阈值，当问题数低于此值时触发加载 */
  private bufferThreshold: number = 10;

  /** 是否正在加载数据 */
  private loading: boolean = false;

  /** 是否还有更多数据可加载 */
  private hasMoreData: boolean = true;

  /** 版本过滤 */
  private version?: string;

  /** 已加载的总问题数 */
  private totalLoaded: number = 0;

  /** 是否只加载有RAG结果的问题 */
  private onlyWithRagResults: boolean = true;

  /** 当所有问题加载完成时的回调函数 */
  public onAllQuestionsLoaded?: (total: number) => void;

  /**
   * 创建精度测试问题缓冲区管理器实例
   *
   * @param {string} datasetId - 数据集ID，用于从API加载问题
   * @param {number} concurrency - 并发请求数，影响缓冲区大小和预加载策略
   * @param {Function} onAllQuestionsLoaded - 当所有问题加载完成时的回调函数
   * @param {string} [version] - 可选的版本过滤参数
   * @param {boolean} [onlyWithRagResults=true] - 是否只加载有RAG结果的问题
   */
  constructor(
    datasetId: string,
    concurrency: number,
    onAllQuestionsLoaded?: (total: number) => void,
    version?: string,
    onlyWithRagResults: boolean = true
  ) {
    this.datasetId = datasetId;
    this.concurrency = concurrency;
    this.onAllQuestionsLoaded = onAllQuestionsLoaded;
    this.version = version;
    this.onlyWithRagResults = onlyWithRagResults;
    // 每页至少加载并发数的2倍，确保有足够的问题可供处理
    this.pageSize = Math.max(50, concurrency * 2);
    // 缓冲区阈值设置为并发数的2倍
    this.bufferThreshold = concurrency * 2;
  }

  /**
   * 初始化方法，在开始加载问题前获取总数
   *
   * 该方法通过API请求获取数据集中的问题总数，但不加载具体问题内容。
   * 这样可以提前获知总问题数，用于进度计算和UI显示。
   *
   * @returns {Promise<number>} 数据集中的问题总数
   */
  public async initialize(): Promise<number> {
    if (!this.datasetId) {
      console.error('缺少数据集ID，无法初始化精度测试问题缓冲区');
      return 0;
    }

    try {
      // 构建请求参数
      const params: any = {
        page: 1,
        size: 1  // 只获取一条记录，减少数据传输
      };

      // 如果指定了版本，添加版本参数
      if (this.version) {
        params.version = this.version;
      }

      // 如果需要只加载有RAG结果的问题
      if (this.onlyWithRagResults) {
        params.has_rag_results = true;
      }

      console.log('精度测试问题API请求参数:', params);

      // 只请求第一页但设置pageSize=1，目的是只获取总数而不加载太多数据
      const response = await api.get(`/api/v1/datasets-questions/${this.datasetId}/questions`, {
        params
      });

      // 获取总问题数
      const totalCount = (response as any).total || 0;
      console.log(`精度测试初始化：获取到数据集总问题数: ${totalCount}`);

      // 通知总数
      if (this.onAllQuestionsLoaded && totalCount > 0) {
        this.onAllQuestionsLoaded(totalCount);
      }

      // 加载第一批问题
      await this.loadMoreQuestions();

      return totalCount;
    } catch (error) {
      console.error('精度测试初始化获取问题总数失败:', error);
      return 0;
    }
  }

  /**
   * 获取下一个可用的问题
   *
   * 从缓冲区中获取下一个问题，并在必要时触发加载更多问题的操作。
   * 这是获取单个问题的主要接口，用于顺序处理场景。
   *
   * @returns {any | null} 问题对象，如果没有可用问题则返回null
   */
  getNextQuestion(): any | null {
    // 检查缓冲区是否需要补充
    this.checkAndLoadMore();

    // 返回缓冲区中的下一个问题
    if (this.questions.length > 0) {
      return this.questions.shift();
    }
    return null;
  }

  /**
   * 检查并预加载更多问题
   *
   * 当缓冲区中的问题数量低于阈值时，自动触发加载更多问题的操作。
   * 这是一个内部方法，用于维持缓冲区中有足够的问题可用。
   */
  private checkAndLoadMore(): void {
    // 当缓冲区中的问题数量低于阈值(并发数的2倍)且尚未开始加载更多且仍有更多数据时
    if (this.questions.length < this.bufferThreshold && !this.loading && this.hasMoreData) {
      this.loadMoreQuestions();
    }
  }

  /**
   * 加载更多问题
   *
   * 从API加载下一页问题数据，并添加到缓冲区中。
   * 该方法处理分页逻辑、错误处理和进度通知。
   *
   * @returns {Promise<void>}
   */
  private async loadMoreQuestions(): Promise<void> {
    // 如果已经在加载或没有更多数据，则直接返回
    if (this.loading || !this.hasMoreData) return;

    this.loading = true;
    console.log(`精度测试正在加载更多问题，数据集ID: ${this.datasetId}, 当前页: ${this.currentPage}, 页大小: ${this.pageSize}`);

    try {
      // 检查datasetId是否存在
      if (!this.datasetId) {
        console.error('缺少数据集ID，无法加载精度测试问题');
        this.hasMoreData = false;
        return;
      }

      // 构建请求参数
      const params: any = {
        page: this.currentPage,
        size: this.pageSize
      };

      // 如果指定了版本，添加版本参数
      if (this.version) {
        params.version = this.version;
      }

      // 如果需要只加载有RAG结果的问题
      if (this.onlyWithRagResults) {
        params.has_rag_results = true;
      }

      console.log('精度测试加载更多问题API请求参数:', params);

      // 调整API路径，确保使用正确的端点格式
      const response = await api.get(`/api/v1/datasets-questions/${this.datasetId}/questions`, {
        params
      });

      // 添加详细日志，检查响应格式
      console.log('精度测试问题API响应:', response);

      // 提取问题数据
      let newQuestions = [];
      if (response && (response as any).items) {
        // 根据响应结构提取问题列表
        newQuestions = (response as any).items;
      }

      // 如果响应中包含total字段，更新real_total
      if (response && (response as any).total !== undefined) {
        // 通知执行器更新实际问题总数
        if (this.onAllQuestionsLoaded) {
          this.onAllQuestionsLoaded((response as any).total);
        }
      }

      console.log(`精度测试获取到 ${newQuestions.length} 个新问题, 样例:`, newQuestions[0]);

      // 添加到缓冲区
      this.questions.push(...newQuestions);
      this.totalLoaded += newQuestions.length;
      console.log(`精度测试缓冲区中的问题数: ${this.questions.length}, 总加载数: ${this.totalLoaded}`);

      // 检查是否还有更多数据
      if (response && (response as any).total !== undefined && (response as any).pages !== undefined) {
        // 使用API返回的总数和页数信息进行精确判断
        this.hasMoreData = this.totalLoaded < (response as any).total && this.currentPage <= (response as any).pages;

        // 如果已是最后一页，设置总数
        if (this.currentPage > (response as any).pages && this.onAllQuestionsLoaded) {
          console.log(`精度测试已加载所有问题，总数: ${(response as any).total}`);
          this.onAllQuestionsLoaded((response as any).total);
        }
      } else {
        // 退回到原来的判断逻辑，作为备选
        this.hasMoreData = newQuestions.length >= this.pageSize;

        if (newQuestions.length < this.pageSize && this.onAllQuestionsLoaded) {
          console.log(`精度测试已加载所有问题，总数: ${this.totalLoaded}`);
          this.onAllQuestionsLoaded(this.totalLoaded);
        }
      }

      // 更新页码，为下一次加载做准备
      this.currentPage++;
    } catch (error) {
      console.error('精度测试加载问题失败:', error);
    } finally {
      // 无论成功失败，都重置loading状态
      this.loading = false;
    }
  }

  /**
   * 获取缓冲区中剩余的问题数量
   *
   * 返回当前缓冲区中可用的问题数量，用于状态检查和进度计算。
   *
   * @returns {number} 缓冲区中的问题数量
   */
  getRemainingCount(): number {
    return this.questions.length;
  }

  /**
   * 是否还有更多数据可加载
   *
   * 检查是否还有更多问题可以从API加载，用于判断是否到达数据集末尾。
   *
   * @returns {boolean} 如果还有更多数据可加载则返回true，否则返回false
   */
  hasMore(): boolean {
    return this.hasMoreData;
  }

  /**
   * 重置缓冲区
   *
   * 清空缓冲区并重置所有状态，用于重新开始加载或取消当前操作。
   */
  reset(): void {
    this.questions = [];
    this.currentPage = 1;
    this.hasMoreData = true;
    this.loading = false;
    this.totalLoaded = 0;
  }

  /**
   * 获取已加载的总问题数
   *
   * @returns {number} 已加载的总问题数
   */
  getTotalLoaded(): number {
    return this.totalLoaded;
  }

  /**
   * 获取并发数
   *
   * @returns {number} 并发数
   */
  getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * 添加问题到缓冲区
   *
   * @param {any} question - 要添加的问题
   */
  addQuestion(question: any): void {
    this.questions.push(question);
  }

  /**
   * 手动加载更多问题
   *
   * 公开的方法，用于手动触发加载更多问题的操作。
   *
   * @returns {Promise<void>}
   */
  public async manualLoadMoreQuestions(): Promise<void> {
    return this.loadMoreQuestions();
  }
}
