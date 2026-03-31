# Claude 工作规范

## 提交规则

完成一个功能后，立即执行 `git commit`，清楚描述做了什么。对于太细节的工作（如修改推送规则等）不用记录 commit，只记录有关项目修改或完善功能的部分。

**不要自动 push**。积累多个 commit，等用户明确说"推送"或"push"时，必须先进行 `squash commits`（将多个琐碎的 commit 压缩成一个有意义的 commit），然后再执行 `git push`。
