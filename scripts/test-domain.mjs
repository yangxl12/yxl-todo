import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
after(() => server.close())

const { createEmptyData, decodeLocalData } = await server.ssrLoadModule('/src/lib/dataFormat.ts')
const { createBackup, parseBackup } = await server.ssrLoadModule('/src/lib/backup.ts')
const { moveToTrash, restoreFromTrash, reduceData } = await server.ssrLoadModule('/src/lib/operations.ts')
const { TRASH_LIMIT_BYTES, measureTrashEntry } = await server.ssrLoadModule('/src/lib/trash.ts')
const { polishText, checkDeepSeekKey } = await server.ssrLoadModule('/src/lib/deepseek.ts')
const { getTodayEntries, groupGoals } = await server.ssrLoadModule('/src/features/goals/taskUtils.ts')
const { parseDateKey } = await server.ssrLoadModule('/src/lib/date.ts')

const idea = (id, text = '一则念头') => ({
  id, text, tags: ['标签'], pinned: false, pinnedAt: null, createdAt: 1, updatedAt: 1,
})
const task = (id) => ({
  id, title: '下一步', done: false, createdAt: 1, updatedAt: 1, completedAt: null,
  dueDate: '2026-11-28', priority: 'normal',
})
const goal = (id, tasks = [task('step')]) => ({
  id, title: '方向', why: '', domain: 'life', dueDate: '2026-11-28', createdAt: 1, updatedAt: 1, tasks,
})

test('v1 数据超过原正文、步骤、收藏、回收数量和文件大小限制时仍完整往返', () => {
  const data = createEmptyData()
  data.ideas = Array.from({ length: 72 }, (_, index) => idea(String(index), '火'.repeat(50000) + '\r\n尾'))
  data.goals = [goal('goal', Array.from({ length: 501 }, (_, index) => task(String(index))))]
  data.favorites = Array.from({ length: 501 }, (_, index) => 'fire-' + index)
  data.trash = Array.from({ length: 401 }, (_, index) => {
    const entry = { id: String(index), kind: 'idea', deletedAt: 2, size: 0, idea: idea('deleted-' + index) }
    entry.size = measureTrashEntry(entry)
    return entry
  })
  data.prefs.apiKey = 'private-key'
  assert.deepEqual(decodeLocalData(data), data)
  const text = JSON.stringify(createBackup(data))
  assert.ok(Buffer.byteLength(text) > 10 * 1024 * 1024)
  const result = parseBackup(text)
  assert.deepEqual(result.data, { ...data, prefs: { ...data.prefs, apiKey: '' } })
  assert.deepEqual(result.changes, {})
  assert.ok(!text.includes('private-key'))
})

test('兼容旧裸格式，预览修复真实无效字段并拒绝未知版本', () => {
  const legacy = parseBackup(JSON.stringify({ ideas: [{ id: 'i', text: '旧版' }], goals: [] }))
  assert.equal(legacy.data.ideas[0].text, '旧版')
  const { trash: _trash, ...firstRelease } = { ...createEmptyData(), ideas: [idea('first')] }
  assert.deepEqual(decodeLocalData(firstRelease), { ...firstRelease, trash: [] })
  const data = createEmptyData()
  data.ideas = [idea('same'), idea('same'), idea('bad', ' ')]
  data.goals = [goal('g', [{ ...task('x'), dueDate: '2026-02-30' }, null])]
  data.favorites = ['fire', 'fire', 12]
  data.trash = [null]
  const decoded = parseBackup(JSON.stringify({ app: 'shiyan', version: 1, data }))
  assert.deepEqual(decoded.changes, {
    ideas: { repaired: 1, dropped: 1 },
    tasks: { repaired: 1, dropped: 1 },
    favorites: { dropped: 2 },
    trash: { dropped: 1 },
  })
  assert.equal(decoded.data.goals[0].tasks[0].dueDate, null)
  assert.notEqual(decoded.data.ideas[0].id, decoded.data.ideas[1].id)
  assert.throws(() => decodeLocalData(data))
  assert.throws(() => parseBackup(JSON.stringify({ app: 'other', version: 1, data })), /标识/)
  assert.throws(() => parseBackup(JSON.stringify({ app: 'shiyan', version: 2, data })), /版本/)
  assert.throws(() => parseBackup(JSON.stringify({ ...data, version: 2 })), /版本/)
  assert.equal(parseDateKey('2026-02-29'), null)
  assert.ok(parseDateKey('2028-02-29'))
})

