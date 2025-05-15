/**
 * 问题缓冲区管理器模块
 *
 * 该模块提供了高效的问题数据加载和缓存管理功能，用于性能测试场景。
 * 通过分页加载和预加载机制，减少内存占用并提高测试执行效率。
 *
 * @module questionBufferManager
 * @author 模型评测团队
 * @version 1.0.0
 */

import { api } from '../utils/api';

/**
 * 问题缓冲区管理器类
 *
 * 用于高效地从数据集加载问题，并提供缓冲功能。
 * 支持分页加载、预加载和自动补充缓冲区等功能，
 * 确保在性能测试过程中始终有足够的问题可用。
 */
export class PerformanceQuestionBuffer {
  /** 缓冲区中的问题列表 */
  private questions: any[] = [];

  /** 是否正在加载数据的标志 */
  private loading: boolean = false;

  /** 当前加载的页码 */
  private currentPage: number = 1;

  /** 每页加载的问题数量 */
  private pageSize: number = 100;

  /** 数据集ID */
  private datasetId: string;

  /** 并发请求数 */
  private concurrency: number;

  /** 缓冲区大小倍数（相对于并发数） */
  private bufferMultiplier: number = 5;

  /** 是否还有更多数据可加载 */
  private hasMoreData: boolean = true;

  /**
   * 缓冲区阈值计算属性
   *
   * 当缓冲区中的问题数量低于此阈值时，会触发加载更多问题的操作。
   * 默认为并发数的2倍，确保有足够的问题可供并发处理。
   *
   * @returns {number} 缓冲区阈值
   */
  private get bufferThreshold(): number {
    return this.concurrency * 2;
  }

  /**
   * 当所有问题加载完成时的回调函数
   * 用于通知外部组件更新总问题数和进度信息
   */
  public onAllQuestionsLoaded?: (total: number) => void;

  /**
   * 创建问题缓冲区管理器实例
   *
   * @param {string} datasetId - 数据集ID，用于从API加载问题
   * @param {number} concurrency - 并发请求数，影响缓冲区大小和预加载策略
   * @param {Function} onAllQuestionsLoaded - 当所有问题加载完成时的回调函数
   */
  constructor(
    datasetId: string,
    concurrency: number,
    onAllQuestionsLoaded?: (total: number) => void,
    version?: string
  ) {
    this.datasetId = datasetId;
    this.concurrency = concurrency;
    this.onAllQuestionsLoaded = onAllQuestionsLoaded;
    // 每页至少加载并发数的2倍，确保有足够的问题可供处理
    this.pageSize = Math.max(50, concurrency * 2);
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
      console.error('缺少数据集ID，无法初始化');
      return 0;
    }

    try {
      // 只请求第一页但设置pageSize=1，目的是只获取总数而不加载太多数据
      const response = await api.get(`/api/v1/datasets-questions/${this.datasetId}/questions`, {
        params: {
          page: 1,
          size: 1  // 只获取一条记录，减少数据传输
        }
      });

      // 获取总问题数
      const totalCount = (response as any).total || 0;
      console.log(`初始化：获取到数据集总问题数: ${totalCount}`);

      // 通知总数
      if (this.onAllQuestionsLoaded && totalCount > 0) {
        this.onAllQuestionsLoaded(totalCount);
      }

      return totalCount;
    } catch (error) {
      console.error('初始化获取问题总数失败:', error);
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
    console.log(`正在加载更多问题，数据集ID: ${this.datasetId}, 当前页: ${this.currentPage}, 页大小: ${this.pageSize}`);

    try {
      // 检查datasetId是否存在
      if (!this.datasetId) {
        console.error('缺少数据集ID，无法加载问题');
        this.hasMoreData = false;
        return;
      }

      // 调整API路径，确保使用正确的端点格式
      const response = await api.get(`/api/v1/datasets-questions/${this.datasetId}/questions`, {
        params: {
          page: this.currentPage,
          size: this.pageSize
        }
      });

      // 添加详细日志，检查响应格式
      console.log('问题API响应:', response);

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

      console.log(`获取到 ${newQuestions.length} 个新问题, 样例:`, newQuestions[0]);

      // 添加到缓冲区
      this.questions.push(...newQuestions);
      console.log(`缓冲区中的问题数: ${this.questions.length}`);

      // 检查是否还有更多数据
      this.hasMoreData = newQuestions.length >= this.pageSize;

      // 如果没有获取到问题，尝试替代API路径
      // if (newQuestions.length === 0) {
      //   console.warn('API未返回任何问题，可能是API路径错误或数据集为空');
      //   this.tryAlternativeAPI();
      // }

      // 更新页码，为下一次加载做准备
      this.currentPage++;

      // 如果已加载所有数据，通知调用者
      if (!this.hasMoreData && this.onAllQuestionsLoaded) {
        const totalQuestions = (response as any).total || this.questions.length;
        console.log(`已加载所有问题，总数: ${totalQuestions}`);
        this.onAllQuestionsLoaded(totalQuestions);
      }
    } catch (error) {
      console.error('加载问题失败:', error);
    } finally {
      // 无论成功失败，都重置loading状态
      this.loading = false;
    }
  }

