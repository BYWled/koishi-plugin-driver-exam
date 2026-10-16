<h1 align="center">koishi-plugin-driver-exam</h1>

<p align="center">
  驾考答题与 Monetary 经济联动插件。支持名单禁言机制、货币悬赏挑战、夜间免禁时段、连胜顺延、智能换题与容灾跳过等。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/koishi-plugin-driver-exam"><img src="https://img.shields.io/npm/v/koishi-plugin-driver-exam?style=for-the-badge&logo=npm" alt="npm" /></a>
  <a href="https://github.com/BYWled/koishi-plugin-driver-exam"><img src="https://img.shields.io/github/stars/BYWled/koishi-plugin-driver-exam?style=for-the-badge&logo=github" alt="GitHub Stars" /></a>
</p>

<p align="center">
  <a href="https://gitee.com/BYWled/koishi-plugin-driver-exam"><img src="https://img.shields.io/badge/Gitee-代码镜像-C71D23?style=for-the-badge&logo=gitee&logoColor=white" alt="Gitee Mirror" /></a>
  <a href="https://gitcode.com/BYWled/koishi-plugin-driver-exam"><img src="https://img.shields.io/badge/GitCode-代码镜像-2962FF?style=for-the-badge&logo=gitcode&logoColor=white" alt="GitCode Mirror" /></a>
</p>

<p align="center">
  <a href="https://github.com/BYWled/koishi-plugin-driver-exam">GitHub</a> ·
  <a href="https://gitee.com/BYWled/koishi-plugin-driver-exam">Gitee</a> ·
  <a href="https://gitcode.com/BYWled/koishi-plugin-driver-exam">GitCode</a>
</p>

> 版本：**1.0.0**

## ✨ 特性

- **真实海量驾考试题**：接入标准驾考题库 API（支持科目一、科目四，涵盖小车、客车、货车、摩托车等题库类型）。
- **个性化去重与缓存池**：本地高效缓存题目与答案解析，答题时优先为用户抽取从未作答过的题目，避免重复刷题。
- **动态配置与精准文案**：题目数量、通关正确率阈值、单题作答倒计时、奖励比例等全部动态绑定配置项。
- **名单管理与禁言顺延**：
  - 名单内成员不刷题将被定时巡检禁言；
  - 答题达标可按轮次叠加顺延豁免时间；
  - 若已被禁言可私聊机器人答题，考核通关后立即解除群禁言并顺延豁免期；
  - 支持夜间免禁时段（如 00:00 ~ 08:00），顺延时间自动跳过夜间。
- **自然周连胜额外奖励**：自然周内连续达成指定通关轮数（如连续 10 轮达标），额外奖励相当于数天的有效解禁小时数；若未达标则打断重置。
- **货币悬赏挑战（Monetary 联动）**：
  - 玩家可消耗货币指定目标成员发起挑战，消耗金额按比例折算目标禁言时长并进入缓冲倒计时；
  - 被指定成员若在缓冲期前完成挑战答题，可夺得发起人消耗货币的一定比例（如 50%）作为奖励，剩余部分作为发起挑战的服务费；
  - 严谨的被挑战前置校验，防止对临期封禁玩家恶意套娃指定。
- **自由挑战与防刷机制**：
  - 名单外玩家可自由开启答题挑战，通关获得货币奖励，失败无惩罚；
  - 内置每日领奖上限控制，支持自动对齐模式（每日最大封禁时数 / 单轮顺延时数）或自定义次数。
- **群聊防并发与作答防误判**：
  - 严格群内答题互斥锁，群内同一时间仅允许一位考生答题，避免并发消息混淆；
  - 智能答案格式比对，普通群聊文本静默忽略，答题期间隐藏正确答案并在结算时提供详尽错题解析；
  - 允许考生随时发送“退出答题”提前中止，且支持自动撤回答题过程消息保持群聊整洁。
- **图片自动转码与容灾换题/跳过**：
  - 支持通过 Puppeteer 无头浏览器将题目 WebP 配图自动转码为标准 PNG Base64，彻底解决 OneBot 协议端拉取远程图片失败（1200 错误码）；
  - 题目发送失败时支持自动重试与纯文本降级；
  - 若题目重试仍无法送达，优先自动抽取未做过的新题进行无缝替换；若无法更换则**自动跳过该题**且不记录错误，绝不卡死或误判考生超时。

---

## 📦 安装与依赖

### 基础依赖
- **必需**：`database` 服务（支持 SQLite、MySQL 等 Minato 数据库驱动）。
- **数据表**：
  - `driver_exam_question`：本地驾考试题与答案解析缓存表。
  - `driver_exam_user`：用户群维度档案表（豁免截止时间、禁言状态、连胜统计、每日领奖计数等）。
  - `driver_exam_challenge`：货币挑战记录表。
  - `driver_exam_history`：用户已做题历史记录表（用于优先出未做题目）。

### 可选依赖
- **`monetary` 服务**：启用后可使用货币消耗发起挑战及自由挑战领奖功能。
- **`puppeteer` 服务**：启用后用于将考题中的远程 WebP 图片转码为高兼容性 PNG Base64 发送。未安装时将以 Base64 直发或纯文本降级模式运行。

---

## ⚙️ 配置说明

在 Koishi 控制台插件市场或 `koishi.yml` 中配置：

