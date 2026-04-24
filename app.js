// DOM ELEMENTS
const traceInput = document.getElementById("traceInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const exportBtn = document.getElementById("exportBtn");
const ticketBtn = document.getElementById("ticketBtn");
const clearBtn = document.getElementById("clearBtn");
const languageModeSelect = document.getElementById("languageModeSelect");
const ideSelect = document.getElementById("ideSelect");
const onlyAppBtn = document.getElementById("onlyAppBtn");
const summaryEl = document.getElementById("summary");
const timelineEl = document.getElementById("timeline");
const orderedFramesEl = document.getElementById("orderedFrames");
const normalizedEl = document.getElementById("normalized");
const notificationContainer = document.getElementById("notification-container");
const navLinks = Array.from(document.querySelectorAll(".js-nav"));
const screens = Array.from(document.querySelectorAll(".screen"));
const explorerSearchInput = document.getElementById("explorerSearch");
const explorerFramesEl = document.getElementById("explorerFrames");
const historyListEl = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const jsonInputEl = document.getElementById("jsonInput");
const jsonOutputEl = document.getElementById("jsonOutput");
const jsonFormatBtn = document.getElementById("jsonFormatBtn");
const jsonMinifyBtn = document.getElementById("jsonMinifyBtn");
const jsonValidateBtn = document.getElementById("jsonValidateBtn");
const jsonCopyBtn = document.getElementById("jsonCopyBtn");
const xmlInputEl = document.getElementById("xmlInput");
const xmlOutputEl = document.getElementById("xmlOutput");
const xmlFormatBtn = document.getElementById("xmlFormatBtn");
const xmlMinifyBtn = document.getElementById("xmlMinifyBtn");
const xmlValidateBtn = document.getElementById("xmlValidateBtn");
const xmlCopyBtn = document.getElementById("xmlCopyBtn");
const reqMethodEl = document.getElementById("reqMethod");
const reqUrlEl = document.getElementById("reqUrl");
const reqHeadersEl = document.getElementById("reqHeaders");
const reqBodyEl = document.getElementById("reqBody");
const sendReqBtn = document.getElementById("sendReqBtn");
const reqMetaEl = document.getElementById("reqMeta");
const reqResponseHeadersEl = document.getElementById("reqResponseHeaders");
const reqResponseBodyEl = document.getElementById("reqResponseBody");
const reqTabBtns = Array.from(document.querySelectorAll("[data-req-tab]"));
const resTabBtns = Array.from(document.querySelectorAll("[data-res-tab]"));
const themeBtn = document.getElementById("themeBtn");

// STATE
let lastAnalysis = null;
let currentScreen = "input";
let onlyAppState = false;
let collapsedFrames = new Set();
let clickedFrame = null;
// CONSTANTS
const HISTORY_KEY = "traceHistoryV1";
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RESPONSE_CHARS = 300000;
const MAX_URL_CHARS = 4096;
const MAX_HEADER_LINES = 64;
const MAX_HEADER_KEY_CHARS = 256;
const MAX_HEADER_VALUE_CHARS = 8192;
const MAX_BODY_CHARS = 200000;
const SAFE_NOTIFICATION_TYPES = new Set(["success", "error", "info", "warning"]);

// Toast icons
const icons = {
  success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#27c93f" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
  error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
  info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#ffbd2e" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h18.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`
};

function showNotification(message, type = "info", duration = 4000) {
  if (!notificationContainer) {
    console.log("notification:", message);
    return;
  }
  const safeType = SAFE_NOTIFICATION_TYPES.has(type) ? type : "info";
  const toast = document.createElement("div");
  toast.className = `toast toast-${safeType}`;
  const iconWrap = document.createElement("span");
  iconWrap.className = "toast-icon-wrap";
  iconWrap.innerHTML = icons[safeType] || icons.info;

  const content = document.createElement("span");
  content.className = "toast-content";
  content.textContent = String(message || "");

  const closeBtn = document.createElement("button");
  closeBtn.className = "toast-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Fechar");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => toast.remove());

  toast.appendChild(iconWrap);
  toast.appendChild(content);
  toast.appendChild(closeBtn);
  notificationContainer.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
}

function dismissNotification(id) {
  const toast = document.getElementById(id);
  if (toast) toast.remove();
}

// LIB MARKERS
const libMarkers = [
  "node_modules",
  "internal/",
  "site-packages",
  "/usr/lib/",
  "system.private.corelib",
  "java.base/",
  "sun.reflect",
  "org.springframework",
  "microsoft."
];

// CONFIG
const categoryRules = [
  {
    id: "null_ref",
    label: "Null/Undefined",
    pattern: /(TypeError|NullReferenceException|AttributeError|NoneType)/i,
    checklist: [
      "Validar parametro e retorno antes de acessar propriedade.",
      "Logar input da funcao imediatamente anterior ao frame raiz."
    ]
  },
  {
    id: "timeout_network",
    label: "Timeout/Network",
    pattern: /(timeout|timed out|ECONNREFUSED|ENOTFOUND|socket|connection)/i,
    checklist: [
      "Validar endpoint, credencial e DNS.",
      "Aplicar retry com backoff apenas para falhas transientes."
    ]
  },
  {
    id: "auth",
    label: "Auth/Permissao",
    pattern: /(401|403|unauthorized|forbidden|permission|access denied)/i,
    checklist: [
      "Conferir token/claims/roles da requisicao.",
      "Validar escopo exigido no endpoint."
    ]
  },
  {
    id: "data_parse",
    label: "Dados/Parse",
    pattern: /(SyntaxError|ParseException|JSON|deserialize|format exception)/i,
    checklist: [
      "Logar payload bruto e schema esperado.",
      "Validar campos obrigatorios antes do parse."
    ]
  },
  {
    id: "db_sql",
    label: "Banco/SQL",
    pattern: /(sql|database|deadlock|constraint|duplicate key|DbUpdateException)/i,
    checklist: [
      "Executar query/command isoladamente com os mesmos parametros.",
      "Verificar lock, indice e violacao de constraint."
    ]
  }
];

function detectLanguage(lines) {
  const full = lines.join("\n");
  if (/^\s*File ".*", line \d+, in /m.test(full) || /Traceback \(most recent call last\)/.test(full)) return "Python";
  if (/^\s*at\s+[\w.]+\(.*\)\s+in\s+.*:line\s+\d+/m.test(full) || /\bSystem\.\w+Exception\b/.test(full)) return ".NET";
  if (/^\s*at\s+[\w$.]+\(.*:\d+\)/m.test(full) || /Exception in thread/.test(full)) return "Java";
  if (/^\s*at\s+.*\(.+:\d+:\d+\)/m.test(full) || /^\s*at\s+.+:\d+:\d+/m.test(full)) return "Node/JS";
  return "Desconhecido";
}

function getAppPrefixes() {
  return [];
}

// PARSERS
function parseErrorHeader(lines) {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/Traceback \(most recent call last\)/.test(trimmed)) continue;
    if (/^\s*at\s+/.test(trimmed)) continue;
    if (/^\s*File\s+/.test(trimmed)) continue;
    if (/^\s*\.\.\./.test(trimmed)) continue;
    return trimmed;
  }
  return "Nao foi possivel detectar mensagem de erro principal.";
}

function parseCauseChain(lines) {
  const causes = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const causedBy = trimmed.match(/^Caused by:\s*(.+)$/i);
    if (causedBy) {
      causes.push(causedBy[1]);
      continue;
    }

    const inner = trimmed.match(/^InnerException[:\s-]+(.+)$/i);
    if (inner) {
      causes.push(inner[1]);
      continue;
    }

    const dotnetInner = trimmed.match(/^--->\s*(.+)$/);
    if (dotnetInner) {
      causes.push(dotnetInner[1]);
      continue;
    }
  }
  return uniqueLines(causes);
}

function classifyCategories(errorLine, normalized) {
  const source = `${errorLine}\n${normalized}`;
  const categories = categoryRules.filter((rule) => rule.pattern.test(source));
  if (categories.length) return categories;
  return [
    {
      id: "generic",
      label: "Investigacao Geral",
      checklist: [
        "Checar frame raiz e adicionar log de entrada/saida.",
        "Relacionar com correlationId/requestId do mesmo horario."
      ]
    }
  ];
}

