/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

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
		const ret = fetchHandler(request).catch((err) =>
			makeRes("cfworker error:\n" + err.stack, 502)
		);
		return await ret;
    },
};

/**
 * static files (404.html, sw.js, conf.js)
 */
const ASSET_URL = "https://hunshcn.github.io/gh-proxy/";
// 前缀，如果自定义路由为example.com/gh/*，将PREFIX改为 '/gh/'，注意，少一个杠都会错！
const PREFIX = "/";
// 分支文件使用jsDelivr镜像的开关，0为关闭，默认关闭
const Config = {
    jsdelivr: 0,
};

const whiteList: string[] = []; // 白名单，路径里面有包含字符的才会通过，e.g. ['/username/']

/** @type {RequestInit} */
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
    for (let i of [releaseExp, fileExp, infoExp, rawExp, gistExp, tagsPageExp,apiExp]) {
        if (u.search(i) === 0) {
            return true;
        }
    }
    return false;
}

/**
 * @param {Request} req
 */
async function fetchHandler(req:Request): Promise<Response> {
    const urlStr = req.url;
    const urlObj = new URL(urlStr);
    let path = urlObj.searchParams.get("q");
    if (path) {
        return Response.redirect("https://" + urlObj.host + PREFIX + path, 301);
    }
    // cfworker 会把路径中的 `//` 合并成 `/`
    path = urlObj.href
        .substr(urlObj.origin.length + PREFIX.length)
        .replace(/^https?:\/+/, "https://");
    if (
        path.search(releaseExp) === 0 ||
        path.search(gistExp) === 0 ||
        path.search(tagsPageExp) === 0 ||
        path.search(infoExp) === 0 ||
        path.search(rawExp) === 0 ||
		path.search(apiExp) === 0
    ) {
        return await httpHandler(req, path);
    } else if (path.search(fileExp) === 0) {
        if (Config.jsdelivr) {
            const newUrl = path
                .replace("/blob/", "@")
                .replace(
                    /^(?:https?:\/\/)?github\.com/,
                    "https://cdn.jsdelivr.net/gh"
                );
            return Response.redirect(newUrl, 302);
        } else {
            path = path.replace("/blob/", "/raw/");
            return await httpHandler(req, path);
        }
    } else if (path.search(rawExp) === 0) {
        const newUrl = path
            .replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, "@$1")
            .replace(
                /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com/,
                "https://cdn.jsdelivr.net/gh"
            );
        return Response.redirect(newUrl, 302);
    } else {
        return await fetch(ASSET_URL + path);
    }
}

/**
 * @param {Request} req
 * @param {string} pathname
 */
async function httpHandler(
    req: Request,
    pathname: string
): Promise<Response> {
    const reqHdrRaw = req.headers;

    // preflight
    if (
        req.method === "OPTIONS" &&
        reqHdrRaw.has("access-control-request-headers")
    ) {
        return new Response(null, PREFLIGHT_INIT);
    }

	console.log(reqHdrRaw);
    const reqHdrNew = new Headers(reqHdrRaw);

    let urlStr = pathname;
    let flag = !Boolean(whiteList.length);
    for (let i of whiteList) {
        if (urlStr.includes(i)) {
            flag = true;
            break;
        }
    }
    if (!flag) {
        return new Response("blocked", { status: 403 });
    }
    if (urlStr.startsWith("github")) {
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
    return await proxy(urlObj, reqInit);
}

/**
 *
 * @param {URL} urlObj
 * @param {RequestInit} reqInit
 */
async function proxy(
    urlObj: URL | null,
    reqInit: RequestInit
): Promise<Response> {
    if (urlObj === null) {
        return new Response("invalid url", { status: 400 });
    }
	console.log(urlObj.href);
    const res = await fetch(urlObj.href, reqInit);
    const resHdrOld = res.headers;
    const resHdrNew = new Headers(resHdrOld);

    const status = res.status;

    if (resHdrNew.has("location")) {
        let _location = resHdrNew.get("location") || "";
        if (checkUrl(_location)) resHdrNew.set("location", PREFIX + _location);
        else {
            reqInit.redirect = "follow";
            return proxy(newUrl(_location), reqInit);
        }
    }
    resHdrNew.set("access-control-expose-headers", "*");
    resHdrNew.set("access-control-allow-origin", "*");

    resHdrNew.delete("content-security-policy");
    resHdrNew.delete("content-security-policy-report-only");
    resHdrNew.delete("clear-site-data");

    return new Response(res.body, {
        status,
        headers: resHdrNew,
    });
}
