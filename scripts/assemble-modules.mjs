#!/usr/bin/env node
// Ensambla staging/ con los módulos que el Nexus Launcher descarga:
//   staging/server/{classes,lib,plugins,config}  (servidor XMage, modo normal)
//   staging/proxy/mage-proxy-*.jar                (proxy WS, fat jar)
//   staging/version.json                          (versiones + comandos de arranque)
// El JRE (jlink) se genera aparte en CI por SO/arch.
// Uso: node scripts/assemble-modules.mjs [stagingDir]

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  MODULE_CLASSES,
  SERVER_ADD_OPENS,
  buildServerClasspath,
  forkDir,
  forkPath,
  log,
  logError,
} from './lib.mjs'

const repoRoot = path.join(import.meta.dirname, '..')
const outDir = path.resolve(process.argv[2] ?? path.join(repoRoot, 'staging'))

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  fs.cpSync(src, dst, { recursive: true })
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function main() {
  log(`ensamblando módulos en ${outDir}…`)
  fs.rmSync(outDir, { recursive: true, force: true })

  const serverDir = path.join(outDir, 'server')
  const classesDir = path.join(serverDir, 'classes')
  const classNames = []
  for (const rel of MODULE_CLASSES) {
    const src = forkPath(rel)
    if (!fs.existsSync(src)) {
      logError(`falta ${src} — ejecuta: node scripts/build.mjs`)
      process.exit(1)
    }
    const parts = rel.split('/')
    const name = parts.includes('target') ? parts[parts.indexOf('target') - 1] : parts[0]
    copyDir(src, path.join(classesDir, name))
    classNames.push(`classes/${name}`)
  }
  log('  classes OK')

  const libDir = path.join(serverDir, 'lib')
  fs.mkdirSync(libDir, { recursive: true })
  const cp = buildServerClasspath().split(path.delimiter)
  const seen = new Set()
  let libCount = 0
  for (const dep of cp) {
    if (!dep.endsWith('.jar') || !fs.existsSync(dep)) continue
    const base = path.basename(dep)
    if (seen.has(base)) continue
    seen.add(base)
    fs.copyFileSync(dep, path.join(libDir, base))
    libCount++
  }
  log(`  lib OK (${libCount} jars)`)

  const pluginsDir = path.join(serverDir, 'plugins')
  fs.mkdirSync(pluginsDir, { recursive: true })
  const pluginsRoot = forkPath('Mage.Server.Plugins')
  // Los target/ acumulan jars de versiones viejas (1.4.60 junto a 1.4.61):
  // quedarse con la versión mayor por artefacto.
  const newest = new Map()
  for (const moduleDir of fs.readdirSync(pluginsRoot)) {
    const target = path.join(pluginsRoot, moduleDir, 'target')
    if (!fs.existsSync(target)) continue
    for (const file of fs.readdirSync(target)) {
      if (!file.endsWith('.jar') || /(sources|javadoc|original-)/.test(file)) continue
      const m = file.match(/^(.*)-(\d+\.\d+.*)\.jar$/)
      const key = m ? m[1] : file
      const ver = m ? m[2] : ''
      if (!newest.has(key) || ver > newest.get(key).ver) {
        newest.set(key, { ver, from: path.join(target, file), file })
      }
    }
  }
  let pluginCount = 0
  for (const { from, file } of newest.values()) {
    fs.copyFileSync(from, path.join(pluginsDir, file))
    pluginCount++
  }
  if (pluginCount === 0) {
    logError('sin plugin jars — ejecuta: node scripts/build.mjs')
    process.exit(1)
  }
  log(`  plugins OK (${pluginCount} jars, solo versión mayor)`)

  // Seed de config: la release con ${project.version} sustituido (la de
  // local-server/ está anclada a 1.4.60). Política del launcher: solo
  // localhost + hilos del local.
  const pomXml = fs.readFileSync(forkPath('Mage.Server/pom.xml'), 'utf8')
  const pomVer = pomXml.match(/<version>(\d+\.\d+[^<]*)<\/version>/)[1]
  let seedConfig = fs.readFileSync(
    forkPath('Mage.Server/release/config/config.xml'), 'utf8')
    .replaceAll('${project.version}', pomVer)
    .replace('serverAddress="0.0.0.0"', 'serverAddress="127.0.0.1"')
    .replace('maxGameThreads="10"', 'maxGameThreads="20"')
  if (seedConfig.includes('${project.version}')) {
    logError('quedaron placeholders sin sustituir en la config seed')
    process.exit(1)
  }
  const configDir = path.join(serverDir, 'config')
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(path.join(configDir, 'config.xml'), seedConfig)
  log(`  config OK (release ${pomVer}, localhost)`)

  const proxyDir = path.join(outDir, 'proxy')
  fs.mkdirSync(proxyDir, { recursive: true })
  const proxyTarget = path.join(repoRoot, 'Mage.Proxy', 'target')
  const proxyJars = fs.existsSync(proxyTarget)
    ? fs.readdirSync(proxyTarget).filter((f) => /^mage-proxy-.*\.jar$/.test(f))
    : []
  if (proxyJars.length === 0) {
    logError('falta el jar del proxy — ejecuta: node scripts/build.mjs proxy')
    process.exit(1)
  }
  const proxyJar = proxyJars.sort().at(-1)
  fs.copyFileSync(path.join(proxyTarget, proxyJar), path.join(proxyDir, proxyJar))
  log(`  proxy OK (${proxyJar})`)

  const version = {
    schema: 1,
    xmage: '1.4.61-V1',
    proxyJar,
    gitSha: gitSha(),
    builtAt: new Date().toISOString(),
    server: {
      mainClass: 'mage.server.Main',
      // El fork compila como developer build → Main fuerza testMode=true salvo
      // que se asigne por propiedad/arg. El launcher juega en modo normal.
      systemProperties: { 'xmage.testMode': 'false' },
      addOpens: SERVER_ADD_OPENS,
      // OJO: los dirs de classes van explícitos (el wildcard * de java solo
      // expande jars, no directorios). Rutas relativas al dir del componente.
      classpath: [...classNames, 'lib/*'],
      workdir: 'server',
      port: 17171,
    },
    proxy: {
      mainClass: 'org.mage.proxy.Main',
      jar: proxyJar,
      // El proxy también es cliente XMage (jboss-serialization por reflexión):
      // necesita los mismos add-opens que el servidor (dev.mjs los pasa a ambos).
      addOpens: SERVER_ADD_OPENS,
      wsPort: 8787,
      httpPort: 8788,
    },
  }
  // version.json vive en la raíz del staging (referencia) y DENTRO del
  // componente server (es su contrato de arranque; cada tarball extrae plano
  // en su component dir).
  fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify(version, null, 2))
  fs.writeFileSync(path.join(serverDir, 'version.json'), JSON.stringify(version, null, 2))
  log('  version.json OK')
  log('ensamblado completo')
}

main()
