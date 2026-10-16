/**
 * 跨日时间与有效惩罚时段计算器
 */

/**
 * 判断当前时刻是否在有效禁言时段内（默认 08:00 - 24:00）
 */
export function isActiveHour(date: Date = new Date(), startHour = 8, endHour = 24): boolean {
  const h = date.getHours()
  return h >= startHour && h < endHour
}

/**
 * 在基准时间上累加“有效禁言小时数”，自动跳过夜间免禁时段（如 00:00~08:00）
 * @param baseTime 基准时间
 * @param hoursToAdd 需要累加的小时数
 * @param startHour 每日开始禁言时间（默认 8）
 * @param endHour 每日结束禁言时间（默认 24）
 */
export function addActiveHours(
  baseTime: Date,
  hoursToAdd: number,
  startHour = 8,
  endHour = 24
): Date {
  if (hoursToAdd <= 0) return new Date(baseTime)

  let cur = new Date(baseTime)
  let msToAdd = Math.round(hoursToAdd * 3600 * 1000)

  while (msToAdd > 0) {
    const h = cur.getHours()

    // 若当前处于夜间时段 [0, startHour)，对齐至当天 startHour:00
    if (h < startHour) {
      cur.setHours(startHour, 0, 0, 0)
    } else if (h >= endHour) {
      // 若已超过或到达 endHour，跳到次日 startHour:00
      cur.setDate(cur.getDate() + 1)
      cur.setHours(startHour, 0, 0, 0)
    }

    // 计算当天剩余的有效毫秒数
    const endOfDay = new Date(cur)
    if (endHour === 24) {
      endOfDay.setDate(endOfDay.getDate() + 1)
      endOfDay.setHours(0, 0, 0, 0)
    } else {
      endOfDay.setHours(endHour, 0, 0, 0)
    }

    const availableMs = endOfDay.getTime() - cur.getTime()
    if (msToAdd <= availableMs) {
      cur = new Date(cur.getTime() + msToAdd)
      msToAdd = 0
    } else {
      msToAdd -= availableMs
      cur = new Date(endOfDay)
      cur.setHours(startHour, 0, 0, 0)
    }
  }

  return cur
}

/**
 * 计算距离今天有效时段结束（如 24:00）的剩余毫秒数
 */
export function getMsUntilEndOfActiveDay(from: Date = new Date(), endHour = 24): number {
  const end = new Date(from)
  if (endHour === 24) {
    end.setDate(end.getDate() + 1)
    end.setHours(0, 0, 0, 0)
  } else {
    end.setHours(endHour, 0, 0, 0)
  }
  return Math.max(0, end.getTime() - from.getTime())
}

/**
 * 获取自然周标识字符串（如 "2026-W42"）
 */
export function getNaturalWeekString(date: Date = new Date()): string {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7 // 周一为 0，周日为 6
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

/**
 * 格式化日期为 YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '无'
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 格式化时间戳简写（如 "10-16 14:30"）
 */
export function formatShortTime(date: Date | null | undefined): string {
  if (!date) return '无'
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
