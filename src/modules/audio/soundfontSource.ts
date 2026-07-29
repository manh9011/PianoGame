const SOUNDFONT_PATH = 'soundfonts/FluidR3_GM'

export function soundfontNameToUrl(name: string, _soundfont?: string, format = 'mp3') {
  const safeFormat = format === 'ogg' ? 'ogg' : 'mp3'
  const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  return `${baseUrl}${SOUNDFONT_PATH}/${name}-${safeFormat}.js`
}
