const TEXT_ENCODER = new TextEncoder()
const ZIP_DATE = (1 << 5) | 1
const ZIP_TIME = 0
const ZIP_UTF8_FLAG = 0x0800
const ZIP_STORE_METHOD = 0
const ZIP_DEFLATE_METHOD = 8
const MXL_MIME_TYPE = 'application/vnd.recordare.musicxml'
const MUSICXML_FILE_NAME = 'score.musicxml'

const CRC32_TABLE = new Uint32Array(256)
for (let index = 0; index < CRC32_TABLE.length; index++) {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  CRC32_TABLE[index] = value >>> 0
}

interface ZipSourceFile {
  name: string
  data: Uint8Array
  compress?: boolean
}

interface ZipEntry extends ZipSourceFile {
  compressedData: Uint8Array
  crc: number
  method: number
  localHeaderOffset: number
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function concatBytes(chunks: Uint8Array[]) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function deflateRaw(data: Uint8Array) {
  const CompressionStreamConstructor = globalThis.CompressionStream
  if (!CompressionStreamConstructor) return null

  try {
    const source = data.buffer instanceof ArrayBuffer
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : new Uint8Array(data).buffer
    const compressed = await new Response(new Blob([source]).stream().pipeThrough(new CompressionStreamConstructor('deflate-raw'))).arrayBuffer()
    return new Uint8Array(compressed)
  } catch {
    return null
  }
}

async function createZipEntry(file: ZipSourceFile, localHeaderOffset: number): Promise<ZipEntry> {
  const compressedData = file.compress ? await deflateRaw(file.data) : null
  return {
    ...file,
    compressedData: compressedData ?? file.data,
    crc: crc32(file.data),
    method: compressedData ? ZIP_DEFLATE_METHOD : ZIP_STORE_METHOD,
    localHeaderOffset,
  }
}

function createLocalFileHeader(entry: ZipEntry) {
  const name = TEXT_ENCODER.encode(entry.name)
  const header = new Uint8Array(30 + name.byteLength)
  const view = new DataView(header.buffer)

  writeUint32(view, 0, 0x04034b50)
  writeUint16(view, 4, entry.method === ZIP_DEFLATE_METHOD ? 20 : 10)
  writeUint16(view, 6, ZIP_UTF8_FLAG)
  writeUint16(view, 8, entry.method)
  writeUint16(view, 10, ZIP_TIME)
  writeUint16(view, 12, ZIP_DATE)
  writeUint32(view, 14, entry.crc)
  writeUint32(view, 18, entry.compressedData.byteLength)
  writeUint32(view, 22, entry.data.byteLength)
  writeUint16(view, 26, name.byteLength)
  writeUint16(view, 28, 0)
  header.set(name, 30)

  return header
}

function createCentralDirectoryHeader(entry: ZipEntry) {
  const name = TEXT_ENCODER.encode(entry.name)
  const header = new Uint8Array(46 + name.byteLength)
  const view = new DataView(header.buffer)

  writeUint32(view, 0, 0x02014b50)
  writeUint16(view, 4, 20)
  writeUint16(view, 6, entry.method === ZIP_DEFLATE_METHOD ? 20 : 10)
  writeUint16(view, 8, ZIP_UTF8_FLAG)
  writeUint16(view, 10, entry.method)
  writeUint16(view, 12, ZIP_TIME)
  writeUint16(view, 14, ZIP_DATE)
  writeUint32(view, 16, entry.crc)
  writeUint32(view, 20, entry.compressedData.byteLength)
  writeUint32(view, 24, entry.data.byteLength)
  writeUint16(view, 28, name.byteLength)
  writeUint16(view, 30, 0)
  writeUint16(view, 32, 0)
  writeUint16(view, 34, 0)
  writeUint16(view, 36, 0)
  writeUint32(view, 38, 0)
  writeUint32(view, 42, entry.localHeaderOffset)
  header.set(name, 46)

  return header
}

function createEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const header = new Uint8Array(22)
  const view = new DataView(header.buffer)

  writeUint32(view, 0, 0x06054b50)
  writeUint16(view, 4, 0)
  writeUint16(view, 6, 0)
  writeUint16(view, 8, entryCount)
  writeUint16(view, 10, entryCount)
  writeUint32(view, 12, centralDirectorySize)
  writeUint32(view, 16, centralDirectoryOffset)
  writeUint16(view, 20, 0)

  return header
}

async function createZip(files: ZipSourceFile[]) {
  const chunks: Uint8Array[] = []
  const entries: ZipEntry[] = []
  let offset = 0

  for (const file of files) {
    const entry = await createZipEntry(file, offset)
    const localHeader = createLocalFileHeader(entry)
    chunks.push(localHeader, entry.compressedData)
    entries.push(entry)
    offset += localHeader.byteLength + entry.compressedData.byteLength
  }

  const centralDirectoryOffset = offset
  const centralDirectoryHeaders = entries.map(createCentralDirectoryHeader)
  const centralDirectorySize = centralDirectoryHeaders.reduce((sum, header) => sum + header.byteLength, 0)
  chunks.push(...centralDirectoryHeaders, createEndOfCentralDirectory(entries.length, centralDirectorySize, centralDirectoryOffset))

  return concatBytes(chunks).buffer
}

export async function createCompressedMusicXml(musicXml: string) {
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n  <rootfiles>\n    <rootfile full-path="${MUSICXML_FILE_NAME}" media-type="application/vnd.recordare.musicxml+xml"/>\n  </rootfiles>\n</container>\n`

  return createZip([
    { name: 'mimetype', data: TEXT_ENCODER.encode(MXL_MIME_TYPE) },
    { name: 'META-INF/container.xml', data: TEXT_ENCODER.encode(containerXml), compress: true },
    { name: MUSICXML_FILE_NAME, data: TEXT_ENCODER.encode(musicXml), compress: true },
  ])
}