function extractFrames(lines, language, appPrefixes) {
  const frames = [];

  for (const line of lines) {
    const raw = line.trim();
    if (!raw) continue;

    if (language === "Python") {
      const py = raw.match(/^File "(.+)", line (\d+), in (.+)$/);
      if (py) {
        frames.push({ raw, fn: py[3], path: py[1], line: Number(py[2]) });
      }
      continue;
    }

    if (language === "Node/JS") {
      const withFn = raw.match(/^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/);
      const noFn = raw.match(/^at\s+(.+):(\d+):(\d+)$/);
      if (withFn) {
        frames.push({ raw, fn: withFn[1], path: withFn[2], line: Number(withFn[3]), col: Number(withFn[4]) });
      } else if (noFn) {
        frames.push({ raw, fn: "(anonymous)", path: noFn[1], line: Number(noFn[2]), col: Number(noFn[3]) });
      }
      continue;
    }

    if (language === "Java") {
      const java = raw.match(/^at\s+(.+)\((.+):(\d+)\)$/);
      if (java) {
        frames.push({ raw, fn: java[1], path: java[2], line: Number(java[3]) });
      }
      continue;
    }

    if (language === ".NET") {
      const dotnet = raw.match(/^at\s+(.+)\s+in\s+(.+):line\s+(\d+)$/i);
      if (dotnet) {
        frames.push({ raw, fn: dotnet[1], path: dotnet[2], line: Number(dotnet[3]) });
      }
      continue;
    }

    if (/^\s*at\s+/.test(raw)) {
      frames.push({ raw });
    }
  }

  return frames.map((frame, index) => ({
    ...frame,
    index,
    fileName: getFileName(frame.path || frame.raw || ""),
    sourceType: inferSourceType(frame.path, appPrefixes)
  }));
}

function getFileName(path) {
  if (!path) return "desconhecido";
  const normalized = String(path).replace(/\\/g, "/");
  return normalized.split("/").pop() || normalized;
}

function isLikelyLibraryPath(path = "") {
  const value = String(path || "").toLowerCase();
  return libMarkers.some((marker) => value.includes(marker));
}

function inferSourceType(path, appPrefixes) {
  const value = String(path || "").toLowerCase();
  if (!value) return "lib";
  if (isLikelyLibraryPath(value)) return "lib";
  return "app";
}

function normalizeSourceType(value) {
  return value === "app" ? "app" : "lib";
}

function inferRootCauseFrame(frames) {
  if (!frames.length) return null;
  const firstApp = frames.find((frame) => frame.sourceType === "app");
  return firstApp || frames[0];
}

function buildOrderedFrames(frames, rootFrame) {
  if (!frames.length) return [];
  if (!rootFrame) return frames;

  const root = frames.find((frame) => frame.index === rootFrame.index);
  const rest = frames.filter((frame) => frame.index !== rootFrame.index);
  const app = rest.filter((frame) => frame.sourceType === "app");
  const libs = rest.filter((frame) => frame.sourceType === "lib");
  return [root, ...app, ...libs];
}

function uniqueLines(lines) {
  const seen = new Set();
  const cleaned = [];
  for (const line of lines) {
    const key = line.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(line);
  }
  return cleaned;
}