```yaml
plugins:
  driver-exam:
    # --- 题库 API 凭证 ---
    appId: ''                        # 题库 API APP_ID
    appSecret: ''                    # 题库 API APP_SECRET
    defaultRank: 1                   # 默认车型: 1:小车, 2:货车, 3:客车, 4:摩托车
    defaultSubjectType: 1            # 默认科目: 1:科目一, 2:科目四
    allowedQuestionTypes: [1, 2]     # 允许题型: 1:判断题, 2:单选题, 3:多选题

    # --- 答题与顺延规则 ---
    questionsPerRound: 10            # 每轮题目数 (道)
    passRate: 0.9                    # 通关正确率及格线 (0.1 ~ 1.0)
    questionTimeout: 45              # 单题作答超时时间 (秒)
    exemptHoursPerPass: 2            # 正常答题通关后开始禁言时间顺延时长 (小时)
    mutedPassExemptHours: 1          # 被禁言后私信答题通关解禁顺延时长 (小时)
    recallIntermediateMessages: true # 是否在答题后自动撤回答题过程消息
    sendRetryCount: 2                # 题目发送失败重试次数 (0 ~ 5)
    replaceQuestionOnSendFailure: true # 题目发送失败重试后是否自动更换新考题

    # --- 时间与禁言规则 ---
    activeStartHour: 8               # 每日禁言生效起始时间 (整点，如 8 表示 08:00)
    activeEndHour: 24                # 每日禁言生效结束时间 (整点，如 24 表示 24:00)
    initialBufferHours: 2            # 新加入名单成员的初始豁免缓冲时长 (小时)

    # --- 连胜奖励规则 ---
    weekStreakTarget: 10             # 自然周内连续通关达标轮数 (轮)
    weekStreakRewardDays: 3          # 达成连胜额外奖励的相当于天数的小时数 (天)

    # --- 货币与挑战规则 (Monetary) ---
    currency: 'coin'                 # 消耗/奖励的货币名称
    currencyPerHour: 100             # 挑战时每小时禁言折算消耗的货币数额
    challengeBufferHours: 1          # 被挑战者开始生效前的缓冲备战时长 (小时)
    challengeRewardRate: 0.5         # 挑战成功返奖比例 (0.1 ~ 1.0)
    enableDailyRewardLimit: true     # 是否开启自由挑战每日领奖次数上限
    dailyRewardLimitMode: 'auto'     # 上限模式: auto(对齐最大封禁天数) 或 custom(自定义)
    dailyRewardLimitCustom: 8        # 自定义每日最多领奖次数
```

---

## 🎮 指令概览

### 1. 玩家指令

| 指令 | 别名 | 参数 / 选项 | 说明 |
| :--- | :--- | :--- | :--- |
| `驾考答题` | `考驾照` | `[科一/科四] [车型]`<br>`-s <科目>`: 1(科一), 4(科四)<br>`-r <车型>`: 1(小车), 2(货车), 3(客车), 4(摩托车) | 开启一轮驾考题目测评。群聊答题将受到群并发锁保护，已被禁言者可私信机器人作答。 |
| `退出答题` | - | `退出` / `结束答题` / `quit` | 在答题进行中发送，可提前主动结束本次答题（不计入成绩）。 |
| `驾考挑战` | - | `<target:目标用户> <amount:消耗货币数>` | 消耗自身货币，指定群内他人进行相同逻辑的驾考挑战。若对方在缓冲期前完成所有轮次，可获得高额奖励！ |
| `驾考状态` | - | `[target:目标用户]` | 查询自己或指定成员的驾考档案（名单状态、豁免截止时间、禁言状态、周连胜轮数、今日挑战进度等）。 |
| `驾考题库` | - | `-s <科目>` / `-r <车型>` | 查看本地题库缓存统计及个人刷题历史进度。 |

### 2. 管理员指令（需要权限等级 $\ge 3$）

| 指令 | 参数 / 选项 | 说明 |
| :--- | :--- | :--- |
| `驾考名单.添加` | `<target:目标用户> [bufferHours:初始缓冲小时数]` | 将指定用户加入群驾考监管名单，开始计入刷题考核。 |
| `驾考名单.移除` | `<target:目标用户>` | 将指定用户移出群驾考监管名单，若被禁言将尝试自动解禁。 |
| `驾考名单.同步题库` | `[-p <页码>] [-s <科目>] [-r <车型>]` | 手动触发从官方 API 批量同步并缓存考题至本地。 |

---

## 💡 核心机制说明

### 1. 顺延机制与夜间免禁时段
- **顺延计算**：每次通关后，在当前记录的开始禁言时间（若已过期则基于当前时间）向后顺延指定小时数。
- **夜间时段跨越**：若配置了夜间不禁言时段（例如 00:00 至 08:00），所有顺延时长在跨越该时段时会**直接向后跳过相应时数**，夜间期间巡检定时器亦不会对玩家实施禁言。

### 2. 货币悬赏挑战
- 发起人支付货币，折算为目标玩家的额外禁言时长（例如消耗 200 货币折算 2 小时禁言），并在缓冲期（默认 1 小时）后生效；
- 目标玩家需通关对应轮数（每通过一轮顺延 2 小时）完成挑战；
- 若目标在缓冲期截止前全部答对通关，可夺得发起人消耗货币的一定比例（默认 50%）作为奖励！
- **防恶意套娃**：若目标玩家在未来（缓冲时长 + 货币折算时长）内即将开始禁言，或已有进行中的挑战，系统将拒绝发起挑战。

### 3. 容灾换题与跳过
- **图片自动转码**：检测到考题包含图片时，若启用 `puppeteer` 服务，插件将调用无头浏览器 Canvas 预先转换为标准的 PNG Base64，杜绝协议端下载外部 WebP 图片超时报错（1200）。
- **换题与跳过保障**：当题目发送失败时，插件会自动重试并尝试纯文本降级；若多次重试仍失败，插件会自动抽取未作答的新题替换；若无法替换则**自动跳过该题**（从总题数中扣除，不误判超时，不给用户记错），确保答题流程流畅稳定。

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE) 开源协议。
