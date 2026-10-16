export function applyDatabase(ctx) {
    ctx.model.extend('driver_exam_question', {
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
    }, {
        primary: 'id',
    });
    ctx.model.extend('driver_exam_user', {
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
    }, {
        autoInc: true,
        unique: [['guildId', 'userId']],
    });
    ctx.model.extend('driver_exam_challenge', {
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
    }, {
        autoInc: true,
    });
}