test('旧版 Pro 设置自动迁移，保留本地密钥与备份数据', () => {
  const data = createEmptyData()
  data.ideas = [idea('original')]
  data.prefs = { ...data.prefs, model: 'deepseek-v4-pro', theme: 'dark', apiKey: 'local-key' }
  const local = decodeLocalData(data)
  assert.deepEqual(local, { ...data, prefs: { ...data.prefs, model: 'deepseek-flash' } })
  const imported = parseBackup(JSON.stringify(createBackup(data)))
  assert.deepEqual(imported.data, { ...local, prefs: { ...local.prefs, apiKey: '' } })
  assert.deepEqual(imported.changes, {})
})

test('删除与恢复念头、目标和步骤，缺少父目标时保留步骤', () => {
  const state = { ...createEmptyData(), ideas: [idea('i')], goals: [goal('g')] }
  const removedIdea = moveToTrash(state, { kind: 'idea', id: 'i' }, 'r1', 10)
  assert.equal(removedIdea.status, 'deleted')
  assert.equal(removedIdea.data.ideas.length, 0)
  const removedTask = moveToTrash(removedIdea.data, { kind: 'task', goalId: 'g', id: 'step' }, 'r2', 11)
  const removedGoal = moveToTrash(removedTask.data, { kind: 'goal', id: 'g' }, 'r3', 12)
  const unavailable = restoreFromTrash(removedGoal.data, 'r2', 13)
  assert.equal(unavailable.status, 'parent-missing')
  assert.equal(unavailable.data, removedGoal.data)
  const restoredGoal = restoreFromTrash(removedGoal.data, 'r3', 14)
  const restoredStep = restoreFromTrash(restoredGoal.data, 'r2', 15)
  const restoredIdea = restoreFromTrash(restoredStep.data, 'r1', 16)
  assert.deepEqual(restoredIdea.data.ideas, state.ideas)
  assert.deepEqual(restoredIdea.data.goals[0].tasks, state.goals[0].tasks)
  assert.deepEqual(restoredIdea.data.trash, [])
  assert.equal(restoreFromTrash(restoredIdea.data, 'r1', 16).data, restoredIdea.data)
})

test('回收容量临界可撤回，超大的单条记录保留在原处', () => {
  const base = { id: 'r', kind: 'idea', deletedAt: 1, size: 0, idea: idea('small', 'X') }
  const atLimit = idea('small', 'X'.repeat(TRASH_LIMIT_BYTES - measureTrashEntry(base) - 4))
  const tooLarge = idea('big', 'X'.repeat(TRASH_LIMIT_BYTES))
  const state = { ...createEmptyData(), ideas: [atLimit, tooLarge], trash: [{ ...base, id: 'old', size: 100 }] }
  assert.equal(moveToTrash(state, { kind: 'idea', id: 'big' }, 'r2', 1).data, state)
  const result = moveToTrash(state, { kind: 'idea', id: 'small' }, 'r', 1)
  assert.equal(result.status, 'deleted')
  assert.equal(result.evicted, 1)
  assert.equal(restoreFromTrash(result.data, 'r', 2).status, 'restored')
})

test('过期撤回对同一毫秒内的新完成无效', () => {
  const state = { ...createEmptyData(), goals: [goal('g')] }
  const toggle = (data, completionId) => reduceData(data, { type: 'task/toggle', goalId: 'g', taskId: 'step', completionId }, 100)
  const undo = (data, completionId) => reduceData(data, { type: 'task/undoComplete', goalId: 'g', taskId: 'step', completionId }, 100)
  const first = toggle(state, 'first')
  const manual = toggle(first, 'manual')
  assert.equal(undo(manual, 'first'), manual)
  const last = toggle(manual, 'last')
  assert.equal(undo(last, 'first'), last)
  assert.equal(undo(last, 'last').goals[0].tasks[0].done, false)
  assert.equal(reduceData(state, { type: 'goal/update', id: 'g', patch: { title: '方向' } }, 100), state)
})

test('目标分组和今日清单可用同一个日期重算', () => {
  const goals = [goal('g'), goal('done', [{ ...task('d'), done: true, completedAt: 2 }])]
  assert.deepEqual(getTodayEntries(goals, new Date(2026, 10, 27)), [])
  assert.equal(getTodayEntries(goals, new Date(2026, 10, 28))[0].task.id, 'step')
  assert.deepEqual(groupGoals(goals, 'due').completed.map((item) => item.id), ['done'])
})

