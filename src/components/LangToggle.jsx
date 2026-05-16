import { useLang } from '../context/LanguageContext'

export default function LangToggle() {
  const { lang, toggleLang } = useLang()
  return (
    <button
      onClick={toggleLang}
      title={lang === 'en' ? 'Switch to Bahasa Indonesia' : 'Switch to English'}
      className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1.5 rounded-lg text-sm transition-colors select-none"
    >
      {lang === 'en' ? '🇬🇧' : '🇮🇩'}
      <span className="text-gray-400">/</span>
      {lang === 'en' ? '🇮🇩' : '🇬🇧'}
    </button>
  )
}
