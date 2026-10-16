import { h, Logger } from 'koishi';
const logger = new Logger('driver-exam:session');
// 内存中活跃答题会话池
export const activeSessions = new Map();
/**
 * 校验并比对用户答案
 */
export function checkUserAnswer(question, input) {
    const cleanInput = input.trim().toUpperCase();
    const cleanStandard = (question.answer || '').trim().toUpperCase();
    // 1. 判断题 (questionType === 1)
    if (question.questionType === 1) {
        const isTrueStd = cleanStandard === 'TRUE' || cleanStandard === 'A' || cleanStandard === '正确';
        const trueInputs = ['对', '正确', 'T', 'TRUE', 'A', '1', 'YES', 'Y'];
        const falseInputs = ['错', '错误', 'F', 'FALSE', 'B', '2', 'NO', 'N'];
        if (trueInputs.includes(cleanInput)) {
            return isTrueStd;
        }
        if (falseInputs.includes(cleanInput)) {
            return !isTrueStd;
        }
        return false;
    }
    // 2. 单选题 (questionType === 2)
    if (question.questionType === 2) {
        // 匹配字母 A/B/C/D
        if (['A', 'B', 'C', 'D'].includes(cleanInput)) {
            return cleanInput === cleanStandard;
        }
        // 兼容用户直接输入完整选项文本
        if (cleanInput === (question.op1 || '').trim().toUpperCase())
            return cleanStandard === 'A';
        if (cleanInput === (question.op2 || '').trim().toUpperCase())
            return cleanStandard === 'B';
        if (cleanInput === (question.op3 || '').trim().toUpperCase())
            return cleanStandard === 'C';
        if (cleanInput === (question.op4 || '').trim().toUpperCase())
            return cleanStandard === 'D';
        return false;
    }
    // 3. 多选题 (questionType === 3)
    if (question.questionType === 3) {
        // 提取所有 A-D 字母并去重排序
        const matched = cleanInput.match(/[A-D]/g);
        if (!matched)
            return false;
        const userSorted = Array.from(new Set(matched)).sort().join('');
        const stdSorted = Array.from(new Set(cleanStandard.match(/[A-D]/g) || [])).sort().join('');
        return userSorted === stdSorted;
    }
    return cleanInput === cleanStandard;
}
/**
 * 发送当前题目并启动倒计时
 */
export async function sendCurrentQuestion(session) {
    if (session.currentIndex >= session.questions.length) {
        await finishSession(session);
        return;
    }
    const q = session.questions[session.currentIndex];
    const total = session.questions.length;
    const qNum = session.currentIndex + 1;
    let typeName = '【单选题】';
    if (q.questionType === 1)
        typeName = '【判断题】';
    else if (q.questionType === 3)
        typeName = '【多选题】';
    const lines = [];
    lines.push(`📝 驾考答题 [${qNum}/${total}] ${typeName}\n${q.title}`);
    if (q.questionType === 1) {
        lines.push(`A. 正确\nB. 错误`);
    }
    else {
        if (q.op1)
            lines.push(`A. ${q.op1}`);
        if (q.op2)
            lines.push(`B. ${q.op2}`);
        if (q.op3)
            lines.push(`C. ${q.op3}`);
        if (q.op4)
            lines.push(`D. ${q.op4}`);
    }
    if (q.titlePic) {
        lines.push(h.image(q.titlePic));
    }
    lines.push(`⏱️ 请在 ${session.timeoutSeconds} 秒内作答（发送选项即可）`);
    try {
        await session.bot.sendMessage(session.channelId, lines.join('\n'));
    }
    catch (err) {
        logger.error('发送考题消息失败:', err);
    }
    // 设置单题超时定时器
    session.timer = setTimeout(async () => {
        session.answers.push({
            question: q,
            userAnswer: '超时未答',
            isCorrect: false,
            isTimeout: true,
        });
        try {
            await session.bot.sendMessage(session.channelId, `⚠️ 第 ${qNum} 题作答超时！标准答案是: ${q.answer}`);
        }
        catch (_) { }
        session.currentIndex++;
        await sendCurrentQuestion(session);
    }, session.timeoutSeconds * 1000);
}
/**
 * 用户输入答案时的处理
 */
export async function handleUserAnswer(session, input) {
    if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
    }
    const q = session.questions[session.currentIndex];
    const isCorrect = checkUserAnswer(q, input);
    session.answers.push({
        question: q,
        userAnswer: input.trim(),
        isCorrect,
    });
    // 简要反馈
    const tip = isCorrect ? '✅ 回答正确' : `❌ 回答错误（正确答案: ${q.answer}）`;
    try {
        await session.bot.sendMessage(session.channelId, tip);
    }
    catch (_) { }
    session.currentIndex++;
    await sendCurrentQuestion(session);
    return true;
}
/**
 * 结束本轮答题并汇总错题解析
 */
export async function finishSession(session) {
    if (session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
    }
    activeSessions.delete(session.key);
    const total = session.questions.length;
    const correctCount = session.answers.filter((a) => a.isCorrect).length;
    const accuracy = total > 0 ? (correctCount / total) * 100 : 0;
    const passed = accuracy >= 90; // 满足 >= 90% 及格
    const lines = [];
    lines.push(`🏁 【本轮驾考答题结算】`);
    lines.push(`答对题数: ${correctCount} / ${total}`);
    lines.push(`本轮正确率: ${accuracy.toFixed(1)}%`);
    lines.push(`考核结果: ${passed ? '🎉 恭喜通关！' : '❌ 未达到90%及格线，未通过！'}`);
    // 错题解析汇总
    const wrongs = session.answers.filter((a) => !a.isCorrect);
    if (wrongs.length > 0) {
        lines.push(`\n📖 【错题解析与回顾】`);
        for (let i = 0; i < wrongs.length; i++) {
            const w = wrongs[i];
            lines.push(`---------------------\n` +
                `[错题 ${i + 1}] ${w.question.title}\n` +
                `你的作答: ${w.userAnswer}\n` +
                `正确答案: ${w.question.answer}\n` +
                `官方解析: ${w.question.explain || '暂无解析'}`);
        }
    }
    try {
        await session.bot.sendMessage(session.channelId, lines.join('\n'));
    }
    catch (err) {
        logger.error('发送答题结算失败:', err);
    }
    // 触发后置回调
    try {
        await session.onFinish(session, passed);
    }
    catch (err) {
        logger.error('答题后置结算回调失败:', err);
    }
}
