import { Context } from 'koishi';
import { DriverExamQuestion } from './database';
/**
 * 获取考题列表
 */
export declare function fetchQuestionsApi(appId: string, appSecret: string, options?: {
    page?: number;
    rank?: number;
    subjectType?: number;
    questionType?: number;
}): Promise<any>;
/**
 * 批量获取考题答案与解析
 */
export declare function fetchAnswersApi(appId: string, appSecret: string, ids: string[]): Promise<any>;
/**
 * 批量同步题目与答案入库（充实本地题库缓存池）
 */
export declare function syncQuestionsBatch(ctx: Context, appId: string, appSecret: string, options?: {
    page?: number;
    rank?: number;
    subjectType?: number;
    questionType?: number;
}): Promise<number>;
/**
 * 获取随机考题，优先使用该用户未做过的题目，并支持指定车型(rank)、科目(subjectType)与题型(allowedTypes)
 */
export declare function getExamQuestions(ctx: Context, appId: string, appSecret: string, userId: string, count?: number, rank?: number, subjectType?: number, allowedTypes?: number[], excludeQuestionIds?: string[]): Promise<DriverExamQuestion[]>;
