# 文字处理工具 - GitHub 上传脚本
# 使用方式：在终端中运行  .\upload.ps1

$repoUrl = "https://github.com/OLShopping/text-processor.git"

Write-Host "初始化 Git 仓库..." -ForegroundColor Cyan
git init
git add text-processor.html README.md
git commit -m "feat: 文字处理工具 - 图书简介HTML格式化"

Write-Host "添加远程仓库..." -ForegroundColor Cyan
git remote add origin $repoUrl

Write-Host "推送到 GitHub..." -ForegroundColor Cyan
git branch -M main
git push -u origin main

Write-Host "✅ 上传完成！" -ForegroundColor Green
