import { h, Logger } from 'koishi';
import { activeSessions, sendCurrentQuestion, handleUserAnswer, } from './session';
import { getExamQuestions, syncQuestionsBatch } from './api';
import { addActiveHours, formatDateTime, getNaturalWeekString, } from './time';
const logger = new Logger('driver-exam:commands');
/**
 * 获取或创建用户状态记录
 */
export async function getOrCreateUser(ctx, guildId, userId, uid, initialBufferHours, activeStartHour, activeEndHour) {
    let [record] = await ctx.database.get('driver_exam_user', { guildId, userId });
    if (!record) {
        const now = new Date();
        const exemptUntil = addActiveHours(now, initialBufferHours, activeStartHour, activeEndHour);
        record = await ctx.database.create('driver_exam_user', {
            guildId,
            userId,
            uid,
            inList: false,
            exemptUntil,
            isMuted: false,
            weekStreak: 0,
            lastStreakWeek: getNaturalWeekString(now),
            dailyPassCount: 0,
            lastPassDate: now.toISOString().slice(0, 10),
        });
    }
    return record;
}
/**
 * 提取目标用户 ID
 */
export function extractTargetUserId(raw, session) {
    const at = h.select(session.elements, 'at')[0];
    if (at?.attrs?.id)
        return String(at.attrs.id);
    if (!raw)
        return null;
    const m = raw.match(/id="?(\w+)"?/);
    if (m)
        return m[1];
    const clean = raw.replace(/[^0-9a-zA-Z_]/g, '');
    return clean || null;
}
/**
 * 获取用户平台对应的内部 uid
 */
export async function resolveUid(ctx, platform, pid) {
    try {
        const [binding] = await ctx.database.get('binding', { platform, pid });
        if (binding?.aid)
            return binding.aid;
        const user = await ctx.database.getUser(platform, pid, ['id']);
        return user?.id || 0;
    }
    catch {
        return 0;
    }
}
/**
 * 获取货币现金余额
 */
export async function getCashBalance(ctx, uid, currency) {
    if (!uid)
        return 0;
    const records = await ctx.database.get('monetary', { uid, currency });
    return records && records.length > 0 ? Number(records[0].value || 0) : 0;
}
/**
 * 扣减货币
 */
export async function costCash(ctx, uid, amount, currency) {
    if (ctx.monetary) {
        try {
            await ctx.monetary.cost(uid, amount, currency);
            return true;
        }
        catch {
            return false;
        }
    }
    const cur = await getCashBalance(ctx, uid, currency);
    if (cur < amount)
        return false;
    await ctx.database.set('monetary', { uid, currency }, { value: cur - amount });
    return true;
}
/**
 * 发放货币
 */
export async function gainCash(ctx, uid, amount, currency) {
    if (amount <= 0)
        return;
    if (ctx.monetary) {
        await ctx.monetary.gain(uid, amount, currency);
        return;
    }
    const cur = await getCashBalance(ctx, uid, currency);
    await ctx.database.set('monetary', { uid, currency }, { value: cur + amount });
}
/**
 * 注册核心交互中间件与指令
 */
