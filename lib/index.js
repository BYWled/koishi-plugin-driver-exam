var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Config: () => Config,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(src_exports);
var import_koishi5 = require("koishi");

// src/database.ts
function applyDatabase(ctx) {
  ctx.model.extend(
    "driver_exam_question",
    {
      id: "string",
      rank: "unsigned",
      subjectType: "unsigned",
      questionType: "unsigned",
      title: "text",
      op1: "string",
      op2: "string",
      op3: "string",
      op4: "string",
      titlePic: "string",
      answer: "string",
      explain: "text",
      updatedAt: "timestamp"
    },
    {
      primary: "id"
    }
  );
  ctx.model.extend(
    "driver_exam_user",
    {
      id: "unsigned",
      guildId: "string",
      userId: "string",
      uid: "unsigned",
      inList: "boolean",
      exemptUntil: "timestamp",
      isMuted: "boolean",
      weekStreak: "unsigned",
      lastStreakWeek: "string",
      dailyPassCount: "unsigned",
      lastPassDate: "string"
    },
    {
      autoInc: true,
      unique: [["guildId", "userId"]]
    }
  );
  ctx.model.extend(
    "driver_exam_challenge",
    {
      id: "unsigned",
      guildId: "string",
      challengerUid: "unsigned",
      challengerUserId: "string",
      targetUid: "unsigned",
      targetUserId: "string",
      costCurrency: "double",
      banHours: "double",
      requiredRounds: "unsigned",
      passedRounds: "unsigned",
      bufferDeadline: "timestamp",
      banDeadline: "timestamp",
      status: "string",
      createdAt: "timestamp"
    },
    {
      autoInc: true
    }
  );
  ctx.model.extend(
    "driver_exam_history",
    {
      id: "unsigned",
      userId: "string",
      questionId: "string",
      createdAt: "timestamp"
    },
    {
      autoInc: true,
      unique: [["userId", "questionId"]]
    }
  );
}
__name(applyDatabase, "applyDatabase");

// src/scheduler.ts
var import_koishi = require("koishi");

// src/time.ts
function isActiveHour(date = /* @__PURE__ */ new Date(), startHour = 8, endHour = 24) {
  const h3 = date.getHours();
  return h3 >= startHour && h3 < endHour;
}
__name(isActiveHour, "isActiveHour");
function addActiveHours(baseTime, hoursToAdd, startHour = 8, endHour = 24) {
  if (hoursToAdd <= 0) return new Date(baseTime);
  let cur = new Date(baseTime);
  let msToAdd = Math.round(hoursToAdd * 3600 * 1e3);
  while (msToAdd > 0) {
    const h3 = cur.getHours();
    if (h3 < startHour) {
      cur.setHours(startHour, 0, 0, 0);
    } else if (h3 >= endHour) {
      cur.setDate(cur.getDate() + 1);
      cur.setHours(startHour, 0, 0, 0);
    }
    const endOfDay = new Date(cur);
    if (endHour === 24) {
      endOfDay.setDate(endOfDay.getDate() + 1);
      endOfDay.setHours(0, 0, 0, 0);
    } else {
      endOfDay.setHours(endHour, 0, 0, 0);
    }
    const availableMs = endOfDay.getTime() - cur.getTime();
    if (msToAdd <= availableMs) {
      cur = new Date(cur.getTime() + msToAdd);
      msToAdd = 0;
    } else {
      msToAdd -= availableMs;
      cur = new Date(endOfDay);
      cur.setHours(startHour, 0, 0, 0);
    }
  }
  return cur;
}
__name(addActiveHours, "addActiveHours");
function getMsUntilEndOfActiveDay(from = /* @__PURE__ */ new Date(), endHour = 24) {
  const end = new Date(from);
  if (endHour === 24) {
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
  } else {
    end.setHours(endHour, 0, 0, 0);
  }
  return Math.max(0, end.getTime() - from.getTime());
}
__name(getMsUntilEndOfActiveDay, "getMsUntilEndOfActiveDay");
function getNaturalWeekString(date = /* @__PURE__ */ new Date()) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + (4 - target.getDay() + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 6048e5);
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}
__name(getNaturalWeekString, "getNaturalWeekString");
function formatDateTime(date) {
  if (!date) return "无";
  const d = new Date(date);
  const pad = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
__name(formatDateTime, "formatDateTime");

// src/scheduler.ts
var logger = new import_koishi.Logger("driver-exam:scheduler");
function applyScheduler(ctx, config) {
  ctx.setInterval(async () => {
    try {
      await runSchedulerCheck(ctx, config);
    } catch (err) {
      logger.error("调度器巡检异常:", err);
    }
  }, 60 * 1e3);
}
__name(applyScheduler, "applyScheduler");
async function runSchedulerCheck(ctx, config) {
  const now = /* @__PURE__ */ new Date();
  const isDaytime = isActiveHour(now, config.activeStartHour, config.activeEndHour);
  const currentWeek = getNaturalWeekString(now);
  const todayStr = now.toISOString().slice(0, 10);
  const allUsers = await ctx.database.get("driver_exam_user", {});
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
      await ctx.database.set("driver_exam_user", { id: user.id }, patch);
    }
  }
  const pendingChallenges = await ctx.database.get("driver_exam_challenge", {
    status: "pending"
  });
  for (const ch of pendingChallenges) {
    if (now >= new Date(ch.bufferDeadline)) {
      if (ch.passedRounds >= ch.requiredRounds) {
        await ctx.database.set("driver_exam_challenge", { id: ch.id }, {
          status: "success"
        });
      } else {
        const banDeadline = addActiveHours(
          now,
          ch.banHours,
          config.activeStartHour,
          config.activeEndHour
        );
        await ctx.database.set("driver_exam_challenge", { id: ch.id }, {
          status: "active",
          banDeadline
        });
        logger.info(`挑战 [${ch.id}] 缓冲期已过，被挑战人 ${ch.targetUserId} 进入禁言生效期，截止 ${banDeadline.toLocaleString()}`);
      }
    }
  }
  const activeChallenges = await ctx.database.get("driver_exam_challenge", {
    status: "active"
  });
  for (const ch of activeChallenges) {
    if (now >= new Date(ch.banDeadline)) {
      await ctx.database.set("driver_exam_challenge", { id: ch.id }, {
        status: "failed"
      });
      logger.info(`挑战 [${ch.id}] 禁言惩罚期结束`);
    }
  }
  const bots = ctx.bots;
  for (const user of allUsers) {
    const bot = bots.find((b) => typeof b.muteGuildMember === "function") || bots[0];
    if (!bot) continue;
    const hasActiveChallenge = activeChallenges.some(
      (c) => c.guildId === user.guildId && c.targetUserId === user.userId && now < new Date(c.banDeadline)
    );
    const isExemptExpired = user.inList && now >= new Date(user.exemptUntil);
    const shouldBeMuted = isExemptExpired || hasActiveChallenge;
    if (!isDaytime) {
      if (user.isMuted) {
        try {
          await bot.muteGuildMember(user.guildId, user.userId, 0);
          logger.info(`[夜间解禁] 已为用户 ${user.userId} (群 ${user.guildId}) 解除夜间禁言`);
        } catch (err) {
          logger.warn(`夜间解除禁言失败: ${user.userId}`, err);
        }
        await ctx.database.set("driver_exam_user", { id: user.id }, { isMuted: false });
      }
    } else {
      if (shouldBeMuted && !user.isMuted) {
        const remainMs = getMsUntilEndOfActiveDay(now, config.activeEndHour);
        if (remainMs > 0) {
          try {
            await bot.muteGuildMember(user.guildId, user.userId, remainMs);
            logger.info(`[施加禁言] 已为用户 ${user.userId} (群 ${user.guildId}) 施加禁言 ${Math.round(remainMs / 1e3)} 秒`);
          } catch (err) {
            logger.warn(`施加禁言失败: ${user.userId}`, err);
          }
          await ctx.database.set("driver_exam_user", { id: user.id }, { isMuted: true });
        }
      } else if (!shouldBeMuted && user.isMuted) {
        try {
          await bot.muteGuildMember(user.guildId, user.userId, 0);
          logger.info(`[恢复发言] 已为用户 ${user.userId} (群 ${user.guildId}) 解除禁言`);
        } catch (err) {
          logger.warn(`解除禁言失败: ${user.userId}`, err);
        }
        await ctx.database.set("driver_exam_user", { id: user.id }, { isMuted: false });
      }
    }
  }
}
__name(runSchedulerCheck, "runSchedulerCheck");

