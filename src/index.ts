/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { config } from "./config";

export interface Env {
    // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
    // MY_KV_NAMESPACE: KVNamespace;
    //
    // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
    // MY_DURABLE_OBJECT: DurableObjectNamespace;
    //
    // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
    // MY_BUCKET: R2Bucket;
}

export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        const ret = fetchHandler(request, ctx).catch((err) =>
            makeRes("cfworker error:\n" + err.stack, 502)
        );
        return await ret;
    },
};

const {
    assetUrl: ASSET_URL,
    prefix: PREFIX,
    jsdelivr,
    whiteList,
    logSampleRate,
} = config;

/** @type {ResponseInit} */
const PREFLIGHT_INIT = {
    status: 204,
    headers: new Headers({
        "access-control-allow-origin": "*",
        "access-control-allow-methods":
            "GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS",
        "access-control-max-age": "1728000",
    }),
};

const releaseExp =
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i;
const fileExp = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i;
const infoExp = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i;
const rawExp =
    /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i;
const gistExp =
    /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i;
const tagsPageExp = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i;
const apiExp = /^(?:https?:\/\/)?api\.github\.com\/.*$/i;
const oauthExp = /^(?:https?:\/\/)?github\.com\/login\/oauth\/.*$/i;

/**
 * @param {any} body
 * @param {number} status
 * @param {Object<string, string>} headers
 */
function makeRes(body: any, status = 200, headers: any = {}) {
    headers["access-control-allow-origin"] = "*";
    return new Response(body, { status, headers });
}

/**
 * @param {string} urlStr
 */
function newUrl(urlStr: string) {
    try {
        return new URL(urlStr);
    } catch (err) {
        return null;
    }
}

function checkUrl(u: string) {
    for (let i of [
        releaseExp,
        fileExp,
        infoExp,
        rawExp,
        gistExp,
        tagsPageExp,
        apiExp,
        oauthExp,
    ]) {
        if (u.search(i) === 0) {
            return true;
        }
    }
    return false;
}

