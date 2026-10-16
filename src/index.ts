import { Context, Schema, Logger } from 'koishi'
import {} from 'koishi-plugin-monetary'
import {} from 'koishi-plugin-puppeteer'
import { applyDatabase } from './database'
import { applyScheduler } from './scheduler'
import { registerCommands, getOrCreateUser } from './commands'
import { syncQuestionsBatch } from './api'

export const name = 'driver-exam'

export const inject = {
  required: ['database'],
  optional: ['monetary', 'puppeteer'],
}

const logger = new Logger('driver-exam')

export interface MonitoredTarget {
  guildId: string
  userId: string
}

export interface Config {
  // API 设置
  appId: string
  appSecret: string
  // 货币与挑战
  currency: string
  currencyPerHour: number
  challengeBufferHours: number
  challengeRewardRate: number
  // 禁言与时间时段
  activeStartHour: number
  activeEndHour: number
  initialBufferHours: number
  // 答题与顺延规则
  defaultRank: number
  defaultSubjectType: number
  allowedQuestionTypes: number[]
  questionsPerRound: number
  passRate: number
  exemptHoursPerPass: number
  mutedPassExemptHours: number
  questionTimeout: number
  recallIntermediateMessages: boolean
  // 连胜与限制
  weekStreakTarget: number
  weekStreakRewardDays: number
  enableDailyRewardLimit: boolean
  dailyRewardLimitMode: 'auto' | 'custom'
  dailyRewardLimitCustom: number
  // 监控名单
  monitoredList: MonitoredTarget[]
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    appId: Schema.string()
      .default('')
      .description('MXNZP API 的 APP_ID（阿童穆开放平台）'),
    appSecret: Schema.string()
      .role('secret')
      .default('')
      .description('MXNZP API 的 APP_SECRET'),
  }).description('API 接口设置'),

  Schema.object({
    currency: Schema.string().default('coin').description('关联的 monetary 货币标识'),
    currencyPerHour: Schema.number()
      .min(1)
      .default(100)
      .description('挑战中折算 1 小时禁言所需的货币数量'),
    challengeBufferHours: Schema.number()
      .min(0.5)
      .default(1)
      .description('挑战生效前的缓冲时长（小时），在此期间被挑战人答题可解围'),
    challengeRewardRate: Schema.number()
      .min(0)
      .max(1)
      .default(0.5)
      .description('被挑战人在生效前化解挑战时获得的奖励比例（默认 0.5 即 50%）'),
  }).description('Monetary 货币挑战设置'),

  Schema.object({
    activeStartHour: Schema.number()
      .min(0)
      .max(23)
      .default(8)
      .description('每日禁言生效起始时间点（默认 8 即 08:00）'),
    activeEndHour: Schema.number()
      .min(1)
      .max(24)
      .default(24)
      .description('每日禁言生效截止时间点（默认 24 即 24:00，夜间 00:00~08:00 全员不禁言）'),
    initialBufferHours: Schema.number()
      .min(0)
      .default(2)
      .description('新加入监控名单成员时的初始豁免缓冲时长（小时）'),
  }).description('禁言时间段设置'),

  Schema.object({
    defaultRank: Schema.union([
      Schema.const(1).description('小车 (C1/C2/C3)'),
      Schema.const(2).description('货车 (A2/B2)'),
      Schema.const(3).description('卡车/客车 (A1/A3/B1)'),
      Schema.const(4).description('摩托车 (D/E/F)'),
    ])
      .default(1)
      .description('默认考核车型等级'),
    defaultSubjectType: Schema.union([
      Schema.const(1).description('科目一'),
      Schema.const(2).description('科目四'),
    ])
      .default(1)
      .description('默认考核科目'),
    allowedQuestionTypes: Schema.array(Schema.number())
      .default([1, 2])
      .description('默认出题题型（1:判断, 2:单选, 3:多选）'),
    questionsPerRound: Schema.number()
      .min(1)
      .max(50)
      .default(10)
      .description('每轮测评考核的题目数量'),
    passRate: Schema.number()
      .min(0.5)
      .max(1)
      .default(0.9)
      .description('通关及格正确率标准（默认 0.9 即 90%）'),
    exemptHoursPerPass: Schema.number()
      .min(0.5)
      .default(2)
      .description('未被禁言状态下通关一轮顺延的解禁时长（小时）'),
    mutedPassExemptHours: Schema.number()
      .min(0.5)
      .default(1)
      .description('已被禁言状态下私信通关一轮顺延的解禁时长（小时）'),
    questionTimeout: Schema.number()
      .min(10)
      .max(180)
      .default(45)
      .description('单道考题超时时间（秒）'),
    recallIntermediateMessages: Schema.boolean()
      .default(true)
      .description('答题过程中自动撤回试题与作答消息，保持聊天界面整洁（需机器人具有撤回权限）'),
    sendRetryCount: Schema.number()
      .min(0)
      .max(5)
      .default(2)
      .description('考题消息发送失败时的重试次数（如遇协议端图片拉取失败将自动降级并重试）'),
    replaceQuestionOnSendFailure: Schema.boolean()
      .default(true)
      .description('考题消息重试发送仍失败时，是否自动从题库更换新题目，避免误判超时'),
  }).description('答题与惩罚顺延设置'),

  Schema.object({
    weekStreakTarget: Schema.number()
      .min(2)
      .default(10)
      .description('自然周连续通关奖励所需达成的轮数（默认 10 轮）'),
    weekStreakRewardDays: Schema.number()
      .min(1)
      .default(3)
      .description('达成连胜目标时额外奖励的免禁天数（默认 3 天有效时段）'),
    enableDailyRewardLimit: Schema.boolean()
      .default(true)
      .description('是否限制自由答题玩家每日领奖次数上限'),
    dailyRewardLimitMode: Schema.union([
      Schema.const('auto').description('自动计算（每天禁言总时段 / 每轮顺延时长）'),
      Schema.const('custom').description('自定义次数'),
    ]).default('auto').description('每日领奖限制模式'),
    dailyRewardLimitCustom: Schema.number()
      .min(1)
      .default(8)
      .description('自定义模式下每日自由挑战领奖次数上限'),
  }).description('连胜与防刷币设置'),

  Schema.object({
    monitoredList: Schema.array(
      Schema.object({
        guildId: Schema.string().required().description('群组 ID'),
        userId: Schema.string().required().description('平台用户 ID (QQ号)'),
      })
    )
      .default([])
      .description('初始监控黑名单（按群号+用户ID绑定）'),
  }).description('名单配置'),
])

