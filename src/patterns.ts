/**
 * URL shapes this worker will proxy (vs treating as static GitHub Pages assets).
 * Keep in sync with README "支持的链接格式".
 */

export const releaseExp =
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases(?:\.atom|\/.*)|archive\/.*)$/i;
export const fileExp =
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i;
export const infoExp =
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i;
export const rawExp =
    /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i;
export const gistExp =
    /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i;
export const tagsPageExp =
    /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i;
export const apiExp = /^(?:https?:\/\/)?api\.github\.com\/.*$/i;
export const oauthExp =
    /^(?:https?:\/\/)?github\.com\/login\/oauth\/.*$/i;

const proxyPatterns = [
    releaseExp,
    fileExp,
    infoExp,
    rawExp,
    gistExp,
    tagsPageExp,
    apiExp,
    oauthExp,
];

/** True when the path/URL should be reverse-proxied to GitHub, not ASSET_URL. */
export function isProxyableUrl(u: string): boolean {
    for (const re of proxyPatterns) {
        if (u.search(re) === 0) return true;
    }
    return false;
}

/** Cache TTL seconds; 0 = do not cache. */
export function cacheTtlFor(url: string): number {
    if (
        infoExp.test(url) ||
        apiExp.test(url) ||
        oauthExp.test(url) ||
        tagsPageExp.test(url)
    ) {
        return 0;
    }
    // releases.atom changes when a release is published; short edge cache.
    if (/\/releases\.atom$/i.test(url)) return 300;
    if (/\/releases\/download\//i.test(url)) return 604800;
    if (/\/archive\//i.test(url)) return 86400;
    if (rawExp.test(url) || /\/raw\//i.test(url)) return 3600;
    if (gistExp.test(url)) return 3600;
    return 0;
}
