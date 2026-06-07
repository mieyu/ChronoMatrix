# 时矩 ChronoMatrix

本地优先的 macOS 桌面端计划管理程序，基于 Tauri、React、Vite、TypeScript、Tailwind CSS、shadcn/ui 和 SQLite。

## 当前状态

当前版本是可运行的 MVP 开发版：

- 矩阵视图：按重要/紧急四象限展示计划，时间越近越靠近中心。
- 日历视图：支持周/月切换，有开始和结束时间的计划显示为跨日期长条。
- 列表视图：展示全部计划，支持查看状态和快速编辑。
- 计划管理：支持新增、编辑、删除、标记完成。
- 本地存储：桌面端使用 SQLite，开发浏览器预览使用 localStorage fallback。

## 项目结构

```text
docs/              产品、验收和发布说明
src/               React 前端源码
src/components/    视图和 UI 组件
src/data/          SQLite 数据访问
src/domain/        计划、日历、矩阵等业务规则与测试
src/lib/           通用工具函数
src/state/         Zustand UI 状态
src-tauri/         Tauri/Rust 桌面端配置和入口
```

更多说明见：

- [产品说明](docs/PRODUCT.md)
- [验收清单](docs/QA.md)
- [发布说明](docs/RELEASE.md)

## 环境

- Node.js 22+
- npm 10+
- Rust 1.96.0，项目通过 `rust-toolchain.toml` 锁定
- Xcode / clang

项目不会修改 shell PATH。`npm run tauri` 会在当前命令中临时加入 `~/.cargo/bin`。

## 开发

```bash
npm install
npm run tauri dev
```

如果当前 shell 里有不可用的本地代理变量，可以临时清空后运行：

```bash
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy npm run tauri -- build --debug --bundles app
```

## 验证

```bash
npm test -- src/domain/calendar.test.ts src/domain/plan.test.ts
npm run build
npm run tauri -- build --debug --bundles app
```

debug `.app` 输出路径：

```text
src-tauri/target/debug/bundle/macos/ChronoMatrix.app
```

## GitHub

仓库地址：

```text
https://github.com/mieyu/ChronoMatrix.git
```
