import functools
import json
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE_PATH = "/yxl-todo/"
FALLBACK_KEY = "shiyan:state-fallback"

FAULTS = """
window.faults = {};
window.puts = 0;
const transaction = IDBDatabase.prototype.transaction;
const put = IDBObjectStore.prototype.put;
const setItem = Storage.prototype.setItem;
IDBDatabase.prototype.transaction = function (name, mode, ...rest) {
  if (mode === 'readonly' && (faults.read ?? window.initialFaults?.read)) throw new Error('Injected read failure');
  if (mode === 'readwrite' && faults.write) throw new Error('Injected write failure');
  return transaction.call(this, name, mode, ...rest);
};
IDBObjectStore.prototype.put = function (...args) {
  if (args[1] === 'app-state') window.puts++;
  return put.apply(this, args);
};
Storage.prototype.setItem = function (key, value) {
  if (key === 'shiyan:state-fallback' && faults.fallback) throw new Error('Injected fallback failure');
  return setItem.call(this, key, value);
};
window.addEventListener('storage', (event) => {
  if (faults.ignoreChanges && event.key === 'shiyan:committed') event.stopImmediatePropagation();
}, { capture: true });
"""

READ_DB = """
(mode) => new Promise((resolve, reject) => {
  const request = indexedDB.open('shiyan-local');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction('journal', 'readonly');
    const get = transaction.objectStore('journal').get('app-state');
    get.onsuccess = () => { db.close(); resolve(mode === 'raw' ? get.result : (get.result?.data ?? get.result)); };
    get.onerror = () => reject(get.error);
  };
})
"""

SEED_DB = """
(data) => new Promise((resolve, reject) => {
  const request = indexedDB.open('shiyan-local', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('journal');
  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction('journal', 'readwrite');
    transaction.objectStore('journal').put(data, 'app-state');
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => reject(transaction.error);
  };
  request.onerror = () => reject(request.error);
})
"""


def idea(text, record_id="note"):
    return dict(id=record_id, text=text, tags=[], pinned=False, pinnedAt=None, createdAt=1, updatedAt=1)


def library(*ideas, key="", goals=None):
    return dict(version=1, ideas=list(ideas), goals=goals or [], favorites=[], trash=[],
                prefs=dict(apiKey=key, model="deepseek-flash", theme="system", ideaSort="recent", goalSort="due"))


class Handler(SimpleHTTPRequestHandler):
    extra_worker = None

    def translate_path(self, path):
        if path.split("?")[0].startswith(BASE_PATH):
            path = "/" + path[len(BASE_PATH):]
        return super().translate_path(path)

    def do_GET(self):
        if self.path.split("?")[0] == BASE_PATH + "sw.js" and self.extra_worker:
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(self.extra_worker)
        else:
            super().do_GET()

    def log_message(self, *_args):
        pass


class BrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(Handler, directory=ROOT / "dist"))
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}{BASE_PATH}"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join()

    def setUp(self):
        self.context = self.browser.new_context(timezone_id="Asia/Shanghai")
        self.addCleanup(self.context.close)
        self.context.add_init_script(FAULTS)
        self.page = self.context.new_page()

    def open_app(self, page=None, tab="ideas"):
        page = page or self.page
        page.goto(self.base + "#/" + tab)
        expect(page.get_by_role("main")).to_be_visible()
        page.wait_for_load_state("networkidle")

    def seed(self, data, fallback=None):
        # Navigate to a same-origin resource without mounting the app.
        self.page.goto(self.base + "robots.txt")
        self.page.evaluate(SEED_DB, data)
        if fallback is not None:
            self.page.evaluate("(data) => localStorage.setItem('shiyan:state-fallback', JSON.stringify(data))", fallback)

    def create_idea(self, text, page=None):
        page = page or self.page
        page.get_by_role("button", name="新增念头", exact=True).click()
        page.get_by_role("textbox", name="写下一个念头").fill(text)
        page.get_by_role("button", name="收下", exact=True).click()
        expect(page.get_by_text(text, exact=True)).to_be_visible()

    def settings(self):
        self.page.get_by_role("button", name="打开设置").click()
        return self.page.get_by_role("dialog", name="设置", exact=True)

    def upload(self, data, version=1):
        payload = json.dumps(dict(app="shiyan", version=version, data=data), ensure_ascii=False).encode("utf-8")
        self.page.locator('input[type="file"]').set_input_files(
            {"name": "backup.json", "mimeType": "application/json", "buffer": payload})

    def test_boot_read_failure_leaves_legacy_data_untouched(self):
        text = "火" * 50001
        initial = library(idea(text))
        self.seed(initial)
        self.page.add_init_script("window.initialFaults = { read: true }")
        self.open_app()
        expect(self.page.get_by_role("heading", name="恢复本地数据")).to_be_visible()
        expect(self.page.get_by_role("button", name="重试读取")).to_be_visible()
        self.page.evaluate("faults.read = false")
        self.page.get_by_role("button", name="重试读取").click()
        expect(self.page.locator(".idea-card")).to_have_count(1)
        self.assertEqual(self.page.evaluate(READ_DB, "raw"), initial)
        self.assertEqual(self.page.evaluate("puts"), 0)

    def test_fallback_recovery_and_clear_never_revive_old_data(self):
        self.seed(library(idea("主库原有念头"), key="private"))
        self.open_app()
        self.page.evaluate("faults.write = true")
        self.create_idea("写入备用副本")
        expect(self.page.get_by_text("数据已保存在备用副本。")).to_be_visible()
        self.assertEqual(len(self.page.evaluate(READ_DB)["ideas"]), 1)
        self.page.reload()
        expect(self.page.get_by_text("写入备用副本")).to_be_visible()
        self.page.get_by_role("button", name="保存到主库").click()
        expect(self.page.get_by_text("数据已保存在备用副本。")).to_have_count(0)
        self.assertEqual(len(self.page.evaluate(READ_DB)["ideas"]), 2)
        self.assertIsNone(self.page.evaluate("(key) => localStorage.getItem(key)", FALLBACK_KEY))
        self.page.evaluate("faults.write = true")
        self.create_idea("清空前仅在备用副本")
        expect(self.page.get_by_text("数据已保存在备用副本。")).to_be_visible()
        self.settings().get_by_role("button", name="清除所有本地数据").click()
        self.page.get_by_role("button", name="清空全部数据", exact=True).click()
        expect(self.page.get_by_text("所有本地数据与密钥已清除。")).to_be_visible()
        self.page.add_init_script("window.initialFaults = { read: true }")
        self.page.reload()
        expect(self.page.get_by_role("button", name="写下第一念")).to_be_visible()
        emergency = self.page.evaluate("(key) => JSON.parse(localStorage.getItem(key)).snapshot.data", FALLBACK_KEY)
        self.assertEqual(emergency["ideas"], [])
        self.assertEqual(emergency["prefs"]["apiKey"], "")

    def test_legacy_divergence_keeps_both_copies_until_choice(self):
        original = library(idea("主库留存"))
        missing = library(idea("旧备用副本"))
        self.seed(original, fallback=missing)
        self.open_app()
        expect(self.page.get_by_role("heading", name="恢复本地数据")).to_be_visible()
        self.assertEqual(self.page.evaluate(READ_DB, "raw"), original)
        self.assertEqual(self.page.evaluate("(key) => JSON.parse(localStorage.getItem(key))", FALLBACK_KEY), missing)
        self.page.get_by_role("button", name="使用备用副本").click()
        expect(self.page.get_by_text("旧备用副本")).to_be_visible()
        self.assertEqual(self.page.evaluate(READ_DB)["ideas"][0]["text"], "旧备用副本")
        with self.page.expect_download() as downloaded:
            self.settings().get_by_role("button", name="导出另一份旧副本").click()
        archived = json.loads(downloaded.value.path().read_text(encoding="utf-8"))
        self.assertEqual(archived["data"]["ideas"][0]["text"], "主库留存")

    def test_failed_edit_stays_in_place_and_can_retry(self):
        self.seed(library(idea("已落盘的原文")))
        self.open_app()
        self.page.get_by_role("button", name="打开念头：已落盘的原文").click()
        self.page.evaluate("Object.assign(faults, { write: true, fallback: true })")
        editor = self.page.get_by_role("textbox", name="念头正文")
        editor.fill("两层写入失败后重试")
        finish = self.page.get_by_role("button", name="完成", exact=True)
        finish.click()
        expect(self.page.get_by_text("尚未保存。再次点击完成可以重试。")).to_be_visible()
        expect(editor).to_have_value("两层写入失败后重试")
        self.assertEqual(self.page.evaluate(READ_DB)["ideas"][0]["text"], "已落盘的原文")
        self.page.evaluate("Object.assign(faults, { write: false, fallback: false })")
        finish.click()
        expect(editor).not_to_be_visible()
        self.assertEqual(self.page.evaluate(READ_DB)["ideas"][0]["text"], "两层写入失败后重试")

    def test_immediate_reload_and_finish_navigation(self):
        self.seed(library(idea("保存之前")))
        self.open_app()
        self.page.get_by_role("button", name="打开念头：保存之前").click()
        editor = self.page.get_by_role("textbox", name="念头正文")
        editor.fill("最后输入立刻刷新")
        self.page.reload()
        expect(self.page.get_by_text("最后输入立刻刷新")).to_be_visible()
        self.page.get_by_role("button", name="打开念头：最后输入立刻刷新").click()
        editor.fill("点击完成后切页")
        self.page.get_by_role("button", name="完成", exact=True).click()
        expect(editor).not_to_be_visible()
        self.page.locator(".rail-nav").get_by_role("button", name="目标").click()
        self.page.reload()
        self.assertEqual(self.page.evaluate(READ_DB)["ideas"][0]["text"], "点击完成后切页")

    def test_stale_tab_retains_new_idea_and_same_record_edits(self):
        for same_record in (False, True):
            with self.subTest(same_record=same_record):
                shared = self.browser.new_context()
                shared.add_init_script(FAULTS)
                first, second = shared.new_page(), shared.new_page()
                try:
                    if same_record:
                        first.goto(self.base + "robots.txt")
                        first.evaluate(SEED_DB, library(idea("共同基线")))
                    self.open_app(first)
                    self.open_app(second)
                    second.evaluate("faults.ignoreChanges = true")
                    if same_record:
                        for page in (first, second):
                            page.get_by_role("button", name="打开念头：共同基线").click()
                        self.edit_and_finish(first, "甲先保存")
                        second.get_by_role("textbox", name="念头正文").fill("乙的编辑")
                        second.get_by_role("button", name="完成", exact=True).click()
                        expect(second.get_by_text("另一页已保存新版。", exact=False)).to_be_visible()
                        second.get_by_role("button", name="关闭", exact=True).click()
                    else:
                        self.create_idea("甲先保存", first)
                        self.create_idea("乙的编辑", second)
                    expect(second.get_by_role("button", name="读取最新版")).to_be_visible()
                    self.assertEqual(first.evaluate(READ_DB)["ideas"][0]["text"], "甲先保存")
                    second.get_by_role("button", name="读取最新版").click()
                    expect(second.get_by_role("button", name="将念头存为副本")).to_be_visible()
                    second.get_by_role("button", name="将念头存为副本").click()
                    expect(second.get_by_text("乙的编辑", exact=True)).to_be_visible()
                    expect(first.get_by_text("乙的编辑", exact=True)).to_be_visible()
                    self.assertEqual({item["text"] for item in first.evaluate(READ_DB)["ideas"]}, {"甲先保存", "乙的编辑"})
                finally:
                    shared.close()

    def edit_and_finish(self, page, text):
        page.get_by_role("textbox", name="念头正文").fill(text)
        page.get_by_role("button", name="完成", exact=True).click()
        expect(page.get_by_role("textbox", name="念头正文")).not_to_be_visible()

    def test_large_import_preserves_key_and_failed_replace_preserves_library(self):
        self.seed(library(idea("原库正文"), key="local-key"))
        self.open_app()
        settings = self.settings()
        self.upload(library(idea("不受支持的版本")), version=2)
        expect(settings.get_by_text("这份文件的应用标识或备份版本不受支持。")).to_be_visible()
        self.upload(library(idea("焰" * 50001), *[
            idea("字" * 50000, f"note-{index}") for index in range(71)
        ], key="file-key"))
        expect(settings.get_by_role("button", name="替换为这份备份")).to_be_visible()
        self.page.evaluate("Object.assign(faults, { write: true, fallback: true })")
        settings.get_by_role("button", name="替换为这份备份").click()
        expect(settings.get_by_text("导入未完成，当前数据已保留。")).to_be_visible()
        self.assertEqual(self.page.evaluate(READ_DB)["ideas"][0]["text"], "原库正文")
        self.page.evaluate("Object.assign(faults, { write: false, fallback: false })")
        settings.get_by_role("button", name="替换为这份备份").dblclick(delay=30)
        expect(settings.get_by_text("已导入 72 则念头、0 个目标。")).to_be_visible()
        self.assertEqual(self.page.evaluate("puts"), 1)
        with self.page.expect_download() as downloaded:
            settings.get_by_role("button", name="导出备份").click()
        backup = json.loads(downloaded.value.path().read_text(encoding="utf-8"))
        self.assertEqual(backup["data"]["prefs"]["apiKey"], "")
        self.assertEqual(len(backup["data"]["ideas"][0]["text"]), 50001)
        self.page.reload()
        self.page.get_by_role("main").wait_for()
        self.assertEqual(self.page.evaluate(READ_DB)["prefs"]["apiKey"], "local-key")

    def test_pwa_base_path_and_offline_and_portable_file(self):
        self.open_app()
        manifest = self.page.evaluate("fetch(document.querySelector('link[rel=manifest]').href).then(r => r.json())")
        self.assertEqual(manifest["scope"], BASE_PATH)
        self.assertEqual(manifest["start_url"], BASE_PATH)
        self.page.evaluate("navigator.serviceWorker.ready.then(() => true)")
        self.page.reload()
        self.page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=5000)
        self.create_idea("PWA 离线念头")
        self.context.set_offline(True)
        self.page.reload()
        expect(self.page.get_by_text("PWA 离线念头")).to_be_visible()

        portable = self.context.new_page()
        errors = []
        portable.on("pageerror", lambda error: errors.append(str(error)))
        portable.goto((ROOT / "shiyan.html").as_uri() + "#/goals")
        expect(portable.get_by_role("heading", name="目标", exact=True)).to_be_attached()
        portable.locator(".skip-link").focus()
        portable.keyboard.press("Enter")
        expect(portable.get_by_role("main")).to_be_focused()
        self.assertTrue(portable.url.endswith("#/goals"))
        portable.locator(".rail-nav").get_by_role("button", name="念头").click()
        self.create_idea("便携版离线念头", portable)
        portable.reload()
        expect(portable.get_by_text("便携版离线念头")).to_be_visible()
        self.assertEqual(errors, [])


    def test_pwa_update_flushes_pending_changes(self):
        self.open_app()
        self.page.evaluate("navigator.serviceWorker.ready.then(() => true)")
        self.page.reload()
        self.page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=5000)
        worker = (ROOT / "dist/sw.js").read_bytes()
        Handler.extra_worker = worker + b"\nself.architectureTestVersion = 2;\n"
        try:
            self.page.evaluate("navigator.serviceWorker.getRegistration().then(registration => registration.update())")
            update = self.page.get_by_role("button", name="更新", exact=True)
            expect(update).to_be_visible()
            with self.page.expect_event("load"):
                self.page.evaluate("""
                    () => {
                      document.querySelector('button[aria-label="切换到墨色主题"]').click();
                      document.querySelector('.update-banner button').click();
                    }
                """)
            self.page.get_by_role("main").wait_for()
            self.assertEqual(self.page.evaluate(READ_DB)["prefs"]["theme"], "dark")
        finally:
            Handler.extra_worker = None

    def test_keyboard_history_and_midnight_refresh(self):
        task = dict(id="today-step", title="跨日后到期", done=False, createdAt=1, updatedAt=1,
                    completedAt=None, dueDate="2026-11-28", priority="normal")
        goal = dict(id="daily-goal", title="跨日目标", why="", domain="life", dueDate="2026-11-28",
                    createdAt=1, updatedAt=1, tasks=[task])
        self.seed(library(goals=[goal]))
        self.page.clock.install(time="2026-11-27T23:55:00+08:00")
        self.open_app(tab="goals")
        for name, tab in (("目标", "goals"), ("火种", "fire"), ("念头", "ideas")):
            self.page.locator(".rail-nav").get_by_role("button", name=name).click()
            self.page.locator(".skip-link").focus()
            self.page.keyboard.press("Enter")
            expect(self.page.get_by_role("main")).to_be_focused()
            self.assertTrue(self.page.url.endswith("#/" + tab))
        self.page.go_back()
        self.assertTrue(self.page.url.endswith("#/fire"))
        self.page.go_back()
        self.assertTrue(self.page.url.endswith("#/goals"))
        self.page.go_forward()
        self.assertTrue(self.page.url.endswith("#/fire"))
        daily = self.page.locator(".daily-ember")
        yesterday = daily.inner_text()
        self.page.clock.fast_forward(10 * 60 * 1000)
        expect(daily).not_to_have_text(yesterday)
        expect(self.page.locator(".topbar-date")).to_contain_text("11月28日")
        self.page.locator(".rail-nav").get_by_role("button", name="目标").click()
        expect(self.page.locator(".task-due")).to_have_text("今天")
        expect(self.page.locator(".today-list").get_by_text("跨日后到期")).to_be_visible()

    def test_ai_rejects_partial_and_ignores_late_previous_run(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.emulate_media(reduced_motion="reduce", color_scheme="dark")
        data = library(idea("待润色原文"), key="mock-key")
        data["prefs"]["model"] = "deepseek-v4-pro"
        self.seed(data)
        self.open_app()
        self.page.evaluate("""() => {
            window.mockStreams = [];
            window.mockModels = [];
            window.fetch = async (_url, { body }) => {
              window.mockModels.push(JSON.parse(body).model);
              return new Response(new ReadableStream({
                start(controller) { window.mockStreams.push(controller); }
              }));
            };
        }""")

        def answer(index, text, finish=False):
            self.page.evaluate(r"""({ index, text, finish }) => {
              const stream = mockStreams[index];
              const events = 'data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n'
                + (finish ? 'data: {"choices":[{"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n' : '');
              stream.enqueue(new TextEncoder().encode(events));
              stream.close();
            }""", {"index": index, "text": text, "finish": finish})

        self.page.get_by_role("button", name="打开念头：待润色原文").click()
        original = self.page.get_by_role("textbox", name="念头正文")
        self.page.evaluate("""() => {
          Object.defineProperty(visualViewport, 'height', { configurable: true, value: 500 });
          visualViewport.dispatchEvent(new Event('resize'));
        }""")
        self.page.wait_for_function("""() => {
          const sheet = document.querySelector('.idea-detail-sheet.is-open.has-keyboard');
          return sheet && sheet.getBoundingClientRect().bottom <= 501;
        }""")
        self.page.evaluate("""() => {
          delete visualViewport.height;
          visualViewport.dispatchEvent(new Event('resize'));
        }""")
        self.page.get_by_role("button", name="AI 润色", exact=True).click()
        ai = self.page.get_by_role("dialog", name="让文字更靠近你")
        ai.get_by_role("button", name="开始润色").click()
        self.page.wait_for_function("mockStreams.length === 1")
        answer(0, "不完整")
        expect(ai.get_by_text("只收到部分文字。", exact=False)).to_be_visible()
        expect(ai.get_by_role("button", name="替换原文")).to_have_count(0)
        ai.get_by_role("button", name="再试一次").click()
        self.page.wait_for_function("mockStreams.length === 2")
        ai.get_by_role("button", name="停下").click()
        ai.get_by_role("button", name="重新落笔").click()
        self.page.wait_for_function("mockStreams.length === 3")
        answer(1, "旧请求", True)
        answer(2, "本次润色", True)
        expect(ai.get_by_text("本次润色", exact=True)).to_be_visible()
        expect(ai.get_by_text("旧请求", exact=True)).to_have_count(0)
        expect(ai.get_by_role("button", name="替换原文")).to_be_visible()
        ai.get_by_role("button", name="文气").click()
        expect(ai.get_by_text("落笔 · 理顺", exact=True)).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(ai).not_to_be_visible()
        expect(original).to_be_focused()
        expect(original).to_have_value("待润色原文")
        self.page.get_by_role("button", name="AI 润色", exact=True).click()
        expect(ai.get_by_role("button", name="替换原文")).to_have_count(0)
        ai.get_by_role("button", name="开始润色").click()
        self.page.wait_for_function("mockStreams.length === 4")
        answer(3, "待润色原文", True)
        expect(ai.get_by_text("这次润色保留了原来的写法。")).to_be_visible()
        expect(ai.get_by_role("button", name="替换原文")).to_have_count(0)
        ai.get_by_role("button", name="再来一版").click()
        self.page.wait_for_function("mockStreams.length === 5")
        answer(4, "已完成版本", True)
        ai.get_by_role("button", name="替换原文").click()
        expect(original).to_have_value("已完成版本")
        self.page.get_by_role("button", name="撤回", exact=True).click()
        expect(original).to_have_value("待润色原文")
        self.assertEqual(self.page.evaluate("mockModels"), ["deepseek-flash"] * 5)

    def test_nested_settings_close_preserves_parent_and_focus(self):
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.emulate_media(reduced_motion="reduce", color_scheme="dark")
        self.open_app()
        settings = self.settings()
        button = settings.get_by_role("button", name="查看最近删除")
        button.click()
        trash = self.page.get_by_role("dialog", name="最近删除")
        expect(trash).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(trash).not_to_be_visible()
        expect(settings).to_be_visible()
        expect(button).to_be_focused()
        self.page.keyboard.press("Escape")
        expect(settings).not_to_be_visible()
        expect(self.page.get_by_role("button", name="打开设置")).to_be_focused()
        self.assertFalse(self.page.evaluate("document.documentElement.classList.contains('modal-open')"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
