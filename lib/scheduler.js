import { Logger } from 'koishi';
import { isActiveHour, getMsUntilEndOfActiveDay, addActiveHours, getNaturalWeekString, } from './time';
const logger = new Logger('driver-exam:scheduler');
export function applyScheduler(ctx, config) {
    // 每分钟执行一次健康轮询检查
    ctx.setInterval(async () => {
        try {
            await runSchedulerCheck(ctx, config);
        }
        catch (err) {
            logger.error('调度器巡检异常:', err);
        }
    }, 60 * 1000);
}
/**
 * 核心调度巡检逻辑
 */
export async function runSchedulerCheck(ctx, config) {
    const now = new Date();
    const isDaytime = isActiveHour(now, config.activeStartHour, config.activeEndHour);
    const currentWeek = getNaturalWeekString(now);
    const todayStr = now.toISOString().slice(0, 10);
    // 1. 周重置与日重置
    const allUsers = await ctx.database.get('driver_exam_user', {});
    for (const user of allUsers) {
        let needUpdate = false;
        const patch = {};
        if (user.lastStreakWeek !== currentWeek) {
            patch.weekStreak = 0;
            patch.lastStreakWeek = currentWeek;
            needUpdate = true;
        }
        if (user.lastPassDate !== todayStr) {
            patch.dailyPassCount = 0;
            patch.lastPassDate = todayStr;
            needUpdate = true;
        }
        if (needUpdate) {
            await ctx.database.set('driver_exam_user', { id: user.id }, patch);
        }
    }
    // 2. 挑战状态检查 (pending -> active)
    const pendingChallenges = await ctx.database.get('driver_exam_challenge', {
        status: 'pending',
    });
    for (const ch of pendingChallenges) {
        if (now >= new Date(ch.bufferDeadline)) {
            if (ch.passedRounds >= ch.requiredRounds) {
                // 缓冲期内已达标，化解挑战
                await ctx.database.set('driver_exam_challenge', { id: ch.id }, {
                    status: 'success',
                });
            }
            else {
                // 缓冲期超时，正式生效进入惩罚
                const banDeadline = addActiveHours(now, ch.banHours, config.activeStartHour, config.activeEndHour);
                await ctx.database.set('driver_exam_challenge', { id: ch.id }, {
                    status: 'active',
                    banDeadline,
                });
                logger.info(`挑战 [${ch.id}] 缓冲期已过，被挑战人 ${ch.targetUserId} 进入禁言生效期，截止 ${banDeadline.toLocaleString()}`);
            }
        }
    }
    // 3. 检查活跃中的挑战是否已超时结束 (active -> failed)
    const activeChallenges = await ctx.database.get('driver_exam_challenge', {
        status: 'active',
    });
    for (const ch of activeChallenges) {
        if (now >= new Date(ch.banDeadline)) {
            await ctx.database.set('driver_exam_challenge', { id: ch.id }, {
                status: 'failed',
            });
            logger.info(`挑战 [${ch.id}] 禁言惩罚期结束`);
        }
    }
    // 4. 禁言状态统一生命周期调谐
    // 查找所有关联 Bot
    const bots = ctx.bots;
    for (const user of allUsers) {
        // 寻找支持禁言操作的可用 bot
        const bot = bots.find((b) => typeof b.muteGuildMember === 'function') || bots[0];
        if (!bot)
            continue;
        // 检查此用户是否受 active 挑战惩罚
        const hasActiveChallenge = activeChallenges.some((c) => c.guildId === user.guildId && c.targetUserId === user.userId && now < new Date(c.banDeadline));
        // 检查名单惩罚（在名单中且已过豁免时间）
        const isExemptExpired = user.inList && now >= new Date(user.exemptUntil);
        // 综合判定该用户当前理论上是否应该被禁言
        const shouldBeMuted = (isExemptExpired || hasActiveChallenge);
        if (!isDaytime) {
            // ===== 夜间时段 (00:00 ~ 08:00)：全员不禁言 =====
            if (user.isMuted) {
                try {
                    await bot.muteGuildMember(user.guildId, user.userId, 0);
                    logger.info(`[夜间解禁] 已为用户 ${user.userId} (群 ${user.guildId}) 解除夜间禁言`);
                }
                catch (err) {
                    logger.warn(`夜间解除禁言失败: ${user.userId}`, err);
                }
                await ctx.database.set('driver_exam_user', { id: user.id }, { isMuted: false });
            }
        }
        else {
            // ===== 白天有效惩罚时段 (08:00 ~ 24:00) =====
            if (shouldBeMuted && !user.isMuted) {
                // 应该禁言但未禁言 -> 施加禁言至今天有效时段结束 (24:00)
                const remainMs = getMsUntilEndOfActiveDay(now, config.activeEndHour);
                if (remainMs > 0) {
                    try {
                        await bot.muteGuildMember(user.guildId, user.userId, remainMs);
                        logger.info(`[施加禁言] 已为用户 ${user.userId} (群 ${user.guildId}) 施加禁言 ${Math.round(remainMs / 1000)} 秒`);
                    }
                    catch (err) {
                        logger.warn(`施加禁言失败: ${user.userId}`, err);
                    }
                    await ctx.database.set('driver_exam_user', { id: user.id }, { isMuted: true });
                }
            }
            else if (!shouldBeMuted && user.isMuted) {
                // 不应该禁言但当前处于禁言 -> 解禁
                try {
                    await bot.muteGuildMember(user.guildId, user.userId, 0);
                    logger.info(`[恢复发言] 已为用户 ${user.userId} (群 ${user.guildId}) 解除禁言`);
                }
                catch (err) {
                    logger.warn(`解除禁言失败: ${user.userId}`, err);
                }
                await ctx.database.set('driver_exam_user', { id: user.id }, { isMuted: false });
            }
        }
    }
}
