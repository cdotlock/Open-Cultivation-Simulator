"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from "next/cache"

// 获取所有字典项
export async function getDicts() {
  try {
    const dicts = await prisma.dictionary.findMany({
      orderBy: {
        id: 'asc'
      }
    })
    return dicts
  } catch (error) {
    console.error('获取字典数据失败:', error)
    throw new Error('获取字典数据失败')
  }
}

// 获取单个字典项
export async function getDict(id: number) {
  try {
    const dict = await prisma.dictionary.findUnique({
      where: { id }
    })
    return dict
  } catch (error) {
    console.error('获取字典项失败:', error)
    throw new Error('获取字典项失败')
  }
}

// 创建字典项
export async function createDict(formData: FormData) {
  try {
    const key = formData.get('key') as string
    const value = formData.get('value') as string
    
    if (!key || !value) {
      throw new Error('键和值不能为空')
    }
    
    const dict = await prisma.dictionary.create({
      data: { key, value }
    })
    
    revalidatePath('/dict')
    return dict
  } catch (error) {
    console.error('创建字典项失败:', error)
    throw new Error('创建字典项失败')
  }
}

// 更新字典项
export async function updateDict(id: number, formData: FormData) {
  try {
    const key = formData.get('key') as string
    const value = formData.get('value') as string
    
    if (!key || !value) {
      throw new Error('键和值不能为空')
    }
    
    const dict = await prisma.dictionary.update({
      where: { id },
      data: { key, value }
    })
    
    revalidatePath('/dict')
    return dict
  } catch (error) {
    console.error('更新字典项失败:', error)
    throw new Error('更新字典项失败')
  }
}

// 删除字典项
export async function deleteDict(id: number) {
  try {
    await prisma.dictionary.delete({
      where: { id }
    })
    
    revalidatePath('/dict')
    return { success: true }
  } catch (error) {
    console.error('删除字典项失败:', error)
    throw new Error('删除字典项失败')
  }
}

// 获取 BGM 列表
export async function getBgmList() {
  try {
    const bgmDict = await prisma.dictionary.findUnique({
      where: { key: 'bgm_list' }
    })
    
    if (!bgmDict) {
      // 如果没有找到 BGM 字典项，返回默认值
      return ['/assets/bgm.mp3']
    }
    
    // 假设存储的是 JSON 数组格式的字符串
    try {
      const bgmList = JSON.parse(bgmDict.value)
      return Array.isArray(bgmList) ? bgmList : [bgmDict.value]
    } catch {
      // 如果不是 JSON 格式，就当作单个 URL 处理
      return [bgmDict.value]
    }
  } catch (error) {
    console.error('获取 BGM 列表失败:', error)
    // 发生错误时返回默认值
    return ['/assets/bgm.mp3']
  }
}
