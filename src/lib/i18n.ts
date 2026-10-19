/**
 * Website language support. English is the default; Hindi (hi) and
 * Telugu (te) are optional UI translations. Clinical conversations
 * and documents remain in English until the clinic verifies
 * translations — the AI receptionist speaks the browser's voice
 * language when the underlying engine supports it.
 */
export type Lang = "en" | "hi" | "te";

const dict = {
  en: {
    "nav.home": "Home",
    "nav.about": "About Dr. XYZ",
    "nav.services": "Services",
    "nav.book": "Book an Appointment",
    "nav.receptionist": "AI Receptionist",
    "nav.contact": "Contact",
    "nav.admin": "Clinic Login",
    "hero.kicker": "Trusted care, convenient booking",
    "hero.title": "Dr. XYZ",
    "hero.subtitle": "Book an in-person or online consultation in minutes — with live availability and automatic reminders.",
    "hero.book": "Book an Appointment",
    "hero.avatar": "Talk to Our AI Receptionist",
    "hero.inperson": "In-Person",
    "hero.online": "Online",
    "hero.hours": "Opening hours",
    "hero.location": "Location",
    "toConfigured": "To be configured",
    "footer.emergency": "Medical emergency? Call 112 immediately.",
    "book.title": "Book an Appointment",
    "book.step1": "Consultation mode",
    "book.step2": "Your details",
    "book.step3": "Pick a slot",
    "book.step4": "Review & confirm",
    "book.confirm": "Confirm booking",
    "demo.banner": "Demo Mode — integrations not yet configured. Availability shown uses the local schedule only.",
  },
  hi: {
    "nav.home": "होम",
    "nav.about": "डॉ. XYZ के बारे में",
    "nav.services": "सेवाएँ",
    "nav.book": "अपॉइंटमेंट बुक करें",
    "nav.receptionist": "AI रिसेप्शनिस्ट",
    "nav.contact": "संपर्क",
    "nav.admin": "क्लिनिक लॉगिन",
    "hero.kicker": "विश्वसनीय देखभाल, आसान बुकिंग",
    "hero.title": "डॉ. XYZ",
    "hero.subtitle": "कुछ ही मिनटों में क्लिनिक या ऑनलाइन परामर्श बुक करें — लाइव उपलब्धता और स्वचालित अनुस्मारक के साथ।",
    "hero.book": "अपॉइंटमेंट बुक करें",
    "hero.avatar": "AI रिसेप्शनिस्ट से बात करें",
    "hero.inperson": "क्लिनिक में",
    "hero.online": "ऑनलाइन",
    "hero.hours": "खुलने का समय",
    "hero.location": "स्थान",
    "toConfigured": "कॉन्फ़िगर करना बाकी",
    "footer.emergency": "मेडिकल आपातकाल? तुरंत 112 पर कॉल करें।",
    "book.title": "अपॉइंटमेंट बुक करें",
    "book.step1": "परामर्श का तरीका",
    "book.step2": "आपकी जानकारी",
    "book.step3": "समय चुनें",
    "book.step4": "जाँचें और पुष्टि करें",
    "book.confirm": "बुकिंग पुष्टि करें",
    "demo.banner": "डेमो मोड — एकीकरण अभी कॉन्फ़िगर नहीं किए गए हैं।",
  },
  te: {
    "nav.home": "హోమ్",
    "nav.about": "డాక్టర్ XYZ గురించి",
    "nav.services": "సేవలు",
    "nav.book": "అపాయింట్‌మెంట్ బుక్ చేయండి",
    "nav.receptionist": "AI రిసెప్షనిస్ట్",
    "nav.contact": "సంప్రదింపు",
    "nav.admin": "క్లినిక్ లాగిన్",
    "hero.kicker": "నమ్మకర్ని సంతాను, సులభ బుకింగ్",
    "hero.title": "డాక్టర్ XYZ",
    "hero.subtitle": "కొన్ని నిమిషాల్లో క్లినిక్‌లో లేదా ఆన్‌లైన్ కాన్సల్టేషన్ బుక్ చేయండి — లైవ్ అందుబాటు మరియు స్వయంచాలక రిమైండర్లతో.",
    "hero.book": "అపాయింట్‌మెంట్ బుక్ చేయండి",
    "hero.avatar": "మా AI రిసెప్షనిస్ట్‌తో మాట్లాడండి",
    "hero.inperson": "క్లినిక్‌లో",
    "hero.online": "ఆన్‌లైన్",
    "hero.hours": "పని సమయం",
    "hero.location": "స్థలం",
    "toConfigured": "కాన్ఫిగర్ చేయాలి",
    "footer.emergency": "మెడికల్ అవసరం? వెంటనే 112 కి కాల్ చేయండి.",
    "book.title": "అపాయింట్‌మెంట్ బుక్ చేయండి",
    "book.step1": "కాన్సల్టేషన్ పద్ధతి",
    "book.step2": "మీ వివరాలు",
    "book.step3": "సమయం ఎంచుకోండి",
    "book.step4": "సమీక్షించి నిర్ధారించండి",
    "book.confirm": "బుకింగ్ నిర్ధారించండి",
    "demo.banner": "డెమో మోడ్ — ఏకీకరణలు ఇంకా కాన్ఫిగర్ కాలేదు.",
  },
} as const;

export function translate(lang: Lang, key: keyof (typeof dict)["en"]): string {
  return dict[lang]?.[key] ?? dict.en[key] ?? key;
}

export function availableLangs(): Lang[] {
  return ["en", "hi", "te"];
}
