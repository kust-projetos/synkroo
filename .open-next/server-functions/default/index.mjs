globalThis.monorepoPackagePath = "";globalThis.openNextDebug = false;globalThis.openNextVersion = "4.0.2";globalThis.nextVersion = "15.5.19";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod3) => function __require2() {
  return mod3 || (0, cb[__getOwnPropNames(cb)[0]])((mod3 = { exports: {} }).exports, mod3), mod3.exports;
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
var __reExport = (target, mod3, secondTarget) => (__copyProps(target, mod3, "default"), secondTarget && __copyProps(secondTarget, mod3, "default"));
var __toESM = (mod3, isNodeMode, target) => (target = mod3 != null ? __create(__getProtoOf(mod3)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod3 || !mod3.__esModule ? __defProp(target, "default", { value: mod3, enumerable: true }) : target,
  mod3
));
var __toCommonJS = (mod3) => __copyProps(__defProp({}, "__esModule", { value: true }), mod3);

// node_modules/@opennextjs/aws/dist/utils/error.js
function isOpenNextError(e) {
  try {
    return "__openNextInternal" in e;
  } catch {
    return false;
  }
}
var IgnorableError;
var init_error = __esm({
  "node_modules/@opennextjs/aws/dist/utils/error.js"() {
    IgnorableError = class extends Error {
      __openNextInternal = true;
      canIgnore = true;
      logLevel = 0;
      constructor(message) {
        super(message);
        this.name = "IgnorableError";
      }
    };
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
var parseHeaders, convertHeader;
var init_util = __esm({
  "node_modules/@opennextjs/aws/dist/http/util.js"() {
    init_logger();
    parseHeaders = (headers) => {
      const result = {};
      if (!headers) {
        return result;
      }
      for (const [key, value] of Object.entries(headers)) {
        if (value === void 0) {
          continue;
        }
        const keyLower = key.toLowerCase();
        if (keyLower === "location" && Array.isArray(value)) {
          if (value.length === 1 || value[0] === value[1]) {
            result[keyLower] = value[0];
          } else {
            warn("Multiple different values for Location header found. Using the last one");
            result[keyLower] = value[value.length - 1];
          }
          continue;
        }
        result[keyLower] = convertHeader(value);
      }
      return result;
    };
    convertHeader = (header) => {
      if (typeof header === "string") {
        return header;
      }
      if (Array.isArray(header)) {
        return header.join(",");
      }
      return String(header);
    };
  }
});

// node_modules/@opennextjs/aws/dist/adapters/config/index.js
var config_exports = {};
__export(config_exports, {
  AppPathRoutesManifest: () => AppPathRoutesManifest,
  AppPathsManifest: () => AppPathsManifest,
  AppPathsManifestKeys: () => AppPathsManifestKeys,
  BuildId: () => BuildId,
  ConfigHeaders: () => ConfigHeaders,
  FunctionsConfigManifest: () => FunctionsConfigManifest,
  HtmlPages: () => HtmlPages,
  MiddlewareManifest: () => MiddlewareManifest,
  NEXT_DIR: () => NEXT_DIR,
  NextConfig: () => NextConfig,
  OPEN_NEXT_DIR: () => OPEN_NEXT_DIR,
  PagesManifest: () => PagesManifest,
  PrerenderManifest: () => PrerenderManifest,
  RoutesManifest: () => RoutesManifest
});
import path from "node:path";
var NEXT_DIR, OPEN_NEXT_DIR, NextConfig, BuildId, HtmlPages, RoutesManifest, ConfigHeaders, PrerenderManifest, AppPathsManifestKeys, MiddlewareManifest, AppPathsManifest, AppPathRoutesManifest, FunctionsConfigManifest, PagesManifest;
var init_config = __esm({
  "node_modules/@opennextjs/aws/dist/adapters/config/index.js"() {
    init_logger();
    globalThis.__dirname ??= "";
    NEXT_DIR = path.join(__dirname, ".next");
    OPEN_NEXT_DIR = path.join(__dirname, ".open-next");
    debug({ NEXT_DIR, OPEN_NEXT_DIR });
    NextConfig = { "env": { "NEXT_PUBLIC_APP_URL": "http://localhost:3000" }, "eslint": { "ignoreDuringBuilds": false }, "typescript": { "ignoreBuildErrors": false, "tsconfigPath": "tsconfig.json" }, "typedRoutes": false, "distDir": ".next", "cleanDistDir": true, "assetPrefix": "", "cacheMaxMemorySize": 52428800, "configOrigin": "next.config.ts", "useFileSystemPublicRoutes": true, "generateEtags": true, "pageExtensions": ["tsx", "ts", "jsx", "js"], "poweredByHeader": true, "compress": true, "images": { "deviceSizes": [640, 750, 828, 1080, 1200, 1920, 2048, 3840], "imageSizes": [16, 32, 48, 64, 96, 128, 256, 384], "path": "/_next/image", "loader": "default", "loaderFile": "", "domains": [], "disableStaticImages": false, "minimumCacheTTL": 60, "formats": ["image/webp"], "maximumResponseBody": 5e7, "dangerouslyAllowSVG": false, "contentSecurityPolicy": "script-src 'none'; frame-src 'none'; sandbox;", "contentDispositionType": "attachment", "remotePatterns": [], "unoptimized": false }, "devIndicators": { "position": "bottom-left" }, "onDemandEntries": { "maxInactiveAge": 6e4, "pagesBufferLength": 5 }, "amp": { "canonicalBase": "" }, "basePath": "", "sassOptions": {}, "trailingSlash": false, "i18n": null, "productionBrowserSourceMaps": false, "excludeDefaultMomentLocales": true, "serverRuntimeConfig": {}, "publicRuntimeConfig": {}, "reactProductionProfiling": false, "reactStrictMode": null, "reactMaxHeadersLength": 6e3, "httpAgentOptions": { "keepAlive": true }, "logging": {}, "compiler": {}, "expireTime": 31536e3, "staticPageGenerationTimeout": 60, "output": "standalone", "modularizeImports": { "@mui/icons-material": { "transform": "@mui/icons-material/{{member}}" }, "lodash": { "transform": "lodash/{{member}}" } }, "outputFileTracingRoot": "D:\\projetos\\synkroo", "experimental": { "useSkewCookie": false, "cacheLife": { "default": { "stale": 300, "revalidate": 900, "expire": 4294967294 }, "seconds": { "stale": 30, "revalidate": 1, "expire": 60 }, "minutes": { "stale": 300, "revalidate": 60, "expire": 3600 }, "hours": { "stale": 300, "revalidate": 3600, "expire": 86400 }, "days": { "stale": 300, "revalidate": 86400, "expire": 604800 }, "weeks": { "stale": 300, "revalidate": 604800, "expire": 2592e3 }, "max": { "stale": 300, "revalidate": 2592e3, "expire": 4294967294 } }, "cacheHandlers": {}, "cssChunking": true, "multiZoneDraftMode": false, "appNavFailHandling": false, "prerenderEarlyExit": true, "serverMinification": true, "serverSourceMaps": false, "linkNoTouchStart": false, "caseSensitiveRoutes": false, "clientSegmentCache": false, "clientParamParsing": false, "dynamicOnHover": false, "preloadEntriesOnStart": true, "clientRouterFilter": true, "clientRouterFilterRedirects": false, "fetchCacheKeyPrefix": "", "middlewarePrefetch": "flexible", "optimisticClientCache": true, "manualClientBasePath": false, "cpus": 11, "memoryBasedWorkersCount": false, "imgOptConcurrency": null, "imgOptTimeoutInSeconds": 7, "imgOptMaxInputPixels": 268402689, "imgOptSequentialRead": null, "imgOptSkipMetadata": null, "isrFlushToDisk": true, "workerThreads": false, "optimizeCss": false, "nextScriptWorkers": false, "scrollRestoration": false, "externalDir": false, "disableOptimizedLoading": false, "gzipSize": true, "craCompat": false, "esmExternals": true, "fullySpecified": false, "swcTraceProfiling": false, "forceSwcTransforms": false, "largePageDataBytes": 128e3, "typedEnv": false, "parallelServerCompiles": false, "parallelServerBuildTraces": false, "ppr": false, "authInterrupts": false, "webpackMemoryOptimizations": false, "optimizeServerReact": true, "viewTransition": false, "routerBFCache": false, "removeUncaughtErrorAndRejectionListeners": false, "validateRSCRequestHeaders": false, "staleTimes": { "dynamic": 0, "static": 300 }, "serverComponentsHmrCache": true, "staticGenerationMaxConcurrency": 8, "staticGenerationMinPagesPerWorker": 25, "cacheComponents": false, "inlineCss": false, "useCache": false, "globalNotFound": false, "devtoolSegmentExplorer": true, "browserDebugInfoInTerminal": false, "optimizeRouterScrolling": false, "middlewareClientMaxBodySize": 10485760, "serverActions": { "bodySizeLimit": "2mb" }, "optimizePackageImports": ["lucide-react", "date-fns", "lodash-es", "ramda", "antd", "react-bootstrap", "ahooks", "@ant-design/icons", "@headlessui/react", "@headlessui-float/react", "@heroicons/react/20/solid", "@heroicons/react/24/solid", "@heroicons/react/24/outline", "@visx/visx", "@tremor/react", "rxjs", "@mui/material", "@mui/icons-material", "recharts", "react-use", "effect", "@effect/schema", "@effect/platform", "@effect/platform-node", "@effect/platform-browser", "@effect/platform-bun", "@effect/sql", "@effect/sql-mssql", "@effect/sql-mysql2", "@effect/sql-pg", "@effect/sql-sqlite-node", "@effect/sql-sqlite-bun", "@effect/sql-sqlite-wasm", "@effect/sql-sqlite-react-native", "@effect/rpc", "@effect/rpc-http", "@effect/typeclass", "@effect/experimental", "@effect/opentelemetry", "@material-ui/core", "@material-ui/icons", "@tabler/icons-react", "mui-core", "react-icons/ai", "react-icons/bi", "react-icons/bs", "react-icons/cg", "react-icons/ci", "react-icons/di", "react-icons/fa", "react-icons/fa6", "react-icons/fc", "react-icons/fi", "react-icons/gi", "react-icons/go", "react-icons/gr", "react-icons/hi", "react-icons/hi2", "react-icons/im", "react-icons/io", "react-icons/io5", "react-icons/lia", "react-icons/lib", "react-icons/lu", "react-icons/md", "react-icons/pi", "react-icons/ri", "react-icons/rx", "react-icons/si", "react-icons/sl", "react-icons/tb", "react-icons/tfi", "react-icons/ti", "react-icons/vsc", "react-icons/wi"], "trustHostHeader": false, "isExperimentalCompile": false }, "htmlLimitedBots": "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight", "bundlePagesRouterDependencies": false, "configFileName": "next.config.ts", "serverExternalPackages": ["playwright", "playwright-core", "chromium-bidi", "pg", "pg-connection-string", "pgpass"], "turbopack": { "root": "D:\\projetos\\synkroo" } };
    BuildId = "9h6AjpTXJudiitX9qb-DR";
    HtmlPages = ["/404"];
    RoutesManifest = { "basePath": "", "rewrites": { "beforeFiles": [], "afterFiles": [], "fallback": [] }, "redirects": [{ "source": "/:path+/", "destination": "/:path+", "internal": true, "statusCode": 308, "regex": "^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$" }], "routes": { "static": [{ "page": "/", "regex": "^/(?:/)?$", "routeKeys": {}, "namedRegex": "^/(?:/)?$" }, { "page": "/_not-found", "regex": "^/_not\\-found(?:/)?$", "routeKeys": {}, "namedRegex": "^/_not\\-found(?:/)?$" }, { "page": "/dashboard", "regex": "^/dashboard(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard(?:/)?$" }, { "page": "/dashboard/agendamentos", "regex": "^/dashboard/agendamentos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/agendamentos(?:/)?$" }, { "page": "/dashboard/agendamentos/novo", "regex": "^/dashboard/agendamentos/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/agendamentos/novo(?:/)?$" }, { "page": "/dashboard/analytics", "regex": "^/dashboard/analytics(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/analytics(?:/)?$" }, { "page": "/dashboard/atividades", "regex": "^/dashboard/atividades(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/atividades(?:/)?$" }, { "page": "/dashboard/campanhas", "regex": "^/dashboard/campanhas(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/campanhas(?:/)?$" }, { "page": "/dashboard/campanhas/nova", "regex": "^/dashboard/campanhas/nova(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/campanhas/nova(?:/)?$" }, { "page": "/dashboard/configuracao", "regex": "^/dashboard/configuracao(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/configuracao(?:/)?$" }, { "page": "/dashboard/configuracoes", "regex": "^/dashboard/configuracoes(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/configuracoes(?:/)?$" }, { "page": "/dashboard/configuracoes/acessos", "regex": "^/dashboard/configuracoes/acessos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/configuracoes/acessos(?:/)?$" }, { "page": "/dashboard/configuracoes/acessos/perfis", "regex": "^/dashboard/configuracoes/acessos/perfis(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/configuracoes/acessos/perfis(?:/)?$" }, { "page": "/dashboard/contatos", "regex": "^/dashboard/contatos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/contatos(?:/)?$" }, { "page": "/dashboard/conversas", "regex": "^/dashboard/conversas(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/conversas(?:/)?$" }, { "page": "/dashboard/crm", "regex": "^/dashboard/crm(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/crm(?:/)?$" }, { "page": "/dashboard/crm/pipeline", "regex": "^/dashboard/crm/pipeline(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/crm/pipeline(?:/)?$" }, { "page": "/dashboard/dentistas", "regex": "^/dashboard/dentistas(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/dentistas(?:/)?$" }, { "page": "/dashboard/dentistas/novo", "regex": "^/dashboard/dentistas/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/dentistas/novo(?:/)?$" }, { "page": "/dashboard/leads", "regex": "^/dashboard/leads(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/leads(?:/)?$" }, { "page": "/dashboard/leads/novo", "regex": "^/dashboard/leads/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/leads/novo(?:/)?$" }, { "page": "/dashboard/lista-espera", "regex": "^/dashboard/lista\\-espera(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/lista\\-espera(?:/)?$" }, { "page": "/dashboard/pacientes", "regex": "^/dashboard/pacientes(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/pacientes(?:/)?$" }, { "page": "/dashboard/pacientes/inativos", "regex": "^/dashboard/pacientes/inativos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/pacientes/inativos(?:/)?$" }, { "page": "/dashboard/pacientes/novo", "regex": "^/dashboard/pacientes/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/pacientes/novo(?:/)?$" }, { "page": "/dashboard/pipeline", "regex": "^/dashboard/pipeline(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/pipeline(?:/)?$" }, { "page": "/dashboard/procedimentos", "regex": "^/dashboard/procedimentos(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/procedimentos(?:/)?$" }, { "page": "/dashboard/procedimentos/novo", "regex": "^/dashboard/procedimentos/novo(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/procedimentos/novo(?:/)?$" }, { "page": "/dashboard/tarefas", "regex": "^/dashboard/tarefas(?:/)?$", "routeKeys": {}, "namedRegex": "^/dashboard/tarefas(?:/)?$" }, { "page": "/login", "regex": "^/login(?:/)?$", "routeKeys": {}, "namedRegex": "^/login(?:/)?$" }, { "page": "/signup", "regex": "^/signup(?:/)?$", "routeKeys": {}, "namedRegex": "^/signup(?:/)?$" }], "dynamic": [{ "page": "/api/appointments/[id]", "regex": "^/api/appointments/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/appointments/[id]/cancel", "regex": "^/api/appointments/([^/]+?)/cancel(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/cancel(?:/)?$" }, { "page": "/api/appointments/[id]/confirm", "regex": "^/api/appointments/([^/]+?)/confirm(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/confirm(?:/)?$" }, { "page": "/api/appointments/[id]/noshow", "regex": "^/api/appointments/([^/]+?)/noshow(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/noshow(?:/)?$" }, { "page": "/api/appointments/[id]/reactivate", "regex": "^/api/appointments/([^/]+?)/reactivate(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/reactivate(?:/)?$" }, { "page": "/api/appointments/[id]/remind", "regex": "^/api/appointments/([^/]+?)/remind(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/remind(?:/)?$" }, { "page": "/api/appointments/[id]/reminder-template", "regex": "^/api/appointments/([^/]+?)/reminder\\-template(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/reminder\\-template(?:/)?$" }, { "page": "/api/appointments/[id]/reschedule", "regex": "^/api/appointments/([^/]+?)/reschedule(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/appointments/(?<nxtPid>[^/]+?)/reschedule(?:/)?$" }, { "page": "/api/auth/[...nextauth]", "regex": "^/api/auth/(.+?)(?:/)?$", "routeKeys": { "nxtPnextauth": "nxtPnextauth" }, "namedRegex": "^/api/auth/(?<nxtPnextauth>.+?)(?:/)?$" }, { "page": "/api/budgets/[id]", "regex": "^/api/budgets/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/budgets/[id]/accept", "regex": "^/api/budgets/([^/]+?)/accept(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/accept(?:/)?$" }, { "page": "/api/budgets/[id]/installments", "regex": "^/api/budgets/([^/]+?)/installments(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/installments(?:/)?$" }, { "page": "/api/budgets/[id]/payments", "regex": "^/api/budgets/([^/]+?)/payments(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/payments(?:/)?$" }, { "page": "/api/budgets/[id]/reject", "regex": "^/api/budgets/([^/]+?)/reject(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/reject(?:/)?$" }, { "page": "/api/budgets/[id]/send", "regex": "^/api/budgets/([^/]+?)/send(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/budgets/(?<nxtPid>[^/]+?)/send(?:/)?$" }, { "page": "/api/campaigns/[id]", "regex": "^/api/campaigns/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/campaigns/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/campaigns/[id]/recipients", "regex": "^/api/campaigns/([^/]+?)/recipients(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/campaigns/(?<nxtPid>[^/]+?)/recipients(?:/)?$" }, { "page": "/api/campaigns/[id]/start", "regex": "^/api/campaigns/([^/]+?)/start(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/campaigns/(?<nxtPid>[^/]+?)/start(?:/)?$" }, { "page": "/api/contacts/[id]", "regex": "^/api/contacts/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/contacts/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/contacts/[id]/appointments", "regex": "^/api/contacts/([^/]+?)/appointments(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/contacts/(?<nxtPid>[^/]+?)/appointments(?:/)?$" }, { "page": "/api/contacts/[id]/notes", "regex": "^/api/contacts/([^/]+?)/notes(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/contacts/(?<nxtPid>[^/]+?)/notes(?:/)?$" }, { "page": "/api/contacts/[id]/timeline", "regex": "^/api/contacts/([^/]+?)/timeline(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/contacts/(?<nxtPid>[^/]+?)/timeline(?:/)?$" }, { "page": "/api/conversations/[id]", "regex": "^/api/conversations/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/conversations/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/custom-fields/definitions/[id]", "regex": "^/api/custom\\-fields/definitions/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/custom\\-fields/definitions/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/dentists/[id]", "regex": "^/api/dentists/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/dentists/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/knowledge/[id]", "regex": "^/api/knowledge/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/knowledge/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/leads/notifications/[id]/acknowledge", "regex": "^/api/leads/notifications/([^/]+?)/acknowledge(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/leads/notifications/(?<nxtPid>[^/]+?)/acknowledge(?:/)?$" }, { "page": "/api/leads/[id]", "regex": "^/api/leads/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/leads/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/leads/[id]/convert", "regex": "^/api/leads/([^/]+?)/convert(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/leads/(?<nxtPid>[^/]+?)/convert(?:/)?$" }, { "page": "/api/leads/[id]/stage", "regex": "^/api/leads/([^/]+?)/stage(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/leads/(?<nxtPid>[^/]+?)/stage(?:/)?$" }, { "page": "/api/messages/history/[conversationId]", "regex": "^/api/messages/history/([^/]+?)(?:/)?$", "routeKeys": { "nxtPconversationId": "nxtPconversationId" }, "namedRegex": "^/api/messages/history/(?<nxtPconversationId>[^/]+?)(?:/)?$" }, { "page": "/api/patients/[id]", "regex": "^/api/patients/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/patients/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/patients/[id]/history", "regex": "^/api/patients/([^/]+?)/history(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/patients/(?<nxtPid>[^/]+?)/history(?:/)?$" }, { "page": "/api/patients/[id]/observations", "regex": "^/api/patients/([^/]+?)/observations(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/patients/(?<nxtPid>[^/]+?)/observations(?:/)?$" }, { "page": "/api/patients/[id]/preferences", "regex": "^/api/patients/([^/]+?)/preferences(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/patients/(?<nxtPid>[^/]+?)/preferences(?:/)?$" }, { "page": "/api/pipeline/stages/[id]", "regex": "^/api/pipeline/stages/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/pipeline/stages/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/procedures/[id]", "regex": "^/api/procedures/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/procedures/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/treatment-plans/[id]", "regex": "^/api/treatment\\-plans/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/treatment\\-plans/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/treatment-plans/[id]/sessions", "regex": "^/api/treatment\\-plans/([^/]+?)/sessions(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/treatment\\-plans/(?<nxtPid>[^/]+?)/sessions(?:/)?$" }, { "page": "/dashboard/agendamentos/[id]", "regex": "^/dashboard/agendamentos/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/agendamentos/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/campanhas/[id]", "regex": "^/dashboard/campanhas/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/campanhas/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/dentistas/[id]", "regex": "^/dashboard/dentistas/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/dentistas/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/leads/[id]", "regex": "^/dashboard/leads/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/leads/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/pacientes/[id]", "regex": "^/dashboard/pacientes/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/pacientes/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/dashboard/pacientes/[id]/editar", "regex": "^/dashboard/pacientes/([^/]+?)/editar(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/pacientes/(?<nxtPid>[^/]+?)/editar(?:/)?$" }, { "page": "/dashboard/procedimentos/[id]", "regex": "^/dashboard/procedimentos/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/dashboard/procedimentos/(?<nxtPid>[^/]+?)(?:/)?$" }], "data": { "static": [], "dynamic": [] } }, "locales": [] };
    ConfigHeaders = [];
    PrerenderManifest = { "version": 4, "routes": { "/_not-found": { "initialStatus": 404, "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/_not-found", "dataRoute": "/_not-found.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/login": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/login", "dataRoute": "/login.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/", "dataRoute": "/index.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/signup": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/signup", "dataRoute": "/signup.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/agendamentos/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/agendamentos/novo", "dataRoute": "/dashboard/agendamentos/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/analytics": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/analytics", "dataRoute": "/dashboard/analytics.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/campanhas/nova": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/campanhas/nova", "dataRoute": "/dashboard/campanhas/nova.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/campanhas": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/campanhas", "dataRoute": "/dashboard/campanhas.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/configuracao": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/configuracao", "dataRoute": "/dashboard/configuracao.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/configuracoes": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/configuracoes", "dataRoute": "/dashboard/configuracoes.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/atividades": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/atividades", "dataRoute": "/dashboard/atividades.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/contatos": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/contatos", "dataRoute": "/dashboard/contatos.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/crm": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/crm", "dataRoute": "/dashboard/crm.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/conversas": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/conversas", "dataRoute": "/dashboard/conversas.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/agendamentos": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/agendamentos", "dataRoute": "/dashboard/agendamentos.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/crm/pipeline": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/crm/pipeline", "dataRoute": "/dashboard/crm/pipeline.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/dentistas/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/dentistas/novo", "dataRoute": "/dashboard/dentistas/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/dentistas": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/dentistas", "dataRoute": "/dashboard/dentistas.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/leads/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/leads/novo", "dataRoute": "/dashboard/leads/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/leads": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/leads", "dataRoute": "/dashboard/leads.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/lista-espera": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/lista-espera", "dataRoute": "/dashboard/lista-espera.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/pacientes/inativos": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/pacientes/inativos", "dataRoute": "/dashboard/pacientes/inativos.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/pacientes/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/pacientes/novo", "dataRoute": "/dashboard/pacientes/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/pacientes": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/pacientes", "dataRoute": "/dashboard/pacientes.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/pipeline": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/pipeline", "dataRoute": "/dashboard/pipeline.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard", "dataRoute": "/dashboard.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/procedimentos/novo": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/procedimentos/novo", "dataRoute": "/dashboard/procedimentos/novo.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/procedimentos": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/procedimentos", "dataRoute": "/dashboard/procedimentos.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] }, "/dashboard/tarefas": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/dashboard/tarefas", "dataRoute": "/dashboard/tarefas.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] } }, "dynamicRoutes": {}, "notFoundRoutes": [], "preview": { "previewModeId": "b1f1882484269d4581d7c06c1114d7d6", "previewModeSigningKey": "063a8c6cd273e5c44e6945504e964793b66077fcbb21823ca19f4e9a5605508a", "previewModeEncryptionKey": "f0afc0ef2a5814cb157b10e63dfcaeeb80aa69145e29cdf545e946234a8f8e85" } };
    AppPathsManifestKeys = ["/_not-found", "/api/activities/route", "/api/admin/run-migration/route", "/api/agent/classify/route", "/api/agent/messages/route", "/api/agent/schedule-flow/route", "/api/agent/decisions/route", "/api/agent/pending-actions/route", "/api/analytics/insights/route", "/api/analytics/metrics/route", "/api/analytics/noshow-prediction/route", "/api/appointments/[id]/cancel/route", "/api/analytics/roi/route", "/api/appointments/[id]/confirm/route", "/api/appointments/[id]/noshow/route", "/api/appointments/[id]/reactivate/route", "/api/appointments/[id]/remind/route", "/api/appointments/[id]/reminder-template/route", "/api/appointments/[id]/reschedule/route", "/api/appointments/[id]/route", "/api/appointments/availability/route", "/api/appointments/confirm-response/route", "/api/appointments/incomplete-treatments/route", "/api/appointments/route", "/api/auth/[...nextauth]/route", "/api/auth/login/route", "/api/auth/refresh/route", "/api/auth/logout/route", "/api/auth/signup/route", "/api/auth/session/route", "/api/budgets/[id]/accept/route", "/api/budgets/[id]/payments/route", "/api/budgets/[id]/installments/route", "/api/budgets/[id]/reject/route", "/api/budgets/[id]/route", "/api/budgets/followup/route", "/api/budgets/route", "/api/budgets/[id]/send/route", "/api/campaigns/[id]/recipients/route", "/api/campaigns/[id]/start/route", "/api/campaigns/[id]/route", "/api/campaigns/process/route", "/api/campaigns/route", "/api/campaigns/segments/preview/route", "/api/clinics/settings/route", "/api/campaigns/segments/route", "/api/consents/route", "/api/contacts/[id]/appointments/route", "/api/contacts/[id]/notes/route", "/api/contacts/[id]/route", "/api/contacts/[id]/timeline/route", "/api/contacts/route", "/api/conversations/route", "/api/conversations/[id]/route", "/api/crm/stats/route", "/api/cron/cleanup/route", "/api/cron/followups/route", "/api/cron/reminders/route", "/api/cron/smart-triggers/route", "/api/custom-fields/definitions/[id]/route", "/api/custom-fields/definitions/route", "/api/custom-fields/values/route", "/api/dashboard/alerts/route", "/api/dashboard/stats/route", "/api/dentists/[id]/route", "/api/dentists/route", "/api/health/db/route", "/api/health/route", "/api/instagram/webhook/route", "/api/knowledge/[id]/route", "/api/knowledge/categories/route", "/api/knowledge/route", "/api/knowledge/search/route", "/api/leads/[id]/convert/route", "/api/leads/[id]/route", "/api/leads/[id]/stage/route", "/api/leads/kanban/route", "/api/leads/hot/route", "/api/leads/notifications/[id]/acknowledge/route", "/api/leads/notifications/route", "/api/leads/route", "/api/leads/stats/route", "/api/lgpd/anonymize/route", "/api/lgpd/export/route", "/api/messages/history/[conversationId]/route", "/api/messages/inbound/route", "/api/messages/whatsapp/route", "/api/messages/send/route", "/api/patients/[id]/history/route", "/api/patients/[id]/observations/route", "/api/patients/[id]/preferences/route", "/api/patients/[id]/route", "/api/patients/deduplicate/route", "/api/patients/inactive/route", "/api/patients/route", "/api/patients/tags/route", "/api/pipeline/analytics/route", "/api/pipeline/stages/[id]/route", "/api/pipeline/stages/route", "/api/pipeline/stages/reorder/route", "/api/procedures/[id]/route", "/api/procedures/route", "/api/reminders/config/route", "/api/reports/export/route", "/api/reports/financial/route", "/api/reports/patients/route", "/api/scheduler/chat/route", "/api/tasks/route", "/api/seed/route", "/api/treatment-plans/[id]/route", "/api/treatment-plans/[id]/sessions/route", "/api/treatment-plans/route", "/api/waitlist/route", "/api/whatsapp/evolution/route", "/api/whatsapp/qrcode/route", "/api/whatsapp/send/route", "/api/whatsapp/templates/route", "/api/whatsapp/webhook/route", "/api/widget/messages/route", "/login", "/signup", "/", "/dashboard/agendamentos/[id]", "/dashboard/agendamentos/novo", "/dashboard/atividades", "/dashboard/campanhas/[id]", "/dashboard/analytics", "/dashboard/campanhas", "/dashboard/campanhas/nova", "/dashboard/agendamentos", "/dashboard/configuracao", "/dashboard/contatos", "/dashboard/configuracoes", "/dashboard/conversas", "/dashboard/crm/pipeline", "/dashboard/crm", "/dashboard/dentistas/[id]", "/dashboard/dentistas", "/dashboard/dentistas/novo", "/dashboard/leads/[id]", "/dashboard/leads/novo", "/dashboard/leads", "/dashboard/lista-espera", "/dashboard/pacientes/[id]/editar", "/dashboard/pacientes/[id]", "/dashboard/pacientes/inativos", "/dashboard/pacientes/novo", "/dashboard/pacientes", "/dashboard", "/dashboard/pipeline", "/dashboard/procedimentos/[id]", "/dashboard/procedimentos", "/dashboard/procedimentos/novo", "/dashboard/tarefas", "/dashboard/configuracoes/acessos", "/dashboard/configuracoes/acessos/perfis"];
    MiddlewareManifest = { "version": 3, "middleware": { "/": { "files": ["server/edge-instrumentation.js", "server/edge-runtime-webpack.js", "server/src/middleware.js"], "name": "src/middleware", "page": "/", "matchers": [{ "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!_next\\/static|_next\\/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*))(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$", "originalSource": "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)" }], "wasm": [], "assets": [], "env": { "__NEXT_BUILD_ID": "9h6AjpTXJudiitX9qb-DR", "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY": "5t/OcqTiFwBiDYwBK1Ulwswr6eqiF8G7SLa7IvJi5IY=", "__NEXT_PREVIEW_MODE_ID": "b1f1882484269d4581d7c06c1114d7d6", "__NEXT_PREVIEW_MODE_SIGNING_KEY": "063a8c6cd273e5c44e6945504e964793b66077fcbb21823ca19f4e9a5605508a", "__NEXT_PREVIEW_MODE_ENCRYPTION_KEY": "f0afc0ef2a5814cb157b10e63dfcaeeb80aa69145e29cdf545e946234a8f8e85" } } }, "functions": {}, "sortedMiddleware": ["/"] };
    AppPathsManifest = { "/_not-found/page": "app/_not-found/page.js", "/api/activities/route": "app/api/activities/route.js", "/api/admin/run-migration/route": "app/api/admin/run-migration/route.js", "/api/agent/classify/route": "app/api/agent/classify/route.js", "/api/agent/messages/route": "app/api/agent/messages/route.js", "/api/agent/schedule-flow/route": "app/api/agent/schedule-flow/route.js", "/api/agent/decisions/route": "app/api/agent/decisions/route.js", "/api/agent/pending-actions/route": "app/api/agent/pending-actions/route.js", "/api/analytics/insights/route": "app/api/analytics/insights/route.js", "/api/analytics/metrics/route": "app/api/analytics/metrics/route.js", "/api/analytics/noshow-prediction/route": "app/api/analytics/noshow-prediction/route.js", "/api/appointments/[id]/cancel/route": "app/api/appointments/[id]/cancel/route.js", "/api/analytics/roi/route": "app/api/analytics/roi/route.js", "/api/appointments/[id]/confirm/route": "app/api/appointments/[id]/confirm/route.js", "/api/appointments/[id]/noshow/route": "app/api/appointments/[id]/noshow/route.js", "/api/appointments/[id]/reactivate/route": "app/api/appointments/[id]/reactivate/route.js", "/api/appointments/[id]/remind/route": "app/api/appointments/[id]/remind/route.js", "/api/appointments/[id]/reminder-template/route": "app/api/appointments/[id]/reminder-template/route.js", "/api/appointments/[id]/reschedule/route": "app/api/appointments/[id]/reschedule/route.js", "/api/appointments/[id]/route": "app/api/appointments/[id]/route.js", "/api/appointments/availability/route": "app/api/appointments/availability/route.js", "/api/appointments/confirm-response/route": "app/api/appointments/confirm-response/route.js", "/api/appointments/incomplete-treatments/route": "app/api/appointments/incomplete-treatments/route.js", "/api/appointments/route": "app/api/appointments/route.js", "/api/auth/[...nextauth]/route": "app/api/auth/[...nextauth]/route.js", "/api/auth/login/route": "app/api/auth/login/route.js", "/api/auth/refresh/route": "app/api/auth/refresh/route.js", "/api/auth/logout/route": "app/api/auth/logout/route.js", "/api/auth/signup/route": "app/api/auth/signup/route.js", "/api/auth/session/route": "app/api/auth/session/route.js", "/api/budgets/[id]/accept/route": "app/api/budgets/[id]/accept/route.js", "/api/budgets/[id]/payments/route": "app/api/budgets/[id]/payments/route.js", "/api/budgets/[id]/installments/route": "app/api/budgets/[id]/installments/route.js", "/api/budgets/[id]/reject/route": "app/api/budgets/[id]/reject/route.js", "/api/budgets/[id]/route": "app/api/budgets/[id]/route.js", "/api/budgets/followup/route": "app/api/budgets/followup/route.js", "/api/budgets/route": "app/api/budgets/route.js", "/api/budgets/[id]/send/route": "app/api/budgets/[id]/send/route.js", "/api/campaigns/[id]/recipients/route": "app/api/campaigns/[id]/recipients/route.js", "/api/campaigns/[id]/start/route": "app/api/campaigns/[id]/start/route.js", "/api/campaigns/[id]/route": "app/api/campaigns/[id]/route.js", "/api/campaigns/process/route": "app/api/campaigns/process/route.js", "/api/campaigns/route": "app/api/campaigns/route.js", "/api/campaigns/segments/preview/route": "app/api/campaigns/segments/preview/route.js", "/api/clinics/settings/route": "app/api/clinics/settings/route.js", "/api/campaigns/segments/route": "app/api/campaigns/segments/route.js", "/api/consents/route": "app/api/consents/route.js", "/api/contacts/[id]/appointments/route": "app/api/contacts/[id]/appointments/route.js", "/api/contacts/[id]/notes/route": "app/api/contacts/[id]/notes/route.js", "/api/contacts/[id]/route": "app/api/contacts/[id]/route.js", "/api/contacts/[id]/timeline/route": "app/api/contacts/[id]/timeline/route.js", "/api/contacts/route": "app/api/contacts/route.js", "/api/conversations/route": "app/api/conversations/route.js", "/api/conversations/[id]/route": "app/api/conversations/[id]/route.js", "/api/crm/stats/route": "app/api/crm/stats/route.js", "/api/cron/cleanup/route": "app/api/cron/cleanup/route.js", "/api/cron/followups/route": "app/api/cron/followups/route.js", "/api/cron/reminders/route": "app/api/cron/reminders/route.js", "/api/cron/smart-triggers/route": "app/api/cron/smart-triggers/route.js", "/api/custom-fields/definitions/[id]/route": "app/api/custom-fields/definitions/[id]/route.js", "/api/custom-fields/definitions/route": "app/api/custom-fields/definitions/route.js", "/api/custom-fields/values/route": "app/api/custom-fields/values/route.js", "/api/dashboard/alerts/route": "app/api/dashboard/alerts/route.js", "/api/dashboard/stats/route": "app/api/dashboard/stats/route.js", "/api/dentists/[id]/route": "app/api/dentists/[id]/route.js", "/api/dentists/route": "app/api/dentists/route.js", "/api/health/db/route": "app/api/health/db/route.js", "/api/health/route": "app/api/health/route.js", "/api/instagram/webhook/route": "app/api/instagram/webhook/route.js", "/api/knowledge/[id]/route": "app/api/knowledge/[id]/route.js", "/api/knowledge/categories/route": "app/api/knowledge/categories/route.js", "/api/knowledge/route": "app/api/knowledge/route.js", "/api/knowledge/search/route": "app/api/knowledge/search/route.js", "/api/leads/[id]/convert/route": "app/api/leads/[id]/convert/route.js", "/api/leads/[id]/route": "app/api/leads/[id]/route.js", "/api/leads/[id]/stage/route": "app/api/leads/[id]/stage/route.js", "/api/leads/kanban/route": "app/api/leads/kanban/route.js", "/api/leads/hot/route": "app/api/leads/hot/route.js", "/api/leads/notifications/[id]/acknowledge/route": "app/api/leads/notifications/[id]/acknowledge/route.js", "/api/leads/notifications/route": "app/api/leads/notifications/route.js", "/api/leads/route": "app/api/leads/route.js", "/api/leads/stats/route": "app/api/leads/stats/route.js", "/api/lgpd/anonymize/route": "app/api/lgpd/anonymize/route.js", "/api/lgpd/export/route": "app/api/lgpd/export/route.js", "/api/messages/history/[conversationId]/route": "app/api/messages/history/[conversationId]/route.js", "/api/messages/inbound/route": "app/api/messages/inbound/route.js", "/api/messages/whatsapp/route": "app/api/messages/whatsapp/route.js", "/api/messages/send/route": "app/api/messages/send/route.js", "/api/patients/[id]/history/route": "app/api/patients/[id]/history/route.js", "/api/patients/[id]/observations/route": "app/api/patients/[id]/observations/route.js", "/api/patients/[id]/preferences/route": "app/api/patients/[id]/preferences/route.js", "/api/patients/[id]/route": "app/api/patients/[id]/route.js", "/api/patients/deduplicate/route": "app/api/patients/deduplicate/route.js", "/api/patients/inactive/route": "app/api/patients/inactive/route.js", "/api/patients/route": "app/api/patients/route.js", "/api/patients/tags/route": "app/api/patients/tags/route.js", "/api/pipeline/analytics/route": "app/api/pipeline/analytics/route.js", "/api/pipeline/stages/[id]/route": "app/api/pipeline/stages/[id]/route.js", "/api/pipeline/stages/route": "app/api/pipeline/stages/route.js", "/api/pipeline/stages/reorder/route": "app/api/pipeline/stages/reorder/route.js", "/api/procedures/[id]/route": "app/api/procedures/[id]/route.js", "/api/procedures/route": "app/api/procedures/route.js", "/api/reminders/config/route": "app/api/reminders/config/route.js", "/api/reports/export/route": "app/api/reports/export/route.js", "/api/reports/financial/route": "app/api/reports/financial/route.js", "/api/reports/patients/route": "app/api/reports/patients/route.js", "/api/scheduler/chat/route": "app/api/scheduler/chat/route.js", "/api/tasks/route": "app/api/tasks/route.js", "/api/seed/route": "app/api/seed/route.js", "/api/treatment-plans/[id]/route": "app/api/treatment-plans/[id]/route.js", "/api/treatment-plans/[id]/sessions/route": "app/api/treatment-plans/[id]/sessions/route.js", "/api/treatment-plans/route": "app/api/treatment-plans/route.js", "/api/waitlist/route": "app/api/waitlist/route.js", "/api/whatsapp/evolution/route": "app/api/whatsapp/evolution/route.js", "/api/whatsapp/qrcode/route": "app/api/whatsapp/qrcode/route.js", "/api/whatsapp/send/route": "app/api/whatsapp/send/route.js", "/api/whatsapp/templates/route": "app/api/whatsapp/templates/route.js", "/api/whatsapp/webhook/route": "app/api/whatsapp/webhook/route.js", "/api/widget/messages/route": "app/api/widget/messages/route.js", "/login/page": "app/login/page.js", "/signup/page": "app/signup/page.js", "/page": "app/page.js", "/dashboard/agendamentos/[id]/page": "app/dashboard/agendamentos/[id]/page.js", "/dashboard/agendamentos/novo/page": "app/dashboard/agendamentos/novo/page.js", "/dashboard/atividades/page": "app/dashboard/atividades/page.js", "/dashboard/campanhas/[id]/page": "app/dashboard/campanhas/[id]/page.js", "/dashboard/analytics/page": "app/dashboard/analytics/page.js", "/dashboard/campanhas/page": "app/dashboard/campanhas/page.js", "/dashboard/campanhas/nova/page": "app/dashboard/campanhas/nova/page.js", "/dashboard/agendamentos/page": "app/dashboard/agendamentos/page.js", "/dashboard/configuracao/page": "app/dashboard/configuracao/page.js", "/dashboard/contatos/page": "app/dashboard/contatos/page.js", "/dashboard/configuracoes/page": "app/dashboard/configuracoes/page.js", "/dashboard/conversas/page": "app/dashboard/conversas/page.js", "/dashboard/crm/pipeline/page": "app/dashboard/crm/pipeline/page.js", "/dashboard/crm/page": "app/dashboard/crm/page.js", "/dashboard/dentistas/[id]/page": "app/dashboard/dentistas/[id]/page.js", "/dashboard/dentistas/page": "app/dashboard/dentistas/page.js", "/dashboard/dentistas/novo/page": "app/dashboard/dentistas/novo/page.js", "/dashboard/leads/[id]/page": "app/dashboard/leads/[id]/page.js", "/dashboard/leads/novo/page": "app/dashboard/leads/novo/page.js", "/dashboard/leads/page": "app/dashboard/leads/page.js", "/dashboard/lista-espera/page": "app/dashboard/lista-espera/page.js", "/dashboard/pacientes/[id]/editar/page": "app/dashboard/pacientes/[id]/editar/page.js", "/dashboard/pacientes/[id]/page": "app/dashboard/pacientes/[id]/page.js", "/dashboard/pacientes/inativos/page": "app/dashboard/pacientes/inativos/page.js", "/dashboard/pacientes/novo/page": "app/dashboard/pacientes/novo/page.js", "/dashboard/pacientes/page": "app/dashboard/pacientes/page.js", "/dashboard/page": "app/dashboard/page.js", "/dashboard/pipeline/page": "app/dashboard/pipeline/page.js", "/dashboard/procedimentos/[id]/page": "app/dashboard/procedimentos/[id]/page.js", "/dashboard/procedimentos/page": "app/dashboard/procedimentos/page.js", "/dashboard/procedimentos/novo/page": "app/dashboard/procedimentos/novo/page.js", "/dashboard/tarefas/page": "app/dashboard/tarefas/page.js", "/dashboard/configuracoes/acessos/page": "app/dashboard/configuracoes/acessos/page.js", "/dashboard/configuracoes/acessos/perfis/page": "app/dashboard/configuracoes/acessos/perfis/page.js" };
    AppPathRoutesManifest = { "/_not-found/page": "/_not-found", "/api/activities/route": "/api/activities", "/api/admin/run-migration/route": "/api/admin/run-migration", "/api/agent/classify/route": "/api/agent/classify", "/api/agent/messages/route": "/api/agent/messages", "/api/agent/schedule-flow/route": "/api/agent/schedule-flow", "/api/agent/decisions/route": "/api/agent/decisions", "/api/agent/pending-actions/route": "/api/agent/pending-actions", "/api/analytics/insights/route": "/api/analytics/insights", "/api/analytics/metrics/route": "/api/analytics/metrics", "/api/analytics/noshow-prediction/route": "/api/analytics/noshow-prediction", "/api/appointments/[id]/cancel/route": "/api/appointments/[id]/cancel", "/api/analytics/roi/route": "/api/analytics/roi", "/api/appointments/[id]/confirm/route": "/api/appointments/[id]/confirm", "/api/appointments/[id]/noshow/route": "/api/appointments/[id]/noshow", "/api/appointments/[id]/reactivate/route": "/api/appointments/[id]/reactivate", "/api/appointments/[id]/remind/route": "/api/appointments/[id]/remind", "/api/appointments/[id]/reminder-template/route": "/api/appointments/[id]/reminder-template", "/api/appointments/[id]/reschedule/route": "/api/appointments/[id]/reschedule", "/api/appointments/[id]/route": "/api/appointments/[id]", "/api/appointments/availability/route": "/api/appointments/availability", "/api/appointments/confirm-response/route": "/api/appointments/confirm-response", "/api/appointments/incomplete-treatments/route": "/api/appointments/incomplete-treatments", "/api/appointments/route": "/api/appointments", "/api/auth/[...nextauth]/route": "/api/auth/[...nextauth]", "/api/auth/login/route": "/api/auth/login", "/api/auth/refresh/route": "/api/auth/refresh", "/api/auth/logout/route": "/api/auth/logout", "/api/auth/signup/route": "/api/auth/signup", "/api/auth/session/route": "/api/auth/session", "/api/budgets/[id]/accept/route": "/api/budgets/[id]/accept", "/api/budgets/[id]/payments/route": "/api/budgets/[id]/payments", "/api/budgets/[id]/installments/route": "/api/budgets/[id]/installments", "/api/budgets/[id]/reject/route": "/api/budgets/[id]/reject", "/api/budgets/[id]/route": "/api/budgets/[id]", "/api/budgets/followup/route": "/api/budgets/followup", "/api/budgets/route": "/api/budgets", "/api/budgets/[id]/send/route": "/api/budgets/[id]/send", "/api/campaigns/[id]/recipients/route": "/api/campaigns/[id]/recipients", "/api/campaigns/[id]/start/route": "/api/campaigns/[id]/start", "/api/campaigns/[id]/route": "/api/campaigns/[id]", "/api/campaigns/process/route": "/api/campaigns/process", "/api/campaigns/route": "/api/campaigns", "/api/campaigns/segments/preview/route": "/api/campaigns/segments/preview", "/api/clinics/settings/route": "/api/clinics/settings", "/api/campaigns/segments/route": "/api/campaigns/segments", "/api/consents/route": "/api/consents", "/api/contacts/[id]/appointments/route": "/api/contacts/[id]/appointments", "/api/contacts/[id]/notes/route": "/api/contacts/[id]/notes", "/api/contacts/[id]/route": "/api/contacts/[id]", "/api/contacts/[id]/timeline/route": "/api/contacts/[id]/timeline", "/api/contacts/route": "/api/contacts", "/api/conversations/route": "/api/conversations", "/api/conversations/[id]/route": "/api/conversations/[id]", "/api/crm/stats/route": "/api/crm/stats", "/api/cron/cleanup/route": "/api/cron/cleanup", "/api/cron/followups/route": "/api/cron/followups", "/api/cron/reminders/route": "/api/cron/reminders", "/api/cron/smart-triggers/route": "/api/cron/smart-triggers", "/api/custom-fields/definitions/[id]/route": "/api/custom-fields/definitions/[id]", "/api/custom-fields/definitions/route": "/api/custom-fields/definitions", "/api/custom-fields/values/route": "/api/custom-fields/values", "/api/dashboard/alerts/route": "/api/dashboard/alerts", "/api/dashboard/stats/route": "/api/dashboard/stats", "/api/dentists/[id]/route": "/api/dentists/[id]", "/api/dentists/route": "/api/dentists", "/api/health/db/route": "/api/health/db", "/api/health/route": "/api/health", "/api/instagram/webhook/route": "/api/instagram/webhook", "/api/knowledge/[id]/route": "/api/knowledge/[id]", "/api/knowledge/categories/route": "/api/knowledge/categories", "/api/knowledge/route": "/api/knowledge", "/api/knowledge/search/route": "/api/knowledge/search", "/api/leads/[id]/convert/route": "/api/leads/[id]/convert", "/api/leads/[id]/route": "/api/leads/[id]", "/api/leads/[id]/stage/route": "/api/leads/[id]/stage", "/api/leads/kanban/route": "/api/leads/kanban", "/api/leads/hot/route": "/api/leads/hot", "/api/leads/notifications/[id]/acknowledge/route": "/api/leads/notifications/[id]/acknowledge", "/api/leads/notifications/route": "/api/leads/notifications", "/api/leads/route": "/api/leads", "/api/leads/stats/route": "/api/leads/stats", "/api/lgpd/anonymize/route": "/api/lgpd/anonymize", "/api/lgpd/export/route": "/api/lgpd/export", "/api/messages/history/[conversationId]/route": "/api/messages/history/[conversationId]", "/api/messages/inbound/route": "/api/messages/inbound", "/api/messages/whatsapp/route": "/api/messages/whatsapp", "/api/messages/send/route": "/api/messages/send", "/api/patients/[id]/history/route": "/api/patients/[id]/history", "/api/patients/[id]/observations/route": "/api/patients/[id]/observations", "/api/patients/[id]/preferences/route": "/api/patients/[id]/preferences", "/api/patients/[id]/route": "/api/patients/[id]", "/api/patients/deduplicate/route": "/api/patients/deduplicate", "/api/patients/inactive/route": "/api/patients/inactive", "/api/patients/route": "/api/patients", "/api/patients/tags/route": "/api/patients/tags", "/api/pipeline/analytics/route": "/api/pipeline/analytics", "/api/pipeline/stages/[id]/route": "/api/pipeline/stages/[id]", "/api/pipeline/stages/route": "/api/pipeline/stages", "/api/pipeline/stages/reorder/route": "/api/pipeline/stages/reorder", "/api/procedures/[id]/route": "/api/procedures/[id]", "/api/procedures/route": "/api/procedures", "/api/reminders/config/route": "/api/reminders/config", "/api/reports/export/route": "/api/reports/export", "/api/reports/financial/route": "/api/reports/financial", "/api/reports/patients/route": "/api/reports/patients", "/api/scheduler/chat/route": "/api/scheduler/chat", "/api/tasks/route": "/api/tasks", "/api/seed/route": "/api/seed", "/api/treatment-plans/[id]/route": "/api/treatment-plans/[id]", "/api/treatment-plans/[id]/sessions/route": "/api/treatment-plans/[id]/sessions", "/api/treatment-plans/route": "/api/treatment-plans", "/api/waitlist/route": "/api/waitlist", "/api/whatsapp/evolution/route": "/api/whatsapp/evolution", "/api/whatsapp/qrcode/route": "/api/whatsapp/qrcode", "/api/whatsapp/send/route": "/api/whatsapp/send", "/api/whatsapp/templates/route": "/api/whatsapp/templates", "/api/whatsapp/webhook/route": "/api/whatsapp/webhook", "/api/widget/messages/route": "/api/widget/messages", "/login/page": "/login", "/signup/page": "/signup", "/page": "/", "/dashboard/agendamentos/[id]/page": "/dashboard/agendamentos/[id]", "/dashboard/agendamentos/novo/page": "/dashboard/agendamentos/novo", "/dashboard/atividades/page": "/dashboard/atividades", "/dashboard/campanhas/[id]/page": "/dashboard/campanhas/[id]", "/dashboard/analytics/page": "/dashboard/analytics", "/dashboard/campanhas/page": "/dashboard/campanhas", "/dashboard/campanhas/nova/page": "/dashboard/campanhas/nova", "/dashboard/agendamentos/page": "/dashboard/agendamentos", "/dashboard/configuracao/page": "/dashboard/configuracao", "/dashboard/contatos/page": "/dashboard/contatos", "/dashboard/configuracoes/page": "/dashboard/configuracoes", "/dashboard/conversas/page": "/dashboard/conversas", "/dashboard/crm/pipeline/page": "/dashboard/crm/pipeline", "/dashboard/crm/page": "/dashboard/crm", "/dashboard/dentistas/[id]/page": "/dashboard/dentistas/[id]", "/dashboard/dentistas/page": "/dashboard/dentistas", "/dashboard/dentistas/novo/page": "/dashboard/dentistas/novo", "/dashboard/leads/[id]/page": "/dashboard/leads/[id]", "/dashboard/leads/novo/page": "/dashboard/leads/novo", "/dashboard/leads/page": "/dashboard/leads", "/dashboard/lista-espera/page": "/dashboard/lista-espera", "/dashboard/pacientes/[id]/editar/page": "/dashboard/pacientes/[id]/editar", "/dashboard/pacientes/[id]/page": "/dashboard/pacientes/[id]", "/dashboard/pacientes/inativos/page": "/dashboard/pacientes/inativos", "/dashboard/pacientes/novo/page": "/dashboard/pacientes/novo", "/dashboard/pacientes/page": "/dashboard/pacientes", "/dashboard/page": "/dashboard", "/dashboard/pipeline/page": "/dashboard/pipeline", "/dashboard/procedimentos/[id]/page": "/dashboard/procedimentos/[id]", "/dashboard/procedimentos/page": "/dashboard/procedimentos", "/dashboard/procedimentos/novo/page": "/dashboard/procedimentos/novo", "/dashboard/tarefas/page": "/dashboard/tarefas", "/dashboard/configuracoes/acessos/page": "/dashboard/configuracoes/acessos", "/dashboard/configuracoes/acessos/perfis/page": "/dashboard/configuracoes/acessos/perfis" };
    FunctionsConfigManifest = { "version": 1, "functions": {} };
    PagesManifest = { "/_app": "pages/_app.js", "/_error": "pages/_error.js", "/_document": "pages/_document.js", "/404": "pages/404.html" };
    process.env.NEXT_BUILD_ID = BuildId;
    process.env.OPEN_NEXT_BUILD_ID = NextConfig.deploymentId ?? BuildId;
    process.env.NEXT_PREVIEW_MODE_ID = PrerenderManifest?.preview?.previewModeId;
  }
});

// node-built-in-modules:node:module
var node_module_exports = {};
import * as node_module_star from "node:module";
var init_node_module = __esm({
  "node-built-in-modules:node:module"() {
    __reExport(node_module_exports, node_module_star);
  }
});

// node_modules/@opennextjs/aws/dist/utils/stream.js
import { ReadableStream as ReadableStream2 } from "node:stream/web";
function emptyReadableStream() {
  if (process.env.OPEN_NEXT_FORCE_NON_EMPTY_RESPONSE === "true") {
    return new ReadableStream2({
      pull(controller) {
        maybeSomethingBuffer ??= Buffer.from("SOMETHING");
        controller.enqueue(maybeSomethingBuffer);
        controller.close();
      }
    }, { highWaterMark: 0 });
  }
  return new ReadableStream2({
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

// node_modules/@opennextjs/aws/dist/overrides/converters/utils.js
function getQueryFromSearchParams(searchParams) {
  return getQueryFromIterator(searchParams.entries());
}
var init_utils = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/converters/utils.js"() {
    init_util();
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

// node_modules/@opennextjs/aws/dist/overrides/wrappers/cloudflare-node.js
var cloudflare_node_exports = {};
__export(cloudflare_node_exports, {
  default: () => cloudflare_node_default
});
import { Writable } from "node:stream";
var NULL_BODY_STATUSES2, handler, cloudflare_node_default;
var init_cloudflare_node = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/wrappers/cloudflare-node.js"() {
    NULL_BODY_STATUSES2 = /* @__PURE__ */ new Set([101, 204, 205, 304]);
    handler = async (handler3, converter2) => async (request, env, ctx, abortSignal) => {
      globalThis.process = process;
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === "string") {
          process.env[key] = value;
        }
      }
      const internalEvent = await converter2.convertFrom(request);
      const url = new URL(request.url);
      const { promise: promiseResponse, resolve: resolveResponse } = Promise.withResolvers();
      const streamCreator = {
        writeHeaders(prelude) {
          const { statusCode, cookies, headers } = prelude;
          const responseHeaders = new Headers(headers);
          for (const cookie of cookies) {
            responseHeaders.append("Set-Cookie", cookie);
          }
          if (url.hostname === "localhost") {
            responseHeaders.set("Content-Encoding", "identity");
          }
          if (NULL_BODY_STATUSES2.has(statusCode)) {
            const response2 = new Response(null, {
              status: statusCode,
              headers: responseHeaders
            });
            resolveResponse(response2);
            return new Writable({
              write(chunk, encoding, callback) {
                callback();
              }
            });
          }
          let controller;
          const readable = new ReadableStream({
            start(c) {
              controller = c;
            }
          });
          const response = new Response(readable, {
            status: statusCode,
            headers: responseHeaders
          });
          resolveResponse(response);
          return new Writable({
            write(chunk, encoding, callback) {
              try {
                controller.enqueue(chunk);
              } catch (e) {
                return callback(e);
              }
              callback();
            },
            final(callback) {
              controller.close();
              callback();
            },
            destroy(error2, callback) {
              if (error2) {
                controller.error(error2);
              } else {
                try {
                  controller.close();
                } catch {
                }
              }
              callback(error2);
            }
          });
        },
        // This is for passing along the original abort signal from the initial Request you retrieve in your worker
        // Ensures that the response we pass to NextServer is aborted if the request is aborted
        // By doing this `request.signal.onabort` will work in route handlers
        abortSignal,
        // There is no need to retain the chunks that were pushed to the response stream.
        retainChunks: false
      };
      ctx.waitUntil(handler3(internalEvent, {
        streamCreator,
        waitUntil: ctx.waitUntil.bind(ctx)
      }));
      return promiseResponse;
    };
    cloudflare_node_default = {
      wrapper: handler,
      name: "cloudflare-node",
      supportStreaming: true
    };
  }
});

