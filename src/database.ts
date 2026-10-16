import { Context } from 'koishi'

export interface DriverExamQuestion {
  id: string
  rank: number
  subjectType: number
  questionType: number
  title: string
  op1: string
  op2: string
  op3: string
  op4: string
  titlePic: string
  answer: string
  explain: string
  updatedAt: Date
}

export interface DriverExamUser {
  id: number
  guildId: string
  userId: string
  uid: number
  inList: boolean
  exemptUntil: Date
  isMuted: boolean
  weekStreak: number
  lastStreakWeek: string
  dailyPassCount: number
  lastPassDate: string
}

export interface DriverExamChallenge {
  id: number
  guildId: string
  challengerUid: number
  challengerUserId: string
  targetUid: number
  targetUserId: string
  costCurrency: number
  banHours: number
  requiredRounds: number
  passedRounds: number
  bufferDeadline: Date
  banDeadline: Date
  status: 'pending' | 'active' | 'success' | 'failed'
  createdAt: Date
}

export interface DriverExamHistory {
  id: number
  userId: string
  questionId: string
  createdAt: Date
}

declare module 'koishi' {
  interface Tables {
    driver_exam_question: DriverExamQuestion
    driver_exam_user: DriverExamUser
    driver_exam_challenge: DriverExamChallenge
    driver_exam_history: DriverExamHistory
  }
}

export function applyDatabase(ctx: Context) {
  ctx.model.extend(
    'driver_exam_question',
    {
      id: 'string',
      rank: 'unsigned',
      subjectType: 'unsigned',
      questionType: 'unsigned',
      title: 'text',
      op1: 'string',
      op2: 'string',
      op3: 'string',
      op4: 'string',
      titlePic: 'string',
      answer: 'string',
      explain: 'text',
      updatedAt: 'timestamp',
    },
    {
      primary: 'id',
    }
  )

  ctx.model.extend(
    'driver_exam_user',
    {
      id: 'unsigned',
      guildId: 'string',
      userId: 'string',
      uid: 'unsigned',
      inList: 'boolean',
      exemptUntil: 'timestamp',
      isMuted: 'boolean',
      weekStreak: 'unsigned',
      lastStreakWeek: 'string',
      dailyPassCount: 'unsigned',
      lastPassDate: 'string',
    },
    {
      autoInc: true,
      unique: [['guildId', 'userId']],
    }
  )

  ctx.model.extend(
    'driver_exam_challenge',
    {
      id: 'unsigned',
      guildId: 'string',
      challengerUid: 'unsigned',
      challengerUserId: 'string',
      targetUid: 'unsigned',
      targetUserId: 'string',
      costCurrency: 'double',
      banHours: 'double',
      requiredRounds: 'unsigned',
      passedRounds: 'unsigned',
      bufferDeadline: 'timestamp',
      banDeadline: 'timestamp',
      status: 'string',
      createdAt: 'timestamp',
    },
    {
      autoInc: true,
    }
  )

  ctx.model.extend(
    'driver_exam_history',
    {
      id: 'unsigned',
      userId: 'string',
      questionId: 'string',
      createdAt: 'timestamp',
    },
    {
      autoInc: true,
      unique: [['userId', 'questionId']],
    }
  )
}
