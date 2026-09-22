import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { forkPath } from './lib.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const SOURCE = forkPath(
  'Mage.Client/src/main/java/org/mage/plugins/card/dl/sources/ScryfallImageSupportTokens.java',
)
const REPOSITORY = forkPath('Mage/src/main/java/mage/cards/repository/TokenRepository.java')
const OUTPUT = path.join(ROOT, 'web/src/data/tokenImages.generated.json')

// Tabla del escritorio de XMage: "SET/Nombre[/imageNumber]" -> URL de Scryfall.
// El motor decide la variante de cada token (set + imageNumber) y la manda en
// CardView; esta tabla es la única forma exacta de saber qué carta de Scryfall
// es. Se guarda como "set/coleccionista" (+ "#back" si es la cara trasera).
const PUT = /put\("([^"]+)",\s*"https:\/\/api\.scryfall\.com\/cards\/([a-z0-9_]+)\/([^/?"]+)(?:\/[a-z-]+)?\?format=image(&face=(?:back|front))?"\)/g

const text = fs.readFileSync(SOURCE, 'utf8')
const table = {}
let count = 0
for (const [, key, set, num, face] of text.matchAll(PUT)) {
  const back = face === '&face=back'
  table[back ? `${key}#back` : key] = `${set}/${num}`
  count++
}

// Imágenes propias de XMage (set XMAGE): boca abajo (Morph, Manifest, Disguise,
// Cloak, Foretell), Copy, Día/Noche, Monarca... Son cartas de Scryfall y el
// motor manda `XMAGE` + imageFileName + imageNumber, como con cualquier token.
const repo = fs.readFileSync(REPOSITORY, 'utf8')
const names = Object.fromEntries(
  [...repo.matchAll(/(XMAGE_IMAGE_NAME_[A-Z_]+)\s*=\s*"([^"]+)"/g)].map(([, constant, value]) => [constant, value]),
)
const XMAGE = /createXmageToken\((XMAGE_IMAGE_NAME_[A-Z_]+),\s*(\d+),\s*"https:\/\/api\.scryfall\.com\/cards\/([a-z0-9_]+)\/([^/?"]+)(?:\/[a-z-]+)?\?format=image(&&?face=(?:back|front))?"/g
for (const [, constant, number, set, num, face] of repo.matchAll(XMAGE)) {
  const name = names[constant]
  if (!name) continue
  const back = face?.endsWith('face=back')
  table[`XMAGE/${name}/${number}${back ? '#back' : ''}`] = `${set}/${num}`
  count++
}

const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)))
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
fs.writeFileSync(OUTPUT, JSON.stringify(sorted) + '\n')
console.log(`tokenImages: ${Object.keys(sorted).length} entradas (${count} put) -> ${path.relative(ROOT, OUTPUT)}`)