export function registerCommands(ctx, config) {
    // 1. 中间件：优先拦截进行中的答题会话消息
    ctx.middleware(async (session, next) => {
        const isPrivate = !session.guildId;
        const key = isPrivate ? `private:${session.userId}` : `${session.guildId}:${session.userId}`;
        const exam = activeSessions.get(key);
        if (!exam)
            return next();
        // 群聊场景下严格校验频道一致
        if (!isPrivate && session.channelId !== exam.channelId)
            return next();
        const text = session.content?.trim();
        if (!text)
            return next();
        // 拦截并作答
        await handleUserAnswer(exam, text);
    }, true);
    // 2. 答题指令：开启一轮答题
    ctx
        .command('驾考答题', '开启一轮驾考题目测评（10题）')
        .alias('考驾照')
        .userFields(['id'])
        .action(async ({ session }) => {
        const isPrivate = !session.guildId;
        const userId = session.userId;
        const uid = Number(session.user?.id) || 0;
        // 判断目标生效群
        let guildId = session.guildId || '';
        if (isPrivate) {
            // 如果是私信作答，寻找用户被加入名单或被禁言的群
            const records = await ctx.database.get('driver_exam_user', { userId });
            if (records.length === 0) {
                guildId = 'private';
            }
            else {
                // 优先选取已被禁言的群，或者有挑战的群
                const mutedRecord = records.find((r) => r.isMuted);
                guildId = mutedRecord ? mutedRecord.guildId : records[0].guildId;
            }
        }
        const key = isPrivate ? `private:${userId}` : `${guildId}:${userId}`;
        if (activeSessions.has(key)) {
            return '⚠️ 你当前已有正在进行的驾考测评，请继续作答！';
        }
        // 获取考题
        const questions = await getExamQuestions(ctx, config.appId, config.appSecret, config.questionsPerRound);
        if (questions.length === 0) {
            return '❌ 题库暂时为空，正在尝试同步中，请稍后再试。';
        }
        // 创建会话
        const examSession = {
            key,
            guildId,
            userId,
            uid,
            channelId: session.channelId,
            isPrivate,
            bot: session.bot,
            questions,
            currentIndex: 0,
            answers: [],
            timer: null,
            timeoutSeconds: config.questionTimeout,
            onFinish: async (s, passed) => {
                await handleSessionFinished(ctx, config, s, passed);
            },
        };
        activeSessions.set(key, examSession);
        await session.bot.sendMessage(session.channelId, `🚦 驾考答题正式开始！共 ${questions.length} 道题，正确率达到 90% 及以上视为通关。祝你好运！`);
        await sendCurrentQuestion(examSession);
    });
    // 3. 挑战指令：消耗货币指定人进行挑战
    ctx
        .command('驾考挑战 <target:string> <amount:number>', '消耗货币指定他人进行驾考禁言挑战')
        .userFields(['id'])
        .action(async ({ session }, rawTarget, amount) => {
        if (!session.guildId) {
            return '⚠️ 驾考挑战只能在群聊中发起！';
        }
        if (!amount || amount <= 0 || Number.isNaN(amount)) {
            return '⚠️ 请输入有效的挑战货币数量，如：驾考挑战 @某人 100';
        }
        const targetUserId = extractTargetUserId(rawTarget, session);
        if (!targetUserId) {
            return '⚠️ 请指定被挑战人（可通过 @ 或输入对方ID）';
        }
        if (targetUserId === session.userId) {
            return '⚠️ 不能挑战自己！';
        }
        const challengerUid = Number(session.user?.id) || 0;
        const targetUid = await resolveUid(ctx, session.platform, targetUserId);
        // 检查发起人余额
        const balance = await getCashBalance(ctx, challengerUid, config.currency);
        if (balance < amount) {
            return `❌ 余额不足！当前现金余额为 ${balance} ${config.currency}，发起本次挑战需要 ${amount} ${config.currency}。`;
        }
        // 折算禁言小时数
        const banHours = Number((amount / config.currencyPerHour).toFixed(2));
        if (banHours <= 0) {
            return `⚠️ 投入货币过少，不足以折算禁言时长（当前比例为 ${config.currencyPerHour} 货币/小时）`;
        }
        // 获取被挑战人状态
        const targetRecord = await getOrCreateUser(ctx, session.guildId, targetUserId, targetUid, config.initialBufferHours, config.activeStartHour, config.activeEndHour);
        // 检查被挑战人合法性（需求 7.3 & 防套娃）
        if (targetRecord.isMuted) {
            return '⚠️ 目标玩家当前已被禁言，不可对其发起挑战！';
        }
        // 检查目标玩家是否已有进行中的挑战
        const ongoingChallenges = await ctx.database.get('driver_exam_challenge', {
            guildId: session.guildId,
            targetUserId,
        });
        const hasPendingOrActive = ongoingChallenges.some((c) => c.status === 'pending' || c.status === 'active');
        if (hasPendingOrActive) {
            return '⚠️ 目标玩家当前正在接受其他挑战中，不可同时叠加多重挑战！';
        }
        const now = new Date();
        // 检查名单豁免时间（若在名单中，未来 1小时缓冲 + 折算时长 内不能到达禁言）
        if (targetRecord.inList) {
            const requiredSafetyTime = addActiveHours(now, config.challengeBufferHours + banHours, config.activeStartHour, config.activeEndHour);
            if (new Date(targetRecord.exemptUntil) < requiredSafetyTime) {
                return `⚠️ 目标玩家当前所剩豁免时长不足（到期时间为 ${formatDateTime(targetRecord.exemptUntil)}），无法满足发起挑战所需的安全期要求！`;
            }
        }
        // 执行扣款
        const costOk = await costCash(ctx, challengerUid, amount, config.currency);
        if (!costOk) {
            return '❌ 扣款失败，请重试！';
        }
        // 计算需要通关的轮数
        const requiredRounds = Math.max(1, Math.ceil(banHours / config.exemptHoursPerPass));
        const bufferDeadline = addActiveHours(now, config.challengeBufferHours, config.activeStartHour, config.activeEndHour);
        // 创建挑战
        await ctx.database.create('driver_exam_challenge', {
            guildId: session.guildId,
            challengerUid,
            challengerUserId: session.userId,
            targetUid,
            targetUserId,
            costCurrency: amount,
            banHours,
            requiredRounds,
            passedRounds: 0,
            bufferDeadline,
            banDeadline: bufferDeadline,
            status: 'pending',
            createdAt: now,
        });
        const rewardAmount = (amount * config.challengeRewardRate).toFixed(1);
        return (`⚔️ 【驾考挑战发起成功】\n` +
            `发起人: <at id="${session.userId}"/> 消耗了 ${amount} ${config.currency}\n` +
            `目标玩家: <at id="${targetUserId}"/>\n` +
            `折算禁言: ${banHours} 小时\n` +
            `需通关数: ${requiredRounds} 轮驾考（每轮通过顺延 ${config.exemptHoursPerPass} 小时）\n` +
            `⏳ 缓冲期截止: ${formatDateTime(bufferDeadline)}（${config.challengeBufferHours}小时缓冲）\n` +
            `🎁 奖励提示: 若在缓冲期截止前全部答对通关，可夺得挑战奖励 ${rewardAmount} ${config.currency}（50%）！\n` +
            `逾期未完成将开启群内禁言！`);
    });
    // 4. 状态查询指令
    ctx
        .command('驾考状态', '查询个人的驾考保释与挑战状态')
        .userFields(['id'])
        .action(async ({ session }) => {
        const guildId = session.guildId || 'private';
        const userId = session.userId;
        const uid = Number(session.user?.id) || 0;
        const record = await getOrCreateUser(ctx, guildId, userId, uid, config.initialBufferHours, config.activeStartHour, config.activeEndHour);
        // 查询进行中的挑战
        const challenges = await ctx.database.get('driver_exam_challenge', {
            guildId,
            targetUserId: userId,
        });
        const activeCh = challenges.find((c) => c.status === 'pending' || c.status === 'active');
        const lines = [];
        lines.push(`📋 【驾考状态报告 - ${userId}】`);
        lines.push(`监控名单: ${record.inList ? '🚨 是 (需按期刷题)' : '🕊️ 否 (自由参与)'}`);
        lines.push(`禁言状态: ${record.isMuted ? '🤐 禁言中 (可在私信答题保释)' : '🟢 正常发言'}`);
        lines.push(`豁免截止时间: ${formatDateTime(record.exemptUntil)}`);
        lines.push(`本周连胜进度: ${record.weekStreak} / ${config.weekStreakTarget} 轮`);
        const maxDaily = config.enableDailyRewardLimit
            ? config.dailyRewardLimitMode === 'auto'
                ? Math.floor((config.activeEndHour - config.activeStartHour) / config.exemptHoursPerPass)
                : config.dailyRewardLimitCustom
            : '不限';
        lines.push(`今日自由挑战领奖: ${record.dailyPassCount} / ${maxDaily} 次`);
        if (activeCh) {
            lines.push(`\n⚠️ 【正在进行的挑战】\n` +
                `状态: ${activeCh.status === 'pending' ? '⏳ 1小时缓冲期中' : '🤐 挑战禁言惩罚中'}\n` +
                `已通关轮数: ${activeCh.passedRounds} / ${activeCh.requiredRounds}\n` +
                `缓冲期截止: ${formatDateTime(activeCh.bufferDeadline)}`);
        }
        return lines.join('\n');
    });
    // 5. 管理员名单查询与管理指令
    ctx
        .command('驾考名单', '查看当前群受监控的名单列表', { authority: 3 })
        .action(async ({ session }) => {
        if (!session.guildId)
            return '请在群聊中使用此指令。';
        const list = await ctx.database.get('driver_exam_user', {
            guildId: session.guildId,
            inList: true,
        });
        if (list.length === 0)
            return '📝 当前群监控名单为空。';
        const lines = ['📋 【驾考监控名单】'];
        for (const u of list) {
            lines.push(`- 用户 ${u.userId}: 豁免至 ${formatDateTime(u.exemptUntil)} | 状态: ${u.isMuted ? '🤐禁言' : '🟢正常'}`);
        }
        return lines.join('\n');
    });
    ctx
        .command('驾考添加 <target:string> [bufferHours:number]', '将用户加入监控名单', { authority: 3 })
        .action(async ({ session }, rawTarget, bufferHours) => {
        if (!session.guildId)
            return '请在群聊中使用此指令。';
        const targetUserId = extractTargetUserId(rawTarget, session);
        if (!targetUserId)
            return '请指定要添加的目标用户。';
        const hours = typeof bufferHours === 'number' && bufferHours >= 0 ? bufferHours : config.initialBufferHours;
        const targetUid = await resolveUid(ctx, session.platform, targetUserId);
        const record = await getOrCreateUser(ctx, session.guildId, targetUserId, targetUid, hours, config.activeStartHour, config.activeEndHour);
        const exemptUntil = addActiveHours(new Date(), hours, config.activeStartHour, config.activeEndHour);
        await ctx.database.set('driver_exam_user', { id: record.id }, {
            inList: true,
            exemptUntil,
        });
        return `✅ 已将用户 ${targetUserId} 加入监控名单，赋予 ${hours} 小时初始缓冲期（截止至 ${formatDateTime(exemptUntil)}）`;
    });
    ctx
        .command('驾考移除 <target:string>', '将用户移出监控名单', { authority: 3 })
        .action(async ({ session }, rawTarget) => {
        if (!session.guildId)
            return '请在群聊中使用此指令。';
        const targetUserId = extractTargetUserId(rawTarget, session);
        if (!targetUserId)
            return '请指定要移除的目标用户。';
        const [record] = await ctx.database.get('driver_exam_user', {
            guildId: session.guildId,
            userId: targetUserId,
        });
        if (!record || !record.inList)
            return `用户 ${targetUserId} 本就不在监控名单中。`;
        await ctx.database.set('driver_exam_user', { id: record.id }, {
            inList: false,
        });
        if (record.isMuted) {
            try {
                await session.bot.muteGuildMember(session.guildId, targetUserId, 0);
                await ctx.database.set('driver_exam_user', { id: record.id }, { isMuted: false });
            }
            catch (_) { }
        }
        return `✅ 已将用户 ${targetUserId} 移出监控名单，并解除其禁言。`;
    });
    ctx
        .command('驾考同步 [page:number]', '手动批量同步远程题库并入库缓存', { authority: 3 })
        .action(async ({ session }, page) => {
        const p = page || 1;
        const count1 = await syncQuestionsBatch(ctx, config.appId, config.appSecret, { page: p, questionType: 1 });
        const count2 = await syncQuestionsBatch(ctx, config.appId, config.appSecret, { page: p, questionType: 2 });
        const total = await ctx.database.get('driver_exam_question', {});
        return `📥 同步完成！本次同步新增/更新 ${count1 + count2} 题，本地题库现存 ${total.length} 题。`;
    });
}
/**
 * 答题结算统一后置逻辑
 */
