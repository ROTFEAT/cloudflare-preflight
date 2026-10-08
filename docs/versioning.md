# 版本管理 / Versioning

当前展示版本为 **1.00**，标准软件版本为 **1.0.0**，Git 标签为 **v1.00**。`1.00` 是本次发布名称；npm、规则注册表、报告和安装包采用三段式版本 `1.0.0`。两种标识对应同一份代码，不代表两个版本。

The current display release is **1.00**, its package/report version is **1.0.0**, and its Git tag is **v1.00**. These identify the same release. Protocol `schema_version` values and pinned upstream dependency versions are independent of this project version.

## 版本身份

[Skill 内的 version.json](../.agents/skills/cloudflare-cost-safety/version.json) 是运行时代码和打包程序读取的版本清单：

```json
{
  "version": "1.0.0",
  "display_version": "1.00"
}
```

CLI、生成规则表和归档文件名从该清单取标准版本；安装器会一起分发该文件。Skill 元数据／界面和双语 README 显示 `1.00`。`npm test` 的打包阶段核对 package.json、package-lock.json、两份规则表与安装包中的版本，实际在干净离线环境运行版本查询，发生不一致就失败。

```sh
node .agents/skills/cloudflare-cost-safety/scripts/cli.mjs version
# name, version: 1.0.0, display_version: 1.00, tag: v1.00

node .agents/skills/cloudflare-cost-safety/scripts/cli.mjs --version
# 1.0.0
```

## 后续发布流程

1. 选择新的展示版本和标准版本，在 version.json 中记录明确对应关系。标准版本按修复／兼容新增／不兼容变更递增 PATCH／MINOR／MAJOR；不根据 `1.00` 自动推算后续格式。
2. 使用 `npm version NEXT_SEMVER --no-git-tag-version --ignore-scripts` 同步 package.json 与 package-lock.json；将 `NEXT_SEMVER` 替换为实际版本。更新 SKILL.md metadata、agents/openai.yaml、两份 README 和 CHANGELOG。
3. 运行 `node scripts/generate-data.mjs` 更新规则表，再运行 `npm test`。保留真实日志和新安装包的 SHA-256；历史独立审查记录保持原样。
4. 审阅后提交代码，再创建带说明的 Git 标签，例如本次 `git tag -a v1.00 -m 'Cloudflare Cost Safety 1.00 (1.0.0)'`。将提交及该标签推送到目标仓库；已发布标签不移动、不覆盖。
5. 有修复时创建新版本。工具／规则／策略变更会使旧信任 pin 或应用审查证据失效，应重建受保护安装、重新核对信任并审查，不能靠修改版本号复用旧批准。

For future releases, update the version manifest and package/lock metadata, regenerate the catalogs, update the Skill metadata and bilingual documentation, run the complete checks, and commit the reviewed files before creating an annotated tag. Never move a published tag. Keep historical evidence unchanged and regenerate trust pins when tool content changes.

标签固定代码状态；本地生成的安装包摘要另记录在 package-check.json 中。归档目前包含文件时间戳，不承诺多次打包逐字节相同；下载或交接时应核验所分发归档的实际摘要。创建 Git 标签不会执行 Cloudflare 部署，也不会自动发布到 npm。