// node_modules/@opennextjs/aws/dist/overrides/tagCache/dummy.js
var dummy_exports = {};
__export(dummy_exports, {
  default: () => dummy_default
});
var dummyTagCache, dummy_default;
var init_dummy = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/tagCache/dummy.js"() {
    dummyTagCache = {
      name: "dummy",
      mode: "original",
      getByPath: async () => {
        return [];
      },
      getByTag: async () => {
        return [];
      },
      getLastModified: async (_, lastModified) => {
        return lastModified ?? Date.now();
      },
      writeTags: async () => {
        return;
      },
      isStale: async (_path) => {
        return false;
      }
    };
    dummy_default = dummyTagCache;
  }
});

// node_modules/@opennextjs/aws/dist/overrides/queue/direct.js
var direct_exports = {};
__export(direct_exports, {
  default: () => direct_default
});
var queue, direct_default;
var init_direct = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/queue/direct.js"() {
    queue = {
      name: "dev-queue",
      send: async (message) => {
        const prerenderManifest = (await Promise.resolve().then(() => (init_config(), config_exports))).PrerenderManifest;
        const { host, url } = message.MessageBody;
        const protocol = host.includes("localhost") ? "http" : "https";
        const revalidateId = prerenderManifest.preview.previewModeId;
        await globalThis.internalFetch(`${protocol}://${host}${url}`, {
          method: "HEAD",
          headers: {
            "x-prerender-revalidate": revalidateId,
            "x-isr": "1"
          }
        });
      }
    };
    direct_default = queue;
  }
});

