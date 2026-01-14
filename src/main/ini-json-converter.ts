import { readFileSync, writeFileSync } from 'fs'
import { extname } from 'path'

/**
 * 解析INI字符串为JSON对象
 * @param {string} iniStr - INI格式字符串
 * @returns {object} 转换后的JSON对象
 */
export function parseIniToJson(iniStr: string) {
  const result = {}
  let currentSection: string | undefined

  // 按行分割，过滤空行、去除首尾空格
  const lines = iniStr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line)

  // 遍历每一行处理
  lines.forEach((line) => {
    // 匹配分段 [XXX]
    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      // 初始化分段对象
      result[currentSection] = result[currentSection] || {}
      return
    }

    // 匹配键值对（处理等号两侧空格、等号在值中存在的情况）
    const [key, ...valueParts] = line.split('=')
    if (!key || !valueParts.length) return

    const keyTrim = key.trim()
    const valueTrim = valueParts.join('=').trim()

    // 数值转换：数字转number，布尔（0/1）转boolean，其余保留字符串
    let value
    if (/^\d+$/.test(valueTrim)) {
      value = Number(valueTrim)
    } else if (valueTrim === '0') {
      value = false
    } else if (valueTrim === '1') {
      value = true
    } else {
      value = valueTrim
    }

    if (currentSection) {
      result[currentSection][keyTrim] = value
    }
  })

  return result
}

/**
 * 将JSON对象序列化为INI字符串
 * @param {object} jsonObj - 要转换的JSON对象
 * @returns {string} INI格式字符串
 */
export function stringifyJsonToIni(jsonObj: Record<string, Record<string, unknown>>) {
  let iniStr = ''
  const sections = Object.keys(jsonObj)

  sections.forEach((section, index) => {
    // 分段之间加空行（第一个分段不加）
    if (index > 0) {
      iniStr += '\n\n'
    }

    // 写入分段名
    iniStr += `[${section}]`

    // 写入分段内的键值对
    const keyValues = jsonObj[section]
    Object.keys(keyValues).forEach((key) => {
      let value = keyValues[key]
      // 布尔值转回0/1，数值直接转字符串，字符串保留
      if (typeof value === 'boolean') {
        value = value ? 1 : 0
      } else if (typeof value === 'number') {
        value = String(value)
      }
      // 保持等号两侧空格，和示例格式一致
      iniStr += `\n${key}=${value}`
    })
  })

  return iniStr
}

/**
 * 读取文件并转换
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 */
export function convertFile(inputPath: string, outputPath: string) {
  // 读取输入文件
  const inputContent = readFileSync(inputPath, 'utf8')
  let outputContent = ''

  // 判断输入文件类型（按后缀）
  const ext = extname(inputPath).toLowerCase()
  if (ext === '.ini') {
    // INI转JSON
    const jsonObj = parseIniToJson(inputContent)
    outputContent = JSON.stringify(jsonObj, null, 2)
  } else if (ext === '.json') {
    // JSON转INI
    const jsonObj = JSON.parse(inputContent)
    outputContent = stringifyJsonToIni(jsonObj)
  } else {
    throw new Error('仅支持 .ini 和 .json 格式文件')
  }

  // 写入输出文件
  writeFileSync(outputPath, outputContent, 'utf8')
  console.log(`✅ 转换完成！已写入：${outputPath}`)
}
