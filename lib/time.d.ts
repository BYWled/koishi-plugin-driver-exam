/**
 * 跨日时间与有效惩罚时段计算器
 */
/**
 * 判断当前时刻是否在有效禁言时段内（默认 08:00 - 24:00）
 */
export declare function isActiveHour(date?: Date, startHour?: number, endHour?: number): boolean;
/**
 * 在基准时间上累加“有效禁言小时数”，自动跳过夜间免禁时段（如 00:00~08:00）
 * @param baseTime 基准时间
 * @param hoursToAdd 需要累加的小时数
 * @param startHour 每日开始禁言时间（默认 8）
 * @param endHour 每日结束禁言时间（默认 24）
 */
export declare function addActiveHours(baseTime: Date, hoursToAdd: number, startHour?: number, endHour?: number): Date;
/**
 * 计算距离今天有效时段结束（如 24:00）的剩余毫秒数
 */
export declare function getMsUntilEndOfActiveDay(from?: Date, endHour?: number): number;
/**
 * 获取自然周标识字符串（如 "2026-W42"）
 */
export declare function getNaturalWeekString(date?: Date): string;
/**
 * 格式化日期为 YYYY-MM-DD HH:mm:ss
 */
export declare function formatDateTime(date: Date | null | undefined): string;
/**
 * 格式化时间戳简写（如 "10-16 14:30"）
 */
export declare function formatShortTime(date: Date | null | undefined): string;