// node_modules/@opennextjs/aws/dist/overrides/incrementalCache/dummy.js
var dummy_exports2 = {};
__export(dummy_exports2, {
  default: () => dummy_default2
});
var dummyIncrementalCache, dummy_default2;
var init_dummy2 = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/incrementalCache/dummy.js"() {
    init_error();
    dummyIncrementalCache = {
      name: "dummy",
      get: async () => {
        throw new IgnorableError('"Dummy" cache does not cache anything');
      },
      set: async () => {
        throw new IgnorableError('"Dummy" cache does not cache anything');
      },
      delete: async () => {
        throw new IgnorableError('"Dummy" cache does not cache anything');
      }
    };
    dummy_default2 = dummyIncrementalCache;
  }
});

// node_modules/@opennextjs/aws/dist/overrides/assetResolver/dummy.js
var dummy_exports3 = {};
__export(dummy_exports3, {
  default: () => dummy_default3
});
var resolver, dummy_default3;
var init_dummy3 = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/assetResolver/dummy.js"() {
    resolver = {
      name: "dummy"
    };
    dummy_default3 = resolver;
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

// node_modules/@opennextjs/aws/dist/overrides/cdnInvalidation/dummy.js
var dummy_exports4 = {};
__export(dummy_exports4, {
  default: () => dummy_default4
});
var dummy_default4;
var init_dummy4 = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/cdnInvalidation/dummy.js"() {
    dummy_default4 = {
      name: "dummy",
      invalidatePaths: (_) => {
        return Promise.resolve();
      }
    };
  }
});