// src/commands.ts
var import_koishi4 = require("koishi");

// src/session.ts
var import_koishi2 = require("koishi");
var logger2 = new import_koishi2.Logger("driver-exam:session");
var activeSessions = /* @__PURE__ */ new Map();
var EXIT_KEYWORDS = ["退出答题", "结束答题", "取消答题", "不答了", "quit", "exit", "退出"];
function isValidAnswerFormat(question, input) {
  const clean = input.trim().toUpperCase();
  if (!clean) return false;
  if (question.questionType === 1) {
    const valid = [
      "对",
      "错",
      "正确",
      "错误",
      "T",
      "F",
      "TRUE",
      "FALSE",
      "A",
      "B",
      "1",
      "2",
      "YES",
      "NO",
      "Y",
      "N"
    ];
    return valid.includes(clean);
  }
  if (question.questionType === 2) {
    if (/^(?:选)?[A-D][.、\s]?$/.test(clean)) return true;
    const matchPrefix = clean.match(/^([A-D])[.、\s]+(.+)$/);
    if (matchPrefix) {
      const letter = matchPrefix[1];
      const rest = matchPrefix[2].trim();
      let opText = "";
      if (letter === "A") opText = question.op1;
      else if (letter === "B") opText = question.op2;
      else if (letter === "C") opText = question.op3;
      else if (letter === "D") opText = question.op4;
      if (opText && rest === opText.trim().toUpperCase()) return true;
    }
    if (question.op1 && clean === question.op1.trim().toUpperCase()) return true;
    if (question.op2 && clean === question.op2.trim().toUpperCase()) return true;
    if (question.op3 && clean === question.op3.trim().toUpperCase()) return true;
    if (question.op4 && clean === question.op4.trim().toUpperCase()) return true;
    return false;
  }
  if (question.questionType === 3) {
    const pure = clean.replace(/^选/, "").trim();
    if (!/^[A-D\s,，、]+$/.test(pure)) return false;
    const matched = pure.match(/[A-D]/g);
    return Boolean(matched && matched.length >= 2);
  }
  return false;
}
__name(isValidAnswerFormat, "isValidAnswerFormat");
function checkUserAnswer(question, input) {
  const cleanInput = input.trim().toUpperCase();
  const cleanStandard = (question.answer || "").trim().toUpperCase();
  if (question.questionType === 1) {
    const isTrueStd = cleanStandard === "TRUE" || cleanStandard === "A" || cleanStandard === "正确";
    const trueInputs = ["对", "正确", "T", "TRUE", "A", "1", "YES", "Y"];
    const falseInputs = ["错", "错误", "F", "FALSE", "B", "2", "NO", "N"];
    if (trueInputs.includes(cleanInput)) return isTrueStd;
    if (falseInputs.includes(cleanInput)) return !isTrueStd;
    return false;
  }
  if (question.questionType === 2) {
    const singleMatch = cleanInput.match(/^(?:选)?([A-D])[.、\s]?$/);
    if (singleMatch) {
      return singleMatch[1] === cleanStandard;
    }
    const prefixMatch = cleanInput.match(/^([A-D])[.、\s]+(.+)$/);
    if (prefixMatch) {
      return prefixMatch[1] === cleanStandard;
    }
    if (question.op1 && cleanInput === question.op1.trim().toUpperCase()) return cleanStandard === "A";
    if (question.op2 && cleanInput === question.op2.trim().toUpperCase()) return cleanStandard === "B";
    if (question.op3 && cleanInput === question.op3.trim().toUpperCase()) return cleanStandard === "C";
    if (question.op4 && cleanInput === question.op4.trim().toUpperCase()) return cleanStandard === "D";
    return false;
  }
  if (question.questionType === 3) {
    const matched = cleanInput.match(/[A-D]/g);
    if (!matched) return false;
    const userSorted = Array.from(new Set(matched)).sort().join("");
    const stdSorted = Array.from(new Set(cleanStandard.match(/[A-D]/g) || [])).sort().join("");
    return userSorted === stdSorted;
  }
  return cleanInput === cleanStandard;
}
__name(checkUserAnswer, "checkUserAnswer");
async function recallSessionMessages(session) {
  if (!session.recallMessages || session.messageIdsToRecall.length === 0) return;
  const ids = [...session.messageIdsToRecall];
  session.messageIdsToRecall = [];
  for (const id of ids) {
    try {
      await session.bot.deleteMessage(session.channelId, id);
    } catch (_) {
    }
  }
}
__name(recallSessionMessages, "recallSessionMessages");
var imageCache = /* @__PURE__ */ new Map();
async function resolveQuestionImage(ctx, url) {
  if (!url) return null;
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }
  try {
    let buf;
    if (ctx.http) {
      const ab = await ctx.http.get(url, { responseType: "arraybuffer" });
      buf = Buffer.from(ab);
    } else {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      buf = Buffer.from(ab);
    }
    if (!buf || buf.length === 0) {
      return null;
    }
    if (ctx.puppeteer) {
      try {
        const page = await ctx.puppeteer.page();
        try {
          const base642 = buf.toString("base64");
          const dataUrl = `data:image/webp;base64,${base642}`;
          const pngDataUrl = await page.evaluate(async (src) => {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx2d = canvas.getContext("2d");
                ctx2d?.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
              };
              img.onerror = () => reject(new Error("Canvas image load failed"));
              img.src = src;
            });
          }, dataUrl);
          if (pngDataUrl && pngDataUrl.startsWith("data:image/png")) {
            imageCache.set(url, pngDataUrl);
            return pngDataUrl;
          }
        } finally {
          await page.close();
        }
      } catch (pErr) {
        logger2.warn(`Puppeteer 转码题目配图为 PNG 失败，降级为直发 base64:`, pErr);
      }
    }
    const base64 = buf.toString("base64");
    const fallbackDataUrl = `data:image/jpeg;base64,${base64}`;
    imageCache.set(url, fallbackDataUrl);
    return fallbackDataUrl;
  } catch (err) {
    logger2.warn(`拉取考题配图失败 [${url}]:`, err);
    return null;
  }
}
__name(resolveQuestionImage, "resolveQuestionImage");
async function sendCurrentQuestion(session) {
  if (session.currentIndex >= session.questions.length) {
    await finishSession(session);
    return;
  }
  const q = session.questions[session.currentIndex];
  const total = session.questions.length;
  const qNum = session.currentIndex + 1;
  let typeName = "【单选题】";
  if (q.questionType === 1) typeName = "【判断题】";
  else if (q.questionType === 3) typeName = "【多选题】";
  let resolvedImage = null;
  if (q.titlePic) {
    try {
      resolvedImage = await resolveQuestionImage(session.ctx, q.titlePic);
    } catch (_) {
    }
  }
  const buildElements = /* @__PURE__ */ __name((includePic) => {
    const elements = [];
    if (!session.isPrivate) {
      elements.push(import_koishi2.h.at(session.userId), " ");
    }
    const lines = [];
    lines.push(`[驾考答题 ${qNum}/${total}] ${typeName}
${q.title}`);
    if (q.questionType === 1) {
      lines.push(`A. 正确
B. 错误`);
    } else {
      if (q.op1) lines.push(`A. ${q.op1}`);
      if (q.op2) lines.push(`B. ${q.op2}`);
      if (q.op3) lines.push(`C. ${q.op3}`);
      if (q.op4) lines.push(`D. ${q.op4}`);
    }
    elements.push(lines.join("\n"));
    if (includePic) {
      const picSrc = resolvedImage || q.titlePic;
      if (picSrc) {
        elements.push(import_koishi2.h.image(picSrc));
      }
    }
    elements.push(`
请在 ${session.timeoutSeconds} 秒内作答（发送选项即可，发送“退出答题”可提前结束）`);
    return elements;
  }, "buildElements");
  const maxRetries = session.sendRetryCount ?? 2;
  let sentMsgIds = null;
  logger2.info(`准备发送题目 [${qNum}/${total}]: id=${q.id}, title=${q.title.slice(0, 20)}`);
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const tryWithPic = attempt === 0 && Boolean(q.titlePic);
      const elements = buildElements(tryWithPic);
      const res = await session.bot.sendMessage(session.channelId, elements);
      const ids = Array.isArray(res) ? res : [res].filter(Boolean);
      if (ids && ids.length > 0) {
        sentMsgIds = ids;
        break;
      }
    } catch (err) {
      logger2.warn(`第 ${attempt + 1} 次发送考题 [${qNum}/${total}] 失败:`, err);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1e3));
      }
    }
  }
  if (!sentMsgIds || sentMsgIds.length === 0) {
    logger2.warn(`考题 [${q.id}] (第 ${qNum} 题) 发送失败，准备更换题目或跳过该题...`);
    if (session.replaceQuestionOnSendFailure && session.fetchMoreQuestions) {
      try {
        const excludeIds = session.questions.map((item) => item.id);
        const newQ = await session.fetchMoreQuestions(excludeIds);
        if (newQ && !excludeIds.includes(newQ.id)) {
          logger2.info(`已成功获取替换考题: id=${newQ.id}, title=${newQ.title.slice(0, 20)}`);
          session.questions[session.currentIndex] = newQ;
          const notice = session.isPrivate ? `[系统提示] 原考题消息发送异常，已自动更换为新题目。` : [import_koishi2.h.at(session.userId), " [系统提示] 原考题消息发送异常，已自动更换为新题目。"];
          await session.bot.sendMessage(session.channelId, notice).catch(() => {
          });
          await sendCurrentQuestion(session);
          return;
        }
      } catch (err) {
        logger2.warn("尝试更换考题失败:", err);
      }
    }
    logger2.warn(`考题 [${q.id}] 发送失败且无法换题，执行跳过本题逻辑`);
    session.questions.splice(session.currentIndex, 1);
    const skipNotice = session.isPrivate ? `[系统提示] 题目发送异常，已自动跳过该题！` : [import_koishi2.h.at(session.userId), " [系统提示] 题目发送异常，已自动跳过该题！"];
    await session.bot.sendMessage(session.channelId, skipNotice).catch(() => {
    });
    if (session.questions.length === 0) {
      logger2.warn(`所有考题均发送失败，中止本次测评`);
      activeSessions.delete(session.key);
      return;
    }
    if (session.currentIndex >= session.questions.length) {
      await finishSession(session);
      return;
    }
    await sendCurrentQuestion(session);
    return;
  }
  session.messageIdsToRecall.push(...sentMsgIds);
  session.timer = setTimeout(async () => {
    logger2.info(`题目 [${qNum}/${total}] 超时未答，自动进入下一题`);
    session.answers.push({
      question: q,
      userAnswer: "超时未答",
      isCorrect: false,
      isTimeout: true
    });
    await recallSessionMessages(session);
    session.currentIndex++;
    await sendCurrentQuestion(session);
  }, session.timeoutSeconds * 1e3);
}
__name(sendCurrentQuestion, "sendCurrentQuestion");
async function handleUserAnswer(session, input, messageId) {
  logger2.info(`收到用户答题输入: input="${input}", currentIndex=${session.currentIndex}, messageId=${messageId}`);
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }
  if (messageId) {
    session.messageIdsToRecall.push(messageId);
  }
  const q = session.questions[session.currentIndex];
  const isCorrect = checkUserAnswer(q, input);
  logger2.info(`答案核对结果: user="${input}", standard="${q.answer}", isCorrect=${isCorrect}`);
  session.answers.push({
    question: q,
    userAnswer: input.trim(),
    isCorrect
  });
  await recallSessionMessages(session);
  session.currentIndex++;
  await sendCurrentQuestion(session);
  return true;
}
__name(handleUserAnswer, "handleUserAnswer");
async function abortSession(session) {
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }
  activeSessions.delete(session.key);
  await recallSessionMessages(session);
  try {
    const notice = session.isPrivate ? `已提前结束本次驾考答题。本轮测评已中止，不计入考核成绩。` : [import_koishi2.h.at(session.userId), " 已提前结束本次驾考答题。本轮测评已中止，不计入考核成绩。"];
    await session.bot.sendMessage(session.channelId, notice);
  } catch (_) {
  }
}
__name(abortSession, "abortSession");
function formatQuestionAnswer(q) {
  if (q.questionType === 1) {
    const isTrue = q.answer === "true" || q.answer === "A" || q.answer === "正确";
    return isTrue ? "A. 正确" : "B. 错误";
  }
  return q.answer || "暂无答案";
}
__name(formatQuestionAnswer, "formatQuestionAnswer");
async function finishSession(session) {
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }
  activeSessions.delete(session.key);
  await recallSessionMessages(session);
  const total = session.questions.length;
  const correctCount = session.answers.filter((a) => a.isCorrect).length;
  const accuracy = total > 0 ? correctCount / total * 100 : 0;
  const targetRatePercent = (session.passRate ?? 0.9) * 100;
  const passed = accuracy >= targetRatePercent - 1e-3;
  const lines = [];
  lines.push(`【本轮驾考答题结算】`);
  lines.push(`答对题数: ${correctCount} / ${total}`);
  lines.push(`本轮正确率: ${accuracy.toFixed(1)}%`);
  lines.push(
    `考核结果: ${passed ? "恭喜通关！" : `未达到 ${targetRatePercent.toFixed(0)}% 及格线，未通过！`}`
  );
  const wrongs = session.answers.filter((a) => !a.isCorrect);
  if (wrongs.length > 0) {
    lines.push(`
【错题回顾与官方解析】`);
    for (let i = 0; i < wrongs.length; i++) {
      const w = wrongs[i];
      lines.push(
        `---------------------
[错题 ${i + 1}] ${w.question.title}
你的作答: ${w.userAnswer}
正确答案: ${formatQuestionAnswer(w.question)}
官方解析: ${w.question.explain || "暂无解析内容"}`
      );
    }
  }
  try {
    const elements = [];
    if (!session.isPrivate) {
      elements.push(import_koishi2.h.at(session.userId), " ");
    }
    elements.push(lines.join("\n"));
    await session.bot.sendMessage(session.channelId, elements);
  } catch (err) {
    logger2.error("发送答题结算失败:", err);
  }
  try {
    await session.onFinish(session, passed);
  } catch (err) {
    logger2.error("答题后置结算回调失败:", err);
  }
}
__name(finishSession, "finishSession");