async function handleSessionFinished(ctx, config, session, passed) {
    const user = await getOrCreateUser(ctx, session.guildId, session.userId, session.uid, config.initialBufferHours, config.activeStartHour, config.activeEndHour);
    const now = new Date();
    // 1. 优先判定是否存在被挑战状态
    const challenges = await ctx.database.get('driver_exam_challenge', {
        guildId: session.guildId,
        targetUserId: session.userId,
    });
    const ch = challenges.find((c) => c.status === 'pending' || c.status === 'active');
    if (ch) {
        if (passed) {
            ch.passedRounds++;
            if (ch.passedRounds >= ch.requiredRounds) {
                if (ch.status === 'pending') {
                    // 缓冲期内全部完成！挑战化解！
                    ch.status = 'success';
                    const rewardAmount = ch.costCurrency * config.challengeRewardRate;
                    await gainCash(ctx, session.uid, rewardAmount, config.currency);
                    await session.bot.sendMessage(session.channelId, `🎉 挑战成功化解！你在生效前完成了全部 ${ch.requiredRounds} 轮考核，荣获挑战奖励 ${rewardAmount.toFixed(1)} ${config.currency}（50%）！`);
                }
                else {
                    // 在被禁言后私信完成全部考核！解除禁言！
                    ch.status = 'failed';
                    try {
                        await session.bot.muteGuildMember(session.guildId, session.userId, 0);
                    }
                    catch (_) { }
                    await session.bot.sendMessage(session.channelId, `🎉 恭喜！你已完成挑战所需的所有 ${ch.requiredRounds} 轮试题，已立即为你解除挑战禁言！`);
                }
            }
            else {
                await session.bot.sendMessage(session.channelId, `👍 挑战进度更新: [${ch.passedRounds}/${ch.requiredRounds}] 轮。请继续答题解围！`);
            }
            await ctx.database.set('driver_exam_challenge', { id: ch.id }, ch);
        }
        else {
            await session.bot.sendMessage(session.channelId, `⚠️ 本轮未达到 90% 正确率，不计入挑战通关进度。当前进度: [${ch.passedRounds}/${ch.requiredRounds}] 轮。`);
        }
        return;
    }
    // 2. 名单成员处理逻辑
    if (user.inList) {
        if (user.isMuted) {
            // 被禁言状态（私信答题）
            if (passed) {
                try {
                    await session.bot.muteGuildMember(session.guildId, session.userId, 0);
                }
                catch (_) { }
                user.isMuted = false;
                user.exemptUntil = addActiveHours(now, config.mutedPassExemptHours, config.activeStartHour, config.activeEndHour);
                user.weekStreak++;
                let streakNotice = `\n🔥 本周连续通关: ${user.weekStreak} / ${config.weekStreakTarget} 轮`;
                if (user.weekStreak >= config.weekStreakTarget) {
                    const streakHours = config.weekStreakRewardDays * (config.activeEndHour - config.activeStartHour);
                    user.exemptUntil = addActiveHours(user.exemptUntil, streakHours, config.activeStartHour, config.activeEndHour);
                    user.weekStreak = 0;
                    streakNotice = `\n👑 达成自然周 10 连胜！额外获得 3 天 (${streakHours} 小时) 免禁顺延！`;
                }
                await session.bot.sendMessage(session.channelId, `🎉 私信答题通关成功！已为你解除群内禁言，豁免期基于当前时间后延 ${config.mutedPassExemptHours} 小时，有效至: ${formatDateTime(user.exemptUntil)}！${streakNotice}`);
            }
            else {
                user.weekStreak = 0;
                await session.bot.sendMessage(session.channelId, `❌ 本轮未达到 90% 及格线，解禁失败，本周连胜已清零。请重新私信“驾考答题”！`);
            }
        }
        else {
            // 正常未被禁言状态
            if (passed) {
                const base = new Date(user.exemptUntil) > now ? new Date(user.exemptUntil) : now;
                user.exemptUntil = addActiveHours(base, config.exemptHoursPerPass, config.activeStartHour, config.activeEndHour);
                user.weekStreak++;
                let streakNotice = `\n🔥 本周连续通关: ${user.weekStreak} / ${config.weekStreakTarget} 轮`;
                if (user.weekStreak >= config.weekStreakTarget) {
                    const streakHours = config.weekStreakRewardDays * (config.activeEndHour - config.activeStartHour);
                    user.exemptUntil = addActiveHours(user.exemptUntil, streakHours, config.activeStartHour, config.activeEndHour);
                    user.weekStreak = 0;
                    streakNotice = `\n👑 达成自然周 10 连胜！额外获得 3 天 (${streakHours} 小时) 免禁顺延！`;
                }
                await session.bot.sendMessage(session.channelId, `🎉 通关成功！开始禁言时间已向后顺延 ${config.exemptHoursPerPass} 小时，最新豁免截止时刻为: ${formatDateTime(user.exemptUntil)}！${streakNotice}`);
            }
            else {
                user.weekStreak = 0;
                await session.bot.sendMessage(session.channelId, `❌ 本轮考核未及格，未能获得时间顺延，本周连胜已打断重置。`);
            }
        }
        await ctx.database.set('driver_exam_user', { id: user.id }, user);
        return;
    }
    // 3. 自由挑战玩家（非名单且无挑战）
    if (passed) {
        const maxDaily = config.enableDailyRewardLimit
            ? config.dailyRewardLimitMode === 'auto'
                ? Math.floor((config.activeEndHour - config.activeStartHour) / config.exemptHoursPerPass)
                : config.dailyRewardLimitCustom
            : Infinity;
        const unitReward = Number((config.currencyPerHour * config.challengeRewardRate).toFixed(1));
        if (user.dailyPassCount < maxDaily) {
            user.dailyPassCount++;
            await gainCash(ctx, session.uid, unitReward, config.currency);
            await session.bot.sendMessage(session.channelId, `🎉 自由挑战通关！奖励 ${unitReward} ${config.currency}！今日领奖进度: [${user.dailyPassCount}/${maxDaily}]`);
        }
        else {
            await session.bot.sendMessage(session.channelId, `🎉 自由挑战通关！今日答题领奖次数已达上限 (${maxDaily}次)，本次无货币奖励。`);
        }
    }
    else {
        await session.bot.sendMessage(session.channelId, `💡 自由挑战未达到 90% 正确率，失败无任何惩罚。欢迎随时再次挑战！`);
    }
    await ctx.database.set('driver_exam_user', { id: user.id }, user);
}
