import { Context } from 'koishi';
import { DriverExamQuestion } from './database';
export interface ExamAnswerRecord {
    question: DriverExamQuestion;
    userAnswer: string;
    isCorrect: boolean;
    isTimeout?: boolean;
}
export interface ExamSession {
    key: string;
    ctx: Context;
    guildId: string;
    userId: string;
    uid: number;
    channelId: string;
    isPrivate: boolean;
    bot: any;
    questions: DriverExamQuestion[];
    currentIndex: number;
    answers: ExamAnswerRecord[];
    timer: NodeJS.Timeout | null;
    timeoutSeconds: number;
    passRate: number;
    sendRetryCount: number;
    replaceQuestionOnSendFailure: boolean;
    fetchMoreQuestions?: (excludeIds?: string[]) => Promise<DriverExamQuestion | null>;
    recallMessages: boolean;
    messageIdsToRecall: string[];
    onFinish: (session: ExamSession, passed: boolean) => Promise<void>;
}
export declare const activeSessions: Map<string, ExamSession>;
/**
 * 提前结束退出答题的指令/关键词
 */
export declare const EXIT_KEYWORDS: string[];
/**
 * 严格判断用户输入是否为合法的答题格式（防止正常聊天被误判为作答）
 */
export declare function isValidAnswerFormat(question: DriverExamQuestion, input: string): boolean;
/**
 * 校验并比对用户答案对错
 */
export declare function checkUserAnswer(question: DriverExamQuestion, input: string): boolean;
/**
 * 尝试撤回暂存的答题过程消息（静默容错）
 */
export declare function recallSessionMessages(session: ExamSession): Promise<void>;
/**
 * 将题目图片安全拉取并尽可能转换为标准 PNG base64 数据，避免 OneBot 协议端远程拉取 webp 失败 (1200)
 */
export declare function resolveQuestionImage(ctx: Context, url: string): Promise<string | null>;
/**
 * 发送当前题目并启动倒计时（支持重试与图片发送失败降级/换题/跳过）
 */
export declare function sendCurrentQuestion(session: ExamSession): Promise<void>;
/**
 * 用户输入答案时的处理
 */
export declare function handleUserAnswer(session: ExamSession, input: string, messageId?: string): Promise<boolean>;
/**
 * 用户主动提前结束答题
 */
export declare function abortSession(session: ExamSession): Promise<void>;
/**
 * 格式化考题的标准答案以便于人类阅读
 */
export declare function formatQuestionAnswer(q: DriverExamQuestion): string;
/**
 * 结束本轮答题并汇总错题解析
 */
export declare function finishSession(session: ExamSession): Promise<void>;
