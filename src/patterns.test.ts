import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cacheTtlFor, isProxyableUrl, releaseExp } from "./patterns.ts";

describe("isProxyableUrl", () => {
    const ok = [
        "https://api.github.com/repos/juanjiTech/termium/releases",
        "https://github.com/juanjiTech/termium/releases/download/v1.0.0/a.dmg",
        "https://github.com/juanjiTech/termium/archive/refs/tags/v1.0.0.tar.gz",
        "https://github.com/juanjiTech/termium/blob/main/README.md",
        "https://raw.githubusercontent.com/juanjiTech/termium/main/README.md",
        "https://github.com/juanjiTech/termium/tags",
        // Termium changelog: Atom feed (NOT /releases/… — no slash after releases)
        "https://github.com/juanjiTech/termium/releases.atom",
        "github.com/juanjiTech/termium/releases.atom",
    ];

    for (const u of ok) {
        it(`proxies ${u}`, () => {
            assert.equal(isProxyableUrl(u), true);
        });
    }

    const no = [
        "https://github.com/juanjiTech/termium",
        "https://github.com/juanjiTech/termium/issues",
        "https://asjdf.github.io/ghproxy/",
    ];

    for (const u of no) {
        it(`does not proxy ${u}`, () => {
            assert.equal(isProxyableUrl(u), false);
        });
    }
});

describe("releaseExp covers atom vs download", () => {
    it("matches releases.atom without requiring a slash after releases", () => {
        assert.equal(
            releaseExp.test(
                "https://github.com/juanjiTech/termium/releases.atom"
            ),
            true
        );
    });

    it("still matches release download paths", () => {
        assert.equal(
            releaseExp.test(
                "https://github.com/juanjiTech/termium/releases/download/v1/a.dmg"
            ),
            true
        );
    });
});

describe("cacheTtlFor", () => {
    it("caches releases.atom briefly", () => {
        assert.equal(
            cacheTtlFor("https://github.com/juanjiTech/termium/releases.atom"),
            300
        );
    });
});