// node_modules/@opennextjs/aws/dist/core/createMainHandler.js
init_logger();

// node_modules/@opennextjs/aws/dist/adapters/util.js
function setNodeEnv() {
  const processEnv = process.env;
  processEnv.NODE_ENV = process.env.NODE_ENV ?? "production";
}
function generateUniqueId() {
  return Math.random().toString(36).slice(2, 8);
}

// node_modules/@opennextjs/aws/dist/core/requestHandler.js
import { AsyncLocalStorage } from "node:async_hooks";

// node_modules/@opennextjs/aws/dist/http/openNextResponse.js
init_logger();
init_util();
import { Transform } from "node:stream";
var SET_COOKIE_HEADER = "set-cookie";
var CANNOT_BE_USED = "This cannot be used in OpenNext";
var OpenNextNodeResponse = class extends Transform {
  fixHeadersFn;
  onEnd;
  streamCreator;
  initialHeaders;
  statusCode;
  statusMessage = "";
  headers = {};
  headersSent = false;
  _chunks = [];
  headersAlreadyFixed = false;
  _cookies = [];
  responseStream;
  bodyLength = 0;
  // To comply with the ServerResponse interface :
  strictContentLength = false;
  assignSocket(_socket) {
    throw new Error(CANNOT_BE_USED);
  }
  detachSocket(_socket) {
    throw new Error(CANNOT_BE_USED);
  }
  // We might have to revisit those 3 in the future
  writeContinue(_callback) {
    throw new Error(CANNOT_BE_USED);
  }
  writeEarlyHints(_hints, _callback) {
    throw new Error(CANNOT_BE_USED);
  }
  writeProcessing() {
    throw new Error(CANNOT_BE_USED);
  }
  /**
   * This is a dummy request object to comply with the ServerResponse interface
   * It will never be defined
   */
  req;
  chunkedEncoding = false;
  shouldKeepAlive = true;
  useChunkedEncodingByDefault = true;
  sendDate = false;
  connection = null;
  socket = null;
  setTimeout(_msecs, _callback) {
    throw new Error(CANNOT_BE_USED);
  }
  addTrailers(_headers) {
    throw new Error(CANNOT_BE_USED);
  }
  constructor(fixHeadersFn, onEnd, streamCreator, initialHeaders, statusCode) {
    super();
    this.fixHeadersFn = fixHeadersFn;
    this.onEnd = onEnd;
    this.streamCreator = streamCreator;
    this.initialHeaders = initialHeaders;
    if (statusCode && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599) {
      this.statusCode = statusCode;
    }
    streamCreator?.abortSignal?.addEventListener("abort", () => {
      this.destroy();
    });
  }
  // Necessary for next 12
  // We might have to implement all the methods here
  get originalResponse() {
    return this;
  }
  get finished() {
    return this.responseStream ? this.responseStream?.writableFinished : this.writableFinished;
  }
  setHeader(name, value) {
    const key = name.toLowerCase();
    if (key === SET_COOKIE_HEADER) {
      if (Array.isArray(value)) {
        this._cookies = value;
      } else {
        this._cookies = [value];
      }
    }
    this.headers[key] = value;
    return this;
  }
  removeHeader(name) {
    const key = name.toLowerCase();
    if (key === SET_COOKIE_HEADER) {
      this._cookies = [];
    } else {
      delete this.headers[key];
    }
    return this;
  }
  hasHeader(name) {
    const key = name.toLowerCase();
    if (key === SET_COOKIE_HEADER) {
      return this._cookies.length > 0;
    }
    return this.headers[key] !== void 0;
  }
  getHeaders() {
    return this.headers;
  }
  getHeader(name) {
    return this.headers[name.toLowerCase()];
  }
  getHeaderNames() {
    return Object.keys(this.headers);
  }
  // Only used directly in next@14+
  flushHeaders() {
    this.headersSent = true;
    const mergeHeadersPriority = globalThis.__openNextAls?.getStore()?.mergeHeadersPriority ?? "middleware";
    if (this.initialHeaders) {
      this.headers = mergeHeadersPriority === "middleware" ? {
        ...this.headers,
        ...this.initialHeaders
      } : {
        ...this.initialHeaders,
        ...this.headers
      };
      const initialCookies = parseSetCookieHeader(this.initialHeaders[SET_COOKIE_HEADER]?.toString());
      this._cookies = mergeHeadersPriority === "middleware" ? [...this._cookies, ...initialCookies] : [...initialCookies, ...this._cookies];
    }
    this.fixHeaders(this.headers);
    this.fixHeadersForError();
    this.headers[SET_COOKIE_HEADER] = this._cookies;
    const parsedHeaders = parseHeaders(this.headers);
    delete parsedHeaders[SET_COOKIE_HEADER];
    if (this.streamCreator) {
      this.responseStream = this.streamCreator?.writeHeaders({
        statusCode: this.statusCode ?? 200,
        cookies: this._cookies,
        headers: parsedHeaders
      });
      this.pipe(this.responseStream);
    }
  }
  appendHeader(name, value) {
    const key = name.toLowerCase();
    if (!this.hasHeader(key)) {
      return this.setHeader(key, value);
    }
    const existingHeader = this.getHeader(key);
    const toAppend = Array.isArray(value) ? value : [value];
    const newValue = Array.isArray(existingHeader) ? [...existingHeader, ...toAppend] : [existingHeader, ...toAppend];
    return this.setHeader(key, newValue);
  }
  writeHead(statusCode, statusMessage, headers) {
    let _headers = headers;
    let _statusMessage;
    if (typeof statusMessage === "string") {
      _statusMessage = statusMessage;
    } else {
      _headers = statusMessage;
    }
    const finalHeaders = this.headers;
    if (_headers) {
      if (Array.isArray(_headers)) {
        for (let i = 0; i < _headers.length; i += 2) {
          finalHeaders[_headers[i]] = _headers[i + 1];
        }
      } else {
        for (const key of Object.keys(_headers)) {
          finalHeaders[key] = _headers[key];
        }
      }
    }
    this.statusCode = statusCode;
    if (headers) {
      this.headers = finalHeaders;
    }
    this.flushHeaders();
    return this;
  }
  /**
   * OpenNext specific method
   */
  fixHeaders(headers) {
    if (this.headersAlreadyFixed) {
      return;
    }
    this.fixHeadersFn(headers);
    this.headersAlreadyFixed = true;
  }
  getFixedHeaders() {
    this.fixHeaders(this.headers);
    this.fixHeadersForError();
    this.headers[SET_COOKIE_HEADER] = this._cookies;
    return this.headers;
  }
  getBody() {
    return Buffer.concat(this._chunks);
  }
  _internalWrite(chunk, encoding) {
    const buffer = encoding === "buffer" ? chunk : Buffer.from(chunk, encoding);
    this.bodyLength += buffer.length;
    if (this.streamCreator?.retainChunks !== false) {
      this._chunks.push(buffer);
    }
    this.push(buffer);
    this.streamCreator?.onWrite?.();
  }
  _transform(chunk, encoding, callback) {
    if (!this.headersSent) {
      this.flushHeaders();
    }
    this._internalWrite(chunk, encoding);
    callback();
  }
  _flush(callback) {
    if (!this.headersSent) {
      this.flushHeaders();
    }
    globalThis.__openNextAls?.getStore()?.pendingPromiseRunner.add(this.onEnd(this.headers));
    this.streamCreator?.onFinish?.(this.bodyLength);
    if (this.bodyLength === 0 && // We use an env variable here because not all aws account have the same behavior
    // On some aws accounts the response will hang if the body is empty
    // We are modifying the response body here, this is not a good practice
    process.env.OPEN_NEXT_FORCE_NON_EMPTY_RESPONSE === "true") {
      debug('Force writing "SOMETHING" to the response body');
      this.push("SOMETHING");
    }
    callback();
  }
  /**
   * New method in Node 18.15+
   * There are probably not used right now in Next.js, but better be safe than sorry
   */
  setHeaders(headers) {
    headers.forEach((value, key) => {
      this.setHeader(key, Array.isArray(value) ? value : value.toString());
    });
    return this;
  }
  /**
   * Next specific methods
   * On earlier versions of next.js, those methods are mandatory to make everything work
   */
  get sent() {
    return this.finished || this.headersSent;
  }
  getHeaderValues(name) {
    const values = this.getHeader(name);
    if (values === void 0)
      return void 0;
    return (Array.isArray(values) ? values : [values]).map((value) => value.toString());
  }
  send() {
    for (const chunk of this._chunks) {
      this.write(chunk);
    }
    this.end();
  }
  body(value) {
    this.write(value);
    return this;
  }
  onClose(callback) {
    this.on("close", callback);
  }
  redirect(destination, statusCode) {
    this.setHeader("Location", destination);
    this.statusCode = statusCode;
    if (statusCode === 308) {
      this.setHeader("Refresh", `0;url=${destination}`);
    }
    return this;
  }
  // For some reason, next returns the 500 error page with some cache-control headers
  // We need to fix that
  fixHeadersForError() {
    if (process.env.OPEN_NEXT_DANGEROUSLY_SET_ERROR_HEADERS === "true") {
      return;
    }
    if (this.statusCode === 404 || this.statusCode === 500) {
      this.headers["cache-control"] = "private, no-cache, no-store, max-age=0, must-revalidate";
    }
  }
};

