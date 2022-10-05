# ghproxy 🚀

## 简介

github api、release、archive以及项目文件的加速项目，支持clone，有Cloudflare Workers无服务器版本

## 使用

直接在copy出来的url前加你 Cloudflare Worker 的域名即可

访问私有仓库可以通过

`git clone https://user:TOKEN@ghproxy.com/https://github.com/xxxx/xxxx` [hunshcn/gh-proxy#71](https://github.com/hunshcn/gh-proxy/issues/71)

以下都是合法输入（仅示例，文件不存在）：

- 分支源码：https://github.com/asjdf/project/archive/master.zip

- release源码：https://github.com/asjdf/project/archive/v0.1.0.tar.gz

- release文件：https://github.com/asjdf/project/releases/download/v0.1.0/example.zip

- 分支文件：https://github.com/asjdf/project/blob/master/filename

- commit文件：https://github.com/asjdf/project/blob/1111111111111111111111111111/filename

- gist：https://gist.githubusercontent.com/cielpy/351557e6e465c12986419ac5a4dd2568/raw/cmd.py

- api: https://api.github.com/repos/foooooooooooooooo/baaaaaaaaaaaaar/releases/latest

## cf worker部署

首先进行个性化设置

`ASSET_URL`是静态资源的url（实际上就是现在显示出来的那个输入框单页面，可不修改，除非你加了新的feature）

`PREFIX`是前缀，默认（根路径情况为"/"），如果自定义路由为example.com/gh/*，请将PREFIX改为 '/gh/'，注意，少一个杠都会错！

`whiteList`是白名单，建议个人自用的时候根据需要进行设置，防止被薅羊毛

执行 `wrangler publish src/index.ts --name ghproxy` 部署你自己的代理

## Cloudflare Workers计费

到 `overview` 页面可参看使用情况。免费版每天有 10 万次免费请求，并且有每分钟1000次请求的限制。

如果不够用，可升级到 $5 的高级版本，每月可用 1000 万次请求（超出部分 $0.5/百万次请求）。

## 链接

[我的博客](https://homeboyc.cn/)

## 参考

[jsproxy](https://github.com/EtherDream/jsproxy/)

[gh-proxy](https://github.com/hunshcn/gh-proxy)