  // /**
  //  * 尝试替代API路径
  //  *
  //  * 当主API路径无法获取问题时，尝试使用替代路径。
  //  * 这是一个容错机制，用于处理不同API格式的情况。
  //  *
  //  * @returns {Promise<void>}
  //  */
  // private async tryAlternativeAPI(): Promise<void> {
  //   try {
  //     console.log('尝试替代API路径...');

  //     // 尝试其他可能的路径格式
  //     const path = `/v1/datasets-questions/${this.datasetId}/questions`;

  //     try {
  //       console.log(`尝试API路径: ${path}`);
  //       const altResponse = await api.get(path, {
  //         params: { page: 1, page_size: this.pageSize }
  //       });

  //       // 检查不同格式的响应是否包含有效数据
  //       if ((altResponse as any)?.data?.items?.length > 0 ||
  //           Array.isArray((altResponse as any)?.data) && (altResponse as any).data.length > 0 ||
  //           (altResponse as any)?.data?.questions?.length > 0) {

  //         console.log(`找到有效的API路径: ${path}`);
  //         return; // 成功找到有效路径
  //       }
  //     } catch (e) {
  //       console.log(`路径 ${path} 无效`);
  //     }

  //     console.error('无法找到有效的问题API路径');
  //   } catch (error) {
  //     console.error('替代API尝试失败:', error);
  //   }
  // }

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
  }

  /**
   * 获取指定数量的问题
   *
   * 批量获取问题，用于并发处理场景。
   * 如果缓冲区中的问题不足，会尝试加载更多问题。
   *
   * @param {number} count - 需要获取的问题数量
   * @returns {Promise<any[]>} 问题数组
   */
  public async getNextQuestions(count: number): Promise<any[]> {
    // 确保缓冲区中有足够的问题
    if (this.questions.length < count && this.hasMoreData && !this.loading) {
      await this.loadMoreQuestions();
    }

    // 获取并从缓冲区中移除问题
    const result = this.questions.splice(0, count);

    // 如果缓冲区变得太小，异步加载更多
    if (this.questions.length < this.bufferThreshold && this.hasMoreData && !this.loading) {
      this.loadMoreQuestions().catch(error => {
        console.error('缓冲区问题加载失败:', error);
      });
    }

    return result;
  }

  /**
   * 手动添加问题到缓冲区
   *
   * 用于直接添加预加载的问题，而不是从API加载
   *
   * @param {any} question - 要添加的问题对象
   */
  public addQuestion(question: any): void {
    if (question) {
      this.questions.push(question);
    }
  }

  /**
   * 手动加载更多问题
   *
   * 强制执行一次问题加载，用于错误恢复场景
   *
   * @returns {Promise<void>}
   */
  public async manualLoadMoreQuestions(): Promise<void> {
    return this.loadMoreQuestions();
  }
}
