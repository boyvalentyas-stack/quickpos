import { useLang } from '../context/LanguageContext'

export default function LangToggle() {
  const { lang, toggleLang } = useLang()
  return (
    <button
      onClick={toggleLang}
      title={lang === 'en' ? 'Switch to Bahasa Indonesia' : 'Switch to English'}
      className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors select-none"
    >
      <span className="text-white">{lang === 'en' ? 'EN' : 'ID'}</span>
      <span className="text-gray-500">|</span>
      <span className="text-gray-400">{lang === 'en' ? 'ID' : 'EN'}</span>
    </button>
  )
}