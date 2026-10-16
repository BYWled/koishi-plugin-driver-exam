import { Context, Session } from 'koishi';
/**
 * 获取或创建用户状态记录
 */
export declare function getOrCreateUser(ctx: Context, guildId: string, userId: string, uid: number, initialBufferHours: number, activeStartHour: number, activeEndHour: number): Promise<import("./database").DriverExamUser>;
/**
 * 提取目标用户 ID
 */
export declare function extractTargetUserId(raw: string, session: Session): string | null;
/**
 * 获取用户平台对应的内部 uid
 */
export declare function resolveUid(ctx: Context, platform: string, pid: string): Promise<number>;
/**
 * 获取货币现金余额
 */
export declare function getCashBalance(ctx: Context, uid: number, currency: string): Promise<number>;
/**
 * 扣减货币
 */
export declare function costCash(ctx: Context, uid: number, amount: number, currency: string): Promise<boolean>;
/**
 * 发放货币
 */
export declare function gainCash(ctx: Context, uid: number, amount: number, currency: string): Promise<void>;
/**
 * 注册核心交互中间件与指令
 */
export declare function registerCommands(ctx: Context, config: any): void;
