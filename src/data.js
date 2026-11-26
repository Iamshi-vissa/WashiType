export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 's', label: 'Sans serif' },
  { id: 'r', label: 'Serif' },
  { id: 'd', label: 'Display' },
  { id: 'h', label: 'Handwriting' },
  { id: 'm', label: 'Monospace' }
];

export const CATEGORY_NAME = { s: 'Sans serif', r: 'Serif', d: 'Display', h: 'Handwriting', m: 'Monospace' };

// Sample line per script, used when the person hasn't typed their own text.
export const SCRIPTS = [
  { id: 'latin', label: 'Latin', sample: 'The quick brown fox jumps over the lazy dog' },
  { id: 'devanagari', label: 'Devanagari (Hindi, Marathi)', sample: 'नमस्ते, आज का दिन शुभ हो' },
  { id: 'bengali', label: 'Bengali', sample: 'স্বাগতম বন্ধু' },
  { id: 'tamil', label: 'Tamil', sample: 'வணக்கம் நண்பரே' },
  { id: 'telugu', label: 'Telugu', sample: 'నమస్కారం మిత్రమా' },
  { id: 'kannada', label: 'Kannada', sample: 'ನಮಸ್ಕಾರ ಸ್ನೇಹಿತರೆ' },
  { id: 'malayalam', label: 'Malayalam', sample: 'നമസ്കാരം സുഹൃത്തേ' },
  { id: 'gujarati', label: 'Gujarati', sample: 'નમસ્તે મિત્ર' },
  { id: 'gurmukhi', label: 'Gurmukhi (Punjabi)', sample: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਦੋਸਤ' },
  { id: 'oriya', label: 'Odia', sample: 'ନମସ୍କାର ବନ୍ଧୁ' },
  { id: 'sinhala', label: 'Sinhala', sample: 'ආයුබෝවන් මිත්‍රයා' },
  { id: 'arabic', label: 'Arabic', sample: 'مرحبا بك يا صديقي' },
  { id: 'hebrew', label: 'Hebrew', sample: 'שלום חבר יקר' },
  { id: 'cyrillic', label: 'Cyrillic', sample: 'Съешь же ещё этих мягких французских булок' },
  { id: 'greek', label: 'Greek', sample: 'Γειά σου, καλή σου μέρα' },
  { id: 'vietnamese', label: 'Vietnamese', sample: 'Xin chào, chúc bạn một ngày tốt lành' },
  { id: 'thai', label: 'Thai', sample: 'สวัสดีเพื่อนรัก' },
  { id: 'khmer', label: 'Khmer', sample: 'សួស្តីមិត្តភក្តិ' },
  { id: 'lao', label: 'Lao', sample: 'ສະບາຍດີເພື່ອນ' },
  { id: 'japanese', label: 'Japanese', sample: 'こんにちは、素敵な一日を' },
  { id: 'korean', label: 'Korean', sample: '안녕하세요, 좋은 하루 되세요' },
  { id: 'chinese-simplified', label: 'Chinese (Simplified)', sample: '你好，祝你今天愉快' },
  { id: 'chinese-traditional', label: 'Chinese (Traditional)', sample: '你好，祝你今天愉快' },
  { id: 'ethiopic', label: 'Ethiopic', sample: 'ሰላም ወዳጄ' },
  { id: 'armenian', label: 'Armenian', sample: 'Բարև ընկեր' },
  { id: 'georgian', label: 'Georgian', sample: 'გამარჯობა მეგობარო' }
];

export const SCRIPT_LABEL = Object.fromEntries(SCRIPTS.map(s => [s.id, s.label.replace(/ \(.*\)/, '')]));
export const sampleFor = script => SCRIPTS.find(s => s.id === script)?.sample ?? SCRIPTS[0].sample;

export const SORTS = [
  { id: 'featured', label: 'Featured first' },
  { id: 'az', label: 'A to Z' },
  { id: 'new', label: 'Recently updated' },
  { id: 'weights', label: 'Most weights' }
];

// A hand-picked shortlist shown first under "Featured first". Everything else follows A to Z.
export const FEATURED = [
  'Yuji Boku', 'Shippori Mincho', 'Yuji Syuku', 'Zen Antique', 'Inter', 'Playfair Display', 'Caveat', 'Space Grotesk', 'Fraunces', 'Bebas Neue', 'Poppins', 'Lora',
  'Instrument Serif', 'Permanent Marker', 'JetBrains Mono', 'Montserrat', 'Tiro Devanagari Hindi', 'Rozha One',
  'DM Serif Display', 'Syne', 'Pacifico', 'EB Garamond', 'Unbounded', 'Mukta', 'Abril Fatface', 'Manrope',
  'Kalam', 'Cormorant Garamond', 'Archivo Black', 'Roboto', 'Dancing Script', 'IBM Plex Mono', 'Outfit',
  'Yatra One', 'Libre Baskerville', 'Righteous', 'Open Sans', 'Amatic SC', 'Anek Devanagari', 'Sora',
  'Merriweather', 'Press Start 2P', 'Plus Jakarta Sans', 'Baloo 2', 'Lobster', 'Space Mono', 'Bungee',
  'Crimson Pro', 'Lexend', 'Patrick Hand', 'Yeseva One', 'Work Sans', 'Alegreya', 'Rubik Mono One',
  'Figtree', 'Gloria Hallelujah', 'Bitter', 'Hind', 'Oswald', 'Nunito', 'Raleway', 'Lato', 'Rubik', 'Karla',
  'Indie Flower', 'Source Code Pro', 'Instrument Sans', 'Noto Sans Devanagari', 'DM Sans', 'Roboto Flex'
];

export const SIZES = [20, 28, 36, 48, 64, 88];
