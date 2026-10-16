import { Context, h, Logger } from 'koishi'
import { DriverExamQuestion } from './database'

const logger = new Logger('driver-exam:session')

export interface ExamAnswerRecord {
  question: DriverExamQuestion
  userAnswer: string
  isCorrect: boolean
  isTimeout?: boolean
}

export interface ExamSession {
  key: string
  ctx: Context
  guildId: string
  userId: string
  uid: number
  channelId: string
  isPrivate: boolean
  bot: any
  questions: DriverExamQuestion[]
  currentIndex: number
  answers: ExamAnswerRecord[]
  timer: NodeJS.Timeout | null
  timeoutSeconds: number
  passRate: number
  sendRetryCount: number
  replaceQuestionOnSendFailure: boolean
  fetchMoreQuestions?: (excludeIds?: string[]) => Promise<DriverExamQuestion | null>
  recallMessages: boolean
  messageIdsToRecall: string[]
  onFinish: (session: ExamSession, passed: boolean) => Promise<void>
}

// 内存中活跃答题会话池
export const activeSessions = new Map<string, ExamSession>()

/**
 * 提前结束退出答题的指令/关键词
 */
export const EXIT_KEYWORDS = ['退出答题', '结束答题', '取消答题', '不答了', 'quit', 'exit', '退出']

/**
 * 严格判断用户输入是否为合法的答题格式（防止正常聊天被误判为作答）
 */
export function isValidAnswerFormat(question: DriverExamQuestion, input: string): boolean {
  const clean = input.trim().toUpperCase()
  if (!clean) return false

  // 1. 判断题 (1)
  if (question.questionType === 1) {
    const valid = [
      '对', '错', '正确', '错误',
      'T', 'F', 'TRUE', 'FALSE',
      'A', 'B', '1', '2',
      'YES', 'NO', 'Y', 'N',
    ]
    return valid.includes(clean)
  }

  // 2. 单选题 (2)
  if (question.questionType === 2) {
    // 单个字母 A-D，或者 "选A"、"A."、"A、" 等形式
    if (/^(?:选)?[A-D][.、\s]?$/.test(clean)) return true
    // 形如 "A. 登记证书" 带有选项前缀+完整选项内容
    const matchPrefix = clean.match(/^([A-D])[.、\s]+(.+)$/)
    if (matchPrefix) {
      const letter = matchPrefix[1]
      const rest = matchPrefix[2].trim()
      let opText = ''
      if (letter === 'A') opText = question.op1
      else if (letter === 'B') opText = question.op2
      else if (letter === 'C') opText = question.op3
      else if (letter === 'D') opText = question.op4
      if (opText && rest === opText.trim().toUpperCase()) return true
    }
    // 完整匹配选项文本
    if (question.op1 && clean === question.op1.trim().toUpperCase()) return true
    if (question.op2 && clean === question.op2.trim().toUpperCase()) return true
    if (question.op3 && clean === question.op3.trim().toUpperCase()) return true
    if (question.op4 && clean === question.op4.trim().toUpperCase()) return true
    return false
  }

  // 3. 多选题 (3)
  if (question.questionType === 3) {
    // 仅允许以 "选" 开头（可选）后接纯字母 A-D 以及空格、逗号等分隔符，不能包含汉字或其他杂质字符
    const pure = clean.replace(/^选/, '').trim()
    if (!/^[A-D\s,，、]+$/.test(pure)) return false
    const matched = pure.match(/[A-D]/g)
    return Boolean(matched && matched.length >= 2)
  }

  return false
}

/**
 * 校验并比对用户答案对错
 */