function hashFingerprint(input) {
  let hash = 2166136261;
  const text = String(input || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fp_${(hash >>> 0).toString(16)}`;
}

function buildFingerprint(errorLine, rootFrame) {
  const root = rootFrame
    ? `${normalizePathForCopy(rootFrame.path || rootFrame.fileName)}:${rootFrame.line || "-"}`
    : "no-root";
  return hashFingerprint(`${errorLine}|${root}`);
}

function countFingerprintOccurrences(fingerprint, history) {
  return history.filter((item) => item.fingerprint === fingerprint).length;
}

function buildHypotheses(result) {
  const root = result.rootFrame
    ? `${normalizePathForCopy(result.rootFrame.path || result.rootFrame.fileName)}:${result.rootFrame.line || "-"}`
    : "nao encontrado";
  const category = result.categories[0]?.label || "Investigacao Geral";
  const hypotheses = [];

  hypotheses.push({
    title: "Hipotese 1",
    statement: `Falha principal em ${root} ligada a categoria ${category}.`,
    test: "Adicionar log de entrada/saida no metodo anterior e reproduzir com mesmo payload.",
    evidence: "Valores de entrada invalidos, nulos ou inconsistentes antes da excecao."
  });

  if (/timeout|network/i.test(category)) {
    hypotheses.push({
      title: "Hipotese 2",
      statement: "Dependencia externa instavel ou indisponivel no momento da chamada.",
      test: "Executar chamada isolada com timeout maior e coletar latencia por tentativa.",
      evidence: "Erros intermitentes de conexao e sucesso parcial apos retry."
    });
  } else if (/Null|Undefined/i.test(category)) {
    hypotheses.push({
      title: "Hipotese 2",
      statement: "Objeto esperado nao foi populado no fluxo anterior.",
      test: "Validar retorno de repositorio/servico antes do ponto da falha.",
      evidence: "Campo chave vazio ou objeto inexistente no passo anterior."
    });
  } else if (/Banco|SQL/i.test(category)) {
    hypotheses.push({
      title: "Hipotese 2",
      statement: "Violacao de constraint ou lock concorrente no banco.",
      test: "Executar query com os mesmos parametros e inspecionar lock/constraint.",
      evidence: "Erro reproduzido com SQLState/constraint identica."
    });
  } else {
    hypotheses.push({
      title: "Hipotese 2",
      statement: "Contexto de execucao divergente (dados, tenant ou permissao).",
      test: "Comparar payload e contexto entre execucao que falha e execucao que passa.",
      evidence: "Diferença em claims, tenant, permissao ou formato de entrada."
    });
  }

  hypotheses.push({
    title: "Hipotese 3",
    statement: "Erro reaparece por assinatura conhecida sem mitigacao aplicada.",
    test: "Buscar fingerprint no historico e validar se mesma causa ja ocorreu.",
    evidence: "Mesma fingerprint com aumento de recorrencia."
  });

  return hypotheses;
}

function buildActions(errorLine, rootFrame, categories) {
  const actions = [];
  actions.push("Comecar no card 1* e validar entradas imediatamente anteriores.");
  if (rootFrame?.path && rootFrame?.line) {
    actions.push(`Abrir ${rootFrame.path}:${rootFrame.line}.`);
  }
  categories[0]?.checklist?.forEach((item) => actions.push(item));
  return actions.slice(0, 4);
}

function analyzeTrace(raw, forcedLanguage = "auto") {
  let processedRaw = raw;
  let metadata = {};

  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const json = JSON.parse(trimmed);
      const parts = [];

      const errorFieldKeys = [
        "ExceptionType", "ExceptionMessage", "message", "msg", "error",
        "errorMessage", "error_message", "@exception", "exception_message", "exception"
      ];
      const stackFieldKeys = [
        "StackTrace", "stack_trace", "stackTrace", "trace", "stack", "exception_stack", "@stack_trace"
      ];
      const innerFieldKeys = [
        "InnerException", "inner_exception", "innerException", "cause", "@inner_exception"
      ];

      const errorFields = errorFieldKeys.find(k => json[k]);
      const stackFields = stackFieldKeys.find(k => json[k]);
      const innerFields = innerFieldKeys.find(k => json[k]);

      if (errorFields) {
        parts.push(String(json[errorFields]));
      }

      if (stackFields) {
        parts.push(String(json[stackFields]));
      }

      if (innerFields) {
        parts.push(String(json[innerFields]));
      }

      const correlationIdKeys = [
        "correlationId", "correlation_id", "requestId", "request_id",
        "traceId", "trace_id", "transactionId", "transaction_id",
        "x_correlation_id", "x_request_id", "x-correlation-id", "x-request-id"
      ];
      const correlationId = correlationIdKeys.find(k => json[k] && String(json[k]).trim());
      if (correlationId) {
        metadata.correlationId = String(json[correlationId]);
      }

      const requestIdKeys = [
        "RequestId", "requestId", "aws_request_id", "RequestID", "LambdaRequestId"
      ];
      const requestId = requestIdKeys.find(k => json[k]);
      if (requestId) {
        metadata.requestId = String(json[requestId]);
      }

      if (json.timestamp || json["@timestamp"] || json.time) {
        metadata.timestamp = json.timestamp || json["@timestamp"] || json.time;
      }

      if (json.level || json.severity || json.log_level || json.Level) {
        metadata.level = json.level || json.severity || json.log_level || json.Level;
      }

      if (json.service || json.service_name || json.servicename || json.ApplicationName) {
        metadata.service = json.service || json.service_name || json.servicename || json.ApplicationName;
      }

      if (json.hostname || json.host || json.MachineName || json.source_host) {
        metadata.host = json.hostname || json.host || json.MachineName || json.source_host;
      }

      if (parts.length > 0) {
        processedRaw = parts.join("\n");
      }
    } catch {
      // não é JSON válido, usa o raw original
    }
  }

  const lines = processedRaw.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { error: "Nenhum conteudo informado." };

  const appPrefixes = getAppPrefixes();
  const language = forcedLanguage && forcedLanguage !== "auto" ? forcedLanguage : detectLanguage(lines);
  const errorLine = parseErrorHeader(lines);
  const frames = extractFrames(lines, language, appPrefixes);
  const rootFrame = inferRootCauseFrame(frames);
  const orderedFrames = buildOrderedFrames(frames, rootFrame);
  const normalized = uniqueLines(lines).join("\n");
  const causes = parseCauseChain(lines);
  const categories = classifyCategories(errorLine, normalized);
  const actions = buildActions(errorLine, rootFrame, categories);
  const fingerprint = buildFingerprint(errorLine, rootFrame);
  const history = loadHistory();
  const occurrences = countFingerprintOccurrences(fingerprint, history) + 1;
  const hypotheses = buildHypotheses({
    rootFrame,
    categories
  });

  return {
    language,
    errorLine,
    frames,
    orderedFrames,
    rootFrame,
    normalized,
    appPrefixes,
    causes,
    categories,
    actions,
    fingerprint,
    occurrences,
    hypotheses,
    metadata
  };
}

function renderOrderedFrames(result) {
  const onlyApp = onlyAppState;
  const visibleFrames = onlyApp ? result.orderedFrames.filter((frame) => frame.sourceType === "app") : result.orderedFrames;

  if (!visibleFrames.length) {
    orderedFramesEl.textContent = onlyApp
      ? "Nenhum frame app encontrado com os prefixos configurados."
      : "Nao foi possivel extrair frames estruturados desse stack trace.";
    orderedFramesEl.className = "content";
    return;
  }

  const cards = visibleFrames.map((frame, i) => {
    const line = frame.line ? String(frame.line) : "-";
    const path = frame.path || frame.raw || "-";
    const fn = frame.fn || "-";
    const source = normalizeSourceType(frame.sourceType);
    const isRoot = result.rootFrame && frame.index === result.rootFrame.index;

    return `
      <article class="frame-card${isRoot ? " root-row" : ""}">
        <div class="frame-top">
          <span class="order">${i + 1}${isRoot ? "*" : ""}</span>
          <span class="file-name">${escapeHtml(frame.fileName || "-")}</span>
          <span class="tag tag-${source}">${source}</span>
        </div>
        <div class="frame-grid">
          <div class="field">
            <span class="label">Caminho</span>
            <span class="value mono break">${escapeHtml(path)}</span>
          </div>
          <div class="field short">
            <span class="label">Linha</span>
            <span class="value">${escapeHtml(line)}</span>
          </div>
          <div class="field">
            <span class="label">Funcao</span>
            <span class="value mono break">${escapeHtml(fn)}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="mini-btn" type="button" data-frame-index="${frame.index}" data-copy="pathline">Copiar caminho:linha</button>
          <button class="mini-btn" type="button" data-frame-index="${frame.index}" data-copy="frame">Copiar frame</button>
          ${frame.path ? `<button class="mini-btn ide-btn" type="button" data-frame-index="${frame.index}" data-action="ide">Abrir no IDE</button>` : ""}
        </div>
      </article>
    `;
  });

  orderedFramesEl.innerHTML = `
    <div class="frames-list">${cards.join("")}</div>
    <div class="hint">* card marcado com asterisco = causa provavel.</div>
  `;
  orderedFramesEl.className = "content";
}

function switchScreen(screenName) {
  currentScreen = screenName;
  screens.forEach((screen) => {
    const isActive = screen.id === `screen-${screenName}`;
    screen.classList.toggle("active", isActive);
  });

  navLinks.forEach((link) => {
    const match = link.dataset.screen === screenName;
    link.classList.toggle("active", match);
  });
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function saveHistoryItem(result) {
  const randomId = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
  const item = {
    id: randomId,
    ts: new Date().toISOString(),
    language: result.language,
    errorLine: redactSensitiveText(result.errorLine),
    root: result.rootFrame
      ? redactSensitiveText(`${normalizePathForCopy(result.rootFrame.path || result.rootFrame.fileName)}:${result.rootFrame.line || "-"}`)
      : "nao encontrado",
    categories: result.categories.map((category) => category.label),
    frames: result.frames.length,
    fingerprint: result.fingerprint || "-"
  };
  const list = loadHistory();
  list.unshift(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
}

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderHistory() {
  if (!historyListEl) return;
  const history = loadHistory();
  if (!history.length) {
    historyListEl.textContent = "Sem historico.";
    historyListEl.className = "content empty";
    return;
  }

  historyListEl.innerHTML = `
    <div class="history-list">
      ${history.map((item) => `
        <article class="history-item">
          <div class="history-head">
            <strong>${escapeHtml(item.language)}</strong>
            <span>${escapeHtml(formatDateTime(item.ts))}</span>
          </div>
          <div class="history-line"><span>Erro:</span> ${escapeHtml(item.errorLine)}</div>
          <div class="history-line"><span>Raiz:</span> ${escapeHtml(item.root)}</div>
          <div class="history-line"><span>Fingerprint:</span> ${escapeHtml(item.fingerprint || "-")}</div>
          <div class="history-line"><span>Categorias:</span> ${escapeHtml((item.categories || []).join(", ") || "-")}</div>
          <div class="history-line"><span>Frames:</span> ${escapeHtml(String(item.frames || 0))}</div>
        </article>
      `).join("")}
    </div>
  `;
  historyListEl.className = "content";
}

function renderExplorer(result, searchTerm = "") {
  if (!explorerFramesEl) return;
  if (!result) {
    explorerFramesEl.textContent = "Sem dados. Execute uma analise.";
    explorerFramesEl.className = "content empty";
    return;
  }

  const q = searchTerm.trim().toLowerCase();
  const filtered = result.orderedFrames.filter((frame) => {
    if (!q) return true;
    return [
      frame.fileName,
      frame.path,
      frame.fn,
      frame.raw
    ].some((value) => String(value || "").toLowerCase().includes(q));
  });

  if (!filtered.length) {
    explorerFramesEl.textContent = "Nenhum frame encontrado para esse filtro.";
    explorerFramesEl.className = "content empty";
    return;
  }

  explorerFramesEl.innerHTML = `
    <div class="explorer-list">
      ${filtered.map((frame, idx) => `
        <article class="explorer-item">
          <div class="explorer-head">
            <span class="order">${idx + 1}</span>
            <strong>${escapeHtml(frame.fileName || "-")}</strong>
            <span class="tag tag-${normalizeSourceType(frame.sourceType)}">${escapeHtml(normalizeSourceType(frame.sourceType))}</span>
          </div>
          <div class="history-line"><span>Caminho:</span> ${escapeHtml(frame.path || "-")}</div>
          <div class="history-line"><span>Linha:</span> ${escapeHtml(String(frame.line || "-"))}</div>
          <div class="history-line"><span>Funcao:</span> ${escapeHtml(frame.fn || "-")}</div>
          <div class="card-actions">
            <button class="mini-btn" type="button" data-frame-index="${frame.index}" data-copy="pathline">Copiar caminho:linha</button>
            <button class="mini-btn" type="button" data-frame-index="${frame.index}" data-copy="frame">Copiar frame</button>
            ${frame.path ? `<button class="mini-btn ide-btn" type="button" data-frame-index="${frame.index}" data-action="ide">Abrir no IDE</button>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
  explorerFramesEl.className = "content";
}

// RENDERERS
function renderTimeline(result) {
  if (!timelineEl) return;
  if (!result.frames || !result.frames.length) {
    timelineEl.innerHTML = '<div class="empty">Nenhum frame para timeline.</div>';
    timelineEl.className = "content empty";
    return;
  }
  const events = result.frames.slice(0, 15).map((frame, i) => {
    const line = frame.line || "-";
    const file = frame.fileName || frame.raw || "unknown";
    const isRoot = result.rootFrame && frame.index === result.rootFrame.index;
    return `<div class="timeline-item${isRoot ? " root" : ""}">
      <span class="timeline-order">${i + 1}${isRoot ? "*" : ""}</span>
      <span class="timeline-file">${escapeHtml(file)}</span>
      <span class="timeline-line">:${escapeHtml(String(line))}</span>
    </div>`;
  }).join("");
  timelineEl.innerHTML = `<div class="timeline-list">${events}</div>
    <div class="hint">* = causa raiz provavel</div>`;
  timelineEl.className = "content";
}

function renderSummary(result) {
  const root = result.rootFrame
    ? `${normalizePathForCopy(result.rootFrame.path || result.rootFrame.fileName)}:${result.rootFrame.line || "-"}`
    : "nao encontrado";
  const categories = result.categories.map((category) => `<span class="tag tag-cat">${escapeHtml(category.label)}</span>`).join("");
  const causes = result.causes.length
    ? `<ul class="summary-list">${result.causes.map((cause) => `<li>${escapeHtml(cause)}</li>`).join("")}</ul>`
    : `<div class="muted-line">Sem inner exception/caused by detectado.</div>`;
  const hypotheses = result.hypotheses && result.hypotheses.length
    ? `<ul class="summary-list">${result.hypotheses.map((item) => `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.statement)}<br><span class="muted-line">Teste:</span> ${escapeHtml(item.test)}<br><span class="muted-line">Evidencia:</span> ${escapeHtml(item.evidence)}</li>`).join("")}</ul>`
    : `<div class="muted-line">Sem hipoteses geradas.</div>`;

  const meta = result.metadata || {};
  const metadataHtml = [];
  if (meta.correlationId) {
    metadataHtml.push(`<div class="kv"><span>Correlation ID</span><strong class="mono copyable" data-copy="${escapeHtml(meta.correlationId)}">${escapeHtml(meta.correlationId)}</strong></div>`);
  }
  if (meta.requestId) {
    metadataHtml.push(`<div class="kv"><span>Request ID</span><strong class="mono copyable" data-copy="${escapeHtml(meta.requestId)}">${escapeHtml(meta.requestId)}</strong></div>`);
  }
  if (meta.timestamp) {
    metadataHtml.push(`<div class="kv"><span>Timestamp</span><strong>${escapeHtml(meta.timestamp)}</strong></div>`);
  }
  if (meta.level) {
    metadataHtml.push(`<div class="kv"><span>Level</span><strong>${escapeHtml(meta.level)}</strong></div>`);
  }
  if (meta.service) {
    metadataHtml.push(`<div class="kv"><span>Servico</span><strong>${escapeHtml(meta.service)}</strong></div>`);
  }
  if (meta.host) {
    metadataHtml.push(`<div class="kv"><span>Host</span><strong>${escapeHtml(meta.host)}</strong></div>`);
  }

  const metadataSection = metadataHtml.length > 0
    ? `<section class="summary-card"><h3>Metadados</h3>${metadataHtml.join("")}</section>`
    : "";

  summaryEl.innerHTML = `
    <div class="summary-grid">
      <section class="summary-card">
        <h3>Diagnostico</h3>
        <div class="kv"><span>Linguagem</span><strong>${escapeHtml(result.language)}</strong></div>
        <div class="kv"><span>Erro principal</span><strong>${escapeHtml(result.errorLine)}</strong></div>
        <div class="kv"><span>Causa provavel</span><strong class="mono break">${escapeHtml(root)}</strong></div>
        <div class="kv"><span>Frames</span><strong>${result.frames.length}</strong></div>
        <div class="kv"><span>Fingerprint</span><strong class="mono">${escapeHtml(result.fingerprint || "-")}</strong></div>
        <div class="kv"><span>Ocorrencias</span><strong>${escapeHtml(String(result.occurrences || 0))}</strong></div>
      </section>
      <section class="summary-card">
        <h3>Categorias</h3>
        <div class="tag-wrap">${categories}</div>
        <h3>Checklist</h3>
        <ul class="summary-list">${result.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>
      </section>
      <section class="summary-card">
        <h3>Causa Encadeada</h3>
        ${causes}
      </section>
      <section class="summary-card">
        <h3>Hipoteses Testaveis</h3>
        ${hypotheses}
      </section>
      ${metadataSection}
    </div>
  `;
  summaryEl.className = "content";
}

// UTILITIES
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }
  const tmp = document.createElement("textarea");
  tmp.value = text;
  document.body.appendChild(tmp);
  tmp.select();
  document.execCommand("copy");
  document.body.removeChild(tmp);
}

