// 让 Node 测试能解析无后缀的 TS 相对导入（Vercel 打包器要求无后缀，Node 需要 .ts）
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context) }
  catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && /^[./]/.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
      return next(specifier + '.ts', context)
    }
    throw err
  }
}
