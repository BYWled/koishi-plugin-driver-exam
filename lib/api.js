import { Logger } from 'koishi';
const logger = new Logger('driver-exam:api');
let lastRequestTime = 0;
/**
 * 节流请求（保证调用间隔 >= 1200ms，严格遵守 QPS=1）
 */
async function throttledFetch(url) {
    const now = Date.now();
    const wait = Math.max(0, 1250 - (now - lastRequestTime));
    if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequestTime = Date.now();
    try {
        const res = await fetch(url);
        const json = await res.json();
        return json;
    }
    catch (err) {
        logger.error(`请求失败 [${url}]:`, err);
        throw err;
    }
}
/**
 * 获取考题列表
 */
export async function fetchQuestionsApi(appId, appSecret, options = {}) {
    const page = options.page ?? 1;
    const rank = options.rank ?? 1;
    const subjectType = options.subjectType ?? 1;
    const questionType = options.questionType ?? 1;
    const url = `https://www.mxnzp.com/api/driver_exam/v2/question/list?page=${page}&rank=${rank}&subject_type=${subjectType}&question_type=${questionType}&app_id=${appId}&app_secret=${appSecret}`;
    const data = await throttledFetch(url);
    return data;
}
/**
 * 批量获取考题答案与解析
 */
export async function fetchAnswersApi(appId, appSecret, ids) {
    if (ids.length === 0)
        return { code: 1, data: [] };
    const url = `https://www.mxnzp.com/api/driver_exam/v2/answer/list?ids=${ids.join(',')}&app_id=${appId}&app_secret=${appSecret}`;
    const data = await throttledFetch(url);
    return data;
}
/**
 * 批量同步题目与答案入库（充实本地题库缓存池）
 */
export async function syncQuestionsBatch(ctx, appId, appSecret, options = {}) {
    try {
        const qRes = await fetchQuestionsApi(appId, appSecret, options);
        if (qRes.code !== 1 || !qRes.data || !qRes.data.list || qRes.data.list.length === 0) {
            logger.warn(`获取题目列表失败或为空: ${JSON.stringify(qRes)}`);
            return 0;
        }
        const qList = qRes.data.list;
        const ids = qList.map((q) => q.id);
        const aRes = await fetchAnswersApi(appId, appSecret, ids);
        const answerMap = new Map();
        if (aRes.code === 1 && Array.isArray(aRes.data)) {
            for (const item of aRes.data) {
                answerMap.set(item.id, {
                    answer: item.answer ?? '',
                    explain: item.explain ?? '无解析',
                });
            }
        }
        let savedCount = 0;
        const now = new Date();
        for (const q of qList) {
            const aInfo = answerMap.get(q.id) || { answer: '', explain: '暂无解析' };
            let pic = q.titlePic || '';
            if (pic.startsWith('/')) {
                pic = `https://www.mxnzp.com${pic}`;
            }
            const record = {
                id: q.id,
                rank: q.rank || options.rank || 1,
                subjectType: q.subjectType || options.subjectType || 1,
                questionType: q.questionType || options.questionType || 1,
                title: q.title || '',
                op1: q.op1 || '',
                op2: q.op2 || '',
                op3: q.op3 || '',
                op4: q.op4 || '',
                titlePic: pic,
                answer: aInfo.answer,
                explain: aInfo.explain,
                updatedAt: now,
            };
            await ctx.database.upsert('driver_exam_question', [record]);
            savedCount++;
        }
        logger.info(`已成功同步并缓存 ${savedCount} 道考题到本地`);
        return savedCount;
    }
    catch (err) {
        logger.error('同步题库失败:', err);
        return 0;
    }
}
/**
 * 从本地题库中随机抽取题目，若题库不足则自动远程抓取扩充
 */
export async function getExamQuestions(ctx, appId, appSecret, count = 10) {
    let questions = await ctx.database.get('driver_exam_question', {});
    // 本地题目数量少于需要数量时，主动抓取一批
    if (questions.length < count * 2 && appId && appSecret) {
        const randomPage = Math.floor(Math.random() * 20) + 1;
        // 异步拉取单选题与判断题
        await syncQuestionsBatch(ctx, appId, appSecret, { page: randomPage, questionType: 1 });
        await syncQuestionsBatch(ctx, appId, appSecret, { page: randomPage, questionType: 2 });
        questions = await ctx.database.get('driver_exam_question', {});
    }
    // 打乱并返回 count 道题
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}