function openInIDE(path, line) {
  if (!path) return;
  showNotification(`Abrindo ${path}:${line}...`, "info", 2000);
  const normalized = String(path).replace(/\\/g, "/");
  const safePath = encodeURI(normalized);
  const parsedLine = Number(line);
  const lineNum = Number.isFinite(parsedLine) && parsedLine > 0 ? String(Math.floor(parsedLine)) : "1";
  const fullPath = `${normalized}:${lineNum}`;
  copyToClipboard(fullPath);
  const url = `vscode://file/${safePath}:${lineNum}`;
  window.open(url, "_blank", "noopener,noreferrer");
  showNotification(`Copiado: ${fullPath} — Cole no terminal: code ${fullPath}`, "success", 6000);
}

function normalizePathForCopy(path) {
  if (!path) return "-";
  let value = String(path).trim();
  value = value.replaceAll("\\", "/");
  value = value.replace(/^[A-Za-z]:\//, "");
  value = value.replace(/^\/+/, "");
  value = value.replace(/\/+/g, "/");
  const anchor = value.toLowerCase().indexOf("blackarrow");
  if (anchor >= 0) value = value.slice(anchor);
  return value;
}

function getFrameCopyValue(frame, copyKind) {
  if (!frame) return "";
  const line = frame.line ? String(frame.line) : "-";
  const normalizedPath = normalizePathForCopy(frame.path || "-");
  if (copyKind === "pathline") return `${normalizedPath}:${line}`;
  if (copyKind === "fn") return frame.fn || "-";
  return frame.raw || `${frame.fileName || "-"} | ${normalizedPath}:${line}`;
}

function buildMarkdownReport(result, onlyApp) {
  const now = new Date().toISOString();
  const visibleFrames = onlyApp ? result.orderedFrames.filter((frame) => frame.sourceType === "app") : result.orderedFrames;
  const root = result.rootFrame
    ? `${normalizePathForCopy(result.rootFrame.path || result.rootFrame.fileName)}:${result.rootFrame.line || "-"}`
    : "nao encontrado";

  const lines = [];
  lines.push("# Debug Report");
  lines.push("");
  lines.push(`- Gerado em: ${now}`);
  lines.push(`- Linguagem: ${result.language}`);
  lines.push(`- Erro principal: ${result.errorLine}`);
  lines.push(`- Causa provavel: ${root}`);
  lines.push(`- Prefixos app: nenhum`);
  lines.push(`- Modo de visualizacao: ${onlyApp ? "So app" : "App + lib"}`);
  lines.push("");
  lines.push("## Categorias");
  lines.push("");
  result.categories.forEach((category) => lines.push(`- ${category.label}`));
  lines.push("");
  lines.push("## Causa Encadeada");
  lines.push("");
  if (result.causes.length) {
    result.causes.forEach((cause) => lines.push(`- ${cause}`));
  } else {
    lines.push("- Nao detectada.");
  }
  lines.push("");
  lines.push("## Passos imediatos");
  lines.push("");
  result.actions.forEach((action, index) => lines.push(`${index + 1}. ${action}`));
  lines.push("");
  lines.push("## Frames ordenados");
  lines.push("");
  visibleFrames.forEach((frame, i) => {
    const marker = result.rootFrame && frame.index === result.rootFrame.index ? "*" : "";
    lines.push(`${i + 1}${marker}. ${frame.fileName || "-"} | ${normalizePathForCopy(frame.path || "-")}:${frame.line || "-"} | ${frame.fn || "-"} | ${frame.sourceType || "-"}`);
  });
  lines.push("");
  lines.push("## Stack trace normalizado");
  lines.push("");
  lines.push("```");
  lines.push(result.normalized);
  lines.push("```");
  return lines.join("\n");
}

function buildTicketTemplate(result, onlyApp) {
  const visibleFrames = onlyApp ? result.orderedFrames.filter((frame) => frame.sourceType === "app") : result.orderedFrames;
  const root = result.rootFrame
    ? `${normalizePathForCopy(result.rootFrame.path || result.rootFrame.fileName)}:${result.rootFrame.line || "-"}`
    : "nao encontrado";
  const now = new Date().toISOString();

  const lines = [];
  lines.push("# Incident Ticket - Stacktrace");
  lines.push("");
  lines.push(`- Data: ${now}`);
  lines.push(`- Fingerprint: ${result.fingerprint || "-"}`);
  lines.push(`- Ocorrencias conhecidas: ${result.occurrences || 1}`);
  lines.push(`- Linguagem: ${result.language}`);
  lines.push(`- Erro principal: ${result.errorLine}`);
  lines.push(`- Causa provavel: ${root}`);
  lines.push(`- Categorias: ${result.categories.map((c) => c.label).join(", ")}`);
  lines.push("");
  lines.push("## Impacto");
  lines.push("- [Preencher] Qual funcionalidade/cliente foi afetado.");
  lines.push("- [Preencher] Severidade e volume.");
  lines.push("");
  lines.push("## Evidencias");
  lines.push(`- Frame raiz: ${root}`);
  lines.push(`- Causa encadeada: ${result.causes.join(" | ") || "Nao detectada"}`);
  lines.push(`- Total de frames: ${result.frames.length}`);
  lines.push("");
  lines.push("## Hipoteses Testaveis");
  result.hypotheses.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.statement}`);
    lines.push(`   - Teste: ${item.test}`);
    lines.push(`   - Evidencia esperada: ${item.evidence}`);
  });
  lines.push("");
  lines.push("## Plano de Acao");
  result.actions.forEach((action, idx) => lines.push(`${idx + 1}. ${action}`));
  lines.push("");
  lines.push("## Rollback/Mitigacao");
  lines.push("- [Preencher] Acao imediata para reduzir impacto.");
  lines.push("");
  lines.push("## Referencias de Codigo");
  visibleFrames.slice(0, 8).forEach((frame, idx) => {
    lines.push(`${idx + 1}. ${normalizePathForCopy(frame.path || "-")}:${frame.line || "-"} | ${frame.fn || "-"}`);
  });
  return lines.join("\n");
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showNotification(`✅ Baixado: ${filename}`, "success", 4000);
}

// HTTP REQUESTER
function parseHeadersFromText(raw) {
  const headers = {};
  const errors = [];
  const blockedHeaders = new Set([
    "content-length",
    "host",
    "origin",
    "referer",
    "proxy-authorization",
    "proxy-authenticate",
    "sec-fetch-site",
    "sec-fetch-mode",
    "sec-fetch-dest",
    "sec-fetch-user"
  ]);

  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > MAX_HEADER_LINES) {
    errors.push(`Limite de headers excedido (${MAX_HEADER_LINES}).`);
    return { headers, errors };
  }

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) {
      errors.push(`Header invalido: "${line}". Use o formato Nome: Valor.`);
      continue;
    }

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    const keyLc = key.toLowerCase();

    if (!key || key.length > MAX_HEADER_KEY_CHARS || !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(key)) {
      errors.push(`Nome de header invalido: "${key}".`);
      continue;
    }
    if (blockedHeaders.has(keyLc)) {
      errors.push(`Header bloqueado por seguranca: "${key}".`);
      continue;
    }
    if (value.length > MAX_HEADER_VALUE_CHARS || /[\0\r\n]/.test(value)) {
      errors.push(`Valor invalido para header "${key}".`);
      continue;
    }
    headers[key] = value;
  }

  return { headers, errors };
}

function redactSensitiveText(value) {
  const text = String(value || "");
  return text
    .replace(/(authorization\s*:\s*bearer\s+)[\w\-._~+/]+=*/gi, "$1[REDACTED]")
    .replace(/(x-api-key\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(/(access_token["'\s:=]+)[\w\-._~+/]+=*/gi, "$1[REDACTED]")
    .replace(/(refresh_token["'\s:=]+)[\w\-._~+/]+=*/gi, "$1[REDACTED]")
    .replace(/((api_)?secret["'\s:=]+)[^\s,"'}\]]+/gi, "$1[REDACTED]")
    .replace(/(password["'\s:=]+)[^\s,"'}\]]+/gi, "$1[REDACTED]");
}

function redactHeaderMap(headersObj) {
  const out = {};
  Object.entries(headersObj || {}).forEach(([key, value]) => {
    const k = String(key).toLowerCase();
    if (k === "authorization" || k === "proxy-authorization" || k === "set-cookie" || k === "cookie" || k === "x-api-key") {
      out[key] = "[REDACTED]";
    } else {
      out[key] = String(value);
    }
  });
  return out;
}

function truncateForUi(text, max = MAX_RESPONSE_CHARS) {
  const value = String(text || "");
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n\n... [TRUNCADO: ${value.length - max} caracteres removidos]`;
}

