import { FIRE_METHODS } from './fireMethods'
import { FIRE_QUOTES } from './fireQuotes'

export type FireKind = 'method' | 'quote'

export type FireTheme = '启动' | '专注' | '坚持' | '恢复' | '回望'

export interface FireMethod {
  id: string
  kind: 'method'
  theme: FireTheme
  title: string
  summary: string
  evidence: string
  practice: string
  citation: string
  sourceUrl?: string
  sourceLabel?: string
}

export interface FireQuote {
  id: string
  kind: 'quote'
  theme: FireTheme
  title: string
  body: string
  attribution: string
  source: string
  translated?: boolean
  sourceUrl?: string
}

export type FireItem = FireMethod | FireQuote

const ORIGINAL_METHODS: FireMethod[] = [
  {
    id: 'method-if-then',
    kind: 'method',
    theme: '启动',
    title: '把决心写成一句「如果……就……」',
    summary:
      '模糊的“我明天要运动”很容易被现场情绪击败。提前决定在什么时间、什么地点、做什么，会减少那一刻的犹豫。',
    evidence:
      'Gollwitzer 与 Sheeran 汇总 94 项独立研究发现，执行意图（if–then plan）对目标达成有稳定的中等偏大效果。比起只设定目标，它更像提前写好了启动顺序。',
    practice:
      '把今天最想推进的一件事写成：“如果到了 ___（时间/地点），我就先做 ___（最小动作）。”',
    citation:
      'Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38, 69–119.',
    sourceUrl: 'https://doi.org/10.1016/S0065-2601(06)38002-1',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-specific-goal',
    kind: 'method',
    theme: '启动',
    title: '「多读点书」不如「今晚读十页」',
    summary:
      '目标越具体、越有一点挑战，注意力越知道该落在哪里。含混的愿望，往往连第一步都无法开始。',
    evidence:
      'Locke 与 Latham 回顾数十年目标设置研究后指出，具体而有难度、并且能得到反馈的目标，通常比“尽力而为”带来更好的表现。',
    practice:
      '把正在做的一个目标，改成能看见完成条件的一句话；如果可能，只留下下一步。',
    citation:
      'Locke, E. A., & Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation: A 35-year odyssey. American Psychologist, 57(9), 705–717.',
    sourceUrl: 'https://doi.org/10.1037/0003-066X.57.9.705',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-attention-residue',
    kind: 'method',
    theme: '专注',
    title: '切换之前，先给大脑一个停靠点',
    summary:
      '从一件事跳到另一件事时，没放下的那部分会继续占用注意力。这不是意志力差，而是切换本身有成本。',
    evidence:
      'Leroy（2009）的系列实验发现，从事需要认知投入的任务时，若上一件事没有形成清晰收尾，切换到新任务后的表现会受影响。',
    practice:
      '离开前用 60 秒写下：现在到哪了、下一步是什么、什么时候回来。然后再去开会、吃饭或休息。',
    citation:
      'Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. Organizational Behavior and Human Decision Processes, 109(2), 168–181.',
    sourceUrl: 'https://doi.org/10.1016/j.obhdp.2009.04.002',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-micro-break',
    kind: 'method',
    theme: '恢复',
    title: '让休息短，但真离开屏幕',
    summary:
      '微休息不是偷懒，而是把注意力从持续消耗中短暂撤回来。关键是“换一种状态”，不是换一个信息流。',
    evidence:
      'Albulescu 等人（2022）的系统综述与元分析发现，工作中的短暂休息对幸福感与表现有小幅正向作用；对高要求任务，恢复性休息更值得保留。',
    practice:
      '给自己 5 分钟：起身、看远处、喝水。不要用刷手机换一种注意力消耗。',
    citation:
      'Albulescu, P., Macsinga, I., Rusu, A., Sulea, C., Bodnaru, A., & Tulbure, B. T. (2022). “Give me a break!” A systematic review and meta-analysis on the efficacy of micro-breaks for increasing well-being and performance. PLoS ONE, 17(8), e0272460.',
    sourceUrl: 'https://doi.org/10.1371/journal.pone.0272460',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-spacing',
    kind: 'method',
    theme: '专注',
    title: '把训练摊开，而不是一次用完',
    summary: '同样的总时长，分几天做，通常比一次猛攻记得更久。',
    evidence:
      'Cepeda 等人（2006）整合数百项研究指出，分散练习（distributed practice）在长期保持上通常优于集中练习；间隔长度要与你想记住多久相匹配。',
    practice: '把今天学的内容拆出 10 分钟，安排到明天和三天后各回顾一次。',
    citation:
      'Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. Psychological Bulletin, 132(3), 354–380.',
    sourceUrl: 'https://doi.org/10.1037/0033-2909.132.3.354',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-retrieval',
    kind: 'method',
    theme: '专注',
    title: '合上书，先把记得的写出来',
    summary:
      '“回想”本身就是学习，比重复阅读更能暴露空白。它当下会有点难，这正是它有用的部分。',
    evidence:
      'Roediger 与 Karpicke（2006）发现，提取练习虽然当下感觉更难，却比反复阅读带来更好的长期记忆。',
    practice: '学完一页，合上材料，用 2 分钟写下三个要点，再翻回去对照。',
    citation:
      'Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. Psychological Science, 17(3), 249–255.',
    sourceUrl: 'https://doi.org/10.1111/j.1467-9280.2006.01693.x',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-66-days',
    kind: 'method',
    theme: '坚持',
    title: '习惯不是 21 天就能刻好的',
    summary: '“21 天成习惯”更像流行口号，而不是定律。重复的次数比完美的连续更重要。',
    evidence:
      'Lally 等人（2010）追踪日常行为的自动化程度，估计达到习惯平台期的中位数约为 66 天，个体差异很大（约 18–254 天）；偶尔漏一天，并未显著打断形成过程。',
    practice: '把注意力从“连续打卡”移到“下一次重复”。漏了一天，第二天照常接上。',
    citation:
      'Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. European Journal of Social Psychology, 40(6), 998–1009.',
    sourceUrl: 'https://doi.org/10.1002/ejsp.674',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-planning-fallacy',
    kind: 'method',
    theme: '回望',
    title: '估完时间，再给它留一点风',
    summary:
      '人对自己完成任务的速度，普遍过于乐观，即使以前被拖过。计划里没有“意外”，意外就会变成崩溃。',
    evidence:
      'Buehler、Griffin 与 Ross（1994）的系列研究表明，人们倾向于低估完成时间，而且往往是在已经知道自己容易拖延的情况下。',
    practice: '重要事情的估时乘以 1.5；把“意外”当成计划的一部分，而不是失败。',
    citation:
      'Buehler, R., Griffin, D., & Ross, M. (1994). Exploring the “planning fallacy”: Why people underestimate their task completion times. Journal of Personality and Social Psychology, 67(3), 366–381.',
    sourceUrl: 'https://doi.org/10.1037/0022-3514.67.3.366',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-fresh-start',
    kind: 'method',
    theme: '启动',
    title: '借一个「重新开始」的时间地标',
    summary:
      '周一、月初、生日，不只是日期，也可能成为换一种做法的心理分界。',
    evidence:
      'Dai、Milkman 与 Riis（2014）发现，人们更容易在时间地标之后开始追求目标；他们称之为“fresh start effect”。',
    practice: '借下一个周一或月初，只改一个具体动作，不必同时重做整个生活。',
    citation:
      'Dai, H., Milkman, K. L., & Riis, J. (2014). The fresh start effect: Temporal landmarks motivate aspirational behavior. Management Science, 60(10), 2563–2582.',
    sourceUrl: 'https://doi.org/10.1287/mnsc.2014.1901',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-self-compassion',
    kind: 'method',
    theme: '恢复',
    title: '搞砸之后，先别补一刀',
    summary:
      '自责听起来像在推动自己，但它常常让人更想躲开问题。温和不是放弃要求。',
    evidence:
      'Breines 与 Chen（2012）的实验发现，在失败或自我威胁之后，自我关怀能提升改善自己的动机，而不是让人放松要求。',
    practice:
      '用“如果是朋友遇到这件事，我会怎么说”写一句，然后只做一个最小补救动作。',
    citation:
      'Breines, J. G., & Chen, S. (2012). Self-compassion increases self-improvement motivation. Personality and Social Psychology Bulletin, 38(9), 1133–1143.',
    sourceUrl: 'https://doi.org/10.1177/0146167212445599',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-temptation-bundling',
    kind: 'method',
    theme: '坚持',
    title: '把喜欢的事，绑在难开始的事上',
    summary:
      '让想做的事拥有立即的愉快回报，是降低拖延的一个实用办法。',
    evidence:
      'Milkman、Minson 与 Volpp（2014）在健身房做了实地实验：只在锻炼时才能听引人入胜的有声书或小说，能提高出勤。',
    practice: '选一个只在走路、训练或整理时才能享受的播客或剧集。',
    citation:
      'Milkman, K. L., Minson, J. A., & Volpp, K. G. (2014). Holding the Hunger Games hostage at the gym: An evaluation of temptation bundling. Management Science, 60(2), 283–299.',
    sourceUrl: 'https://doi.org/10.1287/mnsc.2013.1784',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-goal-gradient',
    kind: 'method',
    theme: '坚持',
    title: '越来越近时，人自然会加速',
    summary:
      '目标不是只有意义才走；离终点更近的感觉，本身就会推人一把。',
    evidence:
      'Kivetz、Urminsky 与 Zheng（2006）在咖啡店会员卡的现场研究中观察到目标梯度：越接近奖励，购买间隔越短，行动越频繁。',
    practice: '把长期目标拆成看得见的里程碑，并标出已经跨过的那一步。',
    citation:
      'Kivetz, R., Urminsky, O., & Zheng, Y. (2006). The goal-gradient hypothesis resurrected: Purchase acceleration, illusionary goal progress, and customer retention. Journal of Marketing Research, 43(1), 39–58.',
    sourceUrl: 'https://doi.org/10.1509/jmkr.43.1.39',
    sourceLabel: 'DOI',
  },
  {
    id: 'method-progress-principle',
    kind: 'method',
    theme: '回望',
    title: '把今天的一小步记下来',
    summary:
      '真正支撑持续投入的，往往不是大喜讯，而是“我今天有进展”。',
    evidence:
      'Amabile 与 Kramer 基于数百人的工作日记研究提出“进展原则”：每天的小进展与更积极的情绪、投入感相关。',
    practice:
      '睡前写一行：今天推进了什么，很小也算。只记录，不把它变成审判。',
    citation:
      'Amabile, T. M., & Kramer, S. J. (2011). The Progress Principle: Using Small Wins to Ignite Joy, Engagement, and Creativity at Work. Harvard Business Review Press.',
    sourceUrl: 'https://hbr.org/2011/05/the-power-of-small-wins',
    sourceLabel: 'HBR',
  },
  {
    id: 'method-environment-cue',
    kind: 'method',
    theme: '专注',
    title: '让好行为的提示，出现在眼前',
    summary:
      '习惯常由场景中的提示自动触发，而不是每次靠意志力重新决定。',
    evidence:
      'Neal、Wood 与 Quinn（2006）综述习惯研究指出，重复行为会被稳定的情境线索触发，成为自动化的反应。',
    practice:
      '把明天要穿的运动鞋放在门口；把手机放到另一个房间。改提示，比临场硬扛省力。',
    citation:
      'Neal, D. T., Wood, W., & Quinn, J. M. (2006). Habits—A repeat performance? Current Directions in Psychological Science, 15(4), 198–202.',
    sourceUrl: 'https://doi.org/10.1111/j.1467-8721.2006.00435.x',
    sourceLabel: 'DOI',
  },
]