// node_modules/@opennextjs/aws/dist/http/request.js
import http from "node:http";
var IncomingMessage = class extends http.IncomingMessage {
  constructor({ method, url, headers, body, remoteAddress }) {
    super({
      encrypted: true,
      readable: false,
      remoteAddress,
      address: () => ({ port: 443 }),
      end: Function.prototype,
      destroy: Function.prototype
    });
    if (body) {
      headers["content-length"] ??= String(Buffer.byteLength(body));
    }
    Object.assign(this, {
      ip: remoteAddress,
      complete: true,
      httpVersion: "1.1",
      httpVersionMajor: "1",
      httpVersionMinor: "1",
      method,
      headers,
      body,
      url
    });
    this._read = () => {
      this.push(body);
      this.push(null);
    };
  }
};

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

// node_modules/@opennextjs/aws/dist/core/requestHandler.js
init_config();
init_logger();

// node_modules/@opennextjs/aws/dist/core/patchAsyncStorage.js
var mod = (init_node_module(), __toCommonJS(node_module_exports));
var resolveFilename = mod._resolveFilename;

// node_modules/@opennextjs/aws/dist/core/routing/util.js
import crypto from "node:crypto";
init_config();
init_util();
init_logger();
import { ReadableStream as ReadableStream3 } from "node:stream/web";

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
init_config();
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
function isLocalizedPath(path2) {
  return NextConfig.i18n?.locales.includes(path2.split("/")[1].toLowerCase()) ?? false;
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
function constructNextUrl(baseUrl, path2) {
  const nextBasePath = NextConfig.basePath ?? "";
  const url = new URL(`${nextBasePath}${path2}`, baseUrl);
  return url.href;
}
function convertRes(res) {
  const statusCode = res.statusCode || 200;
  const headers = parseHeaders(res.getFixedHeaders());
  const isBase64Encoded = isBinaryContentType(headers["content-type"]) || !!headers["content-encoding"];
  const body = new ReadableStream3({
    pull(controller) {
      if (!res._chunks || res._chunks.length === 0) {
        controller.close();
        return;
      }
      controller.enqueue(res._chunks.shift());
    }
  });
  return {
    type: "core",
    statusCode,
    headers,
    body,
    isBase64Encoded
  };
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
function convertToQuery(querystring) {
  if (!querystring)
    return {};
  const query = new URLSearchParams(querystring);
  const queryObject = {};
  for (const key of query.keys()) {
    const queries = query.getAll(key);
    queryObject[key] = queries.length > 1 ? queries : queries[0];
  }
  return queryObject;
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
var CommonHeaders;
(function(CommonHeaders2) {
  CommonHeaders2["CACHE_CONTROL"] = "cache-control";
  CommonHeaders2["NEXT_CACHE"] = "x-nextjs-cache";
})(CommonHeaders || (CommonHeaders = {}));
function fixCacheHeaderForHtmlPages(internalEvent, headers) {
  if (internalEvent.rawPath === "/404" || internalEvent.rawPath === "/500") {
    if (process.env.OPEN_NEXT_DANGEROUSLY_SET_ERROR_HEADERS === "true") {
      return;
    }
    headers[CommonHeaders.CACHE_CONTROL] = "private, no-cache, no-store, max-age=0, must-revalidate";
    return;
  }
  const localizedPath = localizePath(internalEvent);
  if (HtmlPages.includes(localizedPath) && !internalEvent.headers["x-middleware-prefetch"]) {
    headers[CommonHeaders.CACHE_CONTROL] = "public, max-age=0, s-maxage=31536000, must-revalidate";
  }
}
function fixSWRCacheHeader(headers) {
  let cacheControl = headers[CommonHeaders.CACHE_CONTROL];
  if (!cacheControl)
    return;
  if (Array.isArray(cacheControl)) {
    cacheControl = cacheControl.join(",");
  }
  if (typeof cacheControl !== "string")
    return;
  headers[CommonHeaders.CACHE_CONTROL] = cacheControl.replace(/\bstale-while-revalidate(?!=)/, "stale-while-revalidate=2592000");
}
function addOpenNextHeader(headers) {
  if (NextConfig.poweredByHeader) {
    headers["X-OpenNext"] = "1";
  }
  if (globalThis.openNextDebug) {
    headers["X-OpenNext-Version"] = globalThis.openNextVersion;
  }
  if (process.env.OPEN_NEXT_REQUEST_ID_HEADER || globalThis.openNextDebug) {
    headers["X-OpenNext-RequestId"] = globalThis.__openNextAls.getStore()?.requestId;
  }
}
async function revalidateIfRequired(host, rawPath, headers, req) {
  if (headers[CommonHeaders.NEXT_CACHE] === "STALE") {
    const internalMeta = req?.[Symbol.for("NextInternalRequestMeta")];
    const revalidateUrl = internalMeta?._nextDidRewrite ? rawPath.startsWith("/_next/data/") ? `/_next/data/${BuildId}${internalMeta?._nextRewroteUrl}.json` : internalMeta?._nextRewroteUrl : rawPath;
    try {
      const hash = (str) => crypto.createHash("md5").update(str).digest("hex");
      const lastModified = globalThis.__openNextAls.getStore()?.lastModified ?? 0;
      const eTag = `${headers.etag ?? headers.ETag ?? ""}`;
      await globalThis.queue.send({
        MessageBody: { host, url: revalidateUrl, eTag, lastModified },
        MessageDeduplicationId: hash(`${rawPath}-${lastModified}-${eTag}`),
        MessageGroupId: generateMessageGroupId(rawPath)
      });
    } catch (e) {
      error(`Failed to revalidate stale page ${rawPath}`, e);
    }
  }
}
function fixISRHeaders(headers) {
  const sMaxAgeRegex = /s-maxage=(\d+)/;
  const match = headers[CommonHeaders.CACHE_CONTROL]?.match(sMaxAgeRegex);
  const sMaxAge = match ? Number.parseInt(match[1]) : void 0;
  if (!sMaxAge) {
    return;
  }
  if (headers[CommonHeaders.NEXT_CACHE] === "REVALIDATED") {
    headers[CommonHeaders.CACHE_CONTROL] = "private, no-cache, no-store, max-age=0, must-revalidate";
    return;
  }
  const _lastModified = globalThis.__openNextAls.getStore()?.lastModified ?? 0;
  if (headers[CommonHeaders.NEXT_CACHE] === "HIT" && _lastModified > 0) {
    debug("cache-control", headers[CommonHeaders.CACHE_CONTROL], _lastModified, Date.now());
    if (sMaxAge && sMaxAge !== 31536e3) {
      const age = Math.round((Date.now() - _lastModified) / 1e3);
      const remainingTtl = Math.max(sMaxAge - age, 1);
      headers[CommonHeaders.CACHE_CONTROL] = `s-maxage=${remainingTtl}, stale-while-revalidate=2592000`;
    }
  }
  if (headers[CommonHeaders.NEXT_CACHE] !== "STALE")
    return;
  headers[CommonHeaders.CACHE_CONTROL] = "s-maxage=2, stale-while-revalidate=2592000";
}
function createServerResponse(routingResult, headers, responseStream) {
  const internalEvent = routingResult.internalEvent;
  return new OpenNextNodeResponse((_headers) => {
    fixCacheHeaderForHtmlPages(internalEvent, _headers);
    fixSWRCacheHeader(_headers);
    addOpenNextHeader(_headers);
    fixISRHeaders(_headers);
  }, async (_headers) => {
    await revalidateIfRequired(internalEvent.headers.host, internalEvent.rawPath, _headers);
    await invalidateCDNOnRequest(routingResult, _headers);
  }, responseStream, headers, routingResult.rewriteStatusCode);
}
async function invalidateCDNOnRequest(params, headers) {
  const { internalEvent, resolvedRoutes, initialURL } = params;
  const initialPath = new URL(initialURL).pathname;
  const isIsrRevalidation = internalEvent.headers["x-isr"] === "1";
  if (!isIsrRevalidation && headers[CommonHeaders.NEXT_CACHE] === "REVALIDATED") {
    await globalThis.cdnInvalidationHandler.invalidatePaths([
      {
        initialPath,
        rawPath: internalEvent.rawPath,
        resolvedRoutes
      }
    ]);
  }
}

// node_modules/@opennextjs/aws/dist/core/routingHandler.js
init_config();
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/cacheInterceptor.js
init_config();
init_stream();

// node_modules/@opennextjs/aws/dist/utils/cache.js
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/cacheInterceptor.js
init_logger();
var CACHE_ONE_YEAR = 60 * 60 * 24 * 365;
var CACHE_ONE_MONTH = 60 * 60 * 24 * 30;

// node_modules/@opennextjs/aws/dist/core/routing/matcher.js
init_config();
init_stream();
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/routeMatcher.js
init_config();
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
  return function matchRoute(path2) {
    const foundRoutes = regexp.filter((route) => route.regexp.test(path2));
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

// node_modules/@opennextjs/aws/dist/core/routing/middleware.js
init_config();
init_stream();
init_utils();
var middlewareManifest = MiddlewareManifest;
var functionsConfigManifest = FunctionsConfigManifest;
var middleMatch = getMiddlewareMatch(middlewareManifest, functionsConfigManifest);

// node_modules/@opennextjs/aws/dist/core/routingHandler.js
var MIDDLEWARE_HEADER_PREFIX = "x-middleware-response-";
var MIDDLEWARE_HEADER_PREFIX_LEN = MIDDLEWARE_HEADER_PREFIX.length;
var INTERNAL_HEADER_PREFIX = "x-opennext-";
var INTERNAL_HEADER_INITIAL_URL = `${INTERNAL_HEADER_PREFIX}initial-url`;
var INTERNAL_HEADER_LOCALE = `${INTERNAL_HEADER_PREFIX}locale`;
var INTERNAL_HEADER_RESOLVED_ROUTES = `${INTERNAL_HEADER_PREFIX}resolved-routes`;
var INTERNAL_HEADER_REWRITE_STATUS_CODE = `${INTERNAL_HEADER_PREFIX}rewrite-status-code`;
var INTERNAL_EVENT_REQUEST_ID = `${INTERNAL_HEADER_PREFIX}request-id`;

// node_modules/@opennextjs/aws/dist/core/util.js
init_config();
init_logger();
import NextServer from "next/dist/server/next-server.js";

// node_modules/@opennextjs/aws/dist/core/require-hooks.js
init_logger();
var mod2 = (init_node_module(), __toCommonJS(node_module_exports));
var resolveFilename2 = mod2._resolveFilename;

// node_modules/@opennextjs/aws/dist/core/util.js
var cacheHandlerPath = __require.resolve("./cache.cjs");
var composableCacheHandlerPath = __require.resolve("./composable-cache.cjs");
var nextServer = new NextServer.default({
  conf: {
    ...NextConfig,
    // Next.js compression should be disabled because of a bug in the bundled
    // `compression` package — https://github.com/vercel/next.js/issues/11669
    compress: false,
    // By default, Next.js uses local disk to store ISR cache. We will use
    // our own cache handler to store the cache on S3.
    //#override stableIncrementalCache
    cacheHandler: cacheHandlerPath,
    cacheMaxMemorySize: 0,
    // We need to disable memory cache
    //#endOverride
    experimental: {
      ...NextConfig.experimental,
      // This uses the request.headers.host as the URL
      // https://github.com/vercel/next.js/blob/canary/packages/next/src/server/next-server.ts#L1749-L1754
      //#override trustHostHeader
      trustHostHeader: true,
      //#endOverride
      //#override composableCache
      cacheHandlers: {
        default: composableCacheHandlerPath
      }
      //#endOverride
    }
  },
  customServer: false,
  dev: false,
  dir: __dirname
});
var routesLoaded = false;
globalThis.__next_route_preloader = async (stage) => {
  if (routesLoaded) {
    return;
  }
  const thisFunction = globalThis.fnName ? globalThis.openNextConfig.functions[globalThis.fnName] : globalThis.openNextConfig.default;
  const routePreloadingBehavior = thisFunction?.routePreloadingBehavior ?? "none";
  if (routePreloadingBehavior === "none") {
    routesLoaded = true;
    return;
  }
  if (!("unstable_preloadEntries" in nextServer)) {
    debug("The current version of Next.js does not support route preloading. Skipping route preloading.");
    routesLoaded = true;
    return;
  }
  if (stage === "waitUntil" && routePreloadingBehavior === "withWaitUntil") {
    const waitUntil = globalThis.__openNextAls.getStore()?.waitUntil;
    if (!waitUntil) {
      error("You've tried to use the 'withWaitUntil' route preloading behavior, but the 'waitUntil' function is not available.");
      routesLoaded = true;
      return;
    }
    debug("Preloading entries with waitUntil");
    waitUntil?.(nextServer.unstable_preloadEntries());
    routesLoaded = true;
  } else if (stage === "start" && routePreloadingBehavior === "onStart" || stage === "warmerEvent" && routePreloadingBehavior === "onWarmerEvent" || stage === "onDemand") {
    const startTimestamp = Date.now();
    debug("Preloading entries");
    await nextServer.unstable_preloadEntries();
    debug("Preloading entries took", Date.now() - startTimestamp, "ms");
    routesLoaded = true;
  }
};
var requestHandler = (metadata) => "getRequestHandlerWithMetadata" in nextServer ? nextServer.getRequestHandlerWithMetadata(metadata) : nextServer.getRequestHandler();

// node_modules/@opennextjs/aws/dist/core/requestHandler.js
globalThis.__openNextAls = new AsyncLocalStorage();
async function openNextHandler(internalEvent, options) {
  const initialHeaders = internalEvent.headers;
  const requestId = globalThis.openNextConfig.middleware?.external ? internalEvent.headers[INTERNAL_EVENT_REQUEST_ID] : Math.random().toString(36);
  return runWithOpenNextRequestContext({
    isISRRevalidation: initialHeaders["x-isr"] === "1",
    waitUntil: options?.waitUntil,
    requestId
  }, async () => {
    await globalThis.__next_route_preloader("waitUntil");
    if (initialHeaders["x-forwarded-host"]) {
      initialHeaders.host = initialHeaders["x-forwarded-host"];
    }
    debug("internalEvent", internalEvent);
    const internalHeaders = {
      initialPath: initialHeaders[INTERNAL_HEADER_INITIAL_URL] ?? internalEvent.rawPath,
      resolvedRoutes: initialHeaders[INTERNAL_HEADER_RESOLVED_ROUTES] ? JSON.parse(initialHeaders[INTERNAL_HEADER_RESOLVED_ROUTES]) : [],
      rewriteStatusCode: Number.parseInt(initialHeaders[INTERNAL_HEADER_REWRITE_STATUS_CODE])
    };
    let routingResult = {
      internalEvent,
      isExternalRewrite: false,
      origin: false,
      isISR: false,
      initialURL: internalEvent.url,
      ...internalHeaders
    };
    const headers = "type" in routingResult ? routingResult.headers : routingResult.internalEvent.headers;
    const overwrittenResponseHeaders = {};
    for (const [rawKey, value] of Object.entries(headers)) {
      if (!rawKey.startsWith(MIDDLEWARE_HEADER_PREFIX)) {
        continue;
      }
      const key = rawKey.slice(MIDDLEWARE_HEADER_PREFIX_LEN);
      if (key !== "x-middleware-set-cookie") {
        overwrittenResponseHeaders[key] = value;
      }
      headers[key] = value;
      delete headers[rawKey];
    }
    if ("isExternalRewrite" in routingResult && routingResult.isExternalRewrite === true) {
      try {
        routingResult = await globalThis.proxyExternalRequest.proxy(routingResult.internalEvent);
      } catch (e) {
        error("External request failed.", e);
        routingResult = {
          internalEvent: {
            type: "core",
            rawPath: "/500",
            method: "GET",
            headers: {},
            url: constructNextUrl(internalEvent.url, "/500"),
            query: {},
            cookies: {},
            remoteAddress: ""
          },
          // On error we need to rewrite to the 500 page which is an internal rewrite
          isExternalRewrite: false,
          isISR: false,
          origin: false,
          initialURL: internalEvent.url,
          resolvedRoutes: [{ route: "/500", type: "page" }]
        };
      }
    }
    if ("type" in routingResult) {
      if (options?.streamCreator) {
        const response = createServerResponse({
          internalEvent,
          isExternalRewrite: false,
          isISR: false,
          resolvedRoutes: [],
          origin: false,
          initialURL: internalEvent.url
        }, routingResult.headers, options.streamCreator);
        response.statusCode = routingResult.statusCode;
        response.flushHeaders();
        const [bodyToConsume, bodyToReturn] = routingResult.body.tee();
        for await (const chunk of bodyToConsume) {
          response.write(chunk);
        }
        response.end();
        routingResult.body = bodyToReturn;
      }
      return routingResult;
    }
    const preprocessedEvent = routingResult.internalEvent;
    debug("preprocessedEvent", preprocessedEvent);
    const { search, pathname, hash } = new URL(preprocessedEvent.url);
    const reqProps = {
      method: preprocessedEvent.method,
      url: `${pathname}${search}${hash}`,
      //WORKAROUND: We pass this header to the serverless function to mimic a prefetch request which will not trigger revalidation since we handle revalidation differently
      // There is 3 way we can handle revalidation:
      // 1. We could just let the revalidation go as normal, but due to race conditions the revalidation will be unreliable
      // 2. We could alter the lastModified time of our cache to make next believe that the cache is fresh, but this could cause issues with stale data since the cdn will cache the stale data as if it was fresh
      // 3. OUR CHOICE: We could pass a purpose prefetch header to the serverless function to make next believe that the request is a prefetch request and not trigger revalidation (This could potentially break in the future if next changes the behavior of prefetch requests)
      headers: {
        ...headers
      },
      body: preprocessedEvent.body,
      remoteAddress: preprocessedEvent.remoteAddress
    };
    const mergeHeadersPriority = globalThis.openNextConfig.dangerous?.headersAndCookiesPriority ? globalThis.openNextConfig.dangerous.headersAndCookiesPriority(preprocessedEvent) : "middleware";
    const store = globalThis.__openNextAls.getStore();
    if (store) {
      store.mergeHeadersPriority = mergeHeadersPriority;
    }
    const req = new IncomingMessage(reqProps);
    const res = createServerResponse(routingResult, overwrittenResponseHeaders, options?.streamCreator);
    await processRequest(req, res, routingResult);
    const { statusCode, headers: responseHeaders, isBase64Encoded, body } = convertRes(res);
    const internalResult = {
      type: internalEvent.type,
      statusCode,
      headers: responseHeaders,
      body,
      isBase64Encoded
    };
    return internalResult;
  });
}
async function processRequest(req, res, routingResult) {
  delete req.body;
  const initialURL = new URL(
    // We always assume that only the routing layer can set this header.
    routingResult.internalEvent.headers[INTERNAL_HEADER_INITIAL_URL] ?? routingResult.initialURL
  );
  let invokeStatus;
  if (routingResult.internalEvent.rawPath === "/500") {
    invokeStatus = 500;
  } else if (routingResult.internalEvent.rawPath === "/404") {
    invokeStatus = 404;
  }
  const requestMetadata = {
    isNextDataReq: routingResult.internalEvent.query.__nextDataReq === "1",
    initURL: routingResult.initialURL,
    initQuery: convertToQuery(initialURL.search),
    initProtocol: initialURL.protocol,
    defaultLocale: NextConfig.i18n?.defaultLocale,
    locale: routingResult.locale,
    middlewareInvoke: false,
    // By setting invokePath and invokeQuery we can bypass some of the routing logic in Next.js
    invokePath: routingResult.internalEvent.rawPath,
    invokeQuery: routingResult.internalEvent.query,
    // invokeStatus is only used for error pages
    invokeStatus
  };
  try {
    req.url = initialURL.pathname + convertToQueryString(routingResult.internalEvent.query);
    await requestHandler(requestMetadata)(req, res);
  } catch (e) {
    if (e.constructor.name === "NoFallbackError") {
      await handleNoFallbackError(req, res, routingResult, requestMetadata);
    } else {
      error("NextJS request failed.", e);
      await tryRenderError("500", res, routingResult.internalEvent);
    }
  }
}
async function handleNoFallbackError(req, res, routingResult, metadata, index = 1) {
  if (index >= 5) {
    await tryRenderError("500", res, routingResult.internalEvent);
    return;
  }
  if (index >= routingResult.resolvedRoutes.length) {
    await tryRenderError("404", res, routingResult.internalEvent);
    return;
  }
  try {
    await requestHandler({
      ...routingResult,
      invokeOutput: routingResult.resolvedRoutes[index].route,
      ...metadata
    })(req, res);
  } catch (e) {
    if (e.constructor.name === "NoFallbackError") {
      await handleNoFallbackError(req, res, routingResult, metadata, index + 1);
    } else {
      error("NextJS request failed.", e);
      await tryRenderError("500", res, routingResult.internalEvent);
    }
  }
}
async function tryRenderError(type, res, internalEvent) {
  try {
    const _req = new IncomingMessage({
      method: "GET",
      url: `/${type}`,
      headers: internalEvent.headers,
      body: internalEvent.body,
      remoteAddress: internalEvent.remoteAddress
    });
    const requestMetadata = {
      // By setting invokePath and invokeQuery we can bypass some of the routing logic in Next.js
      invokePath: type === "404" ? "/404" : "/500",
      invokeStatus: type === "404" ? 404 : 500,
      middlewareInvoke: false
    };
    await requestHandler(requestMetadata)(_req, res);
  } catch (e) {
    error("NextJS request failed.", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      message: "Server failed to respond.",
      details: e
    }, null, 2));
  }
}

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
  const m_1 = await Promise.resolve().then(() => (init_cloudflare_node(), cloudflare_node_exports));
  return m_1.default;
}
async function resolveTagCache(tagCache) {
  if (typeof tagCache === "function") {
    return tagCache();
  }
  const m_1 = await Promise.resolve().then(() => (init_dummy(), dummy_exports));
  return m_1.default;
}
async function resolveQueue(queue2) {
  if (typeof queue2 === "function") {
    return queue2();
  }
  const m_1 = await Promise.resolve().then(() => (init_direct(), direct_exports));
  return m_1.default;
}
async function resolveIncrementalCache(incrementalCache) {
  if (typeof incrementalCache === "function") {
    return incrementalCache();
  }
  const m_1 = await Promise.resolve().then(() => (init_dummy2(), dummy_exports2));
  return m_1.default;
}
async function resolveAssetResolver(assetResolver) {
  if (typeof assetResolver === "function") {
    return assetResolver();
  }
  const m_1 = await Promise.resolve().then(() => (init_dummy3(), dummy_exports3));
  return m_1.default;
}
async function resolveProxyRequest(proxyRequest) {
  if (typeof proxyRequest === "function") {
    return proxyRequest();
  }
  const m_1 = await Promise.resolve().then(() => (init_fetch(), fetch_exports));
  return m_1.default;
}
async function resolveCdnInvalidation(cdnInvalidation) {
  if (typeof cdnInvalidation === "function") {
    return cdnInvalidation();
  }
  const m_1 = await Promise.resolve().then(() => (init_dummy4(), dummy_exports4));
  return m_1.default;
}

// node_modules/@opennextjs/aws/dist/core/createMainHandler.js
async function createMainHandler() {
  const config = await import("./open-next.config.mjs").then((m) => m.default);
  const thisFunction = globalThis.fnName ? config.functions[globalThis.fnName] : config.default;
  globalThis.serverId = generateUniqueId();
  globalThis.openNextConfig = config;
  await globalThis.__next_route_preloader("start");
  globalThis.queue = await resolveQueue(thisFunction.override?.queue);
  globalThis.incrementalCache = await resolveIncrementalCache(thisFunction.override?.incrementalCache);
  globalThis.tagCache = await resolveTagCache(thisFunction.override?.tagCache);
  if (config.middleware?.external !== true) {
    globalThis.assetResolver = await resolveAssetResolver(globalThis.openNextConfig.middleware?.assetResolver);
  }
  globalThis.proxyExternalRequest = await resolveProxyRequest(thisFunction.override?.proxyExternalRequest);
  globalThis.cdnInvalidationHandler = await resolveCdnInvalidation(thisFunction.override?.cdnInvalidation);
  const converter2 = await resolveConverter(thisFunction.override?.converter);
  const { wrapper, name } = await resolveWrapper(thisFunction.override?.wrapper);
  debug("Using wrapper", name);
  return wrapper(openNextHandler, converter2);
}

// node_modules/@opennextjs/aws/dist/adapters/server-adapter.js
setNodeEnv();
setNextjsServerWorkingDirectory();
globalThis.internalFetch = fetch;
var handler2 = await createMainHandler();
function setNextjsServerWorkingDirectory() {
  process.chdir(__dirname);
}
export {
  handler2 as handler
};
