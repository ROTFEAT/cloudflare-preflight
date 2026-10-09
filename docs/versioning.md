# 版本管理 / Versioning

当前展示版本为 **1.01**，标准软件版本为 **1.0.1**，Git 标签为 **v1.01**。npm、规则注册表、报告和安装包采用三段式标准版本；展示版本与标准版本对应同一次提交。

The current display release is **1.01**, its package/report version is **1.0.1**, and its Git tag is **v1.01**. These identify the same commit. Protocol `schema_version` values and pinned upstream dependency versions are independent of this project version.

## 每次提交都升版

从 **1.01** 起，每次新提交都递增版本号，**包括只修改 README、其他文档、CI 或元数据的提交**。修改内容、版本更新和更新日志放在同一次提交中。

- 展示版本每次前进一步：`1.00 → 1.01 → 1.02`，小数点后固定两位；`1.99` 之后为 `2.00`。按整数序号维护，不用浮点加法计算版本。
- 标准软件版本每次至少递增 PATCH，例如 `1.0.0 → 1.0.1 → 1.0.2`；兼容新增与不兼容改动分别按 SemVer 递增 MINOR／MAJOR。
- 每次提交记录版本对应关系和改动说明；推送 GitHub 时创建同名带说明标签，例如 `v1.01`。已发布标签不移动、不覆盖。
- 历史需求、测试日志和审查证据保留原始版本。新增验证记录按 `docs/test-results/vDISPLAY_VERSION/` 分目录保存，不把旧日志改成新版本。

Every new commit increments both version identifiers, including documentation-only and CI changes. Commit the intended changes, version updates, and changelog together. Create an annotated tag for each version pushed to GitHub. Keep historical evidence unchanged. This policy also lives in [AGENTS.md](../AGENTS.md) for future contributors and coding agents.

## 版本身份

[Skill 内的 version.json](../.agents/skills/cloudflare-cost-safety/version.json) 是运行时代码和打包程序读取的版本清单：

```json
{
  "version": "1.0.1",
  "display_version": "1.01"
}
```

CLI、生成规则表和归档文件名从该清单取标准版本；安装器会一起分发该文件。Skill 元数据／界面和双语 README 显示 `1.01`。`npm test` 的打包阶段核对 package.json、package-lock.json、两份规则表与安装包中的版本，实际在干净离线环境运行版本查询，发生不一致就失败。

```sh
node .agents/skills/cloudflare-cost-safety/scripts/cli.mjs version
# name, version: 1.0.1, display_version: 1.01, tag: v1.01

node .agents/skills/cloudflare-cost-safety/scripts/cli.mjs --version
# 1.0.1
```

## 提交与发布流程

1. 完成准备提交的改动，递增展示版本与标准版本，在 version.json 中记录对应关系。即使只有文档或 CI 改动，也要升版。
2. 使用 `npm version NEXT_SEMVER --no-git-tag-version --ignore-scripts` 同步 package.json 与 package-lock.json；将 `NEXT_SEMVER` 替换为实际版本。更新 SKILL.md metadata／正文、agents/openai.yaml、两份 README、当前使用指南／样本、CHANGELOG 和本页。
3. 运行 `node scripts/generate-data.mjs` 更新规则表，再运行 `npm test`。将实际日志、summary.json 与包含安装包 SHA-256 的 package-check.json 保存到本次版本目录；历史独立审查记录保持原样。
4. 核对版本、文档链接与测试记录，将全部改动放入同一次提交，再创建带说明的 Git 标签，例如本次 `git tag -a v1.01 -m 'Cloudflare Cost Safety 1.01 (1.0.1)'`。将提交及该标签推送到目标仓库；已发布标签不移动、不覆盖。
5. 有修复时创建新版本。工具／规则／策略变更会使旧信任 pin 或应用审查证据失效，应重建受保护安装、重新核对信任并审查，不能靠修改版本号复用旧批准。

For future releases, update the version manifest and package/lock metadata, regenerate the catalogs, update the Skill metadata and bilingual documentation, run the complete checks, and commit the reviewed files before creating an annotated tag. Never move a published tag. Keep historical evidence unchanged and regenerate trust pins when tool content changes.

标签固定代码状态；本地生成的安装包摘要另记录在 package-check.json 中。归档目前包含文件时间戳，不承诺多次打包逐字节相同；下载或交接时应核验所分发归档的实际摘要。创建 Git 标签不会执行 Cloudflare 部署，也不会自动发布到 npm。
