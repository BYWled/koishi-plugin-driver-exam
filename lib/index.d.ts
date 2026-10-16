import { Context, Schema } from 'koishi';
export declare const name = "driver-exam";
export declare const inject: {
    required: string[];
    optional: string[];
};
export interface MonitoredTarget {
    guildId: string;
    userId: string;
}
export interface Config {
    appId: string;
    appSecret: string;
    currency: string;
    currencyPerHour: number;
    challengeBufferHours: number;
    challengeRewardRate: number;
    activeStartHour: number;
    activeEndHour: number;
    initialBufferHours: number;
    defaultRank: number;
    defaultSubjectType: number;
    allowedQuestionTypes: number[];
    questionsPerRound: number;
    passRate: number;
    exemptHoursPerPass: number;
    mutedPassExemptHours: number;
    questionTimeout: number;
    recallIntermediateMessages: boolean;
    weekStreakTarget: number;
    weekStreakRewardDays: number;
    enableDailyRewardLimit: boolean;
    dailyRewardLimitMode: 'auto' | 'custom';
    dailyRewardLimitCustom: number;
    monitoredList: MonitoredTarget[];
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
