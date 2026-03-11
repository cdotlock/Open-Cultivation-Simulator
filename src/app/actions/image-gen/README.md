# 统一图像生成 API

这个模块提供统一的图像生成入口，当前支持：

- `qwen`
- `doubao-seedream`

## 当前约束

- 图像生成在开源单机版中是可选功能
- 生成成功后写入本地 `public/generated/`
- 返回值中的 `url` 是本地可访问路径，不是 OSS 地址

## 基本用法

```typescript
import { generateImage } from "@/app/actions/image-gen";

const result = await generateImage({
  prompt: "一名立于云海之上的剑修",
  model: "qwen",
  size: "1328*1328",
});

if (result.success) {
  console.log(result.url);
}
```

## 返回结构

```typescript
{
  success: boolean;
  url?: string;   // 本地生成文件的访问路径
  error?: string;
  model?: string;
}
```

## 说明

- 尺寸兼容和参数验证由统一入口负责
- 具体 provider 差异由各自适配文件处理
- 上层主流程必须把该功能视为软依赖