const message = ': keep-alive\r\n\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"《中文输出》"}}]}\r\n\n'
const end = (reason) => 'data: {"choices":[{"finish_reason":"' + reason + '"}]}\n\ndata: [DONE]\n\n'
const options = { apiKey: 'mock', mode: 'clear', text: '原文', thinking: false }

test('AI 支持逐字节 UTF-8 分块，只有终止帧和 stop 同时出现才完整', async (t) => {
  const fallback = globalThis.fetch
  t.after(() => { globalThis.fetch = fallback })
  for (const [events, expected] of [
    [message + end('stop'), 'complete'],
    [message + end('length'), 'truncated'],
    [message, 'truncated'],
    [message + 'data: [DONE]\n\n', 'truncated'],
    [message + end('stop').trimEnd(), 'truncated'],
    [message + 'data: broken\n\n' + end('stop'), 'truncated'],
  ]) {
    globalThis.fetch = async (_url, { body }) => {
      const request = JSON.parse(body)
      assert.equal(request.model, 'deepseek-flash')
      assert.deepEqual(request.messages[1], { role: 'user', content: options.text })
      return new Response(new ReadableStream({
        start(controller) {
          for (const byte of new TextEncoder().encode(events)) controller.enqueue(Uint8Array.of(byte))
          controller.close()
        },
      }))
    }
    const result = await polishText({ ...options, model: 'deepseek-v4-pro' })
    assert.equal(result.text, '《中文输出》')
    assert.equal(result.status, expected)
  }
})

test('空白、内容过滤与服务端错误无法产生完整稿件', async (t) => {
  const fallback = globalThis.fetch
  t.after(() => { globalThis.fetch = fallback })
  for (const [events, kind] of [
    ['data: {"choices":[{"delta":{"content":" "}}]}\n\n' + end('stop'), 'empty'],
    [message + end('content_filter'), 'request'],
    [message + 'data: {"error":{"message":"upstream error"}}\n\n', 'server'],
  ]) {
    globalThis.fetch = async () => new Response(events)
    await assert.rejects(polishText(options), { kind })
  }
})

test('AI 超时和主动停止可区分', async (t) => {
  const fallback = globalThis.fetch
  t.after(() => { globalThis.fetch = fallback })
  globalThis.fetch = async (_url, { signal }) => {
    signal.throwIfAborted()
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  }
  const controller = new AbortController()
  const stopped = polishText({ ...options, signal: controller.signal })
  controller.abort()
  assert.equal((await stopped).status, 'stopped')
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const timedOut = polishText(options)
  t.mock.timers.tick(35000)
  await assert.rejects(timedOut, { kind: 'timeout' })
})

test('保活帧无法延长等待，正文到达后重新计时', async (t) => {
  const fallback = globalThis.fetch
  t.after(() => { globalThis.fetch = fallback })
  let didReceiveContent
  const receivedContent = new Promise((resolve) => { didReceiveContent = resolve })
  let stream
  globalThis.fetch = async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) {
      stream = controller
      signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
    },
  }))
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const stalled = polishText({ ...options, onContent: didReceiveContent })
  const failure = assert.rejects(stalled, { kind: 'timeout' })
  const encode = new TextEncoder()
  t.mock.timers.tick(30000)
  stream.enqueue(encode.encode(message))
  await receivedContent
  t.mock.timers.tick(30000)
  stream.enqueue(encode.encode(': keep-alive\n\n'))
  t.mock.timers.tick(4999)
  assert.doesNotThrow(() => stream.enqueue(encode.encode(': keep-alive\n\n')))
  t.mock.timers.tick(1)
  await failure
})

test('验证连接要求密钥可访问 Flash', async (t) => {
  const fallback = globalThis.fetch
  t.after(() => { globalThis.fetch = fallback })
  globalThis.fetch = async () => Response.json({ data: [{ id: 'deepseek-v4-pro' }] })
  await assert.rejects(checkDeepSeekKey('mock-key'), { kind: 'server' })
  globalThis.fetch = async () => Response.json({ data: [{ id: 'deepseek-flash' }] })
  assert.equal(typeof await checkDeepSeekKey('mock-key'), 'number')
})