// src/api.ts
var import_koishi3 = require("koishi");
var logger3 = new import_koishi3.Logger("driver-exam:api");
var lastRequestTime = 0;
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
  } catch (err) {
    logger3.error(`请求失败 [${url}]:`, err);
    throw err;
  }
}
__name(throttledFetch, "throttledFetch");
async function fetchQuestionsApi(appId, appSecret, options = {}) {
  const page = options.page ?? 1;
  const rank = options.rank ?? 1;
  const subjectType = options.subjectType ?? 1;
  const questionType = options.questionType ?? 1;
  const url = `https://www.mxnzp.com/api/driver_exam/v2/question/list?page=${page}&rank=${rank}&subject_type=${subjectType}&question_type=${questionType}&app_id=${appId}&app_secret=${appSecret}`;
  const data = await throttledFetch(url);
  return data;
}
__name(fetchQuestionsApi, "fetchQuestionsApi");
async function fetchAnswersApi(appId, appSecret, ids) {
  if (ids.length === 0) return { code: 1, data: [] };
  const url = `https://www.mxnzp.com/api/driver_exam/v2/answer/list?ids=${ids.join(",")}&app_id=${appId}&app_secret=${appSecret}`;
  const data = await throttledFetch(url);
  return data;
}
__name(fetchAnswersApi, "fetchAnswersApi");
async function syncQuestionsBatch(ctx, appId, appSecret, options = {}) {
  try {
    const qRes = await fetchQuestionsApi(appId, appSecret, options);
    if (qRes.code !== 1 || !qRes.data || !qRes.data.list || qRes.data.list.length === 0) {
      logger3.warn(`获取题目列表失败或为空: ${JSON.stringify(qRes)}`);
      return 0;
    }
    const qList = qRes.data.list;
    const ids = qList.map((q) => q.id);
    const aRes = await fetchAnswersApi(appId, appSecret, ids);
    const answerMap = /* @__PURE__ */ new Map();
    if (aRes.code === 1 && Array.isArray(aRes.data)) {
      for (const item of aRes.data) {
        answerMap.set(item.id, {
          answer: item.answer ?? "",
          explain: item.explain ?? "无解析"
        });
      }
    }
    let savedCount = 0;
    const now = /* @__PURE__ */ new Date();
    for (const q of qList) {
      const aInfo = answerMap.get(q.id);
      if (!aInfo || !aInfo.answer) {
        continue;
      }
      let pic = q.titlePic || "";
      if (pic.startsWith("/")) {
        pic = `https://www.mxnzp.com${pic}`;
      }
      const record = {
        id: q.id,
        rank: q.rank || options.rank || 1,
        subjectType: q.subjectType || options.subjectType || 1,
        questionType: q.questionType || options.questionType || 1,
        title: q.title || "",
        op1: q.op1 || "",
        op2: q.op2 || "",
        op3: q.op3 || "",
        op4: q.op4 || "",
        titlePic: pic,
        answer: aInfo.answer,
        explain: aInfo.explain,
        updatedAt: now
      };
      await ctx.database.upsert("driver_exam_question", [record]);
      savedCount++;
    }
    logger3.info(`已成功同步并缓存 ${savedCount} 道考题到本地`);
    return savedCount;
  } catch (err) {
    logger3.error("同步题库失败:", err);
    return 0;
  }
}
__name(syncQuestionsBatch, "syncQuestionsBatch");
async function getExamQuestions(ctx, appId, appSecret, userId, count = 10, rank = 1, subjectType = 1, allowedTypes = [1, 2], excludeQuestionIds = []) {
  const history = await ctx.database.get("driver_exam_history", { userId }, ["questionId"]);
  const excludeSet = /* @__PURE__ */ new Set([...history.map((h3) => h3.questionId), ...excludeQuestionIds]);
  let candidates = await ctx.database.get("driver_exam_question", {
    rank,
    subjectType,
    questionType: allowedTypes
  });
  candidates = candidates.filter((q) => Boolean(q.answer) && !excludeQuestionIds.includes(q.id));
  let unused = candidates.filter((q) => !excludeSet.has(q.id));
  if (unused.length < count && appId && appSecret) {
    logger3.info(`用户 ${userId} 的未做题库仅剩 ${unused.length} 题，开始拉取新页面补充...`);
    const maxPages = subjectType === 1 ? 200 : 120;
    const pagesToFetch = [
      Math.floor(Math.random() * maxPages) + 1,
      Math.floor(Math.random() * maxPages) + 1
    ];
    for (const page of pagesToFetch) {
      for (const qType of allowedTypes) {
        await syncQuestionsBatch(ctx, appId, appSecret, {
          page,
          rank,
          subjectType,
          questionType: qType
        });
      }
    }
    candidates = await ctx.database.get("driver_exam_question", {
      rank,
      subjectType,
      questionType: allowedTypes
    });
    candidates = candidates.filter((q) => Boolean(q.answer) && !excludeQuestionIds.includes(q.id));
    unused = candidates.filter((q) => !excludeSet.has(q.id));
  }
  const pool = (unused.length >= count ? unused : candidates).filter(
    (q) => Boolean(q.answer) && !excludeQuestionIds.includes(q.id)
  );
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
__name(getExamQuestions, "getExamQuestions");

// src/commands.ts
var logger4 = new import_koishi4.Logger("driver-exam:commands");
async function getOrCreateUser(ctx, guildId, userId, uid, initialBufferHours, activeStartHour, activeEndHour) {
  let [record] = await ctx.database.get("driver_exam_user", { guildId, userId });
  if (!record) {
    const now = /* @__PURE__ */ new Date();
    const exemptUntil = addActiveHours(now, initialBufferHours, activeStartHour, activeEndHour);
    record = await ctx.database.create("driver_exam_user", {
      guildId,
      userId,
      uid,
      inList: false,
      exemptUntil,
      isMuted: false,
      weekStreak: 0,
      lastStreakWeek: getNaturalWeekString(now),
      dailyPassCount: 0,
      lastPassDate: now.toISOString().slice(0, 10)
    });
  }
  return record;
}
__name(getOrCreateUser, "getOrCreateUser");
function extractTargetUserId(raw, session) {
  const at = import_koishi4.h.select(session.elements, "at")[0];
  if (at?.attrs?.id) return String(at.attrs.id);
  if (!raw) return null;
  const m = raw.match(/id="?(\w+)"?/);
  if (m) return m[1];
  const clean = raw.replace(/[^0-9a-zA-Z_]/g, "");
  return clean || null;
}
__name(extractTargetUserId, "extractTargetUserId");
async function resolveUid(ctx, platform, pid) {
  try {
    const [binding] = await ctx.database.get("binding", { platform, pid });
    if (binding?.aid) return binding.aid;
    const user = await ctx.database.getUser(platform, pid, ["id"]);
    return user?.id || 0;
  } catch {
    return 0;
  }
}
__name(resolveUid, "resolveUid");
async function getCashBalance(ctx, uid, currency) {
  if (!uid) return 0;
  const records = await ctx.database.get("monetary", { uid, currency });
  return records && records.length > 0 ? Number(records[0].value || 0) : 0;
}
__name(getCashBalance, "getCashBalance");
async function costCash(ctx, uid, amount, currency) {
  if (ctx.monetary) {
    try {
      await ctx.monetary.cost(uid, amount, currency);
      return true;
    } catch {
      return false;
    }
  }
  const cur = await getCashBalance(ctx, uid, currency);
  if (cur < amount) return false;
  await ctx.database.set("monetary", { uid, currency }, { value: cur - amount });
  return true;
}
__name(costCash, "costCash");
async function gainCash(ctx, uid, amount, currency) {
  if (amount <= 0) return;
  if (ctx.monetary) {
    await ctx.monetary.gain(uid, amount, currency);
    return;
  }
  const cur = await getCashBalance(ctx, uid, currency);
  await ctx.database.set("monetary", { uid, currency }, { value: cur + amount });
}
__name(gainCash, "gainCash");
function registerCommands(ctx, config) {
  ctx.middleware(async (session, next) => {
    const isPrivate = !session.guildId;
    const key = isPrivate ? `private:${session.userId}` : `${session.guildId}:${session.userId}`;
    const exam = activeSessions.get(key);
    if (!exam) return next();
    if (!isPrivate && session.channelId !== exam.channelId) return next();
    const text = session.content?.trim();
    if (!text) return next();
    const cleanCmd = text.replace(/^[#/.!！]/, "").toLowerCase();
    if (EXIT_KEYWORDS.includes(cleanCmd)) {
      await abortSession(exam);
      return;
    }
    const currentQuestion = exam.questions[exam.currentIndex];
    if (!currentQuestion || !isValidAnswerFormat(currentQuestion, text)) {
      return next();
    }
    await handleUserAnswer(exam, text, session.messageId);
  }, true);
  ctx.command("驾考答题 [arg1:string] [arg2:string]", "开启一轮驾考题目测评").alias("考驾照").option("subject", "-s <subject:number> 指定科目 (1: 科一, 4: 科四)").option("rank", "-r <rank:number> 指定车型 (1:小车, 2:货车, 3:卡车, 4:摩托车)").userFields(["id"]).action(async ({ session, options }, arg1, arg2) => {
    const isPrivate = !session.guildId;
    const userId = session.userId;
    const uid = Number(session.user?.id) || 0;
    let chosenSubject = config.defaultSubjectType || 1;
    if (options?.subject === 4 || options?.subject === 2 || arg1 === "4" || arg1 === "科四" || arg2 === "4" || arg2 === "科四") {
      chosenSubject = 2;
    } else if (options?.subject === 1 || arg1 === "1" || arg1 === "科一" || arg2 === "1" || arg2 === "科一") {
      chosenSubject = 1;
    }
    let chosenRank = config.defaultRank || 1;
    if (options?.rank) {
      chosenRank = Number(options.rank);
    } else {
      const textArgs = `${arg1 || ""} ${arg2 || ""}`;
      if (textArgs.includes("摩托")) chosenRank = 4;
      else if (textArgs.includes("客车") || textArgs.includes("卡车")) chosenRank = 3;
      else if (textArgs.includes("货车")) chosenRank = 2;
      else if (textArgs.includes("小车") || textArgs.includes("c1") || textArgs.includes("C1")) chosenRank = 1;
    }
    let guildId = session.guildId || "";
    if (isPrivate) {
      const records = await ctx.database.get("driver_exam_user", { userId });
      if (records.length === 0) {
        guildId = "private";
      } else {
        const mutedRecord = records.find((r) => r.isMuted);
        guildId = mutedRecord ? mutedRecord.guildId : records[0].guildId;
      }
    }
    if (!isPrivate) {
      const existingSession = Array.from(activeSessions.values()).find(
        (s) => !s.isPrivate && s.channelId === session.channelId
      );
      if (existingSession) {
        if (existingSession.userId === userId) {
          return (0, import_koishi4.h)("message", [import_koishi4.h.at(userId), " 你当前已有正在进行的驾考测评，请继续作答！"]);
        } else {
          return (0, import_koishi4.h)("message", [
            import_koishi4.h.at(userId),
            " 当前群内已有用户 ",
            import_koishi4.h.at(existingSession.userId),
            " 正在进行驾考答题，请等待其答题结束，或私聊机器人进行答题！"
          ]);
        }
      }
    }
    const key = isPrivate ? `private:${userId}` : `${guildId}:${userId}`;
    if (activeSessions.has(key)) {
      return isPrivate ? "你当前已有正在进行的驾考测评，请继续作答！" : (0, import_koishi4.h)("message", [import_koishi4.h.at(userId), " 你当前已有正在进行的驾考测评，请继续作答！"]);
    }
    const questions = await getExamQuestions(
      ctx,
      config.appId,
      config.appSecret,
      userId,
      config.questionsPerRound,
      chosenRank,
      chosenSubject,
      config.allowedQuestionTypes || [1, 2]
    );
    if (questions.length === 0) {
      return isPrivate ? "题库暂时为空，正在尝试同步中，请稍后再试。" : (0, import_koishi4.h)("message", [import_koishi4.h.at(userId), " 题库暂时为空，正在尝试同步中，请稍后再试。"]);
    }
    const examSession = {
      key,
      ctx,
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
      passRate: config.passRate ?? 0.9,
      sendRetryCount: config.sendRetryCount ?? 2,
      replaceQuestionOnSendFailure: config.replaceQuestionOnSendFailure ?? true,
      fetchMoreQuestions: /* @__PURE__ */ __name(async (excludeIds) => {
        const currentIds = examSession?.questions ? examSession.questions.map((q) => q.id) : [];
        const allExcludes = Array.from(/* @__PURE__ */ new Set([...currentIds, ...excludeIds || []]));
        const more = await getExamQuestions(
          ctx,
          config.appId,
          config.appSecret,
          userId,
          1,
          chosenRank,
          chosenSubject,
          config.allowedQuestionTypes || [1, 2],
          allExcludes
        );
        return more[0] || null;
      }, "fetchMoreQuestions"),
      recallMessages: config.recallIntermediateMessages ?? true,
      messageIdsToRecall: [],
      onFinish: /* @__PURE__ */ __name(async (s, passed) => {
        await handleSessionFinished(ctx, config, s, passed);
      }, "onFinish")
    };
    activeSessions.set(key, examSession);
    const targetRateStr = `${Math.round((config.passRate ?? 0.9) * 100)}%`;
    const startMsg = isPrivate ? `[驾考答题] 正式开始！共 ${questions.length} 道题，正确率达到 ${targetRateStr} 及以上视为通关。祝你好运！` : (0, import_koishi4.h)("message", [
      import_koishi4.h.at(userId),
      ` [驾考答题] 正式开始！共 ${questions.length} 道题，正确率达到 ${targetRateStr} 及以上视为通关。祝你好运！`
    ]);
    await session.bot.sendMessage(session.channelId, startMsg);
    await sendCurrentQuestion(examSession);
  });
  ctx.command("驾考挑战 <target:string> <amount:number>", "消耗货币指定他人进行驾考禁言挑战").userFields(["id"]).action(async ({ session }, rawTarget, amount) => {
    if (!session.guildId) {
      return "驾考挑战只能在群聊中发起！";
    }
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      return "请输入有效的挑战货币数量，如：驾考挑战 @某人 100";
    }
    const targetUserId = extractTargetUserId(rawTarget, session);
    if (!targetUserId) {
      return "请指定被挑战人（可通过 @ 或输入对方ID）";
    }
    if (targetUserId === session.userId) {
      return "不能挑战自己！";
    }
    const challengerUid = Number(session.user?.id) || 0;
    const targetUid = await resolveUid(ctx, session.platform, targetUserId);
    const balance = await getCashBalance(ctx, challengerUid, config.currency);
    if (balance < amount) {
      return `余额不足！当前现金余额为 ${balance} ${config.currency}，发起本次挑战需要 ${amount} ${config.currency}。`;
    }
    const banHours = Number((amount / config.currencyPerHour).toFixed(2));
    if (banHours <= 0) {
      return `投入货币过少，不足以折算禁言时长（当前比例为 ${config.currencyPerHour} 货币/小时）`;
    }
    const targetRecord = await getOrCreateUser(
      ctx,
      session.guildId,
      targetUserId,
      targetUid,
      config.initialBufferHours,
      config.activeStartHour,
      config.activeEndHour
    );
    if (targetRecord.isMuted) {
      return "目标玩家当前已被禁言，不可对其发起挑战！";
    }
    const ongoingChallenges = await ctx.database.get("driver_exam_challenge", {
      guildId: session.guildId,
      targetUserId
    });
    const hasPendingOrActive = ongoingChallenges.some(
      (c) => c.status === "pending" || c.status === "active"
    );
    if (hasPendingOrActive) {
      return "目标玩家当前正在接受其他挑战中，不可同时叠加多重挑战！";
    }
    const now = /* @__PURE__ */ new Date();
    if (targetRecord.inList) {
      const requiredSafetyTime = addActiveHours(
        now,
        config.challengeBufferHours + banHours,
        config.activeStartHour,
        config.activeEndHour
      );
      if (new Date(targetRecord.exemptUntil) < requiredSafetyTime) {
        return `目标玩家当前所剩豁免时长不足（到期时间为 ${formatDateTime(targetRecord.exemptUntil)}），无法满足发起挑战所需的安全期要求！`;
      }
    }
    const costOk = await costCash(ctx, challengerUid, amount, config.currency);
    if (!costOk) {
      return "扣款失败，请重试！";
    }
    const requiredRounds = Math.max(1, Math.ceil(banHours / config.exemptHoursPerPass));
    const bufferDeadline = addActiveHours(
      now,
      config.challengeBufferHours,
      config.activeStartHour,
      config.activeEndHour
    );
    await ctx.database.create("driver_exam_challenge", {
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
      status: "pending",
      createdAt: now
    });
    const rewardRateStr = `${Math.round(config.challengeRewardRate * 100)}%`;
    const rewardAmount = (amount * config.challengeRewardRate).toFixed(1);
    return `【驾考挑战发起成功】
发起人: <at id="${session.userId}"/> 消耗了 ${amount} ${config.currency}
目标玩家: <at id="${targetUserId}"/>
折算禁言: ${banHours} 小时
需通关数: ${requiredRounds} 轮驾考（每轮通过顺延 ${config.exemptHoursPerPass} 小时）
缓冲期截止: ${formatDateTime(bufferDeadline)}（${config.challengeBufferHours}小时缓冲）
奖励提示: 若在缓冲期截止前全部答对通关，可夺得挑战奖励 ${rewardAmount} ${config.currency}（${rewardRateStr}）！
逾期未完成将开启群内禁言！`;
  });
  ctx.command("驾考状态", "查询个人的驾考保释与挑战状态").userFields(["id"]).action(async ({ session }) => {
    const guildId = session.guildId || "private";
    const userId = session.userId;
    const uid = Number(session.user?.id) || 0;
    const record = await getOrCreateUser(
      ctx,
      guildId,
      userId,
      uid,
      config.initialBufferHours,
      config.activeStartHour,
      config.activeEndHour
    );
    const challenges = await ctx.database.get("driver_exam_challenge", {
      guildId,
      targetUserId: userId
    });
    const activeCh = challenges.find((c) => c.status === "pending" || c.status === "active");
    const lines = [];
    lines.push(`【驾考状态报告 - ${userId}】`);
    lines.push(`监控名单: ${record.inList ? "是 (需按期刷题)" : "否 (自由参与)"}`);
    lines.push(`禁言状态: ${record.isMuted ? "禁言中 (可在私信答题保释)" : "正常发言"}`);
    lines.push(`豁免截止时间: ${formatDateTime(record.exemptUntil)}`);
    lines.push(`本周连胜进度: ${record.weekStreak} / ${config.weekStreakTarget} 轮`);
    const maxDaily = config.enableDailyRewardLimit ? config.dailyRewardLimitMode === "auto" ? Math.floor((config.activeEndHour - config.activeStartHour) / config.exemptHoursPerPass) : config.dailyRewardLimitCustom : "不限";
    lines.push(`今日自由挑战领奖: ${record.dailyPassCount} / ${maxDaily} 次`);
    if (activeCh) {
      lines.push(
        `
【正在进行的挑战】
状态: ${activeCh.status === "pending" ? `${config.challengeBufferHours}小时缓冲期中` : "挑战禁言惩罚中"}
已通关轮数: ${activeCh.passedRounds} / ${activeCh.requiredRounds}
缓冲期截止: ${formatDateTime(activeCh.bufferDeadline)}`
      );
    }
    return lines.join("\n");
  });
  ctx.command("驾考名单", "查看当前群受监控的名单列表", { authority: 3 }).action(async ({ session }) => {
    if (!session.guildId) return "请在群聊中使用此指令。";
    const list = await ctx.database.get("driver_exam_user", {
      guildId: session.guildId,
      inList: true
    });
    if (list.length === 0) return "当前群监控名单为空。";
    const lines = ["【驾考监控名单】"];
    for (const u of list) {
      lines.push(
        `- 用户 ${u.userId}: 豁免至 ${formatDateTime(u.exemptUntil)} | 状态: ${u.isMuted ? "禁言" : "正常"}`
      );
    }
    return lines.join("\n");
  });
  ctx.command("驾考添加 <target:string> [bufferHours:number]", "将用户加入监控名单", { authority: 3 }).action(async ({ session }, rawTarget, bufferHours) => {
    if (!session.guildId) return "请在群聊中使用此指令。";
    const targetUserId = extractTargetUserId(rawTarget, session);
    if (!targetUserId) return "请指定要添加的目标用户。";
    const hours = typeof bufferHours === "number" && bufferHours >= 0 ? bufferHours : config.initialBufferHours;
    const targetUid = await resolveUid(ctx, session.platform, targetUserId);
    const record = await getOrCreateUser(
      ctx,
      session.guildId,
      targetUserId,
      targetUid,
      hours,
      config.activeStartHour,
      config.activeEndHour
    );
    const exemptUntil = addActiveHours(/* @__PURE__ */ new Date(), hours, config.activeStartHour, config.activeEndHour);
    await ctx.database.set("driver_exam_user", { id: record.id }, {
      inList: true,
      exemptUntil
    });
    return `已将用户 ${targetUserId} 加入监控名单，赋予 ${hours} 小时初始缓冲期（截止至 ${formatDateTime(exemptUntil)}）`;
  });
  ctx.command("驾考移除 <target:string>", "将用户移出监控名单", { authority: 3 }).action(async ({ session }, rawTarget) => {
    if (!session.guildId) return "请在群聊中使用此指令。";
    const targetUserId = extractTargetUserId(rawTarget, session);
    if (!targetUserId) return "请指定要移除的目标用户。";
    const [record] = await ctx.database.get("driver_exam_user", {
      guildId: session.guildId,
      userId: targetUserId
    });
    if (!record || !record.inList) return `用户 ${targetUserId} 本就不在监控名单中。`;
    await ctx.database.set("driver_exam_user", { id: record.id }, {
      inList: false
    });
    if (record.isMuted) {
      try {
        await session.bot.muteGuildMember(session.guildId, targetUserId, 0);
        await ctx.database.set("driver_exam_user", { id: record.id }, { isMuted: false });
      } catch (_) {
      }
    }
    return `已将用户 ${targetUserId} 移出监控名单，并解除其禁言。`;
  });
  ctx.command("驾考同步 [page:number]", "手动批量同步远程题库并入库缓存", { authority: 3 }).action(async ({ session }, page) => {
    const p = page || 1;
    const count1 = await syncQuestionsBatch(ctx, config.appId, config.appSecret, { page: p, questionType: 1 });
    const count2 = await syncQuestionsBatch(ctx, config.appId, config.appSecret, { page: p, questionType: 2 });
    const total = await ctx.database.get("driver_exam_question", {});
    return `同步完成！本次同步新增/更新 ${count1 + count2} 题，本地题库现存 ${total.length} 题。`;
  });
  ctx.command("驾考题库", "查看题库统计与个人刷题进度").action(async ({ session }) => {
    const totalInDb = await ctx.database.get("driver_exam_question", {});
    const userHistory = await ctx.database.get("driver_exam_history", {
      userId: session.userId
    });
    const rankNames = {
      1: "小车 (C1/C2/C3)",
      2: "货车 (A2/B2)",
      3: "客车/卡车 (A1/A3/B1)",
      4: "摩托车 (D/E/F)"
    };
    const lines = [
      "【驾考题库与刷题进度统计】",
      `本地已缓存题量: ${totalInDb.length} 题`,
      `你已完成作答: ${userHistory.length} 题（答题时优先为你抽取未做过的题目）`,
      `当前默认配置: ${rankNames[config.defaultRank] || "小车"} - 科目${config.defaultSubjectType === 1 ? "一" : "四"}`,
      "",
      "【官方 API 题库总体量统计】",
      "• 小车 (C1/C2/C3): 科一 4331 题 | 科四 3094 题 (共 7425 题)",
      "• 货车 (A2/B2): 科一 4297 题 | 科四 3055 题 (共 7352 题)",
      "• 卡车/客车 (A1/A3/B1): 科一 4297 题 | 科四 3055 题 (共 7352 题)",
      "• 摩托车 (D/E/F): 科一 549 题 | 科四 148 题 (共 697 题)",
      "（出题时若本地未做题目不足，插件会自动从数千道云端题库中随机抓取新页面）"
    ];
    return lines.join("\n");
  });
}
__name(registerCommands, "registerCommands");
async function sendResultNotice(session, text) {
  try {
    if (session.isPrivate) {
      await session.bot.sendMessage(session.channelId, text);
    } else {
      await session.bot.sendMessage(session.channelId, [import_koishi4.h.at(session.userId), " ", text]);
    }
  } catch (err) {
    logger4.error("发送结果通知失败:", err);
  }
}
__name(sendResultNotice, "sendResultNotice");
async function handleSessionFinished(ctx, config, session, passed) {
  const user = await getOrCreateUser(
    ctx,
    session.guildId,
    session.userId,
    session.uid,
    config.initialBufferHours,
    config.activeStartHour,
    config.activeEndHour
  );
  const now = /* @__PURE__ */ new Date();
  try {
    const historyRecords = session.questions.map((q) => ({
      userId: session.userId,
      questionId: q.id,
      createdAt: now
    }));
    await ctx.database.upsert("driver_exam_history", historyRecords);
  } catch (err) {
    logger4.warn("记录用户做题历史失败:", err);
  }
  const passRateStr = `${Math.round((config.passRate ?? 0.9) * 100)}%`;
  const challenges = await ctx.database.get("driver_exam_challenge", {
    guildId: session.guildId,
    targetUserId: session.userId
  });
  const ch = challenges.find((c) => c.status === "pending" || c.status === "active");
  if (ch) {
    if (passed) {
      ch.passedRounds++;
      if (ch.passedRounds >= ch.requiredRounds) {
        if (ch.status === "pending") {
          ch.status = "success";
          const rewardAmount = ch.costCurrency * config.challengeRewardRate;
          await gainCash(ctx, session.uid, rewardAmount, config.currency);
          const rewardRateStr = `${Math.round(config.challengeRewardRate * 100)}%`;
          await sendResultNotice(
            session,
            `[驾考挑战] 挑战成功化解！你在生效前完成了全部 ${ch.requiredRounds} 轮考核，荣获挑战奖励 ${rewardAmount.toFixed(1)} ${config.currency}（${rewardRateStr}）！`
          );
        } else {
          ch.status = "failed";
          try {
            await session.bot.muteGuildMember(session.guildId, session.userId, 0);
          } catch (_) {
          }
          await sendResultNotice(
            session,
            `[驾考挑战] 恭喜！你已完成挑战所需的所有 ${ch.requiredRounds} 轮试题，已立即为你解除挑战禁言！`
          );
        }
      } else {
        await sendResultNotice(
          session,
          `[驾考挑战] 进度更新: [${ch.passedRounds}/${ch.requiredRounds}] 轮。请继续答题解围！`
        );
      }
      const { id: chId, ...chUpdateData } = ch;
      await ctx.database.set("driver_exam_challenge", { id: ch.id }, chUpdateData);
    } else {
      await sendResultNotice(
        session,
        `[驾考挑战] 本轮未达到 ${passRateStr} 正确率，不计入挑战通关进度。当前进度: [${ch.passedRounds}/${ch.requiredRounds}] 轮。`
      );
    }
    return;
  }
  if (user.inList) {
    if (user.isMuted) {
      if (passed) {
        try {
          await session.bot.muteGuildMember(session.guildId, session.userId, 0);
        } catch (_) {
        }
        user.isMuted = false;
        user.exemptUntil = addActiveHours(
          now,
          config.mutedPassExemptHours,
          config.activeStartHour,
          config.activeEndHour
        );
        user.weekStreak++;
        let streakNotice = `
本周连续通关: ${user.weekStreak} / ${config.weekStreakTarget} 轮`;
        if (user.weekStreak >= config.weekStreakTarget) {
          const streakHours = config.weekStreakRewardDays * (config.activeEndHour - config.activeStartHour);
          user.exemptUntil = addActiveHours(
            user.exemptUntil,
            streakHours,
            config.activeStartHour,
            config.activeEndHour
          );
          user.weekStreak = 0;
          streakNotice = `
达成自然周 ${config.weekStreakTarget} 连胜！额外获得 ${config.weekStreakRewardDays} 天 (${streakHours} 小时) 免禁顺延！`;
        }
        await sendResultNotice(
          session,
          `[私信答题通关] 已为你解除群内禁言，豁免期基于当前时间后延 ${config.mutedPassExemptHours} 小时，有效至: ${formatDateTime(user.exemptUntil)}！${streakNotice}`
        );
      } else {
        user.weekStreak = 0;
        await sendResultNotice(
          session,
          `本轮未达到 ${passRateStr} 及格线，解禁失败，本周连胜已清零。请重新私信“驾考答题”！`
        );
      }
    } else {
      if (passed) {
        const base = new Date(user.exemptUntil) > now ? new Date(user.exemptUntil) : now;
        user.exemptUntil = addActiveHours(
          base,
          config.exemptHoursPerPass,
          config.activeStartHour,
          config.activeEndHour
        );
        user.weekStreak++;
        let streakNotice = `
本周连续通关: ${user.weekStreak} / ${config.weekStreakTarget} 轮`;
        if (user.weekStreak >= config.weekStreakTarget) {
          const streakHours = config.weekStreakRewardDays * (config.activeEndHour - config.activeStartHour);
          user.exemptUntil = addActiveHours(
            user.exemptUntil,
            streakHours,
            config.activeStartHour,
            config.activeEndHour
          );
          user.weekStreak = 0;
          streakNotice = `
达成自然周 ${config.weekStreakTarget} 连胜！额外获得 ${config.weekStreakRewardDays} 天 (${streakHours} 小时) 免禁顺延！`;
        }
        await sendResultNotice(
          session,
          `[通关成功] 开始禁言时间已向后顺延 ${config.exemptHoursPerPass} 小时，最新豁免截止时刻为: ${formatDateTime(user.exemptUntil)}！${streakNotice}`
        );
      } else {
        user.weekStreak = 0;
        await sendResultNotice(
          session,
          `本轮考核未及格，未能获得时间顺延，本周连胜已打断重置。`
        );
      }
    }
    const { id: uId2, ...userUpdateData2 } = user;
    await ctx.database.set("driver_exam_user", { id: user.id }, userUpdateData2);
    return;
  }
  if (passed) {
    const maxDaily = config.enableDailyRewardLimit ? config.dailyRewardLimitMode === "auto" ? Math.floor((config.activeEndHour - config.activeStartHour) / config.exemptHoursPerPass) : config.dailyRewardLimitCustom : Infinity;
    const unitReward = Number(
      (config.currencyPerHour * config.challengeRewardRate).toFixed(1)
    );
    if (user.dailyPassCount < maxDaily) {
      user.dailyPassCount++;
      await gainCash(ctx, session.uid, unitReward, config.currency);
      await sendResultNotice(
        session,
        `[自由挑战通关] 奖励 ${unitReward} ${config.currency}！今日领奖进度: [${user.dailyPassCount}/${maxDaily}]`
      );
    } else {
      await sendResultNotice(
        session,
        `[自由挑战通关] 今日答题领奖次数已达上限 (${maxDaily}次)，本次无货币奖励。`
      );
    }
  } else {
    await sendResultNotice(
      session,
      `自由挑战未达到 ${passRateStr} 正确率，失败无任何惩罚。欢迎随时再次挑战！`
    );
  }
  const { id: uId, ...userUpdateData } = user;
  await ctx.database.set("driver_exam_user", { id: user.id }, userUpdateData);
}
__name(handleSessionFinished, "handleSessionFinished");

// src/index.ts
var name = "driver-exam";
var inject = {
  required: ["database"],
  optional: ["monetary", "puppeteer"]
};
var logger5 = new import_koishi5.Logger("driver-exam");
var Config = import_koishi5.Schema.intersect([
  import_koishi5.Schema.object({
    appId: import_koishi5.Schema.string().default("").description("MXNZP API 的 APP_ID（阿童穆开放平台）"),
    appSecret: import_koishi5.Schema.string().role("secret").default("").description("MXNZP API 的 APP_SECRET")
  }).description("API 接口设置"),
  import_koishi5.Schema.object({
    currency: import_koishi5.Schema.string().default("coin").description("关联的 monetary 货币标识"),
    currencyPerHour: import_koishi5.Schema.number().min(1).default(100).description("挑战中折算 1 小时禁言所需的货币数量"),
    challengeBufferHours: import_koishi5.Schema.number().min(0.5).default(1).description("挑战生效前的缓冲时长（小时），在此期间被挑战人答题可解围"),
    challengeRewardRate: import_koishi5.Schema.number().min(0).max(1).default(0.5).description("被挑战人在生效前化解挑战时获得的奖励比例（默认 0.5 即 50%）")
  }).description("Monetary 货币挑战设置"),
  import_koishi5.Schema.object({
    activeStartHour: import_koishi5.Schema.number().min(0).max(23).default(8).description("每日禁言生效起始时间点（默认 8 即 08:00）"),
    activeEndHour: import_koishi5.Schema.number().min(1).max(24).default(24).description("每日禁言生效截止时间点（默认 24 即 24:00，夜间 00:00~08:00 全员不禁言）"),
    initialBufferHours: import_koishi5.Schema.number().min(0).default(2).description("新加入监控名单成员时的初始豁免缓冲时长（小时）")
  }).description("禁言时间段设置"),
  import_koishi5.Schema.object({
    defaultRank: import_koishi5.Schema.union([
      import_koishi5.Schema.const(1).description("小车 (C1/C2/C3)"),
      import_koishi5.Schema.const(2).description("货车 (A2/B2)"),
      import_koishi5.Schema.const(3).description("卡车/客车 (A1/A3/B1)"),
      import_koishi5.Schema.const(4).description("摩托车 (D/E/F)")
    ]).default(1).description("默认考核车型等级"),
    defaultSubjectType: import_koishi5.Schema.union([
      import_koishi5.Schema.const(1).description("科目一"),
      import_koishi5.Schema.const(2).description("科目四")
    ]).default(1).description("默认考核科目"),
    allowedQuestionTypes: import_koishi5.Schema.array(import_koishi5.Schema.number()).default([1, 2]).description("默认出题题型（1:判断, 2:单选, 3:多选）"),
    questionsPerRound: import_koishi5.Schema.number().min(1).max(50).default(10).description("每轮测评考核的题目数量"),
    passRate: import_koishi5.Schema.number().min(0.5).max(1).default(0.9).description("通关及格正确率标准（默认 0.9 即 90%）"),
    exemptHoursPerPass: import_koishi5.Schema.number().min(0.5).default(2).description("未被禁言状态下通关一轮顺延的解禁时长（小时）"),
    mutedPassExemptHours: import_koishi5.Schema.number().min(0.5).default(1).description("已被禁言状态下私信通关一轮顺延的解禁时长（小时）"),
    questionTimeout: import_koishi5.Schema.number().min(10).max(180).default(45).description("单道考题超时时间（秒）"),
    recallIntermediateMessages: import_koishi5.Schema.boolean().default(true).description("答题过程中自动撤回试题与作答消息，保持聊天界面整洁（需机器人具有撤回权限）"),
    sendRetryCount: import_koishi5.Schema.number().min(0).max(5).default(2).description("考题消息发送失败时的重试次数（如遇协议端图片拉取失败将自动降级并重试）"),
    replaceQuestionOnSendFailure: import_koishi5.Schema.boolean().default(true).description("考题消息重试发送仍失败时，是否自动从题库更换新题目，避免误判超时")
  }).description("答题与惩罚顺延设置"),
  import_koishi5.Schema.object({
    weekStreakTarget: import_koishi5.Schema.number().min(2).default(10).description("自然周连续通关奖励所需达成的轮数（默认 10 轮）"),
    weekStreakRewardDays: import_koishi5.Schema.number().min(1).default(3).description("达成连胜目标时额外奖励的免禁天数（默认 3 天有效时段）"),
    enableDailyRewardLimit: import_koishi5.Schema.boolean().default(true).description("是否限制自由答题玩家每日领奖次数上限"),
    dailyRewardLimitMode: import_koishi5.Schema.union([
      import_koishi5.Schema.const("auto").description("自动计算（每天禁言总时段 / 每轮顺延时长）"),
      import_koishi5.Schema.const("custom").description("自定义次数")
    ]).default("auto").description("每日领奖限制模式"),
    dailyRewardLimitCustom: import_koishi5.Schema.number().min(1).default(8).description("自定义模式下每日自由挑战领奖次数上限")
  }).description("连胜与防刷币设置"),
  import_koishi5.Schema.object({
    monitoredList: import_koishi5.Schema.array(
      import_koishi5.Schema.object({
        guildId: import_koishi5.Schema.string().required().description("群组 ID"),
        userId: import_koishi5.Schema.string().required().description("平台用户 ID (QQ号)")
      })
    ).default([]).description("初始监控黑名单（按群号+用户ID绑定）")
  }).description("名单配置")
]);
function apply(ctx, config) {
  applyDatabase(ctx);
  ctx.on("ready", async () => {
    logger5.info("驾考答题与 Monetary 联动插件已启动");
    if (config.monitoredList && config.monitoredList.length > 0) {
      for (const item of config.monitoredList) {
        if (!item.guildId || !item.userId) continue;
        const user = await getOrCreateUser(
          ctx,
          item.guildId,
          item.userId,
          0,
          config.initialBufferHours,
          config.activeStartHour,
          config.activeEndHour
        );
        if (!user.inList) {
          await ctx.database.set("driver_exam_user", { id: user.id }, { inList: true });
        }
      }
    }
    try {
      await ctx.database.remove("driver_exam_question", { answer: "" });
    } catch (_) {
    }
    try {
      const questions = await ctx.database.get("driver_exam_question", {});
      if (questions.length < 30 && config.appId && config.appSecret) {
        logger5.info(`本地有效题库现有 ${questions.length} 题，开始后台自充实...`);
        await syncQuestionsBatch(ctx, config.appId, config.appSecret, { page: 1, questionType: 1 });
        await syncQuestionsBatch(ctx, config.appId, config.appSecret, { page: 1, questionType: 2 });
      }
    } catch (err) {
      logger5.warn("自充实本地题库失败:", err);
    }
  });
  applyScheduler(ctx, config);
  registerCommands(ctx, config);
}
__name(apply, "apply");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Config,
  apply,
  inject,
  name
});
