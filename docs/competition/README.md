# Scry 中国软件杯 A2 提交文档

本目录围绕“面向麒麟操作系统的安全智能运维 Agent 设计与实现”赛题整理。五份初赛必交文档均保留 Markdown 源文件，并生成同名 PDF。

已在麒麟高级服务器操作系统 V11 + 龙芯（LoongArch）平台完成软件适应性测试，确保 Scry 可以在该环境下完美运行。考虑到麒麟-龙芯实体环境的持续使用成本，除适应性测试外，现阶段其他功能与性能测试主要在 macOS 开发环境及其中运行的麒麟系统虚拟机中开展；后续将在麒麟-龙芯平台补充相应测试。

| 序号 | 文档 | Markdown | PDF |
|---|---|---|---|
| 1 | 软件功能需求分析文档 | `01-software-functional-requirements-analysis.md` | `pdf/01-software-functional-requirements-analysis.pdf` |
| 2 | 软件功能设计文档 | `02-software-functional-design.md` | `pdf/02-software-functional-design.pdf` |
| 3 | 软件产品说明书 | `03-software-product-manual.md` | `pdf/03-software-product-manual.pdf` |
| 4 | 软件功能测试报告 | `04-software-functional-test-report.md` | `pdf/04-software-functional-test-report.pdf` |
| 5 | 软件性能（核心指标）测试报告 | `05-software-performance-core-metrics-test-report.md` | `pdf/05-software-performance-core-metrics-test-report.pdf` |

## 生成 PDF

渲染器复用前端工程已安装的 `marked` 和 Playwright Chromium：

```bash
node docs/competition/render-submission-pdfs.cjs
```

PDF 同时写入：

- `docs/competition/pdf/`：随麒麟发布包一起提交。
- `output/pdf/`：仓库统一的最终 PDF 输出目录。