export function checkUserAnswer(question: DriverExamQuestion, input: string): boolean {
  const cleanInput = input.trim().toUpperCase()
  const cleanStandard = (question.answer || '').trim().toUpperCase()

  // 1. 判断题 (questionType === 1)
  if (question.questionType === 1) {
    const isTrueStd = cleanStandard === 'TRUE' || cleanStandard === 'A' || cleanStandard === '正确'
    const trueInputs = ['对', '正确', 'T', 'TRUE', 'A', '1', 'YES', 'Y']
    const falseInputs = ['错', '错误', 'F', 'FALSE', 'B', '2', 'NO', 'N']

    if (trueInputs.includes(cleanInput)) return isTrueStd
    if (falseInputs.includes(cleanInput)) return !isTrueStd
    return false
  }

  // 2. 单选题 (questionType === 2)
  if (question.questionType === 2) {
    const singleMatch = cleanInput.match(/^(?:选)?([A-D])[.、\s]?$/)
    if (singleMatch) {
      return singleMatch[1] === cleanStandard
    }
    const prefixMatch = cleanInput.match(/^([A-D])[.、\s]+(.+)$/)
    if (prefixMatch) {
      return prefixMatch[1] === cleanStandard
    }
    if (question.op1 && cleanInput === question.op1.trim().toUpperCase()) return cleanStandard === 'A'
    if (question.op2 && cleanInput === question.op2.trim().toUpperCase()) return cleanStandard === 'B'
    if (question.op3 && cleanInput === question.op3.trim().toUpperCase()) return cleanStandard === 'C'
    if (question.op4 && cleanInput === question.op4.trim().toUpperCase()) return cleanStandard === 'D'
    return false
  }

  // 3. 多选题 (questionType === 3)
  if (question.questionType === 3) {
    const matched = cleanInput.match(/[A-D]/g)
    if (!matched) return false
    const userSorted = Array.from(new Set(matched)).sort().join('')
    const stdSorted = Array.from(new Set(cleanStandard.match(/[A-D]/g) || [])).sort().join('')
    return userSorted === stdSorted
  }

  return cleanInput === cleanStandard
}

/**
 * 尝试撤回暂存的答题过程消息（静默容错）
 */
export async function recallSessionMessages(session: ExamSession) {
  if (!session.recallMessages || session.messageIdsToRecall.length === 0) return
  const ids = [...session.messageIdsToRecall]
  session.messageIdsToRecall = []
  for (const id of ids) {
    try {
      await session.bot.deleteMessage(session.channelId, id)
    } catch (_) {
      // 撤回权限不足或已过撤回时间时静默忽略
    }
  }
}

const imageCache = new Map<string, string>()

/**
 * 将题目图片安全拉取并尽可能转换为标准 PNG base64 数据，避免 OneBot 协议端远程拉取 webp 失败 (1200)
 */
export async function resolveQuestionImage(
  ctx: Context,
  url: string
): Promise<string | null> {
  if (!url) return null
  if (imageCache.has(url)) {
    return imageCache.get(url)!
  }

  try {
    let buf: Buffer
    if (ctx.http) {
      const ab = await ctx.http.get(url, { responseType: 'arraybuffer' })
      buf = Buffer.from(ab)
    } else {
      const res = await fetch(url)
      const ab = await res.arrayBuffer()
      buf = Buffer.from(ab)
    }

    if (!buf || buf.length === 0) {
      return null
    }

    // 如果启用了 puppeteer，利用浏览器环境将图片（包括 webp 等格式）转化为标准 PNG base64
    if (ctx.puppeteer) {
      try {
        const page = await ctx.puppeteer.page()
        try {
          const base64 = buf.toString('base64')
          const dataUrl = `data:image/webp;base64,${base64}`
          const pngDataUrl: any = await page.evaluate(async (src) => {
            return new Promise((resolve, reject) => {
              const img = new Image()
              img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx2d = canvas.getContext('2d')
                ctx2d?.drawImage(img, 0, 0)
                resolve(canvas.toDataURL('image/png'))
              }
              img.onerror = () => reject(new Error('Canvas image load failed'))
              img.src = src
            })
          }, dataUrl)

          if (pngDataUrl && pngDataUrl.startsWith('data:image/png')) {
            imageCache.set(url, pngDataUrl)
            return pngDataUrl
          }
        } finally {
          await page.close()
        }
      } catch (pErr) {
        logger.warn(`Puppeteer 转码题目配图为 PNG 失败，降级为直发 base64:`, pErr)
      }
    }

    // 若无 puppeteer 或转码失败，直接转为本地 base64 data url，避免 OneBot 自行下载失败
    const base64 = buf.toString('base64')
    const fallbackDataUrl = `data:image/jpeg;base64,${base64}`
    imageCache.set(url, fallbackDataUrl)
    return fallbackDataUrl
  } catch (err) {
    logger.warn(`拉取考题配图失败 [${url}]:`, err)
    return null
  }
}

/**
 * 发送当前题目并启动倒计时（支持重试与图片发送失败降级/换题/跳过）
 */
