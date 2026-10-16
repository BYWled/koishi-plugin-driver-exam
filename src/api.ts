import { Context, Logger } from 'koishi'
import { DriverExamQuestion } from './database'

const logger = new Logger('driver-exam:api')

let lastRequestTime = 0

/**
 * 节流请求（保证调用间隔 >= 1200ms，严格遵守 QPS=1）
 */
async function throttledFetch(url: string): Promise<any> {
  const now = Date.now()
  const wait = Math.max(0, 1250 - (now - lastRequestTime))
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  lastRequestTime = Date.now()

  try {
    const res = await fetch(url)
    const json = await res.json()
    return json
  } catch (err) {
    logger.error(`请求失败 [${url}]:`, err)
    throw err
  }
}

/**
 * 获取考题列表
 */
export async function fetchQuestionsApi(
  appId: string,
  appSecret: string,
  options: {
    page?: number
    rank?: number
    subjectType?: number
    questionType?: number
  } = {}
) {
  const page = options.page ?? 1
  const rank = options.rank ?? 1
  const subjectType = options.subjectType ?? 1
  const questionType = options.questionType ?? 1

  const url = `https://www.mxnzp.com/api/driver_exam/v2/question/list?page=${page}&rank=${rank}&subject_type=${subjectType}&question_type=${questionType}&app_id=${appId}&app_secret=${appSecret}`
  const data = await throttledFetch(url)
  return data
}

/**
 * 批量获取考题答案与解析
 */
export async function fetchAnswersApi(
  appId: string,
  appSecret: string,
  ids: string[]
) {
  if (ids.length === 0) return { code: 1, data: [] }
  const url = `https://www.mxnzp.com/api/driver_exam/v2/answer/list?ids=${ids.join(',')}&app_id=${appId}&app_secret=${appSecret}`
  const data = await throttledFetch(url)
  return data
}

/**
 * 批量同步题目与答案入库（充实本地题库缓存池）
 */
export async function syncQuestionsBatch(
  ctx: Context,
  appId: string,
  appSecret: string,
  options: {
    page?: number
    rank?: number
    subjectType?: number
    questionType?: number
  } = {}
): Promise<number> {
  try {
    const qRes = await fetchQuestionsApi(appId, appSecret, options)
    if (qRes.code !== 1 || !qRes.data || !qRes.data.list || qRes.data.list.length === 0) {
      logger.warn(`获取题目列表失败或为空: ${JSON.stringify(qRes)}`)
      return 0
    }

    const qList = qRes.data.list
    const ids = qList.map((q: any) => q.id)

    const aRes = await fetchAnswersApi(appId, appSecret, ids)
    const answerMap = new Map<string, { answer: string; explain: string }>()
    if (aRes.code === 1 && Array.isArray(aRes.data)) {
      for (const item of aRes.data) {
        answerMap.set(item.id, {
          answer: item.answer ?? '',
          explain: item.explain ?? '无解析',
        })
      }
    }

    let savedCount = 0
    const now = new Date()

    for (const q of qList) {
      const aInfo = answerMap.get(q.id)
      if (!aInfo || !aInfo.answer) {
        // 考题必须带有标准答案才入库，避免无效题目被用户抽到
        continue
      }
      let pic = q.titlePic || ''
      if (pic.startsWith('/')) {
        pic = `https://www.mxnzp.com${pic}`
      }

      const record: DriverExamQuestion = {
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
      }

      await ctx.database.upsert('driver_exam_question', [record])
      savedCount++
    }

    logger.info(`已成功同步并缓存 ${savedCount} 道考题到本地`)
    return savedCount
  } catch (err) {
    logger.error('同步题库失败:', err)
    return 0
  }
}

/**
 * 获取随机考题，优先使用该用户未做过的题目，并支持指定车型(rank)、科目(subjectType)与题型(allowedTypes)
 */
export async function getExamQuestions(
  ctx: Context,
  appId: string,
  appSecret: string,
  userId: string,
  count = 10,
  rank = 1,
  subjectType = 1,
  allowedTypes: number[] = [1, 2],
  excludeQuestionIds: string[] = []
): Promise<DriverExamQuestion[]> {
  // 1. 查询该用户已做过的考题 ID 集合，合并本次需要排除的考题 ID
  const history = await ctx.database.get('driver_exam_history', { userId }, ['questionId'])
  const excludeSet = new Set([...history.map((h) => h.questionId), ...excludeQuestionIds])

  // 2. 从本地缓存中检索符合车型、科目、题型且带有有效答案的考题
  let candidates = await ctx.database.get('driver_exam_question', {
    rank,
    subjectType,
    questionType: allowedTypes,
  })
  candidates = candidates.filter((q) => Boolean(q.answer) && !excludeQuestionIds.includes(q.id))

  // 3. 筛选未做过的考题
  let unused = candidates.filter((q) => !excludeSet.has(q.id))

  // 4. 若未做过的题库少于需要数量，主动随机拉取多页进行充实
  if (unused.length < count && appId && appSecret) {
    logger.info(`用户 ${userId} 的未做题库仅剩 ${unused.length} 题，开始拉取新页面补充...`)
    // 科一总页数约 210 页，科四约 140 页
    const maxPages = subjectType === 1 ? 200 : 120
    const pagesToFetch = [
      Math.floor(Math.random() * maxPages) + 1,
      Math.floor(Math.random() * maxPages) + 1,
    ]

    for (const page of pagesToFetch) {
      for (const qType of allowedTypes) {
        await syncQuestionsBatch(ctx, appId, appSecret, {
          page,
          rank,
          subjectType,
          questionType: qType,
        })
      }
    }

    // 重新检索
    candidates = await ctx.database.get('driver_exam_question', {
      rank,
      subjectType,
      questionType: allowedTypes,
    })
    candidates = candidates.filter((q) => Boolean(q.answer) && !excludeQuestionIds.includes(q.id))
    unused = candidates.filter((q) => !excludeSet.has(q.id))
  }

  // 5. 若该分类下未做题目仍然不足（例如用户刷穿了题库），允许复用做过的题目避免卡死（但仍严格排除本次指定的题目）
  const pool = (unused.length >= count ? unused : candidates).filter(
    (q) => Boolean(q.answer) && !excludeQuestionIds.includes(q.id)
  )

  // 打乱并返回 count 道题
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
