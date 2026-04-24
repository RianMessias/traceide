import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const APP_PATH = new URL("../app.js", import.meta.url);
const HTML_PATH = new URL("../index.html", import.meta.url);

function makeElement() {
  return {
    value: "",
    textContent: "",
    className: "",
    innerHTML: "",
    dataset: {},
    addEventListener() {},
    appendChild() {},
    removeChild() {},
    remove() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    setAttribute() {},
    getAttribute() { return null; },
    select() {},
    click() {},
    classList: {
      toggle() {},
      add() {},
      remove() {}
    }
  };
}

function loadAppInSandbox() {
  const source = fs.readFileSync(APP_PATH, "utf8");
  const elementCache = new Map();
  const documentStub = {
    getElementById(id) {
      if (!elementCache.has(id)) {
        elementCache.set(id, makeElement());
      }
      return elementCache.get(id);
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return makeElement();
    },
    body: makeElement(),
    documentElement: makeElement()
  };

  const sandbox = {
    document: documentStub,
    themeBtn: makeElement(),
    window: {
      open() {},
      setTimeout,
      clearTimeout
    },
    navigator: {
      clipboard: {
        writeText() {
          return Promise.resolve();
        }
      }
    },
    globalThis: {
      crypto: {
        randomUUID() {
          return "test-uuid";
        }
      }
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {}
    },
    DOMParser: class {
      parseFromString() {
        return {
          querySelector() {
            return null;
          },
          documentElement: {
            nodeType: 1,
            nodeName: "root",
            attributes: [],
            childNodes: []
          }
        };
      }
    },
    XMLSerializer: class {
      serializeToString() {
        return "<root/>";
      }
    },
    Node: {
      TEXT_NODE: 3,
      CDATA_SECTION_NODE: 4,
      COMMENT_NODE: 8,
      ELEMENT_NODE: 1
    },
    URL,
    AbortController,
    performance: {
      now() {
        return 0;
      }
    },
    fetch: async () => ({
      status: 200,
      statusText: "OK",
      ok: true,
      text: async () => "",
      headers: {
        forEach() {}
      }
    }),
    Blob: class {},
    setTimeout,
    clearTimeout,
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

test("XSS sinks em notificacao foram removidos", () => {
  const source = fs.readFileSync(APP_PATH, "utf8");
  assert.equal(source.includes("toast.innerHTML"), false);
  assert.equal(source.includes("onclick="), false);
  assert.match(source, /content\.textContent\s*=\s*String\(message/);
});

test("CSP esta restrita para conexoes HTTPS", () => {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  assert.match(html, /connect-src https:/);
  assert.equal(/connect-src\s+https:\s+http:/.test(html), false);
});

test("Validador de URL bloqueia destinos inseguros", () => {
  const sandbox = loadAppInSandbox();
  assert.equal(typeof sandbox.parseAndValidateRequestUrl, "function");

  const ok = sandbox.parseAndValidateRequestUrl("https://example.com/api");
  assert.equal(Boolean(ok.url), true);
  assert.equal(Boolean(ok.error), false);

  const insecure = sandbox.parseAndValidateRequestUrl("http://example.com");
  assert.match(insecure.error, /HTTPS/i);

  const localhost = sandbox.parseAndValidateRequestUrl("https://localhost:8443");
  assert.match(localhost.error, /local\/privado/i);

  const privateIp = sandbox.parseAndValidateRequestUrl("https://192.168.0.15");
  assert.match(privateIp.error, /local\/privado/i);

  const ipv6Loopback = sandbox.parseAndValidateRequestUrl("https://[::1]");
  assert.match(ipv6Loopback.error, /local\/privado/i);

  const ipv6MappedLoopback = sandbox.parseAndValidateRequestUrl("https://[::ffff:7f00:1]");
  assert.match(ipv6MappedLoopback.error, /local\/privado/i);

  const withCreds = sandbox.parseAndValidateRequestUrl("https://user:pass@example.com");
  assert.match(withCreds.error, /credenciais/i);
});

test("Parser de headers bloqueia entradas perigosas", () => {
  const sandbox = loadAppInSandbox();
  assert.equal(typeof sandbox.parseHeadersFromText, "function");

  const good = sandbox.parseHeadersFromText("Authorization: Bearer abc\nX-Test: ok");
  assert.equal(good.errors.length, 0);
  assert.equal(good.headers["X-Test"], "ok");

  const blocked = sandbox.parseHeadersFromText("Host: internal.service");
  assert.equal(blocked.errors.length > 0, true);
  assert.match(blocked.errors[0], /bloqueado por seguranca/i);

  const invalid = sandbox.parseHeadersFromText("Bad Header Without Colon");
  assert.equal(invalid.errors.length > 0, true);
});

test("Sem uso de APIs perigosas dinamicas", () => {
  const source = fs.readFileSync(APP_PATH, "utf8");
  assert.equal(/eval\s*\(/.test(source), false);
  assert.equal(/new Function\s*\(/.test(source), false);
  assert.equal(/document\.write\s*\(/.test(source), false);
});

test("Renderizacao escapa payload malicioso no resumo", () => {
  const sandbox = loadAppInSandbox();
  const payload = `TypeError: <img src=x onerror=alert(1)>\n    at fn (/tmp/app.js:1:1)`;
  const result = sandbox.analyzeTrace(payload, "auto");
  sandbox.renderSummary(result);
  const summaryEl = sandbox.document.getElementById("summary");
  assert.equal(summaryEl.innerHTML.includes("<img src=x onerror=alert(1)>"), false);
  assert.equal(summaryEl.innerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"), true);
});
