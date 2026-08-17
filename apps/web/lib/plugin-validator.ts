import { fetchRaw } from './github'

export interface DshManifest {
  /** package.json 解析结果 */
  pkg: Record<string, any>
  /** bundle patch 相对路径,如 cordis.patch.yml */
  patchPath: string | null
  /** patch 文件内容(拉取成功时) */
  patchYaml: string | null
  /** 包装名(name 或 @scope/name) */
  packageName: string
  valid: boolean
  reason: string
}

/**
 * 校验一个 GitHub 仓库是否为合法的 dsh 插件。
 * 判定依据(参照 dsh.so 的插件规范):
 *  1. package.json 必须存在
 *  2. package.json 必须声明 manifest.dsh?.bundle?.patch 为 string(或 cordis 补丁文件存在)
 *  3. patch 文件必须可拉取
 * 通过则返回 valid=true,可用于构造白名单 spec。
 */
export async function validateDshPlugin(
  owner: string,
  repo: string,
  ref: string,
  token?: string,
): Promise<DshManifest> {
  const fail = (reason: string): DshManifest => ({
    pkg: {},
    patchPath: null,
    patchYaml: null,
    packageName: repositorySlug(owner, repo),
    valid: false,
    reason,
  })

  const pkgRaw = await fetchRaw(owner, repo, 'package.json', ref, token)
  if (!pkgRaw) {
    return fail('仓库缺少 package.json')
  }
  let pkg: Record<string, any>
  try {
    pkg = JSON.parse(pkgRaw)
  } catch {
    return fail('package.json 不是合法 JSON')
  }

  // 提取 bundle patch 声明
  const manifestPatch: unknown = pkg?.manifest?.dsh?.bundle?.patch
  const dshBundlePatch: unknown = pkg?.dsh?.bundle?.patch

  const patchPath =
    typeof manifestPatch === 'string'
      ? manifestPatch
      : typeof dshBundlePatch === 'string'
        ? dshBundlePatch
        : null

  if (!patchPath) {
    return fail(
      '缺少 dsh.bundle.patch 声明(package.json 需声明 manifest.dsh.bundle.patch 或 dsh.bundle.patch)',
    )
  }

  const packageName: string = pkg.name ?? repo

  // 尝试拉取 patch 文件
  const patchYaml = await fetchRaw(owner, repo, patchPath, ref, token)
  if (!patchYaml) {
    return fail(`patch 文件 ${patchPath} 无法拉取`)
  }

  return {
    pkg,
    patchPath,
    patchYaml,
    packageName,
    valid: true,
    reason: 'ok',
  }
}

function repositorySlug(owner: string, repo: string): string {
  return repo
}