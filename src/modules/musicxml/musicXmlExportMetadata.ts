const PIANOGAME_NAME = 'PianoGame'
const PIANOGAME_COPYRIGHT = 'pianogame.vercel.io'

function escapeXmlText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function stripExportMetadata(musicXml: string) {
  return musicXml
    .replace(/<work\b[\s\S]*?<\/work>\s*/i, '')
    .replace(/<movement-title\b[\s\S]*?<\/movement-title>\s*/i, '')
    .replace(/<identification\b[\s\S]*?<\/identification>\s*/i, '')
}

export function applyMusicXmlExportMetadata(musicXml: string, title: string) {
  const exportedTitle = escapeXmlText(title)
  const exportMetadata = [
    `<work><work-title>${exportedTitle}</work-title></work>`,
    `<movement-title>${exportedTitle}</movement-title>`,
    `<identification><creator type="software">${PIANOGAME_NAME}</creator><rights>${PIANOGAME_COPYRIGHT}</rights><encoding><software>${PIANOGAME_NAME}</software></encoding></identification>`,
  ].join('')

  return stripExportMetadata(musicXml).replace(/<score-(partwise|timewise)\b[^>]*>/i, match => `${match}${exportMetadata}`)
}