/** release/archive/raw/gist 可缓存；git/api/oauth 不缓存 */
function cacheTtlFor(url: string): number {
    if (
        infoExp.test(url) ||
        apiExp.test(url) ||
        oauthExp.test(url) ||
        tagsPageExp.test(url)
    ) {
        return 0;
    }
    if (/\/releases\/download\//i.test(url)) return 604800;
    if (/\/archive\//i.test(url)) return 86400;
    if (rawExp.test(url) || /\/raw\//i.test(url)) return 3600;
    if (gistExp.test(url)) return 3600;
    return 0;
}

/** 首页静态资源放行；其余疑似代理路径走白名单 */
function isStaticAssetPath(path: string) {
    if (!path || path === "/") return true;
    if (/^https?:\/\//i.test(path)) return false;
    if (
        /^(?:github\.com|raw\.(?:githubusercontent|github)\.com|gist\.(?:githubusercontent|github)\.com|api\.github\.com)/i.test(
            path
        )
    ) {
        return false;
    }
    return true;
}

function allowedByWhiteList(urlStr: string) {
    if (!whiteList.length) return true;
    return whiteList.some((item) => urlStr.includes(item));
}

function blocked(method: string, target: string) {
    log(`blocked ${method} ${target}`, {
        event: "blocked",
        method,
        target,
    });
    return new Response("blocked", { status: 403 });
}

/** Workers Logs 用 message 字符串渲染；blocked/错误始终记录 */
function log(
    message: string,
    fields: Record<string, string | number | boolean | undefined> = {}
) {
    const event = fields.event;
    const status = fields.status;
    const always =
        event === "blocked" ||
        event === "proxy_error" ||
        (typeof status === "number" && status >= 400);
    if (!always && Math.random() >= logSampleRate) return;
    console.log({ message, ...fields });
}

function finalizeResponse(res: Response): Response {
    const headers = new Headers(res.headers);
    headers.set("access-control-expose-headers", "*");
    headers.set("access-control-allow-origin", "*");
    headers.delete("content-security-policy");
    headers.delete("content-security-policy-report-only");
    headers.delete("clear-site-data");
    return new Response(res.body, { status: res.status, headers });
}

/**
 * @param {Request} req
 */
async function fetchHandler(
    req: Request,
    ctx: ExecutionContext
): Promise<Response> {
    const urlStr = req.url;
    const urlObj = new URL(urlStr);
    let path = urlObj.searchParams.get("q");
    if (path) {
        if (!allowedByWhiteList(path)) {
            return blocked(req.method, path);
        }
        const location = "https://" + urlObj.host + PREFIX + path;
        log(`redirect q_param -> ${location}`, {
            event: "redirect",
            reason: "q_param",
            method: req.method,
            from: urlObj.pathname + urlObj.search,
            to: location,
        });
        return Response.redirect(location, 301);
    }
    // cfworker 会把路径中的 `//` 合并成 `/`
    path = urlObj.href
        .substr(urlObj.origin.length + PREFIX.length)
        .replace(/^https?:\/+/, "https://");

    if (!isStaticAssetPath(path) && !allowedByWhiteList(path)) {
        return blocked(req.method, path);
    }

    if (
        path.search(releaseExp) === 0 ||
        path.search(gistExp) === 0 ||
        path.search(tagsPageExp) === 0 ||
        path.search(infoExp) === 0 ||
        path.search(rawExp) === 0 ||
        path.search(apiExp) === 0 ||
        path.search(oauthExp) === 0
    ) {
        return await httpHandler(req, path, ctx);
    } else if (path.search(fileExp) === 0) {
        if (jsdelivr) {
            const newUrl = path
                .replace("/blob/", "@")
                .replace(
                    /^(?:https?:\/\/)?github\.com/,
                    "https://cdn.jsdelivr.net/gh"
                );
            log(`redirect jsdelivr_blob ${path} -> ${newUrl}`, {
                event: "redirect",
                reason: "jsdelivr_blob",
                method: req.method,
                from: path,
                to: newUrl,
            });
            return Response.redirect(newUrl, 302);
        } else {
            path = path.replace("/blob/", "/raw/");
            return await httpHandler(req, path, ctx);
        }
    } else {
        const assetUrl = ASSET_URL + path;
        log(`asset ${path || "/"}`, {
            event: "asset",
            method: req.method,
            path: path || "/",
            assetUrl,
        });
        return await fetch(assetUrl);
    }
}

/**
 * @param {Request} req
 * @param {string} pathname
 */
async function httpHandler(
    req: Request,
    pathname: string,
    ctx: ExecutionContext
): Promise<Response> {
    const reqHdrRaw = req.headers;

    // preflight
    if (
        req.method === "OPTIONS" &&
        reqHdrRaw.has("access-control-request-headers")
    ) {
        return new Response(null, PREFLIGHT_INIT);
    }

    const reqHdrNew = new Headers(reqHdrRaw);

    let urlStr = pathname;
    if (!allowedByWhiteList(urlStr)) {
        return blocked(req.method, urlStr);
    }
    if (urlStr.search(/^https?:\/\//) !== 0) {
        urlStr = "https://" + urlStr;
    }
    const urlObj = newUrl(urlStr);

    /** @type {RequestInit} */
    const reqInit = {
        method: req.method,
        headers: reqHdrNew,
        redirect: "manual",
        body: req.body,
    };
    return await proxy(urlObj, reqInit, req, ctx);
}

/**
 *
 * @param {URL} urlObj
 * @param {RequestInit} reqInit
 */
async function proxy(
    urlObj: URL | null,
    reqInit: RequestInit,
    req: Request,
    ctx: ExecutionContext
): Promise<Response> {
    if (urlObj === null) {
        log(`proxy_error invalid_url ${reqInit.method}`, {
            event: "proxy_error",
            reason: "invalid_url",
            method: String(reqInit.method ?? ""),
        });
        return new Response("invalid url", { status: 400 });
    }

    const method = String(reqInit.method ?? "GET");
    const ttl = cacheTtlFor(urlObj.href);
    const cacheable =
        ttl > 0 &&
        (method === "GET" || method === "HEAD") &&
        !req.headers.has("Range");

    if (cacheable) {
        const cache = caches.default;
        const cacheKey = new Request(urlObj.href, { method });
        const hit = await cache.match(cacheKey);
        if (hit) {
            log(`cache_hit ${method} ${urlObj.href}`, {
                event: "cache_hit",
                method,
                target: urlObj.href,
            });
            return hit;
        }
    }

    const res = await fetch(urlObj.href, reqInit);
    const resHdrNew = new Headers(res.headers);
    const status = res.status;

    if (resHdrNew.has("location")) {
        let _location = resHdrNew.get("location") || "";
        if (checkUrl(_location)) {
            const rewritten = PREFIX + _location;
            log(`proxy ${method} ${urlObj.href} -> ${status} loc=${rewritten}`, {
                event: "proxy",
                method,
                target: urlObj.href,
                status,
                location: rewritten,
                follow: false,
            });
            resHdrNew.set("location", rewritten);
        } else {
            log(`proxy_follow ${method} ${urlObj.href} -> ${_location}`, {
                event: "proxy_follow",
                method,
                from: urlObj.href,
                to: _location,
                status,
            });
            reqInit.redirect = "follow";
            return proxy(newUrl(_location), reqInit, req, ctx);
        }
    } else {
        log(`proxy ${method} ${urlObj.href} -> ${status}`, {
            event: "proxy",
            method,
            target: urlObj.href,
            status,
        });
    }

    let out = finalizeResponse(
        new Response(res.body, { status, headers: resHdrNew })
    );

    if (cacheable && out.ok) {
        out.headers.set("Cache-Control", `public, max-age=${ttl}`);
        ctx.waitUntil(caches.default.put(new Request(urlObj.href, { method }), out.clone()));
    }

    return out;
}
