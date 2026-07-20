/**
 * 复制本文件为 config.ts 后按需修改：
 *   cp src/config.example.ts src/config.ts
 *
 * config.ts 不会进 git，避免把个人白名单提交上去。
 */
export const config = {
    /** 静态首页资源，一般不用改 */
    assetUrl: "https://asjdf.github.io/ghproxy/",

    /**
     * 路由前缀。根路径为 "/"；
     * 若自定义路由为 example.com/gh/*，改为 "/gh/"（少一个杠都会错）
     */
    prefix: "/",

    /** 分支文件是否走 jsDelivr：0 关闭，1 开启 */
    jsdelivr: 0 as 0 | 1,

    /**
     * 白名单：路径包含其中任一字符串才放行。
     * 空数组 [] = 不限制（谁都能用，容易被薅）。
     * 个人自用建议：["/username/", "/org/"]
     */
    whiteList: [] as string[],

    /** 自定义日志采样率 0–1；blocked/错误始终记录 */
    logSampleRate: 0.1,
};
