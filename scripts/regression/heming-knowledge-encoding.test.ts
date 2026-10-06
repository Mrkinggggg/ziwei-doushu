/**
 * 回归：合盘知识库（heming-knowledge.ts）不得含编码损坏字符 U+FFFD。
 *
 * 起因：该文件的导出文本里有 9 处 U+FFFD（`\uFFFD`，即解码失败的替换字符），
 * 散在 4 行——`天梁` 的 spouse_traits、两行分隔注释、以及合盘名言第 6 条。
 * 这些字符串会拼进合盘的 AI 提示词，也会在界面上原样显示，
 * 所以损坏的是「用户/AI 实际读到的内容」，不是排版细节。
 *
 * 这条回归钉两件事：
 *   1. 模块导出的所有字符串（含嵌套对象）里不得出现 U+FFFD；
 *   2. 文件本身按 UTF-8 读进来后不得出现 U+FFFD（注释也在内）。
 *
 * 顺带把修复后的 4 处原文钉住，避免下次再被改坏。
 * 其中「完全让先生没有后顾之忧」一句在同文件另有一份完好副本可作对照，
 * 是当初判定「此处缺的是『生』字」的依据。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAR_IN_FUQI_GU,
  SIHUA_IN_FUQI_GU,
  HEMING_METHODOLOGY,
  MARRIAGE_STARS_BRIEF,
  HEMING_SCORE_CRITERIA,
} from '../../lib/ziwei/heming-knowledge';

const REPLACEMENT = '\uFFFD';

/* ── ① 导出字符串（含嵌套）逐条检查 ─────────────────────────────── */
const collected: { path: string; text: string }[] = [];
function walk(value: unknown, path: string): void {
  if (typeof value === 'string') {
    collected.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, `${path}.${k}`);
  }
}

walk({ STAR_IN_FUQI_GU, SIHUA_IN_FUQI_GU, HEMING_METHODOLOGY, MARRIAGE_STARS_BRIEF, HEMING_SCORE_CRITERIA }, 'heming');

assert.ok(collected.length > 50, `导出的字符串条目太少（${collected.length}），取值路径或模块结构可能变了`);

/** 只截乱码附近的窗口，长字符串（如整篇方法论）不至于刷屏 */
function window(text: string): string {
  const at = text.indexOf(REPLACEMENT);
  const start = Math.max(0, at - 24);
  const end = Math.min(text.length, at + 24);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replaceAll(REPLACEMENT, '<U+FFFD>')}${end < text.length ? '…' : ''}`;
}

const corrupted = collected.filter((e) => e.text.includes(REPLACEMENT));
assert.deepEqual(
  corrupted.map((e) => e.path),
  [],
  '以下导出字符串含编码损坏字符 U+FFFD：\n' +
    corrupted
      .map((e) => `  ${e.path}（${e.text.split(REPLACEMENT).length - 1} 处）: ${window(e.text)}`)
      .join('\n'),
);

/* ── ② 文件本身（含注释）按 UTF-8 读入后不得含 U+FFFD ─────────────── */
const source = readFileSync(new URL('../../lib/ziwei/heming-knowledge.ts', import.meta.url), 'utf8');
const sourceHits: string[] = [];
source.split('\n').forEach((line, i) => {
  if (line.includes(REPLACEMENT)) sourceHits.push(`  L${i + 1}: ${line.replaceAll(REPLACEMENT, '<U+FFFD>')}`);
});
assert.deepEqual(
  sourceHits,
  [],
  'heming-knowledge.ts 源码中含编码损坏字符 U+FFFD：\n' + sourceHits.join('\n'),
);

/* ── ③ 钉住修复后的原文 ─────────────────────────────────────────── */
assert.equal(
  STAR_IN_FUQI_GU['天梁'].spouse_traits,
  '配偶责任感强，稳重老成，善讲道理，但偶有说教倾向',
  '天梁 · spouse_traits 原文被改动',
);

// 同一句话在文件里有两处（克夫命定义处 与 合盘名言第 6 条），必须都在且一致
const weiFuQuote = '完全让先生没有后顾之忧';
const occurrences = HEMING_METHODOLOGY.split(weiFuQuote).length - 1;
assert.equal(occurrences, 2, `「${weiFuQuote}」应在合盘方法论中出现 2 次，实际 ${occurrences} 次`);

console.log(
  `✅ 合盘知识库编码回归：${collected.length} 条导出字符串 + 源码 ${source.split('\n').length} 行均无 U+FFFD`,
);