function isPrivateOrLocalHostname(hostname) {
  const rawHost = String(hostname || "").trim().toLowerCase();
  const isIpv6Literal = rawHost.startsWith("[") && rawHost.endsWith("]");
  const host = isIpv6Literal ? rawHost.slice(1, -1) : rawHost;
  if (!host) return true;
  if (isIpv6Literal) {
    // Bloqueia literals IPv6 no requester para reduzir superfície de SSRF/local-net.
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "::1" || host === "0:0:0:0:0:0:0:1") {
    return true;
  }
  if (host.includes(":")) {
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
    return false;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map((part) => Number(part));
    if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }
  return false;
}

function parseAndValidateRequestUrl(rawUrl) {
  const candidate = String(rawUrl || "").trim();
  if (!candidate) {
    return { error: "URL invalida." };
  }
  if (candidate.length > MAX_URL_CHARS) {
    return { error: `URL excede o limite de ${MAX_URL_CHARS} caracteres.` };
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: "URL invalida." };
  }

  if (parsed.username || parsed.password) {
    return { error: "Nao envie credenciais na URL. Use headers seguros." };
  }
  if (parsed.protocol !== "https:") {
    return { error: "Apenas HTTPS e permitido em producao." };
  }
  if (isPrivateOrLocalHostname(parsed.hostname)) {
    return { error: "Host local/privado bloqueado por seguranca." };
  }
  if (parsed.hash) {
    parsed.hash = "";
  }

  return { url: parsed };
}

function tokenizeCommand(command) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "'" || ch === "\"") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseCurlCommand(rawCurl) {
  const normalized = String(rawCurl || "").replace(/\\\r?\n/g, " ").trim();
  if (!normalized) return { error: "Comando cURL vazio." };

  const tokens = tokenizeCommand(normalized);
  if (!tokens.length || tokens[0].toLowerCase() !== "curl") {
    return { error: "Comando invalido. Comece com curl." };
  }

  let method = "";
  let url = "";
  let body = "";
  const headers = [];

  for (let i = 1; i < tokens.length; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];

    if ((t === "-X" || t === "--request") && next) {
      method = next.toUpperCase();
      i += 1;
      continue;
    }

    if ((t === "-H" || t === "--header") && next) {
      headers.push(next);
      i += 1;
      continue;
    }

    if ((t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "-d") && next) {
      body = next;
      i += 1;
      continue;
    }

    if (!t.startsWith("-") && !url) {
      url = t;
    }
  }

  if (!method) {
    method = body ? "POST" : "GET";
  }

  return {
    method,
    url,
    headers,
    body
  };
}

function applyParsedCurl(parsed) {
  if (!parsed || parsed.error) return false;
  if (reqMethodEl && parsed.method) reqMethodEl.value = parsed.method;
  if (reqUrlEl) reqUrlEl.value = parsed.url || "";
  if (reqHeadersEl) reqHeadersEl.value = (parsed.headers || []).join("\n");
  if (reqBodyEl) reqBodyEl.value = parsed.body || "";
  reqMetaEl.textContent = "cURL detectado e convertido automaticamente.";
  reqMetaEl.className = "content req-meta ok";
  return true;
}

