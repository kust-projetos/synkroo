
import {Buffer} from "node:buffer";
globalThis.Buffer = Buffer;

import {AsyncLocalStorage} from "node:async_hooks";
globalThis.AsyncLocalStorage = AsyncLocalStorage;


const defaultDefineProperty = Object.defineProperty;
Object.defineProperty = function(o, p, a) {
  if(p=== '__import_unsupported' && Boolean(globalThis.__import_unsupported)) {
    return;
  }
  return defaultDefineProperty(o, p, a);
};

  
  
  globalThis.openNextDebug = false;globalThis.openNextVersion = "4.0.2";globalThis.nextVersion = "15.5.19";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@opennextjs/aws/dist/utils/error.js
function isOpenNextError(e) {
  try {
    return "__openNextInternal" in e;
  } catch {
    return false;
  }
}
var init_error = __esm({
  "node_modules/@opennextjs/aws/dist/utils/error.js"() {
  }
});

// node_modules/@opennextjs/aws/dist/adapters/logger.js
function debug(...args) {
  if (globalThis.openNextDebug) {
    console.log(...args);
  }
}
function warn(...args) {
  console.warn(...args);
}
function error(...args) {
  if (args.some((arg) => isDownplayedErrorLog(arg))) {
    return debug(...args);
  }
  if (args.some((arg) => isOpenNextError(arg))) {
    const error2 = args.find((arg) => isOpenNextError(arg));
    if (error2.logLevel < getOpenNextErrorLogLevel()) {
      return;
    }
    if (error2.logLevel === 0) {
      return console.log(...args.map((arg) => isOpenNextError(arg) ? `${arg.name}: ${arg.message}` : arg));
    }
    if (error2.logLevel === 1) {
      return warn(...args.map((arg) => isOpenNextError(arg) ? `${arg.name}: ${arg.message}` : arg));
    }
    return console.error(...args);
  }
  console.error(...args);
}
function getOpenNextErrorLogLevel() {
  const strLevel = process.env.OPEN_NEXT_ERROR_LOG_LEVEL ?? "1";
  switch (strLevel.toLowerCase()) {
    case "debug":
    case "0":
      return 0;
    case "error":
    case "2":
      return 2;
    default:
      return 1;
  }
}
var DOWNPLAYED_ERROR_LOGS, isDownplayedErrorLog;
var init_logger = __esm({
  "node_modules/@opennextjs/aws/dist/adapters/logger.js"() {
    init_error();
    DOWNPLAYED_ERROR_LOGS = [
      {
        clientName: "S3Client",
        commandName: "GetObjectCommand",
        errorName: "NoSuchKey"
      }
    ];
    isDownplayedErrorLog = (errorLog) => DOWNPLAYED_ERROR_LOGS.some((downplayedInput) => downplayedInput.clientName === errorLog?.clientName && downplayedInput.commandName === errorLog?.commandName && (downplayedInput.errorName === errorLog?.error?.name || downplayedInput.errorName === errorLog?.error?.Code));
  }
});

// node_modules/@opennextjs/aws/node_modules/cookie/dist/index.js
var require_dist = __commonJS({
  "node_modules/@opennextjs/aws/node_modules/cookie/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseCookie = parseCookie;
    exports.parse = parseCookie;
    exports.stringifyCookie = stringifyCookie;
    exports.stringifySetCookie = stringifySetCookie;
    exports.serialize = stringifySetCookie;
    exports.parseSetCookie = parseSetCookie;
    exports.stringifySetCookie = stringifySetCookie;
    exports.serialize = stringifySetCookie;
    var cookieNameRegExp = /^[\u0021-\u003A\u003C\u003E-\u007E]+$/;
    var cookieValueRegExp = /^[\u0021-\u003A\u003C-\u007E]*$/;
    var domainValueRegExp = /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    var pathValueRegExp = /^[\u0020-\u003A\u003D-\u007E]*$/;
    var maxAgeRegExp = /^-?\d+$/;
    var __toString = Object.prototype.toString;
    var NullObject = /* @__PURE__ */ (() => {
      const C = function() {
      };
      C.prototype = /* @__PURE__ */ Object.create(null);
      return C;
    })();
    function parseCookie(str, options) {
      const obj = new NullObject();
      const len = str.length;
      if (len < 2)
        return obj;
      const dec = options?.decode || decode;
      let index = 0;
      do {
        const eqIdx = eqIndex(str, index, len);
        if (eqIdx === -1)
          break;
        const endIdx = endIndex(str, index, len);
        if (eqIdx > endIdx) {
          index = str.lastIndexOf(";", eqIdx - 1) + 1;
          continue;
        }
        const key = valueSlice(str, index, eqIdx);
        if (obj[key] === void 0) {
          obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
        }
        index = endIdx + 1;
      } while (index < len);
      return obj;
    }
    function stringifyCookie(cookie, options) {
      const enc = options?.encode || encodeURIComponent;
      const cookieStrings = [];
      for (const name of Object.keys(cookie)) {
        const val = cookie[name];
        if (val === void 0)
          continue;
        if (!cookieNameRegExp.test(name)) {
          throw new TypeError(`cookie name is invalid: ${name}`);
        }
        const value = enc(val);
        if (!cookieValueRegExp.test(value)) {
          throw new TypeError(`cookie val is invalid: ${val}`);
        }
        cookieStrings.push(`${name}=${value}`);
      }
      return cookieStrings.join("; ");
    }
    function stringifySetCookie(_name, _val, _opts) {
      const cookie = typeof _name === "object" ? _name : { ..._opts, name: _name, value: String(_val) };
      const options = typeof _val === "object" ? _val : _opts;
      const enc = options?.encode || encodeURIComponent;
      if (!cookieNameRegExp.test(cookie.name)) {
        throw new TypeError(`argument name is invalid: ${cookie.name}`);
      }
      const value = cookie.value ? enc(cookie.value) : "";
      if (!cookieValueRegExp.test(value)) {
        throw new TypeError(`argument val is invalid: ${cookie.value}`);
      }
      let str = cookie.name + "=" + value;
      if (cookie.maxAge !== void 0) {
        if (!Number.isInteger(cookie.maxAge)) {
          throw new TypeError(`option maxAge is invalid: ${cookie.maxAge}`);
        }
        str += "; Max-Age=" + cookie.maxAge;
      }
      if (cookie.domain) {
        if (!domainValueRegExp.test(cookie.domain)) {
          throw new TypeError(`option domain is invalid: ${cookie.domain}`);
        }
        str += "; Domain=" + cookie.domain;
      }
      if (cookie.path) {
        if (!pathValueRegExp.test(cookie.path)) {
          throw new TypeError(`option path is invalid: ${cookie.path}`);
        }
        str += "; Path=" + cookie.path;
      }
      if (cookie.expires) {
        if (!isDate(cookie.expires) || !Number.isFinite(cookie.expires.valueOf())) {
          throw new TypeError(`option expires is invalid: ${cookie.expires}`);
        }
        str += "; Expires=" + cookie.expires.toUTCString();
      }
      if (cookie.httpOnly) {
        str += "; HttpOnly";
      }
      if (cookie.secure) {
        str += "; Secure";
      }
      if (cookie.partitioned) {
        str += "; Partitioned";
      }
      if (cookie.priority) {
        const priority = typeof cookie.priority === "string" ? cookie.priority.toLowerCase() : void 0;
        switch (priority) {
          case "low":
            str += "; Priority=Low";
            break;
          case "medium":
            str += "; Priority=Medium";
            break;
          case "high":
            str += "; Priority=High";
            break;
          default:
            throw new TypeError(`option priority is invalid: ${cookie.priority}`);
        }
      }
      if (cookie.sameSite) {
        const sameSite = typeof cookie.sameSite === "string" ? cookie.sameSite.toLowerCase() : cookie.sameSite;
        switch (sameSite) {
          case true:
          case "strict":
            str += "; SameSite=Strict";
            break;
          case "lax":
            str += "; SameSite=Lax";
            break;
          case "none":
            str += "; SameSite=None";
            break;
          default:
            throw new TypeError(`option sameSite is invalid: ${cookie.sameSite}`);
        }
      }
      return str;
    }
    function parseSetCookie(str, options) {
      const dec = options?.decode || decode;
      const len = str.length;
      const endIdx = endIndex(str, 0, len);
      const eqIdx = eqIndex(str, 0, endIdx);
      const setCookie = eqIdx === -1 ? { name: "", value: dec(valueSlice(str, 0, endIdx)) } : {
        name: valueSlice(str, 0, eqIdx),
        value: dec(valueSlice(str, eqIdx + 1, endIdx))
      };
      let index = endIdx + 1;
      while (index < len) {
        const endIdx2 = endIndex(str, index, len);
        const eqIdx2 = eqIndex(str, index, endIdx2);
        const attr = eqIdx2 === -1 ? valueSlice(str, index, endIdx2) : valueSlice(str, index, eqIdx2);
        const val = eqIdx2 === -1 ? void 0 : valueSlice(str, eqIdx2 + 1, endIdx2);
        switch (attr.toLowerCase()) {
          case "httponly":
            setCookie.httpOnly = true;
            break;
          case "secure":
            setCookie.secure = true;
            break;
          case "partitioned":
            setCookie.partitioned = true;
            break;
          case "domain":
            setCookie.domain = val;
            break;
          case "path":
            setCookie.path = val;
            break;
          case "max-age":
            if (val && maxAgeRegExp.test(val))
              setCookie.maxAge = Number(val);
            break;
          case "expires":
            if (!val)
              break;
            const date = new Date(val);
            if (Number.isFinite(date.valueOf()))
              setCookie.expires = date;
            break;
          case "priority":
            if (!val)
              break;
            const priority = val.toLowerCase();
            if (priority === "low" || priority === "medium" || priority === "high") {
              setCookie.priority = priority;
            }
            break;
          case "samesite":
            if (!val)
              break;
            const sameSite = val.toLowerCase();
            if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
              setCookie.sameSite = sameSite;
            }
            break;
        }
        index = endIdx2 + 1;
      }
      return setCookie;
    }
    function endIndex(str, min, len) {
      const index = str.indexOf(";", min);
      return index === -1 ? len : index;
    }
    function eqIndex(str, min, max) {
      const index = str.indexOf("=", min);
      return index < max ? index : -1;
    }
    function valueSlice(str, min, max) {
      let start = min;
      let end = max;
      do {
        const code = str.charCodeAt(start);
        if (code !== 32 && code !== 9)
          break;
      } while (++start < end);
      while (end > start) {
        const code = str.charCodeAt(end - 1);
        if (code !== 32 && code !== 9)
          break;
        end--;
      }
      return str.slice(start, end);
    }
    function decode(str) {
      if (str.indexOf("%") === -1)
        return str;
      try {
        return decodeURIComponent(str);
      } catch (e) {
        return str;
      }
    }
    function isDate(val) {
      return __toString.call(val) === "[object Date]";
    }
  }
});

// node_modules/@opennextjs/aws/dist/http/util.js
function parseSetCookieHeader(cookies) {
  if (!cookies) {
    return [];
  }
  if (typeof cookies === "string") {
    return cookies.split(/(?<!Expires=\w+),/i).map((c) => c.trim());
  }
  return cookies;
}
function getQueryFromIterator(it) {
  const query = {};
  for (const [key, value] of it) {
    if (key in query) {
      if (Array.isArray(query[key])) {
        query[key].push(value);
      } else {
        query[key] = [query[key], value];
      }
    } else {
      query[key] = value;
    }
  }
  return query;
}
var init_util = __esm({
  "node_modules/@opennextjs/aws/dist/http/util.js"() {
    init_logger();
  }
});

// node_modules/@opennextjs/aws/dist/overrides/converters/utils.js
function getQueryFromSearchParams(searchParams) {
  return getQueryFromIterator(searchParams.entries());
}
var init_utils = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/converters/utils.js"() {
    init_util();
  }
});

// node_modules/@opennextjs/aws/dist/overrides/converters/edge.js
var edge_exports = {};
__export(edge_exports, {
  default: () => edge_default
});
import { Buffer as Buffer2 } from "node:buffer";
var import_cookie, NULL_BODY_STATUSES, converter, edge_default;
var init_edge = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/converters/edge.js"() {
    import_cookie = __toESM(require_dist(), 1);
    init_util();
    init_utils();
    NULL_BODY_STATUSES = /* @__PURE__ */ new Set([101, 103, 204, 205, 304]);
    converter = {
      convertFrom: async (event) => {
        const url = new URL(event.url);
        const searchParams = url.searchParams;
        const query = getQueryFromSearchParams(searchParams);
        const headers = {};
        event.headers.forEach((value, key) => {
          headers[key] = value;
        });
        const rawPath = url.pathname;
        const method = event.method;
        const shouldHaveBody = method !== "GET" && method !== "HEAD";
        const body = shouldHaveBody ? Buffer2.from(await event.arrayBuffer()) : void 0;
        const cookieHeader = event.headers.get("cookie");
        const cookies = cookieHeader ? import_cookie.default.parse(cookieHeader) : {};
        return {
          type: "core",
          method,
          rawPath,
          url: event.url,
          body,
          headers,
          remoteAddress: event.headers.get("x-forwarded-for") ?? "::1",
          query,
          cookies
        };
      },
      convertTo: async (result) => {
        if ("internalEvent" in result) {
          const request = new Request(result.internalEvent.url, {
            body: result.internalEvent.body,
            method: result.internalEvent.method,
            headers: {
              ...result.internalEvent.headers,
              "x-forwarded-host": result.internalEvent.headers.host
            }
          });
          if (globalThis.__dangerous_ON_edge_converter_returns_request === true) {
            return request;
          }
          const cfCache = (result.isISR || result.internalEvent.rawPath.startsWith("/_next/image")) && process.env.DISABLE_CACHE !== "true" ? { cacheEverything: true } : {};
          return fetch(request, {
            // This is a hack to make sure that the response is cached by Cloudflare
            // See https://developers.cloudflare.com/workers/examples/cache-using-fetch/#caching-html-resources
            // @ts-expect-error - This is a Cloudflare specific option
            cf: cfCache
          });
        }
        const headers = new Headers();
        for (const [key, value] of Object.entries(result.headers)) {
          if (key === "set-cookie" && typeof value === "string") {
            const cookies = parseSetCookieHeader(value);
            for (const cookie of cookies) {
              headers.append(key, cookie);
            }
            continue;
          }
          if (Array.isArray(value)) {
            for (const v of value) {
              headers.append(key, v);
            }
          } else {
            headers.set(key, value);
          }
        }
        const body = NULL_BODY_STATUSES.has(result.statusCode) ? null : result.body;
        return new Response(body, {
          status: result.statusCode,
          headers
        });
      },
      name: "edge"
    };
    edge_default = converter;
  }
});

// node_modules/@opennextjs/aws/dist/overrides/wrappers/cloudflare-edge.js
var cloudflare_edge_exports = {};
__export(cloudflare_edge_exports, {
  default: () => cloudflare_edge_default
});
var cfPropNameMapping, handler, cloudflare_edge_default;
var init_cloudflare_edge = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/wrappers/cloudflare-edge.js"() {
    cfPropNameMapping = {
      // The city name is percent-encoded.
      // See https://github.com/vercel/vercel/blob/4cb6143/packages/functions/src/headers.ts#L94C19-L94C37
      city: [encodeURIComponent, "x-open-next-city"],
      country: "x-open-next-country",
      regionCode: "x-open-next-region",
      latitude: "x-open-next-latitude",
      longitude: "x-open-next-longitude"
    };
    handler = async (handler3, converter2) => async (request, env, ctx) => {
      globalThis.process = process;
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === "string") {
          process.env[key] = value;
        }
      }
      const internalEvent = await converter2.convertFrom(request);
      const cfProperties = request.cf;
      for (const [propName, mapping] of Object.entries(cfPropNameMapping)) {
        const propValue = cfProperties?.[propName];
        if (propValue != null) {
          const [encode, headerName] = Array.isArray(mapping) ? mapping : [null, mapping];
          internalEvent.headers[headerName] = encode ? encode(propValue) : propValue;
        }
      }
      const response = await handler3(internalEvent, {
        waitUntil: ctx.waitUntil.bind(ctx)
      });
      const result = await converter2.convertTo(response);
      return result;
    };
    cloudflare_edge_default = {
      wrapper: handler,
      name: "cloudflare-edge",
      supportStreaming: true,
      edgeRuntime: true
    };
  }
});

// node_modules/@opennextjs/aws/dist/overrides/originResolver/pattern-env.js
var pattern_env_exports = {};
__export(pattern_env_exports, {
  default: () => pattern_env_default
});
function initializeOnce() {
  if (initialized)
    return;
  cachedOrigins = JSON.parse(process.env.OPEN_NEXT_ORIGIN ?? "{}");
  const functions = globalThis.openNextConfig.functions ?? {};
  for (const key in functions) {
    if (key !== "default") {
      const value = functions[key];
      const regexes = [];
      for (const pattern of value.patterns) {
        const regexPattern = `/${pattern.replace(/\*\*/g, "(.*)").replace(/\*/g, "([^/]*)").replace(/\//g, "\\/").replace(/\?/g, ".")}`;
        regexes.push(new RegExp(regexPattern));
      }
      cachedPatterns.push({
        key,
        patterns: value.patterns,
        regexes
      });
    }
  }
  initialized = true;
}
var cachedOrigins, cachedPatterns, initialized, envLoader, pattern_env_default;
var init_pattern_env = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/originResolver/pattern-env.js"() {
    init_logger();
    cachedPatterns = [];
    initialized = false;
    envLoader = {
      name: "env",
      resolve: async (_path) => {
        try {
          initializeOnce();
          for (const { key, patterns, regexes } of cachedPatterns) {
            for (const regex of regexes) {
              if (regex.test(_path)) {
                debug("Using origin", key, patterns);
                return cachedOrigins[key];
              }
            }
          }
          if (_path.startsWith("/_next/image") && cachedOrigins.imageOptimizer) {
            debug("Using origin", "imageOptimizer", _path);
            return cachedOrigins.imageOptimizer;
          }
          if (cachedOrigins.default) {
            debug("Using default origin", cachedOrigins.default, _path);
            return cachedOrigins.default;
          }
          return false;
        } catch (e) {
          error("Error while resolving origin", e);
          return false;
        }
      }
    };
    pattern_env_default = envLoader;
  }
});

// node_modules/@opennextjs/aws/dist/overrides/assetResolver/dummy.js
var dummy_exports = {};
__export(dummy_exports, {
  default: () => dummy_default
});
var resolver, dummy_default;
var init_dummy = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/assetResolver/dummy.js"() {
    resolver = {
      name: "dummy"
    };
    dummy_default = resolver;
  }
});

// node_modules/@opennextjs/aws/dist/utils/stream.js
import { ReadableStream } from "node:stream/web";
function toReadableStream(value, isBase64) {
  return new ReadableStream({
    pull(controller) {
      controller.enqueue(Buffer.from(value, isBase64 ? "base64" : "utf8"));
      controller.close();
    }
  }, { highWaterMark: 0 });
}
function emptyReadableStream() {
  if (process.env.OPEN_NEXT_FORCE_NON_EMPTY_RESPONSE === "true") {
    return new ReadableStream({
      pull(controller) {
        maybeSomethingBuffer ??= Buffer.from("SOMETHING");
        controller.enqueue(maybeSomethingBuffer);
        controller.close();
      }
    }, { highWaterMark: 0 });
  }
  return new ReadableStream({
    start(controller) {
      controller.close();
    }
  });
}
var maybeSomethingBuffer;
var init_stream = __esm({
  "node_modules/@opennextjs/aws/dist/utils/stream.js"() {
  }
});

// node_modules/@opennextjs/aws/dist/overrides/proxyExternalRequest/fetch.js
var fetch_exports = {};
__export(fetch_exports, {
  default: () => fetch_default
});
var fetchProxy, fetch_default;
var init_fetch = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/proxyExternalRequest/fetch.js"() {
    init_stream();
    fetchProxy = {
      name: "fetch-proxy",
      // @ts-ignore
      proxy: async (internalEvent) => {
        const { url, headers: eventHeaders, method, body } = internalEvent;
        const headers = Object.fromEntries(Object.entries(eventHeaders).filter(([key]) => key.toLowerCase() !== "cf-connecting-ip"));
        const response = await fetch(url, {
          method,
          headers,
          body
        });
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
          const cur = responseHeaders[key];
          if (cur === void 0) {
            responseHeaders[key] = value;
          } else if (Array.isArray(cur)) {
            cur.push(value);
          } else {
            responseHeaders[key] = [cur, value];
          }
        });
        return {
          type: "core",
          headers: responseHeaders,
          statusCode: response.status,
          isBase64Encoded: true,
          body: response.body ?? emptyReadableStream()
        };
      }
    };
    fetch_default = fetchProxy;
  }
});

// .next/server/edge-instrumentation.js
var require_edge_instrumentation = __commonJS({
  ".next/server/edge-instrumentation.js"() {
    "use strict";
    (self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([[183], { 242: (a, b, c) => {
      "use strict";
      c.d(b, { i: () => d, is: () => e });
      let d = Symbol.for("drizzle:entityKind");
      function e(a2, b2) {
        if (!a2 || "object" != typeof a2) return false;
        if (a2 instanceof b2) return true;
        if (!Object.prototype.hasOwnProperty.call(b2, d)) throw Error(`Class "${b2.name ?? "<unknown>"}" doesn't look like a Drizzle entity. If this is incorrect and the class is provided by Drizzle, please report this as a bug.`);
        let c2 = Object.getPrototypeOf(a2).constructor;
        if (c2) for (; c2; ) {
          if (d in c2 && c2[d] === b2[d]) return true;
          c2 = Object.getPrototypeOf(c2);
        }
        return false;
      }
      Symbol.for("drizzle:hasOwnEntityKind");
    }, 903: (a, b, c) => {
      "use strict";
      c.d(b, { Lf: () => bu });
      var d = {};
      c.r(d), c.d(d, { actionLogs: () => bo.i, agentDlq: () => bf, agentLogs: () => bg, agentQueue: () => be, appointmentReminderConfigs: () => aO, appointmentReminders: () => aM, appointmentStatus: () => aF.K0, appointments: () => aK, auditLogs: () => bn, budgetInstallments: () => a7, budgetItems: () => a6, budgets: () => a5, campaignRecipients: () => a_, campaignSegments: () => a4, campaigns: () => a$, channelType: () => aF.w9, clinicTags: () => a3, clinics: () => aG.wW, clinicsRelations: () => aG.Pq, consents: () => bk, conversationMemories: () => aV, conversationSessions: () => aU, conversationStates: () => aT, conversationStatus: () => aF.qu, conversations: () => aR, customFieldDefinitions: () => bl, customFieldValues: () => bm, decisionLogs: () => bc, dentists: () => aG.zz, followUpConfigs: () => a1, followUps: () => a0, instanceModules: () => bq.T, knowledgeBase: () => bh, leadActivities: () => aY, leads: () => aX, messageDirection: () => aF.H1, messageTemplates: () => bj, messageType: () => aF.IR, messages: () => aS, patientFeedback: () => aG.B_, patientObservations: () => aG.lu, patientPreferences: () => aG.k7, patientRiskScores: () => aG.EC, patients: () => aG.PA, payments: () => a8, pendingActions: () => bb, permissions: () => bp.P, pipelineStages: () => aZ, procedureGuidelines: () => aG.ZM, procedureTypes: () => aP, procedures: () => aG.lF, rolePermissions: () => bp.dN, roles: () => bp.Ot, scheduleBlocks: () => aL, smartTriggerLog: () => bd, tasks: () => a2, treatmentPlanItems: () => ba, treatmentPlans: () => a9, userClinicAccess: () => bp.uq, userCredentials: () => aG.CO, userPermissionOverrides: () => bp.g8, userRole: () => aF.KZ, users: () => aG.VV, usersRelations: () => aG.mY, waitlist: () => aN, whatsappInstances: () => bi });
      let e = pg;
      var f = c(242);
      class g {
        static [f.i] = "ConsoleLogWriter";
        write(a10) {
          console.log(a10);
        }
      }
      class h {
        static [f.i] = "DefaultLogger";
        writer;
        constructor(a10) {
          this.writer = a10?.writer ?? new g();
        }
        logQuery(a10, b2) {
          let c2 = b2.map((a11) => {
            try {
              return JSON.stringify(a11);
            } catch {
              return String(a11);
            }
          }), d2 = c2.length ? ` -- params: [${c2.join(", ")}]` : "";
          this.writer.write(`Query: ${a10}${d2}`);
        }
      }
      class i {
        static [f.i] = "NoopLogger";
        logQuery() {
        }
      }
      var j = c(9393), k = c(4096), l = c(2701), m = c(2926);
      class n {
        constructor(a10) {
          this.table = a10;
        }
        static [f.i] = "ColumnAliasProxyHandler";
        get(a10, b2) {
          return "table" === b2 ? this.table : a10[b2];
        }
      }
      class o {
        constructor(a10, b2) {
          this.alias = a10, this.replaceOriginalName = b2;
        }
        static [f.i] = "TableAliasProxyHandler";
        get(a10, b2) {
          if (b2 === l.XI.Symbol.IsAlias) return true;
          if (b2 === l.XI.Symbol.Name || this.replaceOriginalName && b2 === l.XI.Symbol.OriginalName) return this.alias;
          if (b2 === m.n) return { ...a10[m.n], name: this.alias, isAlias: true };
          if (b2 === l.XI.Symbol.Columns) {
            let b3 = a10[l.XI.Symbol.Columns];
            if (!b3) return b3;
            let c3 = {};
            return Object.keys(b3).map((d2) => {
              c3[d2] = new Proxy(b3[d2], new n(new Proxy(a10, this)));
            }), c3;
          }
          let c2 = a10[b2];
          return (0, f.is)(c2, j.V) ? new Proxy(c2, new n(new Proxy(a10, this))) : c2;
        }
      }
      class p {
        constructor(a10) {
          this.alias = a10;
        }
        static [f.i] = null;
        get(a10, b2) {
          return "sourceTable" === b2 ? q(a10.sourceTable, this.alias) : a10[b2];
        }
      }
      function q(a10, b2) {
        return new Proxy(a10, new o(b2, false));
      }
      function r(a10, b2) {
        return new Proxy(a10, new n(new Proxy(a10.table, new o(b2, false))));
      }
      function s(a10, b2) {
        return new k.Xs.Aliased(t(a10.sql, b2), a10.fieldAlias);
      }
      function t(a10, b2) {
        return k.ll.join(a10.queryChunks.map((a11) => (0, f.is)(a11, j.V) ? r(a11, b2) : (0, f.is)(a11, k.Xs) ? t(a11, b2) : (0, f.is)(a11, k.Xs.Aliased) ? s(a11, b2) : a11));
      }
      function u(a10) {
        return (a10.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? []).map((a11) => a11.toLowerCase()).join("_");
      }
      function v(a10) {
        return (a10.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? []).reduce((a11, b2, c2) => a11 + (0 === c2 ? b2.toLowerCase() : `${b2[0].toUpperCase()}${b2.slice(1)}`), "");
      }
      function w(a10) {
        return a10;
      }
      class x {
        static [f.i] = "CasingCache";
        cache = {};
        cachedTables = {};
        convert;
        constructor(a10) {
          this.convert = "snake_case" === a10 ? u : "camelCase" === a10 ? v : w;
        }
        getColumnCasing(a10) {
          if (!a10.keyAsName) return a10.name;
          let b2 = a10.table[l.XI.Symbol.Schema] ?? "public", c2 = a10.table[l.XI.Symbol.OriginalName], d2 = `${b2}.${c2}.${a10.name}`;
          return this.cache[d2] || this.cacheTable(a10.table), this.cache[d2];
        }
        cacheTable(a10) {
          let b2 = a10[l.XI.Symbol.Schema] ?? "public", c2 = a10[l.XI.Symbol.OriginalName], d2 = `${b2}.${c2}`;
          if (!this.cachedTables[d2]) {
            for (let b3 of Object.values(a10[l.XI.Symbol.Columns])) {
              let a11 = `${d2}.${b3.name}`;
              this.cache[a11] = this.convert(b3.name);
            }
            this.cachedTables[d2] = true;
          }
        }
        clearCache() {
          this.cache = {}, this.cachedTables = {};
        }
      }
      class y extends Error {
        static [f.i] = "DrizzleError";
        constructor({ message: a10, cause: b2 }) {
          super(a10), this.name = "DrizzleError", this.cause = b2;
        }
      }
      class z extends Error {
        constructor(a10, b2, c2) {
          super(`Failed query: ${a10}
params: ${b2}`), this.query = a10, this.params = b2, this.cause = c2, Error.captureStackTrace(this, z), c2 && (this.cause = c2);
        }
      }
      class A extends y {
        static [f.i] = "TransactionRollbackError";
        constructor() {
          super({ message: "Rollback" });
        }
      }
      var B = c(4080), C = c(1457), D = c(9977), E = c(1308), F = c(1912), G = c(7097), H = c(6903), I = c(7238), J = c(6123), K = c(6778), L = c(1582), M = c(8245), N = c(3090);
      class O extends k.Ss {
        static [f.i] = "PgViewBase";
      }
      class P {
        static [f.i] = "PgDialect";
        casing;
        constructor(a10) {
          this.casing = new x(a10?.casing);
        }
        async migrate(a10, b2, c2) {
          let d2 = "string" == typeof c2 ? "__drizzle_migrations" : c2.migrationsTable ?? "__drizzle_migrations", e2 = "string" == typeof c2 ? "drizzle" : c2.migrationsSchema ?? "drizzle", f2 = (0, k.ll)`
			CREATE TABLE IF NOT EXISTS ${k.ll.identifier(e2)}.${k.ll.identifier(d2)} (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			)
		`;
          await b2.execute((0, k.ll)`CREATE SCHEMA IF NOT EXISTS ${k.ll.identifier(e2)}`), await b2.execute(f2);
          let g2 = (await b2.all((0, k.ll)`select id, hash, created_at from ${k.ll.identifier(e2)}.${k.ll.identifier(d2)} order by created_at desc limit 1`))[0];
          await b2.transaction(async (b3) => {
            for await (let c3 of a10) if (!g2 || Number(g2.created_at) < c3.folderMillis) {
              for (let a11 of c3.sql) await b3.execute(k.ll.raw(a11));
              await b3.execute((0, k.ll)`insert into ${k.ll.identifier(e2)}.${k.ll.identifier(d2)} ("hash", "created_at") values(${c3.hash}, ${c3.folderMillis})`);
            }
          });
        }
        escapeName(a10) {
          return `"${a10.replace(/"/g, '""')}"`;
        }
        escapeParam(a10) {
          return `$${a10 + 1}`;
        }
        escapeString(a10) {
          return `'${a10.replace(/'/g, "''")}'`;
        }
        buildWithCTE(a10) {
          if (!a10?.length) return;
          let b2 = [(0, k.ll)`with `];
          for (let [c2, d2] of a10.entries()) b2.push((0, k.ll)`${k.ll.identifier(d2._.alias)} as (${d2._.sql})`), c2 < a10.length - 1 && b2.push((0, k.ll)`, `);
          return b2.push((0, k.ll)` `), k.ll.join(b2);
        }
        buildDeleteQuery({ table: a10, where: b2, returning: c2, withList: d2 }) {
          let e2 = this.buildWithCTE(d2), f2 = c2 ? (0, k.ll)` returning ${this.buildSelection(c2, { isSingleTable: true })}` : void 0, g2 = b2 ? (0, k.ll)` where ${b2}` : void 0;
          return (0, k.ll)`${e2}delete from ${a10}${g2}${f2}`;
        }
        buildUpdateSet(a10, b2) {
          let c2 = a10[l.XI.Symbol.Columns], d2 = Object.keys(c2).filter((a11) => void 0 !== b2[a11] || c2[a11]?.onUpdateFn !== void 0), e2 = d2.length;
          return k.ll.join(d2.flatMap((a11, d3) => {
            let g2 = c2[a11], h2 = g2.onUpdateFn?.(), i2 = b2[a11] ?? ((0, f.is)(h2, k.Xs) ? h2 : k.ll.param(h2, g2)), j2 = (0, k.ll)`${k.ll.identifier(this.casing.getColumnCasing(g2))} = ${i2}`;
            return d3 < e2 - 1 ? [j2, k.ll.raw(", ")] : [j2];
          }));
        }
        buildUpdateQuery({ table: a10, set: b2, where: c2, returning: d2, withList: e2, from: f2, joins: g2 }) {
          let h2 = this.buildWithCTE(e2), i2 = a10[J.mu.Symbol.Name], j2 = a10[J.mu.Symbol.Schema], l2 = a10[J.mu.Symbol.OriginalName], m2 = i2 === l2 ? void 0 : i2, n2 = (0, k.ll)`${j2 ? (0, k.ll)`${k.ll.identifier(j2)}.` : void 0}${k.ll.identifier(l2)}${m2 && (0, k.ll)` ${k.ll.identifier(m2)}`}`, o2 = this.buildUpdateSet(a10, b2), p2 = f2 && k.ll.join([k.ll.raw(" from "), this.buildFromTable(f2)]), q2 = this.buildJoins(g2), r2 = d2 ? (0, k.ll)` returning ${this.buildSelection(d2, { isSingleTable: !f2 })}` : void 0, s2 = c2 ? (0, k.ll)` where ${c2}` : void 0;
          return (0, k.ll)`${h2}update ${n2} set ${o2}${p2}${q2}${s2}${r2}`;
        }
        buildSelection(a10, { isSingleTable: b2 = false } = {}) {
          let c2 = a10.length, d2 = a10.flatMap(({ field: a11 }, d3) => {
            let e2 = [];
            if ((0, f.is)(a11, k.Xs.Aliased) && a11.isSelectionField) e2.push(k.ll.identifier(a11.fieldAlias));
            else if ((0, f.is)(a11, k.Xs.Aliased) || (0, f.is)(a11, k.Xs)) {
              let c3 = (0, f.is)(a11, k.Xs.Aliased) ? a11.sql : a11;
              b2 ? e2.push(new k.Xs(c3.queryChunks.map((a12) => (0, f.is)(a12, B.Kl) ? k.ll.identifier(this.casing.getColumnCasing(a12)) : a12))) : e2.push(c3), (0, f.is)(a11, k.Xs.Aliased) && e2.push((0, k.ll)` as ${k.ll.identifier(a11.fieldAlias)}`);
            } else if ((0, f.is)(a11, j.V)) b2 ? e2.push(k.ll.identifier(this.casing.getColumnCasing(a11))) : e2.push(a11);
            else if ((0, f.is)(a11, M.n)) {
              let b3 = Object.entries(a11._.selectedFields);
              if (1 === b3.length) {
                let c3 = b3[0][1], d4 = (0, f.is)(c3, k.Xs) ? c3.decoder : (0, f.is)(c3, j.V) ? { mapFromDriverValue: (a12) => c3.mapFromDriverValue(a12) } : c3.sql.decoder;
                d4 && (a11._.sql.decoder = d4);
              }
              e2.push(a11);
            }
            return d3 < c2 - 1 && e2.push((0, k.ll)`, `), e2;
          });
          return k.ll.join(d2);
        }
        buildJoins(a10) {
          if (!a10 || 0 === a10.length) return;
          let b2 = [];
          for (let [c2, d2] of a10.entries()) {
            0 === c2 && b2.push((0, k.ll)` `);
            let e2 = d2.table, g2 = d2.lateral ? (0, k.ll)` lateral` : void 0, h2 = d2.on ? (0, k.ll)` on ${d2.on}` : void 0;
            if ((0, f.is)(e2, J.mu)) {
              let a11 = e2[J.mu.Symbol.Name], c3 = e2[J.mu.Symbol.Schema], f2 = e2[J.mu.Symbol.OriginalName], i2 = a11 === f2 ? void 0 : d2.alias;
              b2.push((0, k.ll)`${k.ll.raw(d2.joinType)} join${g2} ${c3 ? (0, k.ll)`${k.ll.identifier(c3)}.` : void 0}${k.ll.identifier(f2)}${i2 && (0, k.ll)` ${k.ll.identifier(i2)}`}${h2}`);
            } else if ((0, f.is)(e2, k.Ss)) {
              let a11 = e2[m.n].name, c3 = e2[m.n].schema, f2 = e2[m.n].originalName, i2 = a11 === f2 ? void 0 : d2.alias;
              b2.push((0, k.ll)`${k.ll.raw(d2.joinType)} join${g2} ${c3 ? (0, k.ll)`${k.ll.identifier(c3)}.` : void 0}${k.ll.identifier(f2)}${i2 && (0, k.ll)` ${k.ll.identifier(i2)}`}${h2}`);
            } else b2.push((0, k.ll)`${k.ll.raw(d2.joinType)} join${g2} ${e2}${h2}`);
            c2 < a10.length - 1 && b2.push((0, k.ll)` `);
          }
          return k.ll.join(b2);
        }
        buildFromTable(a10) {
          if ((0, f.is)(a10, l.XI) && a10[l.XI.Symbol.IsAlias]) {
            let b2 = (0, k.ll)`${k.ll.identifier(a10[l.XI.Symbol.OriginalName])}`;
            return a10[l.XI.Symbol.Schema] && (b2 = (0, k.ll)`${k.ll.identifier(a10[l.XI.Symbol.Schema])}.${b2}`), (0, k.ll)`${b2} ${k.ll.identifier(a10[l.XI.Symbol.Name])}`;
          }
          return a10;
        }
        buildSelectQuery({ withList: a10, fields: b2, fieldsFlat: c2, where: d2, having: e2, table: g2, joins: h2, orderBy: i2, groupBy: n2, limit: o2, offset: p2, lockingClause: q2, distinct: r2, setOperators: s2 }) {
          let t2, u2, v2, w2 = c2 ?? (0, N.He)(b2);
          for (let a11 of w2) {
            let b3;
            if ((0, f.is)(a11.field, j.V) && (0, l.Io)(a11.field.table) !== ((0, f.is)(g2, M.n) ? g2._.alias : (0, f.is)(g2, O) ? g2[m.n].name : (0, f.is)(g2, k.Xs) ? void 0 : (0, l.Io)(g2)) && (b3 = a11.field.table, !h2?.some(({ alias: a12 }) => a12 === (b3[l.XI.Symbol.IsAlias] ? (0, l.Io)(b3) : b3[l.XI.Symbol.BaseName])))) {
              let b4 = (0, l.Io)(a11.field.table);
              throw Error(`Your "${a11.path.join("->")}" field references a column "${b4}"."${a11.field.name}", but the table "${b4}" is not part of the query! Did you forget to join it?`);
            }
          }
          let x2 = !h2 || 0 === h2.length, y2 = this.buildWithCTE(a10);
          r2 && (t2 = true === r2 ? (0, k.ll)` distinct` : (0, k.ll)` distinct on (${k.ll.join(r2.on, (0, k.ll)`, `)})`);
          let z2 = this.buildSelection(w2, { isSingleTable: x2 }), A2 = this.buildFromTable(g2), B2 = this.buildJoins(h2), C2 = d2 ? (0, k.ll)` where ${d2}` : void 0, D2 = e2 ? (0, k.ll)` having ${e2}` : void 0;
          i2 && i2.length > 0 && (u2 = (0, k.ll)` order by ${k.ll.join(i2, (0, k.ll)`, `)}`), n2 && n2.length > 0 && (v2 = (0, k.ll)` group by ${k.ll.join(n2, (0, k.ll)`, `)}`);
          let E2 = "object" == typeof o2 || "number" == typeof o2 && o2 >= 0 ? (0, k.ll)` limit ${o2}` : void 0, F2 = p2 ? (0, k.ll)` offset ${p2}` : void 0, G2 = k.ll.empty();
          if (q2) {
            let a11 = (0, k.ll)` for ${k.ll.raw(q2.strength)}`;
            q2.config.of && a11.append((0, k.ll)` of ${k.ll.join(Array.isArray(q2.config.of) ? q2.config.of : [q2.config.of], (0, k.ll)`, `)}`), q2.config.noWait ? a11.append((0, k.ll)` nowait`) : q2.config.skipLocked && a11.append((0, k.ll)` skip locked`), G2.append(a11);
          }
          let H2 = (0, k.ll)`${y2}select${t2} ${z2} from ${A2}${B2}${C2}${v2}${D2}${u2}${E2}${F2}${G2}`;
          return s2.length > 0 ? this.buildSetOperations(H2, s2) : H2;
        }
        buildSetOperations(a10, b2) {
          let [c2, ...d2] = b2;
          if (!c2) throw Error("Cannot pass undefined values to any set operator");
          return 0 === d2.length ? this.buildSetOperationQuery({ leftSelect: a10, setOperator: c2 }) : this.buildSetOperations(this.buildSetOperationQuery({ leftSelect: a10, setOperator: c2 }), d2);
        }
        buildSetOperationQuery({ leftSelect: a10, setOperator: { type: b2, isAll: c2, rightSelect: d2, limit: e2, orderBy: g2, offset: h2 } }) {
          let i2, j2 = (0, k.ll)`(${a10.getSQL()}) `, l2 = (0, k.ll)`(${d2.getSQL()})`;
          if (g2 && g2.length > 0) {
            let a11 = [];
            for (let b3 of g2) if ((0, f.is)(b3, B.Kl)) a11.push(k.ll.identifier(b3.name));
            else if ((0, f.is)(b3, k.Xs)) {
              for (let a12 = 0; a12 < b3.queryChunks.length; a12++) {
                let c3 = b3.queryChunks[a12];
                (0, f.is)(c3, B.Kl) && (b3.queryChunks[a12] = k.ll.identifier(c3.name));
              }
              a11.push((0, k.ll)`${b3}`);
            } else a11.push((0, k.ll)`${b3}`);
            i2 = (0, k.ll)` order by ${k.ll.join(a11, (0, k.ll)`, `)} `;
          }
          let m2 = "object" == typeof e2 || "number" == typeof e2 && e2 >= 0 ? (0, k.ll)` limit ${e2}` : void 0, n2 = k.ll.raw(`${b2} ${c2 ? "all " : ""}`), o2 = h2 ? (0, k.ll)` offset ${h2}` : void 0;
          return (0, k.ll)`${j2}${n2}${l2}${i2}${m2}${o2}`;
        }
        buildInsertQuery({ table: a10, values: b2, onConflict: c2, returning: d2, withList: e2, select: g2, overridingSystemValue_: h2 }) {
          let i2 = [], j2 = Object.entries(a10[l.XI.Symbol.Columns]).filter(([a11, b3]) => !b3.shouldDisableInsert()), m2 = j2.map(([, a11]) => k.ll.identifier(this.casing.getColumnCasing(a11)));
          if (g2) (0, f.is)(b2, k.Xs) ? i2.push(b2) : i2.push(b2.getSQL());
          else for (let [a11, c3] of (i2.push(k.ll.raw("values ")), b2.entries())) {
            let d3 = [];
            for (let [a12, b3] of j2) {
              let e3 = c3[a12];
              if (void 0 === e3 || (0, f.is)(e3, k.Iw) && void 0 === e3.value) if (void 0 !== b3.defaultFn) {
                let a13 = b3.defaultFn(), c4 = (0, f.is)(a13, k.Xs) ? a13 : k.ll.param(a13, b3);
                d3.push(c4);
              } else if (b3.default || void 0 === b3.onUpdateFn) d3.push((0, k.ll)`default`);
              else {
                let a13 = b3.onUpdateFn(), c4 = (0, f.is)(a13, k.Xs) ? a13 : k.ll.param(a13, b3);
                d3.push(c4);
              }
              else d3.push(e3);
            }
            i2.push(d3), a11 < b2.length - 1 && i2.push((0, k.ll)`, `);
          }
          let n2 = this.buildWithCTE(e2), o2 = k.ll.join(i2), p2 = d2 ? (0, k.ll)` returning ${this.buildSelection(d2, { isSingleTable: true })}` : void 0, q2 = c2 ? (0, k.ll)` on conflict ${c2}` : void 0, r2 = true === h2 ? (0, k.ll)`overriding system value ` : void 0;
          return (0, k.ll)`${n2}insert into ${a10} ${m2} ${r2}${o2}${q2}${p2}`;
        }
        buildRefreshMaterializedViewQuery({ view: a10, concurrently: b2, withNoData: c2 }) {
          let d2 = b2 ? (0, k.ll)` concurrently` : void 0, e2 = c2 ? (0, k.ll)` with no data` : void 0;
          return (0, k.ll)`refresh materialized view${d2} ${a10}${e2}`;
        }
        prepareTyping(a10) {
          if ((0, f.is)(a10, C.kn) || (0, f.is)(a10, D.iX)) return "json";
          if ((0, f.is)(a10, E.Z5)) return "decimal";
          if ((0, f.is)(a10, F.Xd)) return "time";
          if ((0, f.is)(a10, G.KM) || (0, f.is)(a10, G.xQ)) return "timestamp";
          if ((0, f.is)(a10, H.qw) || (0, f.is)(a10, H.dw)) return "date";
          else if ((0, f.is)(a10, I.dL)) return "uuid";
          else return "none";
        }
        sqlToQuery(a10, b2) {
          return a10.toQuery({ casing: this.casing, escapeName: this.escapeName, escapeParam: this.escapeParam, escapeString: this.escapeString, prepareTyping: this.prepareTyping, invokeSource: b2 });
        }
        buildRelationalQueryWithoutPK({ fullSchema: a10, schema: b2, tableNamesMap: c2, table: d2, tableConfig: e2, queryConfig: g2, tableAlias: h2, nestedQueryRelation: i2, joinOn: m2 }) {
          let n2, o2 = [], p2, u2, v2 = [], w2, x2 = [];
          if (true === g2) o2 = Object.entries(e2.columns).map(([a11, b3]) => ({ dbKey: b3.name, tsKey: a11, field: r(b3, h2), relationTableTsKey: void 0, isJson: false, selection: [] }));
          else {
            let d3 = Object.fromEntries(Object.entries(e2.columns).map(([a11, b3]) => [a11, r(b3, h2)]));
            if (g2.where) {
              let a11 = "function" == typeof g2.where ? g2.where(d3, (0, K.mm)()) : g2.where;
              w2 = a11 && t(a11, h2);
            }
            let i3 = [], m3 = [];
            if (g2.columns) {
              let a11 = false;
              for (let [b3, c3] of Object.entries(g2.columns)) void 0 !== c3 && b3 in e2.columns && (a11 || true !== c3 || (a11 = true), m3.push(b3));
              m3.length > 0 && (m3 = a11 ? m3.filter((a12) => g2.columns?.[a12] === true) : Object.keys(e2.columns).filter((a12) => !m3.includes(a12)));
            } else m3 = Object.keys(e2.columns);
            for (let a11 of m3) {
              let b3 = e2.columns[a11];
              i3.push({ tsKey: a11, value: b3 });
            }
            let n3 = [];
            if (g2.with && (n3 = Object.entries(g2.with).filter((a11) => !!a11[1]).map(([a11, b3]) => ({ tsKey: a11, queryConfig: b3, relation: e2.relations[a11] }))), g2.extras) for (let [a11, b3] of Object.entries("function" == typeof g2.extras ? g2.extras(d3, { sql: k.ll }) : g2.extras)) i3.push({ tsKey: a11, value: s(b3, h2) });
            for (let { tsKey: a11, value: b3 } of i3) o2.push({ dbKey: (0, f.is)(b3, k.Xs.Aliased) ? b3.fieldAlias : e2.columns[a11].name, tsKey: a11, field: (0, f.is)(b3, j.V) ? r(b3, h2) : b3, relationTableTsKey: void 0, isJson: false, selection: [] });
            let q2 = "function" == typeof g2.orderBy ? g2.orderBy(d3, (0, K.rl)()) : g2.orderBy ?? [];
            for (let { tsKey: d4, queryConfig: e3, relation: i4 } of (Array.isArray(q2) || (q2 = [q2]), v2 = q2.map((a11) => (0, f.is)(a11, j.V) ? r(a11, h2) : t(a11, h2)), p2 = g2.limit, u2 = g2.offset, n3)) {
              let g3 = (0, K.W0)(b2, c2, i4), j2 = c2[(0, l.Lf)(i4.referencedTable)], m4 = `${h2}_${d4}`, n4 = (0, L.Uo)(...g3.fields.map((a11, b3) => (0, L.eq)(r(g3.references[b3], m4), r(a11, h2)))), p3 = this.buildRelationalQueryWithoutPK({ fullSchema: a10, schema: b2, tableNamesMap: c2, table: a10[j2], tableConfig: b2[j2], queryConfig: (0, f.is)(i4, K.pD) ? true === e3 ? { limit: 1 } : { ...e3, limit: 1 } : e3, tableAlias: m4, joinOn: n4, nestedQueryRelation: i4 }), q3 = (0, k.ll)`${k.ll.identifier(m4)}.${k.ll.identifier("data")}`.as(d4);
              x2.push({ on: (0, k.ll)`true`, table: new M.n(p3.sql, {}, m4), alias: m4, joinType: "left", lateral: true }), o2.push({ dbKey: d4, tsKey: d4, field: q3, relationTableTsKey: j2, isJson: true, selection: p3.selection });
            }
          }
          if (0 === o2.length) throw new y({ message: `No fields selected for table "${e2.tsName}" ("${h2}")` });
          if (w2 = (0, L.Uo)(m2, w2), i2) {
            let a11 = (0, k.ll)`json_build_array(${k.ll.join(o2.map(({ field: a12, tsKey: b4, isJson: c3 }) => c3 ? (0, k.ll)`${k.ll.identifier(`${h2}_${b4}`)}.${k.ll.identifier("data")}` : (0, f.is)(a12, k.Xs.Aliased) ? a12.sql : a12), (0, k.ll)`, `)})`;
            (0, f.is)(i2, K.iv) && (a11 = (0, k.ll)`coalesce(json_agg(${a11}${v2.length > 0 ? (0, k.ll)` order by ${k.ll.join(v2, (0, k.ll)`, `)}` : void 0}), '[]'::json)`);
            let b3 = [{ dbKey: "data", tsKey: "data", field: a11.as("data"), isJson: true, relationTableTsKey: e2.tsName, selection: o2 }];
            void 0 !== p2 || void 0 !== u2 || v2.length > 0 ? (n2 = this.buildSelectQuery({ table: q(d2, h2), fields: {}, fieldsFlat: [{ path: [], field: k.ll.raw("*") }], where: w2, limit: p2, offset: u2, orderBy: v2, setOperators: [] }), w2 = void 0, p2 = void 0, u2 = void 0, v2 = []) : n2 = q(d2, h2), n2 = this.buildSelectQuery({ table: (0, f.is)(n2, J.mu) ? n2 : new M.n(n2, {}, h2), fields: {}, fieldsFlat: b3.map(({ field: a12 }) => ({ path: [], field: (0, f.is)(a12, j.V) ? r(a12, h2) : a12 })), joins: x2, where: w2, limit: p2, offset: u2, orderBy: v2, setOperators: [] });
          } else n2 = this.buildSelectQuery({ table: q(d2, h2), fields: {}, fieldsFlat: o2.map(({ field: a11 }) => ({ path: [], field: (0, f.is)(a11, j.V) ? r(a11, h2) : a11 })), joins: x2, where: w2, limit: p2, offset: u2, orderBy: v2, setOperators: [] });
          return { tableTsKey: e2.tsName, sql: n2, selection: o2 };
        }
      }
      class Q {
        static [f.i] = "SelectionProxyHandler";
        config;
        constructor(a10) {
          this.config = { ...a10 };
        }
        get(a10, b2) {
          if ("_" === b2) return { ...a10._, selectedFields: new Proxy(a10._.selectedFields, this) };
          if (b2 === m.n) return { ...a10[m.n], selectedFields: new Proxy(a10[m.n].selectedFields, this) };
          if ("symbol" == typeof b2) return a10[b2];
          let c2 = ((0, f.is)(a10, M.n) ? a10._.selectedFields : (0, f.is)(a10, k.Ss) ? a10[m.n].selectedFields : a10)[b2];
          if ((0, f.is)(c2, k.Xs.Aliased)) {
            if ("sql" === this.config.sqlAliasedBehavior && !c2.isSelectionField) return c2.sql;
            let a11 = c2.clone();
            return a11.isSelectionField = true, a11;
          }
          if ((0, f.is)(c2, k.Xs)) {
            if ("sql" === this.config.sqlBehavior) return c2;
            throw Error(`You tried to reference "${b2}" field from a subquery, which is a raw SQL field, but it doesn't have an alias declared. Please add an alias to the field using ".as('alias')" method.`);
          }
          return (0, f.is)(c2, j.V) ? this.config.alias ? new Proxy(c2, new n(new Proxy(c2.table, new o(this.config.alias, this.config.replaceOriginalName ?? false)))) : c2 : "object" != typeof c2 || null === c2 ? c2 : new Proxy(c2, new Q(this.config));
        }
      }
      class R {
        static [f.i] = "TypedQueryBuilder";
        getSelectedFields() {
          return this._.selectedFields;
        }
      }
      class S {
        static [f.i] = "QueryPromise";
        [Symbol.toStringTag] = "QueryPromise";
        catch(a10) {
          return this.then(void 0, a10);
        }
        finally(a10) {
          return this.then((b2) => (a10?.(), b2), (b2) => {
            throw a10?.(), b2;
          });
        }
        then(a10, b2) {
          return this.execute().then(a10, b2);
        }
      }
      var T = c(1664);
      function U(a10) {
        return (0, f.is)(a10, J.mu) ? [a10[l.Sj] ? `${a10[l.Sj]}.${a10[l.XI.Symbol.BaseName]}` : a10[l.XI.Symbol.BaseName]] : (0, f.is)(a10, M.n) ? a10._.usedTables ?? [] : (0, f.is)(a10, k.Xs) ? a10.usedTables ?? [] : [];
      }
      class V {
        static [f.i] = "PgSelectBuilder";
        fields;
        session;
        dialect;
        withList = [];
        distinct;
        constructor(a10) {
          this.fields = a10.fields, this.session = a10.session, this.dialect = a10.dialect, a10.withList && (this.withList = a10.withList), this.distinct = a10.distinct;
        }
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        from(a10) {
          let b2, c2 = !!this.fields;
          return b2 = this.fields ? this.fields : (0, f.is)(a10, M.n) ? Object.fromEntries(Object.keys(a10._.selectedFields).map((b3) => [b3, a10[b3]])) : (0, f.is)(a10, O) ? a10[m.n].selectedFields : (0, f.is)(a10, k.Xs) ? {} : (0, N.YD)(a10), new X({ table: a10, fields: b2, isPartialSelect: c2, session: this.session, dialect: this.dialect, withList: this.withList, distinct: this.distinct }).setToken(this.authToken);
        }
      }
      class W extends R {
        static [f.i] = "PgSelectQueryBuilder";
        _;
        config;
        joinsNotNullableMap;
        tableName;
        isPartialSelect;
        session;
        dialect;
        cacheConfig = void 0;
        usedTables = /* @__PURE__ */ new Set();
        constructor({ table: a10, fields: b2, isPartialSelect: c2, session: d2, dialect: e2, withList: f2, distinct: g2 }) {
          for (let h2 of (super(), this.config = { withList: f2, table: a10, fields: { ...b2 }, distinct: g2, setOperators: [] }, this.isPartialSelect = c2, this.session = d2, this.dialect = e2, this._ = { selectedFields: b2, config: this.config }, this.tableName = (0, N.zN)(a10), this.joinsNotNullableMap = "string" == typeof this.tableName ? { [this.tableName]: true } : {}, U(a10))) this.usedTables.add(h2);
        }
        getUsedTables() {
          return [...this.usedTables];
        }
        createJoin(a10, b2) {
          return (c2, d2) => {
            let e2 = this.tableName, g2 = (0, N.zN)(c2);
            for (let a11 of U(c2)) this.usedTables.add(a11);
            if ("string" == typeof g2 && this.config.joins?.some((a11) => a11.alias === g2)) throw Error(`Alias "${g2}" is already used in this query`);
            if (!this.isPartialSelect && (1 === Object.keys(this.joinsNotNullableMap).length && "string" == typeof e2 && (this.config.fields = { [e2]: this.config.fields }), "string" == typeof g2 && !(0, f.is)(c2, k.Xs))) {
              let a11 = (0, f.is)(c2, M.n) ? c2._.selectedFields : (0, f.is)(c2, k.Ss) ? c2[m.n].selectedFields : c2[l.XI.Symbol.Columns];
              this.config.fields[g2] = a11;
            }
            if ("function" == typeof d2 && (d2 = d2(new Proxy(this.config.fields, new Q({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })))), this.config.joins || (this.config.joins = []), this.config.joins.push({ on: d2, table: c2, joinType: a10, alias: g2, lateral: b2 }), "string" == typeof g2) switch (a10) {
              case "left":
                this.joinsNotNullableMap[g2] = false;
                break;
              case "right":
                this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([a11]) => [a11, false])), this.joinsNotNullableMap[g2] = true;
                break;
              case "cross":
              case "inner":
                this.joinsNotNullableMap[g2] = true;
                break;
              case "full":
                this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([a11]) => [a11, false])), this.joinsNotNullableMap[g2] = false;
            }
            return this;
          };
        }
        leftJoin = this.createJoin("left", false);
        leftJoinLateral = this.createJoin("left", true);
        rightJoin = this.createJoin("right", false);
        innerJoin = this.createJoin("inner", false);
        innerJoinLateral = this.createJoin("inner", true);
        fullJoin = this.createJoin("full", false);
        crossJoin = this.createJoin("cross", false);
        crossJoinLateral = this.createJoin("cross", true);
        createSetOperator(a10, b2) {
          return (c2) => {
            let d2 = "function" == typeof c2 ? c2(Z()) : c2;
            if (!(0, N.DV)(this.getSelectedFields(), d2.getSelectedFields())) throw Error("Set operator error (union / intersect / except): selected fields are not the same or are in a different order");
            return this.config.setOperators.push({ type: a10, isAll: b2, rightSelect: d2 }), this;
          };
        }
        union = this.createSetOperator("union", false);
        unionAll = this.createSetOperator("union", true);
        intersect = this.createSetOperator("intersect", false);
        intersectAll = this.createSetOperator("intersect", true);
        except = this.createSetOperator("except", false);
        exceptAll = this.createSetOperator("except", true);
        addSetOperators(a10) {
          return this.config.setOperators.push(...a10), this;
        }
        where(a10) {
          return "function" == typeof a10 && (a10 = a10(new Proxy(this.config.fields, new Q({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })))), this.config.where = a10, this;
        }
        having(a10) {
          return "function" == typeof a10 && (a10 = a10(new Proxy(this.config.fields, new Q({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })))), this.config.having = a10, this;
        }
        groupBy(...a10) {
          if ("function" == typeof a10[0]) {
            let b2 = a10[0](new Proxy(this.config.fields, new Q({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" })));
            this.config.groupBy = Array.isArray(b2) ? b2 : [b2];
          } else this.config.groupBy = a10;
          return this;
        }
        orderBy(...a10) {
          if ("function" == typeof a10[0]) {
            let b2 = a10[0](new Proxy(this.config.fields, new Q({ sqlAliasedBehavior: "alias", sqlBehavior: "sql" }))), c2 = Array.isArray(b2) ? b2 : [b2];
            this.config.setOperators.length > 0 ? this.config.setOperators.at(-1).orderBy = c2 : this.config.orderBy = c2;
          } else this.config.setOperators.length > 0 ? this.config.setOperators.at(-1).orderBy = a10 : this.config.orderBy = a10;
          return this;
        }
        limit(a10) {
          return this.config.setOperators.length > 0 ? this.config.setOperators.at(-1).limit = a10 : this.config.limit = a10, this;
        }
        offset(a10) {
          return this.config.setOperators.length > 0 ? this.config.setOperators.at(-1).offset = a10 : this.config.offset = a10, this;
        }
        for(a10, b2 = {}) {
          return this.config.lockingClause = { strength: a10, config: b2 }, this;
        }
        getSQL() {
          return this.dialect.buildSelectQuery(this.config);
        }
        toSQL() {
          let { typings: a10, ...b2 } = this.dialect.sqlToQuery(this.getSQL());
          return b2;
        }
        as(a10) {
          let b2 = [];
          if (b2.push(...U(this.config.table)), this.config.joins) for (let a11 of this.config.joins) b2.push(...U(a11.table));
          return new Proxy(new M.n(this.getSQL(), this.config.fields, a10, false, [...new Set(b2)]), new Q({ alias: a10, sqlAliasedBehavior: "alias", sqlBehavior: "error" }));
        }
        getSelectedFields() {
          return new Proxy(this.config.fields, new Q({ alias: this.tableName, sqlAliasedBehavior: "alias", sqlBehavior: "error" }));
        }
        $dynamic() {
          return this;
        }
        $withCache(a10) {
          return this.cacheConfig = void 0 === a10 ? { config: {}, enable: true, autoInvalidate: true } : false === a10 ? { enable: false } : { enable: true, autoInvalidate: true, ...a10 }, this;
        }
      }
      class X extends W {
        static [f.i] = "PgSelect";
        _prepare(a10) {
          let { session: b2, config: c2, dialect: d2, joinsNotNullableMap: e2, authToken: f2, cacheConfig: g2, usedTables: h2 } = this;
          if (!b2) throw Error("Cannot execute a query on a query builder. Please use a database instance instead.");
          let { fields: i2 } = c2;
          return T.k.startActiveSpan("drizzle.prepareQuery", () => {
            let c3 = (0, N.He)(i2), j2 = b2.prepareQuery(d2.sqlToQuery(this.getSQL()), c3, a10, true, void 0, { type: "select", tables: [...h2] }, g2);
            return j2.joinsNotNullableMap = e2, j2.setToken(f2);
          });
        }
        prepare(a10) {
          return this._prepare(a10);
        }
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        execute = (a10) => T.k.startActiveSpan("drizzle.operation", () => this._prepare().execute(a10, this.authToken));
      }
      function Y(a10, b2) {
        return (c2, d2, ...e2) => {
          let f2 = [d2, ...e2].map((c3) => ({ type: a10, isAll: b2, rightSelect: c3 }));
          for (let a11 of f2) if (!(0, N.DV)(c2.getSelectedFields(), a11.rightSelect.getSelectedFields())) throw Error("Set operator error (union / intersect / except): selected fields are not the same or are in a different order");
          return c2.addSetOperators(f2);
        };
      }
      (0, N.XJ)(X, [S]);
      let Z = () => ({ union: $, unionAll: _, intersect: aa, intersectAll: ab, except: ac, exceptAll: ad }), $ = Y("union", false), _ = Y("union", true), aa = Y("intersect", false), ab = Y("intersect", true), ac = Y("except", false), ad = Y("except", true);
      class ae {
        static [f.i] = "PgQueryBuilder";
        dialect;
        dialectConfig;
        constructor(a10) {
          this.dialect = (0, f.is)(a10, P) ? a10 : void 0, this.dialectConfig = (0, f.is)(a10, P) ? void 0 : a10;
        }
        $with = (a10, b2) => {
          let c2 = this;
          return { as: (d2) => ("function" == typeof d2 && (d2 = d2(c2)), new Proxy(new M.J(d2.getSQL(), b2 ?? ("getSelectedFields" in d2 ? d2.getSelectedFields() ?? {} : {}), a10, true), new Q({ alias: a10, sqlAliasedBehavior: "alias", sqlBehavior: "error" }))) };
        };
        with(...a10) {
          let b2 = this;
          return { select: function(c2) {
            return new V({ fields: c2 ?? void 0, session: void 0, dialect: b2.getDialect(), withList: a10 });
          }, selectDistinct: function(a11) {
            return new V({ fields: a11 ?? void 0, session: void 0, dialect: b2.getDialect(), distinct: true });
          }, selectDistinctOn: function(a11, c2) {
            return new V({ fields: c2 ?? void 0, session: void 0, dialect: b2.getDialect(), distinct: { on: a11 } });
          } };
        }
        select(a10) {
          return new V({ fields: a10 ?? void 0, session: void 0, dialect: this.getDialect() });
        }
        selectDistinct(a10) {
          return new V({ fields: a10 ?? void 0, session: void 0, dialect: this.getDialect(), distinct: true });
        }
        selectDistinctOn(a10, b2) {
          return new V({ fields: b2 ?? void 0, session: void 0, dialect: this.getDialect(), distinct: { on: a10 } });
        }
        getDialect() {
          return this.dialect || (this.dialect = new P(this.dialectConfig)), this.dialect;
        }
      }
      class af {
        constructor(a10, b2, c2, d2) {
          this.table = a10, this.session = b2, this.dialect = c2, this.withList = d2;
        }
        static [f.i] = "PgUpdateBuilder";
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        set(a10) {
          return new ag(this.table, (0, N.q)(this.table, a10), this.session, this.dialect, this.withList).setToken(this.authToken);
        }
      }
      class ag extends S {
        constructor(a10, b2, c2, d2, e2) {
          super(), this.session = c2, this.dialect = d2, this.config = { set: b2, table: a10, withList: e2, joins: [] }, this.tableName = (0, N.zN)(a10), this.joinsNotNullableMap = "string" == typeof this.tableName ? { [this.tableName]: true } : {};
        }
        static [f.i] = "PgUpdate";
        config;
        tableName;
        joinsNotNullableMap;
        cacheConfig;
        from(a10) {
          let b2 = (0, N.zN)(a10);
          return "string" == typeof b2 && (this.joinsNotNullableMap[b2] = true), this.config.from = a10, this;
        }
        getTableLikeFields(a10) {
          return (0, f.is)(a10, J.mu) ? a10[l.XI.Symbol.Columns] : (0, f.is)(a10, M.n) ? a10._.selectedFields : a10[m.n].selectedFields;
        }
        createJoin(a10) {
          return (b2, c2) => {
            let d2 = (0, N.zN)(b2);
            if ("string" == typeof d2 && this.config.joins.some((a11) => a11.alias === d2)) throw Error(`Alias "${d2}" is already used in this query`);
            if ("function" == typeof c2) {
              let a11 = this.config.from && !(0, f.is)(this.config.from, k.Xs) ? this.getTableLikeFields(this.config.from) : void 0;
              c2 = c2(new Proxy(this.config.table[l.XI.Symbol.Columns], new Q({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })), a11 && new Proxy(a11, new Q({ sqlAliasedBehavior: "sql", sqlBehavior: "sql" })));
            }
            if (this.config.joins.push({ on: c2, table: b2, joinType: a10, alias: d2 }), "string" == typeof d2) switch (a10) {
              case "left":
                this.joinsNotNullableMap[d2] = false;
                break;
              case "right":
                this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([a11]) => [a11, false])), this.joinsNotNullableMap[d2] = true;
                break;
              case "inner":
                this.joinsNotNullableMap[d2] = true;
                break;
              case "full":
                this.joinsNotNullableMap = Object.fromEntries(Object.entries(this.joinsNotNullableMap).map(([a11]) => [a11, false])), this.joinsNotNullableMap[d2] = false;
            }
            return this;
          };
        }
        leftJoin = this.createJoin("left");
        rightJoin = this.createJoin("right");
        innerJoin = this.createJoin("inner");
        fullJoin = this.createJoin("full");
        where(a10) {
          return this.config.where = a10, this;
        }
        returning(a10) {
          if (!a10 && (a10 = Object.assign({}, this.config.table[l.XI.Symbol.Columns]), this.config.from)) {
            let b2 = (0, N.zN)(this.config.from);
            if ("string" == typeof b2 && this.config.from && !(0, f.is)(this.config.from, k.Xs)) {
              let c2 = this.getTableLikeFields(this.config.from);
              a10[b2] = c2;
            }
            for (let b3 of this.config.joins) {
              let c2 = (0, N.zN)(b3.table);
              if ("string" == typeof c2 && !(0, f.is)(b3.table, k.Xs)) {
                let d2 = this.getTableLikeFields(b3.table);
                a10[c2] = d2;
              }
            }
          }
          return this.config.returningFields = a10, this.config.returning = (0, N.He)(a10), this;
        }
        getSQL() {
          return this.dialect.buildUpdateQuery(this.config);
        }
        toSQL() {
          let { typings: a10, ...b2 } = this.dialect.sqlToQuery(this.getSQL());
          return b2;
        }
        _prepare(a10) {
          let b2 = this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, a10, true, void 0, { type: "insert", tables: U(this.config.table) }, this.cacheConfig);
          return b2.joinsNotNullableMap = this.joinsNotNullableMap, b2;
        }
        prepare(a10) {
          return this._prepare(a10);
        }
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        execute = (a10) => this._prepare().execute(a10, this.authToken);
        getSelectedFields() {
          return this.config.returningFields ? new Proxy(this.config.returningFields, new Q({ alias: (0, l.Io)(this.config.table), sqlAliasedBehavior: "alias", sqlBehavior: "error" })) : void 0;
        }
        $dynamic() {
          return this;
        }
      }
      class ah {
        constructor(a10, b2, c2, d2, e2) {
          this.table = a10, this.session = b2, this.dialect = c2, this.withList = d2, this.overridingSystemValue_ = e2;
        }
        static [f.i] = "PgInsertBuilder";
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        overridingSystemValue() {
          return this.overridingSystemValue_ = true, this;
        }
        values(a10) {
          if (0 === (a10 = Array.isArray(a10) ? a10 : [a10]).length) throw Error("values() must be called with at least one value");
          let b2 = a10.map((a11) => {
            let b3 = {}, c2 = this.table[l.XI.Symbol.Columns];
            for (let d2 of Object.keys(a11)) {
              let e2 = a11[d2];
              b3[d2] = (0, f.is)(e2, k.Xs) ? e2 : new k.Iw(e2, c2[d2]);
            }
            return b3;
          });
          return new ai(this.table, b2, this.session, this.dialect, this.withList, false, this.overridingSystemValue_).setToken(this.authToken);
        }
        select(a10) {
          let b2 = "function" == typeof a10 ? a10(new ae()) : a10;
          if (!(0, f.is)(b2, k.Xs) && !(0, N.DV)(this.table[l.e], b2._.selectedFields)) throw Error("Insert select error: selected fields are not the same or are in a different order compared to the table definition");
          return new ai(this.table, b2, this.session, this.dialect, this.withList, true);
        }
      }
      class ai extends S {
        constructor(a10, b2, c2, d2, e2, f2, g2) {
          super(), this.session = c2, this.dialect = d2, this.config = { table: a10, values: b2, withList: e2, select: f2, overridingSystemValue_: g2 };
        }
        static [f.i] = "PgInsert";
        config;
        cacheConfig;
        returning(a10 = this.config.table[l.XI.Symbol.Columns]) {
          return this.config.returningFields = a10, this.config.returning = (0, N.He)(a10), this;
        }
        onConflictDoNothing(a10 = {}) {
          if (void 0 === a10.target) this.config.onConflict = (0, k.ll)`do nothing`;
          else {
            let b2 = "";
            b2 = Array.isArray(a10.target) ? a10.target.map((a11) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(a11))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(a10.target));
            let c2 = a10.where ? (0, k.ll)` where ${a10.where}` : void 0;
            this.config.onConflict = (0, k.ll)`(${k.ll.raw(b2)})${c2} do nothing`;
          }
          return this;
        }
        onConflictDoUpdate(a10) {
          if (a10.where && (a10.targetWhere || a10.setWhere)) throw Error('You cannot use both "where" and "targetWhere"/"setWhere" at the same time - "where" is deprecated, use "targetWhere" or "setWhere" instead.');
          let b2 = a10.where ? (0, k.ll)` where ${a10.where}` : void 0, c2 = a10.targetWhere ? (0, k.ll)` where ${a10.targetWhere}` : void 0, d2 = a10.setWhere ? (0, k.ll)` where ${a10.setWhere}` : void 0, e2 = this.dialect.buildUpdateSet(this.config.table, (0, N.q)(this.config.table, a10.set)), f2 = "";
          return f2 = Array.isArray(a10.target) ? a10.target.map((a11) => this.dialect.escapeName(this.dialect.casing.getColumnCasing(a11))).join(",") : this.dialect.escapeName(this.dialect.casing.getColumnCasing(a10.target)), this.config.onConflict = (0, k.ll)`(${k.ll.raw(f2)})${c2} do update set ${e2}${b2}${d2}`, this;
        }
        getSQL() {
          return this.dialect.buildInsertQuery(this.config);
        }
        toSQL() {
          let { typings: a10, ...b2 } = this.dialect.sqlToQuery(this.getSQL());
          return b2;
        }
        _prepare(a10) {
          return T.k.startActiveSpan("drizzle.prepareQuery", () => this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, a10, true, void 0, { type: "insert", tables: U(this.config.table) }, this.cacheConfig));
        }
        prepare(a10) {
          return this._prepare(a10);
        }
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        execute = (a10) => T.k.startActiveSpan("drizzle.operation", () => this._prepare().execute(a10, this.authToken));
        getSelectedFields() {
          return this.config.returningFields ? new Proxy(this.config.returningFields, new Q({ alias: (0, l.Io)(this.config.table), sqlAliasedBehavior: "alias", sqlBehavior: "error" })) : void 0;
        }
        $dynamic() {
          return this;
        }
      }
      class aj extends S {
        constructor(a10, b2, c2, d2) {
          super(), this.session = b2, this.dialect = c2, this.config = { table: a10, withList: d2 };
        }
        static [f.i] = "PgDelete";
        config;
        cacheConfig;
        where(a10) {
          return this.config.where = a10, this;
        }
        returning(a10 = this.config.table[l.XI.Symbol.Columns]) {
          return this.config.returningFields = a10, this.config.returning = (0, N.He)(a10), this;
        }
        getSQL() {
          return this.dialect.buildDeleteQuery(this.config);
        }
        toSQL() {
          let { typings: a10, ...b2 } = this.dialect.sqlToQuery(this.getSQL());
          return b2;
        }
        _prepare(a10) {
          return T.k.startActiveSpan("drizzle.prepareQuery", () => this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), this.config.returning, a10, true, void 0, { type: "delete", tables: U(this.config.table) }, this.cacheConfig));
        }
        prepare(a10) {
          return this._prepare(a10);
        }
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        execute = (a10) => T.k.startActiveSpan("drizzle.operation", () => this._prepare().execute(a10, this.authToken));
        getSelectedFields() {
          return this.config.returningFields ? new Proxy(this.config.returningFields, new Q({ alias: (0, l.Io)(this.config.table), sqlAliasedBehavior: "alias", sqlBehavior: "error" })) : void 0;
        }
        $dynamic() {
          return this;
        }
      }
      class ak extends k.Xs {
        constructor(a10) {
          super(ak.buildEmbeddedCount(a10.source, a10.filters).queryChunks), this.params = a10, this.mapWith(Number), this.session = a10.session, this.sql = ak.buildCount(a10.source, a10.filters);
        }
        sql;
        token;
        static [f.i] = "PgCountBuilder";
        [Symbol.toStringTag] = "PgCountBuilder";
        session;
        static buildEmbeddedCount(a10, b2) {
          return (0, k.ll)`(select count(*) from ${a10}${k.ll.raw(" where ").if(b2)}${b2})`;
        }
        static buildCount(a10, b2) {
          return (0, k.ll)`select count(*) as count from ${a10}${k.ll.raw(" where ").if(b2)}${b2};`;
        }
        setToken(a10) {
          return this.token = a10, this;
        }
        then(a10, b2) {
          return Promise.resolve(this.session.count(this.sql, this.token)).then(a10, b2);
        }
        catch(a10) {
          return this.then(void 0, a10);
        }
        finally(a10) {
          return this.then((b2) => (a10?.(), b2), (b2) => {
            throw a10?.(), b2;
          });
        }
      }
      class al {
        constructor(a10, b2, c2, d2, e2, f2, g2) {
          this.fullSchema = a10, this.schema = b2, this.tableNamesMap = c2, this.table = d2, this.tableConfig = e2, this.dialect = f2, this.session = g2;
        }
        static [f.i] = "PgRelationalQueryBuilder";
        findMany(a10) {
          return new am(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, a10 || {}, "many");
        }
        findFirst(a10) {
          return new am(this.fullSchema, this.schema, this.tableNamesMap, this.table, this.tableConfig, this.dialect, this.session, a10 ? { ...a10, limit: 1 } : { limit: 1 }, "first");
        }
      }
      class am extends S {
        constructor(a10, b2, c2, d2, e2, f2, g2, h2, i2) {
          super(), this.fullSchema = a10, this.schema = b2, this.tableNamesMap = c2, this.table = d2, this.tableConfig = e2, this.dialect = f2, this.session = g2, this.config = h2, this.mode = i2;
        }
        static [f.i] = "PgRelationalQuery";
        _prepare(a10) {
          return T.k.startActiveSpan("drizzle.prepareQuery", () => {
            let { query: b2, builtQuery: c2 } = this._toSQL();
            return this.session.prepareQuery(c2, void 0, a10, true, (a11, c3) => {
              let d2 = a11.map((a12) => (0, K.I$)(this.schema, this.tableConfig, a12, b2.selection, c3));
              return "first" === this.mode ? d2[0] : d2;
            });
          });
        }
        prepare(a10) {
          return this._prepare(a10);
        }
        _getQuery() {
          return this.dialect.buildRelationalQueryWithoutPK({ fullSchema: this.fullSchema, schema: this.schema, tableNamesMap: this.tableNamesMap, table: this.table, tableConfig: this.tableConfig, queryConfig: this.config, tableAlias: this.tableConfig.tsName });
        }
        getSQL() {
          return this._getQuery().sql;
        }
        _toSQL() {
          let a10 = this._getQuery(), b2 = this.dialect.sqlToQuery(a10.sql);
          return { query: a10, builtQuery: b2 };
        }
        toSQL() {
          return this._toSQL().builtQuery;
        }
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        execute() {
          return T.k.startActiveSpan("drizzle.operation", () => this._prepare().execute(void 0, this.authToken));
        }
      }
      class an extends S {
        constructor(a10, b2, c2, d2) {
          super(), this.execute = a10, this.sql = b2, this.query = c2, this.mapBatchResult = d2;
        }
        static [f.i] = "PgRaw";
        getSQL() {
          return this.sql;
        }
        getQuery() {
          return this.query;
        }
        mapResult(a10, b2) {
          return b2 ? this.mapBatchResult(a10) : a10;
        }
        _prepare() {
          return this;
        }
        isResponseInArrayMode() {
          return false;
        }
      }
      class ao extends S {
        constructor(a10, b2, c2) {
          super(), this.session = b2, this.dialect = c2, this.config = { view: a10 };
        }
        static [f.i] = "PgRefreshMaterializedView";
        config;
        concurrently() {
          if (void 0 !== this.config.withNoData) throw Error("Cannot use concurrently and withNoData together");
          return this.config.concurrently = true, this;
        }
        withNoData() {
          if (void 0 !== this.config.concurrently) throw Error("Cannot use concurrently and withNoData together");
          return this.config.withNoData = true, this;
        }
        getSQL() {
          return this.dialect.buildRefreshMaterializedViewQuery(this.config);
        }
        toSQL() {
          let { typings: a10, ...b2 } = this.dialect.sqlToQuery(this.getSQL());
          return b2;
        }
        _prepare(a10) {
          return T.k.startActiveSpan("drizzle.prepareQuery", () => this.session.prepareQuery(this.dialect.sqlToQuery(this.getSQL()), void 0, a10, true));
        }
        prepare(a10) {
          return this._prepare(a10);
        }
        authToken;
        setToken(a10) {
          return this.authToken = a10, this;
        }
        execute = (a10) => T.k.startActiveSpan("drizzle.operation", () => this._prepare().execute(a10, this.authToken));
      }
      class ap {
        constructor(a10, b2, c2) {
          if (this.dialect = a10, this.session = b2, this._ = c2 ? { schema: c2.schema, fullSchema: c2.fullSchema, tableNamesMap: c2.tableNamesMap, session: b2 } : { schema: void 0, fullSchema: {}, tableNamesMap: {}, session: b2 }, this.query = {}, this._.schema) for (let [d2, e2] of Object.entries(this._.schema)) this.query[d2] = new al(c2.fullSchema, this._.schema, this._.tableNamesMap, c2.fullSchema[d2], e2, a10, b2);
          this.$cache = { invalidate: async (a11) => {
          } };
        }
        static [f.i] = "PgDatabase";
        query;
        $with = (a10, b2) => {
          let c2 = this;
          return { as: (d2) => ("function" == typeof d2 && (d2 = d2(new ae(c2.dialect))), new Proxy(new M.J(d2.getSQL(), b2 ?? ("getSelectedFields" in d2 ? d2.getSelectedFields() ?? {} : {}), a10, true), new Q({ alias: a10, sqlAliasedBehavior: "alias", sqlBehavior: "error" }))) };
        };
        $count(a10, b2) {
          return new ak({ source: a10, filters: b2, session: this.session });
        }
        $cache;
        with(...a10) {
          let b2 = this;
          return { select: function(c2) {
            return new V({ fields: c2 ?? void 0, session: b2.session, dialect: b2.dialect, withList: a10 });
          }, selectDistinct: function(c2) {
            return new V({ fields: c2 ?? void 0, session: b2.session, dialect: b2.dialect, withList: a10, distinct: true });
          }, selectDistinctOn: function(c2, d2) {
            return new V({ fields: d2 ?? void 0, session: b2.session, dialect: b2.dialect, withList: a10, distinct: { on: c2 } });
          }, update: function(c2) {
            return new af(c2, b2.session, b2.dialect, a10);
          }, insert: function(c2) {
            return new ah(c2, b2.session, b2.dialect, a10);
          }, delete: function(c2) {
            return new aj(c2, b2.session, b2.dialect, a10);
          } };
        }
        select(a10) {
          return new V({ fields: a10 ?? void 0, session: this.session, dialect: this.dialect });
        }
        selectDistinct(a10) {
          return new V({ fields: a10 ?? void 0, session: this.session, dialect: this.dialect, distinct: true });
        }
        selectDistinctOn(a10, b2) {
          return new V({ fields: b2 ?? void 0, session: this.session, dialect: this.dialect, distinct: { on: a10 } });
        }
        update(a10) {
          return new af(a10, this.session, this.dialect);
        }
        insert(a10) {
          return new ah(a10, this.session, this.dialect);
        }
        delete(a10) {
          return new aj(a10, this.session, this.dialect);
        }
        refreshMaterializedView(a10) {
          return new ao(a10, this.session, this.dialect);
        }
        authToken;
        execute(a10) {
          let b2 = "string" == typeof a10 ? k.ll.raw(a10) : a10.getSQL(), c2 = this.dialect.sqlToQuery(b2), d2 = this.session.prepareQuery(c2, void 0, void 0, false);
          return new an(() => d2.execute(void 0, this.authToken), b2, c2, (a11) => d2.mapResult(a11, true));
        }
        transaction(a10, b2) {
          return this.session.transaction(a10, b2);
        }
      }
      class aq {
        static [f.i] = "Cache";
      }
      class ar extends aq {
        strategy() {
          return "all";
        }
        static [f.i] = "NoopCache";
        async get(a10) {
        }
        async put(a10, b2, c2, d2) {
        }
        async onMutate(a10) {
        }
      }
      async function as(a10, b2) {
        let c2 = `${a10}-${JSON.stringify(b2)}`, d2 = new TextEncoder().encode(c2);
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256", d2))].map((a11) => a11.toString(16).padStart(2, "0")).join("");
      }
      class at {
        constructor(a10, b2, c2, d2) {
          this.query = a10, this.cache = b2, this.queryMetadata = c2, this.cacheConfig = d2, b2 && "all" === b2.strategy() && void 0 === d2 && (this.cacheConfig = { enable: true, autoInvalidate: true }), this.cacheConfig?.enable || (this.cacheConfig = void 0);
        }
        authToken;
        getQuery() {
          return this.query;
        }
        mapResult(a10, b2) {
          return a10;
        }
        setToken(a10) {
          return this.authToken = a10, this;
        }
        static [f.i] = "PgPreparedQuery";
        joinsNotNullableMap;
        async queryWithCache(a10, b2, c2) {
          if (void 0 === this.cache || (0, f.is)(this.cache, ar) || void 0 === this.queryMetadata || this.cacheConfig && !this.cacheConfig.enable) try {
            return await c2();
          } catch (c3) {
            throw new z(a10, b2, c3);
          }
          if (("insert" === this.queryMetadata.type || "update" === this.queryMetadata.type || "delete" === this.queryMetadata.type) && this.queryMetadata.tables.length > 0) try {
            let [a11] = await Promise.all([c2(), this.cache.onMutate({ tables: this.queryMetadata.tables })]);
            return a11;
          } catch (c3) {
            throw new z(a10, b2, c3);
          }
          if (!this.cacheConfig) try {
            return await c2();
          } catch (c3) {
            throw new z(a10, b2, c3);
          }
          if ("select" === this.queryMetadata.type) {
            let d2 = await this.cache.get(this.cacheConfig.tag ?? await as(a10, b2), this.queryMetadata.tables, void 0 !== this.cacheConfig.tag, this.cacheConfig.autoInvalidate);
            if (void 0 === d2) {
              let d3;
              try {
                d3 = await c2();
              } catch (c3) {
                throw new z(a10, b2, c3);
              }
              return await this.cache.put(this.cacheConfig.tag ?? await as(a10, b2), d3, this.cacheConfig.autoInvalidate ? this.queryMetadata.tables : [], void 0 !== this.cacheConfig.tag, this.cacheConfig.config), d3;
            }
            return d2;
          }
          try {
            return await c2();
          } catch (c3) {
            throw new z(a10, b2, c3);
          }
        }
      }
      class au {
        constructor(a10) {
          this.dialect = a10;
        }
        static [f.i] = "PgSession";
        execute(a10, b2) {
          return T.k.startActiveSpan("drizzle.operation", () => T.k.startActiveSpan("drizzle.prepareQuery", () => this.prepareQuery(this.dialect.sqlToQuery(a10), void 0, void 0, false)).setToken(b2).execute(void 0, b2));
        }
        all(a10) {
          return this.prepareQuery(this.dialect.sqlToQuery(a10), void 0, void 0, false).all();
        }
        async count(a10, b2) {
          return Number((await this.execute(a10, b2))[0].count);
        }
      }
      class av extends ap {
        constructor(a10, b2, c2, d2 = 0) {
          super(a10, b2, c2), this.schema = c2, this.nestedIndex = d2;
        }
        static [f.i] = "PgTransaction";
        rollback() {
          throw new A();
        }
        getTransactionConfigSQL(a10) {
          let b2 = [];
          return a10.isolationLevel && b2.push(`isolation level ${a10.isolationLevel}`), a10.accessMode && b2.push(a10.accessMode), "boolean" == typeof a10.deferrable && b2.push(a10.deferrable ? "deferrable" : "not deferrable"), k.ll.raw(b2.join(" "));
        }
        setTransaction(a10) {
          return this.session.execute((0, k.ll)`set transaction ${this.getTransactionConfigSQL(a10)}`);
        }
      }
      let { Pool: aw, types: ax } = e;
      class ay extends at {
        constructor(a10, b2, c2, d2, e2, f2, g2, h2, i2, j2, k2) {
          super({ sql: b2, params: c2 }, e2, f2, g2), this.client = a10, this.queryString = b2, this.params = c2, this.logger = d2, this.fields = h2, this._isResponseInArrayMode = j2, this.customResultMapper = k2, this.rawQueryConfig = { name: i2, text: b2, types: { getTypeParser: (a11, b3) => a11 === ax.builtins.TIMESTAMPTZ || a11 === ax.builtins.TIMESTAMP || a11 === ax.builtins.DATE || a11 === ax.builtins.INTERVAL || 1231 === a11 || 1115 === a11 || 1185 === a11 || 1187 === a11 || 1182 === a11 ? (a12) => a12 : ax.getTypeParser(a11, b3) } }, this.queryConfig = { name: i2, text: b2, rowMode: "array", types: { getTypeParser: (a11, b3) => a11 === ax.builtins.TIMESTAMPTZ || a11 === ax.builtins.TIMESTAMP || a11 === ax.builtins.DATE || a11 === ax.builtins.INTERVAL || 1231 === a11 || 1115 === a11 || 1185 === a11 || 1187 === a11 || 1182 === a11 ? (a12) => a12 : ax.getTypeParser(a11, b3) } };
        }
        static [f.i] = "NodePgPreparedQuery";
        rawQueryConfig;
        queryConfig;
        async execute(a10 = {}) {
          return T.k.startActiveSpan("drizzle.execute", async () => {
            let b2 = (0, k.Ct)(this.params, a10);
            this.logger.logQuery(this.rawQueryConfig.text, b2);
            let { fields: c2, rawQueryConfig: d2, client: e2, queryConfig: f2, joinsNotNullableMap: g2, customResultMapper: h2 } = this;
            if (!c2 && !h2) return T.k.startActiveSpan("drizzle.driver.execute", async (a11) => (a11?.setAttributes({ "drizzle.query.name": d2.name, "drizzle.query.text": d2.text, "drizzle.query.params": JSON.stringify(b2) }), this.queryWithCache(d2.text, b2, async () => await e2.query(d2, b2))));
            let i2 = await T.k.startActiveSpan("drizzle.driver.execute", (a11) => (a11?.setAttributes({ "drizzle.query.name": f2.name, "drizzle.query.text": f2.text, "drizzle.query.params": JSON.stringify(b2) }), this.queryWithCache(f2.text, b2, async () => await e2.query(f2, b2))));
            return T.k.startActiveSpan("drizzle.mapResponse", () => h2 ? h2(i2.rows) : i2.rows.map((a11) => (0, N.a6)(c2, a11, g2)));
          });
        }
        all(a10 = {}) {
          return T.k.startActiveSpan("drizzle.execute", () => {
            let b2 = (0, k.Ct)(this.params, a10);
            return this.logger.logQuery(this.rawQueryConfig.text, b2), T.k.startActiveSpan("drizzle.driver.execute", (a11) => (a11?.setAttributes({ "drizzle.query.name": this.rawQueryConfig.name, "drizzle.query.text": this.rawQueryConfig.text, "drizzle.query.params": JSON.stringify(b2) }), this.queryWithCache(this.rawQueryConfig.text, b2, async () => this.client.query(this.rawQueryConfig, b2)).then((a12) => a12.rows)));
          });
        }
        isResponseInArrayMode() {
          return this._isResponseInArrayMode;
        }
      }
      class az extends au {
        constructor(a10, b2, c2, d2 = {}) {
          super(b2), this.client = a10, this.schema = c2, this.options = d2, this.logger = d2.logger ?? new i(), this.cache = d2.cache ?? new ar();
        }
        static [f.i] = "NodePgSession";
        logger;
        cache;
        prepareQuery(a10, b2, c2, d2, e2, f2, g2) {
          return new ay(this.client, a10.sql, a10.params, this.logger, this.cache, f2, g2, b2, c2, d2, e2);
        }
        async transaction(a10, b2) {
          let c2 = this.client instanceof aw || Object.getPrototypeOf(this.client).constructor.name.includes("Pool"), d2 = c2 ? new az(await this.client.connect(), this.dialect, this.schema, this.options) : this, e2 = new aA(this.dialect, d2, this.schema);
          await e2.execute((0, k.ll)`begin${b2 ? (0, k.ll)` ${e2.getTransactionConfigSQL(b2)}` : void 0}`);
          try {
            let b3 = await a10(e2);
            return await e2.execute((0, k.ll)`commit`), b3;
          } catch (a11) {
            throw await e2.execute((0, k.ll)`rollback`), a11;
          } finally {
            c2 && d2.client.release();
          }
        }
        async count(a10) {
          return Number((await this.execute(a10)).rows[0].count);
        }
      }
      class aA extends av {
        static [f.i] = "NodePgTransaction";
        async transaction(a10) {
          let b2 = `sp${this.nestedIndex + 1}`, c2 = new aA(this.dialect, this.session, this.schema, this.nestedIndex + 1);
          await c2.execute(k.ll.raw(`savepoint ${b2}`));
          try {
            let d2 = await a10(c2);
            return await c2.execute(k.ll.raw(`release savepoint ${b2}`)), d2;
          } catch (a11) {
            throw await c2.execute(k.ll.raw(`rollback to savepoint ${b2}`)), a11;
          }
        }
      }
      class aB {
        constructor(a10, b2, c2 = {}) {
          this.client = a10, this.dialect = b2, this.options = c2;
        }
        static [f.i] = "NodePgDriver";
        createSession(a10) {
          return new az(this.client, this.dialect, a10, { logger: this.options.logger, cache: this.options.cache });
        }
      }
      class aC extends ap {
        static [f.i] = "NodePgDatabase";
      }
      function aD(a10, b2 = {}) {
        let c2, d2, e2 = new P({ casing: b2.casing });
        if (true === b2.logger ? c2 = new h() : false !== b2.logger && (c2 = b2.logger), b2.schema) {
          let a11 = (0, K._k)(b2.schema, K.DZ);
          d2 = { fullSchema: b2.schema, schema: a11.tables, tableNamesMap: a11.tableNamesMap };
        }
        let f2 = new aB(a10, e2, { logger: c2, cache: b2.cache }).createSession(d2), g2 = new aC(e2, f2, d2);
        return g2.$client = a10, g2.$cache = b2.cache, g2.$cache && (g2.$cache.invalidate = b2.cache?.onMutate), g2;
      }
      function aE(...a10) {
        if ("string" == typeof a10[0]) return aD(new e.Pool({ connectionString: a10[0] }), a10[1]);
        if ((0, N.Lq)(a10[0])) {
          let { connection: b2, client: c2, ...d2 } = a10[0];
          return c2 ? aD(c2, d2) : aD(new e.Pool("string" == typeof b2 ? { connectionString: b2 } : b2), d2);
        }
        return aD(a10[0], a10[1]);
      }
      (aE || (aE = {})).mock = function(a10) {
        return aD({}, a10);
      };
      var aF = c(2338), aG = c(2933), aH = c(4051), aI = c(3946), aJ = c(3193);
      let aK = (0, J.cJ)("appointments", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").notNull().references(() => aG.PA.id, { onDelete: "cascade" }), dentistId: (0, I.uR)("dentist_id").references(() => aG.zz.id, { onDelete: "set null" }), procedureId: (0, I.uR)("procedure_id").references(() => aG.lF.id, { onDelete: "set null" }), scheduledAt: (0, G.vE)("scheduled_at", { withTimezone: true }).notNull(), durationMinutes: (0, aH.nd)("duration_minutes").default(30), status: (0, aF.K0)("status").notNull().default("scheduled"), notes: (0, aI.Qq)("notes"), totalValue: (0, E.sH)("total_value", { precision: 10, scale: 2 }).default("0"), cancelledAt: (0, G.vE)("cancelled_at", { withTimezone: true }), cancellationReason: (0, aI.Qq)("cancellation_reason"), rescheduledAt: (0, G.vE)("rescheduled_at", { withTimezone: true }), rescheduleReason: (0, aI.Qq)("reschedule_reason"), confirmationSentAt: (0, G.vE)("confirmation_sent_at", { withTimezone: true }), reminderSentAt: (0, G.vE)("reminder_sent_at", { withTimezone: true }), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow(), deletedAt: (0, G.vE)("deleted_at", { withTimezone: true }) }), aL = (0, J.cJ)("schedule_blocks", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), dentistId: (0, I.uR)("dentist_id").references(() => aG.zz.id, { onDelete: "cascade" }), dayOfWeek: (0, aH.nd)("day_of_week"), startTime: (0, F.kB)("start_time").notNull(), endTime: (0, F.kB)("end_time").notNull(), isAvailable: (0, aJ.zM)("is_available").default(true), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), aM = (0, J.cJ)("appointment_reminders", { id: (0, I.uR)("id").primaryKey().defaultRandom(), appointmentId: (0, I.uR)("appointment_id").notNull().references(() => aK.id, { onDelete: "cascade" }), reminderType: (0, aI.Qq)("reminder_type").notNull(), channel: (0, aI.Qq)("channel").default("whatsapp"), status: (0, aI.Qq)("status").default("pending"), messageId: (0, aI.Qq)("message_id"), errorMessage: (0, aI.Qq)("error_message"), sentAt: (0, G.vE)("sent_at", { withTimezone: true }), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }), aN = (0, J.cJ)("waitlist", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").notNull().references(() => aG.PA.id, { onDelete: "cascade" }), dentistId: (0, I.uR)("dentist_id").references(() => aG.zz.id, { onDelete: "set null" }), preferredDate: (0, G.vE)("preferred_date", { withTimezone: true }), preferredTimeStart: (0, F.kB)("preferred_time_start"), preferredTimeEnd: (0, F.kB)("preferred_time_end"), priority: (0, aH.nd)("priority").default(0), notes: (0, aI.Qq)("notes"), status: (0, aI.Qq)("status").default("waiting"), procedureId: (0, I.uR)("procedure_id").references(() => aG.lF.id, { onDelete: "set null" }), notifiedAt: (0, G.vE)("notified_at", { withTimezone: true }), scheduledAppointmentId: (0, I.uR)("scheduled_appointment_id").references(() => aK.id, { onDelete: "set null" }), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), aO = (0, J.cJ)("appointment_reminder_configs", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), procedureTypeId: (0, I.uR)("procedure_type_id").notNull(), hoursBefore: (0, aH.nd)("hours_before").notNull(), messageTemplate: (0, aI.Qq)("message_template").notNull(), enabled: (0, aJ.zM)("enabled").default(true), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), aP = (0, J.cJ)("procedure_types", { id: (0, I.uR)("id").primaryKey().defaultRandom(), name: (0, aI.Qq)("name").notNull(), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() });
      var aQ = c(9466);
      let aR = (0, J.cJ)("conversations", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").references(() => aG.PA.id, { onDelete: "set null" }), channel: (0, aF.w9)("channel").notNull(), externalId: (0, aI.Qq)("external_id").notNull(), status: (0, aF.qu)("status").notNull().default("active"), assignedTo: (0, I.uR)("assigned_to").references(() => aG.VV.id, { onDelete: "set null" }), lastMessageAt: (0, G.vE)("last_message_at", { withTimezone: true }).defaultNow(), messageCount: (0, aH.nd)("message_count").default(0), metadata: (0, C.Fx)("metadata").default("{}"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), aS = (0, J.cJ)("messages", { id: (0, I.uR)("id").primaryKey().defaultRandom(), conversationId: (0, I.uR)("conversation_id").notNull().references(() => aR.id, { onDelete: "cascade" }), direction: (0, aF.H1)("direction").notNull(), content: (0, aI.Qq)("content").notNull(), messageType: (0, aF.IR)("message_type").notNull().default("text"), mediaUrl: (0, aI.Qq)("media_url"), metadata: (0, C.Fx)("metadata").default("{}"), intent: (0, aI.Qq)("intent"), entities: (0, C.Fx)("entities").default("{}"), confidence: (0, E._)("confidence", { precision: 3, scale: 2 }), embedding: (0, aQ.i1)("embedding", { dimensions: 1536 }), isAi: (0, aJ.zM)("is_ai").default(false), deliveredAt: (0, G.vE)("delivered_at", { withTimezone: true }), readAt: (0, G.vE)("read_at", { withTimezone: true }), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }), aT = (0, J.cJ)("conversation_states", { id: (0, I.uR)("id").primaryKey().defaultRandom(), conversationId: (0, I.uR)("conversation_id").notNull().references(() => aR.id, { onDelete: "cascade" }), state: (0, C.Fx)("state").default("{}").notNull(), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), aU = (0, J.cJ)("conversation_sessions", { id: (0, I.uR)("id").primaryKey().defaultRandom(), conversationId: (0, I.uR)("conversation_id").notNull().references(() => aR.id, { onDelete: "cascade" }), entries: (0, C.Fx)("entries").default("[]").notNull(), extractedInfo: (0, C.Fx)("extracted_info").default("{}").notNull(), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow().notNull(), lastActivityAt: (0, G.vE)("last_activity_at", { withTimezone: true }).defaultNow().notNull() }, (a10) => ({ uniqueConversation: { name: "unique_conversation_session", columns: [a10.conversationId], type: "unique" } })), aV = (0, J.cJ)("conversation_memories", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), conversationId: (0, I.uR)("conversation_id").references(() => aR.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").references(() => aG.PA.id, { onDelete: "set null" }), content: (0, aI.Qq)("content").notNull(), contentType: (0, aI.Qq)("content_type").default("message"), embedding: (0, aQ.i1)("embedding", { dimensions: 1536 }), metadata: (0, C.Fx)("metadata").default("{}"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() });
      var aW = c(7514);
      let aX = (0, J.cJ)("leads", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").references(() => aG.PA.id, { onDelete: "set null" }), name: (0, aI.Qq)("name").notNull(), phone: (0, aW.yf)("phone", { length: 20 }).notNull(), email: (0, aI.Qq)("email"), source: (0, aI.Qq)("source").default("other"), campaignId: (0, I.uR)("campaign_id"), score: (0, aH.nd)("score").default(0), temperature: (0, aI.Qq)("temperature").default("cold"), status: (0, aI.Qq)("status").default("new"), interest: (0, aI.Qq)("interest"), hasBudget: (0, aJ.zM)("has_budget"), hasTimeline: (0, aJ.zM)("has_timeline"), assignedTo: (0, I.uR)("assigned_to").references(() => aG.VV.id, { onDelete: "set null" }), lastContactAt: (0, G.vE)("last_contact_at", { withTimezone: true }), nextFollowupAt: (0, G.vE)("next_followup_at", { withTimezone: true }), contactCount: (0, aH.nd)("contact_count").default(0), convertedAt: (0, G.vE)("converted_at", { withTimezone: true }), convertedAppointmentId: (0, I.uR)("converted_appointment_id"), lostReason: (0, aI.Qq)("lost_reason"), lostAt: (0, G.vE)("lost_at", { withTimezone: true }), notes: (0, aI.Qq)("notes"), stageId: (0, I.uR)("stage_id"), sourceType: (0, aI.Qq)("source_type"), dealValue: (0, E.sH)("deal_value", { precision: 12, scale: 2 }).default("0"), tags: (0, aI.Qq)("tags").array().default([]), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), aY = (0, J.cJ)("lead_activities", { id: (0, I.uR)("id").primaryKey().defaultRandom(), leadId: (0, I.uR)("lead_id").notNull().references(() => aX.id, { onDelete: "cascade" }), activityType: (0, aI.Qq)("activity_type").notNull(), description: (0, aI.Qq)("description"), performedBy: (0, I.uR)("performed_by").references(() => aG.VV.id, { onDelete: "set null" }), performedAt: (0, G.vE)("performed_at", { withTimezone: true }).defaultNow(), metadata: (0, C.Fx)("metadata").default("{}"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }), aZ = (0, J.cJ)("pipeline_stages", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), name: (0, aI.Qq)("name").notNull(), position: (0, aH.nd)("position").default(0), color: (0, aW.yf)("color", { length: 7 }).default("#6b7280"), isDefault: (0, aJ.zM)("is_default").default(false), isSystem: (0, aJ.zM)("is_system").default(false), systemKey: (0, aI.Qq)("system_key"), winProbability: (0, aH.nd)("win_probability").default(0), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }, (a10) => ({ clinicStageNameUniq: { name: "pipelinestages_clinic_name_uniq", columns: [a10.clinicId, a10.name], type: "unique" } })), a$ = (0, J.cJ)("campaigns", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), name: (0, aI.Qq)("name").notNull(), description: (0, aI.Qq)("description"), campaignType: (0, aI.Qq)("campaign_type").notNull(), targetSegment: (0, aI.Qq)("target_segment"), messageTemplate: (0, aI.Qq)("message_template").notNull(), channel: (0, aI.Qq)("channel").default("whatsapp"), status: (0, aI.Qq)("status").default("draft"), scheduledAt: (0, G.vE)("scheduled_at", { withTimezone: true }), startedAt: (0, G.vE)("started_at", { withTimezone: true }), completedAt: (0, G.vE)("completed_at", { withTimezone: true }), totalRecipients: (0, aH.nd)("total_recipients").default(0), sentCount: (0, aH.nd)("sent_count").default(0), responseCount: (0, aH.nd)("response_count").default(0), conversionCount: (0, aH.nd)("conversion_count").default(0), optOutCount: (0, aH.nd)("opt_out_count").default(0), createdBy: (0, I.uR)("created_by").references(() => aG.VV.id), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), a_ = (0, J.cJ)("campaign_recipients", { id: (0, I.uR)("id").primaryKey().defaultRandom(), campaignId: (0, I.uR)("campaign_id").notNull().references(() => a$.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").notNull().references(() => aG.PA.id, { onDelete: "cascade" }), status: (0, aI.Qq)("status").default("pending"), sentAt: (0, G.vE)("sent_at", { withTimezone: true }), deliveredAt: (0, G.vE)("delivered_at", { withTimezone: true }), respondedAt: (0, G.vE)("responded_at", { withTimezone: true }), responseContent: (0, aI.Qq)("response_content"), convertedAt: (0, G.vE)("converted_at", { withTimezone: true }), conversionAppointmentId: (0, I.uR)("conversion_appointment_id"), errorMessage: (0, aI.Qq)("error_message"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }, (a10) => ({ campaignPatientUniq: { name: "campaign_recipients_campaign_patient_uniq", columns: [a10.campaignId, a10.patientId], type: "unique" } })), a0 = (0, J.cJ)("follow_ups", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").notNull().references(() => aG.PA.id, { onDelete: "cascade" }), appointmentId: (0, I.uR)("appointment_id").references(() => aK.id, { onDelete: "set null" }), type: (0, aI.Qq)("type").notNull(), scheduledAt: (0, G.vE)("scheduled_at", { withTimezone: true }).notNull(), sentAt: (0, G.vE)("sent_at", { withTimezone: true }), status: (0, aI.Qq)("status").default("pending"), content: (0, aI.Qq)("content"), response: (0, aI.Qq)("response"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), a1 = (0, J.cJ)("follow_up_configs", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), configType: (0, aI.Qq)("config_type").notNull(), procedureId: (0, I.uR)("procedure_id").references(() => aG.lF.id, { onDelete: "cascade" }), procedureName: (0, aI.Qq)("procedure_name"), delayHours: (0, aH.nd)("delay_hours"), delayDays: (0, aH.nd)("delay_days"), delayMonths: (0, aH.nd)("delay_months"), messageTemplate: (0, aI.Qq)("message_template").notNull(), isActive: (0, aJ.zM)("is_active").default(true), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), a2 = (0, J.cJ)("tasks", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), leadId: (0, I.uR)("lead_id").references(() => aX.id, { onDelete: "set null" }), title: (0, aI.Qq)("title").notNull(), description: (0, aI.Qq)("description"), dueDate: (0, G.vE)("due_date", { withTimezone: true }), status: (0, aI.Qq)("status").default("pending"), priority: (0, aI.Qq)("priority").default("medium"), assignedTo: (0, I.uR)("assigned_to").references(() => aG.VV.id, { onDelete: "set null" }), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), a3 = (0, J.cJ)("clinic_tags", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), name: (0, aI.Qq)("name").notNull(), color: (0, aW.yf)("color", { length: 7 }).default("#6b7280"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }, (a10) => ({ clinicTagNameUniq: { name: "clinictags_clinic_name_uniq", columns: [a10.clinicId, a10.name], type: "unique" } })), a4 = (0, J.cJ)("campaign_segments", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), name: (0, aI.Qq)("name").notNull(), description: (0, aI.Qq)("description"), criteria: (0, C.Fx)("criteria").notNull(), patientCount: (0, aH.nd)("patient_count").default(0), createdBy: (0, I.uR)("created_by"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow(), deletedAt: (0, G.vE)("deleted_at", { withTimezone: true }) }), a5 = (0, J.cJ)("budgets", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").notNull().references(() => aG.PA.id, { onDelete: "cascade" }), appointmentId: (0, I.uR)("appointment_id").references(() => aK.id, { onDelete: "set null" }), title: (0, aI.Qq)("title"), description: (0, aI.Qq)("description"), totalValue: (0, E.sH)("total_value", { precision: 10, scale: 2 }).notNull(), discountPercent: (0, E.sH)("discount_percent", { precision: 5, scale: 2 }).default("0"), discountValue: (0, E.sH)("discount_value", { precision: 10, scale: 2 }).default("0"), finalValue: (0, E.sH)("final_value", { precision: 10, scale: 2 }).notNull(), status: (0, aI.Qq)("status").default("pending"), validUntil: (0, G.vE)("valid_until", { withTimezone: true }), sentAt: (0, G.vE)("sent_at", { withTimezone: true }), respondedAt: (0, G.vE)("responded_at", { withTimezone: true }), convertedAt: (0, G.vE)("converted_at", { withTimezone: true }), conversionAppointmentId: (0, I.uR)("conversion_appointment_id"), notes: (0, aI.Qq)("notes"), followUpSequence: (0, aH.nd)("follow_up_sequence").default(0), nextFollowUpAt: (0, G.vE)("next_follow_up_at", { withTimezone: true }), createdBy: (0, I.uR)("created_by").references(() => aG.VV.id), treatmentPlanId: (0, I.uR)("treatment_plan_id"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), a6 = (0, J.cJ)("budget_items", { id: (0, I.uR)("id").primaryKey().defaultRandom(), budgetId: (0, I.uR)("budget_id").notNull().references(() => a5.id, { onDelete: "cascade" }), procedureId: (0, I.uR)("procedure_id").references(() => aG.lF.id, { onDelete: "set null" }), procedureName: (0, aI.Qq)("procedure_name").notNull(), quantity: (0, aH.nd)("quantity").default(1), unitPrice: (0, E.sH)("unit_price", { precision: 10, scale: 2 }).notNull(), discountPercent: (0, E.sH)("discount_percent", { precision: 5, scale: 2 }).default("0"), totalPrice: (0, E.sH)("total_price", { precision: 10, scale: 2 }).notNull(), notes: (0, aI.Qq)("notes"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }), a7 = (0, J.cJ)("budget_installments", { id: (0, I.uR)("id").primaryKey().defaultRandom(), budgetId: (0, I.uR)("budget_id").notNull().references(() => a5.id, { onDelete: "cascade" }), amount: (0, E.sH)("amount", { precision: 12, scale: 2 }).notNull(), dueDate: (0, H.p6)("due_date").notNull(), status: (0, aI.Qq)("status").default("pending"), paidAt: (0, G.vE)("paid_at", { withTimezone: true }), paymentId: (0, I.uR)("payment_id"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), a8 = (0, J.cJ)("payments", { id: (0, I.uR)("id").primaryKey().defaultRandom(), patientId: (0, I.uR)("patient_id").references(() => aG.PA.id, { onDelete: "set null" }), clinicId: (0, I.uR)("clinic_id").references(() => aG.wW.id, { onDelete: "cascade" }), budgetId: (0, I.uR)("budget_id").references(() => a5.id, { onDelete: "set null" }), amount: (0, E.sH)("amount", { precision: 12, scale: 2 }).notNull(), paymentMethod: (0, aI.Qq)("payment_method").notNull(), paidAt: (0, G.vE)("paid_at", { withTimezone: true }).defaultNow(), notes: (0, aI.Qq)("notes"), createdBy: (0, I.uR)("created_by").references(() => aG.VV.id, { onDelete: "set null" }), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), a9 = (0, J.cJ)("treatment_plans", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").notNull().references(() => aG.PA.id, { onDelete: "cascade" }), title: (0, aI.Qq)("title").notNull(), description: (0, aI.Qq)("description"), totalSessions: (0, aH.nd)("total_sessions").default(1), completedSessions: (0, aH.nd)("completed_sessions").default(0), status: (0, aI.Qq)("status").default("in_progress"), startedAt: (0, G.vE)("started_at", { withTimezone: true }), expectedCompletionAt: (0, G.vE)("expected_completion_at", { withTimezone: true }), completedAt: (0, G.vE)("completed_at", { withTimezone: true }), lastSessionAt: (0, G.vE)("last_session_at", { withTimezone: true }), nextSessionDueAt: (0, G.vE)("next_session_due_at", { withTimezone: true }), notes: (0, aI.Qq)("notes"), createdBy: (0, I.uR)("created_by").references(() => aG.VV.id), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), ba = (0, J.cJ)("treatment_plan_items", { id: (0, I.uR)("id").primaryKey().defaultRandom(), treatmentPlanId: (0, I.uR)("treatment_plan_id").notNull().references(() => a9.id, { onDelete: "cascade" }), procedureId: (0, I.uR)("procedure_id").references(() => aG.lF.id, { onDelete: "set null" }), procedureName: (0, aI.Qq)("procedure_name").notNull(), sessionNumber: (0, aH.nd)("session_number").notNull(), appointmentId: (0, I.uR)("appointment_id").references(() => aK.id, { onDelete: "set null" }), status: (0, aI.Qq)("status").default("pending"), scheduledAt: (0, G.vE)("scheduled_at", { withTimezone: true }), completedAt: (0, G.vE)("completed_at", { withTimezone: true }), notes: (0, aI.Qq)("notes"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }, (a10) => ({ planSessionUniq: { name: "treatment_plan_items_plan_session_uniq", columns: [a10.treatmentPlanId, a10.sessionNumber], type: "unique" } })), bb = (0, J.cJ)("pending_actions", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), conversationId: (0, I.uR)("conversation_id").references(() => aR.id, { onDelete: "set null" }), patientId: (0, I.uR)("patient_id").references(() => aG.PA.id, { onDelete: "set null" }), appointmentId: (0, I.uR)("appointment_id").references(() => aK.id, { onDelete: "set null" }), actionType: (0, aI.Qq)("action_type").notNull(), riskScore: (0, aH.nd)("risk_score").default(0).notNull(), riskLevel: (0, aI.Qq)("risk_level").default("LOW").notNull(), status: (0, aI.Qq)("status").default("pending").notNull(), snapshotBefore: (0, C.Fx)("snapshot_before").default("{}"), snapshotAfter: (0, C.Fx)("snapshot_after").default("{}"), undoPayload: (0, C.Fx)("undo_payload").default("{}"), confirmationCount: (0, aH.nd)("confirmation_count").default(0), maxConfirmations: (0, aH.nd)("max_confirmations").default(1), confirmedAt: (0, G.vE)("confirmed_at", { withTimezone: true }), undoDeadline: (0, G.vE)("undo_deadline", { withTimezone: true }).notNull(), undoneAt: (0, G.vE)("undone_at", { withTimezone: true }), reasoning: (0, aI.Qq)("reasoning"), agentIntent: (0, aI.Qq)("agent_intent"), confidence: (0, E._)("confidence", { precision: 3, scale: 2 }), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), bc = (0, J.cJ)("decision_logs", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), conversationId: (0, I.uR)("conversation_id").references(() => aR.id, { onDelete: "set null" }), patientId: (0, I.uR)("patient_id").references(() => aG.PA.id, { onDelete: "set null" }), intentClassified: (0, aI.Qq)("intent_classified").notNull(), confidenceScore: (0, E._)("confidence_score", { precision: 3, scale: 2 }).notNull(), actionTaken: (0, aI.Qq)("action_taken").notNull(), riskLevel: (0, aI.Qq)("risk_level").default("LOW"), reasoning: (0, aI.Qq)("reasoning").notNull(), escalationTriggered: (0, aJ.zM)("escalation_triggered").default(false), humanOverride: (0, aJ.zM)("human_override").default(false), messageSummary: (0, aI.Qq)("message_summary"), entitiesExtracted: (0, C.Fx)("entities_extracted").default("{}"), ragSources: (0, C.Fx)("rag_sources").default("[]"), responseTimeMs: (0, aH.nd)("response_time_ms"), tokensUsed: (0, aH.nd)("tokens_used"), llmModel: (0, aI.Qq)("llm_model"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }), bd = (0, J.cJ)("smart_trigger_log", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), patientId: (0, I.uR)("patient_id").notNull().references(() => aG.PA.id, { onDelete: "cascade" }), appointmentId: (0, I.uR)("appointment_id").references(() => aK.id, { onDelete: "set null" }), triggerType: (0, aI.Qq)("trigger_type").notNull(), priority: (0, aH.nd)("priority").default(5), messageSent: (0, aI.Qq)("message_sent"), channel: (0, aI.Qq)("channel").default("whatsapp"), status: (0, aI.Qq)("status").default("sent"), patientResponded: (0, aJ.zM)("patient_responded").default(false), responseAt: (0, G.vE)("response_at", { withTimezone: true }), patientResponse: (0, aI.Qq)("patient_response"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }), be = (0, J.cJ)("agent_queue", { id: (0, I.uR)("id").primaryKey().defaultRandom(), fromAgent: (0, aI.Qq)("from_agent").notNull(), toAgent: (0, aI.Qq)("to_agent").notNull(), payload: (0, C.Fx)("payload").notNull(), status: (0, aI.Qq)("status").default("pending"), retryCount: (0, aH.nd)("retry_count").default(0), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), processAfter: (0, G.vE)("process_after", { withTimezone: true }).defaultNow(), completedAt: (0, G.vE)("completed_at", { withTimezone: true }), error: (0, aI.Qq)("error") }), bf = (0, J.cJ)("agent_dlq", { id: (0, I.uR)("id").primaryKey().defaultRandom(), originalQueueId: (0, I.uR)("original_queue_id"), fromAgent: (0, aI.Qq)("from_agent"), toAgent: (0, aI.Qq)("to_agent"), payload: (0, C.Fx)("payload"), error: (0, aI.Qq)("error"), retryCount: (0, aH.nd)("retry_count"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), manualActionRequired: (0, aJ.zM)("manual_action_required").default(true) }), bg = (0, J.cJ)("agent_logs", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull(), conversationId: (0, I.uR)("conversation_id"), intent: (0, aI.Qq)("intent"), confidence: (0, E._)("confidence", { precision: 3, scale: 2 }), responseTimeMs: (0, aH.nd)("response_time_ms"), actionTaken: (0, aI.Qq)("action_taken"), escalation: (0, aJ.zM)("escalation").default(false), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() }), bh = (0, J.cJ)("knowledge_base", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), category: (0, aI.Qq)("category").notNull(), question: (0, aI.Qq)("question").notNull(), answer: (0, aI.Qq)("answer").notNull(), keywords: (0, aI.Qq)("keywords").array().default([]), embedding: (0, aQ.i1)("embedding", { dimensions: 1536 }), isActive: (0, aJ.zM)("is_active").default(true), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), bi = (0, J.cJ)("whatsapp_instances", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), phoneNumberId: (0, aW.yf)("phone_number_id", { length: 100 }).notNull(), businessAccountId: (0, aI.Qq)("business_account_id"), displayName: (0, aI.Qq)("display_name"), qualityRating: (0, aI.Qq)("quality_rating"), status: (0, aI.Qq)("status").default("pending"), lastConnectedAt: (0, G.vE)("last_connected_at", { withTimezone: true }), evolutionInstanceName: (0, aI.Qq)("evolution_instance_name"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), bj = (0, J.cJ)("message_templates", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), name: (0, aI.Qq)("name").notNull(), category: (0, aI.Qq)("category").notNull(), language: (0, aI.Qq)("language").default("pt_BR"), header: (0, aI.Qq)("header"), body: (0, aI.Qq)("body").notNull(), footer: (0, aI.Qq)("footer"), buttons: (0, C.Fx)("buttons").default("[]"), variables: (0, C.Fx)("variables").default("[]"), metaTemplateId: (0, aI.Qq)("meta_template_id"), status: (0, aI.Qq)("status").default("pending"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }), bk = (0, J.cJ)("consents", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), contactId: (0, I.uR)("contact_id").notNull(), contactType: (0, aW.yf)("contact_type", { length: 10 }).notNull(), purpose: (0, aW.yf)("purpose", { length: 50 }).notNull(), granted: (0, aJ.zM)("granted").default(true).notNull(), grantedAt: (0, G.vE)("granted_at", { withTimezone: true }).defaultNow(), revokedAt: (0, G.vE)("revoked_at", { withTimezone: true }), channel: (0, aW.yf)("channel", { length: 20 }).default("web"), notes: (0, aI.Qq)("notes"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }, (a10) => ({ contactPurposeUniq: { name: "consents_contact_purpose_uniq", columns: [a10.contactId, a10.contactType, a10.purpose], type: "unique" } })), bl = (0, J.cJ)("custom_field_definitions", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), name: (0, aI.Qq)("name").notNull(), fieldType: (0, aW.yf)("field_type", { length: 20 }).notNull(), options: (0, C.Fx)("options").default("[]"), required: (0, aJ.zM)("required").default(false), sortOrder: (0, aH.nd)("sort_order").default(0), isActive: (0, aJ.zM)("is_active").default(true), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }, (a10) => ({ clinicDefNameUniq: { name: "customfields_clinic_name_uniq", columns: [a10.clinicId, a10.name], type: "unique" } })), bm = (0, J.cJ)("custom_field_values", { id: (0, I.uR)("id").primaryKey().defaultRandom(), definitionId: (0, I.uR)("definition_id").notNull().references(() => bl.id, { onDelete: "cascade" }), contactId: (0, I.uR)("contact_id").notNull(), contactType: (0, aW.yf)("contact_type", { length: 10 }).notNull(), clinicId: (0, I.uR)("clinic_id").notNull().references(() => aG.wW.id, { onDelete: "cascade" }), valueText: (0, aI.Qq)("value_text"), valueNumber: (0, aH.nd)("value_number"), valueDate: (0, G.vE)("value_date", { withTimezone: true }), valueBoolean: (0, aJ.zM)("value_boolean"), valueJson: (0, C.Fx)("value_json"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, G.vE)("updated_at", { withTimezone: true }).defaultNow() }, (a10) => ({ defContactUniq: { name: "customfields_def_contact_uniq", columns: [a10.definitionId, a10.contactId, a10.contactType], type: "unique" } })), bn = (0, J.cJ)("audit_logs", { id: (0, I.uR)("id").primaryKey().defaultRandom(), clinicId: (0, I.uR)("clinic_id").references(() => aG.wW.id, { onDelete: "set null" }), userId: (0, I.uR)("user_id").references(() => aG.VV.id, { onDelete: "set null" }), action: (0, aI.Qq)("action").notNull(), entityType: (0, aI.Qq)("entity_type").notNull(), entityId: (0, I.uR)("entity_id"), oldValues: (0, C.Fx)("old_values"), newValues: (0, C.Fx)("new_values"), ipAddress: (0, aI.Qq)("ip_address"), userAgent: (0, aI.Qq)("user_agent"), createdAt: (0, G.vE)("created_at", { withTimezone: true }).defaultNow() });
      var bo = c(2693), bp = c(4688), bq = c(9219);
      let br = null, bs = null, bt = null;
      function bu() {
        let a10 = function() {
          let a11 = process.env.DATABASE_URL;
          if (a11) return a11;
          throw Error("[DB] No database connection available.\n  In production (Workers): call setDbConnectionString(env.HYPERDRIVE.connectionString) at bootstrap.\n  In dev/local: set DATABASE_URL in .env.local or .env.\n  Example: DATABASE_URL=postgres://synkroo:synkroo_dev@localhost:5432/synkroo");
        }();
        return bs && a10 !== bt && (bs = null, br = null, bt = null), bs || (br = new e.Pool({ connectionString: a10 }), bs = aE(br, { schema: d }), bt = a10), bs;
      }
    }, 969: (a, b, c) => {
      "use strict";
      c.d(b, { bootstrapActions: () => f });
      var d = c(7916);
      let e = false;
      async function f() {
        if (e) return;
        let [{ registerAccessPermissions: a2 }, { coreActions: b2, coreAccessPermissions: f2 }] = await Promise.all([Promise.resolve().then(c.bind(c, 6481)), Promise.resolve().then(c.bind(c, 2970))]);
        (0, d.n_)(b2.filter((a3) => !(0, d.Th)(a3.name))), a2(f2), e = true;
      }
    }, 1308: (a, b, c) => {
      "use strict";
      c.d(b, { Z5: () => h, _: () => n, sH: () => m });
      var d = c(242), e = c(3090), f = c(4080);
      class g extends f.pe {
        static [d.i] = "PgNumericBuilder";
        constructor(a2, b2, c2) {
          super(a2, "string", "PgNumeric"), this.config.precision = b2, this.config.scale = c2;
        }
        build(a2) {
          return new h(a2, this.config);
        }
      }
      class h extends f.Kl {
        static [d.i] = "PgNumeric";
        precision;
        scale;
        constructor(a2, b2) {
          super(a2, b2), this.precision = b2.precision, this.scale = b2.scale;
        }
        mapFromDriverValue(a2) {
          return "string" == typeof a2 ? a2 : String(a2);
        }
        getSQLType() {
          return void 0 !== this.precision && void 0 !== this.scale ? `numeric(${this.precision}, ${this.scale})` : void 0 === this.precision ? "numeric" : `numeric(${this.precision})`;
        }
      }
      class i extends f.pe {
        static [d.i] = "PgNumericNumberBuilder";
        constructor(a2, b2, c2) {
          super(a2, "number", "PgNumericNumber"), this.config.precision = b2, this.config.scale = c2;
        }
        build(a2) {
          return new j(a2, this.config);
        }
      }
      class j extends f.Kl {
        static [d.i] = "PgNumericNumber";
        precision;
        scale;
        constructor(a2, b2) {
          super(a2, b2), this.precision = b2.precision, this.scale = b2.scale;
        }
        mapFromDriverValue(a2) {
          return "number" == typeof a2 ? a2 : Number(a2);
        }
        mapToDriverValue = String;
        getSQLType() {
          return void 0 !== this.precision && void 0 !== this.scale ? `numeric(${this.precision}, ${this.scale})` : void 0 === this.precision ? "numeric" : `numeric(${this.precision})`;
        }
      }
      class k extends f.pe {
        static [d.i] = "PgNumericBigIntBuilder";
        constructor(a2, b2, c2) {
          super(a2, "bigint", "PgNumericBigInt"), this.config.precision = b2, this.config.scale = c2;
        }
        build(a2) {
          return new l(a2, this.config);
        }
      }
      class l extends f.Kl {
        static [d.i] = "PgNumericBigInt";
        precision;
        scale;
        constructor(a2, b2) {
          super(a2, b2), this.precision = b2.precision, this.scale = b2.scale;
        }
        mapFromDriverValue = BigInt;
        mapToDriverValue = String;
        getSQLType() {
          return void 0 !== this.precision && void 0 !== this.scale ? `numeric(${this.precision}, ${this.scale})` : void 0 === this.precision ? "numeric" : `numeric(${this.precision})`;
        }
      }
      function m(a2, b2) {
        let { name: c2, config: d2 } = (0, e.Ll)(a2, b2), f2 = d2?.mode;
        return "number" === f2 ? new i(c2, d2?.precision, d2?.scale) : "bigint" === f2 ? new k(c2, d2?.precision, d2?.scale) : new g(c2, d2?.precision, d2?.scale);
      }
      let n = m;
    }, 1457: (a, b, c) => {
      "use strict";
      c.d(b, { Fx: () => h, kn: () => g });
      var d = c(242), e = c(4080);
      class f extends e.pe {
        static [d.i] = "PgJsonbBuilder";
        constructor(a2) {
          super(a2, "json", "PgJsonb");
        }
        build(a2) {
          return new g(a2, this.config);
        }
      }
      class g extends e.Kl {
        static [d.i] = "PgJsonb";
        constructor(a2, b2) {
          super(a2, b2);
        }
        getSQLType() {
          return "jsonb";
        }
        mapToDriverValue(a2) {
          return JSON.stringify(a2);
        }
        mapFromDriverValue(a2) {
          if ("string" == typeof a2) try {
            return JSON.parse(a2);
          } catch {
          }
          return a2;
        }
      }
      function h(a2) {
        return new f(a2 ?? "");
      }
    }, 1582: (a, b, c) => {
      "use strict";
      c.d(b, { AU: () => m, B3: () => B, KJ: () => w, KL: () => s, Pe: () => u, RK: () => A, RO: () => o, RV: () => r, Tq: () => x, Uo: () => k, eq: () => i, gt: () => n, kZ: () => t, lt: () => p, mj: () => z, ne: () => j, o8: () => y, or: () => l, q1: () => C, t2: () => v, wJ: () => q });
      var d = c(9393), e = c(242), f = c(2701), g = c(4096);
      function h(a2, b2) {
        return !(0, g.eG)(b2) || (0, g.qt)(a2) || (0, e.is)(a2, g.Iw) || (0, e.is)(a2, g.Or) || (0, e.is)(a2, d.V) || (0, e.is)(a2, f.XI) || (0, e.is)(a2, g.Ss) ? a2 : new g.Iw(a2, b2);
      }
      let i = (a2, b2) => (0, g.ll)`${a2} = ${h(b2, a2)}`, j = (a2, b2) => (0, g.ll)`${a2} <> ${h(b2, a2)}`;
      function k(...a2) {
        let b2 = a2.filter((a3) => void 0 !== a3);
        if (0 !== b2.length) return new g.Xs(1 === b2.length ? b2 : [new g.DJ("("), g.ll.join(b2, new g.DJ(" and ")), new g.DJ(")")]);
      }
      function l(...a2) {
        let b2 = a2.filter((a3) => void 0 !== a3);
        if (0 !== b2.length) return new g.Xs(1 === b2.length ? b2 : [new g.DJ("("), g.ll.join(b2, new g.DJ(" or ")), new g.DJ(")")]);
      }
      function m(a2) {
        return (0, g.ll)`not ${a2}`;
      }
      let n = (a2, b2) => (0, g.ll)`${a2} > ${h(b2, a2)}`, o = (a2, b2) => (0, g.ll)`${a2} >= ${h(b2, a2)}`, p = (a2, b2) => (0, g.ll)`${a2} < ${h(b2, a2)}`, q = (a2, b2) => (0, g.ll)`${a2} <= ${h(b2, a2)}`;
      function r(a2, b2) {
        return Array.isArray(b2) ? 0 === b2.length ? (0, g.ll)`false` : (0, g.ll)`${a2} in ${b2.map((b3) => h(b3, a2))}` : (0, g.ll)`${a2} in ${h(b2, a2)}`;
      }
      function s(a2, b2) {
        return Array.isArray(b2) ? 0 === b2.length ? (0, g.ll)`true` : (0, g.ll)`${a2} not in ${b2.map((b3) => h(b3, a2))}` : (0, g.ll)`${a2} not in ${h(b2, a2)}`;
      }
      function t(a2) {
        return (0, g.ll)`${a2} is null`;
      }
      function u(a2) {
        return (0, g.ll)`${a2} is not null`;
      }
      function v(a2) {
        return (0, g.ll)`exists ${a2}`;
      }
      function w(a2) {
        return (0, g.ll)`not exists ${a2}`;
      }
      function x(a2, b2, c2) {
        return (0, g.ll)`${a2} between ${h(b2, a2)} and ${h(c2, a2)}`;
      }
      function y(a2, b2, c2) {
        return (0, g.ll)`${a2} not between ${h(b2, a2)} and ${h(c2, a2)}`;
      }
      function z(a2, b2) {
        return (0, g.ll)`${a2} like ${b2}`;
      }
      function A(a2, b2) {
        return (0, g.ll)`${a2} not like ${b2}`;
      }
      function B(a2, b2) {
        return (0, g.ll)`${a2} ilike ${b2}`;
      }
      function C(a2, b2) {
        return (0, g.ll)`${a2} not ilike ${b2}`;
      }
    }, 1591: (a, b, c) => {
      "use strict";
      function d(a2, ...b2) {
        return a2(...b2);
      }
      c.d(b, { i: () => d });
    }, 1664: (a, b, c) => {
      "use strict";
      let d, e;
      c.d(b, { k: () => g });
      var f = c(1591);
      let g = { startActiveSpan: (a2, b2) => d ? (e || (e = d.trace.getTracer("drizzle-orm", "0.45.2")), (0, f.i)((c2, d2) => d2.startActiveSpan(a2, (a3) => {
        try {
          return b2(a3);
        } catch (b3) {
          throw a3.setStatus({ code: c2.SpanStatusCode.ERROR, message: b3 instanceof Error ? b3.message : "Unknown error" }), b3;
        } finally {
          a3.end();
        }
      }), d, e)) : b2() };
    }, 1800: (a, b, c) => {
      "use strict";
      c.d(b, { u: () => g });
      var d = c(242), e = c(4096), f = c(4080);
      class g extends f.pe {
        static [d.i] = "PgDateColumnBaseBuilder";
        defaultNow() {
          return this.default((0, e.ll)`now()`);
        }
      }
    }, 1912: (a, b, c) => {
      "use strict";
      c.d(b, { Xd: () => i, kB: () => j });
      var d = c(242), e = c(3090), f = c(4080), g = c(1800);
      class h extends g.u {
        constructor(a2, b2, c2) {
          super(a2, "string", "PgTime"), this.withTimezone = b2, this.precision = c2, this.config.withTimezone = b2, this.config.precision = c2;
        }
        static [d.i] = "PgTimeBuilder";
        build(a2) {
          return new i(a2, this.config);
        }
      }
      class i extends f.Kl {
        static [d.i] = "PgTime";
        withTimezone;
        precision;
        constructor(a2, b2) {
          super(a2, b2), this.withTimezone = b2.withTimezone, this.precision = b2.precision;
        }
        getSQLType() {
          let a2 = void 0 === this.precision ? "" : `(${this.precision})`;
          return `time${a2}${this.withTimezone ? " with time zone" : ""}`;
        }
      }
      function j(a2, b2 = {}) {
        let { name: c2, config: d2 } = (0, e.Ll)(a2, b2);
        return new h(c2, d2.withTimezone ?? false, d2.precision);
      }
    }, 2187: (a, b, c) => {
      "use strict";
      async function d() {
        try {
          let { bootstrapActions: a2 } = await Promise.resolve().then(c.bind(c, 969));
          await a2();
        } catch (a2) {
          console.warn("[synkroo:boot] bootstrapActions skipped:", a2 instanceof Error ? a2.message : String(a2));
        }
        console.warn("[synkroo:boot] Workers runtime (EdgeRuntime)");
      }
      c.r(b), c.d(b, { register: () => d });
    }, 2338: (a, b, c) => {
      "use strict";
      c.d(b, { H1: () => h, IR: () => i, K0: () => j, KZ: () => e, qu: () => g, w9: () => f });
      var d = c(3688);
      let e = (0, d.rL)("user_role", ["owner", "admin", "dentist", "receptionist"]), f = (0, d.rL)("channel_type", ["whatsapp", "instagram", "web", "telegram"]), g = (0, d.rL)("conversation_status", ["active", "waiting", "closed", "escalated"]), h = (0, d.rL)("message_direction", ["inbound", "outbound"]), i = (0, d.rL)("message_type", ["text", "image", "audio", "document", "video"]), j = (0, d.rL)("appointment_status", ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]);
    }, 2693: (a, b, c) => {
      "use strict";
      c.d(b, { i: () => j });
      var d = c(6123), e = c(7238), f = c(3946), g = c(1457), h = c(7097), i = c(2933);
      let j = (0, d.cJ)("action_logs", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").references(() => i.wW.id, { onDelete: "set null" }), principalType: (0, f.Qq)("principal_type"), actor: (0, f.Qq)("actor").notNull(), onBehalfOf: (0, e.uR)("on_behalf_of"), actionName: (0, f.Qq)("action_name").notNull(), module: (0, f.Qq)("module").notNull(), inputRedacted: (0, g.Fx)("input_redacted").default("{}"), result: (0, f.Qq)("result").notNull(), errorCode: (0, f.Qq)("error_code"), createdAt: (0, h.vE)("created_at", { withTimezone: true }).defaultNow().notNull() });
    }, 2701: (a, b, c) => {
      "use strict";
      c.d(b, { HE: () => k, Io: () => o, Lf: () => p, Sj: () => f, XI: () => n, e: () => g });
      var d = c(242), e = c(8056);
      let f = Symbol.for("drizzle:Schema"), g = Symbol.for("drizzle:Columns"), h = Symbol.for("drizzle:ExtraConfigColumns"), i = Symbol.for("drizzle:OriginalName"), j = Symbol.for("drizzle:BaseName"), k = Symbol.for("drizzle:IsAlias"), l = Symbol.for("drizzle:ExtraConfigBuilder"), m = Symbol.for("drizzle:IsDrizzleTable");
      class n {
        static [d.i] = "Table";
        static Symbol = { Name: e.E, Schema: f, OriginalName: i, Columns: g, ExtraConfigColumns: h, BaseName: j, IsAlias: k, ExtraConfigBuilder: l };
        [e.E];
        [i];
        [f];
        [g];
        [h];
        [j];
        [k] = false;
        [m] = true;
        [l] = void 0;
        constructor(a2, b2, c2) {
          this[e.E] = this[i] = a2, this[f] = b2, this[j] = c2;
        }
      }
      function o(a2) {
        return a2[e.E];
      }
      function p(a2) {
        return `${a2[f] ?? "public"}.${a2[e.E]}`;
      }
    }, 2926: (a, b, c) => {
      "use strict";
      c.d(b, { n: () => d });
      let d = Symbol.for("drizzle:ViewBaseConfig");
    }, 2933: (a, b, c) => {
      "use strict";
      c.d(b, { B_: () => y, CO: () => r, EC: () => x, PA: () => u, Pq: () => A, VV: () => q, ZM: () => z, k7: () => w, lF: () => t, lu: () => v, mY: () => B, wW: () => p, zz: () => s });
      var d = c(6123), e = c(7238), f = c(3946), g = c(7514), h = c(1457), i = c(7097), j = c(3193), k = c(4051), l = c(1308), m = c(6903), n = c(6778), o = c(2338);
      let p = (0, d.cJ)("clinics", { id: (0, e.uR)("id").primaryKey().defaultRandom(), name: (0, f.Qq)("name").notNull(), slug: (0, f.Qq)("slug").unique().notNull(), phone: (0, g.yf)("phone", { length: 20 }).notNull(), email: (0, f.Qq)("email").notNull(), website: (0, f.Qq)("website"), address: (0, h.Fx)("address").default("{}"), settings: (0, h.Fx)("settings").default("{}"), subscriptionPlan: (0, f.Qq)("subscription_plan").default("starter"), subscriptionStatus: (0, f.Qq)("subscription_status").default("active"), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow(), deletedAt: (0, i.vE)("deleted_at", { withTimezone: true }) }), q = (0, d.cJ)("users", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").notNull().references(() => p.id, { onDelete: "cascade" }), email: (0, f.Qq)("email").notNull(), name: (0, f.Qq)("name").notNull(), role: (0, o.KZ)("role").notNull().default("receptionist"), phone: (0, g.yf)("phone", { length: 20 }), avatarUrl: (0, f.Qq)("avatar_url"), isActive: (0, j.zM)("is_active").default(true).notNull(), isMaster: (0, j.zM)("is_master").default(false).notNull(), lastLoginAt: (0, i.vE)("last_login_at", { withTimezone: true }), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow(), deletedAt: (0, i.vE)("deleted_at", { withTimezone: true }) }, (a2) => ({ clinicEmailUniq: { name: "users_clinic_email_uniq", columns: [a2.clinicId, a2.email], type: "unique" } })), r = (0, d.cJ)("user_credentials", { userId: (0, e.uR)("user_id").primaryKey().references(() => q.id, { onDelete: "cascade" }), passwordHash: (0, f.Qq)("password_hash").notNull(), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow().notNull() }), s = (0, d.cJ)("dentists", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").notNull().references(() => p.id, { onDelete: "cascade" }), name: (0, f.Qq)("name").notNull(), phone: (0, g.yf)("phone", { length: 20 }), email: (0, f.Qq)("email"), cro: (0, f.Qq)("cro"), specialty: (0, f.Qq)("specialty"), croNumber: (0, f.Qq)("cro_number"), avatarUrl: (0, f.Qq)("avatar_url"), isActive: (0, j.zM)("is_active").default(true), workingHours: (0, h.Fx)("working_hours").default("{}"), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow(), deletedAt: (0, i.vE)("deleted_at", { withTimezone: true }) }), t = (0, d.cJ)("procedures", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").notNull().references(() => p.id, { onDelete: "cascade" }), name: (0, f.Qq)("name").notNull(), description: (0, f.Qq)("description"), durationMinutes: (0, k.nd)("duration_minutes").default(30), price: (0, l._)("price", { precision: 10, scale: 2 }), category: (0, f.Qq)("category"), isActive: (0, j.zM)("is_active").default(true), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow(), deletedAt: (0, i.vE)("deleted_at", { withTimezone: true }) }), u = (0, d.cJ)("patients", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").notNull().references(() => p.id, { onDelete: "cascade" }), name: (0, f.Qq)("name").notNull(), phone: (0, g.yf)("phone", { length: 20 }).notNull(), email: (0, f.Qq)("email"), cpf: (0, g.yf)("cpf", { length: 14 }), birthDate: (0, m.p6)("birth_date"), gender: (0, f.Qq)("gender"), address: (0, h.Fx)("address").default("{}"), notes: (0, f.Qq)("notes"), status: (0, f.Qq)("status").default("active"), tags: (0, f.Qq)("tags").array().default([]), riskScore: (0, l._)("risk_score", { precision: 3, scale: 2 }).default("0.00"), lastVisitAt: (0, i.vE)("last_visit_at", { withTimezone: true }), optOutMarketing: (0, j.zM)("opt_out_marketing").default(false), optOutReminders: (0, j.zM)("opt_out_reminders").default(false), optOutAt: (0, i.vE)("opt_out_at", { withTimezone: true }), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow(), deletedAt: (0, i.vE)("deleted_at", { withTimezone: true }) }, (a2) => ({ clinicPhoneUniq: { name: "patients_clinic_phone_uniq", columns: [a2.clinicId, a2.phone], type: "unique" } })), v = (0, d.cJ)("patient_observations", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").notNull().references(() => p.id, { onDelete: "cascade" }), patientId: (0, e.uR)("patient_id").notNull().references(() => u.id, { onDelete: "cascade" }), content: (0, f.Qq)("content").notNull(), createdBy: (0, e.uR)("created_by").references(() => q.id, { onDelete: "set null" }), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow() }), w = (0, d.cJ)("patient_preferences", { id: (0, e.uR)("id").primaryKey().defaultRandom(), patientId: (0, e.uR)("patient_id").notNull().references(() => u.id, { onDelete: "cascade" }), clinicId: (0, e.uR)("clinic_id").notNull().references(() => p.id, { onDelete: "cascade" }), key: (0, f.Qq)("key").notNull(), value: (0, f.Qq)("value").notNull(), category: (0, f.Qq)("category").notNull(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow() }, (a2) => ({ patientKeyUniq: { name: "patient_preferences_patient_key_uniq", columns: [a2.patientId, a2.key], type: "unique" } })), x = (0, d.cJ)("patient_risk_scores", { id: (0, e.uR)("id").primaryKey().defaultRandom(), patientId: (0, e.uR)("patient_id").notNull().references(() => u.id, { onDelete: "cascade" }), score: (0, l._)("score", { precision: 3, scale: 2 }).notNull(), factors: (0, h.Fx)("factors").default("{}"), calculatedAt: (0, i.vE)("calculated_at", { withTimezone: true }).defaultNow() }), y = (0, d.cJ)("patient_feedback", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").notNull().references(() => p.id, { onDelete: "cascade" }), patientId: (0, e.uR)("patient_id").notNull().references(() => u.id, { onDelete: "cascade" }), appointmentId: (0, e.uR)("appointment_id"), feedbackType: (0, f.Qq)("feedback_type").default("post_consultation"), rating: (0, k.nd)("rating"), npsScore: (0, k.nd)("nps_score"), wouldRecommend: (0, j.zM)("would_recommend"), comments: (0, f.Qq)("comments"), improvements: (0, f.Qq)("improvements").array().default([]), collectedAt: (0, i.vE)("collected_at", { withTimezone: true }).defaultNow(), channel: (0, f.Qq)("channel").default("whatsapp"), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow() }), z = (0, d.cJ)("procedure_guidelines", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").notNull().references(() => p.id, { onDelete: "cascade" }), procedureId: (0, e.uR)("procedure_id").references(() => t.id, { onDelete: "set null" }), procedureName: (0, f.Qq)("procedure_name").notNull(), title: (0, f.Qq)("title").notNull(), instructions: (0, f.Qq)("instructions").notNull(), emergencyContact: (0, j.zM)("emergency_contact").default(false), recoveryTimeDays: (0, k.nd)("recovery_time_days"), restrictions: (0, f.Qq)("restrictions").array().default([]), warningSigns: (0, f.Qq)("warning_signs").array().default([]), isActive: (0, j.zM)("is_active").default(true), createdAt: (0, i.vE)("created_at", { withTimezone: true }).defaultNow(), updatedAt: (0, i.vE)("updated_at", { withTimezone: true }).defaultNow() }, (a2) => ({ clinicProcedureUniq: { name: "guidelines_clinic_procedure_uniq", columns: [a2.clinicId, a2.procedureName], type: "unique" } })), A = (0, n.K1)(p, ({ many: a2 }) => ({ users: a2(q), patients: a2(u), dentists: a2(s), procedures: a2(t) })), B = (0, n.K1)(q, ({ one: a2 }) => ({ clinic: a2(p, { fields: [q.clinicId], references: [p.id] }), credentials: a2(r, { fields: [q.id], references: [r.userId] }) }));
    }, 2970: (a, b, c) => {
      "use strict";
      let d;
      c.r(b), c.d(b, { coreAccessPermissions: () => aL, coreActions: () => aM, coreManifest: () => aK }), function(a2) {
        a2.assertEqual = (a3) => {
        }, a2.assertIs = function(a3) {
        }, a2.assertNever = function(a3) {
          throw Error();
        }, a2.arrayToEnum = (a3) => {
          let b2 = {};
          for (let c2 of a3) b2[c2] = c2;
          return b2;
        }, a2.getValidEnumValues = (b2) => {
          let c2 = a2.objectKeys(b2).filter((a3) => "number" != typeof b2[b2[a3]]), d2 = {};
          for (let a3 of c2) d2[a3] = b2[a3];
          return a2.objectValues(d2);
        }, a2.objectValues = (b2) => a2.objectKeys(b2).map(function(a3) {
          return b2[a3];
        }), a2.objectKeys = "function" == typeof Object.keys ? (a3) => Object.keys(a3) : (a3) => {
          let b2 = [];
          for (let c2 in a3) Object.prototype.hasOwnProperty.call(a3, c2) && b2.push(c2);
          return b2;
        }, a2.find = (a3, b2) => {
          for (let c2 of a3) if (b2(c2)) return c2;
        }, a2.isInteger = "function" == typeof Number.isInteger ? (a3) => Number.isInteger(a3) : (a3) => "number" == typeof a3 && Number.isFinite(a3) && Math.floor(a3) === a3, a2.joinValues = function(a3, b2 = " | ") {
          return a3.map((a4) => "string" == typeof a4 ? `'${a4}'` : a4).join(b2);
        }, a2.jsonStringifyReplacer = (a3, b2) => "bigint" == typeof b2 ? b2.toString() : b2;
      }(az || (az = {})), (aA || (aA = {})).mergeShapes = (a2, b2) => ({ ...a2, ...b2 });
      let e = az.arrayToEnum(["string", "nan", "number", "integer", "float", "boolean", "date", "bigint", "symbol", "function", "undefined", "null", "array", "object", "unknown", "promise", "void", "never", "map", "set"]), f = (a2) => {
        switch (typeof a2) {
          case "undefined":
            return e.undefined;
          case "string":
            return e.string;
          case "number":
            return Number.isNaN(a2) ? e.nan : e.number;
          case "boolean":
            return e.boolean;
          case "function":
            return e.function;
          case "bigint":
            return e.bigint;
          case "symbol":
            return e.symbol;
          case "object":
            if (Array.isArray(a2)) return e.array;
            if (null === a2) return e.null;
            if (a2.then && "function" == typeof a2.then && a2.catch && "function" == typeof a2.catch) return e.promise;
            if ("undefined" != typeof Map && a2 instanceof Map) return e.map;
            if ("undefined" != typeof Set && a2 instanceof Set) return e.set;
            if ("undefined" != typeof Date && a2 instanceof Date) return e.date;
            return e.object;
          default:
            return e.unknown;
        }
      }, g = az.arrayToEnum(["invalid_type", "invalid_literal", "custom", "invalid_union", "invalid_union_discriminator", "invalid_enum_value", "unrecognized_keys", "invalid_arguments", "invalid_return_type", "invalid_date", "invalid_string", "too_small", "too_big", "invalid_intersection_types", "not_multiple_of", "not_finite"]);
      class h extends Error {
        get errors() {
          return this.issues;
        }
        constructor(a2) {
          super(), this.issues = [], this.addIssue = (a3) => {
            this.issues = [...this.issues, a3];
          }, this.addIssues = (a3 = []) => {
            this.issues = [...this.issues, ...a3];
          };
          let b2 = new.target.prototype;
          Object.setPrototypeOf ? Object.setPrototypeOf(this, b2) : this.__proto__ = b2, this.name = "ZodError", this.issues = a2;
        }
        format(a2) {
          let b2 = a2 || function(a3) {
            return a3.message;
          }, c2 = { _errors: [] }, d2 = (a3) => {
            for (let e2 of a3.issues) if ("invalid_union" === e2.code) e2.unionErrors.map(d2);
            else if ("invalid_return_type" === e2.code) d2(e2.returnTypeError);
            else if ("invalid_arguments" === e2.code) d2(e2.argumentsError);
            else if (0 === e2.path.length) c2._errors.push(b2(e2));
            else {
              let a4 = c2, d3 = 0;
              for (; d3 < e2.path.length; ) {
                let c3 = e2.path[d3];
                d3 === e2.path.length - 1 ? (a4[c3] = a4[c3] || { _errors: [] }, a4[c3]._errors.push(b2(e2))) : a4[c3] = a4[c3] || { _errors: [] }, a4 = a4[c3], d3++;
              }
            }
          };
          return d2(this), c2;
        }
        static assert(a2) {
          if (!(a2 instanceof h)) throw Error(`Not a ZodError: ${a2}`);
        }
        toString() {
          return this.message;
        }
        get message() {
          return JSON.stringify(this.issues, az.jsonStringifyReplacer, 2);
        }
        get isEmpty() {
          return 0 === this.issues.length;
        }
        flatten(a2 = (a3) => a3.message) {
          let b2 = {}, c2 = [];
          for (let d2 of this.issues) if (d2.path.length > 0) {
            let c3 = d2.path[0];
            b2[c3] = b2[c3] || [], b2[c3].push(a2(d2));
          } else c2.push(a2(d2));
          return { formErrors: c2, fieldErrors: b2 };
        }
        get formErrors() {
          return this.flatten();
        }
      }
      h.create = (a2) => new h(a2);
      let i = (a2, b2) => {
        let c2;
        switch (a2.code) {
          case g.invalid_type:
            c2 = a2.received === e.undefined ? "Required" : `Expected ${a2.expected}, received ${a2.received}`;
            break;
          case g.invalid_literal:
            c2 = `Invalid literal value, expected ${JSON.stringify(a2.expected, az.jsonStringifyReplacer)}`;
            break;
          case g.unrecognized_keys:
            c2 = `Unrecognized key(s) in object: ${az.joinValues(a2.keys, ", ")}`;
            break;
          case g.invalid_union:
            c2 = "Invalid input";
            break;
          case g.invalid_union_discriminator:
            c2 = `Invalid discriminator value. Expected ${az.joinValues(a2.options)}`;
            break;
          case g.invalid_enum_value:
            c2 = `Invalid enum value. Expected ${az.joinValues(a2.options)}, received '${a2.received}'`;
            break;
          case g.invalid_arguments:
            c2 = "Invalid function arguments";
            break;
          case g.invalid_return_type:
            c2 = "Invalid function return type";
            break;
          case g.invalid_date:
            c2 = "Invalid date";
            break;
          case g.invalid_string:
            "object" == typeof a2.validation ? "includes" in a2.validation ? (c2 = `Invalid input: must include "${a2.validation.includes}"`, "number" == typeof a2.validation.position && (c2 = `${c2} at one or more positions greater than or equal to ${a2.validation.position}`)) : "startsWith" in a2.validation ? c2 = `Invalid input: must start with "${a2.validation.startsWith}"` : "endsWith" in a2.validation ? c2 = `Invalid input: must end with "${a2.validation.endsWith}"` : az.assertNever(a2.validation) : c2 = "regex" !== a2.validation ? `Invalid ${a2.validation}` : "Invalid";
            break;
          case g.too_small:
            c2 = "array" === a2.type ? `Array must contain ${a2.exact ? "exactly" : a2.inclusive ? "at least" : "more than"} ${a2.minimum} element(s)` : "string" === a2.type ? `String must contain ${a2.exact ? "exactly" : a2.inclusive ? "at least" : "over"} ${a2.minimum} character(s)` : "number" === a2.type || "bigint" === a2.type ? `Number must be ${a2.exact ? "exactly equal to " : a2.inclusive ? "greater than or equal to " : "greater than "}${a2.minimum}` : "date" === a2.type ? `Date must be ${a2.exact ? "exactly equal to " : a2.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number(a2.minimum))}` : "Invalid input";
            break;
          case g.too_big:
            c2 = "array" === a2.type ? `Array must contain ${a2.exact ? "exactly" : a2.inclusive ? "at most" : "less than"} ${a2.maximum} element(s)` : "string" === a2.type ? `String must contain ${a2.exact ? "exactly" : a2.inclusive ? "at most" : "under"} ${a2.maximum} character(s)` : "number" === a2.type ? `Number must be ${a2.exact ? "exactly" : a2.inclusive ? "less than or equal to" : "less than"} ${a2.maximum}` : "bigint" === a2.type ? `BigInt must be ${a2.exact ? "exactly" : a2.inclusive ? "less than or equal to" : "less than"} ${a2.maximum}` : "date" === a2.type ? `Date must be ${a2.exact ? "exactly" : a2.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number(a2.maximum))}` : "Invalid input";
            break;
          case g.custom:
            c2 = "Invalid input";
            break;
          case g.invalid_intersection_types:
            c2 = "Intersection results could not be merged";
            break;
          case g.not_multiple_of:
            c2 = `Number must be a multiple of ${a2.multipleOf}`;
            break;
          case g.not_finite:
            c2 = "Number must be finite";
            break;
          default:
            c2 = b2.defaultError, az.assertNever(a2);
        }
        return { message: c2 };
      };
      !function(a2) {
        a2.errToObj = (a3) => "string" == typeof a3 ? { message: a3 } : a3 || {}, a2.toString = (a3) => "string" == typeof a3 ? a3 : a3?.message;
      }(aB || (aB = {}));
      let j = (a2) => {
        let { data: b2, path: c2, errorMaps: d2, issueData: e2 } = a2, f2 = [...c2, ...e2.path || []], g2 = { ...e2, path: f2 };
        if (void 0 !== e2.message) return { ...e2, path: f2, message: e2.message };
        let h2 = "";
        for (let a3 of d2.filter((a4) => !!a4).slice().reverse()) h2 = a3(g2, { data: b2, defaultError: h2 }).message;
        return { ...e2, path: f2, message: h2 };
      };
      function k(a2, b2) {
        let c2 = j({ issueData: b2, data: a2.data, path: a2.path, errorMaps: [a2.common.contextualErrorMap, a2.schemaErrorMap, i, void 0].filter((a3) => !!a3) });
        a2.common.issues.push(c2);
      }
      class l {
        constructor() {
          this.value = "valid";
        }
        dirty() {
          "valid" === this.value && (this.value = "dirty");
        }
        abort() {
          "aborted" !== this.value && (this.value = "aborted");
        }
        static mergeArray(a2, b2) {
          let c2 = [];
          for (let d2 of b2) {
            if ("aborted" === d2.status) return m;
            "dirty" === d2.status && a2.dirty(), c2.push(d2.value);
          }
          return { status: a2.value, value: c2 };
        }
        static async mergeObjectAsync(a2, b2) {
          let c2 = [];
          for (let a3 of b2) {
            let b3 = await a3.key, d2 = await a3.value;
            c2.push({ key: b3, value: d2 });
          }
          return l.mergeObjectSync(a2, c2);
        }
        static mergeObjectSync(a2, b2) {
          let c2 = {};
          for (let d2 of b2) {
            let { key: b3, value: e2 } = d2;
            if ("aborted" === b3.status || "aborted" === e2.status) return m;
            "dirty" === b3.status && a2.dirty(), "dirty" === e2.status && a2.dirty(), "__proto__" !== b3.value && (void 0 !== e2.value || d2.alwaysSet) && (c2[b3.value] = e2.value);
          }
          return { status: a2.value, value: c2 };
        }
      }
      let m = Object.freeze({ status: "aborted" }), n = (a2) => ({ status: "dirty", value: a2 }), o = (a2) => ({ status: "valid", value: a2 }), p = (a2) => "undefined" != typeof Promise && a2 instanceof Promise;
      class q {
        constructor(a2, b2, c2, d2) {
          this._cachedPath = [], this.parent = a2, this.data = b2, this._path = c2, this._key = d2;
        }
        get path() {
          return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
        }
      }
      let r = (a2, b2) => {
        if ("valid" === b2.status) return { success: true, data: b2.value };
        if (!a2.common.issues.length) throw Error("Validation failed but no issues detected.");
        return { success: false, get error() {
          if (this._error) return this._error;
          let b3 = new h(a2.common.issues);
          return this._error = b3, this._error;
        } };
      };
      function s(a2) {
        if (!a2) return {};
        let { errorMap: b2, invalid_type_error: c2, required_error: d2, description: e2 } = a2;
        if (b2 && (c2 || d2)) throw Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
        return b2 ? { errorMap: b2, description: e2 } : { errorMap: (b3, e3) => {
          let { message: f2 } = a2;
          return "invalid_enum_value" === b3.code ? { message: f2 ?? e3.defaultError } : void 0 === e3.data ? { message: f2 ?? d2 ?? e3.defaultError } : "invalid_type" !== b3.code ? { message: e3.defaultError } : { message: f2 ?? c2 ?? e3.defaultError };
        }, description: e2 };
      }
      class t {
        get description() {
          return this._def.description;
        }
        _getType(a2) {
          return f(a2.data);
        }
        _getOrReturnCtx(a2, b2) {
          return b2 || { common: a2.parent.common, data: a2.data, parsedType: f(a2.data), schemaErrorMap: this._def.errorMap, path: a2.path, parent: a2.parent };
        }
        _processInputParams(a2) {
          return { status: new l(), ctx: { common: a2.parent.common, data: a2.data, parsedType: f(a2.data), schemaErrorMap: this._def.errorMap, path: a2.path, parent: a2.parent } };
        }
        _parseSync(a2) {
          let b2 = this._parse(a2);
          if (p(b2)) throw Error("Synchronous parse encountered promise.");
          return b2;
        }
        _parseAsync(a2) {
          return Promise.resolve(this._parse(a2));
        }
        parse(a2, b2) {
          let c2 = this.safeParse(a2, b2);
          if (c2.success) return c2.data;
          throw c2.error;
        }
        safeParse(a2, b2) {
          let c2 = { common: { issues: [], async: b2?.async ?? false, contextualErrorMap: b2?.errorMap }, path: b2?.path || [], schemaErrorMap: this._def.errorMap, parent: null, data: a2, parsedType: f(a2) }, d2 = this._parseSync({ data: a2, path: c2.path, parent: c2 });
          return r(c2, d2);
        }
        "~validate"(a2) {
          let b2 = { common: { issues: [], async: !!this["~standard"].async }, path: [], schemaErrorMap: this._def.errorMap, parent: null, data: a2, parsedType: f(a2) };
          if (!this["~standard"].async) try {
            let c2 = this._parseSync({ data: a2, path: [], parent: b2 });
            return "valid" === c2.status ? { value: c2.value } : { issues: b2.common.issues };
          } catch (a3) {
            a3?.message?.toLowerCase()?.includes("encountered") && (this["~standard"].async = true), b2.common = { issues: [], async: true };
          }
          return this._parseAsync({ data: a2, path: [], parent: b2 }).then((a3) => "valid" === a3.status ? { value: a3.value } : { issues: b2.common.issues });
        }
        async parseAsync(a2, b2) {
          let c2 = await this.safeParseAsync(a2, b2);
          if (c2.success) return c2.data;
          throw c2.error;
        }
        async safeParseAsync(a2, b2) {
          let c2 = { common: { issues: [], contextualErrorMap: b2?.errorMap, async: true }, path: b2?.path || [], schemaErrorMap: this._def.errorMap, parent: null, data: a2, parsedType: f(a2) }, d2 = this._parse({ data: a2, path: c2.path, parent: c2 });
          return r(c2, await (p(d2) ? d2 : Promise.resolve(d2)));
        }
        refine(a2, b2) {
          return this._refinement((c2, d2) => {
            let e2 = a2(c2), f2 = () => d2.addIssue({ code: g.custom, ..."string" == typeof b2 || void 0 === b2 ? { message: b2 } : "function" == typeof b2 ? b2(c2) : b2 });
            return "undefined" != typeof Promise && e2 instanceof Promise ? e2.then((a3) => !!a3 || (f2(), false)) : !!e2 || (f2(), false);
          });
        }
        refinement(a2, b2) {
          return this._refinement((c2, d2) => !!a2(c2) || (d2.addIssue("function" == typeof b2 ? b2(c2, d2) : b2), false));
        }
        _refinement(a2) {
          return new am({ schema: this, typeName: aC.ZodEffects, effect: { type: "refinement", refinement: a2 } });
        }
        superRefine(a2) {
          return this._refinement(a2);
        }
        constructor(a2) {
          this.spa = this.safeParseAsync, this._def = a2, this.parse = this.parse.bind(this), this.safeParse = this.safeParse.bind(this), this.parseAsync = this.parseAsync.bind(this), this.safeParseAsync = this.safeParseAsync.bind(this), this.spa = this.spa.bind(this), this.refine = this.refine.bind(this), this.refinement = this.refinement.bind(this), this.superRefine = this.superRefine.bind(this), this.optional = this.optional.bind(this), this.nullable = this.nullable.bind(this), this.nullish = this.nullish.bind(this), this.array = this.array.bind(this), this.promise = this.promise.bind(this), this.or = this.or.bind(this), this.and = this.and.bind(this), this.transform = this.transform.bind(this), this.brand = this.brand.bind(this), this.default = this.default.bind(this), this.catch = this.catch.bind(this), this.describe = this.describe.bind(this), this.pipe = this.pipe.bind(this), this.readonly = this.readonly.bind(this), this.isNullable = this.isNullable.bind(this), this.isOptional = this.isOptional.bind(this), this["~standard"] = { version: 1, vendor: "zod", validate: (a3) => this["~validate"](a3) };
        }
        optional() {
          return an.create(this, this._def);
        }
        nullable() {
          return ao.create(this, this._def);
        }
        nullish() {
          return this.nullable().optional();
        }
        array() {
          return X.create(this);
        }
        promise() {
          return al.create(this, this._def);
        }
        or(a2) {
          return Z.create([this, a2], this._def);
        }
        and(a2) {
          return aa.create(this, a2, this._def);
        }
        transform(a2) {
          return new am({ ...s(this._def), schema: this, typeName: aC.ZodEffects, effect: { type: "transform", transform: a2 } });
        }
        default(a2) {
          return new ap({ ...s(this._def), innerType: this, defaultValue: "function" == typeof a2 ? a2 : () => a2, typeName: aC.ZodDefault });
        }
        brand() {
          return new as({ typeName: aC.ZodBranded, type: this, ...s(this._def) });
        }
        catch(a2) {
          return new aq({ ...s(this._def), innerType: this, catchValue: "function" == typeof a2 ? a2 : () => a2, typeName: aC.ZodCatch });
        }
        describe(a2) {
          return new this.constructor({ ...this._def, description: a2 });
        }
        pipe(a2) {
          return at.create(this, a2);
        }
        readonly() {
          return au.create(this);
        }
        isOptional() {
          return this.safeParse(void 0).success;
        }
        isNullable() {
          return this.safeParse(null).success;
        }
      }
      let u = /^c[^\s-]{8,}$/i, v = /^[0-9a-z]+$/, w = /^[0-9A-HJKMNP-TV-Z]{26}$/i, x = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i, y = /^[a-z0-9_-]{21}$/i, z = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, A = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/, B = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i, C = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/, D = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/, E = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/, F = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/, G = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/, H = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/, I = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))", J = RegExp(`^${I}$`);
      function K(a2) {
        let b2 = "[0-5]\\d";
        a2.precision ? b2 = `${b2}\\.\\d{${a2.precision}}` : null == a2.precision && (b2 = `${b2}(\\.\\d+)?`);
        let c2 = a2.precision ? "+" : "?";
        return `([01]\\d|2[0-3]):[0-5]\\d(:${b2})${c2}`;
      }
      class L extends t {
        _parse(a2) {
          var b2, c2, f2, h2;
          let i2;
          if (this._def.coerce && (a2.data = String(a2.data)), this._getType(a2) !== e.string) {
            let b3 = this._getOrReturnCtx(a2);
            return k(b3, { code: g.invalid_type, expected: e.string, received: b3.parsedType }), m;
          }
          let j2 = new l();
          for (let e2 of this._def.checks) if ("min" === e2.kind) a2.data.length < e2.value && (k(i2 = this._getOrReturnCtx(a2, i2), { code: g.too_small, minimum: e2.value, type: "string", inclusive: true, exact: false, message: e2.message }), j2.dirty());
          else if ("max" === e2.kind) a2.data.length > e2.value && (k(i2 = this._getOrReturnCtx(a2, i2), { code: g.too_big, maximum: e2.value, type: "string", inclusive: true, exact: false, message: e2.message }), j2.dirty());
          else if ("length" === e2.kind) {
            let b3 = a2.data.length > e2.value, c3 = a2.data.length < e2.value;
            (b3 || c3) && (i2 = this._getOrReturnCtx(a2, i2), b3 ? k(i2, { code: g.too_big, maximum: e2.value, type: "string", inclusive: true, exact: true, message: e2.message }) : c3 && k(i2, { code: g.too_small, minimum: e2.value, type: "string", inclusive: true, exact: true, message: e2.message }), j2.dirty());
          } else if ("email" === e2.kind) B.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "email", code: g.invalid_string, message: e2.message }), j2.dirty());
          else if ("emoji" === e2.kind) d || (d = RegExp("^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$", "u")), d.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "emoji", code: g.invalid_string, message: e2.message }), j2.dirty());
          else if ("uuid" === e2.kind) x.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "uuid", code: g.invalid_string, message: e2.message }), j2.dirty());
          else if ("nanoid" === e2.kind) y.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "nanoid", code: g.invalid_string, message: e2.message }), j2.dirty());
          else if ("cuid" === e2.kind) u.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "cuid", code: g.invalid_string, message: e2.message }), j2.dirty());
          else if ("cuid2" === e2.kind) v.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "cuid2", code: g.invalid_string, message: e2.message }), j2.dirty());
          else if ("ulid" === e2.kind) w.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "ulid", code: g.invalid_string, message: e2.message }), j2.dirty());
          else if ("url" === e2.kind) try {
            new URL(a2.data);
          } catch {
            k(i2 = this._getOrReturnCtx(a2, i2), { validation: "url", code: g.invalid_string, message: e2.message }), j2.dirty();
          }
          else "regex" === e2.kind ? (e2.regex.lastIndex = 0, e2.regex.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "regex", code: g.invalid_string, message: e2.message }), j2.dirty())) : "trim" === e2.kind ? a2.data = a2.data.trim() : "includes" === e2.kind ? a2.data.includes(e2.value, e2.position) || (k(i2 = this._getOrReturnCtx(a2, i2), { code: g.invalid_string, validation: { includes: e2.value, position: e2.position }, message: e2.message }), j2.dirty()) : "toLowerCase" === e2.kind ? a2.data = a2.data.toLowerCase() : "toUpperCase" === e2.kind ? a2.data = a2.data.toUpperCase() : "startsWith" === e2.kind ? a2.data.startsWith(e2.value) || (k(i2 = this._getOrReturnCtx(a2, i2), { code: g.invalid_string, validation: { startsWith: e2.value }, message: e2.message }), j2.dirty()) : "endsWith" === e2.kind ? a2.data.endsWith(e2.value) || (k(i2 = this._getOrReturnCtx(a2, i2), { code: g.invalid_string, validation: { endsWith: e2.value }, message: e2.message }), j2.dirty()) : "datetime" === e2.kind ? function(a3) {
            let b3 = `${I}T${K(a3)}`, c3 = [];
            return c3.push(a3.local ? "Z?" : "Z"), a3.offset && c3.push("([+-]\\d{2}:?\\d{2})"), b3 = `${b3}(${c3.join("|")})`, RegExp(`^${b3}$`);
          }(e2).test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { code: g.invalid_string, validation: "datetime", message: e2.message }), j2.dirty()) : "date" === e2.kind ? J.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { code: g.invalid_string, validation: "date", message: e2.message }), j2.dirty()) : "time" === e2.kind ? RegExp(`^${K(e2)}$`).test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { code: g.invalid_string, validation: "time", message: e2.message }), j2.dirty()) : "duration" === e2.kind ? A.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "duration", code: g.invalid_string, message: e2.message }), j2.dirty()) : "ip" === e2.kind ? (b2 = a2.data, !(("v4" === (c2 = e2.version) || !c2) && C.test(b2) || ("v6" === c2 || !c2) && E.test(b2)) && 1 && (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "ip", code: g.invalid_string, message: e2.message }), j2.dirty())) : "jwt" === e2.kind ? !function(a3, b3) {
            if (!z.test(a3)) return false;
            try {
              let [c3] = a3.split(".");
              if (!c3) return false;
              let d2 = c3.replace(/-/g, "+").replace(/_/g, "/").padEnd(c3.length + (4 - c3.length % 4) % 4, "="), e3 = JSON.parse(atob(d2));
              if ("object" != typeof e3 || null === e3 || "typ" in e3 && e3?.typ !== "JWT" || !e3.alg || b3 && e3.alg !== b3) return false;
              return true;
            } catch {
              return false;
            }
          }(a2.data, e2.alg) && (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "jwt", code: g.invalid_string, message: e2.message }), j2.dirty()) : "cidr" === e2.kind ? (f2 = a2.data, !(("v4" === (h2 = e2.version) || !h2) && D.test(f2) || ("v6" === h2 || !h2) && F.test(f2)) && 1 && (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "cidr", code: g.invalid_string, message: e2.message }), j2.dirty())) : "base64" === e2.kind ? G.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "base64", code: g.invalid_string, message: e2.message }), j2.dirty()) : "base64url" === e2.kind ? H.test(a2.data) || (k(i2 = this._getOrReturnCtx(a2, i2), { validation: "base64url", code: g.invalid_string, message: e2.message }), j2.dirty()) : az.assertNever(e2);
          return { status: j2.value, value: a2.data };
        }
        _regex(a2, b2, c2) {
          return this.refinement((b3) => a2.test(b3), { validation: b2, code: g.invalid_string, ...aB.errToObj(c2) });
        }
        _addCheck(a2) {
          return new L({ ...this._def, checks: [...this._def.checks, a2] });
        }
        email(a2) {
          return this._addCheck({ kind: "email", ...aB.errToObj(a2) });
        }
        url(a2) {
          return this._addCheck({ kind: "url", ...aB.errToObj(a2) });
        }
        emoji(a2) {
          return this._addCheck({ kind: "emoji", ...aB.errToObj(a2) });
        }
        uuid(a2) {
          return this._addCheck({ kind: "uuid", ...aB.errToObj(a2) });
        }
        nanoid(a2) {
          return this._addCheck({ kind: "nanoid", ...aB.errToObj(a2) });
        }
        cuid(a2) {
          return this._addCheck({ kind: "cuid", ...aB.errToObj(a2) });
        }
        cuid2(a2) {
          return this._addCheck({ kind: "cuid2", ...aB.errToObj(a2) });
        }
        ulid(a2) {
          return this._addCheck({ kind: "ulid", ...aB.errToObj(a2) });
        }
        base64(a2) {
          return this._addCheck({ kind: "base64", ...aB.errToObj(a2) });
        }
        base64url(a2) {
          return this._addCheck({ kind: "base64url", ...aB.errToObj(a2) });
        }
        jwt(a2) {
          return this._addCheck({ kind: "jwt", ...aB.errToObj(a2) });
        }
        ip(a2) {
          return this._addCheck({ kind: "ip", ...aB.errToObj(a2) });
        }
        cidr(a2) {
          return this._addCheck({ kind: "cidr", ...aB.errToObj(a2) });
        }
        datetime(a2) {
          return "string" == typeof a2 ? this._addCheck({ kind: "datetime", precision: null, offset: false, local: false, message: a2 }) : this._addCheck({ kind: "datetime", precision: void 0 === a2?.precision ? null : a2?.precision, offset: a2?.offset ?? false, local: a2?.local ?? false, ...aB.errToObj(a2?.message) });
        }
        date(a2) {
          return this._addCheck({ kind: "date", message: a2 });
        }
        time(a2) {
          return "string" == typeof a2 ? this._addCheck({ kind: "time", precision: null, message: a2 }) : this._addCheck({ kind: "time", precision: void 0 === a2?.precision ? null : a2?.precision, ...aB.errToObj(a2?.message) });
        }
        duration(a2) {
          return this._addCheck({ kind: "duration", ...aB.errToObj(a2) });
        }
        regex(a2, b2) {
          return this._addCheck({ kind: "regex", regex: a2, ...aB.errToObj(b2) });
        }
        includes(a2, b2) {
          return this._addCheck({ kind: "includes", value: a2, position: b2?.position, ...aB.errToObj(b2?.message) });
        }
        startsWith(a2, b2) {
          return this._addCheck({ kind: "startsWith", value: a2, ...aB.errToObj(b2) });
        }
        endsWith(a2, b2) {
          return this._addCheck({ kind: "endsWith", value: a2, ...aB.errToObj(b2) });
        }
        min(a2, b2) {
          return this._addCheck({ kind: "min", value: a2, ...aB.errToObj(b2) });
        }
        max(a2, b2) {
          return this._addCheck({ kind: "max", value: a2, ...aB.errToObj(b2) });
        }
        length(a2, b2) {
          return this._addCheck({ kind: "length", value: a2, ...aB.errToObj(b2) });
        }
        nonempty(a2) {
          return this.min(1, aB.errToObj(a2));
        }
        trim() {
          return new L({ ...this._def, checks: [...this._def.checks, { kind: "trim" }] });
        }
        toLowerCase() {
          return new L({ ...this._def, checks: [...this._def.checks, { kind: "toLowerCase" }] });
        }
        toUpperCase() {
          return new L({ ...this._def, checks: [...this._def.checks, { kind: "toUpperCase" }] });
        }
        get isDatetime() {
          return !!this._def.checks.find((a2) => "datetime" === a2.kind);
        }
        get isDate() {
          return !!this._def.checks.find((a2) => "date" === a2.kind);
        }
        get isTime() {
          return !!this._def.checks.find((a2) => "time" === a2.kind);
        }
        get isDuration() {
          return !!this._def.checks.find((a2) => "duration" === a2.kind);
        }
        get isEmail() {
          return !!this._def.checks.find((a2) => "email" === a2.kind);
        }
        get isURL() {
          return !!this._def.checks.find((a2) => "url" === a2.kind);
        }
        get isEmoji() {
          return !!this._def.checks.find((a2) => "emoji" === a2.kind);
        }
        get isUUID() {
          return !!this._def.checks.find((a2) => "uuid" === a2.kind);
        }
        get isNANOID() {
          return !!this._def.checks.find((a2) => "nanoid" === a2.kind);
        }
        get isCUID() {
          return !!this._def.checks.find((a2) => "cuid" === a2.kind);
        }
        get isCUID2() {
          return !!this._def.checks.find((a2) => "cuid2" === a2.kind);
        }
        get isULID() {
          return !!this._def.checks.find((a2) => "ulid" === a2.kind);
        }
        get isIP() {
          return !!this._def.checks.find((a2) => "ip" === a2.kind);
        }
        get isCIDR() {
          return !!this._def.checks.find((a2) => "cidr" === a2.kind);
        }
        get isBase64() {
          return !!this._def.checks.find((a2) => "base64" === a2.kind);
        }
        get isBase64url() {
          return !!this._def.checks.find((a2) => "base64url" === a2.kind);
        }
        get minLength() {
          let a2 = null;
          for (let b2 of this._def.checks) "min" === b2.kind && (null === a2 || b2.value > a2) && (a2 = b2.value);
          return a2;
        }
        get maxLength() {
          let a2 = null;
          for (let b2 of this._def.checks) "max" === b2.kind && (null === a2 || b2.value < a2) && (a2 = b2.value);
          return a2;
        }
      }
      L.create = (a2) => new L({ checks: [], typeName: aC.ZodString, coerce: a2?.coerce ?? false, ...s(a2) });
      class M extends t {
        constructor() {
          super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
        }
        _parse(a2) {
          let b2;
          if (this._def.coerce && (a2.data = Number(a2.data)), this._getType(a2) !== e.number) {
            let b3 = this._getOrReturnCtx(a2);
            return k(b3, { code: g.invalid_type, expected: e.number, received: b3.parsedType }), m;
          }
          let c2 = new l();
          for (let d2 of this._def.checks) "int" === d2.kind ? az.isInteger(a2.data) || (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.invalid_type, expected: "integer", received: "float", message: d2.message }), c2.dirty()) : "min" === d2.kind ? (d2.inclusive ? a2.data < d2.value : a2.data <= d2.value) && (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.too_small, minimum: d2.value, type: "number", inclusive: d2.inclusive, exact: false, message: d2.message }), c2.dirty()) : "max" === d2.kind ? (d2.inclusive ? a2.data > d2.value : a2.data >= d2.value) && (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.too_big, maximum: d2.value, type: "number", inclusive: d2.inclusive, exact: false, message: d2.message }), c2.dirty()) : "multipleOf" === d2.kind ? 0 !== function(a3, b3) {
            let c3 = (a3.toString().split(".")[1] || "").length, d3 = (b3.toString().split(".")[1] || "").length, e2 = c3 > d3 ? c3 : d3;
            return Number.parseInt(a3.toFixed(e2).replace(".", "")) % Number.parseInt(b3.toFixed(e2).replace(".", "")) / 10 ** e2;
          }(a2.data, d2.value) && (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.not_multiple_of, multipleOf: d2.value, message: d2.message }), c2.dirty()) : "finite" === d2.kind ? Number.isFinite(a2.data) || (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.not_finite, message: d2.message }), c2.dirty()) : az.assertNever(d2);
          return { status: c2.value, value: a2.data };
        }
        gte(a2, b2) {
          return this.setLimit("min", a2, true, aB.toString(b2));
        }
        gt(a2, b2) {
          return this.setLimit("min", a2, false, aB.toString(b2));
        }
        lte(a2, b2) {
          return this.setLimit("max", a2, true, aB.toString(b2));
        }
        lt(a2, b2) {
          return this.setLimit("max", a2, false, aB.toString(b2));
        }
        setLimit(a2, b2, c2, d2) {
          return new M({ ...this._def, checks: [...this._def.checks, { kind: a2, value: b2, inclusive: c2, message: aB.toString(d2) }] });
        }
        _addCheck(a2) {
          return new M({ ...this._def, checks: [...this._def.checks, a2] });
        }
        int(a2) {
          return this._addCheck({ kind: "int", message: aB.toString(a2) });
        }
        positive(a2) {
          return this._addCheck({ kind: "min", value: 0, inclusive: false, message: aB.toString(a2) });
        }
        negative(a2) {
          return this._addCheck({ kind: "max", value: 0, inclusive: false, message: aB.toString(a2) });
        }
        nonpositive(a2) {
          return this._addCheck({ kind: "max", value: 0, inclusive: true, message: aB.toString(a2) });
        }
        nonnegative(a2) {
          return this._addCheck({ kind: "min", value: 0, inclusive: true, message: aB.toString(a2) });
        }
        multipleOf(a2, b2) {
          return this._addCheck({ kind: "multipleOf", value: a2, message: aB.toString(b2) });
        }
        finite(a2) {
          return this._addCheck({ kind: "finite", message: aB.toString(a2) });
        }
        safe(a2) {
          return this._addCheck({ kind: "min", inclusive: true, value: Number.MIN_SAFE_INTEGER, message: aB.toString(a2) })._addCheck({ kind: "max", inclusive: true, value: Number.MAX_SAFE_INTEGER, message: aB.toString(a2) });
        }
        get minValue() {
          let a2 = null;
          for (let b2 of this._def.checks) "min" === b2.kind && (null === a2 || b2.value > a2) && (a2 = b2.value);
          return a2;
        }
        get maxValue() {
          let a2 = null;
          for (let b2 of this._def.checks) "max" === b2.kind && (null === a2 || b2.value < a2) && (a2 = b2.value);
          return a2;
        }
        get isInt() {
          return !!this._def.checks.find((a2) => "int" === a2.kind || "multipleOf" === a2.kind && az.isInteger(a2.value));
        }
        get isFinite() {
          let a2 = null, b2 = null;
          for (let c2 of this._def.checks) if ("finite" === c2.kind || "int" === c2.kind || "multipleOf" === c2.kind) return true;
          else "min" === c2.kind ? (null === b2 || c2.value > b2) && (b2 = c2.value) : "max" === c2.kind && (null === a2 || c2.value < a2) && (a2 = c2.value);
          return Number.isFinite(b2) && Number.isFinite(a2);
        }
      }
      M.create = (a2) => new M({ checks: [], typeName: aC.ZodNumber, coerce: a2?.coerce || false, ...s(a2) });
      class N extends t {
        constructor() {
          super(...arguments), this.min = this.gte, this.max = this.lte;
        }
        _parse(a2) {
          let b2;
          if (this._def.coerce) try {
            a2.data = BigInt(a2.data);
          } catch {
            return this._getInvalidInput(a2);
          }
          if (this._getType(a2) !== e.bigint) return this._getInvalidInput(a2);
          let c2 = new l();
          for (let d2 of this._def.checks) "min" === d2.kind ? (d2.inclusive ? a2.data < d2.value : a2.data <= d2.value) && (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.too_small, type: "bigint", minimum: d2.value, inclusive: d2.inclusive, message: d2.message }), c2.dirty()) : "max" === d2.kind ? (d2.inclusive ? a2.data > d2.value : a2.data >= d2.value) && (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.too_big, type: "bigint", maximum: d2.value, inclusive: d2.inclusive, message: d2.message }), c2.dirty()) : "multipleOf" === d2.kind ? a2.data % d2.value !== BigInt(0) && (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.not_multiple_of, multipleOf: d2.value, message: d2.message }), c2.dirty()) : az.assertNever(d2);
          return { status: c2.value, value: a2.data };
        }
        _getInvalidInput(a2) {
          let b2 = this._getOrReturnCtx(a2);
          return k(b2, { code: g.invalid_type, expected: e.bigint, received: b2.parsedType }), m;
        }
        gte(a2, b2) {
          return this.setLimit("min", a2, true, aB.toString(b2));
        }
        gt(a2, b2) {
          return this.setLimit("min", a2, false, aB.toString(b2));
        }
        lte(a2, b2) {
          return this.setLimit("max", a2, true, aB.toString(b2));
        }
        lt(a2, b2) {
          return this.setLimit("max", a2, false, aB.toString(b2));
        }
        setLimit(a2, b2, c2, d2) {
          return new N({ ...this._def, checks: [...this._def.checks, { kind: a2, value: b2, inclusive: c2, message: aB.toString(d2) }] });
        }
        _addCheck(a2) {
          return new N({ ...this._def, checks: [...this._def.checks, a2] });
        }
        positive(a2) {
          return this._addCheck({ kind: "min", value: BigInt(0), inclusive: false, message: aB.toString(a2) });
        }
        negative(a2) {
          return this._addCheck({ kind: "max", value: BigInt(0), inclusive: false, message: aB.toString(a2) });
        }
        nonpositive(a2) {
          return this._addCheck({ kind: "max", value: BigInt(0), inclusive: true, message: aB.toString(a2) });
        }
        nonnegative(a2) {
          return this._addCheck({ kind: "min", value: BigInt(0), inclusive: true, message: aB.toString(a2) });
        }
        multipleOf(a2, b2) {
          return this._addCheck({ kind: "multipleOf", value: a2, message: aB.toString(b2) });
        }
        get minValue() {
          let a2 = null;
          for (let b2 of this._def.checks) "min" === b2.kind && (null === a2 || b2.value > a2) && (a2 = b2.value);
          return a2;
        }
        get maxValue() {
          let a2 = null;
          for (let b2 of this._def.checks) "max" === b2.kind && (null === a2 || b2.value < a2) && (a2 = b2.value);
          return a2;
        }
      }
      N.create = (a2) => new N({ checks: [], typeName: aC.ZodBigInt, coerce: a2?.coerce ?? false, ...s(a2) });
      class O extends t {
        _parse(a2) {
          if (this._def.coerce && (a2.data = !!a2.data), this._getType(a2) !== e.boolean) {
            let b2 = this._getOrReturnCtx(a2);
            return k(b2, { code: g.invalid_type, expected: e.boolean, received: b2.parsedType }), m;
          }
          return o(a2.data);
        }
      }
      O.create = (a2) => new O({ typeName: aC.ZodBoolean, coerce: a2?.coerce || false, ...s(a2) });
      class P extends t {
        _parse(a2) {
          let b2;
          if (this._def.coerce && (a2.data = new Date(a2.data)), this._getType(a2) !== e.date) {
            let b3 = this._getOrReturnCtx(a2);
            return k(b3, { code: g.invalid_type, expected: e.date, received: b3.parsedType }), m;
          }
          if (Number.isNaN(a2.data.getTime())) return k(this._getOrReturnCtx(a2), { code: g.invalid_date }), m;
          let c2 = new l();
          for (let d2 of this._def.checks) "min" === d2.kind ? a2.data.getTime() < d2.value && (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.too_small, message: d2.message, inclusive: true, exact: false, minimum: d2.value, type: "date" }), c2.dirty()) : "max" === d2.kind ? a2.data.getTime() > d2.value && (k(b2 = this._getOrReturnCtx(a2, b2), { code: g.too_big, message: d2.message, inclusive: true, exact: false, maximum: d2.value, type: "date" }), c2.dirty()) : az.assertNever(d2);
          return { status: c2.value, value: new Date(a2.data.getTime()) };
        }
        _addCheck(a2) {
          return new P({ ...this._def, checks: [...this._def.checks, a2] });
        }
        min(a2, b2) {
          return this._addCheck({ kind: "min", value: a2.getTime(), message: aB.toString(b2) });
        }
        max(a2, b2) {
          return this._addCheck({ kind: "max", value: a2.getTime(), message: aB.toString(b2) });
        }
        get minDate() {
          let a2 = null;
          for (let b2 of this._def.checks) "min" === b2.kind && (null === a2 || b2.value > a2) && (a2 = b2.value);
          return null != a2 ? new Date(a2) : null;
        }
        get maxDate() {
          let a2 = null;
          for (let b2 of this._def.checks) "max" === b2.kind && (null === a2 || b2.value < a2) && (a2 = b2.value);
          return null != a2 ? new Date(a2) : null;
        }
      }
      P.create = (a2) => new P({ checks: [], coerce: a2?.coerce || false, typeName: aC.ZodDate, ...s(a2) });
      class Q extends t {
        _parse(a2) {
          if (this._getType(a2) !== e.symbol) {
            let b2 = this._getOrReturnCtx(a2);
            return k(b2, { code: g.invalid_type, expected: e.symbol, received: b2.parsedType }), m;
          }
          return o(a2.data);
        }
      }
      Q.create = (a2) => new Q({ typeName: aC.ZodSymbol, ...s(a2) });
      class R extends t {
        _parse(a2) {
          if (this._getType(a2) !== e.undefined) {
            let b2 = this._getOrReturnCtx(a2);
            return k(b2, { code: g.invalid_type, expected: e.undefined, received: b2.parsedType }), m;
          }
          return o(a2.data);
        }
      }
      R.create = (a2) => new R({ typeName: aC.ZodUndefined, ...s(a2) });
      class S extends t {
        _parse(a2) {
          if (this._getType(a2) !== e.null) {
            let b2 = this._getOrReturnCtx(a2);
            return k(b2, { code: g.invalid_type, expected: e.null, received: b2.parsedType }), m;
          }
          return o(a2.data);
        }
      }
      S.create = (a2) => new S({ typeName: aC.ZodNull, ...s(a2) });
      class T extends t {
        constructor() {
          super(...arguments), this._any = true;
        }
        _parse(a2) {
          return o(a2.data);
        }
      }
      T.create = (a2) => new T({ typeName: aC.ZodAny, ...s(a2) });
      class U extends t {
        constructor() {
          super(...arguments), this._unknown = true;
        }
        _parse(a2) {
          return o(a2.data);
        }
      }
      U.create = (a2) => new U({ typeName: aC.ZodUnknown, ...s(a2) });
      class V extends t {
        _parse(a2) {
          let b2 = this._getOrReturnCtx(a2);
          return k(b2, { code: g.invalid_type, expected: e.never, received: b2.parsedType }), m;
        }
      }
      V.create = (a2) => new V({ typeName: aC.ZodNever, ...s(a2) });
      class W extends t {
        _parse(a2) {
          if (this._getType(a2) !== e.undefined) {
            let b2 = this._getOrReturnCtx(a2);
            return k(b2, { code: g.invalid_type, expected: e.void, received: b2.parsedType }), m;
          }
          return o(a2.data);
        }
      }
      W.create = (a2) => new W({ typeName: aC.ZodVoid, ...s(a2) });
      class X extends t {
        _parse(a2) {
          let { ctx: b2, status: c2 } = this._processInputParams(a2), d2 = this._def;
          if (b2.parsedType !== e.array) return k(b2, { code: g.invalid_type, expected: e.array, received: b2.parsedType }), m;
          if (null !== d2.exactLength) {
            let a3 = b2.data.length > d2.exactLength.value, e2 = b2.data.length < d2.exactLength.value;
            (a3 || e2) && (k(b2, { code: a3 ? g.too_big : g.too_small, minimum: e2 ? d2.exactLength.value : void 0, maximum: a3 ? d2.exactLength.value : void 0, type: "array", inclusive: true, exact: true, message: d2.exactLength.message }), c2.dirty());
          }
          if (null !== d2.minLength && b2.data.length < d2.minLength.value && (k(b2, { code: g.too_small, minimum: d2.minLength.value, type: "array", inclusive: true, exact: false, message: d2.minLength.message }), c2.dirty()), null !== d2.maxLength && b2.data.length > d2.maxLength.value && (k(b2, { code: g.too_big, maximum: d2.maxLength.value, type: "array", inclusive: true, exact: false, message: d2.maxLength.message }), c2.dirty()), b2.common.async) return Promise.all([...b2.data].map((a3, c3) => d2.type._parseAsync(new q(b2, a3, b2.path, c3)))).then((a3) => l.mergeArray(c2, a3));
          let f2 = [...b2.data].map((a3, c3) => d2.type._parseSync(new q(b2, a3, b2.path, c3)));
          return l.mergeArray(c2, f2);
        }
        get element() {
          return this._def.type;
        }
        min(a2, b2) {
          return new X({ ...this._def, minLength: { value: a2, message: aB.toString(b2) } });
        }
        max(a2, b2) {
          return new X({ ...this._def, maxLength: { value: a2, message: aB.toString(b2) } });
        }
        length(a2, b2) {
          return new X({ ...this._def, exactLength: { value: a2, message: aB.toString(b2) } });
        }
        nonempty(a2) {
          return this.min(1, a2);
        }
      }
      X.create = (a2, b2) => new X({ type: a2, minLength: null, maxLength: null, exactLength: null, typeName: aC.ZodArray, ...s(b2) });
      class Y extends t {
        constructor() {
          super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
        }
        _getCached() {
          if (null !== this._cached) return this._cached;
          let a2 = this._def.shape(), b2 = az.objectKeys(a2);
          return this._cached = { shape: a2, keys: b2 }, this._cached;
        }
        _parse(a2) {
          if (this._getType(a2) !== e.object) {
            let b3 = this._getOrReturnCtx(a2);
            return k(b3, { code: g.invalid_type, expected: e.object, received: b3.parsedType }), m;
          }
          let { status: b2, ctx: c2 } = this._processInputParams(a2), { shape: d2, keys: f2 } = this._getCached(), h2 = [];
          if (!(this._def.catchall instanceof V && "strip" === this._def.unknownKeys)) for (let a3 in c2.data) f2.includes(a3) || h2.push(a3);
          let i2 = [];
          for (let a3 of f2) {
            let b3 = d2[a3], e2 = c2.data[a3];
            i2.push({ key: { status: "valid", value: a3 }, value: b3._parse(new q(c2, e2, c2.path, a3)), alwaysSet: a3 in c2.data });
          }
          if (this._def.catchall instanceof V) {
            let a3 = this._def.unknownKeys;
            if ("passthrough" === a3) for (let a4 of h2) i2.push({ key: { status: "valid", value: a4 }, value: { status: "valid", value: c2.data[a4] } });
            else if ("strict" === a3) h2.length > 0 && (k(c2, { code: g.unrecognized_keys, keys: h2 }), b2.dirty());
            else if ("strip" === a3) ;
            else throw Error("Internal ZodObject error: invalid unknownKeys value.");
          } else {
            let a3 = this._def.catchall;
            for (let b3 of h2) {
              let d3 = c2.data[b3];
              i2.push({ key: { status: "valid", value: b3 }, value: a3._parse(new q(c2, d3, c2.path, b3)), alwaysSet: b3 in c2.data });
            }
          }
          return c2.common.async ? Promise.resolve().then(async () => {
            let a3 = [];
            for (let b3 of i2) {
              let c3 = await b3.key, d3 = await b3.value;
              a3.push({ key: c3, value: d3, alwaysSet: b3.alwaysSet });
            }
            return a3;
          }).then((a3) => l.mergeObjectSync(b2, a3)) : l.mergeObjectSync(b2, i2);
        }
        get shape() {
          return this._def.shape();
        }
        strict(a2) {
          return aB.errToObj, new Y({ ...this._def, unknownKeys: "strict", ...void 0 !== a2 ? { errorMap: (b2, c2) => {
            let d2 = this._def.errorMap?.(b2, c2).message ?? c2.defaultError;
            return "unrecognized_keys" === b2.code ? { message: aB.errToObj(a2).message ?? d2 } : { message: d2 };
          } } : {} });
        }
        strip() {
          return new Y({ ...this._def, unknownKeys: "strip" });
        }
        passthrough() {
          return new Y({ ...this._def, unknownKeys: "passthrough" });
        }
        extend(a2) {
          return new Y({ ...this._def, shape: () => ({ ...this._def.shape(), ...a2 }) });
        }
        merge(a2) {
          return new Y({ unknownKeys: a2._def.unknownKeys, catchall: a2._def.catchall, shape: () => ({ ...this._def.shape(), ...a2._def.shape() }), typeName: aC.ZodObject });
        }
        setKey(a2, b2) {
          return this.augment({ [a2]: b2 });
        }
        catchall(a2) {
          return new Y({ ...this._def, catchall: a2 });
        }
        pick(a2) {
          let b2 = {};
          for (let c2 of az.objectKeys(a2)) a2[c2] && this.shape[c2] && (b2[c2] = this.shape[c2]);
          return new Y({ ...this._def, shape: () => b2 });
        }
        omit(a2) {
          let b2 = {};
          for (let c2 of az.objectKeys(this.shape)) a2[c2] || (b2[c2] = this.shape[c2]);
          return new Y({ ...this._def, shape: () => b2 });
        }
        deepPartial() {
          return function a2(b2) {
            if (b2 instanceof Y) {
              let c2 = {};
              for (let d2 in b2.shape) {
                let e2 = b2.shape[d2];
                c2[d2] = an.create(a2(e2));
              }
              return new Y({ ...b2._def, shape: () => c2 });
            }
            if (b2 instanceof X) return new X({ ...b2._def, type: a2(b2.element) });
            if (b2 instanceof an) return an.create(a2(b2.unwrap()));
            if (b2 instanceof ao) return ao.create(a2(b2.unwrap()));
            if (b2 instanceof ab) return ab.create(b2.items.map((b3) => a2(b3)));
            else return b2;
          }(this);
        }
        partial(a2) {
          let b2 = {};
          for (let c2 of az.objectKeys(this.shape)) {
            let d2 = this.shape[c2];
            a2 && !a2[c2] ? b2[c2] = d2 : b2[c2] = d2.optional();
          }
          return new Y({ ...this._def, shape: () => b2 });
        }
        required(a2) {
          let b2 = {};
          for (let c2 of az.objectKeys(this.shape)) if (a2 && !a2[c2]) b2[c2] = this.shape[c2];
          else {
            let a3 = this.shape[c2];
            for (; a3 instanceof an; ) a3 = a3._def.innerType;
            b2[c2] = a3;
          }
          return new Y({ ...this._def, shape: () => b2 });
        }
        keyof() {
          return ai(az.objectKeys(this.shape));
        }
      }
      Y.create = (a2, b2) => new Y({ shape: () => a2, unknownKeys: "strip", catchall: V.create(), typeName: aC.ZodObject, ...s(b2) }), Y.strictCreate = (a2, b2) => new Y({ shape: () => a2, unknownKeys: "strict", catchall: V.create(), typeName: aC.ZodObject, ...s(b2) }), Y.lazycreate = (a2, b2) => new Y({ shape: a2, unknownKeys: "strip", catchall: V.create(), typeName: aC.ZodObject, ...s(b2) });
      class Z extends t {
        _parse(a2) {
          let { ctx: b2 } = this._processInputParams(a2), c2 = this._def.options;
          if (b2.common.async) return Promise.all(c2.map(async (a3) => {
            let c3 = { ...b2, common: { ...b2.common, issues: [] }, parent: null };
            return { result: await a3._parseAsync({ data: b2.data, path: b2.path, parent: c3 }), ctx: c3 };
          })).then(function(a3) {
            for (let b3 of a3) if ("valid" === b3.result.status) return b3.result;
            for (let c4 of a3) if ("dirty" === c4.result.status) return b2.common.issues.push(...c4.ctx.common.issues), c4.result;
            let c3 = a3.map((a4) => new h(a4.ctx.common.issues));
            return k(b2, { code: g.invalid_union, unionErrors: c3 }), m;
          });
          {
            let a3, d2 = [];
            for (let e3 of c2) {
              let c3 = { ...b2, common: { ...b2.common, issues: [] }, parent: null }, f2 = e3._parseSync({ data: b2.data, path: b2.path, parent: c3 });
              if ("valid" === f2.status) return f2;
              "dirty" !== f2.status || a3 || (a3 = { result: f2, ctx: c3 }), c3.common.issues.length && d2.push(c3.common.issues);
            }
            if (a3) return b2.common.issues.push(...a3.ctx.common.issues), a3.result;
            let e2 = d2.map((a4) => new h(a4));
            return k(b2, { code: g.invalid_union, unionErrors: e2 }), m;
          }
        }
        get options() {
          return this._def.options;
        }
      }
      Z.create = (a2, b2) => new Z({ options: a2, typeName: aC.ZodUnion, ...s(b2) });
      let $ = (a2) => {
        if (a2 instanceof ag) return $(a2.schema);
        if (a2 instanceof am) return $(a2.innerType());
        if (a2 instanceof ah) return [a2.value];
        if (a2 instanceof aj) return a2.options;
        if (a2 instanceof ak) return az.objectValues(a2.enum);
        else if (a2 instanceof ap) return $(a2._def.innerType);
        else if (a2 instanceof R) return [void 0];
        else if (a2 instanceof S) return [null];
        else if (a2 instanceof an) return [void 0, ...$(a2.unwrap())];
        else if (a2 instanceof ao) return [null, ...$(a2.unwrap())];
        else if (a2 instanceof as) return $(a2.unwrap());
        else if (a2 instanceof au) return $(a2.unwrap());
        else if (a2 instanceof aq) return $(a2._def.innerType);
        else return [];
      };
      class _ extends t {
        _parse(a2) {
          let { ctx: b2 } = this._processInputParams(a2);
          if (b2.parsedType !== e.object) return k(b2, { code: g.invalid_type, expected: e.object, received: b2.parsedType }), m;
          let c2 = this.discriminator, d2 = b2.data[c2], f2 = this.optionsMap.get(d2);
          return f2 ? b2.common.async ? f2._parseAsync({ data: b2.data, path: b2.path, parent: b2 }) : f2._parseSync({ data: b2.data, path: b2.path, parent: b2 }) : (k(b2, { code: g.invalid_union_discriminator, options: Array.from(this.optionsMap.keys()), path: [c2] }), m);
        }
        get discriminator() {
          return this._def.discriminator;
        }
        get options() {
          return this._def.options;
        }
        get optionsMap() {
          return this._def.optionsMap;
        }
        static create(a2, b2, c2) {
          let d2 = /* @__PURE__ */ new Map();
          for (let c3 of b2) {
            let b3 = $(c3.shape[a2]);
            if (!b3.length) throw Error(`A discriminator value for key \`${a2}\` could not be extracted from all schema options`);
            for (let e2 of b3) {
              if (d2.has(e2)) throw Error(`Discriminator property ${String(a2)} has duplicate value ${String(e2)}`);
              d2.set(e2, c3);
            }
          }
          return new _({ typeName: aC.ZodDiscriminatedUnion, discriminator: a2, options: b2, optionsMap: d2, ...s(c2) });
        }
      }
      class aa extends t {
        _parse(a2) {
          let { status: b2, ctx: c2 } = this._processInputParams(a2), d2 = (a3, d3) => {
            if ("aborted" === a3.status || "aborted" === d3.status) return m;
            let h2 = function a4(b3, c3) {
              let d4 = f(b3), g2 = f(c3);
              if (b3 === c3) return { valid: true, data: b3 };
              if (d4 === e.object && g2 === e.object) {
                let d5 = az.objectKeys(c3), e2 = az.objectKeys(b3).filter((a5) => -1 !== d5.indexOf(a5)), f2 = { ...b3, ...c3 };
                for (let d6 of e2) {
                  let e3 = a4(b3[d6], c3[d6]);
                  if (!e3.valid) return { valid: false };
                  f2[d6] = e3.data;
                }
                return { valid: true, data: f2 };
              }
              if (d4 === e.array && g2 === e.array) {
                if (b3.length !== c3.length) return { valid: false };
                let d5 = [];
                for (let e2 = 0; e2 < b3.length; e2++) {
                  let f2 = a4(b3[e2], c3[e2]);
                  if (!f2.valid) return { valid: false };
                  d5.push(f2.data);
                }
                return { valid: true, data: d5 };
              }
              if (d4 === e.date && g2 === e.date && +b3 == +c3) return { valid: true, data: b3 };
              return { valid: false };
            }(a3.value, d3.value);
            return h2.valid ? (("dirty" === a3.status || "dirty" === d3.status) && b2.dirty(), { status: b2.value, value: h2.data }) : (k(c2, { code: g.invalid_intersection_types }), m);
          };
          return c2.common.async ? Promise.all([this._def.left._parseAsync({ data: c2.data, path: c2.path, parent: c2 }), this._def.right._parseAsync({ data: c2.data, path: c2.path, parent: c2 })]).then(([a3, b3]) => d2(a3, b3)) : d2(this._def.left._parseSync({ data: c2.data, path: c2.path, parent: c2 }), this._def.right._parseSync({ data: c2.data, path: c2.path, parent: c2 }));
        }
      }
      aa.create = (a2, b2, c2) => new aa({ left: a2, right: b2, typeName: aC.ZodIntersection, ...s(c2) });
      class ab extends t {
        _parse(a2) {
          let { status: b2, ctx: c2 } = this._processInputParams(a2);
          if (c2.parsedType !== e.array) return k(c2, { code: g.invalid_type, expected: e.array, received: c2.parsedType }), m;
          if (c2.data.length < this._def.items.length) return k(c2, { code: g.too_small, minimum: this._def.items.length, inclusive: true, exact: false, type: "array" }), m;
          !this._def.rest && c2.data.length > this._def.items.length && (k(c2, { code: g.too_big, maximum: this._def.items.length, inclusive: true, exact: false, type: "array" }), b2.dirty());
          let d2 = [...c2.data].map((a3, b3) => {
            let d3 = this._def.items[b3] || this._def.rest;
            return d3 ? d3._parse(new q(c2, a3, c2.path, b3)) : null;
          }).filter((a3) => !!a3);
          return c2.common.async ? Promise.all(d2).then((a3) => l.mergeArray(b2, a3)) : l.mergeArray(b2, d2);
        }
        get items() {
          return this._def.items;
        }
        rest(a2) {
          return new ab({ ...this._def, rest: a2 });
        }
      }
      ab.create = (a2, b2) => {
        if (!Array.isArray(a2)) throw Error("You must pass an array of schemas to z.tuple([ ... ])");
        return new ab({ items: a2, typeName: aC.ZodTuple, rest: null, ...s(b2) });
      };
      class ac extends t {
        get keySchema() {
          return this._def.keyType;
        }
        get valueSchema() {
          return this._def.valueType;
        }
        _parse(a2) {
          let { status: b2, ctx: c2 } = this._processInputParams(a2);
          if (c2.parsedType !== e.object) return k(c2, { code: g.invalid_type, expected: e.object, received: c2.parsedType }), m;
          let d2 = [], f2 = this._def.keyType, h2 = this._def.valueType;
          for (let a3 in c2.data) d2.push({ key: f2._parse(new q(c2, a3, c2.path, a3)), value: h2._parse(new q(c2, c2.data[a3], c2.path, a3)), alwaysSet: a3 in c2.data });
          return c2.common.async ? l.mergeObjectAsync(b2, d2) : l.mergeObjectSync(b2, d2);
        }
        get element() {
          return this._def.valueType;
        }
        static create(a2, b2, c2) {
          return new ac(b2 instanceof t ? { keyType: a2, valueType: b2, typeName: aC.ZodRecord, ...s(c2) } : { keyType: L.create(), valueType: a2, typeName: aC.ZodRecord, ...s(b2) });
        }
      }
      class ad extends t {
        get keySchema() {
          return this._def.keyType;
        }
        get valueSchema() {
          return this._def.valueType;
        }
        _parse(a2) {
          let { status: b2, ctx: c2 } = this._processInputParams(a2);
          if (c2.parsedType !== e.map) return k(c2, { code: g.invalid_type, expected: e.map, received: c2.parsedType }), m;
          let d2 = this._def.keyType, f2 = this._def.valueType, h2 = [...c2.data.entries()].map(([a3, b3], e2) => ({ key: d2._parse(new q(c2, a3, c2.path, [e2, "key"])), value: f2._parse(new q(c2, b3, c2.path, [e2, "value"])) }));
          if (c2.common.async) {
            let a3 = /* @__PURE__ */ new Map();
            return Promise.resolve().then(async () => {
              for (let c3 of h2) {
                let d3 = await c3.key, e2 = await c3.value;
                if ("aborted" === d3.status || "aborted" === e2.status) return m;
                ("dirty" === d3.status || "dirty" === e2.status) && b2.dirty(), a3.set(d3.value, e2.value);
              }
              return { status: b2.value, value: a3 };
            });
          }
          {
            let a3 = /* @__PURE__ */ new Map();
            for (let c3 of h2) {
              let d3 = c3.key, e2 = c3.value;
              if ("aborted" === d3.status || "aborted" === e2.status) return m;
              ("dirty" === d3.status || "dirty" === e2.status) && b2.dirty(), a3.set(d3.value, e2.value);
            }
            return { status: b2.value, value: a3 };
          }
        }
      }
      ad.create = (a2, b2, c2) => new ad({ valueType: b2, keyType: a2, typeName: aC.ZodMap, ...s(c2) });
      class ae extends t {
        _parse(a2) {
          let { status: b2, ctx: c2 } = this._processInputParams(a2);
          if (c2.parsedType !== e.set) return k(c2, { code: g.invalid_type, expected: e.set, received: c2.parsedType }), m;
          let d2 = this._def;
          null !== d2.minSize && c2.data.size < d2.minSize.value && (k(c2, { code: g.too_small, minimum: d2.minSize.value, type: "set", inclusive: true, exact: false, message: d2.minSize.message }), b2.dirty()), null !== d2.maxSize && c2.data.size > d2.maxSize.value && (k(c2, { code: g.too_big, maximum: d2.maxSize.value, type: "set", inclusive: true, exact: false, message: d2.maxSize.message }), b2.dirty());
          let f2 = this._def.valueType;
          function h2(a3) {
            let c3 = /* @__PURE__ */ new Set();
            for (let d3 of a3) {
              if ("aborted" === d3.status) return m;
              "dirty" === d3.status && b2.dirty(), c3.add(d3.value);
            }
            return { status: b2.value, value: c3 };
          }
          let i2 = [...c2.data.values()].map((a3, b3) => f2._parse(new q(c2, a3, c2.path, b3)));
          return c2.common.async ? Promise.all(i2).then((a3) => h2(a3)) : h2(i2);
        }
        min(a2, b2) {
          return new ae({ ...this._def, minSize: { value: a2, message: aB.toString(b2) } });
        }
        max(a2, b2) {
          return new ae({ ...this._def, maxSize: { value: a2, message: aB.toString(b2) } });
        }
        size(a2, b2) {
          return this.min(a2, b2).max(a2, b2);
        }
        nonempty(a2) {
          return this.min(1, a2);
        }
      }
      ae.create = (a2, b2) => new ae({ valueType: a2, minSize: null, maxSize: null, typeName: aC.ZodSet, ...s(b2) });
      class af extends t {
        constructor() {
          super(...arguments), this.validate = this.implement;
        }
        _parse(a2) {
          let { ctx: b2 } = this._processInputParams(a2);
          if (b2.parsedType !== e.function) return k(b2, { code: g.invalid_type, expected: e.function, received: b2.parsedType }), m;
          function c2(a3, c3) {
            return j({ data: a3, path: b2.path, errorMaps: [b2.common.contextualErrorMap, b2.schemaErrorMap, i, i].filter((a4) => !!a4), issueData: { code: g.invalid_arguments, argumentsError: c3 } });
          }
          function d2(a3, c3) {
            return j({ data: a3, path: b2.path, errorMaps: [b2.common.contextualErrorMap, b2.schemaErrorMap, i, i].filter((a4) => !!a4), issueData: { code: g.invalid_return_type, returnTypeError: c3 } });
          }
          let f2 = { errorMap: b2.common.contextualErrorMap }, l2 = b2.data;
          if (this._def.returns instanceof al) {
            let a3 = this;
            return o(async function(...b3) {
              let e2 = new h([]), g2 = await a3._def.args.parseAsync(b3, f2).catch((a4) => {
                throw e2.addIssue(c2(b3, a4)), e2;
              }), i2 = await Reflect.apply(l2, this, g2);
              return await a3._def.returns._def.type.parseAsync(i2, f2).catch((a4) => {
                throw e2.addIssue(d2(i2, a4)), e2;
              });
            });
          }
          {
            let a3 = this;
            return o(function(...b3) {
              let e2 = a3._def.args.safeParse(b3, f2);
              if (!e2.success) throw new h([c2(b3, e2.error)]);
              let g2 = Reflect.apply(l2, this, e2.data), i2 = a3._def.returns.safeParse(g2, f2);
              if (!i2.success) throw new h([d2(g2, i2.error)]);
              return i2.data;
            });
          }
        }
        parameters() {
          return this._def.args;
        }
        returnType() {
          return this._def.returns;
        }
        args(...a2) {
          return new af({ ...this._def, args: ab.create(a2).rest(U.create()) });
        }
        returns(a2) {
          return new af({ ...this._def, returns: a2 });
        }
        implement(a2) {
          return this.parse(a2);
        }
        strictImplement(a2) {
          return this.parse(a2);
        }
        static create(a2, b2, c2) {
          return new af({ args: a2 || ab.create([]).rest(U.create()), returns: b2 || U.create(), typeName: aC.ZodFunction, ...s(c2) });
        }
      }
      class ag extends t {
        get schema() {
          return this._def.getter();
        }
        _parse(a2) {
          let { ctx: b2 } = this._processInputParams(a2);
          return this._def.getter()._parse({ data: b2.data, path: b2.path, parent: b2 });
        }
      }
      ag.create = (a2, b2) => new ag({ getter: a2, typeName: aC.ZodLazy, ...s(b2) });
      class ah extends t {
        _parse(a2) {
          if (a2.data !== this._def.value) {
            let b2 = this._getOrReturnCtx(a2);
            return k(b2, { received: b2.data, code: g.invalid_literal, expected: this._def.value }), m;
          }
          return { status: "valid", value: a2.data };
        }
        get value() {
          return this._def.value;
        }
      }
      function ai(a2, b2) {
        return new aj({ values: a2, typeName: aC.ZodEnum, ...s(b2) });
      }
      ah.create = (a2, b2) => new ah({ value: a2, typeName: aC.ZodLiteral, ...s(b2) });
      class aj extends t {
        _parse(a2) {
          if ("string" != typeof a2.data) {
            let b2 = this._getOrReturnCtx(a2), c2 = this._def.values;
            return k(b2, { expected: az.joinValues(c2), received: b2.parsedType, code: g.invalid_type }), m;
          }
          if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(a2.data)) {
            let b2 = this._getOrReturnCtx(a2), c2 = this._def.values;
            return k(b2, { received: b2.data, code: g.invalid_enum_value, options: c2 }), m;
          }
          return o(a2.data);
        }
        get options() {
          return this._def.values;
        }
        get enum() {
          let a2 = {};
          for (let b2 of this._def.values) a2[b2] = b2;
          return a2;
        }
        get Values() {
          let a2 = {};
          for (let b2 of this._def.values) a2[b2] = b2;
          return a2;
        }
        get Enum() {
          let a2 = {};
          for (let b2 of this._def.values) a2[b2] = b2;
          return a2;
        }
        extract(a2, b2 = this._def) {
          return aj.create(a2, { ...this._def, ...b2 });
        }
        exclude(a2, b2 = this._def) {
          return aj.create(this.options.filter((b3) => !a2.includes(b3)), { ...this._def, ...b2 });
        }
      }
      aj.create = ai;
      class ak extends t {
        _parse(a2) {
          let b2 = az.getValidEnumValues(this._def.values), c2 = this._getOrReturnCtx(a2);
          if (c2.parsedType !== e.string && c2.parsedType !== e.number) {
            let a3 = az.objectValues(b2);
            return k(c2, { expected: az.joinValues(a3), received: c2.parsedType, code: g.invalid_type }), m;
          }
          if (this._cache || (this._cache = new Set(az.getValidEnumValues(this._def.values))), !this._cache.has(a2.data)) {
            let a3 = az.objectValues(b2);
            return k(c2, { received: c2.data, code: g.invalid_enum_value, options: a3 }), m;
          }
          return o(a2.data);
        }
        get enum() {
          return this._def.values;
        }
      }
      ak.create = (a2, b2) => new ak({ values: a2, typeName: aC.ZodNativeEnum, ...s(b2) });
      class al extends t {
        unwrap() {
          return this._def.type;
        }
        _parse(a2) {
          let { ctx: b2 } = this._processInputParams(a2);
          return b2.parsedType !== e.promise && false === b2.common.async ? (k(b2, { code: g.invalid_type, expected: e.promise, received: b2.parsedType }), m) : o((b2.parsedType === e.promise ? b2.data : Promise.resolve(b2.data)).then((a3) => this._def.type.parseAsync(a3, { path: b2.path, errorMap: b2.common.contextualErrorMap })));
        }
      }
      al.create = (a2, b2) => new al({ type: a2, typeName: aC.ZodPromise, ...s(b2) });
      class am extends t {
        innerType() {
          return this._def.schema;
        }
        sourceType() {
          return this._def.schema._def.typeName === aC.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
        }
        _parse(a2) {
          let { status: b2, ctx: c2 } = this._processInputParams(a2), d2 = this._def.effect || null, e2 = { addIssue: (a3) => {
            k(c2, a3), a3.fatal ? b2.abort() : b2.dirty();
          }, get path() {
            return c2.path;
          } };
          if (e2.addIssue = e2.addIssue.bind(e2), "preprocess" === d2.type) {
            let a3 = d2.transform(c2.data, e2);
            if (c2.common.async) return Promise.resolve(a3).then(async (a4) => {
              if ("aborted" === b2.value) return m;
              let d3 = await this._def.schema._parseAsync({ data: a4, path: c2.path, parent: c2 });
              return "aborted" === d3.status ? m : "dirty" === d3.status || "dirty" === b2.value ? n(d3.value) : d3;
            });
            {
              if ("aborted" === b2.value) return m;
              let d3 = this._def.schema._parseSync({ data: a3, path: c2.path, parent: c2 });
              return "aborted" === d3.status ? m : "dirty" === d3.status || "dirty" === b2.value ? n(d3.value) : d3;
            }
          }
          if ("refinement" === d2.type) {
            let a3 = (a4) => {
              let b3 = d2.refinement(a4, e2);
              if (c2.common.async) return Promise.resolve(b3);
              if (b3 instanceof Promise) throw Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
              return a4;
            };
            if (false !== c2.common.async) return this._def.schema._parseAsync({ data: c2.data, path: c2.path, parent: c2 }).then((c3) => "aborted" === c3.status ? m : ("dirty" === c3.status && b2.dirty(), a3(c3.value).then(() => ({ status: b2.value, value: c3.value }))));
            {
              let d3 = this._def.schema._parseSync({ data: c2.data, path: c2.path, parent: c2 });
              return "aborted" === d3.status ? m : ("dirty" === d3.status && b2.dirty(), a3(d3.value), { status: b2.value, value: d3.value });
            }
          }
          if ("transform" === d2.type) if (false !== c2.common.async) return this._def.schema._parseAsync({ data: c2.data, path: c2.path, parent: c2 }).then((a3) => "valid" !== a3.status ? m : Promise.resolve(d2.transform(a3.value, e2)).then((a4) => ({ status: b2.value, value: a4 })));
          else {
            let a3 = this._def.schema._parseSync({ data: c2.data, path: c2.path, parent: c2 });
            if ("valid" !== a3.status) return m;
            let f2 = d2.transform(a3.value, e2);
            if (f2 instanceof Promise) throw Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
            return { status: b2.value, value: f2 };
          }
          az.assertNever(d2);
        }
      }
      am.create = (a2, b2, c2) => new am({ schema: a2, typeName: aC.ZodEffects, effect: b2, ...s(c2) }), am.createWithPreprocess = (a2, b2, c2) => new am({ schema: b2, effect: { type: "preprocess", transform: a2 }, typeName: aC.ZodEffects, ...s(c2) });
      class an extends t {
        _parse(a2) {
          return this._getType(a2) === e.undefined ? o(void 0) : this._def.innerType._parse(a2);
        }
        unwrap() {
          return this._def.innerType;
        }
      }
      an.create = (a2, b2) => new an({ innerType: a2, typeName: aC.ZodOptional, ...s(b2) });
      class ao extends t {
        _parse(a2) {
          return this._getType(a2) === e.null ? o(null) : this._def.innerType._parse(a2);
        }
        unwrap() {
          return this._def.innerType;
        }
      }
      ao.create = (a2, b2) => new ao({ innerType: a2, typeName: aC.ZodNullable, ...s(b2) });
      class ap extends t {
        _parse(a2) {
          let { ctx: b2 } = this._processInputParams(a2), c2 = b2.data;
          return b2.parsedType === e.undefined && (c2 = this._def.defaultValue()), this._def.innerType._parse({ data: c2, path: b2.path, parent: b2 });
        }
        removeDefault() {
          return this._def.innerType;
        }
      }
      ap.create = (a2, b2) => new ap({ innerType: a2, typeName: aC.ZodDefault, defaultValue: "function" == typeof b2.default ? b2.default : () => b2.default, ...s(b2) });
      class aq extends t {
        _parse(a2) {
          let { ctx: b2 } = this._processInputParams(a2), c2 = { ...b2, common: { ...b2.common, issues: [] } }, d2 = this._def.innerType._parse({ data: c2.data, path: c2.path, parent: { ...c2 } });
          return p(d2) ? d2.then((a3) => ({ status: "valid", value: "valid" === a3.status ? a3.value : this._def.catchValue({ get error() {
            return new h(c2.common.issues);
          }, input: c2.data }) })) : { status: "valid", value: "valid" === d2.status ? d2.value : this._def.catchValue({ get error() {
            return new h(c2.common.issues);
          }, input: c2.data }) };
        }
        removeCatch() {
          return this._def.innerType;
        }
      }
      aq.create = (a2, b2) => new aq({ innerType: a2, typeName: aC.ZodCatch, catchValue: "function" == typeof b2.catch ? b2.catch : () => b2.catch, ...s(b2) });
      class ar extends t {
        _parse(a2) {
          if (this._getType(a2) !== e.nan) {
            let b2 = this._getOrReturnCtx(a2);
            return k(b2, { code: g.invalid_type, expected: e.nan, received: b2.parsedType }), m;
          }
          return { status: "valid", value: a2.data };
        }
      }
      ar.create = (a2) => new ar({ typeName: aC.ZodNaN, ...s(a2) }), Symbol("zod_brand");
      class as extends t {
        _parse(a2) {
          let { ctx: b2 } = this._processInputParams(a2), c2 = b2.data;
          return this._def.type._parse({ data: c2, path: b2.path, parent: b2 });
        }
        unwrap() {
          return this._def.type;
        }
      }
      class at extends t {
        _parse(a2) {
          let { status: b2, ctx: c2 } = this._processInputParams(a2);
          if (c2.common.async) return (async () => {
            let a3 = await this._def.in._parseAsync({ data: c2.data, path: c2.path, parent: c2 });
            return "aborted" === a3.status ? m : "dirty" === a3.status ? (b2.dirty(), n(a3.value)) : this._def.out._parseAsync({ data: a3.value, path: c2.path, parent: c2 });
          })();
          {
            let a3 = this._def.in._parseSync({ data: c2.data, path: c2.path, parent: c2 });
            return "aborted" === a3.status ? m : "dirty" === a3.status ? (b2.dirty(), { status: "dirty", value: a3.value }) : this._def.out._parseSync({ data: a3.value, path: c2.path, parent: c2 });
          }
        }
        static create(a2, b2) {
          return new at({ in: a2, out: b2, typeName: aC.ZodPipeline });
        }
      }
      class au extends t {
        _parse(a2) {
          let b2 = this._def.innerType._parse(a2), c2 = (a3) => ("valid" === a3.status && (a3.value = Object.freeze(a3.value)), a3);
          return p(b2) ? b2.then((a3) => c2(a3)) : c2(b2);
        }
        unwrap() {
          return this._def.innerType;
        }
      }
      au.create = (a2, b2) => new au({ innerType: a2, typeName: aC.ZodReadonly, ...s(b2) }), Y.lazycreate, function(a2) {
        a2.ZodString = "ZodString", a2.ZodNumber = "ZodNumber", a2.ZodNaN = "ZodNaN", a2.ZodBigInt = "ZodBigInt", a2.ZodBoolean = "ZodBoolean", a2.ZodDate = "ZodDate", a2.ZodSymbol = "ZodSymbol", a2.ZodUndefined = "ZodUndefined", a2.ZodNull = "ZodNull", a2.ZodAny = "ZodAny", a2.ZodUnknown = "ZodUnknown", a2.ZodNever = "ZodNever", a2.ZodVoid = "ZodVoid", a2.ZodArray = "ZodArray", a2.ZodObject = "ZodObject", a2.ZodUnion = "ZodUnion", a2.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", a2.ZodIntersection = "ZodIntersection", a2.ZodTuple = "ZodTuple", a2.ZodRecord = "ZodRecord", a2.ZodMap = "ZodMap", a2.ZodSet = "ZodSet", a2.ZodFunction = "ZodFunction", a2.ZodLazy = "ZodLazy", a2.ZodLiteral = "ZodLiteral", a2.ZodEnum = "ZodEnum", a2.ZodEffects = "ZodEffects", a2.ZodNativeEnum = "ZodNativeEnum", a2.ZodOptional = "ZodOptional", a2.ZodNullable = "ZodNullable", a2.ZodDefault = "ZodDefault", a2.ZodCatch = "ZodCatch", a2.ZodPromise = "ZodPromise", a2.ZodBranded = "ZodBranded", a2.ZodPipeline = "ZodPipeline", a2.ZodReadonly = "ZodReadonly";
      }(aC || (aC = {}));
      let av = L.create;
      M.create, ar.create, N.create;
      let aw = O.create;
      P.create, Q.create, R.create, S.create, T.create, U.create, V.create, W.create;
      let ax = X.create, ay = Y.create;
      Y.strictCreate, Z.create, _.create, aa.create, ab.create, ac.create, ad.create, ae.create, af.create, ag.create, ah.create, aj.create, ak.create, al.create, am.create, an.create, ao.create, am.createWithPreprocess, at.create, c(5560);
      var az, aA, aB, aC, aD = c(7916), aE = c(903), aF = c(4688);
      let aG = (0, aD.QP)({ name: "core.assignUserAccess", module: "core", requires: "core:manage_users", label: "Conceder acesso de usu\xE1rio a uma cl\xEDnica", input: ay({ userId: av().min(1), clinicId: av().min(1), roleId: av().min(1) }), handler: async (a2) => (await (0, aE.Lf)().insert(aF.uq).values({ userId: a2.userId, clinicId: a2.clinicId, roleId: a2.roleId }).onConflictDoUpdate({ target: [aF.uq.userId, aF.uq.clinicId], set: { roleId: a2.roleId } }), { ok: true }) }), aH = (0, aD.QP)({ name: "core.createRole", module: "core", requires: "core:manage_users", label: "Criar perfil de acesso", input: ay({ clinicId: av().min(1), name: av().min(1), description: av().optional(), permissionKeys: ax(av()).default([]) }), handler: async (a2) => {
        let b2 = (0, aE.Lf)(), [c2] = await b2.insert(aF.Ot).values({ clinicId: a2.clinicId, name: a2.name, description: a2.description, isSystem: false }).returning({ id: aF.Ot.id });
        return a2.permissionKeys.length && await b2.insert(aF.dN).values(a2.permissionKeys.map((a3) => ({ roleId: c2.id, permissionKey: a3 }))), { id: c2.id };
      } });
      var aI = c(9219);
      let aJ = (0, aD.QP)({ name: "master.setModuleContract", module: "core", requires: "master:manage_modules", label: "Contratar/desativar m\xF3dulo (fornecedor)", input: ay({ moduleId: av(), enabled: aw() }), handler: async (a2) => (await (0, aE.Lf)().insert(aI.T).values({ moduleId: a2.moduleId, enabled: a2.enabled, contractedAt: /* @__PURE__ */ new Date() }).onConflictDoUpdate({ target: aI.T.moduleId, set: { enabled: a2.enabled, updatedAt: /* @__PURE__ */ new Date() } }), { ok: true }) }), aK = { id: "core", name: "N\xFAcleo", alwaysOn: true, menu: [{ moduleId: "core", permission: "core:manage_users", label: "Usu\xE1rios e acessos", path: "/dashboard/configuracoes/acessos" }], jobs: [] }, aL = [{ key: "core:view", module: "core", label: "Acessar configura\xE7\xF5es" }, { key: "core:manage_users", module: "core", label: "Gerenciar usu\xE1rios e acessos" }], aM = [aG, aH, aJ];
    }, 3090: (a, b, c) => {
      "use strict";
      c.d(b, { DV: () => k, He: () => function a2(b2, c2) {
        return Object.entries(b2).reduce((b3, [i2, j2]) => {
          if ("string" != typeof i2) return b3;
          let k2 = c2 ? [...c2, i2] : [i2];
          return (0, e.is)(j2, d.V) || (0, e.is)(j2, f.Xs) || (0, e.is)(j2, f.Xs.Aliased) || (0, e.is)(j2, g.n) ? b3.push({ path: k2, field: j2 }) : (0, e.is)(j2, h.XI) ? b3.push(...a2(j2[h.XI.Symbol.Columns], k2)) : b3.push(...a2(j2, k2)), b3;
        }, []);
      }, Ll: () => p, Lq: () => q, XJ: () => m, YD: () => n, a6: () => j, q: () => l, zN: () => o });
      var d = c(9393), e = c(242), f = c(4096), g = c(8245), h = c(2701), i = c(2926);
      function j(a2, b2, c2) {
        let i2 = {}, j2 = a2.reduce((a3, { path: j3, field: k2 }, l2) => {
          let m2;
          m2 = (0, e.is)(k2, d.V) ? k2 : (0, e.is)(k2, f.Xs) ? k2.decoder : (0, e.is)(k2, g.n) ? k2._.sql.decoder : k2.sql.decoder;
          let n2 = a3;
          for (let [a4, f2] of j3.entries()) if (a4 < j3.length - 1) f2 in n2 || (n2[f2] = {}), n2 = n2[f2];
          else {
            let a5 = b2[l2], g2 = n2[f2] = null === a5 ? null : m2.mapFromDriverValue(a5);
            if (c2 && (0, e.is)(k2, d.V) && 2 === j3.length) {
              let a6 = j3[0];
              a6 in i2 ? "string" == typeof i2[a6] && i2[a6] !== (0, h.Io)(k2.table) && (i2[a6] = false) : i2[a6] = null === g2 && (0, h.Io)(k2.table);
            }
          }
          return a3;
        }, {});
        if (c2 && Object.keys(i2).length > 0) for (let [a3, b3] of Object.entries(i2)) "string" != typeof b3 || c2[b3] || (j2[a3] = null);
        return j2;
      }
      function k(a2, b2) {
        let c2 = Object.keys(a2), d2 = Object.keys(b2);
        if (c2.length !== d2.length) return false;
        for (let [a3, b3] of c2.entries()) if (b3 !== d2[a3]) return false;
        return true;
      }
      function l(a2, b2) {
        let c2 = Object.entries(b2).filter(([, a3]) => void 0 !== a3).map(([b3, c3]) => (0, e.is)(c3, f.Xs) || (0, e.is)(c3, d.V) ? [b3, c3] : [b3, new f.Iw(c3, a2[h.XI.Symbol.Columns][b3])]);
        if (0 === c2.length) throw Error("No values to set");
        return Object.fromEntries(c2);
      }
      function m(a2, b2) {
        for (let c2 of b2) for (let b3 of Object.getOwnPropertyNames(c2.prototype)) "constructor" !== b3 && Object.defineProperty(a2.prototype, b3, Object.getOwnPropertyDescriptor(c2.prototype, b3) || /* @__PURE__ */ Object.create(null));
      }
      function n(a2) {
        return a2[h.XI.Symbol.Columns];
      }
      function o(a2) {
        return (0, e.is)(a2, g.n) ? a2._.alias : (0, e.is)(a2, f.Ss) ? a2[i.n].name : (0, e.is)(a2, f.Xs) ? void 0 : a2[h.XI.Symbol.IsAlias] ? a2[h.XI.Symbol.Name] : a2[h.XI.Symbol.BaseName];
      }
      function p(a2, b2) {
        return { name: "string" == typeof a2 && a2.length > 0 ? a2 : "", config: "object" == typeof a2 ? a2 : b2 };
      }
      function q(a2) {
        if ("object" != typeof a2 || null === a2 || "Object" !== a2.constructor.name) return false;
        if ("logger" in a2) {
          let b2 = typeof a2.logger;
          return "boolean" === b2 || "object" === b2 && "function" == typeof a2.logger.logQuery || "undefined" === b2;
        }
        if ("schema" in a2) {
          let b2 = typeof a2.schema;
          return "object" === b2 || "undefined" === b2;
        }
        if ("casing" in a2) {
          let b2 = typeof a2.casing;
          return "string" === b2 || "undefined" === b2;
        }
        if ("mode" in a2) return "default" === a2.mode && "planetscale" === a2.mode && void 0 === a2.mode;
        if ("connection" in a2) {
          let b2 = typeof a2.connection;
          return "string" === b2 || "object" === b2 || "undefined" === b2;
        }
        if ("client" in a2) {
          let b2 = typeof a2.client;
          return "object" === b2 || "function" === b2 || "undefined" === b2;
        }
        return 0 === Object.keys(a2).length;
      }
      "undefined" == typeof TextDecoder || new TextDecoder();
    }, 3193: (a, b, c) => {
      "use strict";
      c.d(b, { zM: () => h });
      var d = c(242), e = c(4080);
      class f extends e.pe {
        static [d.i] = "PgBooleanBuilder";
        constructor(a2) {
          super(a2, "boolean", "PgBoolean");
        }
        build(a2) {
          return new g(a2, this.config);
        }
      }
      class g extends e.Kl {
        static [d.i] = "PgBoolean";
        getSQLType() {
          return "boolean";
        }
      }
      function h(a2) {
        return new f(a2 ?? "");
      }
    }, 3591: (a, b, c) => {
      "use strict";
      c.d(b, { p: () => f });
      var d = c(242), e = c(4080);
      class f extends e.pe {
        static [d.i] = "PgIntColumnBaseBuilder";
        generatedAlwaysAsIdentity(a2) {
          if (a2) {
            let { name: b2, ...c2 } = a2;
            this.config.generatedIdentity = { type: "always", sequenceName: b2, sequenceOptions: c2 };
          } else this.config.generatedIdentity = { type: "always" };
          return this.config.hasDefault = true, this.config.notNull = true, this;
        }
        generatedByDefaultAsIdentity(a2) {
          if (a2) {
            let { name: b2, ...c2 } = a2;
            this.config.generatedIdentity = { type: "byDefault", sequenceName: b2, sequenceOptions: c2 };
          } else this.config.generatedIdentity = { type: "byDefault" };
          return this.config.hasDefault = true, this.config.notNull = true, this;
        }
      }
    }, 3688: (a, b, c) => {
      "use strict";
      c.d(b, { BU: () => i, rL: () => l });
      var d = c(242), e = c(4080);
      class f extends e.pe {
        static [d.i] = "PgEnumObjectColumnBuilder";
        constructor(a2, b2) {
          super(a2, "string", "PgEnumObjectColumn"), this.config.enum = b2;
        }
        build(a2) {
          return new g(a2, this.config);
        }
      }
      class g extends e.Kl {
        static [d.i] = "PgEnumObjectColumn";
        enum;
        enumValues = this.config.enum.enumValues;
        constructor(a2, b2) {
          super(a2, b2), this.enum = b2.enum;
        }
        getSQLType() {
          return this.enum.enumName;
        }
      }
      let h = Symbol.for("drizzle:isPgEnum");
      function i(a2) {
        return !!a2 && "function" == typeof a2 && h in a2 && true === a2[h];
      }
      class j extends e.pe {
        static [d.i] = "PgEnumColumnBuilder";
        constructor(a2, b2) {
          super(a2, "string", "PgEnumColumn"), this.config.enum = b2;
        }
        build(a2) {
          return new k(a2, this.config);
        }
      }
      class k extends e.Kl {
        static [d.i] = "PgEnumColumn";
        enum = this.config.enum;
        enumValues = this.config.enum.enumValues;
        constructor(a2, b2) {
          super(a2, b2), this.enum = b2.enum;
        }
        getSQLType() {
          return this.enum.enumName;
        }
      }
      function l(a2, b2) {
        return Array.isArray(b2) ? function(a3, b3, c2) {
          let d2 = Object.assign((a4) => new j(a4 ?? "", d2), { enumName: a3, enumValues: b3, schema: c2, [h]: true });
          return d2;
        }(a2, [...b2], void 0) : function(a3, b3, c2) {
          let d2 = Object.assign((a4) => new f(a4 ?? "", d2), { enumName: a3, enumValues: Object.values(b3), schema: c2, [h]: true });
          return d2;
        }(a2, b2, void 0);
      }
    }, 3825: (a, b, c) => {
      "use strict";
      c.d(b, { runAction: () => n });
      var d = c(5560), e = c(903), f = c(2693);
      let g = { debug: 0, info: 1, warn: 2, error: 3 };
      class h {
        constructor(a2 = "app", b2) {
          this.service = a2, this.config = { level: process.env.LOG_LEVEL || "info", isDevelopment: false, enableConsole: true, ...b2 };
        }
        shouldLog(a2) {
          return g[a2] >= g[this.config.level];
        }
        formatEntry(a2, b2, c2) {
          return { timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: a2, message: b2, context: c2, service: this.service };
        }
        output(a2) {
          if (!this.config.enableConsole) return;
          let b2 = this.config.isDevelopment ? `[${a2.timestamp}] [${a2.level.toUpperCase()}] [${a2.service}]` : `[${a2.level.toUpperCase()}]`, c2 = a2.context ? `${a2.message} ${JSON.stringify(a2.context)}` : a2.message;
          switch (a2.level) {
            case "debug":
              this.config.isDevelopment && console.log(b2, c2);
              break;
            case "info":
              console.log(b2, c2);
              break;
            case "warn":
              console.warn(b2, c2);
              break;
            case "error":
              console.error(b2, c2);
          }
        }
        debug(a2, b2) {
          this.shouldLog("debug") && this.output(this.formatEntry("debug", a2, b2));
        }
        info(a2, b2) {
          this.shouldLog("info") && this.output(this.formatEntry("info", a2, b2));
        }
        warn(a2, b2) {
          this.shouldLog("warn") && this.output(this.formatEntry("warn", a2, b2));
        }
        error(a2, b2, c2) {
          if (!this.shouldLog("error")) return;
          let d2 = b2 instanceof Error ? { ...c2, error: b2.message, stack: b2.stack } : { ...c2, error: b2 };
          this.output(this.formatEntry("error", a2, d2));
        }
        child(a2) {
          return new h(`${this.service}:${a2}`, this.config);
        }
      }
      let i = new h();
      i.child("api");
      let j = i.child("db");
      async function k(a2) {
        try {
          await (0, e.Lf)().insert(f.i).values({ clinicId: a2.clinicId, principalType: a2.principalType, actor: a2.actor, onBehalfOf: a2.onBehalfOf ?? null, actionName: a2.actionName, module: a2.module, inputRedacted: a2.inputRedacted, result: a2.result, errorCode: a2.errorCode ?? null });
        } catch (b2) {
          j.error("failed to write action_log", b2, { actionName: a2.actionName });
        }
      }
      function l(a2, b2) {
        if (!a2 || "object" != typeof a2) return a2;
        let c2 = { ...a2 };
        for (let a3 of b2) a3 in c2 && (c2[a3] = "[REDACTED]");
        return c2;
      }
      function m(a2, b2) {
        return { ok: false, error: { code: a2, message: b2 } };
      }
      async function n(a2, b2, c2) {
        if (!c2 || !c2.clinicId || "system" !== c2.source && !c2.user) return await k({ clinicId: c2?.clinicId ?? null, principalType: c2?.source ?? null, actor: c2?.audit?.actor ?? "unknown", onBehalfOf: c2?.audit?.onBehalfOf, actionName: a2.name, module: a2.module, inputRedacted: l(b2, a2.sensitiveFields ?? []), result: "error", errorCode: "unauthenticated" }), m("unauthenticated", "N\xE3o autenticado.");
        let e2 = { clinicId: c2.clinicId, principalType: c2.source, actor: c2.audit.actor, onBehalfOf: c2.audit.onBehalfOf, actionName: a2.name, module: a2.module, inputRedacted: l(b2, a2.sensitiveFields ?? []) }, f2 = (a3) => k({ ...e2, result: "error", errorCode: a3 });
        if (!c2.hasModule(a2.module)) return await f2("module_disabled"), m("module_disabled", "M\xF3dulo n\xE3o dispon\xEDvel.");
        if (!c2.can(a2.requires)) return await f2("forbidden"), m("forbidden", "Sem permiss\xE3o.");
        let g2 = a2.input.safeParse(b2);
        if (!g2.success) return await f2("invalid_input"), m("invalid_input", "Dados inv\xE1lidos.");
        try {
          let b3 = await a2.handler(g2.data, c2);
          return await k({ ...e2, result: "ok", errorCode: null }), { ok: true, data: b3 };
        } catch (c3) {
          let b3 = c3 instanceof d.l ? c3.code : "internal";
          return "internal" === b3 && j.error("action handler threw", c3, { action: a2.name }), await f2(b3), m(b3, c3 instanceof d.l ? c3.message : "Erro interno.");
        }
      }
      i.child("ai"), i.child("whatsapp");
    }, 3946: (a, b, c) => {
      "use strict";
      c.d(b, { Qq: () => i });
      var d = c(242), e = c(3090), f = c(4080);
      class g extends f.pe {
        static [d.i] = "PgTextBuilder";
        constructor(a2, b2) {
          super(a2, "string", "PgText"), this.config.enumValues = b2.enum;
        }
        build(a2) {
          return new h(a2, this.config);
        }
      }
      class h extends f.Kl {
        static [d.i] = "PgText";
        enumValues = this.config.enumValues;
        getSQLType() {
          return "text";
        }
      }
      function i(a2, b2 = {}) {
        let { name: c2, config: d2 } = (0, e.Ll)(a2, b2);
        return new g(c2, d2);
      }
    }, 4051: (a, b, c) => {
      "use strict";
      c.d(b, { nd: () => i });
      var d = c(242), e = c(4080), f = c(3591);
      class g extends f.p {
        static [d.i] = "PgIntegerBuilder";
        constructor(a2) {
          super(a2, "number", "PgInteger");
        }
        build(a2) {
          return new h(a2, this.config);
        }
      }
      class h extends e.Kl {
        static [d.i] = "PgInteger";
        getSQLType() {
          return "integer";
        }
        mapFromDriverValue(a2) {
          return "string" == typeof a2 ? Number.parseInt(a2) : a2;
        }
      }
      function i(a2) {
        return new g(a2 ?? "");
      }
    }, 4080: (a, b, c) => {
      "use strict";
      c.d(b, { Kl: () => q, pe: () => p });
      var d = c(242);
      class e {
        static [d.i] = "ColumnBuilder";
        config;
        constructor(a2, b2, c2) {
          this.config = { name: a2, keyAsName: "" === a2, notNull: false, default: void 0, hasDefault: false, primaryKey: false, isUnique: false, uniqueName: void 0, uniqueType: void 0, dataType: b2, columnType: c2, generated: void 0 };
        }
        $type() {
          return this;
        }
        notNull() {
          return this.config.notNull = true, this;
        }
        default(a2) {
          return this.config.default = a2, this.config.hasDefault = true, this;
        }
        $defaultFn(a2) {
          return this.config.defaultFn = a2, this.config.hasDefault = true, this;
        }
        $default = this.$defaultFn;
        $onUpdateFn(a2) {
          return this.config.onUpdateFn = a2, this.config.hasDefault = true, this;
        }
        $onUpdate = this.$onUpdateFn;
        primaryKey() {
          return this.config.primaryKey = true, this.config.notNull = true, this;
        }
        setName(a2) {
          "" === this.config.name && (this.config.name = a2);
        }
      }
      var f = c(9393), g = c(8056);
      class h {
        static [d.i] = "PgForeignKeyBuilder";
        reference;
        _onUpdate = "no action";
        _onDelete = "no action";
        constructor(a2, b2) {
          this.reference = () => {
            let { name: b3, columns: c2, foreignColumns: d2 } = a2();
            return { name: b3, columns: c2, foreignTable: d2[0].table, foreignColumns: d2 };
          }, b2 && (this._onUpdate = b2.onUpdate, this._onDelete = b2.onDelete);
        }
        onUpdate(a2) {
          return this._onUpdate = void 0 === a2 ? "no action" : a2, this;
        }
        onDelete(a2) {
          return this._onDelete = void 0 === a2 ? "no action" : a2, this;
        }
        build(a2) {
          return new i(a2, this);
        }
      }
      class i {
        constructor(a2, b2) {
          this.table = a2, this.reference = b2.reference, this.onUpdate = b2._onUpdate, this.onDelete = b2._onDelete;
        }
        static [d.i] = "PgForeignKey";
        reference;
        onUpdate;
        onDelete;
        getName() {
          let { name: a2, columns: b2, foreignColumns: c2 } = this.reference(), d2 = b2.map((a3) => a3.name), e2 = c2.map((a3) => a3.name), f2 = [this.table[g.E], ...d2, c2[0].table[g.E], ...e2];
          return a2 ?? `${f2.join("_")}_fk`;
        }
      }
      var j = c(1591);
      function k(a2, b2) {
        return `${a2[g.E]}_${b2.join("_")}_unique`;
      }
      class l {
        constructor(a2, b2) {
          this.name = b2, this.columns = a2;
        }
        static [d.i] = null;
        columns;
        nullsNotDistinctConfig = false;
        nullsNotDistinct() {
          return this.nullsNotDistinctConfig = true, this;
        }
        build(a2) {
          return new n(a2, this.columns, this.nullsNotDistinctConfig, this.name);
        }
      }
      class m {
        static [d.i] = null;
        name;
        constructor(a2) {
          this.name = a2;
        }
        on(...a2) {
          return new l(a2, this.name);
        }
      }
      class n {
        constructor(a2, b2, c2, d2) {
          this.table = a2, this.columns = b2, this.name = d2 ?? k(this.table, this.columns.map((a3) => a3.name)), this.nullsNotDistinct = c2;
        }
        static [d.i] = null;
        columns;
        name;
        nullsNotDistinct = false;
        getName() {
          return this.name;
        }
      }
      function o(a2, b2, c2) {
        for (let d2 = b2; d2 < a2.length; d2++) {
          let e2 = a2[d2];
          if ("\\" === e2) {
            d2++;
            continue;
          }
          if ('"' === e2) return [a2.slice(b2, d2).replace(/\\/g, ""), d2 + 1];
          if (!c2 && ("," === e2 || "}" === e2)) return [a2.slice(b2, d2).replace(/\\/g, ""), d2];
        }
        return [a2.slice(b2).replace(/\\/g, ""), a2.length];
      }
      class p extends e {
        foreignKeyConfigs = [];
        static [d.i] = "PgColumnBuilder";
        array(a2) {
          return new t(this.config.name, this, a2);
        }
        references(a2, b2 = {}) {
          return this.foreignKeyConfigs.push({ ref: a2, actions: b2 }), this;
        }
        unique(a2, b2) {
          return this.config.isUnique = true, this.config.uniqueName = a2, this.config.uniqueType = b2?.nulls, this;
        }
        generatedAlwaysAs(a2) {
          return this.config.generated = { as: a2, type: "always", mode: "stored" }, this;
        }
        buildForeignKeys(a2, b2) {
          return this.foreignKeyConfigs.map(({ ref: c2, actions: d2 }) => (0, j.i)((c3, d3) => {
            let e2 = new h(() => ({ columns: [a2], foreignColumns: [c3()] }));
            return d3.onUpdate && e2.onUpdate(d3.onUpdate), d3.onDelete && e2.onDelete(d3.onDelete), e2.build(b2);
          }, c2, d2));
        }
        buildExtraConfigColumn(a2) {
          return new r(a2, this.config);
        }
      }
      class q extends f.V {
        constructor(a2, b2) {
          b2.uniqueName || (b2.uniqueName = k(a2, [b2.name])), super(a2, b2), this.table = a2;
        }
        static [d.i] = "PgColumn";
      }
      class r extends q {
        static [d.i] = "ExtraConfigColumn";
        getSQLType() {
          return this.getSQLType();
        }
        indexConfig = { order: this.config.order ?? "asc", nulls: this.config.nulls ?? "last", opClass: this.config.opClass };
        defaultConfig = { order: "asc", nulls: "last", opClass: void 0 };
        asc() {
          return this.indexConfig.order = "asc", this;
        }
        desc() {
          return this.indexConfig.order = "desc", this;
        }
        nullsFirst() {
          return this.indexConfig.nulls = "first", this;
        }
        nullsLast() {
          return this.indexConfig.nulls = "last", this;
        }
        op(a2) {
          return this.indexConfig.opClass = a2, this;
        }
      }
      class s {
        static [d.i] = null;
        constructor(a2, b2, c2, d2) {
          this.name = a2, this.keyAsName = b2, this.type = c2, this.indexConfig = d2;
        }
        name;
        keyAsName;
        type;
        indexConfig;
      }
      class t extends p {
        static [d.i] = "PgArrayBuilder";
        constructor(a2, b2, c2) {
          super(a2, "array", "PgArray"), this.config.baseBuilder = b2, this.config.size = c2;
        }
        build(a2) {
          let b2 = this.config.baseBuilder.build(a2);
          return new u(a2, this.config, b2);
        }
      }
      class u extends q {
        constructor(a2, b2, c2, d2) {
          super(a2, b2), this.baseColumn = c2, this.range = d2, this.size = b2.size;
        }
        size;
        static [d.i] = "PgArray";
        getSQLType() {
          return `${this.baseColumn.getSQLType()}[${"number" == typeof this.size ? this.size : ""}]`;
        }
        mapFromDriverValue(a2) {
          return "string" == typeof a2 && (a2 = function(a3) {
            let [b2] = function a4(b3, c2 = 0) {
              let d2 = [], e2 = c2, f2 = false;
              for (; e2 < b3.length; ) {
                let g2 = b3[e2];
                if ("," === g2) {
                  (f2 || e2 === c2) && d2.push(""), f2 = true, e2++;
                  continue;
                }
                if (f2 = false, "\\" === g2) {
                  e2 += 2;
                  continue;
                }
                if ('"' === g2) {
                  let [a5, c3] = o(b3, e2 + 1, true);
                  d2.push(a5), e2 = c3;
                  continue;
                }
                if ("}" === g2) return [d2, e2 + 1];
                if ("{" === g2) {
                  let [c3, f3] = a4(b3, e2 + 1);
                  d2.push(c3), e2 = f3;
                  continue;
                }
                let [h2, i2] = o(b3, e2, false);
                d2.push(h2), e2 = i2;
              }
              return [d2, e2];
            }(a3, 1);
            return b2;
          }(a2)), a2.map((a3) => this.baseColumn.mapFromDriverValue(a3));
        }
        mapToDriverValue(a2, b2 = false) {
          let c2 = a2.map((a3) => null === a3 ? null : (0, d.is)(this.baseColumn, u) ? this.baseColumn.mapToDriverValue(a3, true) : this.baseColumn.mapToDriverValue(a3));
          return b2 ? c2 : function a3(b3) {
            return `{${b3.map((b4) => Array.isArray(b4) ? a3(b4) : "string" == typeof b4 ? `"${b4.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : `${b4}`).join(",")}}`;
          }(c2);
        }
      }
    }, 4096: (a, b, c) => {
      "use strict";
      c.d(b, { Ct: () => v, DJ: () => m, Iw: () => s, Or: () => u, Ss: () => x, Xs: () => n, eG: () => p, ll: () => t, qt: () => l });
      var d = c(242), e = c(3688), f = c(8245), g = c(1664), h = c(2926), i = c(9393), j = c(2701);
      class k {
        static [d.i] = null;
      }
      function l(a2) {
        return null != a2 && "function" == typeof a2.getSQL;
      }
      class m {
        static [d.i] = "StringChunk";
        value;
        constructor(a2) {
          this.value = Array.isArray(a2) ? a2 : [a2];
        }
        getSQL() {
          return new n([this]);
        }
      }
      class n {
        constructor(a2) {
          for (let b2 of (this.queryChunks = a2, a2)) if ((0, d.is)(b2, j.XI)) {
            let a3 = b2[j.XI.Symbol.Schema];
            this.usedTables.push(void 0 === a3 ? b2[j.XI.Symbol.Name] : a3 + "." + b2[j.XI.Symbol.Name]);
          }
        }
        static [d.i] = "SQL";
        decoder = q;
        shouldInlineParams = false;
        usedTables = [];
        append(a2) {
          return this.queryChunks.push(...a2.queryChunks), this;
        }
        toQuery(a2) {
          return g.k.startActiveSpan("drizzle.buildSQL", (b2) => {
            let c2 = this.buildQueryFromSourceParams(this.queryChunks, a2);
            return b2?.setAttributes({ "drizzle.query.text": c2.sql, "drizzle.query.params": JSON.stringify(c2.params) }), c2;
          });
        }
        buildQueryFromSourceParams(a2, b2) {
          let c2 = Object.assign({}, b2, { inlineParams: b2.inlineParams || this.shouldInlineParams, paramStartIndex: b2.paramStartIndex || { value: 0 } }), { casing: g2, escapeName: k2, escapeParam: p2, prepareTyping: q2, inlineParams: r2, paramStartIndex: t2 } = c2;
          var v2 = a2.map((a3) => {
            if ((0, d.is)(a3, m)) return { sql: a3.value.join(""), params: [] };
            if ((0, d.is)(a3, o)) return { sql: k2(a3.value), params: [] };
            if (void 0 === a3) return { sql: "", params: [] };
            if (Array.isArray(a3)) {
              let b3 = [new m("(")];
              for (let [c3, d2] of a3.entries()) b3.push(d2), c3 < a3.length - 1 && b3.push(new m(", "));
              return b3.push(new m(")")), this.buildQueryFromSourceParams(b3, c2);
            }
            if ((0, d.is)(a3, n)) return this.buildQueryFromSourceParams(a3.queryChunks, { ...c2, inlineParams: r2 || a3.shouldInlineParams });
            if ((0, d.is)(a3, j.XI)) {
              let b3 = a3[j.XI.Symbol.Schema], c3 = a3[j.XI.Symbol.Name];
              return { sql: void 0 === b3 || a3[j.HE] ? k2(c3) : k2(b3) + "." + k2(c3), params: [] };
            }
            if ((0, d.is)(a3, i.V)) {
              let c3 = g2.getColumnCasing(a3);
              if ("indexes" === b2.invokeSource) return { sql: k2(c3), params: [] };
              let d2 = a3.table[j.XI.Symbol.Schema];
              return { sql: a3.table[j.HE] || void 0 === d2 ? k2(a3.table[j.XI.Symbol.Name]) + "." + k2(c3) : k2(d2) + "." + k2(a3.table[j.XI.Symbol.Name]) + "." + k2(c3), params: [] };
            }
            if ((0, d.is)(a3, x)) {
              let b3 = a3[h.n].schema, c3 = a3[h.n].name;
              return { sql: void 0 === b3 || a3[h.n].isAlias ? k2(c3) : k2(b3) + "." + k2(c3), params: [] };
            }
            if ((0, d.is)(a3, s)) {
              if ((0, d.is)(a3.value, u)) return { sql: p2(t2.value++, a3), params: [a3], typings: ["none"] };
              let b3 = null === a3.value ? null : a3.encoder.mapToDriverValue(a3.value);
              if ((0, d.is)(b3, n)) return this.buildQueryFromSourceParams([b3], c2);
              if (r2) return { sql: this.mapInlineParam(b3, c2), params: [] };
              let e2 = ["none"];
              return q2 && (e2 = [q2(a3.encoder)]), { sql: p2(t2.value++, b3), params: [b3], typings: e2 };
            }
            return (0, d.is)(a3, u) ? { sql: p2(t2.value++, a3), params: [a3], typings: ["none"] } : (0, d.is)(a3, n.Aliased) && void 0 !== a3.fieldAlias ? { sql: k2(a3.fieldAlias), params: [] } : (0, d.is)(a3, f.n) ? a3._.isWith ? { sql: k2(a3._.alias), params: [] } : this.buildQueryFromSourceParams([new m("("), a3._.sql, new m(") "), new o(a3._.alias)], c2) : (0, e.BU)(a3) ? a3.schema ? { sql: k2(a3.schema) + "." + k2(a3.enumName), params: [] } : { sql: k2(a3.enumName), params: [] } : l(a3) ? a3.shouldOmitSQLParens?.() ? this.buildQueryFromSourceParams([a3.getSQL()], c2) : this.buildQueryFromSourceParams([new m("("), a3.getSQL(), new m(")")], c2) : r2 ? { sql: this.mapInlineParam(a3, c2), params: [] } : { sql: p2(t2.value++, a3), params: [a3], typings: ["none"] };
          });
          let w2 = { sql: "", params: [] };
          for (let a3 of v2) w2.sql += a3.sql, w2.params.push(...a3.params), a3.typings?.length && (w2.typings || (w2.typings = []), w2.typings.push(...a3.typings));
          return w2;
        }
        mapInlineParam(a2, { escapeString: b2 }) {
          if (null === a2) return "null";
          if ("number" == typeof a2 || "boolean" == typeof a2) return a2.toString();
          if ("string" == typeof a2) return b2(a2);
          if ("object" == typeof a2) {
            let c2 = a2.toString();
            return "[object Object]" === c2 ? b2(JSON.stringify(a2)) : b2(c2);
          }
          throw Error("Unexpected param value: " + a2);
        }
        getSQL() {
          return this;
        }
        as(a2) {
          return void 0 === a2 ? this : new n.Aliased(this, a2);
        }
        mapWith(a2) {
          return this.decoder = "function" == typeof a2 ? { mapFromDriverValue: a2 } : a2, this;
        }
        inlineParams() {
          return this.shouldInlineParams = true, this;
        }
        if(a2) {
          return a2 ? this : void 0;
        }
      }
      class o {
        constructor(a2) {
          this.value = a2;
        }
        static [d.i] = "Name";
        brand;
        getSQL() {
          return new n([this]);
        }
      }
      function p(a2) {
        return "object" == typeof a2 && null !== a2 && "mapToDriverValue" in a2 && "function" == typeof a2.mapToDriverValue;
      }
      let q = { mapFromDriverValue: (a2) => a2 }, r = { mapToDriverValue: (a2) => a2 };
      ({ ...q, ...r });
      class s {
        constructor(a2, b2 = r) {
          this.value = a2, this.encoder = b2;
        }
        static [d.i] = "Param";
        brand;
        getSQL() {
          return new n([this]);
        }
      }
      function t(a2, ...b2) {
        let c2 = [];
        for (let [d2, e2] of ((b2.length > 0 || a2.length > 0 && "" !== a2[0]) && c2.push(new m(a2[0])), b2.entries())) c2.push(e2, new m(a2[d2 + 1]));
        return new n(c2);
      }
      ((a2) => {
        a2.empty = function() {
          return new n([]);
        }, a2.fromList = function(a3) {
          return new n(a3);
        }, a2.raw = function(a3) {
          return new n([new m(a3)]);
        }, a2.join = function(a3, b2) {
          let c2 = [];
          for (let [d2, e2] of a3.entries()) d2 > 0 && void 0 !== b2 && c2.push(b2), c2.push(e2);
          return new n(c2);
        }, a2.identifier = function(a3) {
          return new o(a3);
        }, a2.placeholder = function(a3) {
          return new u(a3);
        }, a2.param = function(a3, b2) {
          return new s(a3, b2);
        };
      })(t || (t = {})), ((a2) => {
        class b2 {
          constructor(a3, b3) {
            this.sql = a3, this.fieldAlias = b3;
          }
          static [d.i] = "SQL.Aliased";
          isSelectionField = false;
          getSQL() {
            return this.sql;
          }
          clone() {
            return new b2(this.sql, this.fieldAlias);
          }
        }
        a2.Aliased = b2;
      })(n || (n = {}));
      class u {
        constructor(a2) {
          this.name = a2;
        }
        static [d.i] = "Placeholder";
        getSQL() {
          return new n([this]);
        }
      }
      function v(a2, b2) {
        return a2.map((a3) => {
          if ((0, d.is)(a3, u)) {
            if (!(a3.name in b2)) throw Error(`No value for placeholder "${a3.name}" was provided`);
            return b2[a3.name];
          }
          if ((0, d.is)(a3, s) && (0, d.is)(a3.value, u)) {
            if (!(a3.value.name in b2)) throw Error(`No value for placeholder "${a3.value.name}" was provided`);
            return a3.encoder.mapToDriverValue(b2[a3.value.name]);
          }
          return a3;
        });
      }
      let w = Symbol.for("drizzle:IsDrizzleView");
      class x {
        static [d.i] = "View";
        [h.n];
        [w] = true;
        constructor({ name: a2, schema: b2, selectedFields: c2, query: d2 }) {
          this[h.n] = { name: a2, originalName: a2, schema: b2, selectedFields: c2, query: d2, isExisting: !d2, isAlias: false };
        }
        getSQL() {
          return new n([this]);
        }
      }
      i.V.prototype.getSQL = function() {
        return new n([this]);
      }, j.XI.prototype.getSQL = function() {
        return new n([this]);
      }, f.n.prototype.getSQL = function() {
        return new n([this]);
      };
    }, 4612: (a, b, c) => {
      "use strict";
      c.d(b, { hv: () => g, ie: () => f });
      var d = c(242), e = c(6123);
      function f(...a2) {
        return a2[0].columns ? new g(a2[0].columns, a2[0].name) : new g(a2);
      }
      class g {
        static [d.i] = "PgPrimaryKeyBuilder";
        columns;
        name;
        constructor(a2, b2) {
          this.columns = a2, this.name = b2;
        }
        build(a2) {
          return new h(a2, this.columns, this.name);
        }
      }
      class h {
        constructor(a2, b2, c2) {
          this.table = a2, this.columns = b2, this.name = c2;
        }
        static [d.i] = "PgPrimaryKey";
        columns;
        name;
        getName() {
          return this.name ?? `${this.table[e.mu.Symbol.Name]}_${this.columns.map((a2) => a2.name).join("_")}_pk`;
        }
      }
    }, 4688: (a, b, c) => {
      "use strict";
      c.d(b, { Ot: () => k, P: () => o, dN: () => l, g8: () => n, uq: () => m });
      var d = c(6123), e = c(7238), f = c(3946), g = c(3193), h = c(7097), i = c(4612), j = c(2933);
      let k = (0, d.cJ)("roles", { id: (0, e.uR)("id").primaryKey().defaultRandom(), clinicId: (0, e.uR)("clinic_id").notNull().references(() => j.wW.id, { onDelete: "cascade" }), name: (0, f.Qq)("name").notNull(), description: (0, f.Qq)("description"), isSystem: (0, g.zM)("is_system").default(false).notNull(), createdAt: (0, h.vE)("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: (0, h.vE)("updated_at", { withTimezone: true }).defaultNow().notNull() }), l = (0, d.cJ)("role_permissions", { roleId: (0, e.uR)("role_id").notNull().references(() => k.id, { onDelete: "cascade" }), permissionKey: (0, f.Qq)("permission_key").notNull() }, (a2) => ({ pk: (0, i.ie)({ columns: [a2.roleId, a2.permissionKey] }) })), m = (0, d.cJ)("user_clinic_access", { userId: (0, e.uR)("user_id").notNull().references(() => j.VV.id, { onDelete: "cascade" }), clinicId: (0, e.uR)("clinic_id").notNull().references(() => j.wW.id, { onDelete: "cascade" }), roleId: (0, e.uR)("role_id").notNull().references(() => k.id, { onDelete: "restrict" }), createdAt: (0, h.vE)("created_at", { withTimezone: true }).defaultNow().notNull() }, (a2) => ({ pk: (0, i.ie)({ columns: [a2.userId, a2.clinicId] }) })), n = (0, d.cJ)("user_permission_overrides", { userId: (0, e.uR)("user_id").notNull().references(() => j.VV.id, { onDelete: "cascade" }), clinicId: (0, e.uR)("clinic_id").notNull().references(() => j.wW.id, { onDelete: "cascade" }), permissionKey: (0, f.Qq)("permission_key").notNull(), granted: (0, g.zM)("granted").notNull() }, (a2) => ({ pk: (0, i.ie)({ columns: [a2.userId, a2.clinicId, a2.permissionKey] }) })), o = (0, d.cJ)("permissions", { key: (0, f.Qq)("key").primaryKey(), module: (0, f.Qq)("module").notNull(), label: (0, f.Qq)("label").notNull() });
    }, 5560: (a, b, c) => {
      "use strict";
      c.d(b, { l: () => d });
      class d extends Error {
        constructor(a2, b2) {
          super(b2), this.code = a2, this.name = "ActionError";
        }
      }
    }, 6123: (a, b, c) => {
      "use strict";
      c.d(b, { mu: () => aO, cJ: () => aP });
      var d = c(242), e = c(2701), f = c(3090), g = c(4080), h = c(3591);
      class i extends h.p {
        static [d.i] = "PgBigInt53Builder";
        constructor(a2) {
          super(a2, "number", "PgBigInt53");
        }
        build(a2) {
          return new j(a2, this.config);
        }
      }
      class j extends g.Kl {
        static [d.i] = "PgBigInt53";
        getSQLType() {
          return "bigint";
        }
        mapFromDriverValue(a2) {
          return "number" == typeof a2 ? a2 : Number(a2);
        }
      }
      class k extends h.p {
        static [d.i] = "PgBigInt64Builder";
        constructor(a2) {
          super(a2, "bigint", "PgBigInt64");
        }
        build(a2) {
          return new l(a2, this.config);
        }
      }
      class l extends g.Kl {
        static [d.i] = "PgBigInt64";
        getSQLType() {
          return "bigint";
        }
        mapFromDriverValue(a2) {
          return BigInt(a2);
        }
      }
      function m(a2, b2) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return "number" === d2.mode ? new i(c2) : new k(c2);
      }
      class n extends g.pe {
        static [d.i] = "PgBigSerial53Builder";
        constructor(a2) {
          super(a2, "number", "PgBigSerial53"), this.config.hasDefault = true, this.config.notNull = true;
        }
        build(a2) {
          return new o(a2, this.config);
        }
      }
      class o extends g.Kl {
        static [d.i] = "PgBigSerial53";
        getSQLType() {
          return "bigserial";
        }
        mapFromDriverValue(a2) {
          return "number" == typeof a2 ? a2 : Number(a2);
        }
      }
      class p extends g.pe {
        static [d.i] = "PgBigSerial64Builder";
        constructor(a2) {
          super(a2, "bigint", "PgBigSerial64"), this.config.hasDefault = true;
        }
        build(a2) {
          return new q(a2, this.config);
        }
      }
      class q extends g.Kl {
        static [d.i] = "PgBigSerial64";
        getSQLType() {
          return "bigserial";
        }
        mapFromDriverValue(a2) {
          return BigInt(a2);
        }
      }
      function r(a2, b2) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return "number" === d2.mode ? new n(c2) : new p(c2);
      }
      var s = c(3193);
      class t extends g.pe {
        static [d.i] = "PgCharBuilder";
        constructor(a2, b2) {
          super(a2, "string", "PgChar"), this.config.length = b2.length, this.config.enumValues = b2.enum;
        }
        build(a2) {
          return new u(a2, this.config);
        }
      }
      class u extends g.Kl {
        static [d.i] = "PgChar";
        length = this.config.length;
        enumValues = this.config.enumValues;
        getSQLType() {
          return void 0 === this.length ? "char" : `char(${this.length})`;
        }
      }
      function v(a2, b2 = {}) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return new t(c2, d2);
      }
      class w extends g.pe {
        static [d.i] = "PgCidrBuilder";
        constructor(a2) {
          super(a2, "string", "PgCidr");
        }
        build(a2) {
          return new x(a2, this.config);
        }
      }
      class x extends g.Kl {
        static [d.i] = "PgCidr";
        getSQLType() {
          return "cidr";
        }
      }
      function y(a2) {
        return new w(a2 ?? "");
      }
      class z extends g.pe {
        static [d.i] = "PgCustomColumnBuilder";
        constructor(a2, b2, c2) {
          super(a2, "custom", "PgCustomColumn"), this.config.fieldConfig = b2, this.config.customTypeParams = c2;
        }
        build(a2) {
          return new A(a2, this.config);
        }
      }
      class A extends g.Kl {
        static [d.i] = "PgCustomColumn";
        sqlName;
        mapTo;
        mapFrom;
        constructor(a2, b2) {
          super(a2, b2), this.sqlName = b2.customTypeParams.dataType(b2.fieldConfig), this.mapTo = b2.customTypeParams.toDriver, this.mapFrom = b2.customTypeParams.fromDriver;
        }
        getSQLType() {
          return this.sqlName;
        }
        mapFromDriverValue(a2) {
          return "function" == typeof this.mapFrom ? this.mapFrom(a2) : a2;
        }
        mapToDriverValue(a2) {
          return "function" == typeof this.mapTo ? this.mapTo(a2) : a2;
        }
      }
      function B(a2) {
        return (b2, c2) => {
          let { name: d2, config: e2 } = (0, f.Ll)(b2, c2);
          return new z(d2, e2, a2);
        };
      }
      var C = c(6903);
      class D extends g.pe {
        static [d.i] = "PgDoublePrecisionBuilder";
        constructor(a2) {
          super(a2, "number", "PgDoublePrecision");
        }
        build(a2) {
          return new E(a2, this.config);
        }
      }
      class E extends g.Kl {
        static [d.i] = "PgDoublePrecision";
        getSQLType() {
          return "double precision";
        }
        mapFromDriverValue(a2) {
          return "string" == typeof a2 ? Number.parseFloat(a2) : a2;
        }
      }
      function F(a2) {
        return new D(a2 ?? "");
      }
      class G extends g.pe {
        static [d.i] = "PgInetBuilder";
        constructor(a2) {
          super(a2, "string", "PgInet");
        }
        build(a2) {
          return new H(a2, this.config);
        }
      }
      class H extends g.Kl {
        static [d.i] = "PgInet";
        getSQLType() {
          return "inet";
        }
      }
      function I(a2) {
        return new G(a2 ?? "");
      }
      var J = c(4051);
      class K extends g.pe {
        static [d.i] = "PgIntervalBuilder";
        constructor(a2, b2) {
          super(a2, "string", "PgInterval"), this.config.intervalConfig = b2;
        }
        build(a2) {
          return new L(a2, this.config);
        }
      }
      class L extends g.Kl {
        static [d.i] = "PgInterval";
        fields = this.config.intervalConfig.fields;
        precision = this.config.intervalConfig.precision;
        getSQLType() {
          let a2 = this.fields ? ` ${this.fields}` : "", b2 = this.precision ? `(${this.precision})` : "";
          return `interval${a2}${b2}`;
        }
      }
      function M(a2, b2 = {}) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return new K(c2, d2);
      }
      var N = c(9977), O = c(1457);
      class P extends g.pe {
        static [d.i] = "PgLineBuilder";
        constructor(a2) {
          super(a2, "array", "PgLine");
        }
        build(a2) {
          return new Q(a2, this.config);
        }
      }
      class Q extends g.Kl {
        static [d.i] = "PgLine";
        getSQLType() {
          return "line";
        }
        mapFromDriverValue(a2) {
          let [b2, c2, d2] = a2.slice(1, -1).split(",");
          return [Number.parseFloat(b2), Number.parseFloat(c2), Number.parseFloat(d2)];
        }
        mapToDriverValue(a2) {
          return `{${a2[0]},${a2[1]},${a2[2]}}`;
        }
      }
      class R extends g.pe {
        static [d.i] = "PgLineABCBuilder";
        constructor(a2) {
          super(a2, "json", "PgLineABC");
        }
        build(a2) {
          return new S(a2, this.config);
        }
      }
      class S extends g.Kl {
        static [d.i] = "PgLineABC";
        getSQLType() {
          return "line";
        }
        mapFromDriverValue(a2) {
          let [b2, c2, d2] = a2.slice(1, -1).split(",");
          return { a: Number.parseFloat(b2), b: Number.parseFloat(c2), c: Number.parseFloat(d2) };
        }
        mapToDriverValue(a2) {
          return `{${a2.a},${a2.b},${a2.c}}`;
        }
      }
      function T(a2, b2) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return d2?.mode && "tuple" !== d2.mode ? new R(c2) : new P(c2);
      }
      class U extends g.pe {
        static [d.i] = "PgMacaddrBuilder";
        constructor(a2) {
          super(a2, "string", "PgMacaddr");
        }
        build(a2) {
          return new V(a2, this.config);
        }
      }
      class V extends g.Kl {
        static [d.i] = "PgMacaddr";
        getSQLType() {
          return "macaddr";
        }
      }
      function W(a2) {
        return new U(a2 ?? "");
      }
      class X extends g.pe {
        static [d.i] = "PgMacaddr8Builder";
        constructor(a2) {
          super(a2, "string", "PgMacaddr8");
        }
        build(a2) {
          return new Y(a2, this.config);
        }
      }
      class Y extends g.Kl {
        static [d.i] = "PgMacaddr8";
        getSQLType() {
          return "macaddr8";
        }
      }
      function Z(a2) {
        return new X(a2 ?? "");
      }
      var $ = c(1308);
      class _ extends g.pe {
        static [d.i] = "PgPointTupleBuilder";
        constructor(a2) {
          super(a2, "array", "PgPointTuple");
        }
        build(a2) {
          return new aa(a2, this.config);
        }
      }
      class aa extends g.Kl {
        static [d.i] = "PgPointTuple";
        getSQLType() {
          return "point";
        }
        mapFromDriverValue(a2) {
          if ("string" == typeof a2) {
            let [b2, c2] = a2.slice(1, -1).split(",");
            return [Number.parseFloat(b2), Number.parseFloat(c2)];
          }
          return [a2.x, a2.y];
        }
        mapToDriverValue(a2) {
          return `(${a2[0]},${a2[1]})`;
        }
      }
      class ab extends g.pe {
        static [d.i] = "PgPointObjectBuilder";
        constructor(a2) {
          super(a2, "json", "PgPointObject");
        }
        build(a2) {
          return new ac(a2, this.config);
        }
      }
      class ac extends g.Kl {
        static [d.i] = "PgPointObject";
        getSQLType() {
          return "point";
        }
        mapFromDriverValue(a2) {
          if ("string" == typeof a2) {
            let [b2, c2] = a2.slice(1, -1).split(",");
            return { x: Number.parseFloat(b2), y: Number.parseFloat(c2) };
          }
          return a2;
        }
        mapToDriverValue(a2) {
          return `(${a2.x},${a2.y})`;
        }
      }
      function ad(a2, b2) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return d2?.mode && "tuple" !== d2.mode ? new ab(c2) : new _(c2);
      }
      function ae(a2, b2) {
        let c2 = new DataView(new ArrayBuffer(8));
        for (let d2 = 0; d2 < 8; d2++) c2.setUint8(d2, a2[b2 + d2]);
        return c2.getFloat64(0, true);
      }
      function af(a2) {
        let b2 = function(a3) {
          let b3 = [];
          for (let c3 = 0; c3 < a3.length; c3 += 2) b3.push(Number.parseInt(a3.slice(c3, c3 + 2), 16));
          return new Uint8Array(b3);
        }(a2), c2 = 0, d2 = b2[0];
        c2 += 1;
        let e2 = new DataView(b2.buffer), f2 = e2.getUint32(c2, 1 === d2);
        if (c2 += 4, 536870912 & f2 && (e2.getUint32(c2, 1 === d2), c2 += 4), (65535 & f2) == 1) {
          let a3 = ae(b2, c2), d3 = ae(b2, c2 += 8);
          return c2 += 8, [a3, d3];
        }
        throw Error("Unsupported geometry type");
      }
      class ag extends g.pe {
        static [d.i] = "PgGeometryBuilder";
        constructor(a2) {
          super(a2, "array", "PgGeometry");
        }
        build(a2) {
          return new ah(a2, this.config);
        }
      }
      class ah extends g.Kl {
        static [d.i] = "PgGeometry";
        getSQLType() {
          return "geometry(point)";
        }
        mapFromDriverValue(a2) {
          return af(a2);
        }
        mapToDriverValue(a2) {
          return `point(${a2[0]} ${a2[1]})`;
        }
      }
      class ai extends g.pe {
        static [d.i] = "PgGeometryObjectBuilder";
        constructor(a2) {
          super(a2, "json", "PgGeometryObject");
        }
        build(a2) {
          return new aj(a2, this.config);
        }
      }
      class aj extends g.Kl {
        static [d.i] = "PgGeometryObject";
        getSQLType() {
          return "geometry(point)";
        }
        mapFromDriverValue(a2) {
          let b2 = af(a2);
          return { x: b2[0], y: b2[1] };
        }
        mapToDriverValue(a2) {
          return `point(${a2.x} ${a2.y})`;
        }
      }
      function ak(a2, b2) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return d2?.mode && "tuple" !== d2.mode ? new ai(c2) : new ag(c2);
      }
      class al extends g.pe {
        static [d.i] = "PgRealBuilder";
        constructor(a2, b2) {
          super(a2, "number", "PgReal"), this.config.length = b2;
        }
        build(a2) {
          return new am(a2, this.config);
        }
      }
      class am extends g.Kl {
        static [d.i] = "PgReal";
        constructor(a2, b2) {
          super(a2, b2);
        }
        getSQLType() {
          return "real";
        }
        mapFromDriverValue = (a2) => "string" == typeof a2 ? Number.parseFloat(a2) : a2;
      }
      function an(a2) {
        return new al(a2 ?? "");
      }
      class ao extends g.pe {
        static [d.i] = "PgSerialBuilder";
        constructor(a2) {
          super(a2, "number", "PgSerial"), this.config.hasDefault = true, this.config.notNull = true;
        }
        build(a2) {
          return new ap(a2, this.config);
        }
      }
      class ap extends g.Kl {
        static [d.i] = "PgSerial";
        getSQLType() {
          return "serial";
        }
      }
      function aq(a2) {
        return new ao(a2 ?? "");
      }
      class ar extends h.p {
        static [d.i] = "PgSmallIntBuilder";
        constructor(a2) {
          super(a2, "number", "PgSmallInt");
        }
        build(a2) {
          return new as(a2, this.config);
        }
      }
      class as extends g.Kl {
        static [d.i] = "PgSmallInt";
        getSQLType() {
          return "smallint";
        }
        mapFromDriverValue = (a2) => "string" == typeof a2 ? Number(a2) : a2;
      }
      function at(a2) {
        return new ar(a2 ?? "");
      }
      class au extends g.pe {
        static [d.i] = "PgSmallSerialBuilder";
        constructor(a2) {
          super(a2, "number", "PgSmallSerial"), this.config.hasDefault = true, this.config.notNull = true;
        }
        build(a2) {
          return new av(a2, this.config);
        }
      }
      class av extends g.Kl {
        static [d.i] = "PgSmallSerial";
        getSQLType() {
          return "smallserial";
        }
      }
      function aw(a2) {
        return new au(a2 ?? "");
      }
      var ax = c(3946), ay = c(1912), az = c(7097), aA = c(7238), aB = c(7514);
      class aC extends g.pe {
        static [d.i] = "PgBinaryVectorBuilder";
        constructor(a2, b2) {
          super(a2, "string", "PgBinaryVector"), this.config.dimensions = b2.dimensions;
        }
        build(a2) {
          return new aD(a2, this.config);
        }
      }
      class aD extends g.Kl {
        static [d.i] = "PgBinaryVector";
        dimensions = this.config.dimensions;
        getSQLType() {
          return `bit(${this.dimensions})`;
        }
      }
      function aE(a2, b2) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return new aC(c2, d2);
      }
      class aF extends g.pe {
        static [d.i] = "PgHalfVectorBuilder";
        constructor(a2, b2) {
          super(a2, "array", "PgHalfVector"), this.config.dimensions = b2.dimensions;
        }
        build(a2) {
          return new aG(a2, this.config);
        }
      }
      class aG extends g.Kl {
        static [d.i] = "PgHalfVector";
        dimensions = this.config.dimensions;
        getSQLType() {
          return `halfvec(${this.dimensions})`;
        }
        mapToDriverValue(a2) {
          return JSON.stringify(a2);
        }
        mapFromDriverValue(a2) {
          return a2.slice(1, -1).split(",").map((a3) => Number.parseFloat(a3));
        }
      }
      function aH(a2, b2) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return new aF(c2, d2);
      }
      class aI extends g.pe {
        static [d.i] = "PgSparseVectorBuilder";
        constructor(a2, b2) {
          super(a2, "string", "PgSparseVector"), this.config.dimensions = b2.dimensions;
        }
        build(a2) {
          return new aJ(a2, this.config);
        }
      }
      class aJ extends g.Kl {
        static [d.i] = "PgSparseVector";
        dimensions = this.config.dimensions;
        getSQLType() {
          return `sparsevec(${this.dimensions})`;
        }
      }
      function aK(a2, b2) {
        let { name: c2, config: d2 } = (0, f.Ll)(a2, b2);
        return new aI(c2, d2);
      }
      var aL = c(9466);
      let aM = Symbol.for("drizzle:PgInlineForeignKeys"), aN = Symbol.for("drizzle:EnableRLS");
      class aO extends e.XI {
        static [d.i] = "PgTable";
        static Symbol = Object.assign({}, e.XI.Symbol, { InlineForeignKeys: aM, EnableRLS: aN });
        [aM] = [];
        [aN] = false;
        [e.XI.Symbol.ExtraConfigBuilder] = void 0;
        [e.XI.Symbol.ExtraConfigColumns] = {};
      }
      let aP = (a2, b2, c2) => function(a3, b3, c3, d2, f2 = a3) {
        let g2 = new aO(a3, d2, f2), h2 = "function" == typeof b3 ? b3({ bigint: m, bigserial: r, boolean: s.zM, char: v, cidr: y, customType: B, date: C.p6, doublePrecision: F, inet: I, integer: J.nd, interval: M, json: N.Pq, jsonb: O.Fx, line: T, macaddr: W, macaddr8: Z, numeric: $.sH, point: ad, geometry: ak, real: an, serial: aq, smallint: at, smallserial: aw, text: ax.Qq, time: ay.kB, timestamp: az.vE, uuid: aA.uR, varchar: aB.yf, bit: aE, halfvec: aH, sparsevec: aK, vector: aL.i1 }) : b3, i2 = Object.fromEntries(Object.entries(h2).map(([a4, b4]) => {
          b4.setName(a4);
          let c4 = b4.build(g2);
          return g2[aM].push(...b4.buildForeignKeys(c4, g2)), [a4, c4];
        })), j2 = Object.fromEntries(Object.entries(h2).map(([a4, b4]) => (b4.setName(a4), [a4, b4.buildExtraConfigColumn(g2)]))), k2 = Object.assign(g2, i2);
        return k2[e.XI.Symbol.Columns] = i2, k2[e.XI.Symbol.ExtraConfigColumns] = j2, c3 && (k2[aO.Symbol.ExtraConfigBuilder] = c3), Object.assign(k2, { enableRLS: () => (k2[aO.Symbol.EnableRLS] = true, k2) });
      }(a2, b2, c2, void 0);
    }, 6481: (a, b, c) => {
      "use strict";
      c.r(b), c.d(b, { getPermissionCatalog: () => g, registerAccessPermissions: () => f });
      var d = c(7916);
      let e = [];
      function f(a2) {
        e.push(...a2);
      }
      function g() {
        let a2 = /* @__PURE__ */ new Map();
        for (let b2 of (0, d.ko)()) a2.has(b2.requires) || a2.set(b2.requires, { key: b2.requires, module: b2.module, label: b2.label });
        for (let b2 of e) a2.has(b2.key) || a2.set(b2.key, b2);
        return [...a2.values()];
      }
    }, 6778: (a, b, c) => {
      "use strict";
      c.d(b, { iv: () => o, pD: () => n, DZ: () => u, _k: () => r, mm: () => p, rl: () => q, I$: () => function a2(b2, c2, d2, g2, h2 = (a3) => a3) {
        let j2 = {};
        for (let [k2, l2] of g2.entries()) if (l2.isJson) {
          let e2 = c2.relations[l2.tsKey], g3 = d2[k2], i2 = "string" == typeof g3 ? JSON.parse(g3) : g3;
          j2[l2.tsKey] = (0, f.is)(e2, n) ? i2 && a2(b2, b2[l2.relationTableTsKey], i2, l2.selection, h2) : i2.map((c3) => a2(b2, b2[l2.relationTableTsKey], c3, l2.selection, h2));
        } else {
          let a3, b3 = h2(d2[k2]), c3 = l2.field;
          a3 = (0, f.is)(c3, e.V) ? c3 : (0, f.is)(c3, i.Xs) ? c3.decoder : c3.sql.decoder, j2[l2.tsKey] = null === b3 ? null : a3.mapFromDriverValue(b3);
        }
        return j2;
      }, W0: () => t, K1: () => s });
      var d = c(2701), e = c(9393), f = c(242), g = c(4612), h = c(1582), i = c(4096);
      function j(a2) {
        return (0, i.ll)`${a2} asc`;
      }
      function k(a2) {
        return (0, i.ll)`${a2} desc`;
      }
      class l {
        constructor(a2, b2, c2) {
          this.sourceTable = a2, this.referencedTable = b2, this.relationName = c2, this.referencedTableName = b2[d.XI.Symbol.Name];
        }
        static [f.i] = "Relation";
        referencedTableName;
        fieldName;
      }
      class m {
        constructor(a2, b2) {
          this.table = a2, this.config = b2;
        }
        static [f.i] = "Relations";
      }
      class n extends l {
        constructor(a2, b2, c2, d2) {
          super(a2, b2, c2?.relationName), this.config = c2, this.isNullable = d2;
        }
        static [f.i] = "One";
        withFieldName(a2) {
          let b2 = new n(this.sourceTable, this.referencedTable, this.config, this.isNullable);
          return b2.fieldName = a2, b2;
        }
      }
      class o extends l {
        constructor(a2, b2, c2) {
          super(a2, b2, c2?.relationName), this.config = c2;
        }
        static [f.i] = "Many";
        withFieldName(a2) {
          let b2 = new o(this.sourceTable, this.referencedTable, this.config);
          return b2.fieldName = a2, b2;
        }
      }
      function p() {
        return { and: h.Uo, between: h.Tq, eq: h.eq, exists: h.t2, gt: h.gt, gte: h.RO, ilike: h.B3, inArray: h.RV, isNull: h.kZ, isNotNull: h.Pe, like: h.mj, lt: h.lt, lte: h.wJ, ne: h.ne, not: h.AU, notBetween: h.o8, notExists: h.KJ, notLike: h.RK, notIlike: h.q1, notInArray: h.KL, or: h.or, sql: i.ll };
      }
      function q() {
        return { sql: i.ll, asc: j, desc: k };
      }
      function r(a2, b2) {
        1 === Object.keys(a2).length && "default" in a2 && !(0, f.is)(a2.default, d.XI) && (a2 = a2.default);
        let c2 = {}, e2 = {}, h2 = {};
        for (let [i2, j2] of Object.entries(a2)) if ((0, f.is)(j2, d.XI)) {
          let a3 = (0, d.Lf)(j2), b3 = e2[a3];
          for (let e3 of (c2[a3] = i2, h2[i2] = { tsName: i2, dbName: j2[d.XI.Symbol.Name], schema: j2[d.XI.Symbol.Schema], columns: j2[d.XI.Symbol.Columns], relations: b3?.relations ?? {}, primaryKey: b3?.primaryKey ?? [] }, Object.values(j2[d.XI.Symbol.Columns]))) e3.primary && h2[i2].primaryKey.push(e3);
          let k2 = j2[d.XI.Symbol.ExtraConfigBuilder]?.(j2[d.XI.Symbol.ExtraConfigColumns]);
          if (k2) for (let a4 of Object.values(k2)) (0, f.is)(a4, g.hv) && h2[i2].primaryKey.push(...a4.columns);
        } else if ((0, f.is)(j2, m)) {
          let a3, f2 = (0, d.Lf)(j2.table), g2 = c2[f2];
          for (let [c3, d2] of Object.entries(j2.config(b2(j2.table)))) if (g2) {
            let b3 = h2[g2];
            b3.relations[c3] = d2, a3 && b3.primaryKey.push(...a3);
          } else f2 in e2 || (e2[f2] = { relations: {}, primaryKey: a3 }), e2[f2].relations[c3] = d2;
        }
        return { tables: h2, tableNamesMap: c2 };
      }
      function s(a2, b2) {
        return new m(a2, (a3) => Object.fromEntries(Object.entries(b2(a3)).map(([a4, b3]) => [a4, b3.withFieldName(a4)])));
      }
      function t(a2, b2, c2) {
        if ((0, f.is)(c2, n) && c2.config) return { fields: c2.config.fields, references: c2.config.references };
        let e2 = b2[(0, d.Lf)(c2.referencedTable)];
        if (!e2) throw Error(`Table "${c2.referencedTable[d.XI.Symbol.Name]}" not found in schema`);
        let g2 = a2[e2];
        if (!g2) throw Error(`Table "${e2}" not found in schema`);
        let h2 = c2.sourceTable, i2 = b2[(0, d.Lf)(h2)];
        if (!i2) throw Error(`Table "${h2[d.XI.Symbol.Name]}" not found in schema`);
        let j2 = [];
        for (let a3 of Object.values(g2.relations)) (c2.relationName && c2 !== a3 && a3.relationName === c2.relationName || !c2.relationName && a3.referencedTable === c2.sourceTable) && j2.push(a3);
        if (j2.length > 1) throw c2.relationName ? Error(`There are multiple relations with name "${c2.relationName}" in table "${e2}"`) : Error(`There are multiple relations between "${e2}" and "${c2.sourceTable[d.XI.Symbol.Name]}". Please specify relation name`);
        if (j2[0] && (0, f.is)(j2[0], n) && j2[0].config) return { fields: j2[0].config.references, references: j2[0].config.fields };
        throw Error(`There is not enough information to infer relation "${i2}.${c2.fieldName}"`);
      }
      function u(a2) {
        return { one: function(b2, c2) {
          return new n(a2, b2, c2, c2?.fields.reduce((a3, b3) => a3 && b3.notNull, true) ?? false);
        }, many: function(b2, c2) {
          return new o(a2, b2, c2);
        } };
      }
    }, 6903: (a, b, c) => {
      "use strict";
      c.d(b, { dw: () => k, p6: () => l, qw: () => i });
      var d = c(242), e = c(3090), f = c(4080), g = c(1800);
      class h extends g.u {
        static [d.i] = "PgDateBuilder";
        constructor(a2) {
          super(a2, "date", "PgDate");
        }
        build(a2) {
          return new i(a2, this.config);
        }
      }
      class i extends f.Kl {
        static [d.i] = "PgDate";
        getSQLType() {
          return "date";
        }
        mapFromDriverValue(a2) {
          return "string" == typeof a2 ? new Date(a2) : a2;
        }
        mapToDriverValue(a2) {
          return a2.toISOString();
        }
      }
      class j extends g.u {
        static [d.i] = "PgDateStringBuilder";
        constructor(a2) {
          super(a2, "string", "PgDateString");
        }
        build(a2) {
          return new k(a2, this.config);
        }
      }
      class k extends f.Kl {
        static [d.i] = "PgDateString";
        getSQLType() {
          return "date";
        }
        mapFromDriverValue(a2) {
          return "string" == typeof a2 ? a2 : a2.toISOString().slice(0, -14);
        }
      }
      function l(a2, b2) {
        let { name: c2, config: d2 } = (0, e.Ll)(a2, b2);
        return d2?.mode === "date" ? new h(c2) : new j(c2);
      }
    }, 7097: (a, b, c) => {
      "use strict";
      c.d(b, { KM: () => i, vE: () => l, xQ: () => k });
      var d = c(242), e = c(3090), f = c(4080), g = c(1800);
      class h extends g.u {
        static [d.i] = "PgTimestampBuilder";
        constructor(a2, b2, c2) {
          super(a2, "date", "PgTimestamp"), this.config.withTimezone = b2, this.config.precision = c2;
        }
        build(a2) {
          return new i(a2, this.config);
        }
      }
      class i extends f.Kl {
        static [d.i] = "PgTimestamp";
        withTimezone;
        precision;
        constructor(a2, b2) {
          super(a2, b2), this.withTimezone = b2.withTimezone, this.precision = b2.precision;
        }
        getSQLType() {
          let a2 = void 0 === this.precision ? "" : ` (${this.precision})`;
          return `timestamp${a2}${this.withTimezone ? " with time zone" : ""}`;
        }
        mapFromDriverValue(a2) {
          return "string" == typeof a2 ? new Date(this.withTimezone ? a2 : a2 + "+0000") : a2;
        }
        mapToDriverValue = (a2) => a2.toISOString();
      }
      class j extends g.u {
        static [d.i] = "PgTimestampStringBuilder";
        constructor(a2, b2, c2) {
          super(a2, "string", "PgTimestampString"), this.config.withTimezone = b2, this.config.precision = c2;
        }
        build(a2) {
          return new k(a2, this.config);
        }
      }
      class k extends f.Kl {
        static [d.i] = "PgTimestampString";
        withTimezone;
        precision;
        constructor(a2, b2) {
          super(a2, b2), this.withTimezone = b2.withTimezone, this.precision = b2.precision;
        }
        getSQLType() {
          let a2 = void 0 === this.precision ? "" : `(${this.precision})`;
          return `timestamp${a2}${this.withTimezone ? " with time zone" : ""}`;
        }
        mapFromDriverValue(a2) {
          if ("string" == typeof a2) return a2;
          let b2 = a2.toISOString().slice(0, -1).replace("T", " ");
          if (this.withTimezone) {
            let c2 = a2.getTimezoneOffset();
            return `${b2}${c2 <= 0 ? "+" : "-"}${Math.floor(Math.abs(c2) / 60).toString().padStart(2, "0")}`;
          }
          return b2;
        }
      }
      function l(a2, b2 = {}) {
        let { name: c2, config: d2 } = (0, e.Ll)(a2, b2);
        return d2?.mode === "string" ? new j(c2, d2.withTimezone ?? false, d2.precision) : new h(c2, d2?.withTimezone ?? false, d2?.precision);
      }
    }, 7238: (a, b, c) => {
      "use strict";
      c.d(b, { dL: () => h, uR: () => i });
      var d = c(242), e = c(4096), f = c(4080);
      class g extends f.pe {
        static [d.i] = "PgUUIDBuilder";
        constructor(a2) {
          super(a2, "string", "PgUUID");
        }
        defaultRandom() {
          return this.default((0, e.ll)`gen_random_uuid()`);
        }
        build(a2) {
          return new h(a2, this.config);
        }
      }
      class h extends f.Kl {
        static [d.i] = "PgUUID";
        getSQLType() {
          return "uuid";
        }
      }
      function i(a2) {
        return new g(a2 ?? "");
      }
    }, 7514: (a, b, c) => {
      "use strict";
      c.d(b, { yf: () => i });
      var d = c(242), e = c(3090), f = c(4080);
      class g extends f.pe {
        static [d.i] = "PgVarcharBuilder";
        constructor(a2, b2) {
          super(a2, "string", "PgVarchar"), this.config.length = b2.length, this.config.enumValues = b2.enum;
        }
        build(a2) {
          return new h(a2, this.config);
        }
      }
      class h extends f.Kl {
        static [d.i] = "PgVarchar";
        length = this.config.length;
        enumValues = this.config.enumValues;
        getSQLType() {
          return void 0 === this.length ? "varchar" : `varchar(${this.length})`;
        }
      }
      function i(a2, b2 = {}) {
        let { name: c2, config: d2 } = (0, e.Ll)(a2, b2);
        return new g(c2, d2);
      }
    }, 7916: (a, b, c) => {
      "use strict";
      c.d(b, { QP: () => e, Th: () => h, ko: () => g, n_: () => f });
      let d = /* @__PURE__ */ new Map();
      function e(a2) {
        return a2;
      }
      function f(a2) {
        for (let b2 of a2) {
          if (d.has(b2.name)) throw Error(`duplicate action name: ${b2.name}`);
          d.set(b2.name, b2);
        }
      }
      function g() {
        return [...d.values()];
      }
      function h(a2) {
        return d.get(a2);
      }
    }, 8056: (a, b, c) => {
      "use strict";
      c.d(b, { E: () => d });
      let d = Symbol.for("drizzle:Name");
    }, 8245: (a, b, c) => {
      "use strict";
      c.d(b, { J: () => f, n: () => e });
      var d = c(242);
      class e {
        static [d.i] = "Subquery";
        constructor(a2, b2, c2, d2 = false, e2 = []) {
          this._ = { brand: "Subquery", sql: a2, selectedFields: b2, alias: c2, isWith: d2, usedTables: e2 };
        }
      }
      class f extends e {
        static [d.i] = "WithSubquery";
      }
    }, 9219: (a, b, c) => {
      "use strict";
      c.d(b, { T: () => h });
      var d = c(6123), e = c(3946), f = c(3193), g = c(7097);
      let h = (0, d.cJ)("instance_modules", { moduleId: (0, e.Qq)("module_id").primaryKey(), enabled: (0, f.zM)("enabled").default(false).notNull(), contractedAt: (0, g.vE)("contracted_at", { withTimezone: true }), updatedAt: (0, g.vE)("updated_at", { withTimezone: true }).defaultNow().notNull() });
    }, 9393: (a, b, c) => {
      "use strict";
      c.d(b, { V: () => e });
      var d = c(242);
      class e {
        constructor(a2, b2) {
          this.table = a2, this.config = b2, this.name = b2.name, this.keyAsName = b2.keyAsName, this.notNull = b2.notNull, this.default = b2.default, this.defaultFn = b2.defaultFn, this.onUpdateFn = b2.onUpdateFn, this.hasDefault = b2.hasDefault, this.primary = b2.primaryKey, this.isUnique = b2.isUnique, this.uniqueName = b2.uniqueName, this.uniqueType = b2.uniqueType, this.dataType = b2.dataType, this.columnType = b2.columnType, this.generated = b2.generated, this.generatedIdentity = b2.generatedIdentity;
        }
        static [d.i] = "Column";
        name;
        keyAsName;
        primary;
        notNull;
        default;
        defaultFn;
        onUpdateFn;
        hasDefault;
        isUnique;
        uniqueName;
        uniqueType;
        dataType;
        columnType;
        enumValues = void 0;
        generated = void 0;
        generatedIdentity = void 0;
        config;
        mapFromDriverValue(a2) {
          return a2;
        }
        mapToDriverValue(a2) {
          return a2;
        }
        shouldDisableInsert() {
          return void 0 !== this.config.generated && "byDefault" !== this.config.generated.type;
        }
      }
    }, 9466: (a, b, c) => {
      "use strict";
      c.d(b, { i1: () => i });
      var d = c(242), e = c(3090), f = c(4080);
      class g extends f.pe {
        static [d.i] = "PgVectorBuilder";
        constructor(a2, b2) {
          super(a2, "array", "PgVector"), this.config.dimensions = b2.dimensions;
        }
        build(a2) {
          return new h(a2, this.config);
        }
      }
      class h extends f.Kl {
        static [d.i] = "PgVector";
        dimensions = this.config.dimensions;
        getSQLType() {
          return `vector(${this.dimensions})`;
        }
        mapToDriverValue(a2) {
          return JSON.stringify(a2);
        }
        mapFromDriverValue(a2) {
          return a2.slice(1, -1).split(",").map((a3) => Number.parseFloat(a3));
        }
      }
      function i(a2, b2) {
        let { name: c2, config: d2 } = (0, e.Ll)(a2, b2);
        return new g(c2, d2);
      }
    }, 9977: (a, b, c) => {
      "use strict";
      c.d(b, { Pq: () => h, iX: () => g });
      var d = c(242), e = c(4080);
      class f extends e.pe {
        static [d.i] = "PgJsonBuilder";
        constructor(a2) {
          super(a2, "json", "PgJson");
        }
        build(a2) {
          return new g(a2, this.config);
        }
      }
      class g extends e.Kl {
        static [d.i] = "PgJson";
        constructor(a2, b2) {
          super(a2, b2);
        }
        getSQLType() {
          return "json";
        }
        mapToDriverValue(a2) {
          return JSON.stringify(a2);
        }
        mapFromDriverValue(a2) {
          if ("string" == typeof a2) try {
            return JSON.parse(a2);
          } catch {
          }
          return a2;
        }
      }
      function h(a2) {
        return new f(a2 ?? "");
      }
    } }, (a) => {
      var b = a(a.s = 2187);
      (_ENTRIES = "undefined" == typeof _ENTRIES ? {} : _ENTRIES).middleware_instrumentation = b;
    }]);
  }
});

// .next/server/edge-runtime-webpack.js
var require_edge_runtime_webpack = __commonJS({
  ".next/server/edge-runtime-webpack.js"() {
    "use strict";
    (() => {
      "use strict";
      var a = {}, b = {};
      function c(d) {
        var e = b[d];
        if (void 0 !== e) return e.exports;
        var f = b[d] = { exports: {} }, g = true;
        try {
          a[d](f, f.exports, c), g = false;
        } finally {
          g && delete b[d];
        }
        return f.exports;
      }
      c.m = a, c.amdO = {}, (() => {
        var a2 = [];
        c.O = (b2, d, e, f) => {
          if (d) {
            f = f || 0;
            for (var g = a2.length; g > 0 && a2[g - 1][2] > f; g--) a2[g] = a2[g - 1];
            a2[g] = [d, e, f];
            return;
          }
          for (var h = 1 / 0, g = 0; g < a2.length; g++) {
            for (var [d, e, f] = a2[g], i = true, j = 0; j < d.length; j++) (false & f || h >= f) && Object.keys(c.O).every((a3) => c.O[a3](d[j])) ? d.splice(j--, 1) : (i = false, f < h && (h = f));
            if (i) {
              a2.splice(g--, 1);
              var k = e();
              void 0 !== k && (b2 = k);
            }
          }
          return b2;
        };
      })(), c.n = (a2) => {
        var b2 = a2 && a2.__esModule ? () => a2.default : () => a2;
        return c.d(b2, { a: b2 }), b2;
      }, c.d = (a2, b2) => {
        for (var d in b2) c.o(b2, d) && !c.o(a2, d) && Object.defineProperty(a2, d, { enumerable: true, get: b2[d] });
      }, c.g = function() {
        if ("object" == typeof globalThis) return globalThis;
        try {
          return this || Function("return this")();
        } catch (a2) {
          if ("object" == typeof window) return window;
        }
      }(), c.o = (a2, b2) => Object.prototype.hasOwnProperty.call(a2, b2), c.r = (a2) => {
        "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(a2, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(a2, "__esModule", { value: true });
      }, (() => {
        var a2 = { 149: 0 };
        c.O.j = (b3) => 0 === a2[b3];
        var b2 = (b3, d2) => {
          var e, f, [g, h, i] = d2, j = 0;
          if (g.some((b4) => 0 !== a2[b4])) {
            for (e in h) c.o(h, e) && (c.m[e] = h[e]);
            if (i) var k = i(c);
          }
          for (b3 && b3(d2); j < g.length; j++) f = g[j], c.o(a2, f) && a2[f] && a2[f][0](), a2[f] = 0;
          return c.O(k);
        }, d = self.webpackChunk_N_E = self.webpackChunk_N_E || [];
        d.forEach(b2.bind(null, 0)), d.push = b2.bind(null, d.push.bind(d));
      })();
    })();
  }
});

// node-built-in-modules:node:buffer
var node_buffer_exports = {};
import * as node_buffer_star from "node:buffer";
var init_node_buffer = __esm({
  "node-built-in-modules:node:buffer"() {
    __reExport(node_buffer_exports, node_buffer_star);
  }
});

// node-built-in-modules:node:async_hooks
var node_async_hooks_exports = {};
import * as node_async_hooks_star from "node:async_hooks";
var init_node_async_hooks = __esm({
  "node-built-in-modules:node:async_hooks"() {
    __reExport(node_async_hooks_exports, node_async_hooks_star);
  }
});

// .next/server/src/middleware.js
var require_middleware = __commonJS({
  ".next/server/src/middleware.js"() {
    "use strict";
    (self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([[550], { 1213: (a) => {
      (() => {
        "use strict";
        var b = { 993: (a2) => {
          var b2 = Object.prototype.hasOwnProperty, c2 = "~";
          function d2() {
          }
          function e2(a3, b3, c3) {
            this.fn = a3, this.context = b3, this.once = c3 || false;
          }
          function f(a3, b3, d3, f2, g2) {
            if ("function" != typeof d3) throw TypeError("The listener must be a function");
            var h2 = new e2(d3, f2 || a3, g2), i = c2 ? c2 + b3 : b3;
            return a3._events[i] ? a3._events[i].fn ? a3._events[i] = [a3._events[i], h2] : a3._events[i].push(h2) : (a3._events[i] = h2, a3._eventsCount++), a3;
          }
          function g(a3, b3) {
            0 == --a3._eventsCount ? a3._events = new d2() : delete a3._events[b3];
          }
          function h() {
            this._events = new d2(), this._eventsCount = 0;
          }
          Object.create && (d2.prototype = /* @__PURE__ */ Object.create(null), new d2().__proto__ || (c2 = false)), h.prototype.eventNames = function() {
            var a3, d3, e3 = [];
            if (0 === this._eventsCount) return e3;
            for (d3 in a3 = this._events) b2.call(a3, d3) && e3.push(c2 ? d3.slice(1) : d3);
            return Object.getOwnPropertySymbols ? e3.concat(Object.getOwnPropertySymbols(a3)) : e3;
          }, h.prototype.listeners = function(a3) {
            var b3 = c2 ? c2 + a3 : a3, d3 = this._events[b3];
            if (!d3) return [];
            if (d3.fn) return [d3.fn];
            for (var e3 = 0, f2 = d3.length, g2 = Array(f2); e3 < f2; e3++) g2[e3] = d3[e3].fn;
            return g2;
          }, h.prototype.listenerCount = function(a3) {
            var b3 = c2 ? c2 + a3 : a3, d3 = this._events[b3];
            return d3 ? d3.fn ? 1 : d3.length : 0;
          }, h.prototype.emit = function(a3, b3, d3, e3, f2, g2) {
            var h2 = c2 ? c2 + a3 : a3;
            if (!this._events[h2]) return false;
            var i, j, k = this._events[h2], l = arguments.length;
            if (k.fn) {
              switch (k.once && this.removeListener(a3, k.fn, void 0, true), l) {
                case 1:
                  return k.fn.call(k.context), true;
                case 2:
                  return k.fn.call(k.context, b3), true;
                case 3:
                  return k.fn.call(k.context, b3, d3), true;
                case 4:
                  return k.fn.call(k.context, b3, d3, e3), true;
                case 5:
                  return k.fn.call(k.context, b3, d3, e3, f2), true;
                case 6:
                  return k.fn.call(k.context, b3, d3, e3, f2, g2), true;
              }
              for (j = 1, i = Array(l - 1); j < l; j++) i[j - 1] = arguments[j];
              k.fn.apply(k.context, i);
            } else {
              var m, n = k.length;
              for (j = 0; j < n; j++) switch (k[j].once && this.removeListener(a3, k[j].fn, void 0, true), l) {
                case 1:
                  k[j].fn.call(k[j].context);
                  break;
                case 2:
                  k[j].fn.call(k[j].context, b3);
                  break;
                case 3:
                  k[j].fn.call(k[j].context, b3, d3);
                  break;
                case 4:
                  k[j].fn.call(k[j].context, b3, d3, e3);
                  break;
                default:
                  if (!i) for (m = 1, i = Array(l - 1); m < l; m++) i[m - 1] = arguments[m];
                  k[j].fn.apply(k[j].context, i);
              }
            }
            return true;
          }, h.prototype.on = function(a3, b3, c3) {
            return f(this, a3, b3, c3, false);
          }, h.prototype.once = function(a3, b3, c3) {
            return f(this, a3, b3, c3, true);
          }, h.prototype.removeListener = function(a3, b3, d3, e3) {
            var f2 = c2 ? c2 + a3 : a3;
            if (!this._events[f2]) return this;
            if (!b3) return g(this, f2), this;
            var h2 = this._events[f2];
            if (h2.fn) h2.fn !== b3 || e3 && !h2.once || d3 && h2.context !== d3 || g(this, f2);
            else {
              for (var i = 0, j = [], k = h2.length; i < k; i++) (h2[i].fn !== b3 || e3 && !h2[i].once || d3 && h2[i].context !== d3) && j.push(h2[i]);
              j.length ? this._events[f2] = 1 === j.length ? j[0] : j : g(this, f2);
            }
            return this;
          }, h.prototype.removeAllListeners = function(a3) {
            var b3;
            return a3 ? (b3 = c2 ? c2 + a3 : a3, this._events[b3] && g(this, b3)) : (this._events = new d2(), this._eventsCount = 0), this;
          }, h.prototype.off = h.prototype.removeListener, h.prototype.addListener = h.prototype.on, h.prefixed = c2, h.EventEmitter = h, a2.exports = h;
        }, 213: (a2) => {
          a2.exports = (a3, b2) => (b2 = b2 || (() => {
          }), a3.then((a4) => new Promise((a5) => {
            a5(b2());
          }).then(() => a4), (a4) => new Promise((a5) => {
            a5(b2());
          }).then(() => {
            throw a4;
          })));
        }, 574: (a2, b2) => {
          Object.defineProperty(b2, "__esModule", { value: true }), b2.default = function(a3, b3, c2) {
            let d2 = 0, e2 = a3.length;
            for (; e2 > 0; ) {
              let f = e2 / 2 | 0, g = d2 + f;
              0 >= c2(a3[g], b3) ? (d2 = ++g, e2 -= f + 1) : e2 = f;
            }
            return d2;
          };
        }, 821: (a2, b2, c2) => {
          Object.defineProperty(b2, "__esModule", { value: true });
          let d2 = c2(574);
          class e2 {
            constructor() {
              this._queue = [];
            }
            enqueue(a3, b3) {
              let c3 = { priority: (b3 = Object.assign({ priority: 0 }, b3)).priority, run: a3 };
              if (this.size && this._queue[this.size - 1].priority >= b3.priority) return void this._queue.push(c3);
              let e3 = d2.default(this._queue, c3, (a4, b4) => b4.priority - a4.priority);
              this._queue.splice(e3, 0, c3);
            }
            dequeue() {
              let a3 = this._queue.shift();
              return null == a3 ? void 0 : a3.run;
            }
            filter(a3) {
              return this._queue.filter((b3) => b3.priority === a3.priority).map((a4) => a4.run);
            }
            get size() {
              return this._queue.length;
            }
          }
          b2.default = e2;
        }, 816: (a2, b2, c2) => {
          let d2 = c2(213);
          class e2 extends Error {
            constructor(a3) {
              super(a3), this.name = "TimeoutError";
            }
          }
          let f = (a3, b3, c3) => new Promise((f2, g) => {
            if ("number" != typeof b3 || b3 < 0) throw TypeError("Expected `milliseconds` to be a positive number");
            if (b3 === 1 / 0) return void f2(a3);
            let h = setTimeout(() => {
              if ("function" == typeof c3) {
                try {
                  f2(c3());
                } catch (a4) {
                  g(a4);
                }
                return;
              }
              let d3 = "string" == typeof c3 ? c3 : `Promise timed out after ${b3} milliseconds`, h2 = c3 instanceof Error ? c3 : new e2(d3);
              "function" == typeof a3.cancel && a3.cancel(), g(h2);
            }, b3);
            d2(a3.then(f2, g), () => {
              clearTimeout(h);
            });
          });
          a2.exports = f, a2.exports.default = f, a2.exports.TimeoutError = e2;
        } }, c = {};
        function d(a2) {
          var e2 = c[a2];
          if (void 0 !== e2) return e2.exports;
          var f = c[a2] = { exports: {} }, g = true;
          try {
            b[a2](f, f.exports, d), g = false;
          } finally {
            g && delete c[a2];
          }
          return f.exports;
        }
        d.ab = "//";
        var e = {};
        (() => {
          Object.defineProperty(e, "__esModule", { value: true });
          let a2 = d(993), b2 = d(816), c2 = d(821), f = () => {
          }, g = new b2.TimeoutError();
          class h extends a2 {
            constructor(a3) {
              var b3, d2, e2, g2;
              if (super(), this._intervalCount = 0, this._intervalEnd = 0, this._pendingCount = 0, this._resolveEmpty = f, this._resolveIdle = f, !("number" == typeof (a3 = Object.assign({ carryoverConcurrencyCount: false, intervalCap: 1 / 0, interval: 0, concurrency: 1 / 0, autoStart: true, queueClass: c2.default }, a3)).intervalCap && a3.intervalCap >= 1)) throw TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${null != (d2 = null == (b3 = a3.intervalCap) ? void 0 : b3.toString()) ? d2 : ""}\` (${typeof a3.intervalCap})`);
              if (void 0 === a3.interval || !(Number.isFinite(a3.interval) && a3.interval >= 0)) throw TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${null != (g2 = null == (e2 = a3.interval) ? void 0 : e2.toString()) ? g2 : ""}\` (${typeof a3.interval})`);
              this._carryoverConcurrencyCount = a3.carryoverConcurrencyCount, this._isIntervalIgnored = a3.intervalCap === 1 / 0 || 0 === a3.interval, this._intervalCap = a3.intervalCap, this._interval = a3.interval, this._queue = new a3.queueClass(), this._queueClass = a3.queueClass, this.concurrency = a3.concurrency, this._timeout = a3.timeout, this._throwOnTimeout = true === a3.throwOnTimeout, this._isPaused = false === a3.autoStart;
            }
            get _doesIntervalAllowAnother() {
              return this._isIntervalIgnored || this._intervalCount < this._intervalCap;
            }
            get _doesConcurrentAllowAnother() {
              return this._pendingCount < this._concurrency;
            }
            _next() {
              this._pendingCount--, this._tryToStartAnother(), this.emit("next");
            }
            _resolvePromises() {
              this._resolveEmpty(), this._resolveEmpty = f, 0 === this._pendingCount && (this._resolveIdle(), this._resolveIdle = f, this.emit("idle"));
            }
            _onResumeInterval() {
              this._onInterval(), this._initializeIntervalIfNeeded(), this._timeoutId = void 0;
            }
            _isIntervalPaused() {
              let a3 = Date.now();
              if (void 0 === this._intervalId) {
                let b3 = this._intervalEnd - a3;
                if (!(b3 < 0)) return void 0 === this._timeoutId && (this._timeoutId = setTimeout(() => {
                  this._onResumeInterval();
                }, b3)), true;
                this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0;
              }
              return false;
            }
            _tryToStartAnother() {
              if (0 === this._queue.size) return this._intervalId && clearInterval(this._intervalId), this._intervalId = void 0, this._resolvePromises(), false;
              if (!this._isPaused) {
                let a3 = !this._isIntervalPaused();
                if (this._doesIntervalAllowAnother && this._doesConcurrentAllowAnother) {
                  let b3 = this._queue.dequeue();
                  return !!b3 && (this.emit("active"), b3(), a3 && this._initializeIntervalIfNeeded(), true);
                }
              }
              return false;
            }
            _initializeIntervalIfNeeded() {
              this._isIntervalIgnored || void 0 !== this._intervalId || (this._intervalId = setInterval(() => {
                this._onInterval();
              }, this._interval), this._intervalEnd = Date.now() + this._interval);
            }
            _onInterval() {
              0 === this._intervalCount && 0 === this._pendingCount && this._intervalId && (clearInterval(this._intervalId), this._intervalId = void 0), this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0, this._processQueue();
            }
            _processQueue() {
              for (; this._tryToStartAnother(); ) ;
            }
            get concurrency() {
              return this._concurrency;
            }
            set concurrency(a3) {
              if (!("number" == typeof a3 && a3 >= 1)) throw TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${a3}\` (${typeof a3})`);
              this._concurrency = a3, this._processQueue();
            }
            async add(a3, c3 = {}) {
              return new Promise((d2, e2) => {
                let f2 = async () => {
                  this._pendingCount++, this._intervalCount++;
                  try {
                    let f3 = void 0 === this._timeout && void 0 === c3.timeout ? a3() : b2.default(Promise.resolve(a3()), void 0 === c3.timeout ? this._timeout : c3.timeout, () => {
                      (void 0 === c3.throwOnTimeout ? this._throwOnTimeout : c3.throwOnTimeout) && e2(g);
                    });
                    d2(await f3);
                  } catch (a4) {
                    e2(a4);
                  }
                  this._next();
                };
                this._queue.enqueue(f2, c3), this._tryToStartAnother(), this.emit("add");
              });
            }
            async addAll(a3, b3) {
              return Promise.all(a3.map(async (a4) => this.add(a4, b3)));
            }
            start() {
              return this._isPaused && (this._isPaused = false, this._processQueue()), this;
            }
            pause() {
              this._isPaused = true;
            }
            clear() {
              this._queue = new this._queueClass();
            }
            async onEmpty() {
              if (0 !== this._queue.size) return new Promise((a3) => {
                let b3 = this._resolveEmpty;
                this._resolveEmpty = () => {
                  b3(), a3();
                };
              });
            }
            async onIdle() {
              if (0 !== this._pendingCount || 0 !== this._queue.size) return new Promise((a3) => {
                let b3 = this._resolveIdle;
                this._resolveIdle = () => {
                  b3(), a3();
                };
              });
            }
            get size() {
              return this._queue.size;
            }
            sizeBy(a3) {
              return this._queue.filter(a3).length;
            }
            get pending() {
              return this._pendingCount;
            }
            get isPaused() {
              return this._isPaused;
            }
            get timeout() {
              return this._timeout;
            }
            set timeout(a3) {
              this._timeout = a3;
            }
          }
          e.default = h;
        })(), a.exports = e;
      })();
    }, 1345: (a, b) => {
      "use strict";
      Object.defineProperty(b, "__esModule", { value: true });
    }, 1426: (a, b, c) => {
      "use strict";
      var d = c(6522);
      Object.defineProperty(b, "__esModule", { value: true });
      var e = { encode: true, decode: true, getToken: true };
      b.decode = l, b.encode = k, b.getToken = m;
      var f = c(2743), g = d(c(6153)), h = c(2258), i = c(1674), j = c(1345);
      async function k(a2) {
        let { token: b2 = {}, secret: c2, maxAge: d2 = 2592e3, salt: e2 = "" } = a2, g2 = await n(c2, e2);
        return await new f.EncryptJWT(b2).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime((Date.now() / 1e3 | 0) + d2).setJti((0, h.v4)()).encrypt(g2);
      }
      async function l(a2) {
        let { token: b2, secret: c2, salt: d2 = "" } = a2;
        if (!b2) return null;
        let e2 = await n(c2, d2), { payload: g2 } = await (0, f.jwtDecrypt)(b2, e2, { clockTolerance: 15 });
        return g2;
      }
      async function m(a2) {
        var b2, c2, d2, e2;
        let { req: f2, secureCookie: g2 = null != (b2 = null == (c2 = process.env.NEXTAUTH_URL) ? void 0 : c2.startsWith("https://")) ? b2 : !!process.env.VERCEL, cookieName: h2 = g2 ? "__Secure-next-auth.session-token" : "next-auth.session-token", raw: j2, decode: k2 = l, logger: m2 = console, secret: n2 = null != (d2 = process.env.NEXTAUTH_SECRET) ? d2 : process.env.AUTH_SECRET } = a2;
        if (!f2) throw Error("Must pass `req` to JWT getToken()");
        let o = new i.SessionStore({ name: h2, options: { secure: g2 } }, { cookies: f2.cookies, headers: f2.headers }, m2).value, p = f2.headers instanceof Headers ? f2.headers.get("authorization") : null == (e2 = f2.headers) ? void 0 : e2.authorization;
        if (o || (null == p ? void 0 : p.split(" ")[0]) !== "Bearer" || (o = decodeURIComponent(p.split(" ")[1])), !o) return null;
        if (j2) return o;
        try {
          return await k2({ token: o, secret: n2 });
        } catch (a3) {
          return null;
        }
      }
      async function n(a2, b2) {
        return await (0, g.default)("sha256", a2, b2, `NextAuth.js Generated Encryption Key${b2 ? ` (${b2})` : ""}`, 32);
      }
      Object.keys(j).forEach(function(a2) {
        !("default" === a2 || "__esModule" === a2 || Object.prototype.hasOwnProperty.call(e, a2)) && (a2 in b && b[a2] === j[a2] || Object.defineProperty(b, a2, { enumerable: true, get: function() {
          return j[a2];
        } }));
      });
    }, 1674: (a, b) => {
      "use strict";
      function c(a2, b2, c2) {
        d(a2, b2), b2.set(a2, c2);
      }
      function d(a2, b2) {
        if (b2.has(a2)) throw TypeError("Cannot initialize the same private elements twice on an object");
      }
      function e(a2, b2) {
        return a2.get(g(a2, b2));
      }
      function f(a2, b2, c2) {
        return a2.set(g(a2, b2), c2), c2;
      }
      function g(a2, b2, c2) {
        if ("function" == typeof a2 ? a2 === b2 : a2.has(b2)) return arguments.length < 3 ? b2 : c2;
        throw TypeError("Private element is not present on this object");
      }
      Object.defineProperty(b, "__esModule", { value: true }), b.SessionStore = void 0, b.defaultCookies = function(a2) {
        let b2 = a2 ? "__Secure-" : "";
        return { sessionToken: { name: `${b2}next-auth.session-token`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: a2 } }, callbackUrl: { name: `${b2}next-auth.callback-url`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: a2 } }, csrfToken: { name: `${a2 ? "__Host-" : ""}next-auth.csrf-token`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: a2 } }, pkceCodeVerifier: { name: `${b2}next-auth.pkce.code_verifier`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: a2, maxAge: 900 } }, state: { name: `${b2}next-auth.state`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: a2, maxAge: 900 } }, nonce: { name: `${b2}next-auth.nonce`, options: { httpOnly: true, sameSite: "lax", path: "/", secure: a2 } } };
      };
      var h = /* @__PURE__ */ new WeakMap(), i = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap(), k = /* @__PURE__ */ new WeakSet();
      class l {
        constructor(a2, b2, g2) {
          !function(a3, b3) {
            d(a3, b3), b3.add(a3);
          }(this, k), c(this, h, {}), c(this, i, void 0), c(this, j, void 0), f(j, this, g2), f(i, this, a2);
          let { cookies: l2 } = b2, { name: m2 } = a2;
          if ("function" == typeof (null == l2 ? void 0 : l2.getAll)) for (let { name: a3, value: b3 } of l2.getAll()) a3.startsWith(m2) && (e(h, this)[a3] = b3);
          else if (l2 instanceof Map) for (let a3 of l2.keys()) a3.startsWith(m2) && (e(h, this)[a3] = l2.get(a3));
          else for (let a3 in l2) a3.startsWith(m2) && (e(h, this)[a3] = l2[a3]);
        }
        get value() {
          return Object.keys(e(h, this)).sort((a2, b2) => {
            var c2, d2;
            return parseInt(null != (c2 = a2.split(".").pop()) ? c2 : "0") - parseInt(null != (d2 = b2.split(".").pop()) ? d2 : "0");
          }).map((a2) => e(h, this)[a2]).join("");
        }
        chunk(a2, b2) {
          let c2 = g(k, this, n).call(this);
          for (let d2 of g(k, this, m).call(this, { name: e(i, this).name, value: a2, options: { ...e(i, this).options, ...b2 } })) c2[d2.name] = d2;
          return Object.values(c2);
        }
        clean() {
          return Object.values(g(k, this, n).call(this));
        }
      }
      function m(a2) {
        let b2 = Math.ceil(a2.value.length / 3933);
        if (1 === b2) return e(h, this)[a2.name] = a2.value, [a2];
        let c2 = [];
        for (let d2 = 0; d2 < b2; d2++) {
          let b3 = `${a2.name}.${d2}`, f2 = a2.value.substr(3933 * d2, 3933);
          c2.push({ ...a2, name: b3, value: f2 }), e(h, this)[b3] = f2;
        }
        return e(j, this).debug("CHUNKING_SESSION_COOKIE", { message: "Session cookie exceeds allowed 4096 bytes.", emptyCookieSize: 163, valueSize: a2.value.length, chunks: c2.map((a3) => a3.value.length + 163) }), c2;
      }
      function n() {
        let a2 = {};
        for (let c2 in e(h, this)) {
          var b2;
          null == (b2 = e(h, this)) || delete b2[c2], a2[c2] = { name: c2, value: "", options: { ...e(i, this).options, maxAge: 0 } };
        }
        return a2;
      }
      b.SessionStore = l;
    }, 2258: (a, b, c) => {
      "use strict";
      c.r(b), c.d(b, { NIL: () => D, parse: () => q, stringify: () => m, v1: () => p, v3: () => z, v4: () => A, v5: () => C, validate: () => j, version: () => E });
      var d, e, f, g = new Uint8Array(16);
      function h() {
        if (!d && !(d = "undefined" != typeof crypto && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || "undefined" != typeof msCrypto && "function" == typeof msCrypto.getRandomValues && msCrypto.getRandomValues.bind(msCrypto))) throw Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
        return d(g);
      }
      let i = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i, j = function(a2) {
        return "string" == typeof a2 && i.test(a2);
      };
      for (var k = [], l = 0; l < 256; ++l) k.push((l + 256).toString(16).substr(1));
      let m = function(a2) {
        var b2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, c2 = (k[a2[b2 + 0]] + k[a2[b2 + 1]] + k[a2[b2 + 2]] + k[a2[b2 + 3]] + "-" + k[a2[b2 + 4]] + k[a2[b2 + 5]] + "-" + k[a2[b2 + 6]] + k[a2[b2 + 7]] + "-" + k[a2[b2 + 8]] + k[a2[b2 + 9]] + "-" + k[a2[b2 + 10]] + k[a2[b2 + 11]] + k[a2[b2 + 12]] + k[a2[b2 + 13]] + k[a2[b2 + 14]] + k[a2[b2 + 15]]).toLowerCase();
        if (!j(c2)) throw TypeError("Stringified UUID is invalid");
        return c2;
      };
      var n = 0, o = 0;
      let p = function(a2, b2, c2) {
        var d2 = b2 && c2 || 0, g2 = b2 || Array(16), i2 = (a2 = a2 || {}).node || e, j2 = void 0 !== a2.clockseq ? a2.clockseq : f;
        if (null == i2 || null == j2) {
          var k2 = a2.random || (a2.rng || h)();
          null == i2 && (i2 = e = [1 | k2[0], k2[1], k2[2], k2[3], k2[4], k2[5]]), null == j2 && (j2 = f = (k2[6] << 8 | k2[7]) & 16383);
        }
        var l2 = void 0 !== a2.msecs ? a2.msecs : Date.now(), p2 = void 0 !== a2.nsecs ? a2.nsecs : o + 1, q2 = l2 - n + (p2 - o) / 1e4;
        if (q2 < 0 && void 0 === a2.clockseq && (j2 = j2 + 1 & 16383), (q2 < 0 || l2 > n) && void 0 === a2.nsecs && (p2 = 0), p2 >= 1e4) throw Error("uuid.v1(): Can't create more than 10M uuids/sec");
        n = l2, o = p2, f = j2;
        var r2 = ((268435455 & (l2 += 122192928e5)) * 1e4 + p2) % 4294967296;
        g2[d2++] = r2 >>> 24 & 255, g2[d2++] = r2 >>> 16 & 255, g2[d2++] = r2 >>> 8 & 255, g2[d2++] = 255 & r2;
        var s2 = l2 / 4294967296 * 1e4 & 268435455;
        g2[d2++] = s2 >>> 8 & 255, g2[d2++] = 255 & s2, g2[d2++] = s2 >>> 24 & 15 | 16, g2[d2++] = s2 >>> 16 & 255, g2[d2++] = j2 >>> 8 | 128, g2[d2++] = 255 & j2;
        for (var t2 = 0; t2 < 6; ++t2) g2[d2 + t2] = i2[t2];
        return b2 || m(g2);
      }, q = function(a2) {
        if (!j(a2)) throw TypeError("Invalid UUID");
        var b2, c2 = new Uint8Array(16);
        return c2[0] = (b2 = parseInt(a2.slice(0, 8), 16)) >>> 24, c2[1] = b2 >>> 16 & 255, c2[2] = b2 >>> 8 & 255, c2[3] = 255 & b2, c2[4] = (b2 = parseInt(a2.slice(9, 13), 16)) >>> 8, c2[5] = 255 & b2, c2[6] = (b2 = parseInt(a2.slice(14, 18), 16)) >>> 8, c2[7] = 255 & b2, c2[8] = (b2 = parseInt(a2.slice(19, 23), 16)) >>> 8, c2[9] = 255 & b2, c2[10] = (b2 = parseInt(a2.slice(24, 36), 16)) / 1099511627776 & 255, c2[11] = b2 / 4294967296 & 255, c2[12] = b2 >>> 24 & 255, c2[13] = b2 >>> 16 & 255, c2[14] = b2 >>> 8 & 255, c2[15] = 255 & b2, c2;
      };
      function r(a2, b2, c2) {
        function d2(a3, d3, e2, f2) {
          if ("string" == typeof a3 && (a3 = function(a4) {
            a4 = unescape(encodeURIComponent(a4));
            for (var b3 = [], c3 = 0; c3 < a4.length; ++c3) b3.push(a4.charCodeAt(c3));
            return b3;
          }(a3)), "string" == typeof d3 && (d3 = q(d3)), 16 !== d3.length) throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
          var g2 = new Uint8Array(16 + a3.length);
          if (g2.set(d3), g2.set(a3, d3.length), (g2 = c2(g2))[6] = 15 & g2[6] | b2, g2[8] = 63 & g2[8] | 128, e2) {
            f2 = f2 || 0;
            for (var h2 = 0; h2 < 16; ++h2) e2[f2 + h2] = g2[h2];
            return e2;
          }
          return m(g2);
        }
        try {
          d2.name = a2;
        } catch (a3) {
        }
        return d2.DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8", d2.URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8", d2;
      }
      function s(a2) {
        return (a2 + 64 >>> 9 << 4) + 14 + 1;
      }
      function t(a2, b2) {
        var c2 = (65535 & a2) + (65535 & b2);
        return (a2 >> 16) + (b2 >> 16) + (c2 >> 16) << 16 | 65535 & c2;
      }
      function u(a2, b2, c2, d2, e2, f2) {
        var g2;
        return t((g2 = t(t(b2, a2), t(d2, f2))) << e2 | g2 >>> 32 - e2, c2);
      }
      function v(a2, b2, c2, d2, e2, f2, g2) {
        return u(b2 & c2 | ~b2 & d2, a2, b2, e2, f2, g2);
      }
      function w(a2, b2, c2, d2, e2, f2, g2) {
        return u(b2 & d2 | c2 & ~d2, a2, b2, e2, f2, g2);
      }
      function x(a2, b2, c2, d2, e2, f2, g2) {
        return u(b2 ^ c2 ^ d2, a2, b2, e2, f2, g2);
      }
      function y(a2, b2, c2, d2, e2, f2, g2) {
        return u(c2 ^ (b2 | ~d2), a2, b2, e2, f2, g2);
      }
      let z = r("v3", 48, function(a2) {
        if ("string" == typeof a2) {
          var b2 = unescape(encodeURIComponent(a2));
          a2 = new Uint8Array(b2.length);
          for (var c2 = 0; c2 < b2.length; ++c2) a2[c2] = b2.charCodeAt(c2);
        }
        return function(a3) {
          for (var b3 = [], c3 = 32 * a3.length, d2 = "0123456789abcdef", e2 = 0; e2 < c3; e2 += 8) {
            var f2 = a3[e2 >> 5] >>> e2 % 32 & 255, g2 = parseInt(d2.charAt(f2 >>> 4 & 15) + d2.charAt(15 & f2), 16);
            b3.push(g2);
          }
          return b3;
        }(function(a3, b3) {
          a3[b3 >> 5] |= 128 << b3 % 32, a3[s(b3) - 1] = b3;
          for (var c3 = 1732584193, d2 = -271733879, e2 = -1732584194, f2 = 271733878, g2 = 0; g2 < a3.length; g2 += 16) {
            var h2 = c3, i2 = d2, j2 = e2, k2 = f2;
            c3 = v(c3, d2, e2, f2, a3[g2], 7, -680876936), f2 = v(f2, c3, d2, e2, a3[g2 + 1], 12, -389564586), e2 = v(e2, f2, c3, d2, a3[g2 + 2], 17, 606105819), d2 = v(d2, e2, f2, c3, a3[g2 + 3], 22, -1044525330), c3 = v(c3, d2, e2, f2, a3[g2 + 4], 7, -176418897), f2 = v(f2, c3, d2, e2, a3[g2 + 5], 12, 1200080426), e2 = v(e2, f2, c3, d2, a3[g2 + 6], 17, -1473231341), d2 = v(d2, e2, f2, c3, a3[g2 + 7], 22, -45705983), c3 = v(c3, d2, e2, f2, a3[g2 + 8], 7, 1770035416), f2 = v(f2, c3, d2, e2, a3[g2 + 9], 12, -1958414417), e2 = v(e2, f2, c3, d2, a3[g2 + 10], 17, -42063), d2 = v(d2, e2, f2, c3, a3[g2 + 11], 22, -1990404162), c3 = v(c3, d2, e2, f2, a3[g2 + 12], 7, 1804603682), f2 = v(f2, c3, d2, e2, a3[g2 + 13], 12, -40341101), e2 = v(e2, f2, c3, d2, a3[g2 + 14], 17, -1502002290), d2 = v(d2, e2, f2, c3, a3[g2 + 15], 22, 1236535329), c3 = w(c3, d2, e2, f2, a3[g2 + 1], 5, -165796510), f2 = w(f2, c3, d2, e2, a3[g2 + 6], 9, -1069501632), e2 = w(e2, f2, c3, d2, a3[g2 + 11], 14, 643717713), d2 = w(d2, e2, f2, c3, a3[g2], 20, -373897302), c3 = w(c3, d2, e2, f2, a3[g2 + 5], 5, -701558691), f2 = w(f2, c3, d2, e2, a3[g2 + 10], 9, 38016083), e2 = w(e2, f2, c3, d2, a3[g2 + 15], 14, -660478335), d2 = w(d2, e2, f2, c3, a3[g2 + 4], 20, -405537848), c3 = w(c3, d2, e2, f2, a3[g2 + 9], 5, 568446438), f2 = w(f2, c3, d2, e2, a3[g2 + 14], 9, -1019803690), e2 = w(e2, f2, c3, d2, a3[g2 + 3], 14, -187363961), d2 = w(d2, e2, f2, c3, a3[g2 + 8], 20, 1163531501), c3 = w(c3, d2, e2, f2, a3[g2 + 13], 5, -1444681467), f2 = w(f2, c3, d2, e2, a3[g2 + 2], 9, -51403784), e2 = w(e2, f2, c3, d2, a3[g2 + 7], 14, 1735328473), d2 = w(d2, e2, f2, c3, a3[g2 + 12], 20, -1926607734), c3 = x(c3, d2, e2, f2, a3[g2 + 5], 4, -378558), f2 = x(f2, c3, d2, e2, a3[g2 + 8], 11, -2022574463), e2 = x(e2, f2, c3, d2, a3[g2 + 11], 16, 1839030562), d2 = x(d2, e2, f2, c3, a3[g2 + 14], 23, -35309556), c3 = x(c3, d2, e2, f2, a3[g2 + 1], 4, -1530992060), f2 = x(f2, c3, d2, e2, a3[g2 + 4], 11, 1272893353), e2 = x(e2, f2, c3, d2, a3[g2 + 7], 16, -155497632), d2 = x(d2, e2, f2, c3, a3[g2 + 10], 23, -1094730640), c3 = x(c3, d2, e2, f2, a3[g2 + 13], 4, 681279174), f2 = x(f2, c3, d2, e2, a3[g2], 11, -358537222), e2 = x(e2, f2, c3, d2, a3[g2 + 3], 16, -722521979), d2 = x(d2, e2, f2, c3, a3[g2 + 6], 23, 76029189), c3 = x(c3, d2, e2, f2, a3[g2 + 9], 4, -640364487), f2 = x(f2, c3, d2, e2, a3[g2 + 12], 11, -421815835), e2 = x(e2, f2, c3, d2, a3[g2 + 15], 16, 530742520), d2 = x(d2, e2, f2, c3, a3[g2 + 2], 23, -995338651), c3 = y(c3, d2, e2, f2, a3[g2], 6, -198630844), f2 = y(f2, c3, d2, e2, a3[g2 + 7], 10, 1126891415), e2 = y(e2, f2, c3, d2, a3[g2 + 14], 15, -1416354905), d2 = y(d2, e2, f2, c3, a3[g2 + 5], 21, -57434055), c3 = y(c3, d2, e2, f2, a3[g2 + 12], 6, 1700485571), f2 = y(f2, c3, d2, e2, a3[g2 + 3], 10, -1894986606), e2 = y(e2, f2, c3, d2, a3[g2 + 10], 15, -1051523), d2 = y(d2, e2, f2, c3, a3[g2 + 1], 21, -2054922799), c3 = y(c3, d2, e2, f2, a3[g2 + 8], 6, 1873313359), f2 = y(f2, c3, d2, e2, a3[g2 + 15], 10, -30611744), e2 = y(e2, f2, c3, d2, a3[g2 + 6], 15, -1560198380), d2 = y(d2, e2, f2, c3, a3[g2 + 13], 21, 1309151649), c3 = y(c3, d2, e2, f2, a3[g2 + 4], 6, -145523070), f2 = y(f2, c3, d2, e2, a3[g2 + 11], 10, -1120210379), e2 = y(e2, f2, c3, d2, a3[g2 + 2], 15, 718787259), d2 = y(d2, e2, f2, c3, a3[g2 + 9], 21, -343485551), c3 = t(c3, h2), d2 = t(d2, i2), e2 = t(e2, j2), f2 = t(f2, k2);
          }
          return [c3, d2, e2, f2];
        }(function(a3) {
          if (0 === a3.length) return [];
          for (var b3 = 8 * a3.length, c3 = new Uint32Array(s(b3)), d2 = 0; d2 < b3; d2 += 8) c3[d2 >> 5] |= (255 & a3[d2 / 8]) << d2 % 32;
          return c3;
        }(a2), 8 * a2.length));
      }), A = function(a2, b2, c2) {
        var d2 = (a2 = a2 || {}).random || (a2.rng || h)();
        if (d2[6] = 15 & d2[6] | 64, d2[8] = 63 & d2[8] | 128, b2) {
          c2 = c2 || 0;
          for (var e2 = 0; e2 < 16; ++e2) b2[c2 + e2] = d2[e2];
          return b2;
        }
        return m(d2);
      };
      function B(a2, b2) {
        return a2 << b2 | a2 >>> 32 - b2;
      }
      let C = r("v5", 80, function(a2) {
        var b2 = [1518500249, 1859775393, 2400959708, 3395469782], c2 = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
        if ("string" == typeof a2) {
          var d2 = unescape(encodeURIComponent(a2));
          a2 = [];
          for (var e2 = 0; e2 < d2.length; ++e2) a2.push(d2.charCodeAt(e2));
        } else Array.isArray(a2) || (a2 = Array.prototype.slice.call(a2));
        a2.push(128);
        for (var f2 = Math.ceil((a2.length / 4 + 2) / 16), g2 = Array(f2), h2 = 0; h2 < f2; ++h2) {
          for (var i2 = new Uint32Array(16), j2 = 0; j2 < 16; ++j2) i2[j2] = a2[64 * h2 + 4 * j2] << 24 | a2[64 * h2 + 4 * j2 + 1] << 16 | a2[64 * h2 + 4 * j2 + 2] << 8 | a2[64 * h2 + 4 * j2 + 3];
          g2[h2] = i2;
        }
        g2[f2 - 1][14] = (a2.length - 1) * 8 / 4294967296, g2[f2 - 1][14] = Math.floor(g2[f2 - 1][14]), g2[f2 - 1][15] = (a2.length - 1) * 8 | 0;
        for (var k2 = 0; k2 < f2; ++k2) {
          for (var l2 = new Uint32Array(80), m2 = 0; m2 < 16; ++m2) l2[m2] = g2[k2][m2];
          for (var n2 = 16; n2 < 80; ++n2) l2[n2] = B(l2[n2 - 3] ^ l2[n2 - 8] ^ l2[n2 - 14] ^ l2[n2 - 16], 1);
          for (var o2 = c2[0], p2 = c2[1], q2 = c2[2], r2 = c2[3], s2 = c2[4], t2 = 0; t2 < 80; ++t2) {
            var u2 = Math.floor(t2 / 20), v2 = B(o2, 5) + function(a3, b3, c3, d3) {
              switch (a3) {
                case 0:
                  return b3 & c3 ^ ~b3 & d3;
                case 1:
                case 3:
                  return b3 ^ c3 ^ d3;
                case 2:
                  return b3 & c3 ^ b3 & d3 ^ c3 & d3;
              }
            }(u2, p2, q2, r2) + s2 + b2[u2] + l2[t2] >>> 0;
            s2 = r2, r2 = q2, q2 = B(p2, 30) >>> 0, p2 = o2, o2 = v2;
          }
          c2[0] = c2[0] + o2 >>> 0, c2[1] = c2[1] + p2 >>> 0, c2[2] = c2[2] + q2 >>> 0, c2[3] = c2[3] + r2 >>> 0, c2[4] = c2[4] + s2 >>> 0;
        }
        return [c2[0] >> 24 & 255, c2[0] >> 16 & 255, c2[0] >> 8 & 255, 255 & c2[0], c2[1] >> 24 & 255, c2[1] >> 16 & 255, c2[1] >> 8 & 255, 255 & c2[1], c2[2] >> 24 & 255, c2[2] >> 16 & 255, c2[2] >> 8 & 255, 255 & c2[2], c2[3] >> 24 & 255, c2[3] >> 16 & 255, c2[3] >> 8 & 255, 255 & c2[3], c2[4] >> 24 & 255, c2[4] >> 16 & 255, c2[4] >> 8 & 255, 255 & c2[4]];
      }), D = "00000000-0000-0000-0000-000000000000", E = function(a2) {
        if (!j(a2)) throw TypeError("Invalid UUID");
        return parseInt(a2.substr(14, 1), 16);
      };
    }, 2743: (a, b, c) => {
      "use strict";
      c.r(b), c.d(b, { CompactEncrypt: () => bc, CompactSign: () => bf, EmbeddedJWK: () => bo, EncryptJWT: () => bk, FlattenedEncrypt: () => aY, FlattenedSign: () => be, GeneralEncrypt: () => a$, GeneralSign: () => bh, SignJWT: () => bj, UnsecuredJWT: () => bx, base64url: () => e, calculateJwkThumbprint: () => bm, calculateJwkThumbprintUri: () => bn, compactDecrypt: () => aQ, compactVerify: () => a3, createLocalJWKSet: () => bt, createRemoteJWKSet: () => bw, cryptoRuntime: () => bH, decodeJwt: () => bB, decodeProtectedHeader: () => bA, errors: () => d, exportJWK: () => aV, exportPKCS8: () => aU, exportSPKI: () => aT, flattenedDecrypt: () => aP, flattenedVerify: () => a2, generalDecrypt: () => aR, generalVerify: () => a4, generateKeyPair: () => bF, generateSecret: () => bG, importJWK: () => aF, importPKCS8: () => aE, importSPKI: () => aC, importX509: () => aD, jwtDecrypt: () => bb, jwtVerify: () => ba });
      var d = {};
      c.r(d), c.d(d, { JOSEAlgNotAllowed: () => w, JOSEError: () => t, JOSENotSupported: () => x, JWEDecompressionFailed: () => z, JWEDecryptionFailed: () => y, JWEInvalid: () => A, JWKInvalid: () => D, JWKSInvalid: () => E, JWKSMultipleMatchingKeys: () => G, JWKSNoMatchingKey: () => F, JWKSTimeout: () => H, JWSInvalid: () => B, JWSSignatureVerificationFailed: () => I, JWTClaimValidationFailed: () => u, JWTExpired: () => v, JWTInvalid: () => C });
      var e = {};
      c.r(e), c.d(e, { decode: () => bz, encode: () => by });
      let f = crypto, g = async (a10, b2) => {
        let c2 = `SHA-${a10.slice(-3)}`;
        return new Uint8Array(await f.subtle.digest(c2, b2));
      }, h = new TextEncoder(), i = new TextDecoder();
      function j(...a10) {
        let b2 = new Uint8Array(a10.reduce((a11, { length: b3 }) => a11 + b3, 0)), c2 = 0;
        return a10.forEach((a11) => {
          b2.set(a11, c2), c2 += a11.length;
        }), b2;
      }
      function k(a10, b2, c2) {
        if (b2 < 0 || b2 >= 4294967296) throw RangeError(`value must be >= 0 and <= ${4294967296 - 1}. Received ${b2}`);
        a10.set([b2 >>> 24, b2 >>> 16, b2 >>> 8, 255 & b2], c2);
      }
      function l(a10) {
        let b2 = Math.floor(a10 / 4294967296), c2 = new Uint8Array(8);
        return k(c2, b2, 0), k(c2, a10 % 4294967296, 4), c2;
      }
      function m(a10) {
        let b2 = new Uint8Array(4);
        return k(b2, a10), b2;
      }
      function n(a10) {
        return j(m(a10.length), a10);
      }
      async function o(a10, b2, c2) {
        let d2 = Math.ceil((b2 >> 3) / 32), e2 = new Uint8Array(32 * d2);
        for (let b3 = 0; b3 < d2; b3++) {
          let d3 = new Uint8Array(4 + a10.length + c2.length);
          d3.set(m(b3 + 1)), d3.set(a10, 4), d3.set(c2, 4 + a10.length), e2.set(await g("sha256", d3), 32 * b3);
        }
        return e2.slice(0, b2 >> 3);
      }
      let p = (a10) => {
        let b2 = a10;
        "string" == typeof b2 && (b2 = h.encode(b2));
        let c2 = [];
        for (let a11 = 0; a11 < b2.length; a11 += 32768) c2.push(String.fromCharCode.apply(null, b2.subarray(a11, a11 + 32768)));
        return btoa(c2.join(""));
      }, q = (a10) => p(a10).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"), r = (a10) => {
        let b2 = atob(a10), c2 = new Uint8Array(b2.length);
        for (let a11 = 0; a11 < b2.length; a11++) c2[a11] = b2.charCodeAt(a11);
        return c2;
      }, s = (a10) => {
        let b2 = a10;
        b2 instanceof Uint8Array && (b2 = i.decode(b2)), b2 = b2.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
        try {
          return r(b2);
        } catch (a11) {
          throw TypeError("The input to be decoded is not correctly encoded.");
        }
      };
      class t extends Error {
        static get code() {
          return "ERR_JOSE_GENERIC";
        }
        constructor(a10) {
          var b2;
          super(a10), this.code = "ERR_JOSE_GENERIC", this.name = this.constructor.name, null == (b2 = Error.captureStackTrace) || b2.call(Error, this, this.constructor);
        }
      }
      class u extends t {
        static get code() {
          return "ERR_JWT_CLAIM_VALIDATION_FAILED";
        }
        constructor(a10, b2 = "unspecified", c2 = "unspecified") {
          super(a10), this.code = "ERR_JWT_CLAIM_VALIDATION_FAILED", this.claim = b2, this.reason = c2;
        }
      }
      class v extends t {
        static get code() {
          return "ERR_JWT_EXPIRED";
        }
        constructor(a10, b2 = "unspecified", c2 = "unspecified") {
          super(a10), this.code = "ERR_JWT_EXPIRED", this.claim = b2, this.reason = c2;
        }
      }
      class w extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JOSE_ALG_NOT_ALLOWED";
        }
        static get code() {
          return "ERR_JOSE_ALG_NOT_ALLOWED";
        }
      }
      class x extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JOSE_NOT_SUPPORTED";
        }
        static get code() {
          return "ERR_JOSE_NOT_SUPPORTED";
        }
      }
      class y extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWE_DECRYPTION_FAILED", this.message = "decryption operation failed";
        }
        static get code() {
          return "ERR_JWE_DECRYPTION_FAILED";
        }
      }
      class z extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWE_DECOMPRESSION_FAILED", this.message = "decompression operation failed";
        }
        static get code() {
          return "ERR_JWE_DECOMPRESSION_FAILED";
        }
      }
      class A extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWE_INVALID";
        }
        static get code() {
          return "ERR_JWE_INVALID";
        }
      }
      class B extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWS_INVALID";
        }
        static get code() {
          return "ERR_JWS_INVALID";
        }
      }
      class C extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWT_INVALID";
        }
        static get code() {
          return "ERR_JWT_INVALID";
        }
      }
      class D extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWK_INVALID";
        }
        static get code() {
          return "ERR_JWK_INVALID";
        }
      }
      class E extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWKS_INVALID";
        }
        static get code() {
          return "ERR_JWKS_INVALID";
        }
      }
      class F extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWKS_NO_MATCHING_KEY", this.message = "no applicable key found in the JSON Web Key Set";
        }
        static get code() {
          return "ERR_JWKS_NO_MATCHING_KEY";
        }
      }
      class G extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS", this.message = "multiple matching keys found in the JSON Web Key Set";
        }
        static get code() {
          return "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
        }
      }
      Symbol.asyncIterator;
      class H extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWKS_TIMEOUT", this.message = "request timed out";
        }
        static get code() {
          return "ERR_JWKS_TIMEOUT";
        }
      }
      class I extends t {
        constructor() {
          super(...arguments), this.code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED", this.message = "signature verification failed";
        }
        static get code() {
          return "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
        }
      }
      let J = f.getRandomValues.bind(f);
      function K(a10) {
        switch (a10) {
          case "A128GCM":
          case "A128GCMKW":
          case "A192GCM":
          case "A192GCMKW":
          case "A256GCM":
          case "A256GCMKW":
            return 96;
          case "A128CBC-HS256":
          case "A192CBC-HS384":
          case "A256CBC-HS512":
            return 128;
          default:
            throw new x(`Unsupported JWE Algorithm: ${a10}`);
        }
      }
      let L = (a10) => J(new Uint8Array(K(a10) >> 3)), M = (a10, b2) => {
        if (b2.length << 3 !== K(a10)) throw new A("Invalid Initialization Vector length");
      }, N = (a10, b2) => {
        let c2 = a10.byteLength << 3;
        if (c2 !== b2) throw new A(`Invalid Content Encryption Key length. Expected ${b2} bits, got ${c2} bits`);
      };
      function O(a10, b2 = "algorithm.name") {
        return TypeError(`CryptoKey does not support this operation, its ${b2} must be ${a10}`);
      }
      function P(a10, b2) {
        return a10.name === b2;
      }
      function Q(a10) {
        return parseInt(a10.name.slice(4), 10);
      }
      function R(a10, b2) {
        if (b2.length && !b2.some((b3) => a10.usages.includes(b3))) {
          let a11 = "CryptoKey does not support this operation, its usages must include ";
          if (b2.length > 2) {
            let c2 = b2.pop();
            a11 += `one of ${b2.join(", ")}, or ${c2}.`;
          } else 2 === b2.length ? a11 += `one of ${b2[0]} or ${b2[1]}.` : a11 += `${b2[0]}.`;
          throw TypeError(a11);
        }
      }
      function S(a10, b2, ...c2) {
        switch (b2) {
          case "A128GCM":
          case "A192GCM":
          case "A256GCM": {
            if (!P(a10.algorithm, "AES-GCM")) throw O("AES-GCM");
            let c3 = parseInt(b2.slice(1, 4), 10);
            if (a10.algorithm.length !== c3) throw O(c3, "algorithm.length");
            break;
          }
          case "A128KW":
          case "A192KW":
          case "A256KW": {
            if (!P(a10.algorithm, "AES-KW")) throw O("AES-KW");
            let c3 = parseInt(b2.slice(1, 4), 10);
            if (a10.algorithm.length !== c3) throw O(c3, "algorithm.length");
            break;
          }
          case "ECDH":
            switch (a10.algorithm.name) {
              case "ECDH":
              case "X25519":
              case "X448":
                break;
              default:
                throw O("ECDH, X25519, or X448");
            }
            break;
          case "PBES2-HS256+A128KW":
          case "PBES2-HS384+A192KW":
          case "PBES2-HS512+A256KW":
            if (!P(a10.algorithm, "PBKDF2")) throw O("PBKDF2");
            break;
          case "RSA-OAEP":
          case "RSA-OAEP-256":
          case "RSA-OAEP-384":
          case "RSA-OAEP-512": {
            if (!P(a10.algorithm, "RSA-OAEP")) throw O("RSA-OAEP");
            let c3 = parseInt(b2.slice(9), 10) || 1;
            if (Q(a10.algorithm.hash) !== c3) throw O(`SHA-${c3}`, "algorithm.hash");
            break;
          }
          default:
            throw TypeError("CryptoKey does not support this operation");
        }
        R(a10, c2);
      }
      function T(a10, b2, ...c2) {
        if (c2.length > 2) {
          let b3 = c2.pop();
          a10 += `one of type ${c2.join(", ")}, or ${b3}.`;
        } else 2 === c2.length ? a10 += `one of type ${c2[0]} or ${c2[1]}.` : a10 += `of type ${c2[0]}.`;
        return null == b2 ? a10 += ` Received ${b2}` : "function" == typeof b2 && b2.name ? a10 += ` Received function ${b2.name}` : "object" == typeof b2 && null != b2 && b2.constructor && b2.constructor.name && (a10 += ` Received an instance of ${b2.constructor.name}`), a10;
      }
      let U = (a10, ...b2) => T("Key must be ", a10, ...b2);
      function V(a10, b2, ...c2) {
        return T(`Key for the ${a10} algorithm must be `, b2, ...c2);
      }
      let W = ["CryptoKey"];
      async function X(a10, b2, c2, d2, e2, g2) {
        let h2, i2;
        if (!(b2 instanceof Uint8Array)) throw TypeError(U(b2, "Uint8Array"));
        let k2 = parseInt(a10.slice(1, 4), 10), m2 = await f.subtle.importKey("raw", b2.subarray(k2 >> 3), "AES-CBC", false, ["decrypt"]), n2 = await f.subtle.importKey("raw", b2.subarray(0, k2 >> 3), { hash: `SHA-${k2 << 1}`, name: "HMAC" }, false, ["sign"]), o2 = j(g2, d2, c2, l(g2.length << 3)), p2 = new Uint8Array((await f.subtle.sign("HMAC", n2, o2)).slice(0, k2 >> 3));
        try {
          h2 = ((a11, b3) => {
            if (!(a11 instanceof Uint8Array)) throw TypeError("First argument must be a buffer");
            if (!(b3 instanceof Uint8Array)) throw TypeError("Second argument must be a buffer");
            if (a11.length !== b3.length) throw TypeError("Input buffers must have the same length");
            let c3 = a11.length, d3 = 0, e3 = -1;
            for (; ++e3 < c3; ) d3 |= a11[e3] ^ b3[e3];
            return 0 === d3;
          })(e2, p2);
        } catch (a11) {
        }
        if (!h2) throw new y();
        try {
          i2 = new Uint8Array(await f.subtle.decrypt({ iv: d2, name: "AES-CBC" }, m2, c2));
        } catch (a11) {
        }
        if (!i2) throw new y();
        return i2;
      }
      async function Y(a10, b2, c2, d2, e2, g2) {
        let h2;
        b2 instanceof Uint8Array ? h2 = await f.subtle.importKey("raw", b2, "AES-GCM", false, ["decrypt"]) : (S(b2, a10, "decrypt"), h2 = b2);
        try {
          return new Uint8Array(await f.subtle.decrypt({ additionalData: g2, iv: d2, name: "AES-GCM", tagLength: 128 }, h2, j(c2, e2)));
        } catch (a11) {
          throw new y();
        }
      }
      let Z = async (a10, b2, c2, d2, e2, f2) => {
        if (!(b2 instanceof CryptoKey) && !(b2 instanceof Uint8Array)) throw TypeError(U(b2, ...W, "Uint8Array"));
        switch (M(a10, d2), a10) {
          case "A128CBC-HS256":
          case "A192CBC-HS384":
          case "A256CBC-HS512":
            return b2 instanceof Uint8Array && N(b2, parseInt(a10.slice(-3), 10)), X(a10, b2, c2, d2, e2, f2);
          case "A128GCM":
          case "A192GCM":
          case "A256GCM":
            return b2 instanceof Uint8Array && N(b2, parseInt(a10.slice(1, 4), 10)), Y(a10, b2, c2, d2, e2, f2);
          default:
            throw new x("Unsupported JWE Content Encryption Algorithm");
        }
      }, $ = async () => {
        throw new x('JWE "zip" (Compression Algorithm) Header Parameter is not supported by your javascript runtime. You need to use the `inflateRaw` decrypt option to provide Inflate Raw implementation.');
      }, _ = async () => {
        throw new x('JWE "zip" (Compression Algorithm) Header Parameter is not supported by your javascript runtime. You need to use the `deflateRaw` encrypt option to provide Deflate Raw implementation.');
      }, aa = (...a10) => {
        let b2, c2 = a10.filter(Boolean);
        if (0 === c2.length || 1 === c2.length) return true;
        for (let a11 of c2) {
          let c3 = Object.keys(a11);
          if (!b2 || 0 === b2.size) {
            b2 = new Set(c3);
            continue;
          }
          for (let a12 of c3) {
            if (b2.has(a12)) return false;
            b2.add(a12);
          }
        }
        return true;
      };
      function ab(a10) {
        if ("object" != typeof a10 || null === a10 || "[object Object]" !== Object.prototype.toString.call(a10)) return false;
        if (null === Object.getPrototypeOf(a10)) return true;
        let b2 = a10;
        for (; null !== Object.getPrototypeOf(b2); ) b2 = Object.getPrototypeOf(b2);
        return Object.getPrototypeOf(a10) === b2;
      }
      let ac = [{ hash: "SHA-256", name: "HMAC" }, true, ["sign"]];
      function ad(a10, b2) {
        if (a10.algorithm.length !== parseInt(b2.slice(1, 4), 10)) throw TypeError(`Invalid key size for alg: ${b2}`);
      }
      function ae(a10, b2, c2) {
        if (a10 instanceof CryptoKey) return S(a10, b2, c2), a10;
        if (a10 instanceof Uint8Array) return f.subtle.importKey("raw", a10, "AES-KW", true, [c2]);
        throw TypeError(U(a10, ...W, "Uint8Array"));
      }
      let af = async (a10, b2, c2) => {
        let d2 = await ae(b2, a10, "wrapKey");
        ad(d2, a10);
        let e2 = await f.subtle.importKey("raw", c2, ...ac);
        return new Uint8Array(await f.subtle.wrapKey("raw", e2, d2, "AES-KW"));
      }, ag = async (a10, b2, c2) => {
        let d2 = await ae(b2, a10, "unwrapKey");
        ad(d2, a10);
        let e2 = await f.subtle.unwrapKey("raw", c2, d2, "AES-KW", ...ac);
        return new Uint8Array(await f.subtle.exportKey("raw", e2));
      };
      async function ah(a10, b2, c2, d2, e2 = new Uint8Array(0), g2 = new Uint8Array(0)) {
        let i2;
        if (!(a10 instanceof CryptoKey)) throw TypeError(U(a10, ...W));
        if (S(a10, "ECDH"), !(b2 instanceof CryptoKey)) throw TypeError(U(b2, ...W));
        S(b2, "ECDH", "deriveBits");
        let k2 = j(n(h.encode(c2)), n(e2), n(g2), m(d2));
        return i2 = "X25519" === a10.algorithm.name ? 256 : "X448" === a10.algorithm.name ? 448 : Math.ceil(parseInt(a10.algorithm.namedCurve.substr(-3), 10) / 8) << 3, o(new Uint8Array(await f.subtle.deriveBits({ name: a10.algorithm.name, public: a10 }, b2, i2)), d2, k2);
      }
      async function ai(a10) {
        if (!(a10 instanceof CryptoKey)) throw TypeError(U(a10, ...W));
        return f.subtle.generateKey(a10.algorithm, true, ["deriveBits"]);
      }
      function aj(a10) {
        if (!(a10 instanceof CryptoKey)) throw TypeError(U(a10, ...W));
        return ["P-256", "P-384", "P-521"].includes(a10.algorithm.namedCurve) || "X25519" === a10.algorithm.name || "X448" === a10.algorithm.name;
      }
      async function ak(a10, b2, c2, d2) {
        if (!(a10 instanceof Uint8Array) || a10.length < 8) throw new A("PBES2 Salt Input must be 8 or more octets");
        let e2 = j(h.encode(b2), new Uint8Array([0]), a10), g2 = parseInt(b2.slice(13, 16), 10), i2 = { hash: `SHA-${b2.slice(8, 11)}`, iterations: c2, name: "PBKDF2", salt: e2 }, k2 = await function(a11, b3) {
          if (a11 instanceof Uint8Array) return f.subtle.importKey("raw", a11, "PBKDF2", false, ["deriveBits"]);
          if (a11 instanceof CryptoKey) return S(a11, b3, "deriveBits", "deriveKey"), a11;
          throw TypeError(U(a11, ...W, "Uint8Array"));
        }(d2, b2);
        if (k2.usages.includes("deriveBits")) return new Uint8Array(await f.subtle.deriveBits(i2, k2, g2));
        if (k2.usages.includes("deriveKey")) return f.subtle.deriveKey(i2, k2, { length: g2, name: "AES-KW" }, false, ["wrapKey", "unwrapKey"]);
        throw TypeError('PBKDF2 key "usages" must include "deriveBits" or "deriveKey"');
      }
      let al = async (a10, b2, c2, d2 = 2048, e2 = J(new Uint8Array(16))) => {
        let f2 = await ak(e2, a10, d2, b2);
        return { encryptedKey: await af(a10.slice(-6), f2, c2), p2c: d2, p2s: q(e2) };
      }, am = async (a10, b2, c2, d2, e2) => {
        let f2 = await ak(e2, a10, d2, b2);
        return ag(a10.slice(-6), f2, c2);
      };
      function an(a10) {
        switch (a10) {
          case "RSA-OAEP":
          case "RSA-OAEP-256":
          case "RSA-OAEP-384":
          case "RSA-OAEP-512":
            return "RSA-OAEP";
          default:
            throw new x(`alg ${a10} is not supported either by JOSE or your javascript runtime`);
        }
      }
      let ao = (a10, b2) => {
        if (a10.startsWith("RS") || a10.startsWith("PS")) {
          let { modulusLength: c2 } = b2.algorithm;
          if ("number" != typeof c2 || c2 < 2048) throw TypeError(`${a10} requires key modulusLength to be 2048 bits or larger`);
        }
      }, ap = async (a10, b2, c2) => {
        if (!(b2 instanceof CryptoKey)) throw TypeError(U(b2, ...W));
        if (S(b2, a10, "encrypt", "wrapKey"), ao(a10, b2), b2.usages.includes("encrypt")) return new Uint8Array(await f.subtle.encrypt(an(a10), b2, c2));
        if (b2.usages.includes("wrapKey")) {
          let d2 = await f.subtle.importKey("raw", c2, ...ac);
          return new Uint8Array(await f.subtle.wrapKey("raw", d2, b2, an(a10)));
        }
        throw TypeError('RSA-OAEP key "usages" must include "encrypt" or "wrapKey" for this operation');
      }, aq = async (a10, b2, c2) => {
        if (!(b2 instanceof CryptoKey)) throw TypeError(U(b2, ...W));
        if (S(b2, a10, "decrypt", "unwrapKey"), ao(a10, b2), b2.usages.includes("decrypt")) return new Uint8Array(await f.subtle.decrypt(an(a10), b2, c2));
        if (b2.usages.includes("unwrapKey")) {
          let d2 = await f.subtle.unwrapKey("raw", c2, b2, an(a10), ...ac);
          return new Uint8Array(await f.subtle.exportKey("raw", d2));
        }
        throw TypeError('RSA-OAEP key "usages" must include "decrypt" or "unwrapKey" for this operation');
      };
      function ar(a10) {
        switch (a10) {
          case "A128GCM":
            return 128;
          case "A192GCM":
            return 192;
          case "A256GCM":
          case "A128CBC-HS256":
            return 256;
          case "A192CBC-HS384":
            return 384;
          case "A256CBC-HS512":
            return 512;
          default:
            throw new x(`Unsupported JWE Algorithm: ${a10}`);
        }
      }
      let as = (a10) => J(new Uint8Array(ar(a10) >> 3)), at = (a10, b2) => {
        let c2 = (a10.match(/.{1,64}/g) || []).join("\n");
        return `-----BEGIN ${b2}-----
${c2}
-----END ${b2}-----`;
      }, au = async (a10, b2, c2) => {
        if (!(c2 instanceof CryptoKey)) throw TypeError(U(c2, ...W));
        if (!c2.extractable) throw TypeError("CryptoKey is not extractable");
        if (c2.type !== a10) throw TypeError(`key is not a ${a10} key`);
        return at(p(new Uint8Array(await f.subtle.exportKey(b2, c2))), `${a10.toUpperCase()} KEY`);
      }, av = (a10, b2, c2 = 0) => {
        0 === c2 && (b2.unshift(b2.length), b2.unshift(6));
        let d2 = a10.indexOf(b2[0], c2);
        if (-1 === d2) return false;
        let e2 = a10.subarray(d2, d2 + b2.length);
        return e2.length === b2.length && (e2.every((a11, c3) => a11 === b2[c3]) || av(a10, b2, d2 + 1));
      }, aw = (a10) => {
        switch (true) {
          case av(a10, [42, 134, 72, 206, 61, 3, 1, 7]):
            return "P-256";
          case av(a10, [43, 129, 4, 0, 34]):
            return "P-384";
          case av(a10, [43, 129, 4, 0, 35]):
            return "P-521";
          case av(a10, [43, 101, 110]):
            return "X25519";
          case av(a10, [43, 101, 111]):
            return "X448";
          case av(a10, [43, 101, 112]):
            return "Ed25519";
          case av(a10, [43, 101, 113]):
            return "Ed448";
          default:
            throw new x("Invalid or unsupported EC Key Curve or OKP Key Sub Type");
        }
      }, ax = async (a10, b2, c2, d2, e2) => {
        var g2;
        let h2, i2, j2 = new Uint8Array(atob(c2.replace(a10, "")).split("").map((a11) => a11.charCodeAt(0))), k2 = "spki" === b2;
        switch (d2) {
          case "PS256":
          case "PS384":
          case "PS512":
            h2 = { name: "RSA-PSS", hash: `SHA-${d2.slice(-3)}` }, i2 = k2 ? ["verify"] : ["sign"];
            break;
          case "RS256":
          case "RS384":
          case "RS512":
            h2 = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${d2.slice(-3)}` }, i2 = k2 ? ["verify"] : ["sign"];
            break;
          case "RSA-OAEP":
          case "RSA-OAEP-256":
          case "RSA-OAEP-384":
          case "RSA-OAEP-512":
            h2 = { name: "RSA-OAEP", hash: `SHA-${parseInt(d2.slice(-3), 10) || 1}` }, i2 = k2 ? ["encrypt", "wrapKey"] : ["decrypt", "unwrapKey"];
            break;
          case "ES256":
            h2 = { name: "ECDSA", namedCurve: "P-256" }, i2 = k2 ? ["verify"] : ["sign"];
            break;
          case "ES384":
            h2 = { name: "ECDSA", namedCurve: "P-384" }, i2 = k2 ? ["verify"] : ["sign"];
            break;
          case "ES512":
            h2 = { name: "ECDSA", namedCurve: "P-521" }, i2 = k2 ? ["verify"] : ["sign"];
            break;
          case "ECDH-ES":
          case "ECDH-ES+A128KW":
          case "ECDH-ES+A192KW":
          case "ECDH-ES+A256KW": {
            let a11 = aw(j2);
            h2 = a11.startsWith("P-") ? { name: "ECDH", namedCurve: a11 } : { name: a11 }, i2 = k2 ? [] : ["deriveBits"];
            break;
          }
          case "EdDSA":
            h2 = { name: aw(j2) }, i2 = k2 ? ["verify"] : ["sign"];
            break;
          default:
            throw new x('Invalid or unsupported "alg" (Algorithm) value');
        }
        return f.subtle.importKey(b2, j2, h2, null != (g2 = null == e2 ? void 0 : e2.extractable) && g2, i2);
      }, ay = (a10, b2, c2) => ax(/(?:-----(?:BEGIN|END) PUBLIC KEY-----|\s)/g, "spki", a10, b2, c2);
      function az(a10) {
        let b2 = [], c2 = 0;
        for (; c2 < a10.length; ) {
          let d2 = aA(a10.subarray(c2));
          b2.push(d2), c2 += d2.byteLength;
        }
        return b2;
      }
      function aA(a10) {
        let b2 = 0, c2 = 31 & a10[0];
        if (b2++, 31 === c2) {
          for (c2 = 0; a10[b2] >= 128; ) c2 = 128 * c2 + a10[b2] - 128, b2++;
          c2 = 128 * c2 + a10[b2] - 128, b2++;
        }
        let d2 = 0;
        if (a10[b2] < 128) d2 = a10[b2], b2++;
        else if (128 === d2) {
          for (d2 = 0; 0 !== a10[b2 + d2] || 0 !== a10[b2 + d2 + 1]; ) {
            if (d2 > a10.byteLength) throw TypeError("invalid indefinite form length");
            d2++;
          }
          let c3 = b2 + d2 + 2;
          return { byteLength: c3, contents: a10.subarray(b2, b2 + d2), raw: a10.subarray(0, c3) };
        } else {
          let c3 = 127 & a10[b2];
          b2++, d2 = 0;
          for (let e3 = 0; e3 < c3; e3++) d2 = 256 * d2 + a10[b2], b2++;
        }
        let e2 = b2 + d2;
        return { byteLength: e2, contents: a10.subarray(b2, e2), raw: a10.subarray(0, e2) };
      }
      let aB = async (a10) => {
        var b2, c2;
        if (!a10.alg) throw TypeError('"alg" argument is required when "jwk.alg" is not present');
        let { algorithm: d2, keyUsages: e2 } = function(a11) {
          let b3, c3;
          switch (a11.kty) {
            case "oct":
              switch (a11.alg) {
                case "HS256":
                case "HS384":
                case "HS512":
                  b3 = { name: "HMAC", hash: `SHA-${a11.alg.slice(-3)}` }, c3 = ["sign", "verify"];
                  break;
                case "A128CBC-HS256":
                case "A192CBC-HS384":
                case "A256CBC-HS512":
                  throw new x(`${a11.alg} keys cannot be imported as CryptoKey instances`);
                case "A128GCM":
                case "A192GCM":
                case "A256GCM":
                case "A128GCMKW":
                case "A192GCMKW":
                case "A256GCMKW":
                  b3 = { name: "AES-GCM" }, c3 = ["encrypt", "decrypt"];
                  break;
                case "A128KW":
                case "A192KW":
                case "A256KW":
                  b3 = { name: "AES-KW" }, c3 = ["wrapKey", "unwrapKey"];
                  break;
                case "PBES2-HS256+A128KW":
                case "PBES2-HS384+A192KW":
                case "PBES2-HS512+A256KW":
                  b3 = { name: "PBKDF2" }, c3 = ["deriveBits"];
                  break;
                default:
                  throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
              }
              break;
            case "RSA":
              switch (a11.alg) {
                case "PS256":
                case "PS384":
                case "PS512":
                  b3 = { name: "RSA-PSS", hash: `SHA-${a11.alg.slice(-3)}` }, c3 = a11.d ? ["sign"] : ["verify"];
                  break;
                case "RS256":
                case "RS384":
                case "RS512":
                  b3 = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${a11.alg.slice(-3)}` }, c3 = a11.d ? ["sign"] : ["verify"];
                  break;
                case "RSA-OAEP":
                case "RSA-OAEP-256":
                case "RSA-OAEP-384":
                case "RSA-OAEP-512":
                  b3 = { name: "RSA-OAEP", hash: `SHA-${parseInt(a11.alg.slice(-3), 10) || 1}` }, c3 = a11.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
                  break;
                default:
                  throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
              }
              break;
            case "EC":
              switch (a11.alg) {
                case "ES256":
                  b3 = { name: "ECDSA", namedCurve: "P-256" }, c3 = a11.d ? ["sign"] : ["verify"];
                  break;
                case "ES384":
                  b3 = { name: "ECDSA", namedCurve: "P-384" }, c3 = a11.d ? ["sign"] : ["verify"];
                  break;
                case "ES512":
                  b3 = { name: "ECDSA", namedCurve: "P-521" }, c3 = a11.d ? ["sign"] : ["verify"];
                  break;
                case "ECDH-ES":
                case "ECDH-ES+A128KW":
                case "ECDH-ES+A192KW":
                case "ECDH-ES+A256KW":
                  b3 = { name: "ECDH", namedCurve: a11.crv }, c3 = a11.d ? ["deriveBits"] : [];
                  break;
                default:
                  throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
              }
              break;
            case "OKP":
              switch (a11.alg) {
                case "EdDSA":
                  b3 = { name: a11.crv }, c3 = a11.d ? ["sign"] : ["verify"];
                  break;
                case "ECDH-ES":
                case "ECDH-ES+A128KW":
                case "ECDH-ES+A192KW":
                case "ECDH-ES+A256KW":
                  b3 = { name: a11.crv }, c3 = a11.d ? ["deriveBits"] : [];
                  break;
                default:
                  throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
              }
              break;
            default:
              throw new x('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
          }
          return { algorithm: b3, keyUsages: c3 };
        }(a10), g2 = [d2, null != (b2 = a10.ext) && b2, null != (c2 = a10.key_ops) ? c2 : e2];
        if ("PBKDF2" === d2.name) return f.subtle.importKey("raw", s(a10.k), ...g2);
        let h2 = { ...a10 };
        return delete h2.alg, delete h2.use, f.subtle.importKey("jwk", h2, ...g2);
      };
      async function aC(a10, b2, c2) {
        if ("string" != typeof a10 || 0 !== a10.indexOf("-----BEGIN PUBLIC KEY-----")) throw TypeError('"spki" must be SPKI formatted string');
        return ay(a10, b2, c2);
      }
      async function aD(a10, b2, c2) {
        let d2;
        if ("string" != typeof a10 || 0 !== a10.indexOf("-----BEGIN CERTIFICATE-----")) throw TypeError('"x509" must be X.509 formatted string');
        try {
          d2 = at(function(a11) {
            let b3 = az(az(aA(a11).contents)[0].contents);
            return p(b3[160 === b3[0].raw[0] ? 6 : 5].raw);
          }(r(a10.replace(/(?:-----(?:BEGIN|END) CERTIFICATE-----|\s)/g, ""))), "PUBLIC KEY");
        } catch (a11) {
          throw TypeError("Failed to parse the X.509 certificate", { cause: a11 });
        }
        return ay(d2, b2, c2);
      }
      async function aE(a10, b2, c2) {
        if ("string" != typeof a10 || 0 !== a10.indexOf("-----BEGIN PRIVATE KEY-----")) throw TypeError('"pkcs8" must be PKCS#8 formatted string');
        return ax(/(?:-----(?:BEGIN|END) PRIVATE KEY-----|\s)/g, "pkcs8", a10, b2, c2);
      }
      async function aF(a10, b2, c2) {
        var d2;
        if (!ab(a10)) throw TypeError("JWK must be an object");
        switch (b2 || (b2 = a10.alg), a10.kty) {
          case "oct":
            if ("string" != typeof a10.k || !a10.k) throw TypeError('missing "k" (Key Value) Parameter value');
            if (null != c2 || (c2 = true !== a10.ext), c2) return aB({ ...a10, alg: b2, ext: null != (d2 = a10.ext) && d2 });
            return s(a10.k);
          case "RSA":
            if (void 0 !== a10.oth) throw new x('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
          case "EC":
          case "OKP":
            return aB({ ...a10, alg: b2 });
          default:
            throw new x('Unsupported "kty" (Key Type) Parameter value');
        }
      }
      let aG = (a10, b2, c2) => {
        a10.startsWith("HS") || "dir" === a10 || a10.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(a10) ? ((a11, b3) => {
          if (!(b3 instanceof Uint8Array)) {
            if (!(b3 instanceof CryptoKey)) throw TypeError(V(a11, b3, ...W, "Uint8Array"));
            if ("secret" !== b3.type) throw TypeError(`${W.join(" or ")} instances for symmetric algorithms must be of type "secret"`);
          }
        })(a10, b2) : ((a11, b3, c3) => {
          if (!(b3 instanceof CryptoKey)) throw TypeError(V(a11, b3, ...W));
          if ("secret" === b3.type) throw TypeError(`${W.join(" or ")} instances for asymmetric algorithms must not be of type "secret"`);
          if ("sign" === c3 && "public" === b3.type) throw TypeError(`${W.join(" or ")} instances for asymmetric algorithm signing must be of type "private"`);
          if ("decrypt" === c3 && "public" === b3.type) throw TypeError(`${W.join(" or ")} instances for asymmetric algorithm decryption must be of type "private"`);
          if (b3.algorithm && "verify" === c3 && "private" === b3.type) throw TypeError(`${W.join(" or ")} instances for asymmetric algorithm verifying must be of type "public"`);
          if (b3.algorithm && "encrypt" === c3 && "private" === b3.type) throw TypeError(`${W.join(" or ")} instances for asymmetric algorithm encryption must be of type "public"`);
        })(a10, b2, c2);
      };
      async function aH(a10, b2, c2, d2, e2) {
        if (!(c2 instanceof Uint8Array)) throw TypeError(U(c2, "Uint8Array"));
        let g2 = parseInt(a10.slice(1, 4), 10), h2 = await f.subtle.importKey("raw", c2.subarray(g2 >> 3), "AES-CBC", false, ["encrypt"]), i2 = await f.subtle.importKey("raw", c2.subarray(0, g2 >> 3), { hash: `SHA-${g2 << 1}`, name: "HMAC" }, false, ["sign"]), k2 = new Uint8Array(await f.subtle.encrypt({ iv: d2, name: "AES-CBC" }, h2, b2)), m2 = j(e2, d2, k2, l(e2.length << 3));
        return { ciphertext: k2, tag: new Uint8Array((await f.subtle.sign("HMAC", i2, m2)).slice(0, g2 >> 3)) };
      }
      async function aI(a10, b2, c2, d2, e2) {
        let g2;
        c2 instanceof Uint8Array ? g2 = await f.subtle.importKey("raw", c2, "AES-GCM", false, ["encrypt"]) : (S(c2, a10, "encrypt"), g2 = c2);
        let h2 = new Uint8Array(await f.subtle.encrypt({ additionalData: e2, iv: d2, name: "AES-GCM", tagLength: 128 }, g2, b2)), i2 = h2.slice(-16);
        return { ciphertext: h2.slice(0, -16), tag: i2 };
      }
      let aJ = async (a10, b2, c2, d2, e2) => {
        if (!(c2 instanceof CryptoKey) && !(c2 instanceof Uint8Array)) throw TypeError(U(c2, ...W, "Uint8Array"));
        switch (M(a10, d2), a10) {
          case "A128CBC-HS256":
          case "A192CBC-HS384":
          case "A256CBC-HS512":
            return c2 instanceof Uint8Array && N(c2, parseInt(a10.slice(-3), 10)), aH(a10, b2, c2, d2, e2);
          case "A128GCM":
          case "A192GCM":
          case "A256GCM":
            return c2 instanceof Uint8Array && N(c2, parseInt(a10.slice(1, 4), 10)), aI(a10, b2, c2, d2, e2);
          default:
            throw new x("Unsupported JWE Content Encryption Algorithm");
        }
      };
      async function aK(a10, b2, c2, d2) {
        let e2 = a10.slice(0, 7);
        d2 || (d2 = L(e2));
        let { ciphertext: f2, tag: g2 } = await aJ(e2, c2, b2, d2, new Uint8Array(0));
        return { encryptedKey: f2, iv: q(d2), tag: q(g2) };
      }
      async function aL(a10, b2, c2, d2, e2) {
        return Z(a10.slice(0, 7), b2, c2, d2, e2, new Uint8Array(0));
      }
      async function aM(a10, b2, c2, d2, e2) {
        switch (aG(a10, b2, "decrypt"), a10) {
          case "dir":
            if (void 0 !== c2) throw new A("Encountered unexpected JWE Encrypted Key");
            return b2;
          case "ECDH-ES":
            if (void 0 !== c2) throw new A("Encountered unexpected JWE Encrypted Key");
          case "ECDH-ES+A128KW":
          case "ECDH-ES+A192KW":
          case "ECDH-ES+A256KW": {
            let e3, f2;
            if (!ab(d2.epk)) throw new A('JOSE Header "epk" (Ephemeral Public Key) missing or invalid');
            if (!aj(b2)) throw new x("ECDH with the provided key is not allowed or not supported by your javascript runtime");
            let g2 = await aF(d2.epk, a10);
            if (void 0 !== d2.apu) {
              if ("string" != typeof d2.apu) throw new A('JOSE Header "apu" (Agreement PartyUInfo) invalid');
              try {
                e3 = s(d2.apu);
              } catch (a11) {
                throw new A("Failed to base64url decode the apu");
              }
            }
            if (void 0 !== d2.apv) {
              if ("string" != typeof d2.apv) throw new A('JOSE Header "apv" (Agreement PartyVInfo) invalid');
              try {
                f2 = s(d2.apv);
              } catch (a11) {
                throw new A("Failed to base64url decode the apv");
              }
            }
            let h2 = await ah(g2, b2, "ECDH-ES" === a10 ? d2.enc : a10, "ECDH-ES" === a10 ? ar(d2.enc) : parseInt(a10.slice(-5, -2), 10), e3, f2);
            if ("ECDH-ES" === a10) return h2;
            if (void 0 === c2) throw new A("JWE Encrypted Key missing");
            return ag(a10.slice(-6), h2, c2);
          }
          case "RSA1_5":
          case "RSA-OAEP":
          case "RSA-OAEP-256":
          case "RSA-OAEP-384":
          case "RSA-OAEP-512":
            if (void 0 === c2) throw new A("JWE Encrypted Key missing");
            return aq(a10, b2, c2);
          case "PBES2-HS256+A128KW":
          case "PBES2-HS384+A192KW":
          case "PBES2-HS512+A256KW": {
            let f2;
            if (void 0 === c2) throw new A("JWE Encrypted Key missing");
            if ("number" != typeof d2.p2c) throw new A('JOSE Header "p2c" (PBES2 Count) missing or invalid');
            let g2 = (null == e2 ? void 0 : e2.maxPBES2Count) || 1e4;
            if (d2.p2c > g2) throw new A('JOSE Header "p2c" (PBES2 Count) out is of acceptable bounds');
            if ("string" != typeof d2.p2s) throw new A('JOSE Header "p2s" (PBES2 Salt) missing or invalid');
            try {
              f2 = s(d2.p2s);
            } catch (a11) {
              throw new A("Failed to base64url decode the p2s");
            }
            return am(a10, b2, c2, d2.p2c, f2);
          }
          case "A128KW":
          case "A192KW":
          case "A256KW":
            if (void 0 === c2) throw new A("JWE Encrypted Key missing");
            return ag(a10, b2, c2);
          case "A128GCMKW":
          case "A192GCMKW":
          case "A256GCMKW": {
            let e3, f2;
            if (void 0 === c2) throw new A("JWE Encrypted Key missing");
            if ("string" != typeof d2.iv) throw new A('JOSE Header "iv" (Initialization Vector) missing or invalid');
            if ("string" != typeof d2.tag) throw new A('JOSE Header "tag" (Authentication Tag) missing or invalid');
            try {
              e3 = s(d2.iv);
            } catch (a11) {
              throw new A("Failed to base64url decode the iv");
            }
            try {
              f2 = s(d2.tag);
            } catch (a11) {
              throw new A("Failed to base64url decode the tag");
            }
            return aL(a10, b2, c2, e3, f2);
          }
          default:
            throw new x('Invalid or unsupported "alg" (JWE Algorithm) header value');
        }
      }
      let aN = function(a10, b2, c2, d2, e2) {
        let f2;
        if (void 0 !== e2.crit && void 0 === d2.crit) throw new a10('"crit" (Critical) Header Parameter MUST be integrity protected');
        if (!d2 || void 0 === d2.crit) return /* @__PURE__ */ new Set();
        if (!Array.isArray(d2.crit) || 0 === d2.crit.length || d2.crit.some((a11) => "string" != typeof a11 || 0 === a11.length)) throw new a10('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
        for (let g2 of (f2 = void 0 !== c2 ? new Map([...Object.entries(c2), ...b2.entries()]) : b2, d2.crit)) {
          if (!f2.has(g2)) throw new x(`Extension Header Parameter "${g2}" is not recognized`);
          if (void 0 === e2[g2]) throw new a10(`Extension Header Parameter "${g2}" is missing`);
          if (f2.get(g2) && void 0 === d2[g2]) throw new a10(`Extension Header Parameter "${g2}" MUST be integrity protected`);
        }
        return new Set(d2.crit);
      }, aO = (a10, b2) => {
        if (void 0 !== b2 && (!Array.isArray(b2) || b2.some((a11) => "string" != typeof a11))) throw TypeError(`"${a10}" option must be an array of strings`);
        if (b2) return new Set(b2);
      };
      async function aP(a10, b2, c2) {
        var d2;
        let e2, f2, g2, k2, l2, m2, n2;
        if (!ab(a10)) throw new A("Flattened JWE must be an object");
        if (void 0 === a10.protected && void 0 === a10.header && void 0 === a10.unprotected) throw new A("JOSE Header missing");
        if ("string" != typeof a10.iv) throw new A("JWE Initialization Vector missing or incorrect type");
        if ("string" != typeof a10.ciphertext) throw new A("JWE Ciphertext missing or incorrect type");
        if ("string" != typeof a10.tag) throw new A("JWE Authentication Tag missing or incorrect type");
        if (void 0 !== a10.protected && "string" != typeof a10.protected) throw new A("JWE Protected Header incorrect type");
        if (void 0 !== a10.encrypted_key && "string" != typeof a10.encrypted_key) throw new A("JWE Encrypted Key incorrect type");
        if (void 0 !== a10.aad && "string" != typeof a10.aad) throw new A("JWE AAD incorrect type");
        if (void 0 !== a10.header && !ab(a10.header)) throw new A("JWE Shared Unprotected Header incorrect type");
        if (void 0 !== a10.unprotected && !ab(a10.unprotected)) throw new A("JWE Per-Recipient Unprotected Header incorrect type");
        if (a10.protected) try {
          let b3 = s(a10.protected);
          e2 = JSON.parse(i.decode(b3));
        } catch (a11) {
          throw new A("JWE Protected Header is invalid");
        }
        if (!aa(e2, a10.header, a10.unprotected)) throw new A("JWE Protected, JWE Unprotected Header, and JWE Per-Recipient Unprotected Header Parameter names must be disjoint");
        let o2 = { ...e2, ...a10.header, ...a10.unprotected };
        if (aN(A, /* @__PURE__ */ new Map(), null == c2 ? void 0 : c2.crit, e2, o2), void 0 !== o2.zip) {
          if (!e2 || !e2.zip) throw new A('JWE "zip" (Compression Algorithm) Header MUST be integrity protected');
          if ("DEF" !== o2.zip) throw new x('Unsupported JWE "zip" (Compression Algorithm) Header Parameter value');
        }
        let { alg: p2, enc: q2 } = o2;
        if ("string" != typeof p2 || !p2) throw new A("missing JWE Algorithm (alg) in JWE Header");
        if ("string" != typeof q2 || !q2) throw new A("missing JWE Encryption Algorithm (enc) in JWE Header");
        let r2 = c2 && aO("keyManagementAlgorithms", c2.keyManagementAlgorithms), t2 = c2 && aO("contentEncryptionAlgorithms", c2.contentEncryptionAlgorithms);
        if (r2 && !r2.has(p2)) throw new w('"alg" (Algorithm) Header Parameter not allowed');
        if (t2 && !t2.has(q2)) throw new w('"enc" (Encryption Algorithm) Header Parameter not allowed');
        if (void 0 !== a10.encrypted_key) try {
          f2 = s(a10.encrypted_key);
        } catch (a11) {
          throw new A("Failed to base64url decode the encrypted_key");
        }
        let u2 = false;
        "function" == typeof b2 && (b2 = await b2(e2, a10), u2 = true);
        try {
          g2 = await aM(p2, b2, f2, o2, c2);
        } catch (a11) {
          if (a11 instanceof TypeError || a11 instanceof A || a11 instanceof x) throw a11;
          g2 = as(q2);
        }
        try {
          k2 = s(a10.iv);
        } catch (a11) {
          throw new A("Failed to base64url decode the iv");
        }
        try {
          l2 = s(a10.tag);
        } catch (a11) {
          throw new A("Failed to base64url decode the tag");
        }
        let v2 = h.encode(null != (d2 = a10.protected) ? d2 : "");
        m2 = void 0 !== a10.aad ? j(v2, h.encode("."), h.encode(a10.aad)) : v2;
        try {
          n2 = s(a10.ciphertext);
        } catch (a11) {
          throw new A("Failed to base64url decode the ciphertext");
        }
        let y2 = await Z(q2, g2, n2, k2, l2, m2);
        "DEF" === o2.zip && (y2 = await ((null == c2 ? void 0 : c2.inflateRaw) || $)(y2));
        let z2 = { plaintext: y2 };
        if (void 0 !== a10.protected && (z2.protectedHeader = e2), void 0 !== a10.aad) try {
          z2.additionalAuthenticatedData = s(a10.aad);
        } catch (a11) {
          throw new A("Failed to base64url decode the aad");
        }
        return (void 0 !== a10.unprotected && (z2.sharedUnprotectedHeader = a10.unprotected), void 0 !== a10.header && (z2.unprotectedHeader = a10.header), u2) ? { ...z2, key: b2 } : z2;
      }
      async function aQ(a10, b2, c2) {
        if (a10 instanceof Uint8Array && (a10 = i.decode(a10)), "string" != typeof a10) throw new A("Compact JWE must be a string or Uint8Array");
        let { 0: d2, 1: e2, 2: f2, 3: g2, 4: h2, length: j2 } = a10.split(".");
        if (5 !== j2) throw new A("Invalid Compact JWE");
        let k2 = await aP({ ciphertext: g2, iv: f2 || void 0, protected: d2 || void 0, tag: h2 || void 0, encrypted_key: e2 || void 0 }, b2, c2), l2 = { plaintext: k2.plaintext, protectedHeader: k2.protectedHeader };
        return "function" == typeof b2 ? { ...l2, key: k2.key } : l2;
      }
      async function aR(a10, b2, c2) {
        if (!ab(a10)) throw new A("General JWE must be an object");
        if (!Array.isArray(a10.recipients) || !a10.recipients.every(ab)) throw new A("JWE Recipients missing or incorrect type");
        if (!a10.recipients.length) throw new A("JWE Recipients has no members");
        for (let d2 of a10.recipients) try {
          return await aP({ aad: a10.aad, ciphertext: a10.ciphertext, encrypted_key: d2.encrypted_key, header: d2.header, iv: a10.iv, protected: a10.protected, tag: a10.tag, unprotected: a10.unprotected }, b2, c2);
        } catch (a11) {
        }
        throw new y();
      }
      let aS = async (a10) => {
        if (a10 instanceof Uint8Array) return { kty: "oct", k: q(a10) };
        if (!(a10 instanceof CryptoKey)) throw TypeError(U(a10, ...W, "Uint8Array"));
        if (!a10.extractable) throw TypeError("non-extractable CryptoKey cannot be exported as a JWK");
        let { ext: b2, key_ops: c2, alg: d2, use: e2, ...g2 } = await f.subtle.exportKey("jwk", a10);
        return g2;
      };
      async function aT(a10) {
        return au("public", "spki", a10);
      }
      async function aU(a10) {
        return au("private", "pkcs8", a10);
      }
      async function aV(a10) {
        return aS(a10);
      }
      async function aW(a10, b2, c2, d2, e2 = {}) {
        let f2, g2, h2;
        switch (aG(a10, c2, "encrypt"), a10) {
          case "dir":
            h2 = c2;
            break;
          case "ECDH-ES":
          case "ECDH-ES+A128KW":
          case "ECDH-ES+A192KW":
          case "ECDH-ES+A256KW": {
            if (!aj(c2)) throw new x("ECDH with the provided key is not allowed or not supported by your javascript runtime");
            let { apu: i2, apv: j2 } = e2, { epk: k2 } = e2;
            k2 || (k2 = (await ai(c2)).privateKey);
            let { x: l2, y: m2, crv: n2, kty: o2 } = await aV(k2), p2 = await ah(c2, k2, "ECDH-ES" === a10 ? b2 : a10, "ECDH-ES" === a10 ? ar(b2) : parseInt(a10.slice(-5, -2), 10), i2, j2);
            if (g2 = { epk: { x: l2, crv: n2, kty: o2 } }, "EC" === o2 && (g2.epk.y = m2), i2 && (g2.apu = q(i2)), j2 && (g2.apv = q(j2)), "ECDH-ES" === a10) {
              h2 = p2;
              break;
            }
            h2 = d2 || as(b2);
            let r2 = a10.slice(-6);
            f2 = await af(r2, p2, h2);
            break;
          }
          case "RSA1_5":
          case "RSA-OAEP":
          case "RSA-OAEP-256":
          case "RSA-OAEP-384":
          case "RSA-OAEP-512":
            h2 = d2 || as(b2), f2 = await ap(a10, c2, h2);
            break;
          case "PBES2-HS256+A128KW":
          case "PBES2-HS384+A192KW":
          case "PBES2-HS512+A256KW": {
            h2 = d2 || as(b2);
            let { p2c: i2, p2s: j2 } = e2;
            ({ encryptedKey: f2, ...g2 } = await al(a10, c2, h2, i2, j2));
            break;
          }
          case "A128KW":
          case "A192KW":
          case "A256KW":
            h2 = d2 || as(b2), f2 = await af(a10, c2, h2);
            break;
          case "A128GCMKW":
          case "A192GCMKW":
          case "A256GCMKW": {
            h2 = d2 || as(b2);
            let { iv: i2 } = e2;
            ({ encryptedKey: f2, ...g2 } = await aK(a10, c2, h2, i2));
            break;
          }
          default:
            throw new x('Invalid or unsupported "alg" (JWE Algorithm) header value');
        }
        return { cek: h2, encryptedKey: f2, parameters: g2 };
      }
      let aX = Symbol();
      class aY {
        constructor(a10) {
          if (!(a10 instanceof Uint8Array)) throw TypeError("plaintext must be an instance of Uint8Array");
          this._plaintext = a10;
        }
        setKeyManagementParameters(a10) {
          if (this._keyManagementParameters) throw TypeError("setKeyManagementParameters can only be called once");
          return this._keyManagementParameters = a10, this;
        }
        setProtectedHeader(a10) {
          if (this._protectedHeader) throw TypeError("setProtectedHeader can only be called once");
          return this._protectedHeader = a10, this;
        }
        setSharedUnprotectedHeader(a10) {
          if (this._sharedUnprotectedHeader) throw TypeError("setSharedUnprotectedHeader can only be called once");
          return this._sharedUnprotectedHeader = a10, this;
        }
        setUnprotectedHeader(a10) {
          if (this._unprotectedHeader) throw TypeError("setUnprotectedHeader can only be called once");
          return this._unprotectedHeader = a10, this;
        }
        setAdditionalAuthenticatedData(a10) {
          return this._aad = a10, this;
        }
        setContentEncryptionKey(a10) {
          if (this._cek) throw TypeError("setContentEncryptionKey can only be called once");
          return this._cek = a10, this;
        }
        setInitializationVector(a10) {
          if (this._iv) throw TypeError("setInitializationVector can only be called once");
          return this._iv = a10, this;
        }
        async encrypt(a10, b2) {
          let c2, d2, e2, f2, g2, k2, l2;
          if (!this._protectedHeader && !this._unprotectedHeader && !this._sharedUnprotectedHeader) throw new A("either setProtectedHeader, setUnprotectedHeader, or sharedUnprotectedHeader must be called before #encrypt()");
          if (!aa(this._protectedHeader, this._unprotectedHeader, this._sharedUnprotectedHeader)) throw new A("JWE Protected, JWE Shared Unprotected and JWE Per-Recipient Header Parameter names must be disjoint");
          let m2 = { ...this._protectedHeader, ...this._unprotectedHeader, ...this._sharedUnprotectedHeader };
          if (aN(A, /* @__PURE__ */ new Map(), null == b2 ? void 0 : b2.crit, this._protectedHeader, m2), void 0 !== m2.zip) {
            if (!this._protectedHeader || !this._protectedHeader.zip) throw new A('JWE "zip" (Compression Algorithm) Header MUST be integrity protected');
            if ("DEF" !== m2.zip) throw new x('Unsupported JWE "zip" (Compression Algorithm) Header Parameter value');
          }
          let { alg: n2, enc: o2 } = m2;
          if ("string" != typeof n2 || !n2) throw new A('JWE "alg" (Algorithm) Header Parameter missing or invalid');
          if ("string" != typeof o2 || !o2) throw new A('JWE "enc" (Encryption Algorithm) Header Parameter missing or invalid');
          if ("dir" === n2) {
            if (this._cek) throw TypeError("setContentEncryptionKey cannot be called when using Direct Encryption");
          } else if ("ECDH-ES" === n2 && this._cek) throw TypeError("setContentEncryptionKey cannot be called when using Direct Key Agreement");
          {
            let e3;
            ({ cek: d2, encryptedKey: c2, parameters: e3 } = await aW(n2, o2, a10, this._cek, this._keyManagementParameters)), e3 && (b2 && aX in b2 ? this._unprotectedHeader ? this._unprotectedHeader = { ...this._unprotectedHeader, ...e3 } : this.setUnprotectedHeader(e3) : this._protectedHeader ? this._protectedHeader = { ...this._protectedHeader, ...e3 } : this.setProtectedHeader(e3));
          }
          if (this._iv || (this._iv = L(o2)), f2 = this._protectedHeader ? h.encode(q(JSON.stringify(this._protectedHeader))) : h.encode(""), this._aad ? (g2 = q(this._aad), e2 = j(f2, h.encode("."), h.encode(g2))) : e2 = f2, "DEF" === m2.zip) {
            let a11 = await ((null == b2 ? void 0 : b2.deflateRaw) || _)(this._plaintext);
            ({ ciphertext: k2, tag: l2 } = await aJ(o2, a11, d2, this._iv, e2));
          } else ({ ciphertext: k2, tag: l2 } = await aJ(o2, this._plaintext, d2, this._iv, e2));
          let p2 = { ciphertext: q(k2), iv: q(this._iv), tag: q(l2) };
          return c2 && (p2.encrypted_key = q(c2)), g2 && (p2.aad = g2), this._protectedHeader && (p2.protected = i.decode(f2)), this._sharedUnprotectedHeader && (p2.unprotected = this._sharedUnprotectedHeader), this._unprotectedHeader && (p2.header = this._unprotectedHeader), p2;
        }
      }
      class aZ {
        constructor(a10, b2, c2) {
          this.parent = a10, this.key = b2, this.options = c2;
        }
        setUnprotectedHeader(a10) {
          if (this.unprotectedHeader) throw TypeError("setUnprotectedHeader can only be called once");
          return this.unprotectedHeader = a10, this;
        }
        addRecipient(...a10) {
          return this.parent.addRecipient(...a10);
        }
        encrypt(...a10) {
          return this.parent.encrypt(...a10);
        }
        done() {
          return this.parent;
        }
      }
      class a$ {
        constructor(a10) {
          this._recipients = [], this._plaintext = a10;
        }
        addRecipient(a10, b2) {
          let c2 = new aZ(this, a10, { crit: null == b2 ? void 0 : b2.crit });
          return this._recipients.push(c2), c2;
        }
        setProtectedHeader(a10) {
          if (this._protectedHeader) throw TypeError("setProtectedHeader can only be called once");
          return this._protectedHeader = a10, this;
        }
        setSharedUnprotectedHeader(a10) {
          if (this._unprotectedHeader) throw TypeError("setSharedUnprotectedHeader can only be called once");
          return this._unprotectedHeader = a10, this;
        }
        setAdditionalAuthenticatedData(a10) {
          return this._aad = a10, this;
        }
        async encrypt(a10) {
          var b2, c2, d2;
          let e2;
          if (!this._recipients.length) throw new A("at least one recipient must be added");
          if (a10 = { deflateRaw: null == a10 ? void 0 : a10.deflateRaw }, 1 === this._recipients.length) {
            let [b3] = this._recipients, c3 = await new aY(this._plaintext).setAdditionalAuthenticatedData(this._aad).setProtectedHeader(this._protectedHeader).setSharedUnprotectedHeader(this._unprotectedHeader).setUnprotectedHeader(b3.unprotectedHeader).encrypt(b3.key, { ...b3.options, ...a10 }), d3 = { ciphertext: c3.ciphertext, iv: c3.iv, recipients: [{}], tag: c3.tag };
            return c3.aad && (d3.aad = c3.aad), c3.protected && (d3.protected = c3.protected), c3.unprotected && (d3.unprotected = c3.unprotected), c3.encrypted_key && (d3.recipients[0].encrypted_key = c3.encrypted_key), c3.header && (d3.recipients[0].header = c3.header), d3;
          }
          for (let a11 = 0; a11 < this._recipients.length; a11++) {
            let b3 = this._recipients[a11];
            if (!aa(this._protectedHeader, this._unprotectedHeader, b3.unprotectedHeader)) throw new A("JWE Protected, JWE Shared Unprotected and JWE Per-Recipient Header Parameter names must be disjoint");
            let c3 = { ...this._protectedHeader, ...this._unprotectedHeader, ...b3.unprotectedHeader }, { alg: d3 } = c3;
            if ("string" != typeof d3 || !d3) throw new A('JWE "alg" (Algorithm) Header Parameter missing or invalid');
            if ("dir" === d3 || "ECDH-ES" === d3) throw new A('"dir" and "ECDH-ES" alg may only be used with a single recipient');
            if ("string" != typeof c3.enc || !c3.enc) throw new A('JWE "enc" (Encryption Algorithm) Header Parameter missing or invalid');
            if (e2) {
              if (e2 !== c3.enc) throw new A('JWE "enc" (Encryption Algorithm) Header Parameter must be the same for all recipients');
            } else e2 = c3.enc;
            if (aN(A, /* @__PURE__ */ new Map(), b3.options.crit, this._protectedHeader, c3), void 0 !== c3.zip && (!this._protectedHeader || !this._protectedHeader.zip)) throw new A('JWE "zip" (Compression Algorithm) Header MUST be integrity protected');
          }
          let f2 = as(e2), g2 = { ciphertext: "", iv: "", recipients: [], tag: "" };
          for (let h2 = 0; h2 < this._recipients.length; h2++) {
            let i2 = this._recipients[h2], j2 = {};
            g2.recipients.push(j2);
            let k2 = { ...this._protectedHeader, ...this._unprotectedHeader, ...i2.unprotectedHeader }.alg.startsWith("PBES2") ? 2048 + h2 : void 0;
            if (0 === h2) {
              let b3 = await new aY(this._plaintext).setAdditionalAuthenticatedData(this._aad).setContentEncryptionKey(f2).setProtectedHeader(this._protectedHeader).setSharedUnprotectedHeader(this._unprotectedHeader).setUnprotectedHeader(i2.unprotectedHeader).setKeyManagementParameters({ p2c: k2 }).encrypt(i2.key, { ...i2.options, ...a10, [aX]: true });
              g2.ciphertext = b3.ciphertext, g2.iv = b3.iv, g2.tag = b3.tag, b3.aad && (g2.aad = b3.aad), b3.protected && (g2.protected = b3.protected), b3.unprotected && (g2.unprotected = b3.unprotected), j2.encrypted_key = b3.encrypted_key, b3.header && (j2.header = b3.header);
              continue;
            }
            let { encryptedKey: l2, parameters: m2 } = await aW((null == (b2 = i2.unprotectedHeader) ? void 0 : b2.alg) || (null == (c2 = this._protectedHeader) ? void 0 : c2.alg) || (null == (d2 = this._unprotectedHeader) ? void 0 : d2.alg), e2, i2.key, f2, { p2c: k2 });
            j2.encrypted_key = q(l2), (i2.unprotectedHeader || m2) && (j2.header = { ...i2.unprotectedHeader, ...m2 });
          }
          return g2;
        }
      }
      function a_(a10, b2) {
        let c2 = `SHA-${a10.slice(-3)}`;
        switch (a10) {
          case "HS256":
          case "HS384":
          case "HS512":
            return { hash: c2, name: "HMAC" };
          case "PS256":
          case "PS384":
          case "PS512":
            return { hash: c2, name: "RSA-PSS", saltLength: a10.slice(-3) >> 3 };
          case "RS256":
          case "RS384":
          case "RS512":
            return { hash: c2, name: "RSASSA-PKCS1-v1_5" };
          case "ES256":
          case "ES384":
          case "ES512":
            return { hash: c2, name: "ECDSA", namedCurve: b2.namedCurve };
          case "EdDSA":
            return { name: b2.name };
          default:
            throw new x(`alg ${a10} is not supported either by JOSE or your javascript runtime`);
        }
      }
      function a0(a10, b2, c2) {
        if (b2 instanceof CryptoKey) return !function(a11, b3, ...c3) {
          switch (b3) {
            case "HS256":
            case "HS384":
            case "HS512": {
              if (!P(a11.algorithm, "HMAC")) throw O("HMAC");
              let c4 = parseInt(b3.slice(2), 10);
              if (Q(a11.algorithm.hash) !== c4) throw O(`SHA-${c4}`, "algorithm.hash");
              break;
            }
            case "RS256":
            case "RS384":
            case "RS512": {
              if (!P(a11.algorithm, "RSASSA-PKCS1-v1_5")) throw O("RSASSA-PKCS1-v1_5");
              let c4 = parseInt(b3.slice(2), 10);
              if (Q(a11.algorithm.hash) !== c4) throw O(`SHA-${c4}`, "algorithm.hash");
              break;
            }
            case "PS256":
            case "PS384":
            case "PS512": {
              if (!P(a11.algorithm, "RSA-PSS")) throw O("RSA-PSS");
              let c4 = parseInt(b3.slice(2), 10);
              if (Q(a11.algorithm.hash) !== c4) throw O(`SHA-${c4}`, "algorithm.hash");
              break;
            }
            case "EdDSA":
              if ("Ed25519" !== a11.algorithm.name && "Ed448" !== a11.algorithm.name) throw O("Ed25519 or Ed448");
              break;
            case "ES256":
            case "ES384":
            case "ES512": {
              if (!P(a11.algorithm, "ECDSA")) throw O("ECDSA");
              let c4 = function(a12) {
                switch (a12) {
                  case "ES256":
                    return "P-256";
                  case "ES384":
                    return "P-384";
                  case "ES512":
                    return "P-521";
                  default:
                    throw Error("unreachable");
                }
              }(b3);
              if (a11.algorithm.namedCurve !== c4) throw O(c4, "algorithm.namedCurve");
              break;
            }
            default:
              throw TypeError("CryptoKey does not support this operation");
          }
          R(a11, c3);
        }(b2, a10, c2), b2;
        if (b2 instanceof Uint8Array) {
          if (!a10.startsWith("HS")) throw TypeError(U(b2, ...W));
          return f.subtle.importKey("raw", b2, { hash: `SHA-${a10.slice(-3)}`, name: "HMAC" }, false, [c2]);
        }
        throw TypeError(U(b2, ...W, "Uint8Array"));
      }
      let a1 = async (a10, b2, c2, d2) => {
        let e2 = await a0(a10, b2, "verify");
        ao(a10, e2);
        let g2 = a_(a10, e2.algorithm);
        try {
          return await f.subtle.verify(g2, e2, c2, d2);
        } catch (a11) {
          return false;
        }
      };
      async function a2(a10, b2, c2) {
        var d2;
        let e2, f2;
        if (!ab(a10)) throw new B("Flattened JWS must be an object");
        if (void 0 === a10.protected && void 0 === a10.header) throw new B('Flattened JWS must have either of the "protected" or "header" members');
        if (void 0 !== a10.protected && "string" != typeof a10.protected) throw new B("JWS Protected Header incorrect type");
        if (void 0 === a10.payload) throw new B("JWS Payload missing");
        if ("string" != typeof a10.signature) throw new B("JWS Signature missing or incorrect type");
        if (void 0 !== a10.header && !ab(a10.header)) throw new B("JWS Unprotected Header incorrect type");
        let g2 = {};
        if (a10.protected) try {
          let b3 = s(a10.protected);
          g2 = JSON.parse(i.decode(b3));
        } catch (a11) {
          throw new B("JWS Protected Header is invalid");
        }
        if (!aa(g2, a10.header)) throw new B("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
        let k2 = { ...g2, ...a10.header }, l2 = aN(B, /* @__PURE__ */ new Map([["b64", true]]), null == c2 ? void 0 : c2.crit, g2, k2), m2 = true;
        if (l2.has("b64") && "boolean" != typeof (m2 = g2.b64)) throw new B('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
        let { alg: n2 } = k2;
        if ("string" != typeof n2 || !n2) throw new B('JWS "alg" (Algorithm) Header Parameter missing or invalid');
        let o2 = c2 && aO("algorithms", c2.algorithms);
        if (o2 && !o2.has(n2)) throw new w('"alg" (Algorithm) Header Parameter not allowed');
        if (m2) {
          if ("string" != typeof a10.payload) throw new B("JWS Payload must be a string");
        } else if ("string" != typeof a10.payload && !(a10.payload instanceof Uint8Array)) throw new B("JWS Payload must be a string or an Uint8Array instance");
        let p2 = false;
        "function" == typeof b2 && (b2 = await b2(g2, a10), p2 = true), aG(n2, b2, "verify");
        let q2 = j(h.encode(null != (d2 = a10.protected) ? d2 : ""), h.encode("."), "string" == typeof a10.payload ? h.encode(a10.payload) : a10.payload);
        try {
          e2 = s(a10.signature);
        } catch (a11) {
          throw new B("Failed to base64url decode the signature");
        }
        if (!await a1(n2, b2, e2, q2)) throw new I();
        if (m2) try {
          f2 = s(a10.payload);
        } catch (a11) {
          throw new B("Failed to base64url decode the payload");
        }
        else f2 = "string" == typeof a10.payload ? h.encode(a10.payload) : a10.payload;
        let r2 = { payload: f2 };
        return (void 0 !== a10.protected && (r2.protectedHeader = g2), void 0 !== a10.header && (r2.unprotectedHeader = a10.header), p2) ? { ...r2, key: b2 } : r2;
      }
      async function a3(a10, b2, c2) {
        if (a10 instanceof Uint8Array && (a10 = i.decode(a10)), "string" != typeof a10) throw new B("Compact JWS must be a string or Uint8Array");
        let { 0: d2, 1: e2, 2: f2, length: g2 } = a10.split(".");
        if (3 !== g2) throw new B("Invalid Compact JWS");
        let h2 = await a2({ payload: e2, protected: d2, signature: f2 }, b2, c2), j2 = { payload: h2.payload, protectedHeader: h2.protectedHeader };
        return "function" == typeof b2 ? { ...j2, key: h2.key } : j2;
      }
      async function a4(a10, b2, c2) {
        if (!ab(a10)) throw new B("General JWS must be an object");
        if (!Array.isArray(a10.signatures) || !a10.signatures.every(ab)) throw new B("JWS Signatures missing or incorrect type");
        for (let d2 of a10.signatures) try {
          return await a2({ header: d2.header, payload: a10.payload, protected: d2.protected, signature: d2.signature }, b2, c2);
        } catch (a11) {
        }
        throw new I();
      }
      let a5 = (a10) => Math.floor(a10.getTime() / 1e3), a6 = /^(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)$/i, a7 = (a10) => {
        let b2 = a6.exec(a10);
        if (!b2) throw TypeError("Invalid time period format");
        let c2 = parseFloat(b2[1]);
        switch (b2[2].toLowerCase()) {
          case "sec":
          case "secs":
          case "second":
          case "seconds":
          case "s":
            return Math.round(c2);
          case "minute":
          case "minutes":
          case "min":
          case "mins":
          case "m":
            return Math.round(60 * c2);
          case "hour":
          case "hours":
          case "hr":
          case "hrs":
          case "h":
            return Math.round(3600 * c2);
          case "day":
          case "days":
          case "d":
            return Math.round(86400 * c2);
          case "week":
          case "weeks":
          case "w":
            return Math.round(604800 * c2);
          default:
            return Math.round(31557600 * c2);
        }
      }, a8 = (a10) => a10.toLowerCase().replace(/^application\//, ""), a9 = (a10, b2, c2 = {}) => {
        let d2, e2, { typ: f2 } = c2;
        if (f2 && ("string" != typeof a10.typ || a8(a10.typ) !== a8(f2))) throw new u('unexpected "typ" JWT header value', "typ", "check_failed");
        try {
          d2 = JSON.parse(i.decode(b2));
        } catch (a11) {
        }
        if (!ab(d2)) throw new C("JWT Claims Set must be a top-level JSON object");
        let { requiredClaims: g2 = [], issuer: h2, subject: j2, audience: k2, maxTokenAge: l2 } = c2;
        for (let a11 of (void 0 !== l2 && g2.push("iat"), void 0 !== k2 && g2.push("aud"), void 0 !== j2 && g2.push("sub"), void 0 !== h2 && g2.push("iss"), new Set(g2.reverse()))) if (!(a11 in d2)) throw new u(`missing required "${a11}" claim`, a11, "missing");
        if (h2 && !(Array.isArray(h2) ? h2 : [h2]).includes(d2.iss)) throw new u('unexpected "iss" claim value', "iss", "check_failed");
        if (j2 && d2.sub !== j2) throw new u('unexpected "sub" claim value', "sub", "check_failed");
        if (k2 && !((a11, b3) => "string" == typeof a11 ? b3.includes(a11) : !!Array.isArray(a11) && b3.some(Set.prototype.has.bind(new Set(a11))))(d2.aud, "string" == typeof k2 ? [k2] : k2)) throw new u('unexpected "aud" claim value', "aud", "check_failed");
        switch (typeof c2.clockTolerance) {
          case "string":
            e2 = a7(c2.clockTolerance);
            break;
          case "number":
            e2 = c2.clockTolerance;
            break;
          case "undefined":
            e2 = 0;
            break;
          default:
            throw TypeError("Invalid clockTolerance option type");
        }
        let { currentDate: m2 } = c2, n2 = a5(m2 || /* @__PURE__ */ new Date());
        if ((void 0 !== d2.iat || l2) && "number" != typeof d2.iat) throw new u('"iat" claim must be a number', "iat", "invalid");
        if (void 0 !== d2.nbf) {
          if ("number" != typeof d2.nbf) throw new u('"nbf" claim must be a number', "nbf", "invalid");
          if (d2.nbf > n2 + e2) throw new u('"nbf" claim timestamp check failed', "nbf", "check_failed");
        }
        if (void 0 !== d2.exp) {
          if ("number" != typeof d2.exp) throw new u('"exp" claim must be a number', "exp", "invalid");
          if (d2.exp <= n2 - e2) throw new v('"exp" claim timestamp check failed', "exp", "check_failed");
        }
        if (l2) {
          let a11 = n2 - d2.iat;
          if (a11 - e2 > ("number" == typeof l2 ? l2 : a7(l2))) throw new v('"iat" claim timestamp check failed (too far in the past)', "iat", "check_failed");
          if (a11 < 0 - e2) throw new u('"iat" claim timestamp check failed (it should be in the past)', "iat", "check_failed");
        }
        return d2;
      };
      async function ba(a10, b2, c2) {
        var d2;
        let e2 = await a3(a10, b2, c2);
        if ((null == (d2 = e2.protectedHeader.crit) ? void 0 : d2.includes("b64")) && false === e2.protectedHeader.b64) throw new C("JWTs MUST NOT use unencoded payload");
        let f2 = { payload: a9(e2.protectedHeader, e2.payload, c2), protectedHeader: e2.protectedHeader };
        return "function" == typeof b2 ? { ...f2, key: e2.key } : f2;
      }
      async function bb(a10, b2, c2) {
        let d2 = await aQ(a10, b2, c2), e2 = a9(d2.protectedHeader, d2.plaintext, c2), { protectedHeader: f2 } = d2;
        if (void 0 !== f2.iss && f2.iss !== e2.iss) throw new u('replicated "iss" claim header parameter mismatch', "iss", "mismatch");
        if (void 0 !== f2.sub && f2.sub !== e2.sub) throw new u('replicated "sub" claim header parameter mismatch', "sub", "mismatch");
        if (void 0 !== f2.aud && JSON.stringify(f2.aud) !== JSON.stringify(e2.aud)) throw new u('replicated "aud" claim header parameter mismatch', "aud", "mismatch");
        let g2 = { payload: e2, protectedHeader: f2 };
        return "function" == typeof b2 ? { ...g2, key: d2.key } : g2;
      }
      class bc {
        constructor(a10) {
          this._flattened = new aY(a10);
        }
        setContentEncryptionKey(a10) {
          return this._flattened.setContentEncryptionKey(a10), this;
        }
        setInitializationVector(a10) {
          return this._flattened.setInitializationVector(a10), this;
        }
        setProtectedHeader(a10) {
          return this._flattened.setProtectedHeader(a10), this;
        }
        setKeyManagementParameters(a10) {
          return this._flattened.setKeyManagementParameters(a10), this;
        }
        async encrypt(a10, b2) {
          let c2 = await this._flattened.encrypt(a10, b2);
          return [c2.protected, c2.encrypted_key, c2.iv, c2.ciphertext, c2.tag].join(".");
        }
      }
      let bd = async (a10, b2, c2) => {
        let d2 = await a0(a10, b2, "sign");
        return ao(a10, d2), new Uint8Array(await f.subtle.sign(a_(a10, d2.algorithm), d2, c2));
      };
      class be {
        constructor(a10) {
          if (!(a10 instanceof Uint8Array)) throw TypeError("payload must be an instance of Uint8Array");
          this._payload = a10;
        }
        setProtectedHeader(a10) {
          if (this._protectedHeader) throw TypeError("setProtectedHeader can only be called once");
          return this._protectedHeader = a10, this;
        }
        setUnprotectedHeader(a10) {
          if (this._unprotectedHeader) throw TypeError("setUnprotectedHeader can only be called once");
          return this._unprotectedHeader = a10, this;
        }
        async sign(a10, b2) {
          let c2;
          if (!this._protectedHeader && !this._unprotectedHeader) throw new B("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
          if (!aa(this._protectedHeader, this._unprotectedHeader)) throw new B("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
          let d2 = { ...this._protectedHeader, ...this._unprotectedHeader }, e2 = aN(B, /* @__PURE__ */ new Map([["b64", true]]), null == b2 ? void 0 : b2.crit, this._protectedHeader, d2), f2 = true;
          if (e2.has("b64") && "boolean" != typeof (f2 = this._protectedHeader.b64)) throw new B('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
          let { alg: g2 } = d2;
          if ("string" != typeof g2 || !g2) throw new B('JWS "alg" (Algorithm) Header Parameter missing or invalid');
          aG(g2, a10, "sign");
          let k2 = this._payload;
          f2 && (k2 = h.encode(q(k2)));
          let l2 = j(c2 = this._protectedHeader ? h.encode(q(JSON.stringify(this._protectedHeader))) : h.encode(""), h.encode("."), k2), m2 = { signature: q(await bd(g2, a10, l2)), payload: "" };
          return f2 && (m2.payload = i.decode(k2)), this._unprotectedHeader && (m2.header = this._unprotectedHeader), this._protectedHeader && (m2.protected = i.decode(c2)), m2;
        }
      }
      class bf {
        constructor(a10) {
          this._flattened = new be(a10);
        }
        setProtectedHeader(a10) {
          return this._flattened.setProtectedHeader(a10), this;
        }
        async sign(a10, b2) {
          let c2 = await this._flattened.sign(a10, b2);
          if (void 0 === c2.payload) throw TypeError("use the flattened module for creating JWS with b64: false");
          return `${c2.protected}.${c2.payload}.${c2.signature}`;
        }
      }
      class bg {
        constructor(a10, b2, c2) {
          this.parent = a10, this.key = b2, this.options = c2;
        }
        setProtectedHeader(a10) {
          if (this.protectedHeader) throw TypeError("setProtectedHeader can only be called once");
          return this.protectedHeader = a10, this;
        }
        setUnprotectedHeader(a10) {
          if (this.unprotectedHeader) throw TypeError("setUnprotectedHeader can only be called once");
          return this.unprotectedHeader = a10, this;
        }
        addSignature(...a10) {
          return this.parent.addSignature(...a10);
        }
        sign(...a10) {
          return this.parent.sign(...a10);
        }
        done() {
          return this.parent;
        }
      }
      class bh {
        constructor(a10) {
          this._signatures = [], this._payload = a10;
        }
        addSignature(a10, b2) {
          let c2 = new bg(this, a10, b2);
          return this._signatures.push(c2), c2;
        }
        async sign() {
          if (!this._signatures.length) throw new B("at least one signature must be added");
          let a10 = { signatures: [], payload: "" };
          for (let b2 = 0; b2 < this._signatures.length; b2++) {
            let c2 = this._signatures[b2], d2 = new be(this._payload);
            d2.setProtectedHeader(c2.protectedHeader), d2.setUnprotectedHeader(c2.unprotectedHeader);
            let { payload: e2, ...f2 } = await d2.sign(c2.key, c2.options);
            if (0 === b2) a10.payload = e2;
            else if (a10.payload !== e2) throw new B("inconsistent use of JWS Unencoded Payload (RFC7797)");
            a10.signatures.push(f2);
          }
          return a10;
        }
      }
      class bi {
        constructor(a10) {
          if (!ab(a10)) throw TypeError("JWT Claims Set MUST be an object");
          this._payload = a10;
        }
        setIssuer(a10) {
          return this._payload = { ...this._payload, iss: a10 }, this;
        }
        setSubject(a10) {
          return this._payload = { ...this._payload, sub: a10 }, this;
        }
        setAudience(a10) {
          return this._payload = { ...this._payload, aud: a10 }, this;
        }
        setJti(a10) {
          return this._payload = { ...this._payload, jti: a10 }, this;
        }
        setNotBefore(a10) {
          return "number" == typeof a10 ? this._payload = { ...this._payload, nbf: a10 } : this._payload = { ...this._payload, nbf: a5(/* @__PURE__ */ new Date()) + a7(a10) }, this;
        }
        setExpirationTime(a10) {
          return "number" == typeof a10 ? this._payload = { ...this._payload, exp: a10 } : this._payload = { ...this._payload, exp: a5(/* @__PURE__ */ new Date()) + a7(a10) }, this;
        }
        setIssuedAt(a10) {
          return void 0 === a10 ? this._payload = { ...this._payload, iat: a5(/* @__PURE__ */ new Date()) } : this._payload = { ...this._payload, iat: a10 }, this;
        }
      }
      class bj extends bi {
        setProtectedHeader(a10) {
          return this._protectedHeader = a10, this;
        }
        async sign(a10, b2) {
          var c2;
          let d2 = new bf(h.encode(JSON.stringify(this._payload)));
          if (d2.setProtectedHeader(this._protectedHeader), Array.isArray(null == (c2 = this._protectedHeader) ? void 0 : c2.crit) && this._protectedHeader.crit.includes("b64") && false === this._protectedHeader.b64) throw new C("JWTs MUST NOT use unencoded payload");
          return d2.sign(a10, b2);
        }
      }
      class bk extends bi {
        setProtectedHeader(a10) {
          if (this._protectedHeader) throw TypeError("setProtectedHeader can only be called once");
          return this._protectedHeader = a10, this;
        }
        setKeyManagementParameters(a10) {
          if (this._keyManagementParameters) throw TypeError("setKeyManagementParameters can only be called once");
          return this._keyManagementParameters = a10, this;
        }
        setContentEncryptionKey(a10) {
          if (this._cek) throw TypeError("setContentEncryptionKey can only be called once");
          return this._cek = a10, this;
        }
        setInitializationVector(a10) {
          if (this._iv) throw TypeError("setInitializationVector can only be called once");
          return this._iv = a10, this;
        }
        replicateIssuerAsHeader() {
          return this._replicateIssuerAsHeader = true, this;
        }
        replicateSubjectAsHeader() {
          return this._replicateSubjectAsHeader = true, this;
        }
        replicateAudienceAsHeader() {
          return this._replicateAudienceAsHeader = true, this;
        }
        async encrypt(a10, b2) {
          let c2 = new bc(h.encode(JSON.stringify(this._payload)));
          return this._replicateIssuerAsHeader && (this._protectedHeader = { ...this._protectedHeader, iss: this._payload.iss }), this._replicateSubjectAsHeader && (this._protectedHeader = { ...this._protectedHeader, sub: this._payload.sub }), this._replicateAudienceAsHeader && (this._protectedHeader = { ...this._protectedHeader, aud: this._payload.aud }), c2.setProtectedHeader(this._protectedHeader), this._iv && c2.setInitializationVector(this._iv), this._cek && c2.setContentEncryptionKey(this._cek), this._keyManagementParameters && c2.setKeyManagementParameters(this._keyManagementParameters), c2.encrypt(a10, b2);
        }
      }
      let bl = (a10, b2) => {
        if ("string" != typeof a10 || !a10) throw new D(`${b2} missing or invalid`);
      };
      async function bm(a10, b2) {
        let c2;
        if (!ab(a10)) throw TypeError("JWK must be an object");
        if (null != b2 || (b2 = "sha256"), "sha256" !== b2 && "sha384" !== b2 && "sha512" !== b2) throw TypeError('digestAlgorithm must one of "sha256", "sha384", or "sha512"');
        switch (a10.kty) {
          case "EC":
            bl(a10.crv, '"crv" (Curve) Parameter'), bl(a10.x, '"x" (X Coordinate) Parameter'), bl(a10.y, '"y" (Y Coordinate) Parameter'), c2 = { crv: a10.crv, kty: a10.kty, x: a10.x, y: a10.y };
            break;
          case "OKP":
            bl(a10.crv, '"crv" (Subtype of Key Pair) Parameter'), bl(a10.x, '"x" (Public Key) Parameter'), c2 = { crv: a10.crv, kty: a10.kty, x: a10.x };
            break;
          case "RSA":
            bl(a10.e, '"e" (Exponent) Parameter'), bl(a10.n, '"n" (Modulus) Parameter'), c2 = { e: a10.e, kty: a10.kty, n: a10.n };
            break;
          case "oct":
            bl(a10.k, '"k" (Key Value) Parameter'), c2 = { k: a10.k, kty: a10.kty };
            break;
          default:
            throw new x('"kty" (Key Type) Parameter missing or unsupported');
        }
        let d2 = h.encode(JSON.stringify(c2));
        return q(await g(b2, d2));
      }
      async function bn(a10, b2) {
        null != b2 || (b2 = "sha256");
        let c2 = await bm(a10, b2);
        return `urn:ietf:params:oauth:jwk-thumbprint:sha-${b2.slice(-3)}:${c2}`;
      }
      async function bo(a10, b2) {
        let c2 = { ...a10, ...null == b2 ? void 0 : b2.header };
        if (!ab(c2.jwk)) throw new B('"jwk" (JSON Web Key) Header Parameter must be a JSON object');
        let d2 = await aF({ ...c2.jwk, ext: true }, c2.alg, true);
        if (d2 instanceof Uint8Array || "public" !== d2.type) throw new B('"jwk" (JSON Web Key) Header Parameter must be a public key');
        return d2;
      }
      function bp(a10) {
        return a10 && "object" == typeof a10 && Array.isArray(a10.keys) && a10.keys.every(bq);
      }
      function bq(a10) {
        return ab(a10);
      }
      class br {
        constructor(a10) {
          if (this._cached = /* @__PURE__ */ new WeakMap(), !bp(a10)) throw new E("JSON Web Key Set malformed");
          this._jwks = function(a11) {
            return "function" == typeof structuredClone ? structuredClone(a11) : JSON.parse(JSON.stringify(a11));
          }(a10);
        }
        async getKey(a10, b2) {
          let { alg: c2, kid: d2 } = { ...a10, ...null == b2 ? void 0 : b2.header }, e2 = function(a11) {
            switch ("string" == typeof a11 && a11.slice(0, 2)) {
              case "RS":
              case "PS":
                return "RSA";
              case "ES":
                return "EC";
              case "Ed":
                return "OKP";
              default:
                throw new x('Unsupported "alg" value for a JSON Web Key Set');
            }
          }(c2), f2 = this._jwks.keys.filter((a11) => {
            let b3 = e2 === a11.kty;
            if (b3 && "string" == typeof d2 && (b3 = d2 === a11.kid), b3 && "string" == typeof a11.alg && (b3 = c2 === a11.alg), b3 && "string" == typeof a11.use && (b3 = "sig" === a11.use), b3 && Array.isArray(a11.key_ops) && (b3 = a11.key_ops.includes("verify")), b3 && "EdDSA" === c2 && (b3 = "Ed25519" === a11.crv || "Ed448" === a11.crv), b3) switch (c2) {
              case "ES256":
                b3 = "P-256" === a11.crv;
                break;
              case "ES256K":
                b3 = "secp256k1" === a11.crv;
                break;
              case "ES384":
                b3 = "P-384" === a11.crv;
                break;
              case "ES512":
                b3 = "P-521" === a11.crv;
            }
            return b3;
          }), { 0: g2, length: h2 } = f2;
          if (0 === h2) throw new F();
          if (1 !== h2) {
            let a11 = new G(), { _cached: b3 } = this;
            throw a11[Symbol.asyncIterator] = async function* () {
              for (let a12 of f2) try {
                yield await bs(b3, a12, c2);
              } catch (a13) {
                continue;
              }
            }, a11;
          }
          return bs(this._cached, g2, c2);
        }
      }
      async function bs(a10, b2, c2) {
        let d2 = a10.get(b2) || a10.set(b2, {}).get(b2);
        if (void 0 === d2[c2]) {
          let a11 = await aF({ ...b2, ext: true }, c2);
          if (a11 instanceof Uint8Array || "public" !== a11.type) throw new E("JSON Web Key Set members must be public keys");
          d2[c2] = a11;
        }
        return d2[c2];
      }
      function bt(a10) {
        let b2 = new br(a10);
        return async function(a11, c2) {
          return b2.getKey(a11, c2);
        };
      }
      let bu = async (a10, b2, c2) => {
        let d2, e2, f2 = false;
        "function" == typeof AbortController && (d2 = new AbortController(), e2 = setTimeout(() => {
          f2 = true, d2.abort();
        }, b2));
        let g2 = await fetch(a10.href, { signal: d2 ? d2.signal : void 0, redirect: "manual", headers: c2.headers }).catch((a11) => {
          if (f2) throw new H();
          throw a11;
        });
        if (void 0 !== e2 && clearTimeout(e2), 200 !== g2.status) throw new t("Expected 200 OK from the JSON Web Key Set HTTP response");
        try {
          return await g2.json();
        } catch (a11) {
          throw new t("Failed to parse the JSON Web Key Set HTTP response as JSON");
        }
      };
      class bv extends br {
        constructor(a10, b2) {
          if (super({ keys: [] }), this._jwks = void 0, !(a10 instanceof URL)) throw TypeError("url must be an instance of URL");
          this._url = new URL(a10.href), this._options = { agent: null == b2 ? void 0 : b2.agent, headers: null == b2 ? void 0 : b2.headers }, this._timeoutDuration = "number" == typeof (null == b2 ? void 0 : b2.timeoutDuration) ? null == b2 ? void 0 : b2.timeoutDuration : 5e3, this._cooldownDuration = "number" == typeof (null == b2 ? void 0 : b2.cooldownDuration) ? null == b2 ? void 0 : b2.cooldownDuration : 3e4, this._cacheMaxAge = "number" == typeof (null == b2 ? void 0 : b2.cacheMaxAge) ? null == b2 ? void 0 : b2.cacheMaxAge : 6e5;
        }
        coolingDown() {
          return "number" == typeof this._jwksTimestamp && Date.now() < this._jwksTimestamp + this._cooldownDuration;
        }
        fresh() {
          return "number" == typeof this._jwksTimestamp && Date.now() < this._jwksTimestamp + this._cacheMaxAge;
        }
        async getKey(a10, b2) {
          this._jwks && this.fresh() || await this.reload();
          try {
            return await super.getKey(a10, b2);
          } catch (c2) {
            if (c2 instanceof F && false === this.coolingDown()) return await this.reload(), super.getKey(a10, b2);
            throw c2;
          }
        }
        async reload() {
          this._pendingFetch && ("undefined" != typeof WebSocketPair || "undefined" != typeof navigator && "Cloudflare-Workers" === navigator.userAgent) && (this._pendingFetch = void 0), this._pendingFetch || (this._pendingFetch = bu(this._url, this._timeoutDuration, this._options).then((a10) => {
            if (!bp(a10)) throw new E("JSON Web Key Set malformed");
            this._jwks = { keys: a10.keys }, this._jwksTimestamp = Date.now(), this._pendingFetch = void 0;
          }).catch((a10) => {
            throw this._pendingFetch = void 0, a10;
          })), await this._pendingFetch;
        }
      }
      function bw(a10, b2) {
        let c2 = new bv(a10, b2);
        return async function(a11, b3) {
          return c2.getKey(a11, b3);
        };
      }
      class bx extends bi {
        encode() {
          let a10 = q(JSON.stringify({ alg: "none" })), b2 = q(JSON.stringify(this._payload));
          return `${a10}.${b2}.`;
        }
        static decode(a10, b2) {
          let c2;
          if ("string" != typeof a10) throw new C("Unsecured JWT must be a string");
          let { 0: d2, 1: e2, 2: f2, length: g2 } = a10.split(".");
          if (3 !== g2 || "" !== f2) throw new C("Invalid Unsecured JWT");
          try {
            if (c2 = JSON.parse(i.decode(s(d2))), "none" !== c2.alg) throw Error();
          } catch (a11) {
            throw new C("Invalid Unsecured JWT");
          }
          return { payload: a9(c2, s(e2), b2), header: c2 };
        }
      }
      let by = q, bz = s;
      function bA(a10) {
        let b2;
        if ("string" == typeof a10) {
          let c2 = a10.split(".");
          (3 === c2.length || 5 === c2.length) && ([b2] = c2);
        } else if ("object" == typeof a10 && a10) if ("protected" in a10) b2 = a10.protected;
        else throw TypeError("Token does not contain a Protected Header");
        try {
          if ("string" != typeof b2 || !b2) throw Error();
          let a11 = JSON.parse(i.decode(bz(b2)));
          if (!ab(a11)) throw Error();
          return a11;
        } catch (a11) {
          throw TypeError("Invalid Token or Protected Header formatting");
        }
      }
      function bB(a10) {
        let b2, c2;
        if ("string" != typeof a10) throw new C("JWTs must use Compact JWS serialization, JWT must be a string");
        let { 1: d2, length: e2 } = a10.split(".");
        if (5 === e2) throw new C("Only JWTs using Compact JWS serialization can be decoded");
        if (3 !== e2) throw new C("Invalid JWT");
        if (!d2) throw new C("JWTs must contain a payload");
        try {
          b2 = bz(d2);
        } catch (a11) {
          throw new C("Failed to base64url decode the payload");
        }
        try {
          c2 = JSON.parse(i.decode(b2));
        } catch (a11) {
          throw new C("Failed to parse the decoded payload as JSON");
        }
        if (!ab(c2)) throw new C("Invalid JWT Claims Set");
        return c2;
      }
      async function bC(a10, b2) {
        var c2;
        let d2, e2, g2;
        switch (a10) {
          case "HS256":
          case "HS384":
          case "HS512":
            d2 = parseInt(a10.slice(-3), 10), e2 = { name: "HMAC", hash: `SHA-${d2}`, length: d2 }, g2 = ["sign", "verify"];
            break;
          case "A128CBC-HS256":
          case "A192CBC-HS384":
          case "A256CBC-HS512":
            return J(new Uint8Array((d2 = parseInt(a10.slice(-3), 10)) >> 3));
          case "A128KW":
          case "A192KW":
          case "A256KW":
            e2 = { name: "AES-KW", length: d2 = parseInt(a10.slice(1, 4), 10) }, g2 = ["wrapKey", "unwrapKey"];
            break;
          case "A128GCMKW":
          case "A192GCMKW":
          case "A256GCMKW":
          case "A128GCM":
          case "A192GCM":
          case "A256GCM":
            e2 = { name: "AES-GCM", length: d2 = parseInt(a10.slice(1, 4), 10) }, g2 = ["encrypt", "decrypt"];
            break;
          default:
            throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
        }
        return f.subtle.generateKey(e2, null != (c2 = null == b2 ? void 0 : b2.extractable) && c2, g2);
      }
      function bD(a10) {
        var b2;
        let c2 = null != (b2 = null == a10 ? void 0 : a10.modulusLength) ? b2 : 2048;
        if ("number" != typeof c2 || c2 < 2048) throw new x("Invalid or unsupported modulusLength option provided, 2048 bits or larger keys must be used");
        return c2;
      }
      async function bE(a10, b2) {
        var c2, d2, e2;
        let g2, h2;
        switch (a10) {
          case "PS256":
          case "PS384":
          case "PS512":
            g2 = { name: "RSA-PSS", hash: `SHA-${a10.slice(-3)}`, publicExponent: new Uint8Array([1, 0, 1]), modulusLength: bD(b2) }, h2 = ["sign", "verify"];
            break;
          case "RS256":
          case "RS384":
          case "RS512":
            g2 = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${a10.slice(-3)}`, publicExponent: new Uint8Array([1, 0, 1]), modulusLength: bD(b2) }, h2 = ["sign", "verify"];
            break;
          case "RSA-OAEP":
          case "RSA-OAEP-256":
          case "RSA-OAEP-384":
          case "RSA-OAEP-512":
            g2 = { name: "RSA-OAEP", hash: `SHA-${parseInt(a10.slice(-3), 10) || 1}`, publicExponent: new Uint8Array([1, 0, 1]), modulusLength: bD(b2) }, h2 = ["decrypt", "unwrapKey", "encrypt", "wrapKey"];
            break;
          case "ES256":
            g2 = { name: "ECDSA", namedCurve: "P-256" }, h2 = ["sign", "verify"];
            break;
          case "ES384":
            g2 = { name: "ECDSA", namedCurve: "P-384" }, h2 = ["sign", "verify"];
            break;
          case "ES512":
            g2 = { name: "ECDSA", namedCurve: "P-521" }, h2 = ["sign", "verify"];
            break;
          case "EdDSA":
            h2 = ["sign", "verify"];
            let i2 = null != (c2 = null == b2 ? void 0 : b2.crv) ? c2 : "Ed25519";
            switch (i2) {
              case "Ed25519":
              case "Ed448":
                g2 = { name: i2 };
                break;
              default:
                throw new x("Invalid or unsupported crv option provided");
            }
            break;
          case "ECDH-ES":
          case "ECDH-ES+A128KW":
          case "ECDH-ES+A192KW":
          case "ECDH-ES+A256KW": {
            h2 = ["deriveKey", "deriveBits"];
            let a11 = null != (d2 = null == b2 ? void 0 : b2.crv) ? d2 : "P-256";
            switch (a11) {
              case "P-256":
              case "P-384":
              case "P-521":
                g2 = { name: "ECDH", namedCurve: a11 };
                break;
              case "X25519":
              case "X448":
                g2 = { name: a11 };
                break;
              default:
                throw new x("Invalid or unsupported crv option provided, supported values are P-256, P-384, P-521, X25519, and X448");
            }
            break;
          }
          default:
            throw new x('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
        }
        return f.subtle.generateKey(g2, null != (e2 = null == b2 ? void 0 : b2.extractable) && e2, h2);
      }
      async function bF(a10, b2) {
        return bE(a10, b2);
      }
      async function bG(a10, b2) {
        return bC(a10, b2);
      }
      let bH = "WebCryptoAPI";
    }, 3817: (a, b, c) => {
      (() => {
        "use strict";
        var b2 = { 491: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ContextAPI = void 0;
          let d2 = c2(223), e2 = c2(172), f2 = c2(930), g = "context", h = new d2.NoopContextManager();
          class i {
            constructor() {
            }
            static getInstance() {
              return this._instance || (this._instance = new i()), this._instance;
            }
            setGlobalContextManager(a3) {
              return (0, e2.registerGlobal)(g, a3, f2.DiagAPI.instance());
            }
            active() {
              return this._getContextManager().active();
            }
            with(a3, b4, c3, ...d3) {
              return this._getContextManager().with(a3, b4, c3, ...d3);
            }
            bind(a3, b4) {
              return this._getContextManager().bind(a3, b4);
            }
            _getContextManager() {
              return (0, e2.getGlobal)(g) || h;
            }
            disable() {
              this._getContextManager().disable(), (0, e2.unregisterGlobal)(g, f2.DiagAPI.instance());
            }
          }
          b3.ContextAPI = i;
        }, 930: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.DiagAPI = void 0;
          let d2 = c2(56), e2 = c2(912), f2 = c2(957), g = c2(172);
          class h {
            constructor() {
              function a3(a4) {
                return function(...b5) {
                  let c3 = (0, g.getGlobal)("diag");
                  if (c3) return c3[a4](...b5);
                };
              }
              let b4 = this;
              b4.setLogger = (a4, c3 = { logLevel: f2.DiagLogLevel.INFO }) => {
                var d3, h2, i;
                if (a4 === b4) {
                  let a5 = Error("Cannot use diag as the logger for itself. Please use a DiagLogger implementation like ConsoleDiagLogger or a custom implementation");
                  return b4.error(null != (d3 = a5.stack) ? d3 : a5.message), false;
                }
                "number" == typeof c3 && (c3 = { logLevel: c3 });
                let j = (0, g.getGlobal)("diag"), k = (0, e2.createLogLevelDiagLogger)(null != (h2 = c3.logLevel) ? h2 : f2.DiagLogLevel.INFO, a4);
                if (j && !c3.suppressOverrideMessage) {
                  let a5 = null != (i = Error().stack) ? i : "<failed to generate stacktrace>";
                  j.warn(`Current logger will be overwritten from ${a5}`), k.warn(`Current logger will overwrite one already registered from ${a5}`);
                }
                return (0, g.registerGlobal)("diag", k, b4, true);
              }, b4.disable = () => {
                (0, g.unregisterGlobal)("diag", b4);
              }, b4.createComponentLogger = (a4) => new d2.DiagComponentLogger(a4), b4.verbose = a3("verbose"), b4.debug = a3("debug"), b4.info = a3("info"), b4.warn = a3("warn"), b4.error = a3("error");
            }
            static instance() {
              return this._instance || (this._instance = new h()), this._instance;
            }
          }
          b3.DiagAPI = h;
        }, 653: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.MetricsAPI = void 0;
          let d2 = c2(660), e2 = c2(172), f2 = c2(930), g = "metrics";
          class h {
            constructor() {
            }
            static getInstance() {
              return this._instance || (this._instance = new h()), this._instance;
            }
            setGlobalMeterProvider(a3) {
              return (0, e2.registerGlobal)(g, a3, f2.DiagAPI.instance());
            }
            getMeterProvider() {
              return (0, e2.getGlobal)(g) || d2.NOOP_METER_PROVIDER;
            }
            getMeter(a3, b4, c3) {
              return this.getMeterProvider().getMeter(a3, b4, c3);
            }
            disable() {
              (0, e2.unregisterGlobal)(g, f2.DiagAPI.instance());
            }
          }
          b3.MetricsAPI = h;
        }, 181: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.PropagationAPI = void 0;
          let d2 = c2(172), e2 = c2(874), f2 = c2(194), g = c2(277), h = c2(369), i = c2(930), j = "propagation", k = new e2.NoopTextMapPropagator();
          class l {
            constructor() {
              this.createBaggage = h.createBaggage, this.getBaggage = g.getBaggage, this.getActiveBaggage = g.getActiveBaggage, this.setBaggage = g.setBaggage, this.deleteBaggage = g.deleteBaggage;
            }
            static getInstance() {
              return this._instance || (this._instance = new l()), this._instance;
            }
            setGlobalPropagator(a3) {
              return (0, d2.registerGlobal)(j, a3, i.DiagAPI.instance());
            }
            inject(a3, b4, c3 = f2.defaultTextMapSetter) {
              return this._getGlobalPropagator().inject(a3, b4, c3);
            }
            extract(a3, b4, c3 = f2.defaultTextMapGetter) {
              return this._getGlobalPropagator().extract(a3, b4, c3);
            }
            fields() {
              return this._getGlobalPropagator().fields();
            }
            disable() {
              (0, d2.unregisterGlobal)(j, i.DiagAPI.instance());
            }
            _getGlobalPropagator() {
              return (0, d2.getGlobal)(j) || k;
            }
          }
          b3.PropagationAPI = l;
        }, 997: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.TraceAPI = void 0;
          let d2 = c2(172), e2 = c2(846), f2 = c2(139), g = c2(607), h = c2(930), i = "trace";
          class j {
            constructor() {
              this._proxyTracerProvider = new e2.ProxyTracerProvider(), this.wrapSpanContext = f2.wrapSpanContext, this.isSpanContextValid = f2.isSpanContextValid, this.deleteSpan = g.deleteSpan, this.getSpan = g.getSpan, this.getActiveSpan = g.getActiveSpan, this.getSpanContext = g.getSpanContext, this.setSpan = g.setSpan, this.setSpanContext = g.setSpanContext;
            }
            static getInstance() {
              return this._instance || (this._instance = new j()), this._instance;
            }
            setGlobalTracerProvider(a3) {
              let b4 = (0, d2.registerGlobal)(i, this._proxyTracerProvider, h.DiagAPI.instance());
              return b4 && this._proxyTracerProvider.setDelegate(a3), b4;
            }
            getTracerProvider() {
              return (0, d2.getGlobal)(i) || this._proxyTracerProvider;
            }
            getTracer(a3, b4) {
              return this.getTracerProvider().getTracer(a3, b4);
            }
            disable() {
              (0, d2.unregisterGlobal)(i, h.DiagAPI.instance()), this._proxyTracerProvider = new e2.ProxyTracerProvider();
            }
          }
          b3.TraceAPI = j;
        }, 277: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.deleteBaggage = b3.setBaggage = b3.getActiveBaggage = b3.getBaggage = void 0;
          let d2 = c2(491), e2 = (0, c2(780).createContextKey)("OpenTelemetry Baggage Key");
          function f2(a3) {
            return a3.getValue(e2) || void 0;
          }
          b3.getBaggage = f2, b3.getActiveBaggage = function() {
            return f2(d2.ContextAPI.getInstance().active());
          }, b3.setBaggage = function(a3, b4) {
            return a3.setValue(e2, b4);
          }, b3.deleteBaggage = function(a3) {
            return a3.deleteValue(e2);
          };
        }, 993: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.BaggageImpl = void 0;
          class c2 {
            constructor(a3) {
              this._entries = a3 ? new Map(a3) : /* @__PURE__ */ new Map();
            }
            getEntry(a3) {
              let b4 = this._entries.get(a3);
              if (b4) return Object.assign({}, b4);
            }
            getAllEntries() {
              return Array.from(this._entries.entries()).map(([a3, b4]) => [a3, b4]);
            }
            setEntry(a3, b4) {
              let d2 = new c2(this._entries);
              return d2._entries.set(a3, b4), d2;
            }
            removeEntry(a3) {
              let b4 = new c2(this._entries);
              return b4._entries.delete(a3), b4;
            }
            removeEntries(...a3) {
              let b4 = new c2(this._entries);
              for (let c3 of a3) b4._entries.delete(c3);
              return b4;
            }
            clear() {
              return new c2();
            }
          }
          b3.BaggageImpl = c2;
        }, 830: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.baggageEntryMetadataSymbol = void 0, b3.baggageEntryMetadataSymbol = Symbol("BaggageEntryMetadata");
        }, 369: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.baggageEntryMetadataFromString = b3.createBaggage = void 0;
          let d2 = c2(930), e2 = c2(993), f2 = c2(830), g = d2.DiagAPI.instance();
          b3.createBaggage = function(a3 = {}) {
            return new e2.BaggageImpl(new Map(Object.entries(a3)));
          }, b3.baggageEntryMetadataFromString = function(a3) {
            return "string" != typeof a3 && (g.error(`Cannot create baggage metadata from unknown type: ${typeof a3}`), a3 = ""), { __TYPE__: f2.baggageEntryMetadataSymbol, toString: () => a3 };
          };
        }, 67: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.context = void 0, b3.context = c2(491).ContextAPI.getInstance();
        }, 223: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NoopContextManager = void 0;
          let d2 = c2(780);
          class e2 {
            active() {
              return d2.ROOT_CONTEXT;
            }
            with(a3, b4, c3, ...d3) {
              return b4.call(c3, ...d3);
            }
            bind(a3, b4) {
              return b4;
            }
            enable() {
              return this;
            }
            disable() {
              return this;
            }
          }
          b3.NoopContextManager = e2;
        }, 780: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ROOT_CONTEXT = b3.createContextKey = void 0, b3.createContextKey = function(a3) {
            return Symbol.for(a3);
          };
          class c2 {
            constructor(a3) {
              let b4 = this;
              b4._currentContext = a3 ? new Map(a3) : /* @__PURE__ */ new Map(), b4.getValue = (a4) => b4._currentContext.get(a4), b4.setValue = (a4, d2) => {
                let e2 = new c2(b4._currentContext);
                return e2._currentContext.set(a4, d2), e2;
              }, b4.deleteValue = (a4) => {
                let d2 = new c2(b4._currentContext);
                return d2._currentContext.delete(a4), d2;
              };
            }
          }
          b3.ROOT_CONTEXT = new c2();
        }, 506: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.diag = void 0, b3.diag = c2(930).DiagAPI.instance();
        }, 56: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.DiagComponentLogger = void 0;
          let d2 = c2(172);
          class e2 {
            constructor(a3) {
              this._namespace = a3.namespace || "DiagComponentLogger";
            }
            debug(...a3) {
              return f2("debug", this._namespace, a3);
            }
            error(...a3) {
              return f2("error", this._namespace, a3);
            }
            info(...a3) {
              return f2("info", this._namespace, a3);
            }
            warn(...a3) {
              return f2("warn", this._namespace, a3);
            }
            verbose(...a3) {
              return f2("verbose", this._namespace, a3);
            }
          }
          function f2(a3, b4, c3) {
            let e3 = (0, d2.getGlobal)("diag");
            if (e3) return c3.unshift(b4), e3[a3](...c3);
          }
          b3.DiagComponentLogger = e2;
        }, 972: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.DiagConsoleLogger = void 0;
          let c2 = [{ n: "error", c: "error" }, { n: "warn", c: "warn" }, { n: "info", c: "info" }, { n: "debug", c: "debug" }, { n: "verbose", c: "trace" }];
          class d2 {
            constructor() {
              for (let a3 = 0; a3 < c2.length; a3++) this[c2[a3].n] = /* @__PURE__ */ function(a4) {
                return function(...b4) {
                  if (console) {
                    let c3 = console[a4];
                    if ("function" != typeof c3 && (c3 = console.log), "function" == typeof c3) return c3.apply(console, b4);
                  }
                };
              }(c2[a3].c);
            }
          }
          b3.DiagConsoleLogger = d2;
        }, 912: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.createLogLevelDiagLogger = void 0;
          let d2 = c2(957);
          b3.createLogLevelDiagLogger = function(a3, b4) {
            function c3(c4, d3) {
              let e2 = b4[c4];
              return "function" == typeof e2 && a3 >= d3 ? e2.bind(b4) : function() {
              };
            }
            return a3 < d2.DiagLogLevel.NONE ? a3 = d2.DiagLogLevel.NONE : a3 > d2.DiagLogLevel.ALL && (a3 = d2.DiagLogLevel.ALL), b4 = b4 || {}, { error: c3("error", d2.DiagLogLevel.ERROR), warn: c3("warn", d2.DiagLogLevel.WARN), info: c3("info", d2.DiagLogLevel.INFO), debug: c3("debug", d2.DiagLogLevel.DEBUG), verbose: c3("verbose", d2.DiagLogLevel.VERBOSE) };
          };
        }, 957: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.DiagLogLevel = void 0, function(a3) {
            a3[a3.NONE = 0] = "NONE", a3[a3.ERROR = 30] = "ERROR", a3[a3.WARN = 50] = "WARN", a3[a3.INFO = 60] = "INFO", a3[a3.DEBUG = 70] = "DEBUG", a3[a3.VERBOSE = 80] = "VERBOSE", a3[a3.ALL = 9999] = "ALL";
          }(b3.DiagLogLevel || (b3.DiagLogLevel = {}));
        }, 172: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.unregisterGlobal = b3.getGlobal = b3.registerGlobal = void 0;
          let d2 = c2(200), e2 = c2(521), f2 = c2(130), g = e2.VERSION.split(".")[0], h = Symbol.for(`opentelemetry.js.api.${g}`), i = d2._globalThis;
          b3.registerGlobal = function(a3, b4, c3, d3 = false) {
            var f3;
            let g2 = i[h] = null != (f3 = i[h]) ? f3 : { version: e2.VERSION };
            if (!d3 && g2[a3]) {
              let b5 = Error(`@opentelemetry/api: Attempted duplicate registration of API: ${a3}`);
              return c3.error(b5.stack || b5.message), false;
            }
            if (g2.version !== e2.VERSION) {
              let b5 = Error(`@opentelemetry/api: Registration of version v${g2.version} for ${a3} does not match previously registered API v${e2.VERSION}`);
              return c3.error(b5.stack || b5.message), false;
            }
            return g2[a3] = b4, c3.debug(`@opentelemetry/api: Registered a global for ${a3} v${e2.VERSION}.`), true;
          }, b3.getGlobal = function(a3) {
            var b4, c3;
            let d3 = null == (b4 = i[h]) ? void 0 : b4.version;
            if (d3 && (0, f2.isCompatible)(d3)) return null == (c3 = i[h]) ? void 0 : c3[a3];
          }, b3.unregisterGlobal = function(a3, b4) {
            b4.debug(`@opentelemetry/api: Unregistering a global for ${a3} v${e2.VERSION}.`);
            let c3 = i[h];
            c3 && delete c3[a3];
          };
        }, 130: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.isCompatible = b3._makeCompatibilityCheck = void 0;
          let d2 = c2(521), e2 = /^(\d+)\.(\d+)\.(\d+)(-(.+))?$/;
          function f2(a3) {
            let b4 = /* @__PURE__ */ new Set([a3]), c3 = /* @__PURE__ */ new Set(), d3 = a3.match(e2);
            if (!d3) return () => false;
            let f3 = { major: +d3[1], minor: +d3[2], patch: +d3[3], prerelease: d3[4] };
            if (null != f3.prerelease) return function(b5) {
              return b5 === a3;
            };
            function g(a4) {
              return c3.add(a4), false;
            }
            return function(a4) {
              if (b4.has(a4)) return true;
              if (c3.has(a4)) return false;
              let d4 = a4.match(e2);
              if (!d4) return g(a4);
              let h = { major: +d4[1], minor: +d4[2], patch: +d4[3], prerelease: d4[4] };
              if (null != h.prerelease || f3.major !== h.major) return g(a4);
              if (0 === f3.major) return f3.minor === h.minor && f3.patch <= h.patch ? (b4.add(a4), true) : g(a4);
              return f3.minor <= h.minor ? (b4.add(a4), true) : g(a4);
            };
          }
          b3._makeCompatibilityCheck = f2, b3.isCompatible = f2(d2.VERSION);
        }, 886: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.metrics = void 0, b3.metrics = c2(653).MetricsAPI.getInstance();
        }, 901: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ValueType = void 0, function(a3) {
            a3[a3.INT = 0] = "INT", a3[a3.DOUBLE = 1] = "DOUBLE";
          }(b3.ValueType || (b3.ValueType = {}));
        }, 102: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.createNoopMeter = b3.NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC = b3.NOOP_OBSERVABLE_GAUGE_METRIC = b3.NOOP_OBSERVABLE_COUNTER_METRIC = b3.NOOP_UP_DOWN_COUNTER_METRIC = b3.NOOP_HISTOGRAM_METRIC = b3.NOOP_COUNTER_METRIC = b3.NOOP_METER = b3.NoopObservableUpDownCounterMetric = b3.NoopObservableGaugeMetric = b3.NoopObservableCounterMetric = b3.NoopObservableMetric = b3.NoopHistogramMetric = b3.NoopUpDownCounterMetric = b3.NoopCounterMetric = b3.NoopMetric = b3.NoopMeter = void 0;
          class c2 {
            constructor() {
            }
            createHistogram(a3, c3) {
              return b3.NOOP_HISTOGRAM_METRIC;
            }
            createCounter(a3, c3) {
              return b3.NOOP_COUNTER_METRIC;
            }
            createUpDownCounter(a3, c3) {
              return b3.NOOP_UP_DOWN_COUNTER_METRIC;
            }
            createObservableGauge(a3, c3) {
              return b3.NOOP_OBSERVABLE_GAUGE_METRIC;
            }
            createObservableCounter(a3, c3) {
              return b3.NOOP_OBSERVABLE_COUNTER_METRIC;
            }
            createObservableUpDownCounter(a3, c3) {
              return b3.NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC;
            }
            addBatchObservableCallback(a3, b4) {
            }
            removeBatchObservableCallback(a3) {
            }
          }
          b3.NoopMeter = c2;
          class d2 {
          }
          b3.NoopMetric = d2;
          class e2 extends d2 {
            add(a3, b4) {
            }
          }
          b3.NoopCounterMetric = e2;
          class f2 extends d2 {
            add(a3, b4) {
            }
          }
          b3.NoopUpDownCounterMetric = f2;
          class g extends d2 {
            record(a3, b4) {
            }
          }
          b3.NoopHistogramMetric = g;
          class h {
            addCallback(a3) {
            }
            removeCallback(a3) {
            }
          }
          b3.NoopObservableMetric = h;
          class i extends h {
          }
          b3.NoopObservableCounterMetric = i;
          class j extends h {
          }
          b3.NoopObservableGaugeMetric = j;
          class k extends h {
          }
          b3.NoopObservableUpDownCounterMetric = k, b3.NOOP_METER = new c2(), b3.NOOP_COUNTER_METRIC = new e2(), b3.NOOP_HISTOGRAM_METRIC = new g(), b3.NOOP_UP_DOWN_COUNTER_METRIC = new f2(), b3.NOOP_OBSERVABLE_COUNTER_METRIC = new i(), b3.NOOP_OBSERVABLE_GAUGE_METRIC = new j(), b3.NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC = new k(), b3.createNoopMeter = function() {
            return b3.NOOP_METER;
          };
        }, 660: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NOOP_METER_PROVIDER = b3.NoopMeterProvider = void 0;
          let d2 = c2(102);
          class e2 {
            getMeter(a3, b4, c3) {
              return d2.NOOP_METER;
            }
          }
          b3.NoopMeterProvider = e2, b3.NOOP_METER_PROVIDER = new e2();
        }, 200: function(a2, b3, c2) {
          var d2 = this && this.__createBinding || (Object.create ? function(a3, b4, c3, d3) {
            void 0 === d3 && (d3 = c3), Object.defineProperty(a3, d3, { enumerable: true, get: function() {
              return b4[c3];
            } });
          } : function(a3, b4, c3, d3) {
            void 0 === d3 && (d3 = c3), a3[d3] = b4[c3];
          }), e2 = this && this.__exportStar || function(a3, b4) {
            for (var c3 in a3) "default" === c3 || Object.prototype.hasOwnProperty.call(b4, c3) || d2(b4, a3, c3);
          };
          Object.defineProperty(b3, "__esModule", { value: true }), e2(c2(46), b3);
        }, 651: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3._globalThis = void 0, b3._globalThis = "object" == typeof globalThis ? globalThis : c.g;
        }, 46: function(a2, b3, c2) {
          var d2 = this && this.__createBinding || (Object.create ? function(a3, b4, c3, d3) {
            void 0 === d3 && (d3 = c3), Object.defineProperty(a3, d3, { enumerable: true, get: function() {
              return b4[c3];
            } });
          } : function(a3, b4, c3, d3) {
            void 0 === d3 && (d3 = c3), a3[d3] = b4[c3];
          }), e2 = this && this.__exportStar || function(a3, b4) {
            for (var c3 in a3) "default" === c3 || Object.prototype.hasOwnProperty.call(b4, c3) || d2(b4, a3, c3);
          };
          Object.defineProperty(b3, "__esModule", { value: true }), e2(c2(651), b3);
        }, 939: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.propagation = void 0, b3.propagation = c2(181).PropagationAPI.getInstance();
        }, 874: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NoopTextMapPropagator = void 0;
          class c2 {
            inject(a3, b4) {
            }
            extract(a3, b4) {
              return a3;
            }
            fields() {
              return [];
            }
          }
          b3.NoopTextMapPropagator = c2;
        }, 194: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.defaultTextMapSetter = b3.defaultTextMapGetter = void 0, b3.defaultTextMapGetter = { get(a3, b4) {
            if (null != a3) return a3[b4];
          }, keys: (a3) => null == a3 ? [] : Object.keys(a3) }, b3.defaultTextMapSetter = { set(a3, b4, c2) {
            null != a3 && (a3[b4] = c2);
          } };
        }, 845: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.trace = void 0, b3.trace = c2(997).TraceAPI.getInstance();
        }, 403: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NonRecordingSpan = void 0;
          let d2 = c2(476);
          class e2 {
            constructor(a3 = d2.INVALID_SPAN_CONTEXT) {
              this._spanContext = a3;
            }
            spanContext() {
              return this._spanContext;
            }
            setAttribute(a3, b4) {
              return this;
            }
            setAttributes(a3) {
              return this;
            }
            addEvent(a3, b4) {
              return this;
            }
            setStatus(a3) {
              return this;
            }
            updateName(a3) {
              return this;
            }
            end(a3) {
            }
            isRecording() {
              return false;
            }
            recordException(a3, b4) {
            }
          }
          b3.NonRecordingSpan = e2;
        }, 614: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NoopTracer = void 0;
          let d2 = c2(491), e2 = c2(607), f2 = c2(403), g = c2(139), h = d2.ContextAPI.getInstance();
          class i {
            startSpan(a3, b4, c3 = h.active()) {
              var d3;
              if (null == b4 ? void 0 : b4.root) return new f2.NonRecordingSpan();
              let i2 = c3 && (0, e2.getSpanContext)(c3);
              return "object" == typeof (d3 = i2) && "string" == typeof d3.spanId && "string" == typeof d3.traceId && "number" == typeof d3.traceFlags && (0, g.isSpanContextValid)(i2) ? new f2.NonRecordingSpan(i2) : new f2.NonRecordingSpan();
            }
            startActiveSpan(a3, b4, c3, d3) {
              let f3, g2, i2;
              if (arguments.length < 2) return;
              2 == arguments.length ? i2 = b4 : 3 == arguments.length ? (f3 = b4, i2 = c3) : (f3 = b4, g2 = c3, i2 = d3);
              let j = null != g2 ? g2 : h.active(), k = this.startSpan(a3, f3, j), l = (0, e2.setSpan)(j, k);
              return h.with(l, i2, void 0, k);
            }
          }
          b3.NoopTracer = i;
        }, 124: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NoopTracerProvider = void 0;
          let d2 = c2(614);
          class e2 {
            getTracer(a3, b4, c3) {
              return new d2.NoopTracer();
            }
          }
          b3.NoopTracerProvider = e2;
        }, 125: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ProxyTracer = void 0;
          let d2 = new (c2(614)).NoopTracer();
          class e2 {
            constructor(a3, b4, c3, d3) {
              this._provider = a3, this.name = b4, this.version = c3, this.options = d3;
            }
            startSpan(a3, b4, c3) {
              return this._getTracer().startSpan(a3, b4, c3);
            }
            startActiveSpan(a3, b4, c3, d3) {
              let e3 = this._getTracer();
              return Reflect.apply(e3.startActiveSpan, e3, arguments);
            }
            _getTracer() {
              if (this._delegate) return this._delegate;
              let a3 = this._provider.getDelegateTracer(this.name, this.version, this.options);
              return a3 ? (this._delegate = a3, this._delegate) : d2;
            }
          }
          b3.ProxyTracer = e2;
        }, 846: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ProxyTracerProvider = void 0;
          let d2 = c2(125), e2 = new (c2(124)).NoopTracerProvider();
          class f2 {
            getTracer(a3, b4, c3) {
              var e3;
              return null != (e3 = this.getDelegateTracer(a3, b4, c3)) ? e3 : new d2.ProxyTracer(this, a3, b4, c3);
            }
            getDelegate() {
              var a3;
              return null != (a3 = this._delegate) ? a3 : e2;
            }
            setDelegate(a3) {
              this._delegate = a3;
            }
            getDelegateTracer(a3, b4, c3) {
              var d3;
              return null == (d3 = this._delegate) ? void 0 : d3.getTracer(a3, b4, c3);
            }
          }
          b3.ProxyTracerProvider = f2;
        }, 996: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.SamplingDecision = void 0, function(a3) {
            a3[a3.NOT_RECORD = 0] = "NOT_RECORD", a3[a3.RECORD = 1] = "RECORD", a3[a3.RECORD_AND_SAMPLED = 2] = "RECORD_AND_SAMPLED";
          }(b3.SamplingDecision || (b3.SamplingDecision = {}));
        }, 607: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.getSpanContext = b3.setSpanContext = b3.deleteSpan = b3.setSpan = b3.getActiveSpan = b3.getSpan = void 0;
          let d2 = c2(780), e2 = c2(403), f2 = c2(491), g = (0, d2.createContextKey)("OpenTelemetry Context Key SPAN");
          function h(a3) {
            return a3.getValue(g) || void 0;
          }
          function i(a3, b4) {
            return a3.setValue(g, b4);
          }
          b3.getSpan = h, b3.getActiveSpan = function() {
            return h(f2.ContextAPI.getInstance().active());
          }, b3.setSpan = i, b3.deleteSpan = function(a3) {
            return a3.deleteValue(g);
          }, b3.setSpanContext = function(a3, b4) {
            return i(a3, new e2.NonRecordingSpan(b4));
          }, b3.getSpanContext = function(a3) {
            var b4;
            return null == (b4 = h(a3)) ? void 0 : b4.spanContext();
          };
        }, 325: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.TraceStateImpl = void 0;
          let d2 = c2(564);
          class e2 {
            constructor(a3) {
              this._internalState = /* @__PURE__ */ new Map(), a3 && this._parse(a3);
            }
            set(a3, b4) {
              let c3 = this._clone();
              return c3._internalState.has(a3) && c3._internalState.delete(a3), c3._internalState.set(a3, b4), c3;
            }
            unset(a3) {
              let b4 = this._clone();
              return b4._internalState.delete(a3), b4;
            }
            get(a3) {
              return this._internalState.get(a3);
            }
            serialize() {
              return this._keys().reduce((a3, b4) => (a3.push(b4 + "=" + this.get(b4)), a3), []).join(",");
            }
            _parse(a3) {
              !(a3.length > 512) && (this._internalState = a3.split(",").reverse().reduce((a4, b4) => {
                let c3 = b4.trim(), e3 = c3.indexOf("=");
                if (-1 !== e3) {
                  let f2 = c3.slice(0, e3), g = c3.slice(e3 + 1, b4.length);
                  (0, d2.validateKey)(f2) && (0, d2.validateValue)(g) && a4.set(f2, g);
                }
                return a4;
              }, /* @__PURE__ */ new Map()), this._internalState.size > 32 && (this._internalState = new Map(Array.from(this._internalState.entries()).reverse().slice(0, 32))));
            }
            _keys() {
              return Array.from(this._internalState.keys()).reverse();
            }
            _clone() {
              let a3 = new e2();
              return a3._internalState = new Map(this._internalState), a3;
            }
          }
          b3.TraceStateImpl = e2;
        }, 564: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.validateValue = b3.validateKey = void 0;
          let c2 = "[_0-9a-z-*/]", d2 = `[a-z]${c2}{0,255}`, e2 = `[a-z0-9]${c2}{0,240}@[a-z]${c2}{0,13}`, f2 = RegExp(`^(?:${d2}|${e2})$`), g = /^[ -~]{0,255}[!-~]$/, h = /,|=/;
          b3.validateKey = function(a3) {
            return f2.test(a3);
          }, b3.validateValue = function(a3) {
            return g.test(a3) && !h.test(a3);
          };
        }, 98: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.createTraceState = void 0;
          let d2 = c2(325);
          b3.createTraceState = function(a3) {
            return new d2.TraceStateImpl(a3);
          };
        }, 476: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.INVALID_SPAN_CONTEXT = b3.INVALID_TRACEID = b3.INVALID_SPANID = void 0;
          let d2 = c2(475);
          b3.INVALID_SPANID = "0000000000000000", b3.INVALID_TRACEID = "00000000000000000000000000000000", b3.INVALID_SPAN_CONTEXT = { traceId: b3.INVALID_TRACEID, spanId: b3.INVALID_SPANID, traceFlags: d2.TraceFlags.NONE };
        }, 357: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.SpanKind = void 0, function(a3) {
            a3[a3.INTERNAL = 0] = "INTERNAL", a3[a3.SERVER = 1] = "SERVER", a3[a3.CLIENT = 2] = "CLIENT", a3[a3.PRODUCER = 3] = "PRODUCER", a3[a3.CONSUMER = 4] = "CONSUMER";
          }(b3.SpanKind || (b3.SpanKind = {}));
        }, 139: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.wrapSpanContext = b3.isSpanContextValid = b3.isValidSpanId = b3.isValidTraceId = void 0;
          let d2 = c2(476), e2 = c2(403), f2 = /^([0-9a-f]{32})$/i, g = /^[0-9a-f]{16}$/i;
          function h(a3) {
            return f2.test(a3) && a3 !== d2.INVALID_TRACEID;
          }
          function i(a3) {
            return g.test(a3) && a3 !== d2.INVALID_SPANID;
          }
          b3.isValidTraceId = h, b3.isValidSpanId = i, b3.isSpanContextValid = function(a3) {
            return h(a3.traceId) && i(a3.spanId);
          }, b3.wrapSpanContext = function(a3) {
            return new e2.NonRecordingSpan(a3);
          };
        }, 847: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.SpanStatusCode = void 0, function(a3) {
            a3[a3.UNSET = 0] = "UNSET", a3[a3.OK = 1] = "OK", a3[a3.ERROR = 2] = "ERROR";
          }(b3.SpanStatusCode || (b3.SpanStatusCode = {}));
        }, 475: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.TraceFlags = void 0, function(a3) {
            a3[a3.NONE = 0] = "NONE", a3[a3.SAMPLED = 1] = "SAMPLED";
          }(b3.TraceFlags || (b3.TraceFlags = {}));
        }, 521: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.VERSION = void 0, b3.VERSION = "1.6.0";
        } }, d = {};
        function e(a2) {
          var c2 = d[a2];
          if (void 0 !== c2) return c2.exports;
          var f2 = d[a2] = { exports: {} }, g = true;
          try {
            b2[a2].call(f2.exports, f2, f2.exports, e), g = false;
          } finally {
            g && delete d[a2];
          }
          return f2.exports;
        }
        e.ab = "//";
        var f = {};
        (() => {
          Object.defineProperty(f, "__esModule", { value: true }), f.trace = f.propagation = f.metrics = f.diag = f.context = f.INVALID_SPAN_CONTEXT = f.INVALID_TRACEID = f.INVALID_SPANID = f.isValidSpanId = f.isValidTraceId = f.isSpanContextValid = f.createTraceState = f.TraceFlags = f.SpanStatusCode = f.SpanKind = f.SamplingDecision = f.ProxyTracerProvider = f.ProxyTracer = f.defaultTextMapSetter = f.defaultTextMapGetter = f.ValueType = f.createNoopMeter = f.DiagLogLevel = f.DiagConsoleLogger = f.ROOT_CONTEXT = f.createContextKey = f.baggageEntryMetadataFromString = void 0;
          var a2 = e(369);
          Object.defineProperty(f, "baggageEntryMetadataFromString", { enumerable: true, get: function() {
            return a2.baggageEntryMetadataFromString;
          } });
          var b3 = e(780);
          Object.defineProperty(f, "createContextKey", { enumerable: true, get: function() {
            return b3.createContextKey;
          } }), Object.defineProperty(f, "ROOT_CONTEXT", { enumerable: true, get: function() {
            return b3.ROOT_CONTEXT;
          } });
          var c2 = e(972);
          Object.defineProperty(f, "DiagConsoleLogger", { enumerable: true, get: function() {
            return c2.DiagConsoleLogger;
          } });
          var d2 = e(957);
          Object.defineProperty(f, "DiagLogLevel", { enumerable: true, get: function() {
            return d2.DiagLogLevel;
          } });
          var g = e(102);
          Object.defineProperty(f, "createNoopMeter", { enumerable: true, get: function() {
            return g.createNoopMeter;
          } });
          var h = e(901);
          Object.defineProperty(f, "ValueType", { enumerable: true, get: function() {
            return h.ValueType;
          } });
          var i = e(194);
          Object.defineProperty(f, "defaultTextMapGetter", { enumerable: true, get: function() {
            return i.defaultTextMapGetter;
          } }), Object.defineProperty(f, "defaultTextMapSetter", { enumerable: true, get: function() {
            return i.defaultTextMapSetter;
          } });
          var j = e(125);
          Object.defineProperty(f, "ProxyTracer", { enumerable: true, get: function() {
            return j.ProxyTracer;
          } });
          var k = e(846);
          Object.defineProperty(f, "ProxyTracerProvider", { enumerable: true, get: function() {
            return k.ProxyTracerProvider;
          } });
          var l = e(996);
          Object.defineProperty(f, "SamplingDecision", { enumerable: true, get: function() {
            return l.SamplingDecision;
          } });
          var m = e(357);
          Object.defineProperty(f, "SpanKind", { enumerable: true, get: function() {
            return m.SpanKind;
          } });
          var n = e(847);
          Object.defineProperty(f, "SpanStatusCode", { enumerable: true, get: function() {
            return n.SpanStatusCode;
          } });
          var o = e(475);
          Object.defineProperty(f, "TraceFlags", { enumerable: true, get: function() {
            return o.TraceFlags;
          } });
          var p = e(98);
          Object.defineProperty(f, "createTraceState", { enumerable: true, get: function() {
            return p.createTraceState;
          } });
          var q = e(139);
          Object.defineProperty(f, "isSpanContextValid", { enumerable: true, get: function() {
            return q.isSpanContextValid;
          } }), Object.defineProperty(f, "isValidTraceId", { enumerable: true, get: function() {
            return q.isValidTraceId;
          } }), Object.defineProperty(f, "isValidSpanId", { enumerable: true, get: function() {
            return q.isValidSpanId;
          } });
          var r = e(476);
          Object.defineProperty(f, "INVALID_SPANID", { enumerable: true, get: function() {
            return r.INVALID_SPANID;
          } }), Object.defineProperty(f, "INVALID_TRACEID", { enumerable: true, get: function() {
            return r.INVALID_TRACEID;
          } }), Object.defineProperty(f, "INVALID_SPAN_CONTEXT", { enumerable: true, get: function() {
            return r.INVALID_SPAN_CONTEXT;
          } });
          let s = e(67);
          Object.defineProperty(f, "context", { enumerable: true, get: function() {
            return s.context;
          } });
          let t = e(506);
          Object.defineProperty(f, "diag", { enumerable: true, get: function() {
            return t.diag;
          } });
          let u = e(886);
          Object.defineProperty(f, "metrics", { enumerable: true, get: function() {
            return u.metrics;
          } });
          let v = e(939);
          Object.defineProperty(f, "propagation", { enumerable: true, get: function() {
            return v.propagation;
          } });
          let w = e(845);
          Object.defineProperty(f, "trace", { enumerable: true, get: function() {
            return w.trace;
          } }), f.default = { context: s.context, diag: t.diag, metrics: u.metrics, propagation: v.propagation, trace: w.trace };
        })(), a.exports = f;
      })();
    }, 4449: (a, b, c) => {
      var d;
      (() => {
        var e = { 226: function(e2, f2) {
          !function(g2, h) {
            "use strict";
            var i = "function", j = "undefined", k = "object", l = "string", m = "major", n = "model", o = "name", p = "type", q = "vendor", r = "version", s = "architecture", t = "console", u = "mobile", v = "tablet", w = "smarttv", x = "wearable", y = "embedded", z = "Amazon", A = "Apple", B = "ASUS", C = "BlackBerry", D = "Browser", E = "Chrome", F = "Firefox", G = "Google", H = "Huawei", I = "Microsoft", J = "Motorola", K = "Opera", L = "Samsung", M = "Sharp", N = "Sony", O = "Xiaomi", P = "Zebra", Q = "Facebook", R = "Chromium OS", S = "Mac OS", T = function(a2, b2) {
              var c2 = {};
              for (var d2 in a2) b2[d2] && b2[d2].length % 2 == 0 ? c2[d2] = b2[d2].concat(a2[d2]) : c2[d2] = a2[d2];
              return c2;
            }, U = function(a2) {
              for (var b2 = {}, c2 = 0; c2 < a2.length; c2++) b2[a2[c2].toUpperCase()] = a2[c2];
              return b2;
            }, V = function(a2, b2) {
              return typeof a2 === l && -1 !== W(b2).indexOf(W(a2));
            }, W = function(a2) {
              return a2.toLowerCase();
            }, X = function(a2, b2) {
              if (typeof a2 === l) return a2 = a2.replace(/^\s\s*/, ""), typeof b2 === j ? a2 : a2.substring(0, 350);
            }, Y = function(a2, b2) {
              for (var c2, d2, e3, f3, g3, j2, l2 = 0; l2 < b2.length && !g3; ) {
                var m2 = b2[l2], n2 = b2[l2 + 1];
                for (c2 = d2 = 0; c2 < m2.length && !g3 && m2[c2]; ) if (g3 = m2[c2++].exec(a2)) for (e3 = 0; e3 < n2.length; e3++) j2 = g3[++d2], typeof (f3 = n2[e3]) === k && f3.length > 0 ? 2 === f3.length ? typeof f3[1] == i ? this[f3[0]] = f3[1].call(this, j2) : this[f3[0]] = f3[1] : 3 === f3.length ? typeof f3[1] !== i || f3[1].exec && f3[1].test ? this[f3[0]] = j2 ? j2.replace(f3[1], f3[2]) : void 0 : this[f3[0]] = j2 ? f3[1].call(this, j2, f3[2]) : void 0 : 4 === f3.length && (this[f3[0]] = j2 ? f3[3].call(this, j2.replace(f3[1], f3[2])) : h) : this[f3] = j2 || h;
                l2 += 2;
              }
            }, Z = function(a2, b2) {
              for (var c2 in b2) if (typeof b2[c2] === k && b2[c2].length > 0) {
                for (var d2 = 0; d2 < b2[c2].length; d2++) if (V(b2[c2][d2], a2)) return "?" === c2 ? h : c2;
              } else if (V(b2[c2], a2)) return "?" === c2 ? h : c2;
              return a2;
            }, $ = { ME: "4.90", "NT 3.11": "NT3.51", "NT 4.0": "NT4.0", 2e3: "NT 5.0", XP: ["NT 5.1", "NT 5.2"], Vista: "NT 6.0", 7: "NT 6.1", 8: "NT 6.2", 8.1: "NT 6.3", 10: ["NT 6.4", "NT 10.0"], RT: "ARM" }, _ = { browser: [[/\b(?:crmo|crios)\/([\w\.]+)/i], [r, [o, "Chrome"]], [/edg(?:e|ios|a)?\/([\w\.]+)/i], [r, [o, "Edge"]], [/(opera mini)\/([-\w\.]+)/i, /(opera [mobiletab]{3,6})\b.+version\/([-\w\.]+)/i, /(opera)(?:.+version\/|[\/ ]+)([\w\.]+)/i], [o, r], [/opios[\/ ]+([\w\.]+)/i], [r, [o, K + " Mini"]], [/\bopr\/([\w\.]+)/i], [r, [o, K]], [/(kindle)\/([\w\.]+)/i, /(lunascape|maxthon|netfront|jasmine|blazer)[\/ ]?([\w\.]*)/i, /(avant |iemobile|slim)(?:browser)?[\/ ]?([\w\.]*)/i, /(ba?idubrowser)[\/ ]?([\w\.]+)/i, /(?:ms|\()(ie) ([\w\.]+)/i, /(flock|rockmelt|midori|epiphany|silk|skyfire|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon|rekonq|puffin|brave|whale(?!.+naver)|qqbrowserlite|qq|duckduckgo)\/([-\w\.]+)/i, /(heytap|ovi)browser\/([\d\.]+)/i, /(weibo)__([\d\.]+)/i], [o, r], [/(?:\buc? ?browser|(?:juc.+)ucweb)[\/ ]?([\w\.]+)/i], [r, [o, "UC" + D]], [/microm.+\bqbcore\/([\w\.]+)/i, /\bqbcore\/([\w\.]+).+microm/i], [r, [o, "WeChat(Win) Desktop"]], [/micromessenger\/([\w\.]+)/i], [r, [o, "WeChat"]], [/konqueror\/([\w\.]+)/i], [r, [o, "Konqueror"]], [/trident.+rv[: ]([\w\.]{1,9})\b.+like gecko/i], [r, [o, "IE"]], [/ya(?:search)?browser\/([\w\.]+)/i], [r, [o, "Yandex"]], [/(avast|avg)\/([\w\.]+)/i], [[o, /(.+)/, "$1 Secure " + D], r], [/\bfocus\/([\w\.]+)/i], [r, [o, F + " Focus"]], [/\bopt\/([\w\.]+)/i], [r, [o, K + " Touch"]], [/coc_coc\w+\/([\w\.]+)/i], [r, [o, "Coc Coc"]], [/dolfin\/([\w\.]+)/i], [r, [o, "Dolphin"]], [/coast\/([\w\.]+)/i], [r, [o, K + " Coast"]], [/miuibrowser\/([\w\.]+)/i], [r, [o, "MIUI " + D]], [/fxios\/([-\w\.]+)/i], [r, [o, F]], [/\bqihu|(qi?ho?o?|360)browser/i], [[o, "360 " + D]], [/(oculus|samsung|sailfish|huawei)browser\/([\w\.]+)/i], [[o, /(.+)/, "$1 " + D], r], [/(comodo_dragon)\/([\w\.]+)/i], [[o, /_/g, " "], r], [/(electron)\/([\w\.]+) safari/i, /(tesla)(?: qtcarbrowser|\/(20\d\d\.[-\w\.]+))/i, /m?(qqbrowser|baiduboxapp|2345Explorer)[\/ ]?([\w\.]+)/i], [o, r], [/(metasr)[\/ ]?([\w\.]+)/i, /(lbbrowser)/i, /\[(linkedin)app\]/i], [o], [/((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w\.]+);)/i], [[o, Q], r], [/(kakao(?:talk|story))[\/ ]([\w\.]+)/i, /(naver)\(.*?(\d+\.[\w\.]+).*\)/i, /safari (line)\/([\w\.]+)/i, /\b(line)\/([\w\.]+)\/iab/i, /(chromium|instagram)[\/ ]([-\w\.]+)/i], [o, r], [/\bgsa\/([\w\.]+) .*safari\//i], [r, [o, "GSA"]], [/musical_ly(?:.+app_?version\/|_)([\w\.]+)/i], [r, [o, "TikTok"]], [/headlesschrome(?:\/([\w\.]+)| )/i], [r, [o, E + " Headless"]], [/ wv\).+(chrome)\/([\w\.]+)/i], [[o, E + " WebView"], r], [/droid.+ version\/([\w\.]+)\b.+(?:mobile safari|safari)/i], [r, [o, "Android " + D]], [/(chrome|omniweb|arora|[tizenoka]{5} ?browser)\/v?([\w\.]+)/i], [o, r], [/version\/([\w\.\,]+) .*mobile\/\w+ (safari)/i], [r, [o, "Mobile Safari"]], [/version\/([\w(\.|\,)]+) .*(mobile ?safari|safari)/i], [r, o], [/webkit.+?(mobile ?safari|safari)(\/[\w\.]+)/i], [o, [r, Z, { "1.0": "/8", 1.2: "/1", 1.3: "/3", "2.0": "/412", "2.0.2": "/416", "2.0.3": "/417", "2.0.4": "/419", "?": "/" }]], [/(webkit|khtml)\/([\w\.]+)/i], [o, r], [/(navigator|netscape\d?)\/([-\w\.]+)/i], [[o, "Netscape"], r], [/mobile vr; rv:([\w\.]+)\).+firefox/i], [r, [o, F + " Reality"]], [/ekiohf.+(flow)\/([\w\.]+)/i, /(swiftfox)/i, /(icedragon|iceweasel|camino|chimera|fennec|maemo browser|minimo|conkeror|klar)[\/ ]?([\w\.\+]+)/i, /(seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([-\w\.]+)$/i, /(firefox)\/([\w\.]+)/i, /(mozilla)\/([\w\.]+) .+rv\:.+gecko\/\d+/i, /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir|obigo|mosaic|(?:go|ice|up)[\. ]?browser)[-\/ ]?v?([\w\.]+)/i, /(links) \(([\w\.]+)/i, /panasonic;(viera)/i], [o, r], [/(cobalt)\/([\w\.]+)/i], [o, [r, /master.|lts./, ""]]], cpu: [[/(?:(amd|x(?:(?:86|64)[-_])?|wow|win)64)[;\)]/i], [[s, "amd64"]], [/(ia32(?=;))/i], [[s, W]], [/((?:i[346]|x)86)[;\)]/i], [[s, "ia32"]], [/\b(aarch64|arm(v?8e?l?|_?64))\b/i], [[s, "arm64"]], [/\b(arm(?:v[67])?ht?n?[fl]p?)\b/i], [[s, "armhf"]], [/windows (ce|mobile); ppc;/i], [[s, "arm"]], [/((?:ppc|powerpc)(?:64)?)(?: mac|;|\))/i], [[s, /ower/, "", W]], [/(sun4\w)[;\)]/i], [[s, "sparc"]], [/((?:avr32|ia64(?=;))|68k(?=\))|\barm(?=v(?:[1-7]|[5-7]1)l?|;|eabi)|(?=atmel )avr|(?:irix|mips|sparc)(?:64)?\b|pa-risc)/i], [[s, W]]], device: [[/\b(sch-i[89]0\d|shw-m380s|sm-[ptx]\w{2,4}|gt-[pn]\d{2,4}|sgh-t8[56]9|nexus 10)/i], [n, [q, L], [p, v]], [/\b((?:s[cgp]h|gt|sm)-\w+|sc[g-]?[\d]+a?|galaxy nexus)/i, /samsung[- ]([-\w]+)/i, /sec-(sgh\w+)/i], [n, [q, L], [p, u]], [/(?:\/|\()(ip(?:hone|od)[\w, ]*)(?:\/|;)/i], [n, [q, A], [p, u]], [/\((ipad);[-\w\),; ]+apple/i, /applecoremedia\/[\w\.]+ \((ipad)/i, /\b(ipad)\d\d?,\d\d?[;\]].+ios/i], [n, [q, A], [p, v]], [/(macintosh);/i], [n, [q, A]], [/\b(sh-?[altvz]?\d\d[a-ekm]?)/i], [n, [q, M], [p, u]], [/\b((?:ag[rs][23]?|bah2?|sht?|btv)-a?[lw]\d{2})\b(?!.+d\/s)/i], [n, [q, H], [p, v]], [/(?:huawei|honor)([-\w ]+)[;\)]/i, /\b(nexus 6p|\w{2,4}e?-[atu]?[ln][\dx][012359c][adn]?)\b(?!.+d\/s)/i], [n, [q, H], [p, u]], [/\b(poco[\w ]+)(?: bui|\))/i, /\b; (\w+) build\/hm\1/i, /\b(hm[-_ ]?note?[_ ]?(?:\d\w)?) bui/i, /\b(redmi[\-_ ]?(?:note|k)?[\w_ ]+)(?: bui|\))/i, /\b(mi[-_ ]?(?:a\d|one|one[_ ]plus|note lte|max|cc)?[_ ]?(?:\d?\w?)[_ ]?(?:plus|se|lite)?)(?: bui|\))/i], [[n, /_/g, " "], [q, O], [p, u]], [/\b(mi[-_ ]?(?:pad)(?:[\w_ ]+))(?: bui|\))/i], [[n, /_/g, " "], [q, O], [p, v]], [/; (\w+) bui.+ oppo/i, /\b(cph[12]\d{3}|p(?:af|c[al]|d\w|e[ar])[mt]\d0|x9007|a101op)\b/i], [n, [q, "OPPO"], [p, u]], [/vivo (\w+)(?: bui|\))/i, /\b(v[12]\d{3}\w?[at])(?: bui|;)/i], [n, [q, "Vivo"], [p, u]], [/\b(rmx[12]\d{3})(?: bui|;|\))/i], [n, [q, "Realme"], [p, u]], [/\b(milestone|droid(?:[2-4x]| (?:bionic|x2|pro|razr))?:?( 4g)?)\b[\w ]+build\//i, /\bmot(?:orola)?[- ](\w*)/i, /((?:moto[\w\(\) ]+|xt\d{3,4}|nexus 6)(?= bui|\)))/i], [n, [q, J], [p, u]], [/\b(mz60\d|xoom[2 ]{0,2}) build\//i], [n, [q, J], [p, v]], [/((?=lg)?[vl]k\-?\d{3}) bui| 3\.[-\w; ]{10}lg?-([06cv9]{3,4})/i], [n, [q, "LG"], [p, v]], [/(lm(?:-?f100[nv]?|-[\w\.]+)(?= bui|\))|nexus [45])/i, /\blg[-e;\/ ]+((?!browser|netcast|android tv)\w+)/i, /\blg-?([\d\w]+) bui/i], [n, [q, "LG"], [p, u]], [/(ideatab[-\w ]+)/i, /lenovo ?(s[56]000[-\w]+|tab(?:[\w ]+)|yt[-\d\w]{6}|tb[-\d\w]{6})/i], [n, [q, "Lenovo"], [p, v]], [/(?:maemo|nokia).*(n900|lumia \d+)/i, /nokia[-_ ]?([-\w\.]*)/i], [[n, /_/g, " "], [q, "Nokia"], [p, u]], [/(pixel c)\b/i], [n, [q, G], [p, v]], [/droid.+; (pixel[\daxl ]{0,6})(?: bui|\))/i], [n, [q, G], [p, u]], [/droid.+ (a?\d[0-2]{2}so|[c-g]\d{4}|so[-gl]\w+|xq-a\w[4-7][12])(?= bui|\).+chrome\/(?![1-6]{0,1}\d\.))/i], [n, [q, N], [p, u]], [/sony tablet [ps]/i, /\b(?:sony)?sgp\w+(?: bui|\))/i], [[n, "Xperia Tablet"], [q, N], [p, v]], [/ (kb2005|in20[12]5|be20[12][59])\b/i, /(?:one)?(?:plus)? (a\d0\d\d)(?: b|\))/i], [n, [q, "OnePlus"], [p, u]], [/(alexa)webm/i, /(kf[a-z]{2}wi|aeo[c-r]{2})( bui|\))/i, /(kf[a-z]+)( bui|\)).+silk\//i], [n, [q, z], [p, v]], [/((?:sd|kf)[0349hijorstuw]+)( bui|\)).+silk\//i], [[n, /(.+)/g, "Fire Phone $1"], [q, z], [p, u]], [/(playbook);[-\w\),; ]+(rim)/i], [n, q, [p, v]], [/\b((?:bb[a-f]|st[hv])100-\d)/i, /\(bb10; (\w+)/i], [n, [q, C], [p, u]], [/(?:\b|asus_)(transfo[prime ]{4,10} \w+|eeepc|slider \w+|nexus 7|padfone|p00[cj])/i], [n, [q, B], [p, v]], [/ (z[bes]6[027][012][km][ls]|zenfone \d\w?)\b/i], [n, [q, B], [p, u]], [/(nexus 9)/i], [n, [q, "HTC"], [p, v]], [/(htc)[-;_ ]{1,2}([\w ]+(?=\)| bui)|\w+)/i, /(zte)[- ]([\w ]+?)(?: bui|\/|\))/i, /(alcatel|geeksphone|nexian|panasonic(?!(?:;|\.))|sony(?!-bra))[-_ ]?([-\w]*)/i], [q, [n, /_/g, " "], [p, u]], [/droid.+; ([ab][1-7]-?[0178a]\d\d?)/i], [n, [q, "Acer"], [p, v]], [/droid.+; (m[1-5] note) bui/i, /\bmz-([-\w]{2,})/i], [n, [q, "Meizu"], [p, u]], [/(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|meizu|motorola|polytron)[-_ ]?([-\w]*)/i, /(hp) ([\w ]+\w)/i, /(asus)-?(\w+)/i, /(microsoft); (lumia[\w ]+)/i, /(lenovo)[-_ ]?([-\w]+)/i, /(jolla)/i, /(oppo) ?([\w ]+) bui/i], [q, n, [p, u]], [/(kobo)\s(ereader|touch)/i, /(archos) (gamepad2?)/i, /(hp).+(touchpad(?!.+tablet)|tablet)/i, /(kindle)\/([\w\.]+)/i, /(nook)[\w ]+build\/(\w+)/i, /(dell) (strea[kpr\d ]*[\dko])/i, /(le[- ]+pan)[- ]+(\w{1,9}) bui/i, /(trinity)[- ]*(t\d{3}) bui/i, /(gigaset)[- ]+(q\w{1,9}) bui/i, /(vodafone) ([\w ]+)(?:\)| bui)/i], [q, n, [p, v]], [/(surface duo)/i], [n, [q, I], [p, v]], [/droid [\d\.]+; (fp\du?)(?: b|\))/i], [n, [q, "Fairphone"], [p, u]], [/(u304aa)/i], [n, [q, "AT&T"], [p, u]], [/\bsie-(\w*)/i], [n, [q, "Siemens"], [p, u]], [/\b(rct\w+) b/i], [n, [q, "RCA"], [p, v]], [/\b(venue[\d ]{2,7}) b/i], [n, [q, "Dell"], [p, v]], [/\b(q(?:mv|ta)\w+) b/i], [n, [q, "Verizon"], [p, v]], [/\b(?:barnes[& ]+noble |bn[rt])([\w\+ ]*) b/i], [n, [q, "Barnes & Noble"], [p, v]], [/\b(tm\d{3}\w+) b/i], [n, [q, "NuVision"], [p, v]], [/\b(k88) b/i], [n, [q, "ZTE"], [p, v]], [/\b(nx\d{3}j) b/i], [n, [q, "ZTE"], [p, u]], [/\b(gen\d{3}) b.+49h/i], [n, [q, "Swiss"], [p, u]], [/\b(zur\d{3}) b/i], [n, [q, "Swiss"], [p, v]], [/\b((zeki)?tb.*\b) b/i], [n, [q, "Zeki"], [p, v]], [/\b([yr]\d{2}) b/i, /\b(dragon[- ]+touch |dt)(\w{5}) b/i], [[q, "Dragon Touch"], n, [p, v]], [/\b(ns-?\w{0,9}) b/i], [n, [q, "Insignia"], [p, v]], [/\b((nxa|next)-?\w{0,9}) b/i], [n, [q, "NextBook"], [p, v]], [/\b(xtreme\_)?(v(1[045]|2[015]|[3469]0|7[05])) b/i], [[q, "Voice"], n, [p, u]], [/\b(lvtel\-)?(v1[12]) b/i], [[q, "LvTel"], n, [p, u]], [/\b(ph-1) /i], [n, [q, "Essential"], [p, u]], [/\b(v(100md|700na|7011|917g).*\b) b/i], [n, [q, "Envizen"], [p, v]], [/\b(trio[-\w\. ]+) b/i], [n, [q, "MachSpeed"], [p, v]], [/\btu_(1491) b/i], [n, [q, "Rotor"], [p, v]], [/(shield[\w ]+) b/i], [n, [q, "Nvidia"], [p, v]], [/(sprint) (\w+)/i], [q, n, [p, u]], [/(kin\.[onetw]{3})/i], [[n, /\./g, " "], [q, I], [p, u]], [/droid.+; (cc6666?|et5[16]|mc[239][23]x?|vc8[03]x?)\)/i], [n, [q, P], [p, v]], [/droid.+; (ec30|ps20|tc[2-8]\d[kx])\)/i], [n, [q, P], [p, u]], [/smart-tv.+(samsung)/i], [q, [p, w]], [/hbbtv.+maple;(\d+)/i], [[n, /^/, "SmartTV"], [q, L], [p, w]], [/(nux; netcast.+smarttv|lg (netcast\.tv-201\d|android tv))/i], [[q, "LG"], [p, w]], [/(apple) ?tv/i], [q, [n, A + " TV"], [p, w]], [/crkey/i], [[n, E + "cast"], [q, G], [p, w]], [/droid.+aft(\w)( bui|\))/i], [n, [q, z], [p, w]], [/\(dtv[\);].+(aquos)/i, /(aquos-tv[\w ]+)\)/i], [n, [q, M], [p, w]], [/(bravia[\w ]+)( bui|\))/i], [n, [q, N], [p, w]], [/(mitv-\w{5}) bui/i], [n, [q, O], [p, w]], [/Hbbtv.*(technisat) (.*);/i], [q, n, [p, w]], [/\b(roku)[\dx]*[\)\/]((?:dvp-)?[\d\.]*)/i, /hbbtv\/\d+\.\d+\.\d+ +\([\w\+ ]*; *([\w\d][^;]*);([^;]*)/i], [[q, X], [n, X], [p, w]], [/\b(android tv|smart[- ]?tv|opera tv|tv; rv:)\b/i], [[p, w]], [/(ouya)/i, /(nintendo) ([wids3utch]+)/i], [q, n, [p, t]], [/droid.+; (shield) bui/i], [n, [q, "Nvidia"], [p, t]], [/(playstation [345portablevi]+)/i], [n, [q, N], [p, t]], [/\b(xbox(?: one)?(?!; xbox))[\); ]/i], [n, [q, I], [p, t]], [/((pebble))app/i], [q, n, [p, x]], [/(watch)(?: ?os[,\/]|\d,\d\/)[\d\.]+/i], [n, [q, A], [p, x]], [/droid.+; (glass) \d/i], [n, [q, G], [p, x]], [/droid.+; (wt63?0{2,3})\)/i], [n, [q, P], [p, x]], [/(quest( 2| pro)?)/i], [n, [q, Q], [p, x]], [/(tesla)(?: qtcarbrowser|\/[-\w\.]+)/i], [q, [p, y]], [/(aeobc)\b/i], [n, [q, z], [p, y]], [/droid .+?; ([^;]+?)(?: bui|\) applew).+? mobile safari/i], [n, [p, u]], [/droid .+?; ([^;]+?)(?: bui|\) applew).+?(?! mobile) safari/i], [n, [p, v]], [/\b((tablet|tab)[;\/]|focus\/\d(?!.+mobile))/i], [[p, v]], [/(phone|mobile(?:[;\/]| [ \w\/\.]*safari)|pda(?=.+windows ce))/i], [[p, u]], [/(android[-\w\. ]{0,9});.+buil/i], [n, [q, "Generic"]]], engine: [[/windows.+ edge\/([\w\.]+)/i], [r, [o, "EdgeHTML"]], [/webkit\/537\.36.+chrome\/(?!27)([\w\.]+)/i], [r, [o, "Blink"]], [/(presto)\/([\w\.]+)/i, /(webkit|trident|netfront|netsurf|amaya|lynx|w3m|goanna)\/([\w\.]+)/i, /ekioh(flow)\/([\w\.]+)/i, /(khtml|tasman|links)[\/ ]\(?([\w\.]+)/i, /(icab)[\/ ]([23]\.[\d\.]+)/i, /\b(libweb)/i], [o, r], [/rv\:([\w\.]{1,9})\b.+(gecko)/i], [r, o]], os: [[/microsoft (windows) (vista|xp)/i], [o, r], [/(windows) nt 6\.2; (arm)/i, /(windows (?:phone(?: os)?|mobile))[\/ ]?([\d\.\w ]*)/i, /(windows)[\/ ]?([ntce\d\. ]+\w)(?!.+xbox)/i], [o, [r, Z, $]], [/(win(?=3|9|n)|win 9x )([nt\d\.]+)/i], [[o, "Windows"], [r, Z, $]], [/ip[honead]{2,4}\b(?:.*os ([\w]+) like mac|; opera)/i, /ios;fbsv\/([\d\.]+)/i, /cfnetwork\/.+darwin/i], [[r, /_/g, "."], [o, "iOS"]], [/(mac os x) ?([\w\. ]*)/i, /(macintosh|mac_powerpc\b)(?!.+haiku)/i], [[o, S], [r, /_/g, "."]], [/droid ([\w\.]+)\b.+(android[- ]x86|harmonyos)/i], [r, o], [/(android|webos|qnx|bada|rim tablet os|maemo|meego|sailfish)[-\/ ]?([\w\.]*)/i, /(blackberry)\w*\/([\w\.]*)/i, /(tizen|kaios)[\/ ]([\w\.]+)/i, /\((series40);/i], [o, r], [/\(bb(10);/i], [r, [o, C]], [/(?:symbian ?os|symbos|s60(?=;)|series60)[-\/ ]?([\w\.]*)/i], [r, [o, "Symbian"]], [/mozilla\/[\d\.]+ \((?:mobile|tablet|tv|mobile; [\w ]+); rv:.+ gecko\/([\w\.]+)/i], [r, [o, F + " OS"]], [/web0s;.+rt(tv)/i, /\b(?:hp)?wos(?:browser)?\/([\w\.]+)/i], [r, [o, "webOS"]], [/watch(?: ?os[,\/]|\d,\d\/)([\d\.]+)/i], [r, [o, "watchOS"]], [/crkey\/([\d\.]+)/i], [r, [o, E + "cast"]], [/(cros) [\w]+(?:\)| ([\w\.]+)\b)/i], [[o, R], r], [/panasonic;(viera)/i, /(netrange)mmh/i, /(nettv)\/(\d+\.[\w\.]+)/i, /(nintendo|playstation) ([wids345portablevuch]+)/i, /(xbox); +xbox ([^\);]+)/i, /\b(joli|palm)\b ?(?:os)?\/?([\w\.]*)/i, /(mint)[\/\(\) ]?(\w*)/i, /(mageia|vectorlinux)[; ]/i, /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-\/ ]?(?!chrom|package)([-\w\.]*)/i, /(hurd|linux) ?([\w\.]*)/i, /(gnu) ?([\w\.]*)/i, /\b([-frentopcghs]{0,5}bsd|dragonfly)[\/ ]?(?!amd|[ix346]{1,2}86)([\w\.]*)/i, /(haiku) (\w+)/i], [o, r], [/(sunos) ?([\w\.\d]*)/i], [[o, "Solaris"], r], [/((?:open)?solaris)[-\/ ]?([\w\.]*)/i, /(aix) ((\d)(?=\.|\)| )[\w\.])*/i, /\b(beos|os\/2|amigaos|morphos|openvms|fuchsia|hp-ux|serenityos)/i, /(unix) ?([\w\.]*)/i], [o, r]] }, aa = function(a2, b2) {
              if (typeof a2 === k && (b2 = a2, a2 = h), !(this instanceof aa)) return new aa(a2, b2).getResult();
              var c2 = typeof g2 !== j && g2.navigator ? g2.navigator : h, d2 = a2 || (c2 && c2.userAgent ? c2.userAgent : ""), e3 = c2 && c2.userAgentData ? c2.userAgentData : h, f3 = b2 ? T(_, b2) : _, t2 = c2 && c2.userAgent == d2;
              return this.getBrowser = function() {
                var a3, b3 = {};
                return b3[o] = h, b3[r] = h, Y.call(b3, d2, f3.browser), b3[m] = typeof (a3 = b3[r]) === l ? a3.replace(/[^\d\.]/g, "").split(".")[0] : h, t2 && c2 && c2.brave && typeof c2.brave.isBrave == i && (b3[o] = "Brave"), b3;
              }, this.getCPU = function() {
                var a3 = {};
                return a3[s] = h, Y.call(a3, d2, f3.cpu), a3;
              }, this.getDevice = function() {
                var a3 = {};
                return a3[q] = h, a3[n] = h, a3[p] = h, Y.call(a3, d2, f3.device), t2 && !a3[p] && e3 && e3.mobile && (a3[p] = u), t2 && "Macintosh" == a3[n] && c2 && typeof c2.standalone !== j && c2.maxTouchPoints && c2.maxTouchPoints > 2 && (a3[n] = "iPad", a3[p] = v), a3;
              }, this.getEngine = function() {
                var a3 = {};
                return a3[o] = h, a3[r] = h, Y.call(a3, d2, f3.engine), a3;
              }, this.getOS = function() {
                var a3 = {};
                return a3[o] = h, a3[r] = h, Y.call(a3, d2, f3.os), t2 && !a3[o] && e3 && "Unknown" != e3.platform && (a3[o] = e3.platform.replace(/chrome os/i, R).replace(/macos/i, S)), a3;
              }, this.getResult = function() {
                return { ua: this.getUA(), browser: this.getBrowser(), engine: this.getEngine(), os: this.getOS(), device: this.getDevice(), cpu: this.getCPU() };
              }, this.getUA = function() {
                return d2;
              }, this.setUA = function(a3) {
                return d2 = typeof a3 === l && a3.length > 350 ? X(a3, 350) : a3, this;
              }, this.setUA(d2), this;
            };
            aa.VERSION = "1.0.35", aa.BROWSER = U([o, r, m]), aa.CPU = U([s]), aa.DEVICE = U([n, q, p, t, u, w, v, x, y]), aa.ENGINE = aa.OS = U([o, r]), typeof f2 !== j ? (e2.exports && (f2 = e2.exports = aa), f2.UAParser = aa) : c.amdO ? void 0 === (d = function() {
              return aa;
            }.call(b, c, b, a)) || (a.exports = d) : typeof g2 !== j && (g2.UAParser = aa);
            var ab = typeof g2 !== j && (g2.jQuery || g2.Zepto);
            if (ab && !ab.ua) {
              var ac = new aa();
              ab.ua = ac.getResult(), ab.ua.get = function() {
                return ac.getUA();
              }, ab.ua.set = function(a2) {
                ac.setUA(a2);
                var b2 = ac.getResult();
                for (var c2 in b2) ab.ua[c2] = b2[c2];
              };
            }
          }("object" == typeof window ? window : this);
        } }, f = {};
        function g(a2) {
          var b2 = f[a2];
          if (void 0 !== b2) return b2.exports;
          var c2 = f[a2] = { exports: {} }, d2 = true;
          try {
            e[a2].call(c2.exports, c2, c2.exports, g), d2 = false;
          } finally {
            d2 && delete f[a2];
          }
          return c2.exports;
        }
        g.ab = "//", a.exports = g(226);
      })();
    }, 5356: (a) => {
      "use strict";
      a.exports = (init_node_buffer(), __toCommonJS(node_buffer_exports));
    }, 5392: (a, b, c) => {
      "use strict";
      Object.defineProperty(b, "__esModule", { value: true }), !function(a2, b2) {
        for (var c2 in b2) Object.defineProperty(a2, c2, { enumerable: true, get: b2[c2] });
      }(b, { getTestReqInfo: function() {
        return g;
      }, withRequest: function() {
        return f;
      } });
      let d = new (c(5521)).AsyncLocalStorage();
      function e(a2, b2) {
        let c2 = b2.header(a2, "next-test-proxy-port");
        if (!c2) return;
        let d2 = b2.url(a2);
        return { url: d2, proxyPort: Number(c2), testData: b2.header(a2, "next-test-data") || "" };
      }
      function f(a2, b2, c2) {
        let f2 = e(a2, b2);
        return f2 ? d.run(f2, c2) : c2();
      }
      function g(a2, b2) {
        let c2 = d.getStore();
        return c2 || (a2 && b2 ? e(a2, b2) : void 0);
      }
    }, 5521: (a) => {
      "use strict";
      a.exports = (init_node_async_hooks(), __toCommonJS(node_async_hooks_exports));
    }, 5663: (a) => {
      (() => {
        "use strict";
        "undefined" != typeof __nccwpck_require__ && (__nccwpck_require__.ab = "//");
        var b = {};
        (() => {
          b.parse = function(b2, c2) {
            if ("string" != typeof b2) throw TypeError("argument str must be a string");
            for (var e2 = {}, f = b2.split(d), g = (c2 || {}).decode || a2, h = 0; h < f.length; h++) {
              var i = f[h], j = i.indexOf("=");
              if (!(j < 0)) {
                var k = i.substr(0, j).trim(), l = i.substr(++j, i.length).trim();
                '"' == l[0] && (l = l.slice(1, -1)), void 0 == e2[k] && (e2[k] = function(a3, b3) {
                  try {
                    return b3(a3);
                  } catch (b4) {
                    return a3;
                  }
                }(l, g));
              }
            }
            return e2;
          }, b.serialize = function(a3, b2, d2) {
            var f = d2 || {}, g = f.encode || c;
            if ("function" != typeof g) throw TypeError("option encode is invalid");
            if (!e.test(a3)) throw TypeError("argument name is invalid");
            var h = g(b2);
            if (h && !e.test(h)) throw TypeError("argument val is invalid");
            var i = a3 + "=" + h;
            if (null != f.maxAge) {
              var j = f.maxAge - 0;
              if (isNaN(j) || !isFinite(j)) throw TypeError("option maxAge is invalid");
              i += "; Max-Age=" + Math.floor(j);
            }
            if (f.domain) {
              if (!e.test(f.domain)) throw TypeError("option domain is invalid");
              i += "; Domain=" + f.domain;
            }
            if (f.path) {
              if (!e.test(f.path)) throw TypeError("option path is invalid");
              i += "; Path=" + f.path;
            }
            if (f.expires) {
              if ("function" != typeof f.expires.toUTCString) throw TypeError("option expires is invalid");
              i += "; Expires=" + f.expires.toUTCString();
            }
            if (f.httpOnly && (i += "; HttpOnly"), f.secure && (i += "; Secure"), f.sameSite) switch ("string" == typeof f.sameSite ? f.sameSite.toLowerCase() : f.sameSite) {
              case true:
              case "strict":
                i += "; SameSite=Strict";
                break;
              case "lax":
                i += "; SameSite=Lax";
                break;
              case "none":
                i += "; SameSite=None";
                break;
              default:
                throw TypeError("option sameSite is invalid");
            }
            return i;
          };
          var a2 = decodeURIComponent, c = encodeURIComponent, d = /; */, e = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
        })(), a.exports = b;
      })();
    }, 6153: (a, b, c) => {
      "use strict";
      c.r(b), c.d(b, { default: () => f, hkdf: () => f });
      let d = async (a2, b2, c2, d2, e2) => {
        let { crypto: { subtle: f2 } } = (() => {
          if ("undefined" != typeof globalThis) return globalThis;
          if ("undefined" != typeof self) return self;
          if ("undefined" != typeof window) return window;
          throw Error("unable to locate global object");
        })();
        return new Uint8Array(await f2.deriveBits({ name: "HKDF", hash: `SHA-${a2.substr(3)}`, salt: c2, info: d2 }, await f2.importKey("raw", b2, "HKDF", false, ["deriveBits"]), e2 << 3));
      };
      function e(a2, b2) {
        if ("string" == typeof a2) return new TextEncoder().encode(a2);
        if (!(a2 instanceof Uint8Array)) throw TypeError(`"${b2}"" must be an instance of Uint8Array or a string`);
        return a2;
      }
      async function f(a2, b2, c2, f2, g) {
        return d(function(a3) {
          switch (a3) {
            case "sha256":
            case "sha384":
            case "sha512":
            case "sha1":
              return a3;
            default:
              throw TypeError('unsupported "digest" value');
          }
        }(a2), function(a3) {
          let b3 = e(a3, "ikm");
          if (!b3.byteLength) throw TypeError('"ikm" must be at least one byte in length');
          return b3;
        }(b2), e(c2, "salt"), function(a3) {
          let b3 = e(a3, "info");
          if (b3.byteLength > 1024) throw TypeError('"info" must not contain more than 1024 bytes');
          return b3;
        }(f2), function(a3, b3) {
          if ("number" != typeof a3 || !Number.isInteger(a3) || a3 < 1) throw TypeError('"keylen" must be a positive integer');
          if (a3 > 255 * (parseInt(b3.substr(3), 10) >> 3 || 20)) throw TypeError('"keylen" too large');
          return a3;
        }(g, a2));
      }
    }, 6440: (a, b) => {
      "use strict";
      Symbol.for("react.transitional.element"), Symbol.for("react.portal"), Symbol.for("react.fragment"), Symbol.for("react.strict_mode"), Symbol.for("react.profiler"), Symbol.for("react.forward_ref"), Symbol.for("react.suspense"), Symbol.for("react.memo"), Symbol.for("react.lazy"), Symbol.iterator;
      Object.prototype.hasOwnProperty, Object.assign;
    }, 6522: (a) => {
      a.exports = function(a2) {
        return a2 && a2.__esModule ? a2 : { default: a2 };
      }, a.exports.__esModule = true, a.exports.default = a.exports;
    }, 6667: (a, b, c) => {
      "use strict";
      let d;
      c.r(b), c.d(b, { default: () => bA });
      var e, f = {};
      async function g() {
        return "_ENTRIES" in globalThis && _ENTRIES.middleware_instrumentation && await _ENTRIES.middleware_instrumentation;
      }
      c.r(f), c.d(f, { config: () => bw, middleware: () => bv });
      let h = null;
      async function i() {
        if ("phase-production-build" === process.env.NEXT_PHASE) return;
        h || (h = g());
        let a10 = await h;
        if (null == a10 ? void 0 : a10.register) try {
          await a10.register();
        } catch (a11) {
          throw a11.message = `An error occurred while loading instrumentation hook: ${a11.message}`, a11;
        }
      }
      async function j(...a10) {
        let b2 = await g();
        try {
          var c2;
          await (null == b2 || null == (c2 = b2.onRequestError) ? void 0 : c2.call(b2, ...a10));
        } catch (a11) {
          console.error("Error in instrumentation.onRequestError:", a11);
        }
      }
      let k = null;
      function l() {
        return k || (k = i()), k;
      }
      function m(a10) {
        return `The edge runtime does not support Node.js '${a10}' module.
Learn More: https://nextjs.org/docs/messages/node-module-in-edge-runtime`;
      }
      process !== c.g.process && (process.env = c.g.process.env, c.g.process = process);
      try {
        Object.defineProperty(globalThis, "__import_unsupported", { value: function(a10) {
          let b2 = new Proxy(function() {
          }, { get(b3, c2) {
            if ("then" === c2) return {};
            throw Object.defineProperty(Error(m(a10)), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
          }, construct() {
            throw Object.defineProperty(Error(m(a10)), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
          }, apply(c2, d2, e2) {
            if ("function" == typeof e2[0]) return e2[0](b2);
            throw Object.defineProperty(Error(m(a10)), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
          } });
          return new Proxy({}, { get: () => b2 });
        }, enumerable: false, configurable: false });
      } catch {
      }
      l();
      class n extends Error {
        constructor({ page: a10 }) {
          super(`The middleware "${a10}" accepts an async API directly with the form:
  
  export function middleware(request, event) {
    return NextResponse.redirect('/new-location')
  }
  
  Read more: https://nextjs.org/docs/messages/middleware-new-signature
  `);
        }
      }
      class o extends Error {
        constructor() {
          super(`The request.page has been deprecated in favour of \`URLPattern\`.
  Read more: https://nextjs.org/docs/messages/middleware-request-page
  `);
        }
      }
      class p extends Error {
        constructor() {
          super(`The request.ua has been removed in favour of \`userAgent\` function.
  Read more: https://nextjs.org/docs/messages/middleware-parse-user-agent
  `);
        }
      }
      let q = "_N_T_", r = { shared: "shared", reactServerComponents: "rsc", serverSideRendering: "ssr", actionBrowser: "action-browser", apiNode: "api-node", apiEdge: "api-edge", middleware: "middleware", instrument: "instrument", edgeAsset: "edge-asset", appPagesBrowser: "app-pages-browser", pagesDirBrowser: "pages-dir-browser", pagesDirEdge: "pages-dir-edge", pagesDirNode: "pages-dir-node" };
      function s(a10) {
        var b2, c2, d2, e2, f2, g2 = [], h2 = 0;
        function i2() {
          for (; h2 < a10.length && /\s/.test(a10.charAt(h2)); ) h2 += 1;
          return h2 < a10.length;
        }
        for (; h2 < a10.length; ) {
          for (b2 = h2, f2 = false; i2(); ) if ("," === (c2 = a10.charAt(h2))) {
            for (d2 = h2, h2 += 1, i2(), e2 = h2; h2 < a10.length && "=" !== (c2 = a10.charAt(h2)) && ";" !== c2 && "," !== c2; ) h2 += 1;
            h2 < a10.length && "=" === a10.charAt(h2) ? (f2 = true, h2 = e2, g2.push(a10.substring(b2, d2)), b2 = h2) : h2 = d2 + 1;
          } else h2 += 1;
          (!f2 || h2 >= a10.length) && g2.push(a10.substring(b2, a10.length));
        }
        return g2;
      }
      function t(a10) {
        let b2 = {}, c2 = [];
        if (a10) for (let [d2, e2] of a10.entries()) "set-cookie" === d2.toLowerCase() ? (c2.push(...s(e2)), b2[d2] = 1 === c2.length ? c2[0] : c2) : b2[d2] = e2;
        return b2;
      }
      function u(a10) {
        try {
          return String(new URL(String(a10)));
        } catch (b2) {
          throw Object.defineProperty(Error(`URL is malformed "${String(a10)}". Please use only absolute URLs - https://nextjs.org/docs/messages/middleware-relative-urls`, { cause: b2 }), "__NEXT_ERROR_CODE", { value: "E61", enumerable: false, configurable: true });
        }
      }
      ({ ...r, GROUP: { builtinReact: [r.reactServerComponents, r.actionBrowser], serverOnly: [r.reactServerComponents, r.actionBrowser, r.instrument, r.middleware], neutralTarget: [r.apiNode, r.apiEdge], clientOnly: [r.serverSideRendering, r.appPagesBrowser], bundled: [r.reactServerComponents, r.actionBrowser, r.serverSideRendering, r.appPagesBrowser, r.shared, r.instrument, r.middleware], appPages: [r.reactServerComponents, r.serverSideRendering, r.appPagesBrowser, r.actionBrowser] } });
      let v = Symbol("response"), w = Symbol("passThrough"), x = Symbol("waitUntil");
      class y {
        constructor(a10, b2) {
          this[w] = false, this[x] = b2 ? { kind: "external", function: b2 } : { kind: "internal", promises: [] };
        }
        respondWith(a10) {
          this[v] || (this[v] = Promise.resolve(a10));
        }
        passThroughOnException() {
          this[w] = true;
        }
        waitUntil(a10) {
          if ("external" === this[x].kind) return (0, this[x].function)(a10);
          this[x].promises.push(a10);
        }
      }
      class z extends y {
        constructor(a10) {
          var b2;
          super(a10.request, null == (b2 = a10.context) ? void 0 : b2.waitUntil), this.sourcePage = a10.page;
        }
        get request() {
          throw Object.defineProperty(new n({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
        respondWith() {
          throw Object.defineProperty(new n({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
      }
      function A(a10) {
        return a10.replace(/\/$/, "") || "/";
      }
      function B(a10) {
        let b2 = a10.indexOf("#"), c2 = a10.indexOf("?"), d2 = c2 > -1 && (b2 < 0 || c2 < b2);
        return d2 || b2 > -1 ? { pathname: a10.substring(0, d2 ? c2 : b2), query: d2 ? a10.substring(c2, b2 > -1 ? b2 : void 0) : "", hash: b2 > -1 ? a10.slice(b2) : "" } : { pathname: a10, query: "", hash: "" };
      }
      function C(a10, b2) {
        if (!a10.startsWith("/") || !b2) return a10;
        let { pathname: c2, query: d2, hash: e2 } = B(a10);
        return "" + b2 + c2 + d2 + e2;
      }
      function D(a10, b2) {
        if (!a10.startsWith("/") || !b2) return a10;
        let { pathname: c2, query: d2, hash: e2 } = B(a10);
        return "" + c2 + b2 + d2 + e2;
      }
      function E(a10, b2) {
        if ("string" != typeof a10) return false;
        let { pathname: c2 } = B(a10);
        return c2 === b2 || c2.startsWith(b2 + "/");
      }
      let F = /* @__PURE__ */ new WeakMap();
      function G(a10, b2) {
        let c2;
        if (!b2) return { pathname: a10 };
        let d2 = F.get(b2);
        d2 || (d2 = b2.map((a11) => a11.toLowerCase()), F.set(b2, d2));
        let e2 = a10.split("/", 2);
        if (!e2[1]) return { pathname: a10 };
        let f2 = e2[1].toLowerCase(), g2 = d2.indexOf(f2);
        return g2 < 0 ? { pathname: a10 } : (c2 = b2[g2], { pathname: a10 = a10.slice(c2.length + 1) || "/", detectedLocale: c2 });
      }
      let H = /(?!^https?:\/\/)(127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|\[::1\]|localhost)/;
      function I(a10, b2) {
        return new URL(String(a10).replace(H, "localhost"), b2 && String(b2).replace(H, "localhost"));
      }
      let J = Symbol("NextURLInternal");
      class K {
        constructor(a10, b2, c2) {
          let d2, e2;
          "object" == typeof b2 && "pathname" in b2 || "string" == typeof b2 ? (d2 = b2, e2 = c2 || {}) : e2 = c2 || b2 || {}, this[J] = { url: I(a10, d2 ?? e2.base), options: e2, basePath: "" }, this.analyze();
        }
        analyze() {
          var a10, b2, c2, d2, e2;
          let f2 = function(a11, b3) {
            var c3, d3;
            let { basePath: e3, i18n: f3, trailingSlash: g3 } = null != (c3 = b3.nextConfig) ? c3 : {}, h3 = { pathname: a11, trailingSlash: "/" !== a11 ? a11.endsWith("/") : g3 };
            e3 && E(h3.pathname, e3) && (h3.pathname = function(a12, b4) {
              if (!E(a12, b4)) return a12;
              let c4 = a12.slice(b4.length);
              return c4.startsWith("/") ? c4 : "/" + c4;
            }(h3.pathname, e3), h3.basePath = e3);
            let i2 = h3.pathname;
            if (h3.pathname.startsWith("/_next/data/") && h3.pathname.endsWith(".json")) {
              let a12 = h3.pathname.replace(/^\/_next\/data\//, "").replace(/\.json$/, "").split("/");
              h3.buildId = a12[0], i2 = "index" !== a12[1] ? "/" + a12.slice(1).join("/") : "/", true === b3.parseData && (h3.pathname = i2);
            }
            if (f3) {
              let a12 = b3.i18nProvider ? b3.i18nProvider.analyze(h3.pathname) : G(h3.pathname, f3.locales);
              h3.locale = a12.detectedLocale, h3.pathname = null != (d3 = a12.pathname) ? d3 : h3.pathname, !a12.detectedLocale && h3.buildId && (a12 = b3.i18nProvider ? b3.i18nProvider.analyze(i2) : G(i2, f3.locales)).detectedLocale && (h3.locale = a12.detectedLocale);
            }
            return h3;
          }(this[J].url.pathname, { nextConfig: this[J].options.nextConfig, parseData: true, i18nProvider: this[J].options.i18nProvider }), g2 = function(a11, b3) {
            let c3;
            if ((null == b3 ? void 0 : b3.host) && !Array.isArray(b3.host)) c3 = b3.host.toString().split(":", 1)[0];
            else {
              if (!a11.hostname) return;
              c3 = a11.hostname;
            }
            return c3.toLowerCase();
          }(this[J].url, this[J].options.headers);
          this[J].domainLocale = this[J].options.i18nProvider ? this[J].options.i18nProvider.detectDomainLocale(g2) : function(a11, b3, c3) {
            if (a11) for (let f3 of (c3 && (c3 = c3.toLowerCase()), a11)) {
              var d3, e3;
              if (b3 === (null == (d3 = f3.domain) ? void 0 : d3.split(":", 1)[0].toLowerCase()) || c3 === f3.defaultLocale.toLowerCase() || (null == (e3 = f3.locales) ? void 0 : e3.some((a12) => a12.toLowerCase() === c3))) return f3;
            }
          }(null == (b2 = this[J].options.nextConfig) || null == (a10 = b2.i18n) ? void 0 : a10.domains, g2);
          let h2 = (null == (c2 = this[J].domainLocale) ? void 0 : c2.defaultLocale) || (null == (e2 = this[J].options.nextConfig) || null == (d2 = e2.i18n) ? void 0 : d2.defaultLocale);
          this[J].url.pathname = f2.pathname, this[J].defaultLocale = h2, this[J].basePath = f2.basePath ?? "", this[J].buildId = f2.buildId, this[J].locale = f2.locale ?? h2, this[J].trailingSlash = f2.trailingSlash;
        }
        formatPathname() {
          var a10;
          let b2;
          return b2 = function(a11, b3, c2, d2) {
            if (!b3 || b3 === c2) return a11;
            let e2 = a11.toLowerCase();
            return !d2 && (E(e2, "/api") || E(e2, "/" + b3.toLowerCase())) ? a11 : C(a11, "/" + b3);
          }((a10 = { basePath: this[J].basePath, buildId: this[J].buildId, defaultLocale: this[J].options.forceLocale ? void 0 : this[J].defaultLocale, locale: this[J].locale, pathname: this[J].url.pathname, trailingSlash: this[J].trailingSlash }).pathname, a10.locale, a10.buildId ? void 0 : a10.defaultLocale, a10.ignorePrefix), (a10.buildId || !a10.trailingSlash) && (b2 = A(b2)), a10.buildId && (b2 = D(C(b2, "/_next/data/" + a10.buildId), "/" === a10.pathname ? "index.json" : ".json")), b2 = C(b2, a10.basePath), !a10.buildId && a10.trailingSlash ? b2.endsWith("/") ? b2 : D(b2, "/") : A(b2);
        }
        formatSearch() {
          return this[J].url.search;
        }
        get buildId() {
          return this[J].buildId;
        }
        set buildId(a10) {
          this[J].buildId = a10;
        }
        get locale() {
          return this[J].locale ?? "";
        }
        set locale(a10) {
          var b2, c2;
          if (!this[J].locale || !(null == (c2 = this[J].options.nextConfig) || null == (b2 = c2.i18n) ? void 0 : b2.locales.includes(a10))) throw Object.defineProperty(TypeError(`The NextURL configuration includes no locale "${a10}"`), "__NEXT_ERROR_CODE", { value: "E597", enumerable: false, configurable: true });
          this[J].locale = a10;
        }
        get defaultLocale() {
          return this[J].defaultLocale;
        }
        get domainLocale() {
          return this[J].domainLocale;
        }
        get searchParams() {
          return this[J].url.searchParams;
        }
        get host() {
          return this[J].url.host;
        }
        set host(a10) {
          this[J].url.host = a10;
        }
        get hostname() {
          return this[J].url.hostname;
        }
        set hostname(a10) {
          this[J].url.hostname = a10;
        }
        get port() {
          return this[J].url.port;
        }
        set port(a10) {
          this[J].url.port = a10;
        }
        get protocol() {
          return this[J].url.protocol;
        }
        set protocol(a10) {
          this[J].url.protocol = a10;
        }
        get href() {
          let a10 = this.formatPathname(), b2 = this.formatSearch();
          return `${this.protocol}//${this.host}${a10}${b2}${this.hash}`;
        }
        set href(a10) {
          this[J].url = I(a10), this.analyze();
        }
        get origin() {
          return this[J].url.origin;
        }
        get pathname() {
          return this[J].url.pathname;
        }
        set pathname(a10) {
          this[J].url.pathname = a10;
        }
        get hash() {
          return this[J].url.hash;
        }
        set hash(a10) {
          this[J].url.hash = a10;
        }
        get search() {
          return this[J].url.search;
        }
        set search(a10) {
          this[J].url.search = a10;
        }
        get password() {
          return this[J].url.password;
        }
        set password(a10) {
          this[J].url.password = a10;
        }
        get username() {
          return this[J].url.username;
        }
        set username(a10) {
          this[J].url.username = a10;
        }
        get basePath() {
          return this[J].basePath;
        }
        set basePath(a10) {
          this[J].basePath = a10.startsWith("/") ? a10 : `/${a10}`;
        }
        toString() {
          return this.href;
        }
        toJSON() {
          return this.href;
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return { href: this.href, origin: this.origin, protocol: this.protocol, username: this.username, password: this.password, host: this.host, hostname: this.hostname, port: this.port, pathname: this.pathname, search: this.search, searchParams: this.searchParams, hash: this.hash };
        }
        clone() {
          return new K(String(this), this[J].options);
        }
      }
      var L = c(8443);
      let M = Symbol("internal request");
      class N extends Request {
        constructor(a10, b2 = {}) {
          let c2 = "string" != typeof a10 && "url" in a10 ? a10.url : String(a10);
          u(c2), a10 instanceof Request ? super(a10, b2) : super(c2, b2);
          let d2 = new K(c2, { headers: t(this.headers), nextConfig: b2.nextConfig });
          this[M] = { cookies: new L.RequestCookies(this.headers), nextUrl: d2, url: d2.toString() };
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return { cookies: this.cookies, nextUrl: this.nextUrl, url: this.url, bodyUsed: this.bodyUsed, cache: this.cache, credentials: this.credentials, destination: this.destination, headers: Object.fromEntries(this.headers), integrity: this.integrity, keepalive: this.keepalive, method: this.method, mode: this.mode, redirect: this.redirect, referrer: this.referrer, referrerPolicy: this.referrerPolicy, signal: this.signal };
        }
        get cookies() {
          return this[M].cookies;
        }
        get nextUrl() {
          return this[M].nextUrl;
        }
        get page() {
          throw new o();
        }
        get ua() {
          throw new p();
        }
        get url() {
          return this[M].url;
        }
      }
      class O {
        static get(a10, b2, c2) {
          let d2 = Reflect.get(a10, b2, c2);
          return "function" == typeof d2 ? d2.bind(a10) : d2;
        }
        static set(a10, b2, c2, d2) {
          return Reflect.set(a10, b2, c2, d2);
        }
        static has(a10, b2) {
          return Reflect.has(a10, b2);
        }
        static deleteProperty(a10, b2) {
          return Reflect.deleteProperty(a10, b2);
        }
      }
      let P = Symbol("internal response"), Q = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
      function R(a10, b2) {
        var c2;
        if (null == a10 || null == (c2 = a10.request) ? void 0 : c2.headers) {
          if (!(a10.request.headers instanceof Headers)) throw Object.defineProperty(Error("request.headers must be an instance of Headers"), "__NEXT_ERROR_CODE", { value: "E119", enumerable: false, configurable: true });
          let c3 = [];
          for (let [d2, e2] of a10.request.headers) b2.set("x-middleware-request-" + d2, e2), c3.push(d2);
          b2.set("x-middleware-override-headers", c3.join(","));
        }
      }
      class S extends Response {
        constructor(a10, b2 = {}) {
          super(a10, b2);
          let c2 = this.headers, d2 = new Proxy(new L.ResponseCookies(c2), { get(a11, d3, e2) {
            switch (d3) {
              case "delete":
              case "set":
                return (...e3) => {
                  let f2 = Reflect.apply(a11[d3], a11, e3), g2 = new Headers(c2);
                  return f2 instanceof L.ResponseCookies && c2.set("x-middleware-set-cookie", f2.getAll().map((a12) => (0, L.stringifyCookie)(a12)).join(",")), R(b2, g2), f2;
                };
              default:
                return O.get(a11, d3, e2);
            }
          } });
          this[P] = { cookies: d2, url: b2.url ? new K(b2.url, { headers: t(c2), nextConfig: b2.nextConfig }) : void 0 };
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return { cookies: this.cookies, url: this.url, body: this.body, bodyUsed: this.bodyUsed, headers: Object.fromEntries(this.headers), ok: this.ok, redirected: this.redirected, status: this.status, statusText: this.statusText, type: this.type };
        }
        get cookies() {
          return this[P].cookies;
        }
        static json(a10, b2) {
          let c2 = Response.json(a10, b2);
          return new S(c2.body, c2);
        }
        static redirect(a10, b2) {
          let c2 = "number" == typeof b2 ? b2 : (null == b2 ? void 0 : b2.status) ?? 307;
          if (!Q.has(c2)) throw Object.defineProperty(RangeError('Failed to execute "redirect" on "response": Invalid status code'), "__NEXT_ERROR_CODE", { value: "E529", enumerable: false, configurable: true });
          let d2 = "object" == typeof b2 ? b2 : {}, e2 = new Headers(null == d2 ? void 0 : d2.headers);
          return e2.set("Location", u(a10)), new S(null, { ...d2, headers: e2, status: c2 });
        }
        static rewrite(a10, b2) {
          let c2 = new Headers(null == b2 ? void 0 : b2.headers);
          return c2.set("x-middleware-rewrite", u(a10)), R(b2, c2), new S(null, { ...b2, headers: c2 });
        }
        static next(a10) {
          let b2 = new Headers(null == a10 ? void 0 : a10.headers);
          return b2.set("x-middleware-next", "1"), R(a10, b2), new S(null, { ...a10, headers: b2 });
        }
      }
      function T(a10, b2) {
        let c2 = "string" == typeof b2 ? new URL(b2) : b2, d2 = new URL(a10, b2), e2 = d2.origin === c2.origin;
        return { url: e2 ? d2.toString().slice(c2.origin.length) : d2.toString(), isRelative: e2 };
      }
      let U = "next-router-prefetch", V = ["rsc", "next-router-state-tree", U, "next-hmr-refresh", "next-router-segment-prefetch"], W = "_rsc";
      class X extends Error {
        constructor() {
          super("Headers cannot be modified. Read more: https://nextjs.org/docs/app/api-reference/functions/headers");
        }
        static callable() {
          throw new X();
        }
      }
      class Y extends Headers {
        constructor(a10) {
          super(), this.headers = new Proxy(a10, { get(b2, c2, d2) {
            if ("symbol" == typeof c2) return O.get(b2, c2, d2);
            let e2 = c2.toLowerCase(), f2 = Object.keys(a10).find((a11) => a11.toLowerCase() === e2);
            if (void 0 !== f2) return O.get(b2, f2, d2);
          }, set(b2, c2, d2, e2) {
            if ("symbol" == typeof c2) return O.set(b2, c2, d2, e2);
            let f2 = c2.toLowerCase(), g2 = Object.keys(a10).find((a11) => a11.toLowerCase() === f2);
            return O.set(b2, g2 ?? c2, d2, e2);
          }, has(b2, c2) {
            if ("symbol" == typeof c2) return O.has(b2, c2);
            let d2 = c2.toLowerCase(), e2 = Object.keys(a10).find((a11) => a11.toLowerCase() === d2);
            return void 0 !== e2 && O.has(b2, e2);
          }, deleteProperty(b2, c2) {
            if ("symbol" == typeof c2) return O.deleteProperty(b2, c2);
            let d2 = c2.toLowerCase(), e2 = Object.keys(a10).find((a11) => a11.toLowerCase() === d2);
            return void 0 === e2 || O.deleteProperty(b2, e2);
          } });
        }
        static seal(a10) {
          return new Proxy(a10, { get(a11, b2, c2) {
            switch (b2) {
              case "append":
              case "delete":
              case "set":
                return X.callable;
              default:
                return O.get(a11, b2, c2);
            }
          } });
        }
        merge(a10) {
          return Array.isArray(a10) ? a10.join(", ") : a10;
        }
        static from(a10) {
          return a10 instanceof Headers ? a10 : new Y(a10);
        }
        append(a10, b2) {
          let c2 = this.headers[a10];
          "string" == typeof c2 ? this.headers[a10] = [c2, b2] : Array.isArray(c2) ? c2.push(b2) : this.headers[a10] = b2;
        }
        delete(a10) {
          delete this.headers[a10];
        }
        get(a10) {
          let b2 = this.headers[a10];
          return void 0 !== b2 ? this.merge(b2) : null;
        }
        has(a10) {
          return void 0 !== this.headers[a10];
        }
        set(a10, b2) {
          this.headers[a10] = b2;
        }
        forEach(a10, b2) {
          for (let [c2, d2] of this.entries()) a10.call(b2, d2, c2, this);
        }
        *entries() {
          for (let a10 of Object.keys(this.headers)) {
            let b2 = a10.toLowerCase(), c2 = this.get(b2);
            yield [b2, c2];
          }
        }
        *keys() {
          for (let a10 of Object.keys(this.headers)) {
            let b2 = a10.toLowerCase();
            yield b2;
          }
        }
        *values() {
          for (let a10 of Object.keys(this.headers)) {
            let b2 = this.get(a10);
            yield b2;
          }
        }
        [Symbol.iterator]() {
          return this.entries();
        }
      }
      let Z = Object.defineProperty(Error("Invariant: AsyncLocalStorage accessed in runtime where it is not available"), "__NEXT_ERROR_CODE", { value: "E504", enumerable: false, configurable: true });
      class $ {
        disable() {
          throw Z;
        }
        getStore() {
        }
        run() {
          throw Z;
        }
        exit() {
          throw Z;
        }
        enterWith() {
          throw Z;
        }
        static bind(a10) {
          return a10;
        }
      }
      let _ = "undefined" != typeof globalThis && globalThis.AsyncLocalStorage;
      function aa() {
        return _ ? new _() : new $();
      }
      let ab = aa();
      class ac extends Error {
        constructor() {
          super("Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options");
        }
        static callable() {
          throw new ac();
        }
      }
      class ad {
        static seal(a10) {
          return new Proxy(a10, { get(a11, b2, c2) {
            switch (b2) {
              case "clear":
              case "delete":
              case "set":
                return ac.callable;
              default:
                return O.get(a11, b2, c2);
            }
          } });
        }
      }
      let ae = Symbol.for("next.mutated.cookies");
      class af {
        static wrap(a10, b2) {
          let c2 = new L.ResponseCookies(new Headers());
          for (let b3 of a10.getAll()) c2.set(b3);
          let d2 = [], e2 = /* @__PURE__ */ new Set(), f2 = () => {
            let a11 = ab.getStore();
            if (a11 && (a11.pathWasRevalidated = true), d2 = c2.getAll().filter((a12) => e2.has(a12.name)), b2) {
              let a12 = [];
              for (let b3 of d2) {
                let c3 = new L.ResponseCookies(new Headers());
                c3.set(b3), a12.push(c3.toString());
              }
              b2(a12);
            }
          }, g2 = new Proxy(c2, { get(a11, b3, c3) {
            switch (b3) {
              case ae:
                return d2;
              case "delete":
                return function(...b4) {
                  e2.add("string" == typeof b4[0] ? b4[0] : b4[0].name);
                  try {
                    return a11.delete(...b4), g2;
                  } finally {
                    f2();
                  }
                };
              case "set":
                return function(...b4) {
                  e2.add("string" == typeof b4[0] ? b4[0] : b4[0].name);
                  try {
                    return a11.set(...b4), g2;
                  } finally {
                    f2();
                  }
                };
              default:
                return O.get(a11, b3, c3);
            }
          } });
          return g2;
        }
      }
      function ag(a10, b2) {
        if ("action" !== a10.phase) throw new ac();
      }
      var ah = function(a10) {
        return a10.handleRequest = "BaseServer.handleRequest", a10.run = "BaseServer.run", a10.pipe = "BaseServer.pipe", a10.getStaticHTML = "BaseServer.getStaticHTML", a10.render = "BaseServer.render", a10.renderToResponseWithComponents = "BaseServer.renderToResponseWithComponents", a10.renderToResponse = "BaseServer.renderToResponse", a10.renderToHTML = "BaseServer.renderToHTML", a10.renderError = "BaseServer.renderError", a10.renderErrorToResponse = "BaseServer.renderErrorToResponse", a10.renderErrorToHTML = "BaseServer.renderErrorToHTML", a10.render404 = "BaseServer.render404", a10;
      }(ah || {}), ai = function(a10) {
        return a10.loadDefaultErrorComponents = "LoadComponents.loadDefaultErrorComponents", a10.loadComponents = "LoadComponents.loadComponents", a10;
      }(ai || {}), aj = function(a10) {
        return a10.getRequestHandler = "NextServer.getRequestHandler", a10.getServer = "NextServer.getServer", a10.getServerRequestHandler = "NextServer.getServerRequestHandler", a10.createServer = "createServer.createServer", a10;
      }(aj || {}), ak = function(a10) {
        return a10.compression = "NextNodeServer.compression", a10.getBuildId = "NextNodeServer.getBuildId", a10.createComponentTree = "NextNodeServer.createComponentTree", a10.clientComponentLoading = "NextNodeServer.clientComponentLoading", a10.getLayoutOrPageModule = "NextNodeServer.getLayoutOrPageModule", a10.generateStaticRoutes = "NextNodeServer.generateStaticRoutes", a10.generateFsStaticRoutes = "NextNodeServer.generateFsStaticRoutes", a10.generatePublicRoutes = "NextNodeServer.generatePublicRoutes", a10.generateImageRoutes = "NextNodeServer.generateImageRoutes.route", a10.sendRenderResult = "NextNodeServer.sendRenderResult", a10.proxyRequest = "NextNodeServer.proxyRequest", a10.runApi = "NextNodeServer.runApi", a10.render = "NextNodeServer.render", a10.renderHTML = "NextNodeServer.renderHTML", a10.imageOptimizer = "NextNodeServer.imageOptimizer", a10.getPagePath = "NextNodeServer.getPagePath", a10.getRoutesManifest = "NextNodeServer.getRoutesManifest", a10.findPageComponents = "NextNodeServer.findPageComponents", a10.getFontManifest = "NextNodeServer.getFontManifest", a10.getServerComponentManifest = "NextNodeServer.getServerComponentManifest", a10.getRequestHandler = "NextNodeServer.getRequestHandler", a10.renderToHTML = "NextNodeServer.renderToHTML", a10.renderError = "NextNodeServer.renderError", a10.renderErrorToHTML = "NextNodeServer.renderErrorToHTML", a10.render404 = "NextNodeServer.render404", a10.startResponse = "NextNodeServer.startResponse", a10.route = "route", a10.onProxyReq = "onProxyReq", a10.apiResolver = "apiResolver", a10.internalFetch = "internalFetch", a10;
      }(ak || {}), al = function(a10) {
        return a10.startServer = "startServer.startServer", a10;
      }(al || {}), am = function(a10) {
        return a10.getServerSideProps = "Render.getServerSideProps", a10.getStaticProps = "Render.getStaticProps", a10.renderToString = "Render.renderToString", a10.renderDocument = "Render.renderDocument", a10.createBodyResult = "Render.createBodyResult", a10;
      }(am || {}), an = function(a10) {
        return a10.renderToString = "AppRender.renderToString", a10.renderToReadableStream = "AppRender.renderToReadableStream", a10.getBodyResult = "AppRender.getBodyResult", a10.fetch = "AppRender.fetch", a10;
      }(an || {}), ao = function(a10) {
        return a10.executeRoute = "Router.executeRoute", a10;
      }(ao || {}), ap = function(a10) {
        return a10.runHandler = "Node.runHandler", a10;
      }(ap || {}), aq = function(a10) {
        return a10.runHandler = "AppRouteRouteHandlers.runHandler", a10;
      }(aq || {}), ar = function(a10) {
        return a10.generateMetadata = "ResolveMetadata.generateMetadata", a10.generateViewport = "ResolveMetadata.generateViewport", a10;
      }(ar || {}), as = function(a10) {
        return a10.execute = "Middleware.execute", a10;
      }(as || {});
      let at = /* @__PURE__ */ new Set(["Middleware.execute", "BaseServer.handleRequest", "Render.getServerSideProps", "Render.getStaticProps", "AppRender.fetch", "AppRender.getBodyResult", "Render.renderDocument", "Node.runHandler", "AppRouteRouteHandlers.runHandler", "ResolveMetadata.generateMetadata", "ResolveMetadata.generateViewport", "NextNodeServer.createComponentTree", "NextNodeServer.findPageComponents", "NextNodeServer.getLayoutOrPageModule", "NextNodeServer.startResponse", "NextNodeServer.clientComponentLoading"]), au = /* @__PURE__ */ new Set(["NextNodeServer.findPageComponents", "NextNodeServer.createComponentTree", "NextNodeServer.clientComponentLoading"]);
      function av(a10) {
        return null !== a10 && "object" == typeof a10 && "then" in a10 && "function" == typeof a10.then;
      }
      let aw = process.env.NEXT_OTEL_PERFORMANCE_PREFIX, { context: ax, propagation: ay, trace: az, SpanStatusCode: aA, SpanKind: aB, ROOT_CONTEXT: aC } = d = c(3817);
      class aD extends Error {
        constructor(a10, b2) {
          super(), this.bubble = a10, this.result = b2;
        }
      }
      let aE = (a10, b2) => {
        (function(a11) {
          return "object" == typeof a11 && null !== a11 && a11 instanceof aD;
        })(b2) && b2.bubble ? a10.setAttribute("next.bubble", true) : (b2 && (a10.recordException(b2), a10.setAttribute("error.type", b2.name)), a10.setStatus({ code: aA.ERROR, message: null == b2 ? void 0 : b2.message })), a10.end();
      }, aF = /* @__PURE__ */ new Map(), aG = d.createContextKey("next.rootSpanId"), aH = 0, aI = { set(a10, b2, c2) {
        a10.push({ key: b2, value: c2 });
      } };
      class aJ {
        getTracerInstance() {
          return az.getTracer("next.js", "0.0.1");
        }
        getContext() {
          return ax;
        }
        getTracePropagationData() {
          let a10 = ax.active(), b2 = [];
          return ay.inject(a10, b2, aI), b2;
        }
        getActiveScopeSpan() {
          return az.getSpan(null == ax ? void 0 : ax.active());
        }
        withPropagatedContext(a10, b2, c2) {
          let d2 = ax.active();
          if (az.getSpanContext(d2)) return b2();
          let e2 = ay.extract(d2, a10, c2);
          return ax.with(e2, b2);
        }
        trace(...a10) {
          var b2;
          let [c2, d2, e2] = a10, { fn: f2, options: g2 } = "function" == typeof d2 ? { fn: d2, options: {} } : { fn: e2, options: { ...d2 } }, h2 = g2.spanName ?? c2;
          if (!at.has(c2) && "1" !== process.env.NEXT_OTEL_VERBOSE || g2.hideSpan) return f2();
          let i2 = this.getSpanContext((null == g2 ? void 0 : g2.parentSpan) ?? this.getActiveScopeSpan()), j2 = false;
          i2 ? (null == (b2 = az.getSpanContext(i2)) ? void 0 : b2.isRemote) && (j2 = true) : (i2 = (null == ax ? void 0 : ax.active()) ?? aC, j2 = true);
          let k2 = aH++;
          return g2.attributes = { "next.span_name": h2, "next.span_type": c2, ...g2.attributes }, ax.with(i2.setValue(aG, k2), () => this.getTracerInstance().startActiveSpan(h2, g2, (a11) => {
            let b3;
            aw && c2 && au.has(c2) && (b3 = "performance" in globalThis && "measure" in performance ? globalThis.performance.now() : void 0);
            let d3 = false, e3 = () => {
              !d3 && (d3 = true, aF.delete(k2), b3 && performance.measure(`${aw}:next-${(c2.split(".").pop() || "").replace(/[A-Z]/g, (a12) => "-" + a12.toLowerCase())}`, { start: b3, end: performance.now() }));
            };
            if (j2 && aF.set(k2, new Map(Object.entries(g2.attributes ?? {}))), f2.length > 1) try {
              return f2(a11, (b4) => aE(a11, b4));
            } catch (b4) {
              throw aE(a11, b4), b4;
            } finally {
              e3();
            }
            try {
              let b4 = f2(a11);
              if (av(b4)) return b4.then((b5) => (a11.end(), b5)).catch((b5) => {
                throw aE(a11, b5), b5;
              }).finally(e3);
              return a11.end(), e3(), b4;
            } catch (b4) {
              throw aE(a11, b4), e3(), b4;
            }
          }));
        }
        wrap(...a10) {
          let b2 = this, [c2, d2, e2] = 3 === a10.length ? a10 : [a10[0], {}, a10[1]];
          return at.has(c2) || "1" === process.env.NEXT_OTEL_VERBOSE ? function() {
            let a11 = d2;
            "function" == typeof a11 && "function" == typeof e2 && (a11 = a11.apply(this, arguments));
            let f2 = arguments.length - 1, g2 = arguments[f2];
            if ("function" != typeof g2) return b2.trace(c2, a11, () => e2.apply(this, arguments));
            {
              let d3 = b2.getContext().bind(ax.active(), g2);
              return b2.trace(c2, a11, (a12, b3) => (arguments[f2] = function(a13) {
                return null == b3 || b3(a13), d3.apply(this, arguments);
              }, e2.apply(this, arguments)));
            }
          } : e2;
        }
        startSpan(...a10) {
          let [b2, c2] = a10, d2 = this.getSpanContext((null == c2 ? void 0 : c2.parentSpan) ?? this.getActiveScopeSpan());
          return this.getTracerInstance().startSpan(b2, c2, d2);
        }
        getSpanContext(a10) {
          return a10 ? az.setSpan(ax.active(), a10) : void 0;
        }
        getRootSpanAttributes() {
          let a10 = ax.active().getValue(aG);
          return aF.get(a10);
        }
        setRootSpanAttribute(a10, b2) {
          let c2 = ax.active().getValue(aG), d2 = aF.get(c2);
          d2 && d2.set(a10, b2);
        }
      }
      let aK = (() => {
        let a10 = new aJ();
        return () => a10;
      })(), aL = "__prerender_bypass";
      Symbol("__next_preview_data"), Symbol(aL);
      class aM {
        constructor(a10, b2, c2, d2) {
          var e2;
          let f2 = a10 && function(a11, b3) {
            let c3 = Y.from(a11.headers);
            return { isOnDemandRevalidate: c3.get("x-prerender-revalidate") === b3.previewModeId, revalidateOnlyGenerated: c3.has("x-prerender-revalidate-if-generated") };
          }(b2, a10).isOnDemandRevalidate, g2 = null == (e2 = c2.get(aL)) ? void 0 : e2.value;
          this._isEnabled = !!(!f2 && g2 && a10 && g2 === a10.previewModeId), this._previewModeId = null == a10 ? void 0 : a10.previewModeId, this._mutableCookies = d2;
        }
        get isEnabled() {
          return this._isEnabled;
        }
        enable() {
          if (!this._previewModeId) throw Object.defineProperty(Error("Invariant: previewProps missing previewModeId this should never happen"), "__NEXT_ERROR_CODE", { value: "E93", enumerable: false, configurable: true });
          this._mutableCookies.set({ name: aL, value: this._previewModeId, httpOnly: true, sameSite: "none", secure: true, path: "/" }), this._isEnabled = true;
        }
        disable() {
          this._mutableCookies.set({ name: aL, value: "", httpOnly: true, sameSite: "none", secure: true, path: "/", expires: /* @__PURE__ */ new Date(0) }), this._isEnabled = false;
        }
      }
      function aN(a10, b2) {
        if ("x-middleware-set-cookie" in a10.headers && "string" == typeof a10.headers["x-middleware-set-cookie"]) {
          let c2 = a10.headers["x-middleware-set-cookie"], d2 = new Headers();
          for (let a11 of s(c2)) d2.append("set-cookie", a11);
          for (let a11 of new L.ResponseCookies(d2).getAll()) b2.set(a11);
        }
      }
      let aO = aa();
      var aP = c(1213), aQ = c.n(aP);
      class aR extends Error {
        constructor(a10, b2) {
          super("Invariant: " + (a10.endsWith(".") ? a10 : a10 + ".") + " This is a bug in Next.js.", b2), this.name = "InvariantError";
        }
      }
      class aS {
        constructor(a10, b2, c2) {
          this.prev = null, this.next = null, this.key = a10, this.data = b2, this.size = c2;
        }
      }
      class aT {
        constructor() {
          this.prev = null, this.next = null;
        }
      }
      class aU {
        constructor(a10, b2, c2) {
          this.cache = /* @__PURE__ */ new Map(), this.totalSize = 0, this.maxSize = a10, this.calculateSize = b2, this.onEvict = c2, this.head = new aT(), this.tail = new aT(), this.head.next = this.tail, this.tail.prev = this.head;
        }
        addToHead(a10) {
          a10.prev = this.head, a10.next = this.head.next, this.head.next.prev = a10, this.head.next = a10;
        }
        removeNode(a10) {
          a10.prev.next = a10.next, a10.next.prev = a10.prev;
        }
        moveToHead(a10) {
          this.removeNode(a10), this.addToHead(a10);
        }
        removeTail() {
          let a10 = this.tail.prev;
          return this.removeNode(a10), a10;
        }
        set(a10, b2) {
          let c2 = (null == this.calculateSize ? void 0 : this.calculateSize.call(this, b2)) ?? 1;
          if (c2 <= 0) throw Object.defineProperty(Error(`LRUCache: calculateSize returned ${c2}, but size must be > 0. Items with size 0 would never be evicted, causing unbounded cache growth.`), "__NEXT_ERROR_CODE", { value: "E789", enumerable: false, configurable: true });
          if (c2 > this.maxSize) return console.warn("Single item size exceeds maxSize"), false;
          let d2 = this.cache.get(a10);
          if (d2) d2.data = b2, this.totalSize = this.totalSize - d2.size + c2, d2.size = c2, this.moveToHead(d2);
          else {
            let d3 = new aS(a10, b2, c2);
            this.cache.set(a10, d3), this.addToHead(d3), this.totalSize += c2;
          }
          for (; this.totalSize > this.maxSize && this.cache.size > 0; ) {
            let a11 = this.removeTail();
            this.cache.delete(a11.key), this.totalSize -= a11.size, null == this.onEvict || this.onEvict.call(this, a11.key, a11.data);
          }
          return true;
        }
        has(a10) {
          return this.cache.has(a10);
        }
        get(a10) {
          let b2 = this.cache.get(a10);
          if (b2) return this.moveToHead(b2), b2.data;
        }
        *[Symbol.iterator]() {
          let a10 = this.head.next;
          for (; a10 && a10 !== this.tail; ) {
            let b2 = a10;
            yield [b2.key, b2.data], a10 = a10.next;
          }
        }
        remove(a10) {
          let b2 = this.cache.get(a10);
          b2 && (this.removeNode(b2), this.cache.delete(a10), this.totalSize -= b2.size);
        }
        get size() {
          return this.cache.size;
        }
        get currentSize() {
          return this.totalSize;
        }
      }
      c(5356).Buffer, new aU(52428800, (a10) => a10.size), process.env.NEXT_PRIVATE_DEBUG_CACHE && console.debug.bind(console, "DefaultCacheHandler:"), process.env.NEXT_PRIVATE_DEBUG_CACHE && ((a10, ...b2) => {
        console.log(`use-cache: ${a10}`, ...b2);
      }), Symbol.for("@next/cache-handlers");
      let aV = Symbol.for("@next/cache-handlers-map"), aW = Symbol.for("@next/cache-handlers-set"), aX = globalThis;
      function aY() {
        if (aX[aV]) return aX[aV].entries();
      }
      async function aZ(a10, b2) {
        if (!a10) return b2();
        let c2 = a$(a10);
        try {
          return await b2();
        } finally {
          let b3 = function(a11, b4) {
            let c3 = new Set(a11.pendingRevalidatedTags), d2 = new Set(a11.pendingRevalidateWrites);
            return { pendingRevalidatedTags: b4.pendingRevalidatedTags.filter((a12) => !c3.has(a12)), pendingRevalidates: Object.fromEntries(Object.entries(b4.pendingRevalidates).filter(([b5]) => !(b5 in a11.pendingRevalidates))), pendingRevalidateWrites: b4.pendingRevalidateWrites.filter((a12) => !d2.has(a12)) };
          }(c2, a$(a10));
          await a0(a10, b3);
        }
      }
      function a$(a10) {
        return { pendingRevalidatedTags: a10.pendingRevalidatedTags ? [...a10.pendingRevalidatedTags] : [], pendingRevalidates: { ...a10.pendingRevalidates }, pendingRevalidateWrites: a10.pendingRevalidateWrites ? [...a10.pendingRevalidateWrites] : [] };
      }
      async function a_(a10, b2) {
        if (0 === a10.length) return;
        let c2 = [];
        b2 && c2.push(b2.revalidateTag(a10));
        let d2 = function() {
          if (aX[aW]) return aX[aW].values();
        }();
        if (d2) for (let b3 of d2) c2.push(b3.expireTags(...a10));
        await Promise.all(c2);
      }
      async function a0(a10, b2) {
        let c2 = (null == b2 ? void 0 : b2.pendingRevalidatedTags) ?? a10.pendingRevalidatedTags ?? [], d2 = (null == b2 ? void 0 : b2.pendingRevalidates) ?? a10.pendingRevalidates ?? {}, e2 = (null == b2 ? void 0 : b2.pendingRevalidateWrites) ?? a10.pendingRevalidateWrites ?? [];
        return Promise.all([a_(c2, a10.incrementalCache), ...Object.values(d2), ...e2]);
      }
      let a1 = Object.defineProperty(Error("Invariant: AsyncLocalStorage accessed in runtime where it is not available"), "__NEXT_ERROR_CODE", { value: "E504", enumerable: false, configurable: true });
      class a2 {
        disable() {
          throw a1;
        }
        getStore() {
        }
        run() {
          throw a1;
        }
        exit() {
          throw a1;
        }
        enterWith() {
          throw a1;
        }
        static bind(a10) {
          return a10;
        }
      }
      let a3 = "undefined" != typeof globalThis && globalThis.AsyncLocalStorage, a4 = a3 ? new a3() : new a2();
      class a5 {
        constructor({ waitUntil: a10, onClose: b2, onTaskError: c2 }) {
          this.workUnitStores = /* @__PURE__ */ new Set(), this.waitUntil = a10, this.onClose = b2, this.onTaskError = c2, this.callbackQueue = new (aQ())(), this.callbackQueue.pause();
        }
        after(a10) {
          if (av(a10)) this.waitUntil || a6(), this.waitUntil(a10.catch((a11) => this.reportTaskError("promise", a11)));
          else if ("function" == typeof a10) this.addCallback(a10);
          else throw Object.defineProperty(Error("`after()`: Argument must be a promise or a function"), "__NEXT_ERROR_CODE", { value: "E50", enumerable: false, configurable: true });
        }
        addCallback(a10) {
          var b2;
          this.waitUntil || a6();
          let c2 = aO.getStore();
          c2 && this.workUnitStores.add(c2);
          let d2 = a4.getStore(), e2 = d2 ? d2.rootTaskSpawnPhase : null == c2 ? void 0 : c2.phase;
          this.runCallbacksOnClosePromise || (this.runCallbacksOnClosePromise = this.runCallbacksOnClose(), this.waitUntil(this.runCallbacksOnClosePromise));
          let f2 = (b2 = async () => {
            try {
              await a4.run({ rootTaskSpawnPhase: e2 }, () => a10());
            } catch (a11) {
              this.reportTaskError("function", a11);
            }
          }, a3 ? a3.bind(b2) : a2.bind(b2));
          this.callbackQueue.add(f2);
        }
        async runCallbacksOnClose() {
          return await new Promise((a10) => this.onClose(a10)), this.runCallbacks();
        }
        async runCallbacks() {
          if (0 === this.callbackQueue.size) return;
          for (let a11 of this.workUnitStores) a11.phase = "after";
          let a10 = ab.getStore();
          if (!a10) throw Object.defineProperty(new aR("Missing workStore in AfterContext.runCallbacks"), "__NEXT_ERROR_CODE", { value: "E547", enumerable: false, configurable: true });
          return aZ(a10, () => (this.callbackQueue.start(), this.callbackQueue.onIdle()));
        }
        reportTaskError(a10, b2) {
          if (console.error("promise" === a10 ? "A promise passed to `after()` rejected:" : "An error occurred in a function passed to `after()`:", b2), this.onTaskError) try {
            null == this.onTaskError || this.onTaskError.call(this, b2);
          } catch (a11) {
            console.error(Object.defineProperty(new aR("`onTaskError` threw while handling an error thrown from an `after` task", { cause: a11 }), "__NEXT_ERROR_CODE", { value: "E569", enumerable: false, configurable: true }));
          }
        }
      }
      function a6() {
        throw Object.defineProperty(Error("`after()` will not work correctly, because `waitUntil` is not available in the current environment."), "__NEXT_ERROR_CODE", { value: "E91", enumerable: false, configurable: true });
      }
      function a7(a10) {
        let b2, c2 = { then: (d2, e2) => (b2 || (b2 = a10()), b2.then((a11) => {
          c2.value = a11;
        }).catch(() => {
        }), b2.then(d2, e2)) };
        return c2;
      }
      class a8 {
        onClose(a10) {
          if (this.isClosed) throw Object.defineProperty(Error("Cannot subscribe to a closed CloseController"), "__NEXT_ERROR_CODE", { value: "E365", enumerable: false, configurable: true });
          this.target.addEventListener("close", a10), this.listeners++;
        }
        dispatchClose() {
          if (this.isClosed) throw Object.defineProperty(Error("Cannot close a CloseController multiple times"), "__NEXT_ERROR_CODE", { value: "E229", enumerable: false, configurable: true });
          this.listeners > 0 && this.target.dispatchEvent(new Event("close")), this.isClosed = true;
        }
        constructor() {
          this.target = new EventTarget(), this.listeners = 0, this.isClosed = false;
        }
      }
      function a9() {
        return { previewModeId: process.env.__NEXT_PREVIEW_MODE_ID || "", previewModeSigningKey: process.env.__NEXT_PREVIEW_MODE_SIGNING_KEY || "", previewModeEncryptionKey: process.env.__NEXT_PREVIEW_MODE_ENCRYPTION_KEY || "" };
      }
      let ba = Symbol.for("@next/request-context");
      async function bb(a10, b2, c2) {
        let d2 = [], e2 = c2 && c2.size > 0;
        for (let b3 of ((a11) => {
          let b4 = ["/layout"];
          if (a11.startsWith("/")) {
            let c3 = a11.split("/");
            for (let a12 = 1; a12 < c3.length + 1; a12++) {
              let d3 = c3.slice(0, a12).join("/");
              d3 && (d3.endsWith("/page") || d3.endsWith("/route") || (d3 = `${d3}${!d3.endsWith("/") ? "/" : ""}layout`), b4.push(d3));
            }
          }
          return b4;
        })(a10)) b3 = `${q}${b3}`, d2.push(b3);
        if (b2.pathname && !e2) {
          let a11 = `${q}${b2.pathname}`;
          d2.push(a11);
        }
        return { tags: d2, expirationsByCacheKind: function(a11) {
          let b3 = /* @__PURE__ */ new Map(), c3 = aY();
          if (c3) for (let [d3, e3] of c3) "getExpiration" in e3 && b3.set(d3, a7(async () => e3.getExpiration(...a11)));
          return b3;
        }(d2) };
      }
      class bc extends N {
        constructor(a10) {
          super(a10.input, a10.init), this.sourcePage = a10.page;
        }
        get request() {
          throw Object.defineProperty(new n({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
        respondWith() {
          throw Object.defineProperty(new n({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
        waitUntil() {
          throw Object.defineProperty(new n({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
      }
      let bd = { keys: (a10) => Array.from(a10.keys()), get: (a10, b2) => a10.get(b2) ?? void 0 }, be = (a10, b2) => aK().withPropagatedContext(a10.headers, b2, bd), bf = false;
      async function bg(a10) {
        var b2;
        let d2, e2;
        if (!bf && (bf = true, "true" === process.env.NEXT_PRIVATE_TEST_PROXY)) {
          let { interceptTestApis: a11, wrapRequestHandler: b3 } = c(7720);
          a11(), be = b3(be);
        }
        await l();
        let f2 = void 0 !== globalThis.__BUILD_MANIFEST;
        a10.request.url = a10.request.url.replace(/\.rsc($|\?)/, "$1");
        let g2 = a10.bypassNextUrl ? new URL(a10.request.url) : new K(a10.request.url, { headers: a10.request.headers, nextConfig: a10.request.nextConfig });
        for (let a11 of [...g2.searchParams.keys()]) {
          let b3 = g2.searchParams.getAll(a11), c2 = function(a12) {
            for (let b4 of ["nxtP", "nxtI"]) if (a12 !== b4 && a12.startsWith(b4)) return a12.substring(b4.length);
            return null;
          }(a11);
          if (c2) {
            for (let a12 of (g2.searchParams.delete(c2), b3)) g2.searchParams.append(c2, a12);
            g2.searchParams.delete(a11);
          }
        }
        let h2 = process.env.__NEXT_BUILD_ID || "";
        "buildId" in g2 && (h2 = g2.buildId || "", g2.buildId = "");
        let i2 = function(a11) {
          let b3 = new Headers();
          for (let [c2, d3] of Object.entries(a11)) for (let a12 of Array.isArray(d3) ? d3 : [d3]) void 0 !== a12 && ("number" == typeof a12 && (a12 = a12.toString()), b3.append(c2, a12));
          return b3;
        }(a10.request.headers), j2 = i2.has("x-nextjs-data"), k2 = "1" === i2.get("rsc");
        j2 && "/index" === g2.pathname && (g2.pathname = "/");
        let m2 = /* @__PURE__ */ new Map();
        if (!f2) for (let a11 of V) {
          let b3 = i2.get(a11);
          null !== b3 && (m2.set(a11, b3), i2.delete(a11));
        }
        let n2 = g2.searchParams.get(W), o2 = new bc({ page: a10.page, input: function(a11) {
          let b3 = "string" == typeof a11, c2 = b3 ? new URL(a11) : a11;
          return c2.searchParams.delete(W), b3 ? c2.toString() : c2;
        }(g2).toString(), init: { body: a10.request.body, headers: i2, method: a10.request.method, nextConfig: a10.request.nextConfig, signal: a10.request.signal } });
        j2 && Object.defineProperty(o2, "__isData", { enumerable: false, value: true }), !globalThis.__incrementalCacheShared && a10.IncrementalCache && (globalThis.__incrementalCache = new a10.IncrementalCache({ CurCacheHandler: a10.incrementalCacheHandler, minimalMode: true, fetchCacheKeyPrefix: "", dev: false, requestHeaders: a10.request.headers, getPrerenderManifest: () => ({ version: -1, routes: {}, dynamicRoutes: {}, notFoundRoutes: [], preview: a9() }) }));
        let p2 = a10.request.waitUntil ?? (null == (b2 = function() {
          let a11 = globalThis[ba];
          return null == a11 ? void 0 : a11.get();
        }()) ? void 0 : b2.waitUntil), q2 = new z({ request: o2, page: a10.page, context: p2 ? { waitUntil: p2 } : void 0 });
        if ((d2 = await be(o2, () => {
          if ("/middleware" === a10.page || "/src/middleware" === a10.page) {
            let b3 = q2.waitUntil.bind(q2), c2 = new a8();
            return aK().trace(as.execute, { spanName: `middleware ${o2.method} ${o2.nextUrl.pathname}`, attributes: { "http.target": o2.nextUrl.pathname, "http.method": o2.method } }, async () => {
              try {
                var d3, f3, g3, i3, j3, k3;
                let l2 = a9(), m3 = await bb("/", o2.nextUrl, null), n3 = (j3 = o2.nextUrl, k3 = (a11) => {
                  e2 = a11;
                }, function(a11, b4, c3, d4, e3, f4, g4, h3, i4, j4, k4, l3) {
                  function m4(a12) {
                    c3 && c3.setHeader("Set-Cookie", a12);
                  }
                  let n4 = {};
                  return { type: "request", phase: a11, implicitTags: f4, url: { pathname: d4.pathname, search: d4.search ?? "" }, rootParams: e3, get headers() {
                    return n4.headers || (n4.headers = function(a12) {
                      let b5 = Y.from(a12);
                      for (let a13 of V) b5.delete(a13);
                      return Y.seal(b5);
                    }(b4.headers)), n4.headers;
                  }, get cookies() {
                    if (!n4.cookies) {
                      let a12 = new L.RequestCookies(Y.from(b4.headers));
                      aN(b4, a12), n4.cookies = ad.seal(a12);
                    }
                    return n4.cookies;
                  }, set cookies(value) {
                    n4.cookies = value;
                  }, get mutableCookies() {
                    if (!n4.mutableCookies) {
                      let a12 = function(a13, b5) {
                        let c4 = new L.RequestCookies(Y.from(a13));
                        return af.wrap(c4, b5);
                      }(b4.headers, g4 || (c3 ? m4 : void 0));
                      aN(b4, a12), n4.mutableCookies = a12;
                    }
                    return n4.mutableCookies;
                  }, get userspaceMutableCookies() {
                    return n4.userspaceMutableCookies || (n4.userspaceMutableCookies = function(a12) {
                      let b5 = new Proxy(a12.mutableCookies, { get(c4, d5, e4) {
                        switch (d5) {
                          case "delete":
                            return function(...d6) {
                              return ag(a12, "cookies().delete"), c4.delete(...d6), b5;
                            };
                          case "set":
                            return function(...d6) {
                              return ag(a12, "cookies().set"), c4.set(...d6), b5;
                            };
                          default:
                            return O.get(c4, d5, e4);
                        }
                      } });
                      return b5;
                    }(this)), n4.userspaceMutableCookies;
                  }, get draftMode() {
                    return n4.draftMode || (n4.draftMode = new aM(i4, b4, this.cookies, this.mutableCookies)), n4.draftMode;
                  }, renderResumeDataCache: h3 ?? null, isHmrRefresh: j4, serverComponentsHmrCache: k4 || globalThis.__serverComponentsHmrCache, devFallbackParams: null };
                }("action", o2, void 0, j3, {}, m3, k3, void 0, l2, false, void 0, null)), p3 = function({ page: a11, renderOpts: b4, isPrefetchRequest: c3, buildId: d4, previouslyRevalidatedTags: e3 }) {
                  var f4;
                  let g4 = !b4.shouldWaitOnAllReady && !b4.supportsDynamicResponse && !b4.isDraftMode && !b4.isPossibleServerAction, h3 = b4.dev ?? false, i4 = h3 || g4 && (!!process.env.NEXT_DEBUG_BUILD || "1" === process.env.NEXT_SSG_FETCH_METRICS), j4 = { isStaticGeneration: g4, page: a11, route: (f4 = a11.split("/").reduce((a12, b5, c4, d5) => b5 ? "(" === b5[0] && b5.endsWith(")") || "@" === b5[0] || ("page" === b5 || "route" === b5) && c4 === d5.length - 1 ? a12 : a12 + "/" + b5 : a12, "")).startsWith("/") ? f4 : "/" + f4, incrementalCache: b4.incrementalCache || globalThis.__incrementalCache, cacheLifeProfiles: b4.cacheLifeProfiles, isRevalidate: b4.isRevalidate, isBuildTimePrerendering: b4.nextExport, hasReadableErrorStacks: b4.hasReadableErrorStacks, fetchCache: b4.fetchCache, isOnDemandRevalidate: b4.isOnDemandRevalidate, isDraftMode: b4.isDraftMode, isPrefetchRequest: c3, buildId: d4, reactLoadableManifest: (null == b4 ? void 0 : b4.reactLoadableManifest) || {}, assetPrefix: (null == b4 ? void 0 : b4.assetPrefix) || "", afterContext: function(a12) {
                    let { waitUntil: b5, onClose: c4, onAfterTaskError: d5 } = a12;
                    return new a5({ waitUntil: b5, onClose: c4, onTaskError: d5 });
                  }(b4), cacheComponentsEnabled: b4.experimental.cacheComponents, dev: h3, previouslyRevalidatedTags: e3, refreshTagsByCacheKind: function() {
                    let a12 = /* @__PURE__ */ new Map(), b5 = aY();
                    if (b5) for (let [c4, d5] of b5) "refreshTags" in d5 && a12.set(c4, a7(async () => d5.refreshTags()));
                    return a12;
                  }(), runInCleanSnapshot: a3 ? a3.snapshot() : function(a12, ...b5) {
                    return a12(...b5);
                  }, shouldTrackFetchMetrics: i4 };
                  return b4.store = j4, j4;
                }({ page: "/", renderOpts: { cacheLifeProfiles: null == (f3 = a10.request.nextConfig) || null == (d3 = f3.experimental) ? void 0 : d3.cacheLife, experimental: { isRoutePPREnabled: false, cacheComponents: false, authInterrupts: !!(null == (i3 = a10.request.nextConfig) || null == (g3 = i3.experimental) ? void 0 : g3.authInterrupts) }, supportsDynamicResponse: true, waitUntil: b3, onClose: c2.onClose.bind(c2), onAfterTaskError: void 0 }, isPrefetchRequest: "1" === o2.headers.get(U), buildId: h2 ?? "", previouslyRevalidatedTags: [] });
                return await ab.run(p3, () => aO.run(n3, a10.handler, o2, q2));
              } finally {
                setTimeout(() => {
                  c2.dispatchClose();
                }, 0);
              }
            });
          }
          return a10.handler(o2, q2);
        })) && !(d2 instanceof Response)) throw Object.defineProperty(TypeError("Expected an instance of Response to be returned"), "__NEXT_ERROR_CODE", { value: "E567", enumerable: false, configurable: true });
        d2 && e2 && d2.headers.set("set-cookie", e2);
        let r2 = null == d2 ? void 0 : d2.headers.get("x-middleware-rewrite");
        if (d2 && r2 && (k2 || !f2)) {
          let b3 = new K(r2, { forceLocale: true, headers: a10.request.headers, nextConfig: a10.request.nextConfig });
          f2 || b3.host !== o2.nextUrl.host || (b3.buildId = h2 || b3.buildId, d2.headers.set("x-middleware-rewrite", String(b3)));
          let { url: c2, isRelative: e3 } = T(b3.toString(), g2.toString());
          !f2 && j2 && d2.headers.set("x-nextjs-rewrite", c2), k2 && e3 && (g2.pathname !== b3.pathname && d2.headers.set("x-nextjs-rewritten-path", b3.pathname), g2.search !== b3.search && d2.headers.set("x-nextjs-rewritten-query", b3.search.slice(1)));
        }
        if (d2 && r2 && k2 && n2) {
          let a11 = new URL(r2);
          a11.searchParams.has(W) || (a11.searchParams.set(W, n2), d2.headers.set("x-middleware-rewrite", a11.toString()));
        }
        let s2 = null == d2 ? void 0 : d2.headers.get("Location");
        if (d2 && s2 && !f2) {
          let b3 = new K(s2, { forceLocale: false, headers: a10.request.headers, nextConfig: a10.request.nextConfig });
          d2 = new Response(d2.body, d2), b3.host === g2.host && (b3.buildId = h2 || b3.buildId, d2.headers.set("Location", b3.toString())), j2 && (d2.headers.delete("Location"), d2.headers.set("x-nextjs-redirect", T(b3.toString(), g2.toString()).url));
        }
        let t2 = d2 || S.next(), u2 = t2.headers.get("x-middleware-override-headers"), v2 = [];
        if (u2) {
          for (let [a11, b3] of m2) t2.headers.set(`x-middleware-request-${a11}`, b3), v2.push(a11);
          v2.length > 0 && t2.headers.set("x-middleware-override-headers", u2 + "," + v2.join(","));
        }
        return { response: t2, waitUntil: ("internal" === q2[x].kind ? Promise.all(q2[x].promises).then(() => {
        }) : void 0) ?? Promise.resolve(), fetchMetrics: o2.fetchMetrics };
      }
      var bh = c(1426);
      c(4449), "undefined" == typeof URLPattern || URLPattern;
      var bi = c(7814);
      if (/* @__PURE__ */ new WeakMap(), bi.unstable_postpone, false === function(a10) {
        return a10.includes("needs to bail out of prerendering at this point because it used") && a10.includes("Learn more: https://nextjs.org/docs/messages/ppr-caught-error");
      }("Route %%% needs to bail out of prerendering at this point because it used ^^^. React throws this special object to indicate where. It should not be caught by your own try/catch. Learn more: https://nextjs.org/docs/messages/ppr-caught-error")) throw Object.defineProperty(Error("Invariant: isDynamicPostpone misidentified a postpone reason. This is a bug in Next.js"), "__NEXT_ERROR_CODE", { value: "E296", enumerable: false, configurable: true });
      RegExp(`\\n\\s+at Suspense \\(<anonymous>\\)(?:(?!\\n\\s+at (?:body|div|main|section|article|aside|header|footer|nav|form|p|span|h1|h2|h3|h4|h5|h6) \\(<anonymous>\\))[\\s\\S])*?\\n\\s+at __next_root_layout_boundary__ \\([^\\n]*\\)`), RegExp(`\\n\\s+at __next_metadata_boundary__[\\n\\s]`), RegExp(`\\n\\s+at __next_viewport_boundary__[\\n\\s]`), RegExp(`\\n\\s+at __next_outlet_boundary__[\\n\\s]`), aa();
      let { env: bj, stdout: bk } = (null == (e = globalThis) ? void 0 : e.process) ?? {}, bl = bj && !bj.NO_COLOR && (bj.FORCE_COLOR || (null == bk ? void 0 : bk.isTTY) && !bj.CI && "dumb" !== bj.TERM), bm = (a10, b2, c2, d2) => {
        let e2 = a10.substring(0, d2) + c2, f2 = a10.substring(d2 + b2.length), g2 = f2.indexOf(b2);
        return ~g2 ? e2 + bm(f2, b2, c2, g2) : e2 + f2;
      }, bn = (a10, b2, c2 = a10) => bl ? (d2) => {
        let e2 = "" + d2, f2 = e2.indexOf(b2, a10.length);
        return ~f2 ? a10 + bm(e2, b2, c2, f2) + b2 : a10 + e2 + b2;
      } : String, bo = bn("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m");
      bn("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"), bn("\x1B[3m", "\x1B[23m"), bn("\x1B[4m", "\x1B[24m"), bn("\x1B[7m", "\x1B[27m"), bn("\x1B[8m", "\x1B[28m"), bn("\x1B[9m", "\x1B[29m"), bn("\x1B[30m", "\x1B[39m");
      let bp = bn("\x1B[31m", "\x1B[39m"), bq = bn("\x1B[32m", "\x1B[39m"), br = bn("\x1B[33m", "\x1B[39m");
      bn("\x1B[34m", "\x1B[39m");
      let bs = bn("\x1B[35m", "\x1B[39m");
      bn("\x1B[38;2;173;127;168m", "\x1B[39m"), bn("\x1B[36m", "\x1B[39m");
      let bt = bn("\x1B[37m", "\x1B[39m");
      bn("\x1B[90m", "\x1B[39m"), bn("\x1B[40m", "\x1B[49m"), bn("\x1B[41m", "\x1B[49m"), bn("\x1B[42m", "\x1B[49m"), bn("\x1B[43m", "\x1B[49m"), bn("\x1B[44m", "\x1B[49m"), bn("\x1B[45m", "\x1B[49m"), bn("\x1B[46m", "\x1B[49m"), bn("\x1B[47m", "\x1B[49m"), bt(bo("\u25CB")), bp(bo("\u2A2F")), br(bo("\u26A0")), bt(bo(" ")), bq(bo("\u2713")), bs(bo("\xBB")), new aU(1e4, (a10) => a10.length), /* @__PURE__ */ new WeakMap();
      let bu = process.env.AUTH_SECRET;
      async function bv(a10) {
        let b2 = a10.nextUrl.pathname, c2 = await (0, bh.getToken)({ req: a10, secret: bu }), d2 = "/" === b2 || ["/login", "/signup", "/api/auth", "/api/health", "/api/webhook", "/api/whatsapp", "/api/instagram", "/api/messages", "/api/agent", "/api/cron"].some((a11) => b2.startsWith(a11));
        if (!c2 && !d2) {
          let c3 = a10.nextUrl.clone();
          return c3.pathname = "/login", c3.searchParams.set("redirectTo", b2), S.redirect(c3);
        }
        if (c2 && "/login" === b2) {
          let b3 = a10.nextUrl.clone();
          return b3.pathname = "/dashboard", S.redirect(b3);
        }
        return S.next({ request: a10 });
      }
      let bw = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
      Object.values({ NOT_FOUND: 404, FORBIDDEN: 403, UNAUTHORIZED: 401 });
      let bx = { ...f }, by = bx.middleware || bx.default, bz = "/src/middleware";
      if ("function" != typeof by) throw Object.defineProperty(Error(`The Middleware "${bz}" must export a \`middleware\` or a \`default\` function`), "__NEXT_ERROR_CODE", { value: "E120", enumerable: false, configurable: true });
      function bA(a10) {
        return bg({ ...a10, page: bz, handler: async (...a11) => {
          try {
            return await by(...a11);
          } catch (e2) {
            let b2 = a11[0], c2 = new URL(b2.url), d2 = c2.pathname + c2.search;
            throw await j(e2, { path: d2, method: b2.method, headers: Object.fromEntries(b2.headers.entries()) }, { routerKind: "Pages Router", routePath: "/middleware", routeType: "middleware", revalidateReason: void 0 }), e2;
          }
        } });
      }
    }, 7720: (a, b, c) => {
      "use strict";
      Object.defineProperty(b, "__esModule", { value: true }), !function(a2, b2) {
        for (var c2 in b2) Object.defineProperty(a2, c2, { enumerable: true, get: b2[c2] });
      }(b, { interceptTestApis: function() {
        return f;
      }, wrapRequestHandler: function() {
        return g;
      } });
      let d = c(5392), e = c(9165);
      function f() {
        return (0, e.interceptFetch)(c.g.fetch);
      }
      function g(a2) {
        return (b2, c2) => (0, d.withRequest)(b2, e.reader, () => a2(b2, c2));
      }
    }, 7814: (a, b, c) => {
      "use strict";
      a.exports = c(6440);
    }, 8443: (a) => {
      "use strict";
      var b = Object.defineProperty, c = Object.getOwnPropertyDescriptor, d = Object.getOwnPropertyNames, e = Object.prototype.hasOwnProperty, f = {};
      function g(a2) {
        var b2;
        let c2 = ["path" in a2 && a2.path && `Path=${a2.path}`, "expires" in a2 && (a2.expires || 0 === a2.expires) && `Expires=${("number" == typeof a2.expires ? new Date(a2.expires) : a2.expires).toUTCString()}`, "maxAge" in a2 && "number" == typeof a2.maxAge && `Max-Age=${a2.maxAge}`, "domain" in a2 && a2.domain && `Domain=${a2.domain}`, "secure" in a2 && a2.secure && "Secure", "httpOnly" in a2 && a2.httpOnly && "HttpOnly", "sameSite" in a2 && a2.sameSite && `SameSite=${a2.sameSite}`, "partitioned" in a2 && a2.partitioned && "Partitioned", "priority" in a2 && a2.priority && `Priority=${a2.priority}`].filter(Boolean), d2 = `${a2.name}=${encodeURIComponent(null != (b2 = a2.value) ? b2 : "")}`;
        return 0 === c2.length ? d2 : `${d2}; ${c2.join("; ")}`;
      }
      function h(a2) {
        let b2 = /* @__PURE__ */ new Map();
        for (let c2 of a2.split(/; */)) {
          if (!c2) continue;
          let a3 = c2.indexOf("=");
          if (-1 === a3) {
            b2.set(c2, "true");
            continue;
          }
          let [d2, e2] = [c2.slice(0, a3), c2.slice(a3 + 1)];
          try {
            b2.set(d2, decodeURIComponent(null != e2 ? e2 : "true"));
          } catch {
          }
        }
        return b2;
      }
      function i(a2) {
        if (!a2) return;
        let [[b2, c2], ...d2] = h(a2), { domain: e2, expires: f2, httponly: g2, maxage: i2, path: l2, samesite: m2, secure: n, partitioned: o, priority: p } = Object.fromEntries(d2.map(([a3, b3]) => [a3.toLowerCase().replace(/-/g, ""), b3]));
        {
          var q, r, s = { name: b2, value: decodeURIComponent(c2), domain: e2, ...f2 && { expires: new Date(f2) }, ...g2 && { httpOnly: true }, ..."string" == typeof i2 && { maxAge: Number(i2) }, path: l2, ...m2 && { sameSite: j.includes(q = (q = m2).toLowerCase()) ? q : void 0 }, ...n && { secure: true }, ...p && { priority: k.includes(r = (r = p).toLowerCase()) ? r : void 0 }, ...o && { partitioned: true } };
          let a3 = {};
          for (let b3 in s) s[b3] && (a3[b3] = s[b3]);
          return a3;
        }
      }
      ((a2, c2) => {
        for (var d2 in c2) b(a2, d2, { get: c2[d2], enumerable: true });
      })(f, { RequestCookies: () => l, ResponseCookies: () => m, parseCookie: () => h, parseSetCookie: () => i, stringifyCookie: () => g }), a.exports = ((a2, f2, g2, h2) => {
        if (f2 && "object" == typeof f2 || "function" == typeof f2) for (let i2 of d(f2)) e.call(a2, i2) || i2 === g2 || b(a2, i2, { get: () => f2[i2], enumerable: !(h2 = c(f2, i2)) || h2.enumerable });
        return a2;
      })(b({}, "__esModule", { value: true }), f);
      var j = ["strict", "lax", "none"], k = ["low", "medium", "high"], l = class {
        constructor(a2) {
          this._parsed = /* @__PURE__ */ new Map(), this._headers = a2;
          let b2 = a2.get("cookie");
          if (b2) for (let [a3, c2] of h(b2)) this._parsed.set(a3, { name: a3, value: c2 });
        }
        [Symbol.iterator]() {
          return this._parsed[Symbol.iterator]();
        }
        get size() {
          return this._parsed.size;
        }
        get(...a2) {
          let b2 = "string" == typeof a2[0] ? a2[0] : a2[0].name;
          return this._parsed.get(b2);
        }
        getAll(...a2) {
          var b2;
          let c2 = Array.from(this._parsed);
          if (!a2.length) return c2.map(([a3, b3]) => b3);
          let d2 = "string" == typeof a2[0] ? a2[0] : null == (b2 = a2[0]) ? void 0 : b2.name;
          return c2.filter(([a3]) => a3 === d2).map(([a3, b3]) => b3);
        }
        has(a2) {
          return this._parsed.has(a2);
        }
        set(...a2) {
          let [b2, c2] = 1 === a2.length ? [a2[0].name, a2[0].value] : a2, d2 = this._parsed;
          return d2.set(b2, { name: b2, value: c2 }), this._headers.set("cookie", Array.from(d2).map(([a3, b3]) => g(b3)).join("; ")), this;
        }
        delete(a2) {
          let b2 = this._parsed, c2 = Array.isArray(a2) ? a2.map((a3) => b2.delete(a3)) : b2.delete(a2);
          return this._headers.set("cookie", Array.from(b2).map(([a3, b3]) => g(b3)).join("; ")), c2;
        }
        clear() {
          return this.delete(Array.from(this._parsed.keys())), this;
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return `RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
        }
        toString() {
          return [...this._parsed.values()].map((a2) => `${a2.name}=${encodeURIComponent(a2.value)}`).join("; ");
        }
      }, m = class {
        constructor(a2) {
          var b2, c2, d2;
          this._parsed = /* @__PURE__ */ new Map(), this._headers = a2;
          let e2 = null != (d2 = null != (c2 = null == (b2 = a2.getSetCookie) ? void 0 : b2.call(a2)) ? c2 : a2.get("set-cookie")) ? d2 : [];
          for (let a3 of Array.isArray(e2) ? e2 : function(a4) {
            if (!a4) return [];
            var b3, c3, d3, e3, f2, g2 = [], h2 = 0;
            function i2() {
              for (; h2 < a4.length && /\s/.test(a4.charAt(h2)); ) h2 += 1;
              return h2 < a4.length;
            }
            for (; h2 < a4.length; ) {
              for (b3 = h2, f2 = false; i2(); ) if ("," === (c3 = a4.charAt(h2))) {
                for (d3 = h2, h2 += 1, i2(), e3 = h2; h2 < a4.length && "=" !== (c3 = a4.charAt(h2)) && ";" !== c3 && "," !== c3; ) h2 += 1;
                h2 < a4.length && "=" === a4.charAt(h2) ? (f2 = true, h2 = e3, g2.push(a4.substring(b3, d3)), b3 = h2) : h2 = d3 + 1;
              } else h2 += 1;
              (!f2 || h2 >= a4.length) && g2.push(a4.substring(b3, a4.length));
            }
            return g2;
          }(e2)) {
            let b3 = i(a3);
            b3 && this._parsed.set(b3.name, b3);
          }
        }
        get(...a2) {
          let b2 = "string" == typeof a2[0] ? a2[0] : a2[0].name;
          return this._parsed.get(b2);
        }
        getAll(...a2) {
          var b2;
          let c2 = Array.from(this._parsed.values());
          if (!a2.length) return c2;
          let d2 = "string" == typeof a2[0] ? a2[0] : null == (b2 = a2[0]) ? void 0 : b2.name;
          return c2.filter((a3) => a3.name === d2);
        }
        has(a2) {
          return this._parsed.has(a2);
        }
        set(...a2) {
          let [b2, c2, d2] = 1 === a2.length ? [a2[0].name, a2[0].value, a2[0]] : a2, e2 = this._parsed;
          return e2.set(b2, function(a3 = { name: "", value: "" }) {
            return "number" == typeof a3.expires && (a3.expires = new Date(a3.expires)), a3.maxAge && (a3.expires = new Date(Date.now() + 1e3 * a3.maxAge)), (null === a3.path || void 0 === a3.path) && (a3.path = "/"), a3;
          }({ name: b2, value: c2, ...d2 })), function(a3, b3) {
            for (let [, c3] of (b3.delete("set-cookie"), a3)) {
              let a4 = g(c3);
              b3.append("set-cookie", a4);
            }
          }(e2, this._headers), this;
        }
        delete(...a2) {
          let [b2, c2] = "string" == typeof a2[0] ? [a2[0]] : [a2[0].name, a2[0]];
          return this.set({ ...c2, name: b2, value: "", expires: /* @__PURE__ */ new Date(0) });
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return `ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
        }
        toString() {
          return [...this._parsed.values()].map(g).join("; ");
        }
      };
    }, 9165: (a, b, c) => {
      "use strict";
      var d = c(5356).Buffer;
      Object.defineProperty(b, "__esModule", { value: true }), !function(a2, b2) {
        for (var c2 in b2) Object.defineProperty(a2, c2, { enumerable: true, get: b2[c2] });
      }(b, { handleFetch: function() {
        return h;
      }, interceptFetch: function() {
        return i;
      }, reader: function() {
        return f;
      } });
      let e = c(5392), f = { url: (a2) => a2.url, header: (a2, b2) => a2.headers.get(b2) };
      async function g(a2, b2) {
        let { url: c2, method: e2, headers: f2, body: g2, cache: h2, credentials: i2, integrity: j, mode: k, redirect: l, referrer: m, referrerPolicy: n } = b2;
        return { testData: a2, api: "fetch", request: { url: c2, method: e2, headers: [...Array.from(f2), ["next-test-stack", function() {
          let a3 = (Error().stack ?? "").split("\n");
          for (let b3 = 1; b3 < a3.length; b3++) if (a3[b3].length > 0) {
            a3 = a3.slice(b3);
            break;
          }
          return (a3 = (a3 = (a3 = a3.filter((a4) => !a4.includes("/next/dist/"))).slice(0, 5)).map((a4) => a4.replace("webpack-internal:///(rsc)/", "").trim())).join("    ");
        }()]], body: g2 ? d.from(await b2.arrayBuffer()).toString("base64") : null, cache: h2, credentials: i2, integrity: j, mode: k, redirect: l, referrer: m, referrerPolicy: n } };
      }
      async function h(a2, b2) {
        let c2 = (0, e.getTestReqInfo)(b2, f);
        if (!c2) return a2(b2);
        let { testData: h2, proxyPort: i2 } = c2, j = await g(h2, b2), k = await a2(`http://localhost:${i2}`, { method: "POST", body: JSON.stringify(j), next: { internal: true } });
        if (!k.ok) throw Object.defineProperty(Error(`Proxy request failed: ${k.status}`), "__NEXT_ERROR_CODE", { value: "E146", enumerable: false, configurable: true });
        let l = await k.json(), { api: m } = l;
        switch (m) {
          case "continue":
            return a2(b2);
          case "abort":
          case "unhandled":
            throw Object.defineProperty(Error(`Proxy request aborted [${b2.method} ${b2.url}]`), "__NEXT_ERROR_CODE", { value: "E145", enumerable: false, configurable: true });
          case "fetch":
            let { status: n, headers: o, body: p } = l.response;
            return new Response(p ? d.from(p, "base64") : null, { status: n, headers: new Headers(o) });
          default:
            return m;
        }
      }
      function i(a2) {
        return c.g.fetch = function(b2, c2) {
          var d2;
          return (null == c2 || null == (d2 = c2.next) ? void 0 : d2.internal) ? a2(b2, c2) : h(a2, new Request(b2, c2));
        }, () => {
          c.g.fetch = a2;
        };
      }
    } }, (a) => {
      var b = a(a.s = 6667);
      (_ENTRIES = "undefined" == typeof _ENTRIES ? {} : _ENTRIES)["middleware_src/middleware"] = b;
    }]);
  }
});

// node_modules/@opennextjs/aws/dist/core/edgeFunctionHandler.js
var edgeFunctionHandler_exports = {};
__export(edgeFunctionHandler_exports, {
  default: () => edgeFunctionHandler
});
async function edgeFunctionHandler(request) {
  const path3 = new URL(request.url).pathname;
  const routes = globalThis._ROUTES;
  const correspondingRoute = routes.find((route) => route.regex.some((r) => new RegExp(r).test(path3)));
  if (!correspondingRoute) {
    throw new Error(`No route found for ${request.url}`);
  }
  const entry = await self._ENTRIES[`middleware_${correspondingRoute.name}`];
  const result = await entry.default({
    page: correspondingRoute.page,
    request: {
      ...request,
      page: {
        name: correspondingRoute.name
      }
    }
  });
  globalThis.__openNextAls.getStore()?.pendingPromiseRunner.add(result.waitUntil);
  const response = result.response;
  return response;
}
var init_edgeFunctionHandler = __esm({
  "node_modules/@opennextjs/aws/dist/core/edgeFunctionHandler.js"() {
    globalThis._ENTRIES = {};
    globalThis.self = globalThis;
    globalThis._ROUTES = [{ "name": "src/middleware", "page": "/", "regex": ["^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!_next\\/static|_next\\/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*))(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$"] }];
    require_edge_instrumentation();
    require_edge_runtime_webpack();
    require_middleware();
  }
});

// node_modules/@opennextjs/aws/dist/utils/promise.js
init_logger();

// node_modules/@opennextjs/aws/dist/utils/requestCache.js
var RequestCache = class {
  _caches = /* @__PURE__ */ new Map();
  /**
   * Returns the Map registered under `key`.
   * If no Map exists yet for that key, a new empty Map is created, stored, and returned.
   * Repeated calls with the same key always return the **same** Map instance.
   */
  getOrCreate(key) {
    let cache = this._caches.get(key);
    if (!cache) {
      cache = /* @__PURE__ */ new Map();
      this._caches.set(key, cache);
    }
    return cache;
  }
};

// node_modules/@opennextjs/aws/dist/utils/promise.js
var DetachedPromise = class {
  resolve;
  reject;
  promise;
  constructor() {
    let resolve;
    let reject;
    this.promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.resolve = resolve;
    this.reject = reject;
  }
};
var DetachedPromiseRunner = class {
  promises = [];
  withResolvers() {
    const detachedPromise = new DetachedPromise();
    this.promises.push(detachedPromise);
    return detachedPromise;
  }
  add(promise) {
    const detachedPromise = new DetachedPromise();
    this.promises.push(detachedPromise);
    promise.then(detachedPromise.resolve, detachedPromise.reject);
  }
  async await() {
    debug(`Awaiting ${this.promises.length} detached promises`);
    const results = await Promise.allSettled(this.promises.map((p) => p.promise));
    const rejectedPromises = results.filter((r) => r.status === "rejected");
    rejectedPromises.forEach((r) => {
      error(r.reason);
    });
  }
};
async function awaitAllDetachedPromise() {
  const store = globalThis.__openNextAls.getStore();
  const promisesToAwait = store?.pendingPromiseRunner.await() ?? Promise.resolve();
  if (store?.waitUntil) {
    store.waitUntil(promisesToAwait);
    return;
  }
  await promisesToAwait;
}
function provideNextAfterProvider() {
  const NEXT_REQUEST_CONTEXT_SYMBOL = Symbol.for("@next/request-context");
  const VERCEL_REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");
  const store = globalThis.__openNextAls.getStore();
  const waitUntil = store?.waitUntil ?? ((promise) => store?.pendingPromiseRunner.add(promise));
  const nextAfterContext = {
    get: () => ({
      waitUntil
    })
  };
  globalThis[NEXT_REQUEST_CONTEXT_SYMBOL] = nextAfterContext;
  if (process.env.EMULATE_VERCEL_REQUEST_CONTEXT) {
    globalThis[VERCEL_REQUEST_CONTEXT_SYMBOL] = nextAfterContext;
  }
}
function runWithOpenNextRequestContext({ isISRRevalidation, waitUntil, requestId = Math.random().toString(36) }, fn) {
  return globalThis.__openNextAls.run({
    requestId,
    pendingPromiseRunner: new DetachedPromiseRunner(),
    isISRRevalidation,
    waitUntil,
    writtenTags: /* @__PURE__ */ new Set(),
    requestCache: new RequestCache()
  }, async () => {
    provideNextAfterProvider();
    let result;
    try {
      result = await fn();
    } finally {
      await awaitAllDetachedPromise();
    }
    return result;
  });
}

// node_modules/@opennextjs/aws/dist/adapters/middleware.js
init_logger();

// node_modules/@opennextjs/aws/dist/core/createGenericHandler.js
init_logger();

// node_modules/@opennextjs/aws/dist/core/resolve.js
async function resolveConverter(converter2) {
  if (typeof converter2 === "function") {
    return converter2();
  }
  const m_1 = await Promise.resolve().then(() => (init_edge(), edge_exports));
  return m_1.default;
}
async function resolveWrapper(wrapper) {
  if (typeof wrapper === "function") {
    return wrapper();
  }
  const m_1 = await Promise.resolve().then(() => (init_cloudflare_edge(), cloudflare_edge_exports));
  return m_1.default;
}
async function resolveOriginResolver(originResolver) {
  if (typeof originResolver === "function") {
    return originResolver();
  }
  const m_1 = await Promise.resolve().then(() => (init_pattern_env(), pattern_env_exports));
  return m_1.default;
}
async function resolveAssetResolver(assetResolver) {
  if (typeof assetResolver === "function") {
    return assetResolver();
  }
  const m_1 = await Promise.resolve().then(() => (init_dummy(), dummy_exports));
  return m_1.default;
}
async function resolveProxyRequest(proxyRequest) {
  if (typeof proxyRequest === "function") {
    return proxyRequest();
  }
  const m_1 = await Promise.resolve().then(() => (init_fetch(), fetch_exports));
  return m_1.default;
}

// node_modules/@opennextjs/aws/dist/core/createGenericHandler.js
async function createGenericHandler(handler3) {
  const config = await import("./open-next.config.mjs").then((m) => m.default);
  globalThis.openNextConfig = config;
  const handlerConfig = config[handler3.type];
  const override = handlerConfig && "override" in handlerConfig ? handlerConfig.override : void 0;
  const converter2 = await resolveConverter(override?.converter);
  const { name, wrapper } = await resolveWrapper(override?.wrapper);
  debug("Using wrapper", name);
  return wrapper(handler3.handler, converter2);
}

// node_modules/@opennextjs/aws/dist/core/routing/util.js
import crypto2 from "node:crypto";
import { parse as parseQs, stringify as stringifyQs } from "node:querystring";

// node_modules/@opennextjs/aws/dist/adapters/config/index.js
init_logger();
import path from "node:path";
globalThis.__dirname ??= "";
var NEXT_DIR = path.join(__dirname, ".next");
var OPEN_NEXT_DIR = path.join(__dirname, ".open-next");
debug({ NEXT_DIR, OPEN_NEXT_DIR });
var NextConfig = { "env": { "NEXT_PUBLIC_APP_URL": "http://localhost:3000" }, "eslint": { "ignoreDuringBuilds": false }, "typescript": { "ignoreBuildErrors": false, "tsconfigPath": "tsconfig.json" }, "typedRoutes": false, "distDir": ".next", "cleanDistDir": true, "assetPrefix": "", "cacheMaxMemorySize": 52428800, "configOrigin": "next.config.ts", "useFileSystemPublicRoutes": true, "generateEtags": true, "pageExtensions": ["tsx", "ts", "jsx", "js"], "poweredByHeader": true, "compress": true, "images": { "deviceSizes": [640, 750, 828, 1080, 1200, 1920, 2048, 3840], "imageSizes": [16, 32, 48, 64, 96, 128, 256, 384], "path": "/_next/image", "loader": "default", "loaderFile": "", "domains": [], "disableStaticImages": false, "minimumCacheTTL": 60, "formats": ["image/webp"], "maximumResponseBody": 5e7, "dangerouslyAllowSVG": false, "contentSecurityPolicy": "script-src 'none'; frame-src 'none'; sandbox;", "contentDispositionType": "attachment", "remotePatterns": [], "unoptimized": false }, "devIndicators": { "position": "bottom-left" }, "onDemandEntries": { "maxInactiveAge": 6e4, "pagesBufferLength": 5 }, "amp": { "canonicalBase": "" }, "basePath": "", "sassOptions": {}, "trailingSlash": false, "i18n": null, "productionBrowserSourceMaps": false, "excludeDefaultMomentLocales": true, "serverRuntimeConfig": {}, "publicRuntimeConfig": {}, "reactProductionProfiling": false, "reactStrictMode": null, "reactMaxHeadersLength": 6e3, "httpAgentOptions": { "keepAlive": true }, "logging": {}, "compiler": {}, "expireTime": 31536e3, "staticPageGenerationTimeout": 60, "output": "standalone", "modularizeImports": { "@mui/icons-material": { "transform": "@mui/icons-material/{{member}}" }, "lodash": { "transform": "lodash/{{member}}" } }, "outputFileTracingRoot": "D:\\projetos\\synkroo", "experimental": { "useSkewCookie": false, "cacheLife": { "default": { "stale": 300, "revalidate": 900, "expire": 4294967294 }, "seconds": { "stale": 30, "revalidate": 1, "expire": 60 }, "minutes": { "stale": 300, "revalidate": 60, "expire": 3600 }, "hours": { "stale": 300, "revalidate": 3600, "expire": 86400 }, "days": { "stale": 300, "revalidate": 86400, "expire": 604800 }, "weeks": { "stale": 300, "revalidate": 604800, "expire": 2592e3 }, "max": { "stale": 300, "revalidate": 2592e3, "expire": 4294967294 } }, "cacheHandlers": {}, "cssChunking": true, "multiZoneDraftMode": false, "appNavFailHandling": false, "prerenderEarlyExit": true, "serverMinification": true, "serverSourceMaps": false, "linkNoTouchStart": false, "caseSensitiveRoutes": false, "clientSegmentCache": false, "clientParamParsing": false, "dynamicOnHover": false, "preloadEntriesOnStart": true, "clientRouterFilter": true, "clientRouterFilterRedirects": false, "fetchCacheKeyPrefix": "", "middlewarePrefetch": "flexible", "optimisticClientCache": true, "manualClientBasePath": false, "cpus": 11, "memoryBasedWorkersCount": false, "imgOptConcurrency": null, "imgOptTimeoutInSeconds": 7, "imgOptMaxInputPixels": 268402689, "imgOptSequentialRead": null, "imgOptSkipMetadata": null, "isrFlushToDisk": true, "workerThreads": false, "optimizeCss": false, "nextScriptWorkers": false, "scrollRestoration": false, "externalDir": false, "disableOptimizedLoading": false, "gzipSize": true, "craCompat": false, "esmExternals": true, "fullySpecified": false, "swcTraceProfiling": false, "forceSwcTransforms": false, "largePageDataBytes": 128e3, "typedEnv": false, "parallelServerCompiles": false, "parallelServerBuildTraces": false, "ppr": false, "authInterrupts": false, "webpackMemoryOptimizations": false, "optimizeServerReact": true, "viewTransition": false, "routerBFCache": false, "removeUncaughtErrorAndRejectionListeners": false, "validateRSCRequestHeaders": false, "staleTimes": { "dynamic": 0, "static": 300 }, "serverComponentsHmrCache": true, "staticGenerationMaxConcurrency": 8, "staticGenerationMinPagesPerWorker": 25, "cacheComponents": false, "inlineCss": false, "useCache": false, "globalNotFound": false, "devtoolSegmentExplorer": true, "browserDebugInfoInTerminal": false, "optimizeRouterScrolling": false, "middlewareClientMaxBodySize": 10485760, "serverActions": { "bodySizeLimit": "2mb" }, "optimizePackageImports": ["lucide-react", "date-fns", "lodash-es", "ramda", "antd", "react-bootstrap", "ahooks", "@ant-design/icons", "@headlessui/react", "@headlessui-float/react", "@heroicons/react/20/solid", "@heroicons/react/24/solid", "@heroicons/react/24/outline", "@visx/visx", "@tremor/react", "rxjs", "@mui/material", "@mui/icons-material", "recharts", "react-use", "effect", "@effect/schema", "@effect/platform", "@effect/platform-node", "@effect/platform-browser", "@effect/platform-bun", "@effect/sql", "@effect/sql-mssql", "@effect/sql-mysql2", "@effect/sql-pg", "@effect/sql-sqlite-node", "@effect/sql-sqlite-bun", "@effect/sql-sqlite-wasm", "@effect/sql-sqlite-react-native", "@effect/rpc", "@effect/rpc-http", "@effect/typeclass", "@effect/experimental", "@effect/opentelemetry", "@material-ui/core", "@material-ui/icons", "@tabler/icons-react", "mui-core", "react-icons/ai", "react-icons/bi", "react-icons/bs", "react-icons/cg", "react-icons/ci", "react-icons/di", "react-icons/fa", "react-icons/fa6", "react-icons/fc", "react-icons/fi", "react-icons/gi", "react-icons/go", "react-icons/gr", "react-icons/hi", "react-icons/hi2", "react-icons/im", "react-icons/io", "react-icons/io5", "react-icons/lia", "react-icons/lib", "react-icons/lu", "react-icons/md", "react-icons/pi", "react-icons/ri", "react-icons/rx", "react-icons/si", "react-icons/sl", "react-icons/tb", "react-icons/tfi", "react-icons/ti", "react-icons/vsc", "react-icons/wi"], "trustHostHeader": false, "isExperimentalCompile": false }, "htmlLimitedBots": "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight", "bundlePagesRouterDependencies": false, "configFileName": "next.config.ts", "serverExternalPackages": ["playwright", "playwright-core", "chromium-bidi", "pg", "pg-connection-string", "pgpass"], "turbopack": { "root": "D:\\projetos\\synkroo" } };
var BuildId = "9h6AjpTXJudiitX9qb-DR";
var RoutesManifest = { "basePath": "", "rewrites": { "beforeFiles": [], "afterFiles": [], "fallback": [] }, "redirects": [{ "source": "/:path+/", "destination": "/:path+", "internal": true, "statusCode": 308, "regex": "^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$" }], "routes": { "static": [{ "page": "/", "regex": "^/(?:/)?$", "routeKeys": {}, "namedRegex": "^/(?:/)?$" }, { "page": "/_not-found", "regex": "^/_not\\-found(?:/)?$", "routeKeys": {}, "namedRegex": "^/_not\\-found(?:/)?$" }, { "page": "/dashboard", "regex": "^/dashboard(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard(?:/)?$" }, { "page": "/dashboard/agendamentos", "regex": "^/dashboard/agendamentos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/agendamentos(?:/)?$" }, { "page": "/dashboard/agendamentos/novo", "regex": "^/dashboard/agendamentos/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/agendamentos/novo(?:/)?$" }, { "page": "/dashboard/analytics", "regex": "^/dashboard/analytics(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/analytics(?:/)?$" }, { "page": "/dashboard/atividades", "regex": "^/dashboard/atividades(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/atividades(?:/)?$" }, { "page": "/dashboard/campanhas", "regex": "^/dashboard/campanhas(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/campanhas(?:/)?$" }, { "page": "/dashboard/campanhas/nova", "regex": "^/dashboard/campanhas/nova(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/campanhas/nova(?:/)?$" }, { "page": "/dashboard/configuracao", "regex": "^/dashboard/configuracao(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/configuracao(?:/)?$" }, { "page": "/dashboard/configuracoes", "regex": "^/dashboard/configuracoes(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/configuracoes(?:/)?$" }, { "page": "/dashboard/configuracoes/acessos", "regex": "^/dashboard/configuracoes/acessos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/configuracoes/acessos(?:/)?$" }, { "page": "/dashboard/configuracoes/acessos/perfis", "regex": "^/dashboard/configuracoes/acessos/perfis(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/configuracoes/acessos/perfis(?:/)?$" }, { "page": "/dashboard/contatos", "regex": "^/dashboard/contatos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/contatos(?:/)?$" }, { "page": "/dashboard/conversas", "regex": "^/dashboard/conversas(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/conversas(?:/)?$" }, { "page": "/dashboard/crm", "regex": "^/dashboard/crm(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/crm(?:/)?$" }, { "page": "/dashboard/crm/pipeline", "regex": "^/dashboard/crm/pipeline(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/crm/pipeline(?:/)?$" }, { "page": "/dashboard/dentistas", "regex": "^/dashboard/dentistas(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/dentistas(?:/)?$" }, { "page": "/dashboard/dentistas/novo", "regex": "^/dashboard/dentistas/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/dentistas/novo(?:/)?$" }, { "page": "/dashboard/leads", "regex": "^/dashboard/leads(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/leads(?:/)?$" }, { "page": "/dashboard/leads/novo", "regex": "^/dashboard/leads/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/leads/novo(?:/)?$" }, { "page": "/dashboard/lista-espera", "regex": "^/dashboard/lista\\-espera(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/lista\\-espera(?:/)?$" }, { "page": "/dashboard/pacientes", "regex": "^/dashboard/pacientes(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/pacientes(?:/)?$" }, { "page": "/dashboard/pacientes/inativos", "regex": "^/dashboard/pacientes/inativos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/pacientes/inativos(?:/)?$" }, { "page": "/dashboard/pacientes/novo", "regex": "^/dashboard/pacientes/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/pacientes/novo(?:/)?$" }, { "page": "/dashboard/pipeline", "regex": "^/dashboard/pipeline(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/pipeline(?:/)?$" }, { "page": "/dashboard/procedimentos", "regex": "^/dashboard/procedimentos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/procedimentos(?:/)?$" }, { "page": "/dashboard/procedimentos/novo", "regex": "^/dashboard/procedimentos/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/procedimentos/novo(?:/)?$" }, { "page": "/dashboard/tarefas", "regex": "^/dashboard/tarefas(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/tarefas(?:/)?$" }, { "page": "/login", "regex": "^/login(?:/)?$", "routeKeys": {}, "namedRegex": "^/login(?:/)?$" }, { "page": "/signup", "regex": "^/signup(?:/)?$", "routeKeys": {}, "namedRegex": "^/signup(?:/)?$" }], "dynamic": [{ "page": "/api/appointments/[id]", "regex": "^/api/appointments/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/appointments/[id]/cancel", "regex": "^/api/appointments/([^/]+?)/cancel(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/cancel(?:/)?$" }, { "page": "/api/appointments/[id]/confirm", "regex": "^/api/appointments/([^/]+?)/confirm(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/confirm(?:/)?$" }, { "page": "/api/appointments/[id]/noshow", "regex": "^/api/appointments/([^/]+?)/noshow(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/noshow(?:/)?$" }, { "page": "/api/appointments/[id]/reactivate", "regex": "^/api/appointments/([^/]+?)/reactivate(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/reactivate(?:/)?$" }, { "page": "/api/appointments/[id]/remind", "regex": "^/api/appointments/([^/]+?)/remind(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/remind(?:/)?$" }, { "page": "/api/appointments/[id]/reminder-template", "regex": "^/api/appointments/([^/]+?)/reminder\\-template(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/reminder\\-template(?:/)?$" }, { "page": "/api/appointments/[id]/reschedule", "regex": "^/api/appointments/([^/]+?)/reschedule(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/reschedule(?:/)?$" }, { "page": "/api/auth/[...nextauth]", "regex": "^/api/auth/(.+?)(?:/)?$", "routeKeys": { "nxtPnextauth": "nxtPnextauth" }, "namedRegex": "^/api/auth/(?<nxtPnextauth>.+?)(?:/)?$" }, { "page": "/api/budgets/[id]", "regex": "^/api/budgets/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/budgets/[id]/accept", "regex": "^/api/budgets/([^/]+?)/accept(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/accept(?:/)?$" }, { "page": "/api/budgets/[id]/installments", "regex": "^/api/budgets/([^/]+?)/installments(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/installments(?:/)?$" }, { "page": "/api/budgets/[id]/payments", "regex": "^/api/budgets/([^/]+?)/payments(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/payments(?:/)?$" }, { "page": "/api/budgets/[id]/reject", "regex": "^/api/budgets/([^/]+?)/reject(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/reject(?:/)?$" }, { "page": "/api/budgets/[id]/send", "regex": "^/api/budgets/([^/]+?)/send(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/send(?:/)?$" }, { "page": "/api/campaigns/[id]", "regex": "^/api/campaigns/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/campaigns/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/campaigns/[id]/recipients", "regex": "^/api/campaigns/([^/]+?)/recipients(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/campaigns/(?<nxtPid>[^/]+?)/recipients(?:/)?$" }, { "page": "/api/campaigns/[id]/start", "regex": "^/api/campaigns/([^/]+?)/start(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/campaigns/(?<nxtPid>[^/]+?)/start(?:/)?$" }, { "page": "/api/contacts/[id]", "regex": "^/api/contacts/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/contacts/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/contacts/[id]/appointments", "regex": "^/api/contacts/([^/]+?)/appointments(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/contacts/(?<nxtPid>[^/]+?)/appointments(?:/)?$" }, { "page": "/api/contacts/[id]/notes", "regex": "^/api/contacts/([^/]+?)/notes(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/contacts/(?<nxtPid>[^/]+?)/notes(?:/)?$" }, { "page": "/api/contacts/[id]/timeline", "regex": "^/api/contacts/([^/]+?)/timeline(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/contacts/(?<nxtPid>[^/]+?)/timeline(?:/)?$" }, { "page": "/api/conversations/[id]", "regex": "^/api/conversations/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/conversations/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/custom-fields/definitions/[id]", "regex": "^/api/custom\\-fields/definitions/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/custom\\-fields/definitions/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/dentists/[id]", "regex": "^/api/dentists/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/dentists/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/knowledge/[id]", "regex": "^/api/knowledge/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/knowledge/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/leads/notifications/[id]/acknowledge", "regex": "^/api/leads/notifications/([^/]+?)/acknowledge(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/leads/notifications/(?<nxtPid>[^/]+?)/acknowledge(?:/)?$" }, { "page": "/api/leads/[id]", "regex": "^/api/leads/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/leads/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/leads/[id]/convert", "regex": "^/api/leads/([^/]+?)/convert(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/leads/(?<nxtPid>[^/]+?)/convert(?:/)?$" }, { "page": "/api/leads/[id]/stage", "regex": "^/api/leads/([^/]+?)/stage(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/leads/(?<nxtPid>[^/]+?)/stage(?:/)?$" }, { "page": "/api/messages/history/[conversationId]", "regex": "^/api/messages/history/([^/]+?)(?:/)?$", "routeKeys": { "nxtPconversationId": "nxtPconversationId" }, "namedRegex": "^/api/messages/history/(?<nxtPconversationId>[^/]+?)(?:/)?$" }, { "page": "/api/patients/[id]", "regex": "^/api/patients/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/patients/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/patients/[id]/history", "regex": "^/api/patients/([^/]+?)/history(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/patients/(?<nxtPid>[^/]+?)/history(?:/)?$" }, { "page": "/api/patients/[id]/observations", "regex": "^/api/patients/([^/]+?)/observations(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/patients/(?<nxtPid>[^/]+?)/observations(?:/)?$" }, { "page": "/api/patients/[id]/preferences", "regex": "^/api/patients/([^/]+?)/preferences(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/patients/(?<nxtPid>[^/]+?)/preferences(?:/)?$" }, { "page": "/api/pipeline/stages/[id]", "regex": "^/api/pipeline/stages/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/pipeline/stages/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/procedures/[id]", "regex": "^/api/procedures/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/procedures/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/treatment-plans/[id]", "regex": "^/api/treatment\\-plans/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/treatment\\-plans/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/treatment-plans/[id]/sessions", "regex": "^/api/treatment\\-plans/([^/]+?)/sessions(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/treatment\\-plans/(?<nxtPid>[^/]+?)/sessions(?:/)?$" }, { "page": "/dashboard/agendamentos/[id]", "regex": "^/dashboard/agendamentos/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/agendamentos/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/campanhas/[id]", "regex": "^/dashboard/campanhas/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/campanhas/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/dentistas/[id]", "regex": "^/dashboard/dentistas/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/dentistas/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/leads/[id]", "regex": "^/dashboard/leads/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/leads/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/pacientes/[id]", "regex": "^/dashboard/pacientes/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/pacientes/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/pacientes/[id]/editar", "regex": "^/dashboard/pacientes/([^/]+?)/editar(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/pacientes/(?<nxtPid>[^/]+?)/editar(?:/)?$" }, { "page": "/dashboard/procedimentos/[id]", "regex": "^/dashboard/procedimentos/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/procedimentos/(?<nxtPid>[^/]+?)(?:/)?$" }], "data": { "static": [], "dynamic": [] } }, "locales": [] };
var ConfigHeaders = [];
var PrerenderManifest = { "version": 4, "routes": { "/_not-found": { "initialStatus": 404, "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/_not-found", "dataRoute": "/_not-found.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/login": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/login", "dataRoute": "/login.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/", "dataRoute": "/index.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/signup": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/signup", "dataRoute": "/signup.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/agendamentos/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/agendamentos/novo", "dataRoute": "/dashboard/agendamentos/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/analytics": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/analytics", "dataRoute": "/dashboard/analytics.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/campanhas/nova": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/campanhas/nova", "dataRoute": "/dashboard/campanhas/nova.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/campanhas": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/campanhas", "dataRoute": "/dashboard/campanhas.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/configuracao": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/configuracao", "dataRoute": "/dashboard/configuracao.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/configuracoes": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/configuracoes", "dataRoute": "/dashboard/configuracoes.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/atividades": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/atividades", "dataRoute": "/dashboard/atividades.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/contatos": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/contatos", "dataRoute": "/dashboard/contatos.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/crm": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/crm", "dataRoute": "/dashboard/crm.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/conversas": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/conversas", "dataRoute": "/dashboard/conversas.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/agendamentos": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/agendamentos", "dataRoute": "/dashboard/agendamentos.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/crm/pipeline": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/crm/pipeline", "dataRoute": "/dashboard/crm/pipeline.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/dentistas/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/dentistas/novo", "dataRoute": "/dashboard/dentistas/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/dentistas": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/dentistas", "dataRoute": "/dashboard/dentistas.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/leads/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/leads/novo", "dataRoute": "/dashboard/leads/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/leads": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/leads", "dataRoute": "/dashboard/leads.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/lista-espera": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/lista-espera", "dataRoute": "/dashboard/lista-espera.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/pacientes/inativos": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/pacientes/inativos", "dataRoute": "/dashboard/pacientes/inativos.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/pacientes/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/pacientes/novo", "dataRoute": "/dashboard/pacientes/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/pacientes": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/pacientes", "dataRoute": "/dashboard/pacientes.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/pipeline": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/pipeline", "dataRoute": "/dashboard/pipeline.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard", "dataRoute": "/dashboard.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/procedimentos/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/procedimentos/novo", "dataRoute": "/dashboard/procedimentos/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/procedimentos": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/procedimentos", "dataRoute": "/dashboard/procedimentos.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/tarefas": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/tarefas", "dataRoute": "/dashboard/tarefas.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] } }, "dynamicRoutes": {}, "notFoundRoutes": [], "preview": { "previewModeId": "b1f1882484269d4581d7c06c1114d7d6", "previewModeSigningKey": "063a8c6cd273e5c44e6945504e964793b66077fcbb21823ca19f4e9a5605508a", "previewModeEncryptionKey": "f0afc0ef2a5814cb157b10e63dfcaeeb80aa69145e29cdf545e946234a8f8e85" } };
var MiddlewareManifest = { "version": 3, "middleware": { "/": { "files": ["server/edge-instrumentation.js", "server/edge-runtime-webpack.js", "server/src/middleware.js"], "name": "src/middleware", "page": "/", "matchers": [{ "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!_next\\/static|_next\\/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*))(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$", "originalSource": "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)" }], "wasm": [], "assets": [], "env": { "__NEXT_BUILD_ID": "9h6AjpTXJudiitX9qb-DR", "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY": "5t/OcqTiFwBiDYwBK1Ulwswr6eqiF8G7SLa7IvJi5IY=", "__NEXT_PREVIEW_MODE_ID": "b1f1882484269d4581d7c06c1114d7d6", "__NEXT_PREVIEW_MODE_SIGNING_KEY": "063a8c6cd273e5c44e6945504e964793b66077fcbb21823ca19f4e9a5605508a", "__NEXT_PREVIEW_MODE_ENCRYPTION_KEY": "f0afc0ef2a5814cb157b10e63dfcaeeb80aa69145e29cdf545e946234a8f8e85" } } }, "functions": {}, "sortedMiddleware": ["/"] };
var AppPathRoutesManifest = { "/_not-found/page": "/_not-found", "/api/activities/route": "/api/activities", "/api/admin/run-migration/route": "/api/admin/run-migration", "/api/agent/classify/route": "/api/agent/classify", "/api/agent/messages/route": "/api/agent/messages", "/api/agent/schedule-flow/route": "/api/agent/schedule-flow", "/api/agent/decisions/route": "/api/agent/decisions", "/api/agent/pending-actions/route": "/api/agent/pending-actions", "/api/analytics/insights/route": "/api/analytics/insights", "/api/analytics/metrics/route": "/api/analytics/metrics", "/api/analytics/noshow-prediction/route": "/api/analytics/noshow-prediction", "/api/appointments/[id]/cancel/route": "/api/appointments/[id]/cancel", "/api/analytics/roi/route": "/api/analytics/roi", "/api/appointments/[id]/confirm/route": "/api/appointments/[id]/confirm", "/api/appointments/[id]/noshow/route": "/api/appointments/[id]/noshow", "/api/appointments/[id]/reactivate/route": "/api/appointments/[id]/reactivate", "/api/appointments/[id]/remind/route": "/api/appointments/[id]/remind", "/api/appointments/[id]/reminder-template/route": "/api/appointments/[id]/reminder-template", "/api/appointments/[id]/reschedule/route": "/api/appointments/[id]/reschedule", "/api/appointments/[id]/route": "/api/appointments/[id]", "/api/appointments/availability/route": "/api/appointments/availability", "/api/appointments/confirm-response/route": "/api/appointments/confirm-response", "/api/appointments/incomplete-treatments/route": "/api/appointments/incomplete-treatments", "/api/appointments/route": "/api/appointments", "/api/auth/[...nextauth]/route": "/api/auth/[...nextauth]", "/api/auth/login/route": "/api/auth/login", "/api/auth/refresh/route": "/api/auth/refresh", "/api/auth/logout/route": "/api/auth/logout", "/api/auth/signup/route": "/api/auth/signup", "/api/auth/session/route": "/api/auth/session", "/api/budgets/[id]/accept/route": "/api/budgets/[id]/accept", "/api/budgets/[id]/payments/route": "/api/budgets/[id]/payments", "/api/budgets/[id]/installments/route": "/api/budgets/[id]/installments", "/api/budgets/[id]/reject/route": "/api/budgets/[id]/reject", "/api/budgets/[id]/route": "/api/budgets/[id]", "/api/budgets/followup/route": "/api/budgets/followup", "/api/budgets/route": "/api/budgets", "/api/budgets/[id]/send/route": "/api/budgets/[id]/send", "/api/campaigns/[id]/recipients/route": "/api/campaigns/[id]/recipients", "/api/campaigns/[id]/start/route": "/api/campaigns/[id]/start", "/api/campaigns/[id]/route": "/api/campaigns/[id]", "/api/campaigns/process/route": "/api/campaigns/process", "/api/campaigns/route": "/api/campaigns", "/api/campaigns/segments/preview/route": "/api/campaigns/segments/preview", "/api/clinics/settings/route": "/api/clinics/settings", "/api/campaigns/segments/route": "/api/campaigns/segments", "/api/consents/route": "/api/consents", "/api/contacts/[id]/appointments/route": "/api/contacts/[id]/appointments", "/api/contacts/[id]/notes/route": "/api/contacts/[id]/notes", "/api/contacts/[id]/route": "/api/contacts/[id]", "/api/contacts/[id]/timeline/route": "/api/contacts/[id]/timeline", "/api/contacts/route": "/api/contacts", "/api/conversations/route": "/api/conversations", "/api/conversations/[id]/route": "/api/conversations/[id]", "/api/crm/stats/route": "/api/crm/stats", "/api/cron/cleanup/route": "/api/cron/cleanup", "/api/cron/followups/route": "/api/cron/followups", "/api/cron/reminders/route": "/api/cron/reminders", "/api/cron/smart-triggers/route": "/api/cron/smart-triggers", "/api/custom-fields/definitions/[id]/route": "/api/custom-fields/definitions/[id]", "/api/custom-fields/definitions/route": "/api/custom-fields/definitions", "/api/custom-fields/values/route": "/api/custom-fields/values", "/api/dashboard/alerts/route": "/api/dashboard/alerts", "/api/dashboard/stats/route": "/api/dashboard/stats", "/api/dentists/[id]/route": "/api/dentists/[id]", "/api/dentists/route": "/api/dentists", "/api/health/db/route": "/api/health/db", "/api/health/route": "/api/health", "/api/instagram/webhook/route": "/api/instagram/webhook", "/api/knowledge/[id]/route": "/api/knowledge/[id]", "/api/knowledge/categories/route": "/api/knowledge/categories", "/api/knowledge/route": "/api/knowledge", "/api/knowledge/search/route": "/api/knowledge/search", "/api/leads/[id]/convert/route": "/api/leads/[id]/convert", "/api/leads/[id]/route": "/api/leads/[id]", "/api/leads/[id]/stage/route": "/api/leads/[id]/stage", "/api/leads/kanban/route": "/api/leads/kanban", "/api/leads/hot/route": "/api/leads/hot", "/api/leads/notifications/[id]/acknowledge/route": "/api/leads/notifications/[id]/acknowledge", "/api/leads/notifications/route": "/api/leads/notifications", "/api/leads/route": "/api/leads", "/api/leads/stats/route": "/api/leads/stats", "/api/lgpd/anonymize/route": "/api/lgpd/anonymize", "/api/lgpd/export/route": "/api/lgpd/export", "/api/messages/history/[conversationId]/route": "/api/messages/history/[conversationId]", "/api/messages/inbound/route": "/api/messages/inbound", "/api/messages/whatsapp/route": "/api/messages/whatsapp", "/api/messages/send/route": "/api/messages/send", "/api/patients/[id]/history/route": "/api/patients/[id]/history", "/api/patients/[id]/observations/route": "/api/patients/[id]/observations", "/api/patients/[id]/preferences/route": "/api/patients/[id]/preferences", "/api/patients/[id]/route": "/api/patients/[id]", "/api/patients/deduplicate/route": "/api/patients/deduplicate", "/api/patients/inactive/route": "/api/patients/inactive", "/api/patients/route": "/api/patients", "/api/patients/tags/route": "/api/patients/tags", "/api/pipeline/analytics/route": "/api/pipeline/analytics", "/api/pipeline/stages/[id]/route": "/api/pipeline/stages/[id]", "/api/pipeline/stages/route": "/api/pipeline/stages", "/api/pipeline/stages/reorder/route": "/api/pipeline/stages/reorder", "/api/procedures/[id]/route": "/api/procedures/[id]", "/api/procedures/route": "/api/procedures", "/api/reminders/config/route": "/api/reminders/config", "/api/reports/export/route": "/api/reports/export", "/api/reports/financial/route": "/api/reports/financial", "/api/reports/patients/route": "/api/reports/patients", "/api/scheduler/chat/route": "/api/scheduler/chat", "/api/tasks/route": "/api/tasks", "/api/seed/route": "/api/seed", "/api/treatment-plans/[id]/route": "/api/treatment-plans/[id]", "/api/treatment-plans/[id]/sessions/route": "/api/treatment-plans/[id]/sessions", "/api/treatment-plans/route": "/api/treatment-plans", "/api/waitlist/route": "/api/waitlist", "/api/whatsapp/evolution/route": "/api/whatsapp/evolution", "/api/whatsapp/qrcode/route": "/api/whatsapp/qrcode", "/api/whatsapp/send/route": "/api/whatsapp/send", "/api/whatsapp/templates/route": "/api/whatsapp/templates", "/api/whatsapp/webhook/route": "/api/whatsapp/webhook", "/api/widget/messages/route": "/api/widget/messages", "/login/page": "/login", "/signup/page": "/signup", "/page": "/", "/dashboard/agendamentos/[id]/page": "/dashboard/agendamentos/[id]", "/dashboard/agendamentos/novo/page": "/dashboard/agendamentos/novo", "/dashboard/atividades/page": "/dashboard/atividades", "/dashboard/campanhas/[id]/page": "/dashboard/campanhas/[id]", "/dashboard/analytics/page": "/dashboard/analytics", "/dashboard/campanhas/page": "/dashboard/campanhas", "/dashboard/campanhas/nova/page": "/dashboard/campanhas/nova", "/dashboard/agendamentos/page": "/dashboard/agendamentos", "/dashboard/configuracao/page": "/dashboard/configuracao", "/dashboard/contatos/page": "/dashboard/contatos", "/dashboard/configuracoes/page": "/dashboard/configuracoes", "/dashboard/conversas/page": "/dashboard/conversas", "/dashboard/crm/pipeline/page": "/dashboard/crm/pipeline", "/dashboard/crm/page": "/dashboard/crm", "/dashboard/dentistas/[id]/page": "/dashboard/dentistas/[id]", "/dashboard/dentistas/page": "/dashboard/dentistas", "/dashboard/dentistas/novo/page": "/dashboard/dentistas/novo", "/dashboard/leads/[id]/page": "/dashboard/leads/[id]", "/dashboard/leads/novo/page": "/dashboard/leads/novo", "/dashboard/leads/page": "/dashboard/leads", "/dashboard/lista-espera/page": "/dashboard/lista-espera", "/dashboard/pacientes/[id]/editar/page": "/dashboard/pacientes/[id]/editar", "/dashboard/pacientes/[id]/page": "/dashboard/pacientes/[id]", "/dashboard/pacientes/inativos/page": "/dashboard/pacientes/inativos", "/dashboard/pacientes/novo/page": "/dashboard/pacientes/novo", "/dashboard/pacientes/page": "/dashboard/pacientes", "/dashboard/page": "/dashboard", "/dashboard/pipeline/page": "/dashboard/pipeline", "/dashboard/procedimentos/[id]/page": "/dashboard/procedimentos/[id]", "/dashboard/procedimentos/page": "/dashboard/procedimentos", "/dashboard/procedimentos/novo/page": "/dashboard/procedimentos/novo", "/dashboard/tarefas/page": "/dashboard/tarefas", "/dashboard/configuracoes/acessos/page": "/dashboard/configuracoes/acessos", "/dashboard/configuracoes/acessos/perfis/page": "/dashboard/configuracoes/acessos/perfis" };
var FunctionsConfigManifest = { "version": 1, "functions": {} };
var PagesManifest = { "/_app": "pages/_app.js", "/_error": "pages/_error.js", "/_document": "pages/_document.js", "/404": "pages/404.html" };
process.env.NEXT_BUILD_ID = BuildId;
process.env.OPEN_NEXT_BUILD_ID = NextConfig.deploymentId ?? BuildId;
process.env.NEXT_PREVIEW_MODE_ID = PrerenderManifest?.preview?.previewModeId;

// node_modules/@opennextjs/aws/dist/http/openNextResponse.js
init_logger();
init_util();
import { Transform } from "node:stream";

// node_modules/@opennextjs/aws/dist/core/routing/util.js
init_util();
init_logger();
import { ReadableStream as ReadableStream2 } from "node:stream/web";

// node_modules/@opennextjs/aws/dist/utils/binary.js
var commonBinaryMimeTypes = /* @__PURE__ */ new Set([
  "application/octet-stream",
  // Docs
  "application/epub+zip",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.amazon.ebook",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Fonts
  "font/otf",
  "font/woff",
  "font/woff2",
  // Images
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/vnd.microsoft.icon",
  "image/webp",
  // Audio
  "audio/3gpp",
  "audio/aac",
  "audio/basic",
  "audio/flac",
  "audio/mpeg",
  "audio/ogg",
  "audio/wavaudio/webm",
  "audio/x-aiff",
  "audio/x-midi",
  "audio/x-wav",
  // Video
  "video/3gpp",
  "video/mp2t",
  "video/mpeg",
  "video/ogg",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  // Archives
  "application/java-archive",
  "application/vnd.apple.installer+xml",
  "application/x-7z-compressed",
  "application/x-apple-diskimage",
  "application/x-bzip",
  "application/x-bzip2",
  "application/x-gzip",
  "application/x-java-archive",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/x-zip",
  "application/zip",
  // Serialized data
  "application/x-protobuf"
]);
function isBinaryContentType(contentType) {
  if (!contentType)
    return false;
  const value = contentType.split(";")[0];
  return commonBinaryMimeTypes.has(value);
}

// node_modules/@opennextjs/aws/dist/core/routing/i18n/index.js
init_stream();
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/i18n/accept-header.js
function parse(raw, preferences, options) {
  const lowers = /* @__PURE__ */ new Map();
  const header = raw.replace(/[ \t]/g, "");
  if (preferences) {
    let pos = 0;
    for (const preference of preferences) {
      const lower = preference.toLowerCase();
      lowers.set(lower, { orig: preference, pos: pos++ });
      if (options.prefixMatch) {
        const parts2 = lower.split("-");
        while (parts2.pop(), parts2.length > 0) {
          const joined = parts2.join("-");
          if (!lowers.has(joined)) {
            lowers.set(joined, { orig: preference, pos: pos++ });
          }
        }
      }
    }
  }
  const parts = header.split(",");
  const selections = [];
  const map = /* @__PURE__ */ new Set();
  for (let i = 0; i < parts.length; ++i) {
    const part = parts[i];
    if (!part) {
      continue;
    }
    const params = part.split(";");
    if (params.length > 2) {
      throw new Error(`Invalid ${options.type} header`);
    }
    const token = params[0].toLowerCase();
    if (!token) {
      throw new Error(`Invalid ${options.type} header`);
    }
    const selection = { token, pos: i, q: 1 };
    if (preferences && lowers.has(token)) {
      selection.pref = lowers.get(token).pos;
    }
    map.add(selection.token);
    if (params.length === 2) {
      const q = params[1];
      const [key, value] = q.split("=");
      if (!value || key !== "q" && key !== "Q") {
        throw new Error(`Invalid ${options.type} header`);
      }
      const score = Number.parseFloat(value);
      if (score === 0) {
        continue;
      }
      if (Number.isFinite(score) && score <= 1 && score >= 1e-3) {
        selection.q = score;
      }
    }
    selections.push(selection);
  }
  selections.sort((a, b) => {
    if (b.q !== a.q) {
      return b.q - a.q;
    }
    if (b.pref !== a.pref) {
      if (a.pref === void 0) {
        return 1;
      }
      if (b.pref === void 0) {
        return -1;
      }
      return a.pref - b.pref;
    }
    return a.pos - b.pos;
  });
  const values = selections.map((selection) => selection.token);
  if (!preferences || !preferences.length) {
    return values;
  }
  const preferred = [];
  for (const selection of values) {
    if (selection === "*") {
      for (const [preference, value] of lowers) {
        if (!map.has(preference)) {
          preferred.push(value.orig);
        }
      }
    } else {
      const lower = selection.toLowerCase();
      if (lowers.has(lower)) {
        preferred.push(lowers.get(lower).orig);
      }
    }
  }
  return preferred;
}
function acceptLanguage(header = "", preferences) {
  return parse(header, preferences, {
    type: "accept-language",
    prefixMatch: true
  })[0] || void 0;
}

// node_modules/@opennextjs/aws/dist/core/routing/i18n/index.js
function isLocalizedPath(path3) {
  return NextConfig.i18n?.locales.includes(path3.split("/")[1].toLowerCase()) ?? false;
}
function getLocaleFromCookie(cookies) {
  const i18n = NextConfig.i18n;
  const nextLocale = cookies.NEXT_LOCALE?.toLowerCase();
  return nextLocale ? i18n?.locales.find((locale) => nextLocale === locale.toLowerCase()) : void 0;
}
function detectDomainLocale({ hostname, detectedLocale }) {
  const i18n = NextConfig.i18n;
  const domains = i18n?.domains;
  if (!domains) {
    return;
  }
  const lowercasedLocale = detectedLocale?.toLowerCase();
  for (const domain of domains) {
    const domainHostname = domain.domain.split(":", 1)[0].toLowerCase();
    if (hostname === domainHostname || lowercasedLocale === domain.defaultLocale.toLowerCase() || domain.locales?.some((locale) => lowercasedLocale === locale.toLowerCase())) {
      return domain;
    }
  }
}
function detectLocale(internalEvent, i18n) {
  const domainLocale = detectDomainLocale({
    hostname: internalEvent.headers.host
  });
  if (i18n.localeDetection === false) {
    return domainLocale?.defaultLocale ?? i18n.defaultLocale;
  }
  const cookiesLocale = getLocaleFromCookie(internalEvent.cookies);
  const preferredLocale = acceptLanguage(internalEvent.headers["accept-language"], i18n?.locales);
  debug({
    cookiesLocale,
    preferredLocale,
    defaultLocale: i18n.defaultLocale,
    domainLocale
  });
  return domainLocale?.defaultLocale ?? cookiesLocale ?? preferredLocale ?? i18n.defaultLocale;
}
function localizePath(internalEvent) {
  const i18n = NextConfig.i18n;
  if (!i18n) {
    return internalEvent.rawPath;
  }
  if (isLocalizedPath(internalEvent.rawPath)) {
    return internalEvent.rawPath;
  }
  const detectedLocale = detectLocale(internalEvent, i18n);
  return `/${detectedLocale}${internalEvent.rawPath}`;
}
function handleLocaleRedirect(internalEvent) {
  const i18n = NextConfig.i18n;
  if (!i18n || i18n.localeDetection === false || internalEvent.rawPath !== "/") {
    return false;
  }
  const preferredLocale = acceptLanguage(internalEvent.headers["accept-language"], i18n?.locales);
  const detectedLocale = detectLocale(internalEvent, i18n);
  const domainLocale = detectDomainLocale({
    hostname: internalEvent.headers.host
  });
  const preferredDomain = detectDomainLocale({
    detectedLocale: preferredLocale
  });
  if (domainLocale && preferredDomain) {
    const isPDomain = preferredDomain.domain === domainLocale.domain;
    const isPLocale = preferredDomain.defaultLocale === preferredLocale;
    if (!isPDomain || !isPLocale) {
      const scheme = `http${preferredDomain.http ? "" : "s"}`;
      const rlocale = isPLocale ? "" : preferredLocale;
      return {
        type: "core",
        statusCode: 307,
        headers: {
          Location: `${scheme}://${preferredDomain.domain}/${rlocale}`
        },
        body: emptyReadableStream(),
        isBase64Encoded: false
      };
    }
  }
  const defaultLocale = domainLocale?.defaultLocale ?? i18n.defaultLocale;
  if (detectedLocale.toLowerCase() !== defaultLocale.toLowerCase()) {
    const nextUrl = constructNextUrl(internalEvent.url, `/${detectedLocale}${NextConfig.trailingSlash ? "/" : ""}`);
    const queryString = convertToQueryString(internalEvent.query);
    return {
      type: "core",
      statusCode: 307,
      headers: {
        Location: `${nextUrl}${queryString}`
      },
      body: emptyReadableStream(),
      isBase64Encoded: false
    };
  }
  return false;
}

// node_modules/@opennextjs/aws/dist/core/routing/queue.js
function generateShardId(rawPath, maxConcurrency, prefix) {
  let a = cyrb128(rawPath);
  let t = a += 1831565813;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  const randomFloat = ((t ^ t >>> 14) >>> 0) / 4294967296;
  const randomInt = Math.floor(randomFloat * maxConcurrency);
  return `${prefix}-${randomInt}`;
}
function generateMessageGroupId(rawPath) {
  const maxConcurrency = Number.parseInt(process.env.MAX_REVALIDATE_CONCURRENCY ?? "10");
  return generateShardId(rawPath, maxConcurrency, "revalidate");
}
function cyrb128(str) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ h1 >>> 18, 597399067);
  h2 = Math.imul(h4 ^ h2 >>> 22, 2869860233);
  h3 = Math.imul(h1 ^ h3 >>> 17, 951274213);
  h4 = Math.imul(h2 ^ h4 >>> 19, 2716044179);
  h1 ^= h2 ^ h3 ^ h4, h2 ^= h1, h3 ^= h1, h4 ^= h1;
  return h1 >>> 0;
}

// node_modules/@opennextjs/aws/dist/core/routing/util.js
function isExternal(url, host) {
  if (!url)
    return false;
  const pattern = /^https?:\/\//;
  if (!pattern.test(url))
    return false;
  if (host) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.host !== host;
    } catch {
      return !url.includes(host);
    }
  }
  return true;
}
function convertFromQueryString(query) {
  if (query === "")
    return {};
  const queryParts = query.split("&");
  return getQueryFromIterator(queryParts.map((p) => {
    const [key, value] = p.split("=");
    return [key, value];
  }));
}
function getUrlParts(url, isExternal2) {
  if (!isExternal2) {
    const regex2 = /\/([^?]*)\??(.*)/;
    const match3 = url.match(regex2);
    return {
      hostname: "",
      pathname: match3?.[1] ? `/${match3[1]}` : url,
      protocol: "",
      queryString: match3?.[2] ?? ""
    };
  }
  const regex = /^(https?:)\/\/?([^\/\s]+)(\/[^?]*)?(\?.*)?/;
  const match2 = url.match(regex);
  if (!match2) {
    throw new Error(`Invalid external URL: ${url}`);
  }
  return {
    protocol: match2[1] ?? "https:",
    hostname: match2[2],
    pathname: match2[3] ?? "",
    queryString: match2[4]?.slice(1) ?? ""
  };
}
function constructNextUrl(baseUrl, path3) {
  const nextBasePath = NextConfig.basePath ?? "";
  const url = new URL(`${nextBasePath}${path3}`, baseUrl);
  return url.href;
}
function convertToQueryString(query) {
  const queryStrings = [];
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => queryStrings.push(`${key}=${entry}`));
    } else {
      queryStrings.push(`${key}=${value}`);
    }
  });
  return queryStrings.length > 0 ? `?${queryStrings.join("&")}` : "";
}
function getMiddlewareMatch(middlewareManifest2, functionsManifest) {
  if (functionsManifest?.functions?.["/_middleware"]) {
    return functionsManifest.functions["/_middleware"].matchers?.map(({ regexp }) => new RegExp(regexp)) ?? [/.*/];
  }
  const rootMiddleware = middlewareManifest2.middleware["/"];
  if (!rootMiddleware?.matchers)
    return [];
  return rootMiddleware.matchers.map(({ regexp }) => new RegExp(regexp));
}
function escapeRegex(str, { isPath } = {}) {
  const result = str.replaceAll("(.)", "_\xB51_").replaceAll("(..)", "_\xB52_").replaceAll("(...)", "_\xB53_");
  return isPath ? result : result.replaceAll("+", "_\xB54_");
}
function unescapeRegex(str) {
  return str.replaceAll("_\xB51_", "(.)").replaceAll("_\xB52_", "(..)").replaceAll("_\xB53_", "(...)").replaceAll("_\xB54_", "+");
}
function convertBodyToReadableStream(method, body) {
  if (method === "GET" || method === "HEAD")
    return void 0;
  if (!body)
    return void 0;
  return new ReadableStream2({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    }
  });
}
var CommonHeaders;
(function(CommonHeaders2) {
  CommonHeaders2["CACHE_CONTROL"] = "cache-control";
  CommonHeaders2["NEXT_CACHE"] = "x-nextjs-cache";
})(CommonHeaders || (CommonHeaders = {}));
function normalizeLocationHeader(location, baseUrl, encodeQuery = false) {
  if (!URL.canParse(location)) {
    return location;
  }
  const locationURL = new URL(location);
  const origin = new URL(baseUrl).origin;
  let search = locationURL.search;
  if (encodeQuery && search) {
    search = `?${stringifyQs(parseQs(search.slice(1)))}`;
  }
  const href = `${locationURL.origin}${locationURL.pathname}${search}${locationURL.hash}`;
  if (locationURL.origin === origin) {
    return href.slice(origin.length);
  }
  return href;
}

// node_modules/@opennextjs/aws/dist/core/routingHandler.js
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/cacheInterceptor.js
import { createHash } from "node:crypto";
init_stream();

// node_modules/@opennextjs/aws/dist/utils/cache.js
init_logger();

// node_modules/@opennextjs/aws/dist/utils/semver.js
function compareSemver(v1, operator, v2) {
  let versionDiff = 0;
  if (v1 === "latest") {
    versionDiff = 1;
  } else {
    if (/^[^\d]/.test(v1)) {
      v1 = v1.substring(1);
    }
    if (/^[^\d]/.test(v2)) {
      v2 = v2.substring(1);
    }
    const [major1, minor1 = 0, patch1 = 0] = v1.split(".").map(Number);
    const [major2, minor2 = 0, patch2 = 0] = v2.split(".").map(Number);
    if (Number.isNaN(major1) || Number.isNaN(major2)) {
      throw new Error("The major version is required.");
    }
    if (major1 !== major2) {
      versionDiff = major1 - major2;
    } else if (minor1 !== minor2) {
      versionDiff = minor1 - minor2;
    } else if (patch1 !== patch2) {
      versionDiff = patch1 - patch2;
    }
  }
  switch (operator) {
    case "=":
      return versionDiff === 0;
    case ">=":
      return versionDiff >= 0;
    case "<=":
      return versionDiff <= 0;
    case ">":
      return versionDiff > 0;
    case "<":
      return versionDiff < 0;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

// node_modules/@opennextjs/aws/dist/utils/cache.js
async function isStale(key, tags, lastModified) {
  if (!compareSemver(globalThis.nextVersion, ">=", "16.0.0")) {
    return false;
  }
  if (globalThis.openNextConfig.dangerous?.disableTagCache) {
    return false;
  }
  if (globalThis.tagCache.mode === "nextMode") {
    return tags.length === 0 ? false : await globalThis.tagCache.isStale?.(tags, lastModified) ?? false;
  }
  return await globalThis.tagCache.isStale?.(key, lastModified) ?? false;
}
async function hasBeenRevalidated(key, tags, cacheEntry) {
  if (globalThis.openNextConfig.dangerous?.disableTagCache) {
    return false;
  }
  const value = cacheEntry.value;
  if (!value) {
    return true;
  }
  if ("type" in cacheEntry && cacheEntry.type === "page") {
    return false;
  }
  const lastModified = cacheEntry.lastModified ?? Date.now();
  if (globalThis.tagCache.mode === "nextMode") {
    return tags.length === 0 ? false : await globalThis.tagCache.hasBeenRevalidated(tags, lastModified);
  }
  const _lastModified = await globalThis.tagCache.getLastModified(key, lastModified);
  return _lastModified === -1;
}
function getTagsFromValue(value) {
  if (!value) {
    return [];
  }
  try {
    const cacheTags = value.meta?.headers?.["x-next-cache-tags"]?.split(",") ?? [];
    delete value.meta?.headers?.["x-next-cache-tags"];
    return cacheTags;
  } catch (e) {
    return [];
  }
}

// node_modules/@opennextjs/aws/dist/core/routing/cacheInterceptor.js
init_logger();
var CACHE_ONE_YEAR = 60 * 60 * 24 * 365;
var CACHE_ONE_MONTH = 60 * 60 * 24 * 30;
var VARY_HEADER = "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url";
var NEXT_SEGMENT_PREFETCH_HEADER = "next-router-segment-prefetch";
var NEXT_PRERENDER_HEADER = "x-nextjs-prerender";
var NEXT_POSTPONED_HEADER = "x-nextjs-postponed";
async function computeCacheControl(path3, body, host, revalidate, lastModified, isStaleFromTagCache = false) {
  let finalRevalidate = CACHE_ONE_YEAR;
  const existingRoute = Object.entries(PrerenderManifest?.routes ?? {}).find((p) => p[0] === path3)?.[1];
  if (revalidate === void 0 && existingRoute) {
    finalRevalidate = existingRoute.initialRevalidateSeconds === false ? CACHE_ONE_YEAR : existingRoute.initialRevalidateSeconds;
  } else if (revalidate !== void 0) {
    finalRevalidate = revalidate === false ? CACHE_ONE_YEAR : revalidate;
  }
  const age = Math.round((Date.now() - (lastModified ?? 0)) / 1e3);
  const hash = (str) => createHash("md5").update(str).digest("hex");
  const etag = hash(body);
  if (revalidate === 0) {
    return {
      "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "x-opennext-cache": "ERROR",
      etag
    };
  }
  const isSSG = finalRevalidate === CACHE_ONE_YEAR;
  const remainingTtl = Math.max(finalRevalidate - age, 1);
  const isStaleFromTime = !isSSG && remainingTtl === 1;
  const isStale2 = isStaleFromTime || isStaleFromTagCache;
  if (!isSSG || isStaleFromTagCache) {
    const sMaxAge = isStaleFromTagCache ? 1 : remainingTtl;
    debug("sMaxAge", {
      finalRevalidate,
      age,
      lastModified,
      revalidate,
      isStaleFromTagCache
    });
    if (isStale2) {
      let url = NextConfig.trailingSlash ? `${path3}/` : path3;
      if (NextConfig.basePath) {
        url = `${NextConfig.basePath}${url}`;
      }
      await globalThis.queue.send({
        MessageBody: {
          host,
          url,
          eTag: etag,
          lastModified: lastModified ?? Date.now()
        },
        MessageDeduplicationId: hash(`${path3}-${lastModified}-${etag}`),
        MessageGroupId: generateMessageGroupId(path3)
      });
    }
    return {
      "cache-control": `s-maxage=${sMaxAge}, stale-while-revalidate=${CACHE_ONE_MONTH}`,
      "x-opennext-cache": isStale2 ? "STALE" : "HIT",
      etag
    };
  }
  return {
    "cache-control": `s-maxage=${CACHE_ONE_YEAR}, stale-while-revalidate=${CACHE_ONE_MONTH}`,
    "x-opennext-cache": "HIT",
    etag
  };
}
function getBodyForAppRouter(event, cachedValue) {
  if (cachedValue.type !== "app") {
    throw new Error("getBodyForAppRouter called with non-app cache value");
  }
  try {
    const segmentHeader = `${event.headers[NEXT_SEGMENT_PREFETCH_HEADER]}`;
    const isSegmentResponse = Boolean(segmentHeader) && segmentHeader in (cachedValue.segmentData || {}) && !NextConfig.experimental?.prefetchInlining;
    const body = isSegmentResponse ? cachedValue.segmentData[segmentHeader] : cachedValue.rsc;
    return {
      body,
      additionalHeaders: isSegmentResponse ? { [NEXT_PRERENDER_HEADER]: "1", [NEXT_POSTPONED_HEADER]: "2" } : {}
    };
  } catch (e) {
    error("Error while getting body for app router from cache:", e);
    return { body: cachedValue.rsc, additionalHeaders: {} };
  }
}
async function generateResult(event, localizedPath, cachedValue, lastModified, isStaleFromTagCache = false) {
  debug("Returning result from experimental cache");
  let body = "";
  let type = "application/octet-stream";
  let isDataRequest = false;
  let additionalHeaders = {};
  if (cachedValue.type === "app") {
    isDataRequest = event.headers.rsc === "1";
    if (isDataRequest) {
      const { body: appRouterBody, additionalHeaders: appHeaders } = getBodyForAppRouter(event, cachedValue);
      body = appRouterBody;
      additionalHeaders = appHeaders;
    } else {
      body = cachedValue.html;
    }
    type = isDataRequest ? "text/x-component" : "text/html; charset=utf-8";
  } else if (cachedValue.type === "page") {
    isDataRequest = Boolean(event.query.__nextDataReq);
    body = isDataRequest ? JSON.stringify(cachedValue.json) : cachedValue.html;
    type = isDataRequest ? "application/json" : "text/html; charset=utf-8";
  } else {
    throw new Error("generateResult called with unsupported cache value type, only 'app' and 'page' are supported");
  }
  const cacheControl = await computeCacheControl(localizedPath, body, event.headers.host, cachedValue.revalidate, lastModified, isStaleFromTagCache);
  return {
    type: "core",
    // Sometimes other status codes can be cached, like 404. For these cases, we should return the correct status code
    // Also set the status code to the rewriteStatusCode if defined
    // This can happen in handleMiddleware in routingHandler.
    // `NextResponse.rewrite(url, { status: xxx})
    // The rewrite status code should take precedence over the cached one
    statusCode: event.rewriteStatusCode ?? cachedValue.meta?.status ?? 200,
    body: toReadableStream(body, false),
    isBase64Encoded: false,
    headers: {
      ...cacheControl,
      "content-type": type,
      ...cachedValue.meta?.headers,
      vary: VARY_HEADER,
      ...additionalHeaders
    }
  };
}
function escapePathDelimiters(segment, escapeEncoded) {
  return segment.replace(new RegExp(`([/#?]${escapeEncoded ? "|%(2f|23|3f|5c)" : ""})`, "gi"), (char) => encodeURIComponent(char));
}
function decodePathParams(pathname) {
  return pathname.split("/").map((segment) => {
    try {
      return escapePathDelimiters(decodeURIComponent(segment), true);
    } catch (e) {
      return segment;
    }
  }).join("/");
}
async function cacheInterceptor(event) {
  if (Boolean(event.headers["next-action"]) || Boolean(event.headers["x-prerender-revalidate"]))
    return event;
  const cookies = event.headers.cookie || "";
  const hasPreviewData = cookies.includes("__prerender_bypass") || cookies.includes("__next_preview_data");
  if (hasPreviewData) {
    debug("Preview mode detected, passing through to handler");
    return event;
  }
  let localizedPath = localizePath(event);
  if (NextConfig.basePath) {
    localizedPath = localizedPath.replace(NextConfig.basePath, "");
  }
  localizedPath = localizedPath.replace(/\/$/, "");
  localizedPath = decodePathParams(localizedPath);
  debug("Checking cache for", localizedPath, PrerenderManifest);
  const isISR = Object.keys(PrerenderManifest?.routes ?? {}).includes(localizedPath ?? "/") || Object.values(PrerenderManifest?.dynamicRoutes ?? {}).some((dr) => new RegExp(dr.routeRegex).test(localizedPath));
  debug("isISR", isISR);
  if (isISR) {
    try {
      const cachedData = await globalThis.incrementalCache.get(localizedPath ?? "/index");
      debug("cached data in interceptor", cachedData);
      if (!cachedData?.value) {
        return event;
      }
      const tags = getTagsFromValue(cachedData.value);
      if (cachedData.value?.type === "app" || cachedData.value?.type === "route") {
        const _hasBeenRevalidated = cachedData.shouldBypassTagCache ? false : await hasBeenRevalidated(localizedPath, tags, cachedData);
        if (_hasBeenRevalidated) {
          return event;
        }
      }
      const _isStale = cachedData.shouldBypassTagCache ? false : await isStale(localizedPath, tags, cachedData.lastModified ?? Date.now());
      const host = event.headers.host;
      switch (cachedData?.value?.type) {
        case "app":
        case "page":
          return generateResult(event, localizedPath, cachedData.value, cachedData.lastModified, _isStale);
        case "redirect": {
          const cacheControl = await computeCacheControl(localizedPath, "", host, cachedData.value.revalidate, cachedData.lastModified, _isStale);
          return {
            type: "core",
            statusCode: cachedData.value.meta?.status ?? 307,
            body: emptyReadableStream(),
            headers: {
              ...cachedData.value.meta?.headers ?? {},
              ...cacheControl
            },
            isBase64Encoded: false
          };
        }
        case "route": {
          const cacheControl = await computeCacheControl(localizedPath, cachedData.value.body, host, cachedData.value.revalidate, cachedData.lastModified, _isStale);
          const isBinary = isBinaryContentType(String(cachedData.value.meta?.headers?.["content-type"]));
          return {
            type: "core",
            statusCode: event.rewriteStatusCode ?? cachedData.value.meta?.status ?? 200,
            body: toReadableStream(cachedData.value.body, isBinary),
            headers: {
              ...cacheControl,
              ...cachedData.value.meta?.headers,
              vary: VARY_HEADER
            },
            isBase64Encoded: isBinary
          };
        }
        default:
          return event;
      }
    } catch (e) {
      debug("Error while fetching cache", e);
      return event;
    }
  }
  return event;
}

// node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
function parse2(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path3 = "";
  var tryConsume = function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  };
  var mustConsume = function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  };
  var consumeText = function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  };
  var isSafe = function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  };
  var safePattern = function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  };
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path3 += prefix;
        prefix = "";
      }
      if (path3) {
        result.push(path3);
        path3 = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path3 += value;
      continue;
    }
    if (path3) {
      result.push(path3);
      path3 = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
function compile(str, options) {
  return tokensToFunction(parse2(str, options), options);
}
function tokensToFunction(tokens, options) {
  if (options === void 0) {
    options = {};
  }
  var reFlags = flags(options);
  var _a = options.encode, encode = _a === void 0 ? function(x) {
    return x;
  } : _a, _b = options.validate, validate = _b === void 0 ? true : _b;
  var matches = tokens.map(function(token) {
    if (typeof token === "object") {
      return new RegExp("^(?:".concat(token.pattern, ")$"), reFlags);
    }
  });
  return function(data) {
    var path3 = "";
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (typeof token === "string") {
        path3 += token;
        continue;
      }
      var value = data ? data[token.name] : void 0;
      var optional = token.modifier === "?" || token.modifier === "*";
      var repeat = token.modifier === "*" || token.modifier === "+";
      if (Array.isArray(value)) {
        if (!repeat) {
          throw new TypeError('Expected "'.concat(token.name, '" to not repeat, but got an array'));
        }
        if (value.length === 0) {
          if (optional)
            continue;
          throw new TypeError('Expected "'.concat(token.name, '" to not be empty'));
        }
        for (var j = 0; j < value.length; j++) {
          var segment = encode(value[j], token);
          if (validate && !matches[i].test(segment)) {
            throw new TypeError('Expected all "'.concat(token.name, '" to match "').concat(token.pattern, '", but got "').concat(segment, '"'));
          }
          path3 += token.prefix + segment + token.suffix;
        }
        continue;
      }
      if (typeof value === "string" || typeof value === "number") {
        var segment = encode(String(value), token);
        if (validate && !matches[i].test(segment)) {
          throw new TypeError('Expected "'.concat(token.name, '" to match "').concat(token.pattern, '", but got "').concat(segment, '"'));
        }
        path3 += token.prefix + segment + token.suffix;
        continue;
      }
      if (optional)
        continue;
      var typeOfMessage = repeat ? "an array" : "a string";
      throw new TypeError('Expected "'.concat(token.name, '" to be ').concat(typeOfMessage));
    }
    return path3;
  };
}
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path3 = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    };
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path: path3, index, params };
  };
}
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
function regexpToRegexp(path3, keys) {
  if (!keys)
    return path3;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path3.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path3.source);
  }
  return path3;
}
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path3) {
    return pathToRegexp(path3, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
function stringToRegexp(path3, keys, options) {
  return tokensToRegexp(parse2(path3, options), keys, options);
}
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
function pathToRegexp(path3, keys, options) {
  if (path3 instanceof RegExp)
    return regexpToRegexp(path3, keys);
  if (Array.isArray(path3))
    return arrayToRegexp(path3, keys, options);
  return stringToRegexp(path3, keys, options);
}

// node_modules/@opennextjs/aws/dist/utils/normalize-path.js
import path2 from "node:path";
function normalizeRepeatedSlashes(url) {
  const urlNoQuery = url.host + url.pathname;
  return `${url.protocol}//${urlNoQuery.replace(/\\/g, "/").replace(/\/\/+/g, "/")}${url.search}`;
}

// node_modules/@opennextjs/aws/dist/core/routing/matcher.js
init_stream();
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/routeMatcher.js
var optionalLocalePrefixRegex = `^/(?:${RoutesManifest.locales.map((locale) => `${locale}/?`).join("|")})?`;
var optionalBasepathPrefixRegex = RoutesManifest.basePath ? `^${RoutesManifest.basePath}/?` : "^/";
var optionalPrefix = optionalLocalePrefixRegex.replace("^/", optionalBasepathPrefixRegex);
function routeMatcher(routeDefinitions) {
  const regexp = routeDefinitions.map((route) => ({
    page: route.page,
    regexp: new RegExp(route.regex.replace("^/", optionalPrefix))
  }));
  const appPathsSet = /* @__PURE__ */ new Set();
  const routePathsSet = /* @__PURE__ */ new Set();
  for (const [k, v] of Object.entries(AppPathRoutesManifest)) {
    if (k.endsWith("page")) {
      appPathsSet.add(v);
    } else if (k.endsWith("route")) {
      routePathsSet.add(v);
    }
  }
  return function matchRoute(path3) {
    const foundRoutes = regexp.filter((route) => route.regexp.test(path3));
    return foundRoutes.map((foundRoute) => {
      let routeType = "page";
      if (appPathsSet.has(foundRoute.page)) {
        routeType = "app";
      } else if (routePathsSet.has(foundRoute.page)) {
        routeType = "route";
      }
      return {
        route: foundRoute.page,
        type: routeType
      };
    });
  };
}
var staticRouteMatcher = routeMatcher([
  ...RoutesManifest.routes.static,
  ...getStaticAPIRoutes()
]);
var dynamicRouteMatcher = routeMatcher(RoutesManifest.routes.dynamic);
function getStaticAPIRoutes() {
  const createRouteDefinition = (route) => ({
    page: route,
    regex: `^${route}(?:/)?$`
  });
  const dynamicRoutePages = new Set(RoutesManifest.routes.dynamic.map(({ page }) => page));
  const pagesStaticAPIRoutes = Object.keys(PagesManifest).filter((route) => route.startsWith("/api/") && !dynamicRoutePages.has(route)).map(createRouteDefinition);
  const appPathsStaticAPIRoutes = Object.values(AppPathRoutesManifest).filter((route) => (route.startsWith("/api/") || route === "/api") && !dynamicRoutePages.has(route)).map(createRouteDefinition);
  return [...pagesStaticAPIRoutes, ...appPathsStaticAPIRoutes];
}

// node_modules/@opennextjs/aws/dist/core/routing/matcher.js
var routeHasMatcher = (headers, cookies, query) => (redirect) => {
  switch (redirect.type) {
    case "header":
      return !!headers?.[redirect.key.toLowerCase()] && new RegExp(redirect.value ?? "").test(headers[redirect.key.toLowerCase()] ?? "");
    case "cookie":
      return !!cookies?.[redirect.key] && new RegExp(redirect.value ?? "").test(cookies[redirect.key] ?? "");
    case "query":
      return query[redirect.key] && Array.isArray(redirect.value) ? redirect.value.reduce((prev, current) => prev || new RegExp(current).test(query[redirect.key]), false) : new RegExp(redirect.value ?? "").test(query[redirect.key] ?? "");
    case "host":
      return headers?.host !== "" && new RegExp(redirect.value ?? "").test(headers.host);
    default:
      return false;
  }
};
function checkHas(matcher, has, inverted = false) {
  return has ? has.reduce((acc, cur) => {
    if (acc === false)
      return false;
    return inverted ? !matcher(cur) : matcher(cur);
  }, true) : true;
}
var getParamsFromSource = (source) => (value) => {
  debug("value", value);
  const _match = source(value);
  return _match ? _match.params : {};
};
var computeParamHas = (headers, cookies, query) => (has) => {
  if (!has.value)
    return {};
  const matcher = new RegExp(`^${has.value}$`);
  const fromSource = (value) => {
    const matches = value.match(matcher);
    return matches?.groups ?? {};
  };
  switch (has.type) {
    case "header":
      return fromSource(headers[has.key.toLowerCase()] ?? "");
    case "cookie":
      return fromSource(cookies[has.key] ?? "");
    case "query":
      return Array.isArray(query[has.key]) ? fromSource(query[has.key].join(",")) : fromSource(query[has.key] ?? "");
    case "host":
      return fromSource(headers.host ?? "");
  }
};
function convertMatch(match2, toDestination, destination) {
  if (!match2) {
    return destination;
  }
  const { params } = match2;
  const isUsingParams = Object.keys(params).length > 0;
  return isUsingParams ? toDestination(params) : destination;
}
function getNextConfigHeaders(event, configHeaders) {
  if (!configHeaders) {
    return {};
  }
  const matcher = routeHasMatcher(event.headers, event.cookies, event.query);
  const requestHeaders = {};
  const localizedRawPath = localizePath(event);
  for (const { headers, has, missing, regex, source, locale } of configHeaders) {
    const path3 = locale === false ? event.rawPath : localizedRawPath;
    if (new RegExp(regex).test(path3) && checkHas(matcher, has) && checkHas(matcher, missing, true)) {
      const fromSource = match(source);
      const _match = fromSource(path3);
      headers.forEach((h) => {
        try {
          const key = convertMatch(_match, compile(h.key), h.key);
          const value = convertMatch(_match, compile(h.value), h.value);
          requestHeaders[key] = value;
        } catch {
          debug(`Error matching header ${h.key} with value ${h.value}`);
          requestHeaders[h.key] = h.value;
        }
      });
    }
  }
  return requestHeaders;
}
function handleRewrites(event, rewrites) {
  const { rawPath, headers, query, cookies, url } = event;
  const localizedRawPath = localizePath(event);
  const matcher = routeHasMatcher(headers, cookies, query);
  const computeHas = computeParamHas(headers, cookies, query);
  const rewrite = rewrites.find((route) => {
    const path3 = route.locale === false ? rawPath : localizedRawPath;
    return new RegExp(route.regex).test(path3) && checkHas(matcher, route.has) && checkHas(matcher, route.missing, true);
  });
  let finalQuery = query;
  let rewrittenUrl = url;
  const isExternalRewrite = isExternal(rewrite?.destination);
  debug("isExternalRewrite", isExternalRewrite);
  if (rewrite) {
    const { pathname, protocol, hostname, queryString } = getUrlParts(rewrite.destination, isExternalRewrite);
    const pathToUse = rewrite.locale === false ? rawPath : localizedRawPath;
    debug("urlParts", { pathname, protocol, hostname, queryString });
    const toDestinationPath = compile(escapeRegex(pathname, { isPath: true }));
    const toDestinationHost = compile(escapeRegex(hostname));
    const toDestinationQuery = compile(escapeRegex(queryString));
    const params = {
      // params for the source
      ...getParamsFromSource(match(escapeRegex(rewrite.source, { isPath: true })))(pathToUse),
      // params for the has
      ...rewrite.has?.reduce((acc, cur) => {
        return Object.assign(acc, computeHas(cur));
      }, {}),
      // params for the missing
      ...rewrite.missing?.reduce((acc, cur) => {
        return Object.assign(acc, computeHas(cur));
      }, {})
    };
    const isUsingParams = Object.keys(params).length > 0;
    let rewrittenQuery = queryString;
    let rewrittenHost = hostname;
    let rewrittenPath = pathname;
    if (isUsingParams) {
      rewrittenPath = unescapeRegex(toDestinationPath(params));
      rewrittenHost = unescapeRegex(toDestinationHost(params));
      rewrittenQuery = unescapeRegex(toDestinationQuery(params));
    }
    if (NextConfig.i18n && !isExternalRewrite) {
      const strippedPathLocale = rewrittenPath.replace(new RegExp(`^/(${NextConfig.i18n.locales.join("|")})`), "");
      if (strippedPathLocale.startsWith("/api/")) {
        rewrittenPath = strippedPathLocale;
      }
    }
    rewrittenUrl = isExternalRewrite ? `${protocol}//${rewrittenHost}${rewrittenPath}` : new URL(rewrittenPath, event.url).href;
    finalQuery = {
      ...query,
      ...convertFromQueryString(rewrittenQuery)
    };
    rewrittenUrl += convertToQueryString(finalQuery);
    debug("rewrittenUrl", { rewrittenUrl, finalQuery, isUsingParams });
  }
  return {
    internalEvent: {
      ...event,
      query: finalQuery,
      rawPath: new URL(rewrittenUrl).pathname,
      url: rewrittenUrl
    },
    __rewrite: rewrite,
    isExternalRewrite
  };
}
function handleRepeatedSlashRedirect(event) {
  if (event.rawPath.match(/(\\|\/\/)/)) {
    return {
      type: event.type,
      statusCode: 308,
      headers: {
        Location: normalizeRepeatedSlashes(new URL(event.url))
      },
      body: emptyReadableStream(),
      isBase64Encoded: false
    };
  }
  return false;
}
function handleTrailingSlashRedirect(event) {
  const url = new URL(event.rawPath, "http://localhost");
  if (
    // Someone is trying to redirect to a different origin, let's not do that
    url.host !== "localhost" || NextConfig.skipTrailingSlashRedirect || // We should not apply trailing slash redirect to API routes
    event.rawPath.startsWith("/api/")
  ) {
    return false;
  }
  const emptyBody = emptyReadableStream();
  if (NextConfig.trailingSlash && !(event.query.__nextDataReq === "1") && !event.rawPath.endsWith("/") && !event.rawPath.match(/[\w-]+\.[\w]+$/g)) {
    const headersLocation = event.url.split("?");
    return {
      type: event.type,
      statusCode: 308,
      headers: {
        Location: `${headersLocation[0]}/${headersLocation[1] ? `?${headersLocation[1]}` : ""}`
      },
      body: emptyBody,
      isBase64Encoded: false
    };
  }
  if (!NextConfig.trailingSlash && event.rawPath.endsWith("/") && event.rawPath !== "/") {
    const headersLocation = event.url.split("?");
    return {
      type: event.type,
      statusCode: 308,
      headers: {
        Location: `${headersLocation[0].replace(/\/$/, "")}${headersLocation[1] ? `?${headersLocation[1]}` : ""}`
      },
      body: emptyBody,
      isBase64Encoded: false
    };
  }
  return false;
}
function handleRedirects(event, redirects) {
  const repeatedSlashRedirect = handleRepeatedSlashRedirect(event);
  if (repeatedSlashRedirect)
    return repeatedSlashRedirect;
  const trailingSlashRedirect = handleTrailingSlashRedirect(event);
  if (trailingSlashRedirect)
    return trailingSlashRedirect;
  const localeRedirect = handleLocaleRedirect(event);
  if (localeRedirect)
    return localeRedirect;
  const { internalEvent, __rewrite } = handleRewrites(event, redirects.filter((r) => !r.internal));
  if (__rewrite && !__rewrite.internal) {
    return {
      type: event.type,
      statusCode: __rewrite.statusCode ?? 308,
      headers: {
        Location: internalEvent.url
      },
      body: emptyReadableStream(),
      isBase64Encoded: false
    };
  }
}
function fixDataPage(internalEvent, buildId) {
  const { rawPath, query } = internalEvent;
  const basePath = NextConfig.basePath ?? "";
  const dataPattern = `${basePath}/_next/data/${buildId}`;
  if (rawPath.startsWith("/_next/data") && !rawPath.startsWith(dataPattern)) {
    return {
      type: internalEvent.type,
      statusCode: 404,
      body: toReadableStream("{}"),
      headers: {
        "Content-Type": "application/json"
      },
      isBase64Encoded: false
    };
  }
  if (rawPath.startsWith(dataPattern) && rawPath.endsWith(".json")) {
    const newPath = `${basePath}${rawPath.slice(dataPattern.length, -".json".length).replace(/^\/index$/, "/")}`;
    query.__nextDataReq = "1";
    return {
      ...internalEvent,
      rawPath: newPath,
      query,
      url: new URL(`${newPath}${convertToQueryString(query)}`, internalEvent.url).href
    };
  }
  return internalEvent;
}
function handleFallbackFalse(internalEvent, prerenderManifest) {
  const { rawPath } = internalEvent;
  const { dynamicRoutes = {}, routes = {} } = prerenderManifest ?? {};
  const prerenderedFallbackRoutes = Object.entries(dynamicRoutes).filter(([, { fallback }]) => fallback === false);
  const routeFallback = prerenderedFallbackRoutes.some(([, { routeRegex }]) => {
    const routeRegexExp = new RegExp(routeRegex);
    return routeRegexExp.test(rawPath);
  });
  const locales = NextConfig.i18n?.locales;
  const routesAlreadyHaveLocale = locales?.includes(rawPath.split("/")[1]) || // If we don't use locales, we don't need to add the default locale
  locales === void 0;
  let localizedPath = routesAlreadyHaveLocale ? rawPath : `/${NextConfig.i18n?.defaultLocale}${rawPath}`;
  if (
    // Not if localizedPath is "/" tho, because that would not make it find `isPregenerated` below since it would be try to match an empty string.
    localizedPath !== "/" && NextConfig.trailingSlash && localizedPath.endsWith("/")
  ) {
    localizedPath = localizedPath.slice(0, -1);
  }
  const matchedStaticRoute = staticRouteMatcher(localizedPath);
  const prerenderedFallbackRoutesName = prerenderedFallbackRoutes.map(([name]) => name);
  const matchedDynamicRoute = dynamicRouteMatcher(localizedPath).filter(({ route }) => !prerenderedFallbackRoutesName.includes(route));
  const isPregenerated = Object.keys(routes).includes(localizedPath);
  if (routeFallback && !isPregenerated && matchedStaticRoute.length === 0 && matchedDynamicRoute.length === 0) {
    return {
      event: {
        ...internalEvent,
        rawPath: "/404",
        url: constructNextUrl(internalEvent.url, "/404"),
        headers: {
          ...internalEvent.headers,
          "x-invoke-status": "404"
        }
      },
      isISR: false
    };
  }
  return {
    event: internalEvent,
    isISR: routeFallback || isPregenerated
  };
}

// node_modules/@opennextjs/aws/dist/core/routing/middleware.js
init_stream();
init_utils();
var middlewareManifest = MiddlewareManifest;
var functionsConfigManifest = FunctionsConfigManifest;
var middleMatch = getMiddlewareMatch(middlewareManifest, functionsConfigManifest);
var REDIRECTS = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function defaultMiddlewareLoader() {
  return Promise.resolve().then(() => (init_edgeFunctionHandler(), edgeFunctionHandler_exports));
}
async function handleMiddleware(internalEvent, initialSearch, middlewareLoader = defaultMiddlewareLoader) {
  const headers = internalEvent.headers;
  if (headers["x-isr"] && headers["x-prerender-revalidate"] === PrerenderManifest?.preview?.previewModeId)
    return internalEvent;
  const normalizedPath = localizePath(internalEvent);
  const hasMatch = middleMatch.some((r) => r.test(normalizedPath));
  if (!hasMatch)
    return internalEvent;
  const initialUrl = new URL(normalizedPath, internalEvent.url);
  initialUrl.search = initialSearch;
  const url = initialUrl.href;
  const middleware = await middlewareLoader();
  const result = await middleware.default({
    // `geo` is pre Next 15.
    geo: {
      // The city name is percent-encoded.
      // See https://github.com/vercel/vercel/blob/4cb6143/packages/functions/src/headers.ts#L94C19-L94C37
      city: decodeURIComponent(headers["x-open-next-city"]),
      country: headers["x-open-next-country"],
      region: headers["x-open-next-region"],
      latitude: headers["x-open-next-latitude"],
      longitude: headers["x-open-next-longitude"]
    },
    headers,
    method: internalEvent.method || "GET",
    nextConfig: {
      basePath: NextConfig.basePath,
      i18n: NextConfig.i18n,
      trailingSlash: NextConfig.trailingSlash
    },
    url,
    body: convertBodyToReadableStream(internalEvent.method, internalEvent.body)
  });
  const statusCode = result.status;
  const responseHeaders = result.headers;
  const reqHeaders = {};
  const resHeaders = {};
  const filteredHeaders = [
    "x-middleware-override-headers",
    "x-middleware-next",
    "x-middleware-rewrite",
    // We need to drop `content-encoding` because it will be decoded
    "content-encoding"
  ];
  const xMiddlewareKey = "x-middleware-request-";
  responseHeaders.forEach((value, key) => {
    if (key.startsWith(xMiddlewareKey)) {
      const k = key.substring(xMiddlewareKey.length);
      reqHeaders[k] = value;
    } else {
      if (filteredHeaders.includes(key.toLowerCase()))
        return;
      if (key.toLowerCase() === "set-cookie") {
        resHeaders[key] = resHeaders[key] ? [...resHeaders[key], value] : [value];
      } else if (REDIRECTS.has(statusCode) && key.toLowerCase() === "location") {
        resHeaders[key] = normalizeLocationHeader(value, internalEvent.url);
      } else {
        resHeaders[key] = value;
      }
    }
  });
  const rewriteUrl = responseHeaders.get("x-middleware-rewrite");
  let isExternalRewrite = false;
  let middlewareQuery = internalEvent.query;
  let newUrl = internalEvent.url;
  if (rewriteUrl) {
    newUrl = rewriteUrl;
    if (isExternal(newUrl, internalEvent.headers.host)) {
      isExternalRewrite = true;
    } else {
      const rewriteUrlObject = new URL(rewriteUrl);
      middlewareQuery = getQueryFromSearchParams(rewriteUrlObject.searchParams);
      if ("__nextDataReq" in internalEvent.query) {
        middlewareQuery.__nextDataReq = internalEvent.query.__nextDataReq;
      }
    }
  }
  if (!rewriteUrl && !responseHeaders.get("x-middleware-next")) {
    const body = result.body ?? emptyReadableStream();
    return {
      type: internalEvent.type,
      statusCode,
      headers: resHeaders,
      body,
      isBase64Encoded: false
    };
  }
  return {
    responseHeaders: resHeaders,
    url: newUrl,
    rawPath: new URL(newUrl).pathname,
    type: internalEvent.type,
    headers: { ...internalEvent.headers, ...reqHeaders },
    body: internalEvent.body,
    method: internalEvent.method,
    query: middlewareQuery,
    cookies: internalEvent.cookies,
    remoteAddress: internalEvent.remoteAddress,
    isExternalRewrite,
    rewriteStatusCode: rewriteUrl && !isExternalRewrite ? statusCode : void 0
  };
}

// node_modules/@opennextjs/aws/dist/core/routingHandler.js
var MIDDLEWARE_HEADER_PREFIX = "x-middleware-response-";
var MIDDLEWARE_HEADER_PREFIX_LEN = MIDDLEWARE_HEADER_PREFIX.length;
var INTERNAL_HEADER_PREFIX = "x-opennext-";
var INTERNAL_HEADER_INITIAL_URL = `${INTERNAL_HEADER_PREFIX}initial-url`;
var INTERNAL_HEADER_LOCALE = `${INTERNAL_HEADER_PREFIX}locale`;
var INTERNAL_HEADER_RESOLVED_ROUTES = `${INTERNAL_HEADER_PREFIX}resolved-routes`;
var INTERNAL_HEADER_REWRITE_STATUS_CODE = `${INTERNAL_HEADER_PREFIX}rewrite-status-code`;
var INTERNAL_EVENT_REQUEST_ID = `${INTERNAL_HEADER_PREFIX}request-id`;
var geoHeaderToNextHeader = {
  "x-open-next-city": "x-vercel-ip-city",
  "x-open-next-country": "x-vercel-ip-country",
  "x-open-next-region": "x-vercel-ip-country-region",
  "x-open-next-latitude": "x-vercel-ip-latitude",
  "x-open-next-longitude": "x-vercel-ip-longitude"
};
var NEXT_INTERNAL_HEADERS = [
  "x-middleware-rewrite",
  "x-middleware-redirect",
  "x-middleware-set-cookie",
  "x-middleware-skip",
  "x-middleware-override-headers",
  "x-middleware-next",
  "x-now-route-matches",
  "x-matched-path",
  "x-nextjs-data",
  "x-next-resume-state-length"
];
function applyMiddlewareHeaders(eventOrResult, middlewareHeaders) {
  const isResult = isInternalResult(eventOrResult);
  const headers = eventOrResult.headers;
  const keyPrefix = isResult ? "" : MIDDLEWARE_HEADER_PREFIX;
  Object.entries(middlewareHeaders).forEach(([key, value]) => {
    if (value) {
      headers[keyPrefix + key] = Array.isArray(value) ? value.join(",") : value;
    }
  });
}
async function routingHandler(event, { assetResolver }) {
  try {
    for (const [openNextGeoName, nextGeoName] of Object.entries(geoHeaderToNextHeader)) {
      const value = event.headers[openNextGeoName];
      if (value) {
        event.headers[nextGeoName] = value;
      }
    }
    for (const key of Object.keys(event.headers)) {
      const lowerCaseKey = key.toLowerCase();
      if (lowerCaseKey.startsWith(INTERNAL_HEADER_PREFIX) || lowerCaseKey.startsWith(MIDDLEWARE_HEADER_PREFIX) || NEXT_INTERNAL_HEADERS.includes(lowerCaseKey)) {
        delete event.headers[key];
      }
    }
    let headers = getNextConfigHeaders(event, ConfigHeaders);
    let eventOrResult = fixDataPage(event, BuildId);
    if (isInternalResult(eventOrResult)) {
      return eventOrResult;
    }
    const redirect = handleRedirects(eventOrResult, RoutesManifest.redirects);
    if (redirect) {
      redirect.headers.Location = normalizeLocationHeader(redirect.headers.Location, event.url, true);
      debug("redirect", redirect);
      return redirect;
    }
    const middlewareEventOrResult = await handleMiddleware(
      eventOrResult,
      // We need to pass the initial search without any decoding
      // TODO: we'd need to refactor InternalEvent to include the initial querystring directly
      // Should be done in another PR because it is a breaking change
      new URL(event.url).search
    );
    if (isInternalResult(middlewareEventOrResult)) {
      return middlewareEventOrResult;
    }
    const middlewareHeadersPrioritized = globalThis.openNextConfig.dangerous?.middlewareHeadersOverrideNextConfigHeaders ?? false;
    if (middlewareHeadersPrioritized) {
      headers = {
        ...headers,
        ...middlewareEventOrResult.responseHeaders
      };
    } else {
      headers = {
        ...middlewareEventOrResult.responseHeaders,
        ...headers
      };
    }
    let isExternalRewrite = middlewareEventOrResult.isExternalRewrite ?? false;
    eventOrResult = middlewareEventOrResult;
    if (!isExternalRewrite) {
      const beforeRewrite = handleRewrites(eventOrResult, RoutesManifest.rewrites.beforeFiles);
      eventOrResult = beforeRewrite.internalEvent;
      isExternalRewrite = beforeRewrite.isExternalRewrite;
      if (!isExternalRewrite) {
        const assetResult = await assetResolver?.maybeGetAssetResult?.(eventOrResult);
        if (assetResult) {
          applyMiddlewareHeaders(assetResult, headers);
          return assetResult;
        }
      }
    }
    const foundStaticRoute = staticRouteMatcher(eventOrResult.rawPath);
    const isStaticRoute = !isExternalRewrite && foundStaticRoute.length > 0;
    if (!(isStaticRoute || isExternalRewrite)) {
      const afterRewrite = handleRewrites(eventOrResult, RoutesManifest.rewrites.afterFiles);
      eventOrResult = afterRewrite.internalEvent;
      isExternalRewrite = afterRewrite.isExternalRewrite;
    }
    let isISR = false;
    if (!isExternalRewrite) {
      const fallbackResult = handleFallbackFalse(eventOrResult, PrerenderManifest);
      eventOrResult = fallbackResult.event;
      isISR = fallbackResult.isISR;
    }
    const foundDynamicRoute = dynamicRouteMatcher(eventOrResult.rawPath);
    const isDynamicRoute = !isExternalRewrite && foundDynamicRoute.length > 0;
    if (!(isDynamicRoute || isStaticRoute || isExternalRewrite)) {
      const fallbackRewrites = handleRewrites(eventOrResult, RoutesManifest.rewrites.fallback);
      eventOrResult = fallbackRewrites.internalEvent;
      isExternalRewrite = fallbackRewrites.isExternalRewrite;
    }
    const isNextImageRoute = eventOrResult.rawPath.startsWith("/_next/image");
    const isRouteFoundBeforeAllRewrites = isStaticRoute || isDynamicRoute || isExternalRewrite;
    if (!(isRouteFoundBeforeAllRewrites || isNextImageRoute || // We need to check again once all rewrites have been applied
    staticRouteMatcher(eventOrResult.rawPath).length > 0 || dynamicRouteMatcher(eventOrResult.rawPath).length > 0)) {
      eventOrResult = {
        ...eventOrResult,
        rawPath: "/404",
        url: constructNextUrl(eventOrResult.url, "/404"),
        headers: {
          ...eventOrResult.headers,
          "x-middleware-response-cache-control": "private, no-cache, no-store, max-age=0, must-revalidate"
        }
      };
    }
    if (globalThis.openNextConfig.dangerous?.enableCacheInterception && !isInternalResult(eventOrResult)) {
      debug("Cache interception enabled");
      eventOrResult = await cacheInterceptor(eventOrResult);
      if (isInternalResult(eventOrResult)) {
        applyMiddlewareHeaders(eventOrResult, headers);
        return eventOrResult;
      }
    }
    applyMiddlewareHeaders(eventOrResult, headers);
    const resolvedRoutes = [
      ...foundStaticRoute,
      ...foundDynamicRoute
    ];
    debug("resolvedRoutes", resolvedRoutes);
    return {
      internalEvent: eventOrResult,
      isExternalRewrite,
      origin: false,
      isISR,
      resolvedRoutes,
      initialURL: event.url,
      locale: NextConfig.i18n ? detectLocale(eventOrResult, NextConfig.i18n) : void 0,
      rewriteStatusCode: middlewareEventOrResult.rewriteStatusCode
    };
  } catch (e) {
    error("Error in routingHandler", e);
    return {
      internalEvent: {
        type: "core",
        method: "GET",
        rawPath: "/500",
        url: constructNextUrl(event.url, "/500"),
        headers: {
          ...event.headers
        },
        query: event.query,
        cookies: event.cookies,
        remoteAddress: event.remoteAddress
      },
      isExternalRewrite: false,
      origin: false,
      isISR: false,
      resolvedRoutes: [],
      initialURL: event.url,
      locale: NextConfig.i18n ? detectLocale(event, NextConfig.i18n) : void 0
    };
  }
}
function isInternalResult(eventOrResult) {
  return eventOrResult != null && "statusCode" in eventOrResult;
}

// node_modules/@opennextjs/aws/dist/adapters/middleware.js
globalThis.internalFetch = fetch;
globalThis.__openNextAls = new AsyncLocalStorage();
var defaultHandler = async (internalEvent, options) => {
  const middlewareConfig = globalThis.openNextConfig.middleware;
  const originResolver = await resolveOriginResolver(middlewareConfig?.originResolver);
  const externalRequestProxy = await resolveProxyRequest(middlewareConfig?.override?.proxyExternalRequest);
  const assetResolver = await resolveAssetResolver(middlewareConfig?.assetResolver);
  const requestId = Math.random().toString(36);
  return runWithOpenNextRequestContext({
    isISRRevalidation: internalEvent.headers["x-isr"] === "1",
    waitUntil: options?.waitUntil,
    requestId
  }, async () => {
    const result = await routingHandler(internalEvent, { assetResolver });
    if ("internalEvent" in result) {
      debug("Middleware intercepted event", internalEvent);
      if (!result.isExternalRewrite) {
        const origin = await originResolver.resolve(result.internalEvent.rawPath);
        return {
          type: "middleware",
          internalEvent: {
            ...result.internalEvent,
            headers: {
              ...result.internalEvent.headers,
              [INTERNAL_HEADER_INITIAL_URL]: internalEvent.url,
              [INTERNAL_HEADER_RESOLVED_ROUTES]: JSON.stringify(result.resolvedRoutes),
              [INTERNAL_EVENT_REQUEST_ID]: requestId,
              [INTERNAL_HEADER_REWRITE_STATUS_CODE]: String(result.rewriteStatusCode)
            }
          },
          isExternalRewrite: result.isExternalRewrite,
          origin,
          isISR: result.isISR,
          initialURL: result.initialURL,
          resolvedRoutes: result.resolvedRoutes
        };
      }
      try {
        return externalRequestProxy.proxy(result.internalEvent);
      } catch (e) {
        error("External request failed.", e);
        return {
          type: "middleware",
          internalEvent: {
            ...result.internalEvent,
            headers: {
              ...result.internalEvent.headers,
              [INTERNAL_EVENT_REQUEST_ID]: requestId
            },
            rawPath: "/500",
            url: constructNextUrl(result.internalEvent.url, "/500"),
            method: "GET"
          },
          // On error we need to rewrite to the 500 page which is an internal rewrite
          isExternalRewrite: false,
          origin: false,
          isISR: result.isISR,
          initialURL: result.internalEvent.url,
          resolvedRoutes: [{ route: "/500", type: "page" }]
        };
      }
    }
    if (process.env.OPEN_NEXT_REQUEST_ID_HEADER || globalThis.openNextDebug) {
      result.headers[INTERNAL_EVENT_REQUEST_ID] = requestId;
    }
    debug("Middleware response", result);
    return result;
  });
};
var handler2 = await createGenericHandler({
  handler: defaultHandler,
  type: "middleware"
});
var middleware_default = {
  fetch: handler2
};
export {
  middleware_default as default,
  handler2 as handler
};
