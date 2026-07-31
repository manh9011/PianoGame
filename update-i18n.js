const fs = require('fs')
const path = require('path')

const translations = {
  ar: { t: 'تأكيد الحذف', m: '{title}\\nالمدة: {duration}\\nتم التشغيل: {playCount} مرات' },
  ca: { t: 'Confirma la supressió', m: '{title}\\nDurada: {duration}\\nJugat: {playCount} vegades' },
  de: { t: 'Löschen bestätigen', m: '{title}\\nDauer: {duration}\\nGespielt: {playCount} mal' },
  en: { t: 'Confirm deletion', m: '{title}\\nDuration: {duration}\\nPlayed: {playCount} times' },
  es: { t: 'Confirmar eliminación', m: '{title}\\nDuración: {duration}\\nJugado: {playCount} veces' },
  fr: { t: 'Confirmer la suppression', m: '{title}\\nDurée : {duration}\\nJoué : {playCount} fois' },
  hi: { t: 'हटाना सुनिश्चित करें', m: '{title}\\nअवधि: {duration}\\nखेला गया: {playCount} बार' },
  it: { t: 'Conferma eliminazione', m: '{title}\\nDurata: {duration}\\nGiocato: {playCount} volte' },
  ja: { t: '削除の確認', m: '{title}\\n再生時間: {duration}\\nプレイ回数: {playCount}回' },
  ko: { t: '삭제 확인', m: '{title}\\n재생 시간: {duration}\\n플레이 횟수: {playCount}번' },
  nl: { t: 'Verwijderen bevestigen', m: '{title}\\nDuur: {duration}\\nGespeeld: {playCount} keer' },
  pl: { t: 'Potwierdź usunięcie', m: '{title}\\nCzas trwania: {duration}\\nOdtworzono: {playCount} razy' },
  pt: { t: 'Confirmar exclusão', m: '{title}\\nDuração: {duration}\\nJogado: {playCount} vezes' },
  ru: { t: 'Подтвердить удаление', m: '{title}\\nДлительность: {duration}\\nСыграно: {playCount} раз' },
  sl: { t: 'Potrdi izbris', m: '{title}\\nTrajanje: {duration}\\nPredvajano: {playCount}-krat' },
  th: { t: 'ยืนยันการลบ', m: '{title}\\nระยะเวลา: {duration}\\nเล่นไปแล้ว: {playCount} ครั้ง' },
  tr: { t: 'Silmeyi onayla', m: '{title}\\nSüre: {duration}\\nOynanma: {playCount} kez' },
  vi: { t: 'Xác nhận xóa', m: '{title}\\nThời lượng: {duration}\\nĐã chơi: {playCount} lần' },
  zh: { t: '确认删除', m: '{title}\\n时长: {duration}\\n游玩次数: {playCount}次' }
}

const dir = path.join(__dirname, 'src', 'i18n', 'locales')
const files = fs.readdirSync(dir)

for (const file of files) {
  if (!file.endsWith('.ts') || file === 'index.ts') continue
  const lang = file.replace('.ts', '')
  if (!translations[lang]) {
    console.log('Skipping', lang)
    continue
  }
  
  const filePath = path.join(dir, file)
  let content = fs.readFileSync(filePath, 'utf8')
  
  const regex = /deleteConfirm:\s*['"`].*?['"`],?/
  if (regex.test(content)) {
    const t = translations[lang]
    const replacement = `deleteConfirmTitle: '${t.t}',\n    deleteConfirmMessage: '${t.m}',`
    content = content.replace(regex, replacement)
    fs.writeFileSync(filePath, content)
    console.log(`Updated ${file}`)
  } else {
    console.log(`Could not find deleteConfirm in ${file}`)
  }
}