export function apply(ctx: Context, config: Config) {
  // 1. 初始化数据库表结构
  applyDatabase(ctx)

  // 2. 启动事件监听：同步初始名单并在后台预热缓存题库
  ctx.on('ready', async () => {
    logger.info('驾考答题与 Monetary 联动插件已启动')

    // 同步配置中的静态名单到数据库
    if (config.monitoredList && config.monitoredList.length > 0) {
      for (const item of config.monitoredList) {
        if (!item.guildId || !item.userId) continue
        const user = await getOrCreateUser(
          ctx,
          item.guildId,
          item.userId,
          0,
          config.initialBufferHours,
          config.activeStartHour,
          config.activeEndHour
        )
        if (!user.inList) {
          await ctx.database.set('driver_exam_user', { id: user.id }, { inList: true })
        }
      }
    }

    // 清理早期可能因接口限制导致的无答案脏数据
    try {
      await ctx.database.remove('driver_exam_question', { answer: '' })
    } catch (_) {}

    // 检查本地题库数量，如果少于 30 题，后台自动异步预热同步两批题库
    try {
      const questions = await ctx.database.get('driver_exam_question', {})
      if (questions.length < 30 && config.appId && config.appSecret) {
        logger.info(`本地有效题库现有 ${questions.length} 题，开始后台自充实...`)
        await syncQuestionsBatch(ctx, config.appId, config.appSecret, { page: 1, questionType: 1 })
        await syncQuestionsBatch(ctx, config.appId, config.appSecret, { page: 1, questionType: 2 })
      }
    } catch (err) {
      logger.warn('自充实本地题库失败:', err)
    }
  })

  // 3. 注册定时生命周期巡检
  applyScheduler(ctx, config)

  // 4. 注册核心交互中间件与指令
  registerCommands(ctx, config)
}