export async function sendCurrentQuestion(session: ExamSession) {
  if (session.currentIndex >= session.questions.length) {
    await finishSession(session)
    return
  }

  const q = session.questions[session.currentIndex]
  const total = session.questions.length
  const qNum = session.currentIndex + 1

  let typeName = '【单选题】'
  if (q.questionType === 1) typeName = '【判断题】'
  else if (q.questionType === 3) typeName = '【多选题】'

  // 1. 如果题目有图，预先尝试解析为标准的 PNG Base64 Data URL
  let resolvedImage: string | null = null
  if (q.titlePic) {
    try {
      resolvedImage = await resolveQuestionImage(session.ctx, q.titlePic)
    } catch (_) {}
  }

  // 辅助函数：构造题目消息元素
  const buildElements = (includePic: boolean) => {
    const elements: any[] = []
    if (!session.isPrivate) {
      elements.push(h.at(session.userId), ' ')
    }

    const lines: string[] = []
    lines.push(`[驾考答题 ${qNum}/${total}] ${typeName}\n${q.title}`)

    if (q.questionType === 1) {
      lines.push(`A. 正确\nB. 错误`)
    } else {
      if (q.op1) lines.push(`A. ${q.op1}`)
      if (q.op2) lines.push(`B. ${q.op2}`)
      if (q.op3) lines.push(`C. ${q.op3}`)
      if (q.op4) lines.push(`D. ${q.op4}`)
    }

    elements.push(lines.join('\n'))

    if (includePic) {
      const picSrc = resolvedImage || q.titlePic
      if (picSrc) {
        elements.push(h.image(picSrc))
      }
    }

    elements.push(`\n请在 ${session.timeoutSeconds} 秒内作答（发送选项即可，发送“退出答题”可提前结束）`)
    return elements
  }

  const maxRetries = session.sendRetryCount ?? 2
  let sentMsgIds: string[] | null = null

  logger.info(`准备发送题目 [${qNum}/${total}]: id=${q.id}, title=${q.title.slice(0, 20)}`)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 首次尝试带图发送；若重试且原题有图，降级为纯文本发送避免协议端图片拉取失败(1200)
      const tryWithPic = attempt === 0 && Boolean(q.titlePic)
      const elements = buildElements(tryWithPic)
      const res = await session.bot.sendMessage(session.channelId, elements)
      const ids = Array.isArray(res) ? res : [res].filter(Boolean)
      if (ids && ids.length > 0) {
        sentMsgIds = ids
        break
      }
    } catch (err) {
      logger.warn(`第 ${attempt + 1} 次发送考题 [${qNum}/${total}] 失败:`, err)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }

  // 若多次重试后仍然发送失败
  if (!sentMsgIds || sentMsgIds.length === 0) {
    logger.warn(`考题 [${q.id}] (第 ${qNum} 题) 发送失败，准备更换题目或跳过该题...`)

    // 1. 如果配置了换题，尝试抽取未做过的新题替换
    if (session.replaceQuestionOnSendFailure && session.fetchMoreQuestions) {
      try {
        const excludeIds = session.questions.map((item) => item.id)
        const newQ = await session.fetchMoreQuestions(excludeIds)
        if (newQ && !excludeIds.includes(newQ.id)) {
          logger.info(`已成功获取替换考题: id=${newQ.id}, title=${newQ.title.slice(0, 20)}`)
          session.questions[session.currentIndex] = newQ
          const notice = session.isPrivate
            ? `[系统提示] 原考题消息发送异常，已自动更换为新题目。`
            : [h.at(session.userId), ' [系统提示] 原考题消息发送异常，已自动更换为新题目。']
          await session.bot.sendMessage(session.channelId, notice).catch(() => {})
          await sendCurrentQuestion(session)
          return
        }
      } catch (err) {
        logger.warn('尝试更换考题失败:', err)
      }
    }

    // 2. 若换题失败或未开启换题：直接跳过本题！不记录错误、不惩罚用户
    logger.warn(`考题 [${q.id}] 发送失败且无法换题，执行跳过本题逻辑`)
    session.questions.splice(session.currentIndex, 1)

    const skipNotice = session.isPrivate
      ? `[系统提示] 题目发送异常，已自动跳过该题！`
      : [h.at(session.userId), ' [系统提示] 题目发送异常，已自动跳过该题！']
    await session.bot.sendMessage(session.channelId, skipNotice).catch(() => {})

    // 若全部题目都无法发送，结束本次测评
    if (session.questions.length === 0) {
      logger.warn(`所有考题均发送失败，中止本次测评`)
      activeSessions.delete(session.key)
      return
    }

    // 若跳过的是最后一题，直接结算
    if (session.currentIndex >= session.questions.length) {
      await finishSession(session)
      return
    }

    // 否则直接出下一题（下一个题目已移动至 session.currentIndex）
    await sendCurrentQuestion(session)
    return
  }

  session.messageIdsToRecall.push(...sentMsgIds)

  // 成功发送考题后，才正式启动单题超时定时器！
  session.timer = setTimeout(async () => {
    logger.info(`题目 [${qNum}/${total}] 超时未答，自动进入下一题`)
    session.answers.push({
      question: q,
      userAnswer: '超时未答',
      isCorrect: false,
      isTimeout: true,
    })

    // 撤回本题消息后直接推进下一题
    await recallSessionMessages(session)

    session.currentIndex++
    await sendCurrentQuestion(session)
  }, session.timeoutSeconds * 1000)
}

