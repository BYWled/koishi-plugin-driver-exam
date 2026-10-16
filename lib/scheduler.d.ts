import { Context } from 'koishi';
export declare function applyScheduler(ctx: Context, config: any): void;
/**
 * 核心调度巡检逻辑
 */
export declare function runSchedulerCheck(ctx: Context, config: any): Promise<void>;
