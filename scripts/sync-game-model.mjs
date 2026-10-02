// 把 XHBlogs/app/game/race-model.ts 内联进 api/racer-board.ts 的标记区。
// Vercel 函数只打包 /api 内的文件，跨目录 import 不可用；单文件内联 + 本脚本同步，
// 并由 scripts/racer-board.test.mjs 的「回放逐毫秒一致」断言兜底防漂移。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(root, 'XHBlogs/app/game/race-model.ts')
const boardPath = join(root, 'api/racer-board.ts')
const BEGIN = '// ==== BEGIN race-model（由 scripts/sync-game-model.mjs 同步，勿手改）===='
const END = '// ==== END race-model ===='

export function syncGameModel() {
  const model = readFileSync(sourcePath, 'utf8').trim()
  const board = readFileSync(boardPath, 'utf8')
  const before = board.slice(board.indexOf(BEGIN), board.indexOf(END) + END.length)
  const section = BEGIN + '\n' + model + '\n\n' + END
  if (before === section) return false
  if (!board.includes(BEGIN) || !board.includes(END)) throw new Error('api/racer-board.ts 缺少同步标记区')
  writeFileSync(boardPath, board.replace(before, section))
  return true
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(syncGameModel() ? 'race-model 已同步到 api/racer-board.ts' : 'race-model 已是最新')
}