function tryAutoImportCurlFromUrlField() {
  if (!reqUrlEl) return false;
  const raw = reqUrlEl.value.trim();
  if (!/^curl(\s|$)/i.test(raw)) return false;
  const parsed = parseCurlCommand(raw);
  if (parsed.error) {
    reqMetaEl.textContent = parsed.error;
    reqMetaEl.className = "content req-meta error";
    return false;
  }
  return applyParsedCurl(parsed);
}

function safeParseBody(method, bodyText) {
  const hasBody = !["GET", "HEAD"].includes(String(method).toUpperCase());
  if (!hasBody || !bodyText || !bodyText.trim()) return undefined;
  const raw = bodyText.trim();
  if (raw.length > MAX_BODY_CHARS) return "[BODY_TOO_LARGE]";
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

async function executeRequest() {
  if (!reqUrlEl || !reqMethodEl) return;
  tryAutoImportCurlFromUrlField();
  const rawUrl = reqUrlEl.value.trim();
  const method = reqMethodEl.value || "GET";
  if (!rawUrl) {
    reqMetaEl.textContent = "Informe a URL da request.";
    reqMetaEl.className = "content req-meta error";
    showNotification(`⚠️ Informe uma URL para continuar`, "warning", 4000);
    return;
  }

  const validated = parseAndValidateRequestUrl(rawUrl);
  if (validated.error) {
    reqMetaEl.textContent = validated.error;
    reqMetaEl.className = "content req-meta error";
    showNotification(`⚠️ URL inválida: ${validated.error}`, "warning", 5000);
    return;
  }
  const urlObj = validated.url;
  const url = urlObj.toString();

  const parsedHeaders = parseHeadersFromText(reqHeadersEl?.value || "");
  if (parsedHeaders.errors.length) {
    reqMetaEl.textContent = parsedHeaders.errors[0];
    reqMetaEl.className = "content req-meta error";
    reqResponseHeadersEl.textContent = "-";
    reqResponseBodyEl.textContent = "-";
    showNotification(`⚠️ Headers inválidos: ${parsedHeaders.errors[0]}`, "warning", 5000);
    return;
  }
  const headers = parsedHeaders.headers;
  const hasAuth = Object.keys(headers).some((k) => k.toLowerCase() === "authorization" || k.toLowerCase() === "x-api-key");
  if (hasAuth && urlObj.protocol !== "https:") {
    reqMetaEl.textContent = "Credenciais exigem HTTPS.";
    reqMetaEl.className = "content req-meta error";
    showNotification(`⚠️ Segurança: Use HTTPS com credenciais!`, "warning", 5000);
    return;
  }

  const body = safeParseBody(method, reqBodyEl?.value || "");
  if (body === "[BODY_TOO_LARGE]") {
    reqMetaEl.textContent = `Body excede o limite de ${MAX_BODY_CHARS} caracteres.`;
    reqMetaEl.className = "content req-meta error";
    showNotification(`⚠️ Body muito grande: limite ${MAX_BODY_CHARS} caracteres`, "warning", 5000);
    return;
  }
  const options = { method, headers };
  options.credentials = "omit";
  options.referrerPolicy = "no-referrer";
  options.cache = "no-store";
  if (body !== undefined) options.body = body;

  reqMetaEl.textContent = "Executando request...";
  reqMetaEl.className = "content req-meta";
  reqResponseHeadersEl.textContent = "-";
  reqResponseBodyEl.textContent = "-";
  showNotification(`Enviando ${method} ${urlObj.host}...`, "info", 3000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  options.signal = controller.signal;

  const started = performance.now();
  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    const elapsed = Math.round(performance.now() - started);
    const text = await response.text();
    const headersObj = {};
    response.headers.forEach((value, key) => { headersObj[key] = value; });
    const safeHeaders = redactHeaderMap(headersObj);
    const safeText = redactSensitiveText(truncateForUi(text));

    reqMetaEl.textContent = `Status: ${response.status} ${response.statusText} | Tempo: ${elapsed}ms`;
    reqMetaEl.className = `content req-meta ${response.ok ? "ok" : "error"}`;
    reqResponseHeadersEl.textContent = JSON.stringify(safeHeaders, null, 2) || "-";
    try {
      reqResponseBodyEl.textContent = JSON.stringify(JSON.parse(safeText), null, 2);
    } catch {
      reqResponseBodyEl.textContent = safeText || "(vazio)";
    }
    reqResponseHeadersEl.className = "content";
    reqResponseBodyEl.className = "content";

    const statusType = response.ok ? "success" : response.status >= 500 ? "error" : response.status >= 400 ? "warning" : "info";
    const statusMsg = response.ok ? `✅ Sucesso: ${response.status} ${response.statusText}` : response.status >= 500 ? `❌ Erro ${response.status}: ${response.statusText}` : response.status >= 400 ? `⚠️ Erdo ${response.status}: ${response.statusText}` : `ℹ️ ${response.status} ${response.statusText}`;
    showNotification(`${statusMsg} - ${elapsed}ms`, statusType, 5000);
  } catch (error) {
    clearTimeout(timeoutId);
    reqMetaEl.textContent = "Falha na request (rede/CORS/URL).";
    reqMetaEl.className = "content req-meta error";
    reqResponseHeadersEl.textContent = "-";
    reqResponseBodyEl.textContent = redactSensitiveText(String(error?.message || error || "Erro desconhecido"));
    reqResponseHeadersEl.className = "content empty";
    reqResponseBodyEl.className = "content";
    showNotification(`❌ Erro de rede: ${error?.message || "Falha na request"}`, "error", 6000);
  }
}

function setTabState(buttons, tabType, tabName) {
  buttons.forEach((btn) => {
    const isActive = btn.dataset[tabType] === tabName;
    btn.classList.toggle("active", isActive);
  });
}

function showTab(tabPrefix, tabName) {
  const panels = Array.from(document.querySelectorAll(`[id^="${tabPrefix}-tab-"]`));
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabPrefix}-tab-${tabName}`);
  });
}

function highlightJson(jsonText) {
  const escaped = escapeHtml(jsonText);
  return escaped.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"\s*:?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="tok-key">${match}</span>`;
        return `<span class="tok-string">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="tok-bool">${match}</span>`;
      if (/null/.test(match)) return `<span class="tok-null">${match}</span>`;
      return `<span class="tok-number">${match}</span>`;
    }
  );
}

function highlightXml(xmlText) {
  const escaped = escapeHtml(xmlText);
  return escaped.replace(
    /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([\w:.-]+)([^&]*?)(&gt;)|([\w:.-]+)=(&quot;.*?&quot;)/g,
    (match, comment, p1, p2, p3, p4, attrName, attrVal) => {
      if (comment) return `<span class="tok-comment">${comment}</span>`;
      if (p1) {
        const attrs = (p3 || "").replace(
          /([\w:.-]+)=(&quot;.*?&quot;)/g,
          '<span class="tok-attr">$1</span>=<span class="tok-attr-val">$2</span>'
        );
        return `<span class="tok-tag">${p1}</span><span class="tok-tag-name">${p2}</span>${attrs}<span class="tok-tag">${p4}</span>`;
      }
      if (attrName) {
        return `<span class="tok-attr">${attrName}</span>=<span class="tok-attr-val">${attrVal}</span>`;
      }
      return match;
    }
  );
}

// FORMATTERS
function setFormatterOutput(el, text, isError = false, syntax = "plain") {
  if (!el) return;
  const value = text || "-";
  if (!isError && syntax === "json") {
    el.innerHTML = highlightJson(value);
  } else if (!isError && syntax === "xml") {
    el.innerHTML = highlightXml(value);
  } else {
    el.textContent = value;
  }
  el.className = isError
    ? "content response-box formatter-output error"
    : "content response-box formatter-output";
}

