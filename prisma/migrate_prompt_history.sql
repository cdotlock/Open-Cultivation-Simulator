-- 迁移现有的Dictionary prompt数据到PromptHistory表

-- 插入character_prompt历史记录
INSERT IGNORE INTO PromptHistory (name, content, description, version, isActive, createdAt, updatedAt)
SELECT 
  'character_prompt',
  value,
  '从Dictionary表迁移的初始版本',
  1,
  true,
  NOW(),
  NOW()
FROM Dictionary 
WHERE `key` = 'character_prompt';

-- 插入story_prompt历史记录
INSERT IGNORE INTO PromptHistory (name, content, description, version, isActive, createdAt, updatedAt)
SELECT 
  'story_prompt',
  value,
  '从Dictionary表迁移的初始版本',
  1,
  true,
  NOW(),
  NOW()
FROM Dictionary 
WHERE `key` = 'story_prompt';

-- 插入summary_prompt历史记录
INSERT IGNORE INTO PromptHistory (name, content, description, version, isActive, createdAt, updatedAt)
SELECT 
  'summary_prompt',
  value,
  '从Dictionary表迁移的初始版本',
  1,
  true,
  NOW(),
  NOW()
FROM Dictionary 
WHERE `key` = 'summary_prompt';

-- 插入其他prompt历史记录（如果存在）
INSERT IGNORE INTO PromptHistory (name, content, description, version, isActive, createdAt, updatedAt)
SELECT 
  `key`,
  value,
  '从Dictionary表迁移的初始版本',
  1,
  true,
  NOW(),
  NOW()
FROM Dictionary 
WHERE `key` NOT IN ('character_prompt', 'story_prompt', 'summary_prompt');

-- 显示迁移结果
SELECT 
  name,
  version,
  isActive,
  SUBSTRING(content, 1, 100) AS content_preview,
  description,
  createdAt
FROM PromptHistory 
ORDER BY name, version; 