const ORIGINAL_QUOTES: FireQuote[] = [
  {
    id: 'quote-confucius',
    kind: 'quote',
    theme: '坚持',
    title: '乐在其中',
    body: '知之者不如好之者，好之者不如乐之者。',
    attribution: '孔子',
    source: '《论语 · 雍也》',
    sourceUrl: 'https://zh.wikisource.org/wiki/論語/雍也第六',
  },
  {
    id: 'quote-laozi',
    kind: 'quote',
    theme: '启动',
    title: '从脚下开始',
    body: '合抱之木，生于毫末；九层之台，起于累土；千里之行，始于足下。',
    attribution: '老子',
    source: '《道德经》第六十四章',
    sourceUrl: 'https://zh.wikisource.org/wiki/道德經',
  },
  {
    id: 'quote-su-shi',
    kind: 'quote',
    theme: '坚持',
    title: '一蓑烟雨',
    body: '莫听穿林打叶声，何妨吟啸且徐行。竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。',
    attribution: '苏轼',
    source: '《定风波 · 莫听穿林打叶声》',
    sourceUrl: 'https://zh.wikisource.org/wiki/定風波_(蘇軾)',
  },
  {
    id: 'quote-luxun',
    kind: 'quote',
    theme: '启动',
    title: '路是走出来的',
    body: '其实地上本没有路，走的人多了，也便成了路。',
    attribution: '鲁迅',
    source: '《故乡》',
    sourceUrl: 'https://zh.wikisource.org/wiki/故鄉',
  },
  {
    id: 'quote-tao-yuanming',
    kind: 'quote',
    theme: '回望',
    title: '岁月不待人',
    body: '盛年不重来，一日难再晨。及时当勉励，岁月不待人。',
    attribution: '陶渊明',
    source: '《杂诗》其一',
  },
  {
    id: 'quote-seneca',
    kind: 'quote',
    theme: '回望',
    title: '时间不是太少',
    body: '并非我们拥有的时间太短，而是我们浪费掉的太多。',
    attribution: '塞内加',
    source: '《论生命之短暂》',
    translated: true,
  },
  {
    id: 'quote-marcus-aurelius',
    kind: 'quote',
    theme: '坚持',
    title: '障碍成为路',
    body: '阻碍行动的东西，会推进行动。挡在路上的，也就成了路。',
    attribution: '马可·奥勒留',
    source: '《沉思录》第五卷，20 节',
    translated: true,
    sourceUrl: 'https://classics.mit.edu/Antoninus/meditations.5.five.html',
  },
  {
    id: 'quote-camus',
    kind: 'quote',
    theme: '恢复',
    title: '不可战胜的夏天',
    body: '在隆冬，我终于知道，我身上有一个不可战胜的夏天。',
    attribution: '阿尔贝·加缪',
    source: '《重返蒂巴萨》',
    translated: true,
  },
  {
    id: 'quote-rilke',
    kind: 'quote',
    theme: '恢复',
    title: '爱问题本身',
    body: '请对你心中所有未解的问题保持耐心，试着去爱这些问题本身。',
    attribution: '赖内·马利亚·里尔克',
    source: '《给青年诗人的信》',
    translated: true,
  },
  {
    id: 'quote-beckett',
    kind: 'quote',
    theme: '坚持',
    title: '失败得更好',
    body: '试过了。失败了。没关系。再试一次。再失败。失败得更好一点。',
    attribution: '塞缪尔·贝克特',
    source: '《更糟的是》',
    translated: true,
  },
  {
    id: 'quote-hemingway',
    kind: 'quote',
    theme: '坚持',
    title: '不被击败',
    body: '一个人可以被毁灭，但不能被打败。',
    attribution: '欧内斯特·海明威',
    source: '《老人与海》',
    translated: true,
  },
  {
    id: 'quote-dillard',
    kind: 'quote',
    theme: '回望',
    title: '日子就是一生',
    body: '你如何度过你的每一天，当然就是你如何度过你的一生。',
    attribution: '安妮·迪拉德',
    source: '《写作生活》',
    translated: true,
  },
  {
    id: 'quote-mary-oliver',
    kind: 'quote',
    theme: '启动',
    title: '唯一而珍贵的一生',
    body: '告诉我，你打算如何度过这唯一、狂野而珍贵的一生？',
    attribution: '玛丽·奥利弗',
    source: '《野雁》',
    translated: true,
    sourceUrl: 'https://www.poetryfoundation.org/poems/43768/wild-geese',
  },
  {
    id: 'quote-james-clear',
    kind: 'quote',
    theme: '坚持',
    title: '为一票投票',
    body: '每一个行动，都是为你想要成为的那个人投下的一票。',
    attribution: '詹姆斯·克利尔',
    source: '《原子习惯》',
    translated: true,
    sourceUrl: 'https://jamesclear.com/atomic-habits',
  },
  {
    id: 'quote-tagore',
    kind: 'quote',
    theme: '恢复',
    title: '别错过群星',
    body: '如果你因错过太阳而流泪，那么你也将错过群星。',
    attribution: '拉宾德拉纳特·泰戈尔',
    source: '《飞鸟集》',
    translated: true,
  },
]

const methods = [...ORIGINAL_METHODS, ...FIRE_METHODS]
const quotes = [...ORIGINAL_QUOTES, ...FIRE_QUOTES]

// Spread methods through the daily rotation while keeping the order within each category.
export const FIRE_ITEMS: FireItem[] = methods.flatMap((method, index) => [
  method,
  ...quotes.slice(
    Math.floor(index * quotes.length / methods.length),
    Math.floor((index + 1) * quotes.length / methods.length),
  ),
])

export function getDailyFireIndex(dayNumber: number): number {
  return ((dayNumber % FIRE_ITEMS.length) + FIRE_ITEMS.length) % FIRE_ITEMS.length
}