function formatJson(mode = "pretty") {
  if (!jsonInputEl || !jsonOutputEl) return;
  const raw = jsonInputEl.value.trim();
  if (!raw) {
    setFormatterOutput(jsonOutputEl, "Informe JSON no input.", true);
    showNotification("⚠️ Informe um JSON para formatar", "warning", 4000);
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (mode === "minify") {
      setFormatterOutput(jsonOutputEl, JSON.stringify(parsed), false, "json");
      showNotification("✅ JSON minificado com sucesso", "success", 3000);
      return;
    }
    if (mode === "validate") {
      setFormatterOutput(jsonOutputEl, "JSON valido.");
      showNotification("✅ JSON válido", "success", 3000);
      return;
    }
    setFormatterOutput(jsonOutputEl, JSON.stringify(parsed, null, 2), false, "json");
    showNotification("✅ JSON formatado com sucesso", "success", 3000);
  } catch (error) {
    setFormatterOutput(jsonOutputEl, `JSON invalido: ${error.message}`, true);
    showNotification(`❌ JSON inválido: ${error.message}`, "error", 5000);
  }
}

function escapeXmlText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlAttr(value) {
  return escapeXmlText(value).replaceAll('"', "&quot;");
}

function formatXmlNode(node, level = 0, indent = "  ") {
  const pad = indent.repeat(level);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue.trim();
    if (!text) return "";
    return `${pad}${escapeXmlText(text)}`;
  }

  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    return `${pad}<![CDATA[${node.nodeValue}]]>`;
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    return `${pad}<!--${node.nodeValue}-->`;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const attrs = Array.from(node.attributes || [])
    .map((attr) => `${attr.name}="${escapeXmlAttr(attr.value)}"`)
    .join(" ");
  const open = attrs ? `<${node.nodeName} ${attrs}>` : `<${node.nodeName}>`;

  const children = Array.from(node.childNodes || []);
  const meaningful = children.filter((child) => {
    if (child.nodeType === Node.TEXT_NODE) return child.nodeValue.trim().length > 0;
    return true;
  });

  if (!meaningful.length) {
    return attrs ? `${pad}<${node.nodeName} ${attrs}/>` : `${pad}<${node.nodeName}/>`;
  }

  const onlyText = meaningful.length === 1 && meaningful[0].nodeType === Node.TEXT_NODE;
  if (onlyText) {
    return `${pad}${open}${escapeXmlText(meaningful[0].nodeValue.trim())}</${node.nodeName}>`;
  }

  const inner = meaningful
    .map((child) => formatXmlNode(child, level + 1, indent))
    .filter(Boolean)
    .join("\n");
  return `${pad}${open}\n${inner}\n${pad}</${node.nodeName}>`;
}

function formatXml(mode = "pretty") {
  if (!xmlInputEl || !xmlOutputEl) return;
  const raw = xmlInputEl.value.trim();
  if (!raw) {
    setFormatterOutput(xmlOutputEl, "Informe XML no input.", true);
    showNotification("⚠️ Informe um XML para formatar", "warning", 4000);
    return;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "application/xml");
  if (doc.querySelector("parsererror")) {
    setFormatterOutput(xmlOutputEl, "XML invalido. Verifique fechamento de tags.", true);
    showNotification("❌ XML inválido: verifique as tags", "error", 5000);
    return;
  }
  const root = doc.documentElement;
  const serialized = new XMLSerializer().serializeToString(root);
  if (mode === "validate") {
    setFormatterOutput(xmlOutputEl, "XML valido.");
    showNotification("✅ XML válido", "success", 3000);
    return;
  }
  if (mode === "minify") {
    setFormatterOutput(xmlOutputEl, serialized.replace(/>\s+</g, "><").trim(), false, "xml");
    showNotification("✅ XML minificado com sucesso", "success", 3000);
    return;
  }
  setFormatterOutput(xmlOutputEl, formatXmlNode(root, 0, "  "), false, "xml");
  showNotification("✅ XML formatado com sucesso", "success", 3000);
}

function copyFormatterOutput(el) {
  if (!el) return;
  copyToClipboard(el.textContent || "");
  showNotification("✅ Conteúdo copiado para área de transferência", "success", 3000);
}

function renderResult(result) {
  if (result.error) {
    lastAnalysis = null;
    summaryEl.textContent = result.error;
    summaryEl.className = "content";
    orderedFramesEl.textContent = "Sem dados.";
    orderedFramesEl.className = "content empty";
    normalizedEl.textContent = "Sem dados.";
    normalizedEl.className = "content empty";
    if (exportBtn) exportBtn.disabled = true;
    if (ticketBtn) ticketBtn.disabled = true;
    renderExplorer(null);
    return;
  }

  lastAnalysis = result;
  saveHistoryItem(result);
  renderSummary(result);
  renderTimeline(result);
  renderOrderedFrames(result);
  renderExplorer(result, explorerSearchInput?.value || "");
  renderHistory();
  normalizedEl.textContent = result.normalized;
  normalizedEl.className = "content";
  if (exportBtn) exportBtn.disabled = false;
  if (ticketBtn) ticketBtn.disabled = false;
  showNotification(`Análise concluída! ${result.frames.length} frames extraídos.`, "success", 4000);
}

// CORE
function runAnalysis() {
  const forcedLanguage = languageModeSelect?.value || "auto";
  renderResult(analyzeTrace(traceInput.value, forcedLanguage));
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("traceTheme", theme);
  if (themeBtn) {
    themeBtn.textContent = theme === "light" ? "Tema: Light" : "Tema: Dark";
  }
}

function initTheme() {
  const saved = localStorage.getItem("traceTheme");
  setTheme(saved === "light" ? "light" : "dark");
}

// EVENT LISTENERS
analyzeBtn.addEventListener("click", () => runAnalysis());

sampleBtn.addEventListener("click", () => {
  traceInput.value = `System.AggregateException: One or more errors occurred.
 ---> System.InvalidOperationException: Failed to process transaction batch.
   at Orion.Finance.Fidc.Domain.Services.LoteService.ProcessarLote() in D:\\projects\\Orion.Finance.Fidc.Domain\\Services\\LoteService.cs:line 142
   at Orion.Finance.Fidc.Api.Controllers.LoteController.Processar() in D:\\projects\\Orion.Finance.Fidc.Api\\Controllers\\LoteController.cs:line 58
   at lambda_method(Closure , Object , Object[] )
   at Microsoft.AspNetCore.Mvc.Infrastructure.ActionMethodExecutor.SyncActionResultExecutor.Execute(ActionContext actionContext, IActionResultTypeMapper mapper, ObjectMethodExecutor executor, Object controller, Object[] arguments)
   at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.InvokeActionMethodAsync()
   at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.Next(State& next, Scope& scope, Object& state, Boolean& isCompleted)
   at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.InvokeNextActionFilterAsync()
   at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.Rethrow(ActionExecutedContextSealed context)
   at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.Next(State& next, Scope& scope, Object& state, Boolean& isCompleted)
   at Microsoft.AspNetCore.Mvc.Infrastructure.ControllerActionInvoker.InvokeInnerFilterAsync()
   at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.<InvokeFilterPipelineAsync>g__Awaited|20_0(ResourceInvoker invoker, Task lastTask, State next, Scope scope, Object state, Boolean isCompleted)
   at Microsoft.AspNetCore.Mvc.Infrastructure.ResourceInvoker.InvokeAsync()
   at Microsoft.AspNetCore.Routing.EndpointMiddleware.Invoke(HttpContext httpContext)
   at Microsoft.AspNetCore.Authorization.AuthorizationMiddleware.Invoke(HttpContext context)
   at Microsoft.AspNetCore.Authentication.AuthenticationMiddleware.Invoke(HttpContext context)
   at Swashbuckle.AspNetCore.SwaggerUI.SwaggerUIMiddleware.Invoke(HttpContext httpContext)
   at Swashbuckle.AspNetCore.Swagger.SwaggerMiddleware.Invoke(HttpContext httpContext, ISwaggerProvider swaggerProvider)
   at Microsoft.AspNetCore.Diagnostics.DeveloperExceptionPageMiddleware.Invoke(HttpContext context)

 ---> System.Data.SqlClient.SqlException (0x80131904): Violation of UNIQUE KEY constraint 'UQ_Transacao_Numero'. Cannot insert duplicate key in object 'dbo.Transacoes'. The duplicate key value is (TX-99821).
   at System.Data.SqlClient.SqlConnection.OnError(SqlException exception, Boolean breakConnection, Action\`1 wrapCloseInAction)
   at System.Data.SqlClient.SqlInternalConnection.OnError(SqlException exception, Boolean breakConnection, Action\`1 wrapCloseInAction)
   at System.Data.SqlClient.TdsParser.ThrowExceptionAndWarning(TdsParserStateObject stateObj, Boolean callerHasConnectionLock, Boolean asyncClose)
   at System.Data.SqlClient.TdsParser.Run(RunBehavior runBehavior, SqlCommand cmdHandler, SqlDataReader dataStream, BulkCopySimpleResultSet bulkCopyHandler, TdsParserStateObject stateObj)
   at System.Data.SqlClient.SqlDataReader.TryConsumeMetaData()
   at System.Data.SqlClient.SqlDataReader.get_MetaData()
   at System.Data.SqlClient.SqlCommand.FinishExecuteReader(SqlDataReader ds, RunBehavior runBehavior, String resetOptionsString)
   at System.Data.SqlClient.SqlCommand.RunExecuteReaderTds(CommandBehavior cmdBehavior, RunBehavior runBehavior, Boolean returnStream, Boolean async)
   at System.Data.SqlClient.SqlCommand.ExecuteReader(CommandBehavior behavior)
   at Dapper.SqlMapper.ExecuteReaderWithFlagsFallback(IDbCommand cmd, Boolean wasClosed, CommandBehavior behavior)
   at Dapper.SqlMapper.QueryImpl[T](IDbConnection cnn, CommandDefinition command, Type effectiveType)
   at Orion.Finance.Fidc.Infrastructure.Repositories.TransacaoRepository.Inserir() in D:\\projects\\Orion.Finance.Fidc.Infrastructure\\Repositories\\TransacaoRepository.cs:line 87
   at Orion.Finance.Fidc.Domain.Services.TransacaoService.Salvar() in D:\\projects\\Orion.Finance.Fidc.Domain\\Services\\TransacaoService.cs:line 64

 ---> System.TimeoutException: The operation has timed out while calling external compliance API.
   at Orion.Finance.Fidc.Integration.ComplianceClient.ValidarTransacao() in D:\\projects\\Orion.Finance.Fidc.Integration\\ComplianceClient.cs:line 33
   at Orion.Finance.Fidc.Domain.Services.TransacaoService.Validar() in D:\\projects\\Orion.Finance.Fidc.Domain\\Services\\TransacaoService.cs:line 41

--- End of inner exception stack trace ---
--- End of inner exception stack trace ---`;
  runAnalysis();
});

