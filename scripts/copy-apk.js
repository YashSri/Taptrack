import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const source = path.join(
  __dirname,
  '../android/app/build/outputs/apk/debug/app-debug.apk',
)
const destinationDir = 'D:/ye banna hai'
const destination = path.join(destinationDir, 'TapTrack-latest.apk')

fs.mkdirSync(destinationDir, { recursive: true })

if (!fs.existsSync(source)) {
  console.error('APK not found')
  process.exit(1)
}

fs.copyFileSync(source, destination)
console.log(`Updated APK copied successfully to ${destination}`)
