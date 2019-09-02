const SOURCE_MAP_FILE = './mapper.js.map'
const OUT_PATH = './blob'

const { SourceMapConsumer } = require('source-map')
const { readFileSync, mkdir, writeFile } = require('fs')
const sourceFile = JSON.parse(readFileSync(`${SOURCE_MAP_FILE}`).toString())

/** Sanitize File Path - a simple, easy to use function to clean up file paths
 * @param {string} input A file path
 * @param {string} replacement The string to replace invalid path characters
 */
const sanitizeFilePath = (function () {
  const truncateUTF8 = (() => {
    const isHighSurrogate = codePoint => codePoint >= 0xd800 && codePoint <= 0xdbff
    const isLowSurrogate = codePoint => codePoint >= 0xdc00 && codePoint <= 0xdfff
    // Truncate string by size in bytes
    return function truncate (getLength, string, byteLength) {
      if (typeof string !== 'string') throw new Error('Input must be string')
      const charLength = string.length
      let curByteLength = 0
      let codePoint
      let segment
      for (var i = 0; i < charLength; i += 1) {
        codePoint = string.charCodeAt(i)
        segment = string[i]
        if (isHighSurrogate(codePoint) && isLowSurrogate(string.charCodeAt(i + 1))) {
          i += 1; segment += string[i]
        }
        curByteLength += getLength(segment)
        if (curByteLength === byteLength) return string.slice(0, i + 1)
        else if (curByteLength > byteLength) return string.slice(0, i - segment.length + 1)
      }
      return string
    }
  })()

  const illegalRe = /[?<>:*|":]/g
  /* eslint-disable-next-line */
  const controlRe = /[\x00-\x1f\x80-\x9f]/g
  const reservedRe = /^\.+$/
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
  const windowsTrailingRe = /[.\s]+$/
  const anySlashes = /(\/|\\){1,}/g // concats multiple slashes

  return function sanitizeFilePath (l, input = '', replacement = '_') {
    const str = input
      .replace(/^(\.){1,}/, '.')
      .replace(illegalRe, replacement)
      .replace(controlRe, replacement)
      .replace(reservedRe, replacement)
      .replace(windowsReservedRe, replacement)
      .replace(windowsTrailingRe, replacement)
      .replace(anySlashes, '/')
    return truncateUTF8(Buffer.byteLength, str, 255)
  }
})().bind(null, Buffer.byteLength.bind(Buffer))

SourceMapConsumer.with(sourceFile, null, consumer => {
  consumer.sources.map((fp, index) => {
    const fullPath = sanitizeFilePath(fp, '_')
    const plainPath = ((a = fullPath.split('/')) => a.splice(0, --a.length))().join('/')
    const contents = consumer.sourcesContent[index]
    console.info(`Processing ${fullPath}`)
    mkdir(`${OUT_PATH}/${plainPath}`, { recursive: true }, err => {
      if (err != null) throw err
      writeFile(`${OUT_PATH}/${fullPath}`, contents, e => null)
    })
  })
})