clearBtn.addEventListener("click", () => {
  traceInput.value = "";
  lastAnalysis = null;
  summaryEl.textContent = "Cole um stack trace para comecar.";
  summaryEl.className = "content empty";
  orderedFramesEl.textContent = "Sem dados.";
  orderedFramesEl.className = "content empty";
  normalizedEl.textContent = "Sem dados.";
  normalizedEl.className = "content empty";
  if (exportBtn) exportBtn.disabled = true;
  if (ticketBtn) ticketBtn.disabled = true;
});

if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  });
}

if (onlyAppBtn) {
  onlyAppBtn.addEventListener("click", () => {
    onlyAppState = !onlyAppState;
    onlyAppBtn.classList.toggle("active", onlyAppState);
    if (lastAnalysis) renderOrderedFrames(lastAnalysis);
  });
}

function initIDE() {
  const saved = localStorage.getItem("traceIDE");
  if (saved && ideSelect) {
    ideSelect.value = saved;
  }
}

if (ideSelect) {
  ideSelect.addEventListener("change", () => {
    localStorage.setItem("traceIDE", ideSelect.value);
  });
}

if (exportBtn) {
  exportBtn.disabled = true;
  exportBtn.addEventListener("click", () => {
    if (!lastAnalysis) return;
    const onlyApp = onlyAppState;
    const md = buildMarkdownReport(lastAnalysis, onlyApp);
    downloadTextFile("stacktrace-report.md", md);
  });
}

if (ticketBtn) {
  ticketBtn.disabled = true;
  ticketBtn.addEventListener("click", () => {
    if (!lastAnalysis) return;
    const onlyApp = onlyAppState;
    const ticket = buildTicketTemplate(lastAnalysis, onlyApp);
    downloadTextFile("incident-ticket.md", ticket);
  });
}

if (sendReqBtn) {
  sendReqBtn.addEventListener("click", () => {
    executeRequest();
  });
}

if (reqUrlEl) {
  reqUrlEl.addEventListener("change", () => {
    tryAutoImportCurlFromUrlField();
  });
  reqUrlEl.addEventListener("paste", () => {
    window.setTimeout(() => {
      tryAutoImportCurlFromUrlField();
    }, 0);
  });
}

reqTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.reqTab;
    if (!name) return;
    setTabState(reqTabBtns, "reqTab", name);
    showTab("req", name);
  });
});

resTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.dataset.resTab;
    if (!name) return;
    setTabState(resTabBtns, "resTab", name);
    showTab("res", name);
  });
});

orderedFramesEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !lastAnalysis) return;
  const button = target.closest("button[data-copy], button[data-action]");

  if (!button) return;

  const action = button.getAttribute("data-action");
  if (action === "ide") {
    const frameIndex = Number(button.getAttribute("data-frame-index"));
    const frame = lastAnalysis.orderedFrames.find((item) => item.index === frameIndex);
    if (frame) {
      openInIDE(frame.path, frame.line);
    }
    return;
  }

  const copyKind = button.getAttribute("data-copy");
  const frameIndex = Number(button.getAttribute("data-frame-index"));
  const frame = lastAnalysis.orderedFrames.find((item) => item.index === frameIndex);
  const value = getFrameCopyValue(frame, copyKind);
  copyToClipboard(value);
  showNotification(`Copiado: ${value}`, "success", 2000);

  const oldText = button.textContent;
  button.textContent = "Copiado";
  window.setTimeout(() => {
    button.textContent = oldText;
  }, 900);
});

if (explorerFramesEl) {
  explorerFramesEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !lastAnalysis) return;
    const button = target.closest("button[data-copy], button[data-action]");

    if (!button) return;

    const action = button.getAttribute("data-action");
    if (action === "ide") {
      const frameIndex = Number(button.getAttribute("data-frame-index"));
      const frame = lastAnalysis.orderedFrames.find((item) => item.index === frameIndex);
      if (frame) {
        openInIDE(frame.path, frame.line);
      }
      return;
    }

    const frameIndex = Number(button.getAttribute("data-frame-index"));
    const copyKind = button.getAttribute("data-copy");
    const frame = lastAnalysis.orderedFrames.find((item) => item.index === frameIndex);
    const value = getFrameCopyValue(frame, copyKind);
    copyToClipboard(value);

    const oldText = button.textContent;
    button.textContent = "Copiado";
    window.setTimeout(() => {
      button.textContent = oldText;
    }, 900);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const screen = link.dataset.screen || "input";
    switchScreen(screen);
    if (screen === "history") renderHistory();
    if (screen === "explorer") renderExplorer(lastAnalysis, explorerSearchInput?.value || "");
  });
});

if (explorerSearchInput) {
  let explorerTimer = null;
  explorerSearchInput.addEventListener("input", () => {
    if (explorerTimer) clearTimeout(explorerTimer);
    explorerTimer = setTimeout(() => {
      renderExplorer(lastAnalysis, explorerSearchInput.value);
    }, 120);
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  });
}

if (jsonFormatBtn) jsonFormatBtn.addEventListener("click", () => formatJson("pretty"));
if (jsonMinifyBtn) jsonMinifyBtn.addEventListener("click", () => formatJson("minify"));
if (jsonValidateBtn) jsonValidateBtn.addEventListener("click", () => formatJson("validate"));
if (jsonCopyBtn) jsonCopyBtn.addEventListener("click", () => copyFormatterOutput(jsonOutputEl));

if (xmlFormatBtn) xmlFormatBtn.addEventListener("click", () => formatXml("pretty"));
if (xmlMinifyBtn) xmlMinifyBtn.addEventListener("click", () => formatXml("minify"));
if (xmlValidateBtn) xmlValidateBtn.addEventListener("click", () => formatXml("validate"));
if (xmlCopyBtn) xmlCopyBtn.addEventListener("click", () => copyFormatterOutput(xmlOutputEl));

renderExplorer(null);
renderHistory();
switchScreen(currentScreen);
initTheme();
initIDE();