/**
 * 用户输入答案时的处理
 */
export async function handleUserAnswer(
  session: ExamSession,
  input: string,
  messageId?: string
): Promise<boolean> {
  logger.info(`收到用户答题输入: input="${input}", currentIndex=${session.currentIndex}, messageId=${messageId}`)
  if (session.timer) {
    clearTimeout(session.timer)
    session.timer = null
  }

  if (messageId) {
    session.messageIdsToRecall.push(messageId)
  }

  const q = session.questions[session.currentIndex]
  const isCorrect = checkUserAnswer(q, input)
  logger.info(`答案核对结果: user="${input}", standard="${q.answer}", isCorrect=${isCorrect}`)

  session.answers.push({
    question: q,
    userAnswer: input.trim(),
    isCorrect,
  })

  // 答题期间不公布答案，撤回上一题与用户作答消息，直接出下一题
  await recallSessionMessages(session)

  session.currentIndex++
  await sendCurrentQuestion(session)
  return true
}

/**
 * 用户主动提前结束答题
 */
export async function abortSession(session: ExamSession) {
  if (session.timer) {
    clearTimeout(session.timer)
    session.timer = null
  }
  activeSessions.delete(session.key)

  // 撤回答题过程中的消息
  await recallSessionMessages(session)

  try {
    const notice = session.isPrivate
      ? `已提前结束本次驾考答题。本轮测评已中止，不计入考核成绩。`
      : [h.at(session.userId), ' 已提前结束本次驾考答题。本轮测评已中止，不计入考核成绩。']
    await session.bot.sendMessage(session.channelId, notice)
  } catch (_) {}
}

/**
 * 格式化考题的标准答案以便于人类阅读
 */
export function formatQuestionAnswer(q: DriverExamQuestion): string {
  if (q.questionType === 1) {
    const isTrue = q.answer === 'true' || q.answer === 'A' || q.answer === '正确'
    return isTrue ? 'A. 正确' : 'B. 错误'
  }
  return q.answer || '暂无答案'
}

/**
 * 结束本轮答题并汇总错题解析
 */
export async function finishSession(session: ExamSession) {
  if (session.timer) {
    clearTimeout(session.timer)
    session.timer = null
  }
  activeSessions.delete(session.key)

  // 撤回答题过程中的所有暂存消息
  await recallSessionMessages(session)

  const total = session.questions.length
  const correctCount = session.answers.filter((a) => a.isCorrect).length
  const accuracy = total > 0 ? (correctCount / total) * 100 : 0
  const targetRatePercent = (session.passRate ?? 0.9) * 100
  const passed = accuracy >= targetRatePercent - 0.001 // 可配置及格率判定

  const lines: string[] = []
  lines.push(`【本轮驾考答题结算】`)
  lines.push(`答对题数: ${correctCount} / ${total}`)
  lines.push(`本轮正确率: ${accuracy.toFixed(1)}%`)
  lines.push(
    `考核结果: ${passed ? '恭喜通关！' : `未达到 ${targetRatePercent.toFixed(0)}% 及格线，未通过！`}`
  )

  // 错题解析汇总（在最后统一公布正确答案与解析）
  const wrongs = session.answers.filter((a) => !a.isCorrect)
  if (wrongs.length > 0) {
    lines.push(`\n【错题回顾与官方解析】`)
    for (let i = 0; i < wrongs.length; i++) {
      const w = wrongs[i]
      lines.push(
        `---------------------\n` +
          `[错题 ${i + 1}] ${w.question.title}\n` +
          `你的作答: ${w.userAnswer}\n` +
          `正确答案: ${formatQuestionAnswer(w.question)}\n` +
          `官方解析: ${w.question.explain || '暂无解析内容'}`
      )
    }
  }

  try {
    const elements: any[] = []
    if (!session.isPrivate) {
      elements.push(h.at(session.userId), ' ')
    }
    elements.push(lines.join('\n'))
    await session.bot.sendMessage(session.channelId, elements)
  } catch (err) {
    logger.error('发送答题结算失败:', err)
  }

  // 触发后置回调
  try {
    await session.onFinish(session, passed)
  } catch (err) {
    logger.error('答题后置结算回调失败:', err)
  }
}

