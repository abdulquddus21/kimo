import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  IoMenu, IoAdd, IoChatbubbleOutline, IoTrashOutline, 
  IoSparkles, IoImageOutline, IoArrowUp, IoSquare, 
  IoCopyOutline, IoVolumeMediumOutline, IoThumbsUpOutline, 
  IoThumbsUp, IoThumbsDownOutline, IoThumbsDown, IoClose, 
  IoCloseCircle, IoDownloadOutline, IoCodeSlashOutline, 
  IoCheckmarkCircle ,  IoVideocam
} from 'react-icons/io5';

// VideoChat komponentini import qilamiz
import VideoChat from './video_chat';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const STICKERS = ['✨', '🚀', '🤖', '💡', '🔥', '💎', '🌟', '🌈'];

const ImageWithLoader = ({ src, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const downloadImg = () => {
    const link = document.createElement("a");
    link.href = src;
    link.download = `Kimo_AI_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="img-container">
      {!loaded && (
        <div className="img-skeleton">
          <div className="skeleton-pulse"></div>
          <div className="generating-text">
            <IoSparkles className="spin-icon" size={35} />
            <span className="gen-title">San'at asari yaratilmoqda</span>
            <div className="gen-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      )}
      <img 
        src={src} 
        alt="KIMO AI Generation" 
        className={`msg-img ${loaded ? 'visible' : 'hidden'}`} 
        onLoad={() => setLoaded(true)}
        onClick={onClick}
      />
      {loaded && (
        <button className="img-download-btn" onClick={downloadImg}>
          <IoDownloadOutline size={20} />
        </button>
      )}
    </div>
  );
};

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [input, setInput] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [imageGenMode, setImageGenMode] = useState(false);
  const [coderMode, setCoderMode] = useState(false);
  
  // Video chat ko'rinishini boshqarish uchun yangi state
  const [showVideoChat, setShowVideoChat] = useState(false);

  const messagesEndRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatWindowRef = useRef(null);
  const textareaRef = useRef(null);

  const currentMessages = conversations.find(c => c.id === currentConvId)?.messages || [];

  useEffect(() => {
    const saved = localStorage.getItem('kimo_pro_v5');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConversations(parsed);
      if (parsed.length > 0) setCurrentConvId(parsed[0].id);
      else createNewChat();
    } else {
      createNewChat();
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('kimo_pro_v5', JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resizeSidebar = useCallback((e) => {
    if (isResizing && window.innerWidth > 768) {
      let newWidth = e.clientX;
      if (newWidth > 150 && newWidth < 500) setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resizeSidebar);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resizeSidebar);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resizeSidebar, stopResizing]);

  const createNewChat = () => {
    if (conversations.length > 0 && conversations[0].messages.length === 0) {
      setCurrentConvId(conversations[0].id);
      setMenuOpen(false);
      return;
    }
    const id = Date.now().toString();
    const newChat = { id, title: 'Yangi suhbat', messages: [] };
    setConversations(prev => [newChat, ...prev]);
    setCurrentConvId(id);
    setMenuOpen(false);
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    const filtered = conversations.filter(c => c.id !== id);
    setConversations(filtered);
    if (currentConvId === id) {
      if (filtered.length > 0) setCurrentConvId(filtered[0].id);
      else createNewChat();
    }
    notify("Suhbat o'chirildi");
  };

  const speak = (text) => {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/[*#`]/g, '').replace(/https?:\/\/[^\s]+/g, 'rasm havolasi');
    const msg = new SpeechSynthesisUtterance(cleanText);
    msg.lang = 'uz-UZ';
    msg.rate = 1;
    window.speechSynthesis.speak(msg);
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (text.length > 300) {
      e.preventDefault();
      setPastedText(text);
      notify('Matn qo\'shildi');
    }
  };

  const sendMessage = async () => {
    const fullText = pastedText ? `${pastedText}\n\n${input}` : input;
    if (!fullText.trim() && !selectedImage) return;

    const imgSnapshot = selectedImage;
    const textSnapshot = fullText;

    const userMsg = {
      role: 'user',
      content: textSnapshot,
      image: imgSnapshot ? imgSnapshot.uri : null,
      imageType: imgSnapshot ? imgSnapshot.type : null,
      imageBase64: imgSnapshot ? imgSnapshot.base64 : null,
      timestamp: new Date().toISOString()
    };

    const updatedMsgs = [...currentMessages, userMsg];
    updateConvMsgs(updatedMsgs);
    
    setInput('');
    setPastedText('');
    setSelectedImage(null);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      if (imageGenMode) {
        // IMAGE GENERATION MODE
        const promptText = textSnapshot.trim();
        
        if (imgSnapshot) {
          // Rasmni tahrirlash rejimi
          const editPrompt = `Based on this image and the user's request: "${promptText}", create an improved/modified version. Generate a detailed English prompt that maintains the original image essence but incorporates the requested changes.`;
          
          const editResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
            signal: abortControllerRef.current.signal,
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [
                { role: 'system', content: 'You are an expert at creating detailed image generation prompts in English. Only respond with the prompt, nothing else.' },
                { 
                  role: 'user', 
                  content: [
                    { type: 'text', text: editPrompt },
                    { type: 'image_url', image_url: { url: `data:${imgSnapshot.type};base64,${imgSnapshot.base64}` }}
                  ]
                }
              ],
              temperature: 0.8,
              max_tokens: 400
            })
          });
          
          const editData = await editResponse.json();
          const enhancedPrompt = editData.choices[0].message.content.trim();
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&enhance=true`;
          
          const aiMsg = { 
            role: 'assistant', 
            content: imageUrl,
            timestamp: new Date().toISOString(),
            isImage: true
          };
          
          updateConvMsgs([...updatedMsgs, aiMsg]);
          
        } else {
          // Yangi rasm yaratish
          const promptResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
            signal: abortControllerRef.current.signal,
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [
                { role: 'system', content: 'You are an expert at creating detailed, artistic image generation prompts in English. Create vivid, detailed prompts. Only respond with the prompt in English, nothing else.' },
                { role: 'user', content: `Create a detailed image generation prompt for: ${promptText}` }
              ],
              temperature: 0.9,
              max_tokens: 450
            })
          });
          
          const promptData = await promptResponse.json();
          const enhancedPrompt = promptData.choices[0].message.content.trim();
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&enhance=true`;
          
          const aiMsg = { 
            role: 'assistant', 
            content: imageUrl,
            timestamp: new Date().toISOString(),
            isImage: true
          };
          
          updateConvMsgs([...updatedMsgs, aiMsg]);
        }
        
      } else {
        // TEXT/CODE MODE
        const apiMessages = [
          { 
            role: 'system', 
            content: coderMode 
              ? `Sen KIMO AI — Abdulquddus tomonidan yaratilgan professional va yuqori darajadagi dasturchi yordamchisisan.

Sening asosiy vazifang — foydalanuvchiga texnik, mantiqiy va mukammal ishlaydigan yechimlar berish. Sen har doim real loyiha muhitida ishlaydigan tajribali dasturchi kabi fikrlaysan.

========================
ASOSIY QOIDALAR
========================

1. Kod yozish tartibi:
- Faqat foydalanuvchi so‘ragan qismni o‘zgartir, boshqa joyga TEGMA
- Agar to‘liq fayl so‘ralmasa — faqat kerakli qismini yoz
- Har doim to‘liq, ishlaydigan va xatosiz kod yoz
- Hech qachon yarim, qisqartirilgan yoki taxminiy kod bermagin
- Clean Code, best practice va real production standartlarga amal qil
- Kod optimal, samarali va xavfsiz bo‘lishi shart

2. Tahlil va mantiq:
- Avval muammoni to‘liq tushun
- Eng to‘g‘ri va sodda yechimni tanla
- Keraksiz murakkablikdan saqlan
- Performance va scalability’ni hisobga ol

========================
JAVOB STRUKTURASI (MAJBURIY)
========================

Har bir texnik javob quyidagi tartibda bo‘lsin:

**Tushuncha:**  
Muammo nima va nima qilish kerakligi qisqacha va aniq tushuntirilsin

**Yechim:**  
To‘liq, ishlaydigan va testdan o‘tadigan kod

**Tushuntirish:**  
Muhim joylar qisqa, aniq va tushunarli sharhlansin

========================
FORMAT QOIDALARI
========================

- Muhim fikrlar → **qalin**
- Eslatmalar → <y>sariq</y>
- Ogohlantirishlar → <r>qizil</r>
- Muvaffaqiyatli natijalar → <g>yashil</g>
- Kod faqat quyidagi formatda:
  \`\`\`language
  code

`
              : `Sen KIMO AI — Abdulquddus tomonidan ishlab chiqarilgan professional, aqlli va tabiiy gaplashadigan sun’iy intellekt yordamchisisan.  

Sening vazifang — foydalanuvchi bilan **tabiiy, samimiy, mantiqiy va jonli** suhbat olib borish, har doim kontekstni eslab, foydalanuvchi niyatini aniqlash va unga mos javob berish.  

========================
ASOSIY QOIDALAR
========================

1. Tabiiy va professional suhbat:
- Foydalanuvchi salomlashsa yoki oddiy gap yozsa, **tabiiy, do‘stona va tushunarli javob ber**  
- Hech qachon majburan o‘zingni tanishtirma  
- Faqat **zarur bo‘lganda yoki so‘ralganda** ayt: “Men KIMO AI, Abdulquddus tomonidan ishlab chiqarilgan professional AI yordamchisiman”  
- Oldingi suhbatlarni eslab, kontekstga mos javob ber  
- Galati, mantiqsiz yoki tushunarsiz javob bermagin  
- Foydalanuvchining niyatini doim tushunishga harakat qil

2. Formatlash va vizual stil:
- Muhim so‘zlar → **qalin**  
- Foydali maslahatlar → <y>sariq</y>  
- Ogohlantirishlar → <r>qizil</r>  
- Ijobiy natijalar → <g>yashil</g>  
- Suhbatni do‘stona, qiziqarli va jonli tutish (emoji ishlatish mumkin)  
- Javoblar qisqa, tushunarli va foydali bo‘lsin  
- Agar foydalanuvchi rasm yoki fayl yuborsa — uni diqqat bilan tahlil qil va tushunarli tushuntir

3. Umumiy qoida:
- Oddiy suhbatda ham tabiiy, samimiy va professional bo‘lsin  
- Keraksiz sarlavhalar, uzun izohlar yoki murakkab strukturadan saqlan  
- Foydalanuvchining oldingi so‘zlariga mos javob berish uchun **doim kontekstni hisobga ol**  
- Har doim foydalanuvchiga qulay, mantiqiy va aqlli javob ber

4. Aqlli muloqot:
- Foydalanuvchi xato qilsa — muloyim to‘g‘rilab tushuntir  
- Noaniq savol bo‘lsa — eng mantiqli taxmin bilan javob ber  
- Har doim foydalanuvchi niyatini tushunishga harakat qil  
- Suhbat tabiiy, samimiy va jonli bo‘lishi shart  

<y>Eslatma:</y> Ushbu prompt system message sifatida berilganda, KIMO AI **oddiy salom yoki gapga javob berganda o‘zingni majburan tanishtirmaydi**, lekin har doim **aqlli, tabiiy va foydalanuvchi niyatiga mos javob beradigan** AI sifatida ishlaydi.

`
          }
        ];

        updatedMsgs.slice(-10).forEach(msg => {
          if (msg.role === 'user') {
            const userContent = [{ type: "text", text: msg.content || "Tahlil qiling" }];
            if (msg.imageBase64) {
              userContent.push({
                type: "image_url",
                image_url: { url: `data:${msg.imageType};base64,${msg.imageBase64}` }
              });
            }
            apiMessages.push({ role: 'user', content: userContent });
          } else if (!msg.isImage) {
            apiMessages.push({ role: 'assistant', content: msg.content });
          }
        });

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            model: imgSnapshot ? 'meta-llama/llama-4-maverick-17b-128e-instruct' : 'openai/gpt-oss-120b',
            messages: apiMessages,
            temperature: 1,
            max_tokens: 8192
          })
        });

        const data = await response.json();
        let aiText = data.choices[0].message.content;

        if (Math.random() > 0.7) aiText += ` ${STICKERS[Math.floor(Math.random() * STICKERS.length)]}`;

        const aiMsg = { 
          role: 'assistant', 
          content: aiText, 
          timestamp: new Date().toISOString(),
          liked: false,
          disliked: false
        };
        
        updateConvMsgs([...updatedMsgs, aiMsg]);
        typeEffect(aiText);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        notify("Xatolik yuz berdi");
        console.error(e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateConvMsgs = (msgs) => {
    setConversations(prev => prev.map(c => 
      c.id === currentConvId ? { ...c, messages: msgs, title: msgs[0]?.content.slice(0, 40) || 'Yangi suhbat' } : c
    ));
  };

  const typeEffect = (text) => {
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    
    typingIntervalRef.current = setInterval(() => {
      if (i < text.length) {
        const chunk = text.slice(i, i + 20);
        setTypingText(prev => prev + chunk);
        i += 20;
      } else {
        clearInterval(typingIntervalRef.current);
        setIsTyping(false);
      }
    }, 20);
  };

  const parseMD = (text, isImage) => {
    if (isImage) {
      return <ImageWithLoader src={text} onClick={() => setFullScreenImage(text)} />;
    }

    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
        const lang = match?.[1] || 'code';
        const code = match?.[2] || part.replace(/```/g, '');
        return (
          <div key={i} className="code-card">
            <div className="code-header">
              <div className="code-dots">
                <span className="code-dot red"></span>
                <span className="code-dot yellow"></span>
                <span className="code-dot green"></span>
              </div>
              <span className="code-lang">{lang.toUpperCase()}</span>
              <button className="code-copy" onClick={() => {navigator.clipboard.writeText(code); notify("Nusxalandi ✓");}}>
                <IoCopyOutline size={16}/>
              </button>
            </div>
            <pre className="code-pre"><code>{code}</code></pre>
          </div>
        );
      }
      return <span key={i} className="formatted-text" dangerouslySetInnerHTML={{ __html: formatTags(part) }} />;
    });
  };

  // Video chatni ochish funksiyasi
  function startVideoChat() {
    setShowVideoChat(true);
  }

  const formatTags = (t) => t
    .replace(/^##\s*(.*)$/gm, '<span class="md-h2">$1</span>')
    .replace(/^###\s*(.*)$/gm, '<span class="md-h3">$1</span>')
    .replace(/\n\n/g, '<div class="paragraph-break"></div>')
    .replace(/\n/g, '<br/>')
    .replace(/<g>(.*?)<\/g>/g, '<span class="t-g">$1</span>')
    .replace(/<r>(.*?)<\/r>/g, '<span class="t-r">$1</span>')
    .replace(/<y>(.*?)<\/y>/g, '<span class="t-y">$1</span>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="t-bold">$1</strong>');

  const downloadApk = () => {
    const link = document.createElement("a");
    link.href = "./assets/ilova.apk";
    link.download = "ilova.apk";
    link.click();
  };

  // Agar video chat rejimi yoqilgan bo'lsa, VideoChat komponentini ko'rsatamiz
  if (showVideoChat) {
    return <VideoChat onBack={() => setShowVideoChat(false)} />;
  }

  return (
    <div className="app">
      <style>{`
:root {
  --bg: #0a0a0a;
  --sidebar: #111111;
  --accent: #00ff88;
  --accent-hover: #00dd77;
  --text: #ffffff;
  --text-dim: #999;
  --text-dimmer: #666;
  --border: #222;
  --user-bubble: #1a1a1a;
  --code-bg: #0d0d0d;
}

* { 
  box-sizing: border-box; 
  outline: none; 
  -webkit-tap-highlight-color: transparent; 
}

::-webkit-scrollbar { width: 0; display: none; }
* { scrollbar-width: none; -ms-overflow-style: none; }

body, html, #root {
  margin: 0; 
  height: 100%; 
  background: var(--bg); 
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

.app { 
  display: flex; 
  height: 100vh; 
  width: 100vw; 
}

.sidebar {
  background: var(--sidebar); 
  border-right: 1px solid var(--border);
  display: flex; 
  flex-direction: column; 
  position: relative; 
  z-index: 100;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sb-header { 
  padding: 20px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  border-bottom: 1px solid var(--border);
}

.brand { 
  font-weight: 800; 
  font-size: 20px; 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  color: #fff; 
  letter-spacing: -0.5px;
}

.spark-icon {
  animation: sparkle 2s ease-in-out infinite;
}

@keyframes sparkle {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.1); }
}

.sb-actions { 
  display: flex; 
  gap: 10px; 
  align-items: center; 
}

.close-sidebar-mob { 
  display: none; 
  background: none; 
  border: none; 
  color: #fff; 
  cursor: pointer; 
}

.add-btn {
  background: #1a1a1a; 
  border: 1px solid var(--border); 
  color: var(--accent);
  width: 40px; 
  height: 40px; 
  border-radius: 10px; 
  cursor: pointer;
  display: flex; 
  align-items: center; 
  justify-content: center; 
  transition: all 0.2s;
}

.add-btn:hover { 
  background: #222; 
  border-color: var(--accent); 
  transform: scale(1.05);
}

.chat-history { 
  flex: 1; 
  overflow-y: auto; 
  padding: 10px; 
}

.chat-item {
  padding: 14px 12px; 
  border-radius: 12px; 
  display: flex; 
  align-items: center; 
  gap: 12px;
  cursor: pointer; 
  margin-bottom: 6px; 
  transition: all 0.2s; 
  position: relative;
}

.chat-item:hover { 
  background: #1a1a1a; 
}

.chat-item.active { 
  background: #1a1a1a; 
  border-left: 3px solid var(--accent);
}

.chat-item .chat-icon {
  color: var(--text-dimmer);
  flex-shrink: 0;
}

.chat-item.active .chat-icon {
  color: var(--accent);
}

.chat-item .title { 
  flex: 1; 
  font-size: 14px; 
  white-space: nowrap; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  color: var(--text-dim); 
}

.chat-item.active .title { 
  color: #fff; 
  font-weight: 500; 
}

.del-btn.always-show { 
  background: none; 
  border: none; 
  color: #555; 
  cursor: pointer; 
  transition: 0.2s;
  padding: 5px;
  border-radius: 6px;
}

.del-btn.always-show:hover { 
  color: #ff4444; 
}

.resizer { 
  position: absolute; 
  right: 0; 
  top: 0; 
  width: 5px; 
  height: 100%; 
  cursor: col-resize; 
  transition: 0.2s;
  z-index: 10;
}

.resizer:hover { 
  background: var(--accent); 
}

.main { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  background: var(--bg); 
  position: relative; 
}

.navbar {
  height: 60px; 
  display: flex; 
  align-items: center; 
  justify-content: space-between;
  padding: 0 20px; 
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.mob-menu-btn { 
  display: none; 
  background: none; 
  border: none; 
  color: var(--accent); 
  cursor: pointer; 
}

.nav-title { 
  font-weight: 700; 
  color: var(--text); 
  font-size: 16px;
  letter-spacing: 0.5px;
}

.chat-window { 
  flex: 1; 
  overflow-y: auto; 
  padding: 40px 15%; 
  display: flex; 
  flex-direction: column;
}

.hero { 
  margin: auto; 
  text-align: center; 
  max-width: 500px; 
  opacity: 0.9;
  animation: fadeIn 0.6s ease;
}

.hero-icon { 
  color: var(--accent); 
  margin-bottom: 25px; 
  filter: drop-shadow(0 0 20px rgba(0, 255, 136, 0.4));
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.hero h1 {
  font-size: 42px;
  margin: 0 0 15px 0;
  background: linear-gradient(135deg, #fff, var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero p {
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1.6;
}

.msg-row { 
  margin-bottom: 35px; 
  display: flex; 
  width: 100%; 
  animation: fadeIn 0.4s ease; 
}

.msg-row.user { 
  justify-content: flex-end; 
}

.bubble { 
  max-width: 85%; 
}

.user .bubble { 
  background: var(--user-bubble); 
  padding: 16px 22px; 
  border-radius: 20px; 
  border-bottom-right-radius: 4px;
  border: 1px solid var(--border);
}

.msg-text { 
  line-height: 1.9; 
  font-size: 15.5px; 
  word-wrap: break-word;
  color: var(--text);
}

.formatted-text { 
  display: block; 
}

.paragraph-break {
  height: 20px;
}

.t-bold {
  font-weight: 700;
  color: #fff;
  font-size: 16px;
}

.t-g { 
  color: var(--accent); 
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
}

.t-r { 
  color: #ff4444; 
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
}

.t-y { 
  color: #ffd700; 
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
}

.md-h2, .md-h3 {
  font-size: 20px;
  font-weight: bold;
  display: block;
  margin: 10px 0;
}

.actions { 
  display: flex; 
  gap: 8px; 
  padding: 12px 0px 0px 0px;
    border-top: 1px solid;
  margin-top: 12px; 
  flex-wrap: wrap;
}

.actions button { 
  background: #1a1a1a; 
  border: 1px solid var(--border); 
  color: var(--text-dimmer); 
  cursor: pointer; 
  transition: all 0.2s; 
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.actions button:hover { 
  color: var(--accent); 
  background: rgba(0, 255, 136, 0.1);
  border-color: var(--accent);
  transform: translateY(-2px);
}

.img-container { 
  margin: 20px 0; 
  position: relative; 
  border-radius: 16px; 
  max-width: 500px;
  overflow: hidden; 
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.msg-img { 
  width: 100%; 
  display: block; 
  cursor: pointer; 
  transition: all 0.5s ease;
}

.msg-img.hidden { 
  opacity: 0; 
}

.msg-img.visible { 
  opacity: 1; 
}

.msg-img:hover {
  transform: scale(1.02);
}

.user-up-img { 
  max-width: 200px; 
  border-radius: 12px;
  margin-bottom: 12px;
cursor: pointer;
border: 1px solid var(--border);
transition: transform 0.2s;
}
.user-up-img:hover {
transform: scale(1.05);
}
.img-skeleton {
width: 300px;
height: 300px;
background: linear-gradient(135deg, #0a0a0a, #1a1a1a);
display: flex;
flex-direction: column;
padding: 0px 20px;
align-items: center;
justify-content: center;
gap: 20px;
position: relative;
overflow: hidden;
}
.skeleton-pulse {
width: 100%;
height: 100%;
background: linear-gradient(90deg,
transparent 0%,
rgba(0, 255, 136, 0.1) 25%,
rgba(0, 255, 136, 0.2) 50%,
rgba(0, 255, 136, 0.1) 75%,
transparent 100%
);
background-size: 200% 100%;
animation: skeleton-load 2s infinite;
position: absolute;
top: 0;
left: 0;
}
@keyframes skeleton-load {
from { background-position: 200% 0; }
to { background-position: -200% 0; }
}
.generating-text {
display: flex;
flex-direction: column;
align-items: center;
gap: 15px;
z-index: 2;
}
.spin-icon {
color: var(--accent);
animation: spin 2s linear infinite;
filter: drop-shadow(0 0 10px var(--accent));
}
@keyframes spin {
from { transform: rotate(0deg); }
to { transform: rotate(360deg); }
}
.gen-title {
font-size: 17px;
font-weight: 600;
color: var(--accent);
text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}
.gen-dots {
display: flex;
gap: 8px;
}
.gen-dots span {
width: 10px;
height: 10px;
border-radius: 50%;
background: var(--accent);
animation: dot-pulse 1.4s ease-in-out infinite;
box-shadow: 0 0 10px var(--accent);
}
.gen-dots span:nth-child(2) { animation-delay: 0.2s; }
.gen-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-pulse {
0%, 100% { transform: scale(0.8); opacity: 0.5; }
50% { transform: scale(1.2); opacity: 1; }
}
.img-download-btn {
position: absolute;
top: 15px;
right: 15px;
background: rgba(0, 0, 0, 0.7);
backdrop-filter: blur(10px);
border: 1px solid var(--border);
color: #fff;
padding: 10px;
border-radius: 10px;
cursor: pointer;
transition: all 0.2s;
opacity: 0;
}
.img-container:hover .img-download-btn {
opacity: 1;
}
.img-download-btn:hover {
background: var(--accent);
color: #000;
transform: scale(1.1);
}
.code-card {
background: var(--code-bg);
border: 1px solid var(--border);
border-radius: 14px;
margin: 25px 0;
overflow: hidden;
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
.code-header {
background: #151515;
padding: 12px 18px;
display: flex;
justify-content: space-between;
align-items: center;
font-size: 13px;
color: var(--text-dim);
border-bottom: 1px solid var(--border);
}
.code-dots {
display: flex;
gap: 7px;
align-items: center;
}
.code-dot {
width: 12px;
height: 12px;
border-radius: 50%;
}
.code-dot.red { background: #ff5f57; }
.code-dot.yellow { background: #ffbd2e; }
.code-dot.green { background: #28ca42; }
.code-lang {
color: var(--text-dim);
font-weight: 600;
font-size: 12px;
letter-spacing: 0.5px;
}
.code-copy {
background: none;
border: 1px solid var(--border);
color: var(--text-dim);
padding: 6px 12px;
border-radius: 6px;
cursor: pointer;
transition: all 0.2s;
display: flex;
align-items: center;
gap: 5px;
}
.code-copy:hover {
background: var(--accent);
color: #000;
border-color: var(--accent);
}
pre {
padding: 20px;
overflow-x: auto;
margin: 0;
font-family: 'JetBrains Mono', 'Fira Code', monospace;
font-size: 14px;
max-width: 700px;
color: var(--accent);
line-height: 1.6;
}
.footer {
padding: 20px 15%;
border-top: 1px solid var(--border);
background: none !important;
}
.mode-toggles {
display: flex;
gap: 10px;
margin-bottom: 15px;
justify-content: center;
}
.mode-btn {
background: #1a1a1a;
border: 1px solid var(--border);
color: var(--text-dim);
padding: 10px 20px;
border-radius: 12px;
cursor: pointer;
transition: all 0.2s;
font-size: 14px;
font-weight: 600;
display: flex;
align-items: center;
gap: 8px;
}
.mode-btn:hover {
border-color: var(--accent);
transform: translateY(-2px);
}
.mode-btn.active {
background: var(--accent);
color: #000;
border-color: var(--accent);
}
.input-box {
background: #151515;
border-radius: 24px;
border: 1px solid var(--border);
padding: 10px 18px;
transition: all 0.3s;
position: relative;
}
.input-box:focus-within {
border-color: var(--accent);
background: #1a1a1a;
box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
}
.pasted-preview {
background: #0d0d0d;
border: 1px solid var(--border);
border-radius: 10px;
padding: 12px;
margin-bottom: 10px;
max-height: 100px;
overflow-y: auto;
font-size: 13px;
color: var(--text-dim);
position: relative;
}

.pasted-label {
display: inline-block;
background: var(--accent);
color: #000;
padding: 2px 8px;
border-radius: 4px;
font-size: 11px;
font-weight: 700;
margin-bottom: 8px;
}
.pasted-close {
position: absolute;
top: 8px;
right: 8px;
background: none;
border: none;
color: #666;
cursor: pointer;
padding: 4px;
border-radius: 4px;
transition: all 0.2s;
}
.pasted-close:hover {
color: #ff4444;
background: rgba(255, 68, 68, 0.1);
}
.row {
display: flex;
align-items: flex-end;
gap: 12px;
}
textarea {
flex: 1;
background: none;
border: none;
color: #fff;
outline: none;
resize: none;
font-size: 15px;
padding: 8px 0;
max-height: 200px;
line-height: 1.5;
font-family: inherit;
}
textarea::placeholder {
color: var(--text-dimmer);
}
.send-btn {
background: var(--accent);
color: #000;
width: 42px;
height: 42px;
border-radius: 50%;
border: none;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
transition: all 0.2s;
flex-shrink: 0;
}
.send-btn:hover {
background: var(--accent-hover);
transform: scale(1.1);
}
.send-btn.stop {
background: #ff4444;
color: #fff;
}
.send-btn.stop:hover {
background: #ff3333;
}
.tool-btn {
background: none;
border: none;
color: var(--accent);
cursor: pointer;
opacity: 0.8;
padding: 8px;
border-radius: 8px;
transition: all 0.2s;
}

.pre-img {
width: 60px;
height: 60px;
position: relative;
margin-bottom: 12px;
margin-left: 10px;
}
.pre-img img {
width: 100%;
height: 100%;
border-radius: 10px;
object-fit: cover;
border: 2px solid var(--accent);
}
.pre-img button {
position: absolute;
top: -8px;
right: -8px;
background: #ff4444;
border-radius: 50%;
border: none;
color: #fff;
width: 24px;
height: 24px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
transition: all 0.2s;
}
.pre-img button:hover {
background: #ff3333;
transform: scale(1.1);
}
.toast {
position: fixed;
top: 25px;
left: 50%;
transform: translateX(-50%);
background: var(--accent);
color: #000;
padding: 14px 28px;
border-radius: 50px;
font-weight: 700;
z-index: 10000;
animation: toastIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
font-size: 14px;
}
.img-modal {
position: fixed;
top: 0;
left: 0;
width: 100%;
height: 100%;
background: rgba(0,0,0,0.95);
z-index: 2000;
display: flex;
align-items: center;
justify-content: center;
backdrop-filter: blur(10px);
animation: fadeIn 0.2s ease;
}
.img-modal img {
max-width: 90%;
max-height: 90%;
border-radius: 12px;
box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
}
.close-mod {
position: absolute;
top: 30px;
right: 30px;
font-size: 45px;
color: #fff;
cursor: pointer;
transition: all 0.2s;
filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.5));
}
.close-mod:hover {
color: var(--accent);
transform: scale(1.1);
}
.kimo-thinking {
display: flex;
align-items: center;
gap: 12px;
padding: 18px;
color: var(--text-dim);
animation: fadeIn 0.3s ease;
}
.thinking-pulse {
width: 10px;
height: 10px;
background: var(--accent);
border-radius: 50%;
animation: pulse 1.5s infinite;
box-shadow: 0 0 15px var(--accent);
}
@keyframes pulse {
0%, 100% { opacity: 0.4; transform: scale(1); }
50% { opacity: 1; transform: scale(1.4); }
}
@media (max-width: 768px) {
.sidebar {
position: fixed;
left: 0;
transform: translateX(-100%);
width: 100% !important;
height: 100%;
}

pre{
max-width: 300px;
}
.sidebar.show {
transform: translateX(0);
}
.mob-menu-btn, .close-sidebar-mob {
display: block;
}
.chat-window, .footer {
padding: 15px;
}
.chat-item {
padding: 15px;
}
.hero h1 {
font-size: 28px;
}
.resizer {
display: none;
}
.input-box {
margin-bottom: 70px;
}
.mode-toggles {
flex-wrap: wrap;
}
.mode-btn {
font-size: 13px;
padding: 8px 16px;
}
}
@keyframes fadeIn {
from { opacity: 0; transform: translateY(15px); }
to { opacity: 1; transform: translateY(0); }
}
@keyframes toastIn {
from { top: -30px; opacity: 0; }
to { top: 25px; opacity: 1; }
}


@media (max-width: 400px) {
  .Tinglash {
    display: none !important;
  }
}

      `}</style>
{toast && <div className="toast">{toast}</div>}

<aside
  className={`sidebar ${menuOpen ? 'show' : ''}`}
  style={{ width: window.innerWidth > 768 ? `${sidebarWidth}px` : '100%' }}
>
  <div className="sb-header">
    <div className="brand">
      <IoSparkles className="spark-icon" color="#00ff88" />
      KIMO AI
    </div>

    <div className="sb-actions">
    <button className="add-btn" title="ai bilan video muloqot" onClick={startVideoChat}>
<IoVideocam  size={24}/>
      </button>
      <button className="add-btn" onClick={createNewChat} title="Yangi suhbat">
        <IoAdd size={24} />
      </button>
      <button className="close-sidebar-mob" onClick={() => setMenuOpen(false)}>
        <IoClose size={28} />
      </button>
    </div>
  </div>

  <div className="chat-history">
    {conversations.map(c => (
      <div
        key={c.id}
        className={`chat-item ${currentConvId === c.id ? 'active' : ''}`}
        onClick={() => {
          setCurrentConvId(c.id);
          setMenuOpen(false);
        }}
      >

<IoChatbubbleOutline className="chat-icon" size={20} />
<span className="title">{c.title}</span>
<button className="del-btn always-show" onClick={(e) => deleteChat(e, c.id)}>
<IoTrashOutline size={18} />
</button>
</div>
))}
</div>
<div style={{ padding: '20px', textAlign: 'center' }}>
  <img 
    src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
    alt="Google Play" 
    style={{ width: '150px', cursor: 'pointer' }} 
    onClick={downloadApk} 
  />
</div>
<div className="resizer" onMouseDown={startResizing} />
</aside>
<main className="main">
    <header className="navbar">
      <button className="mob-menu-btn" onClick={() => setMenuOpen(true)}>
        <IoMenu size={28}/>
      </button>
      <div className="nav-title">KIMO ULTIMATE</div>
      <div className="nav-right-icon">
        <IoSparkles color="#00ff88" size={22}/>
      </div>
    </header>

    <section className="chat-window" ref={chatWindowRef}>
      {currentMessages.length === 0 && (
        <div className="hero">
          <div className="hero-icon">
            <IoSparkles size={80} />
          </div>
          <h1>KIMO AI</h1>
          <p>Menga istalgan mavzuda savol bering, kod yozdiring yoki rasm yarating ✨</p>
        </div>
      )}
      {currentMessages.map((m, idx) => {
        const isLast = m.role === 'assistant' && idx === currentMessages.length - 1 && isTyping;
        return (
          <div key={idx} className={`msg-row ${m.role}`}>
            <div className="bubble">
              {m.image && (
                <img 
                  src={m.image} 
                  className="user-up-img" 
                  alt="User upload" 
                  onClick={() => setFullScreenImage(m.image)}
                />
              )}
              <div className="msg-text">
                {parseMD(isLast ? typingText : m.content, m.isImage)}
              </div>
              {m.role === 'assistant' && !isTyping && !m.isImage && (
                <div className="actions">
                  <button className='Tinglash' onClick={() => speak(m.content)} title="Eshittirish">
                    <IoVolumeMediumOutline size={18}/>
                    Tinglash
                  </button>
                  <button onClick={() => {
                    navigator.clipboard.writeText(m.content); 
                    notify("Nusxalandi ✓");
                  }}>
                    <IoCopyOutline size={18}/>
                    Nusxalash
                  </button>
                   <button onClick={() => updateConvMsgs(
                    currentMessages.map((msg, i) => 
                      i === idx ? {...msg, liked: !msg.liked, disliked: false} : msg
                    )
                  )}>
                    {m.liked ? <IoThumbsUp color="#00ff88" size={18}/> : <IoThumbsUpOutline size={18}/>}
                  </button>
                  <button onClick={() => updateConvMsgs(
                    currentMessages.map((msg, i) => 
                      i === idx ? {...msg, disliked: !msg.disliked, liked: false} : msg
                    )
                  )}>
                    {m.disliked ? <IoThumbsDown color="#ff4444" size={18}/> : <IoThumbsDownOutline size={18}/>}
                  </button>
                 
                </div>
              )}
            </div>
          </div>
        );
      })}
      {isLoading && !isTyping && (
        <div className="kimo-thinking">
          <div className="thinking-pulse"></div>
          <span>Kimo fikrlamoqda...</span>
        </div>
      )}
      <div ref={messagesEndRef} />
    </section>

    <footer style={{background:"none !important"}} className="footer">
      <div className="mode-toggles">
        <button 
          className={`mode-btn ${imageGenMode ? 'active' : ''}`}
          onClick={() => {
            setImageGenMode(!imageGenMode);
            if (!imageGenMode) setCoderMode(false);
            notify(imageGenMode ? 'Oddiy rejim' : 'Rasm yaratish rejimi');
          }}
        >
          <IoImageOutline size={20}/>
          {imageGenMode}
          Image Generation
        </button>
        <button 
          className={`mode-btn ${coderMode ? 'active' : ''}`}
          onClick={() => {
            setCoderMode(!coderMode);
            if (!coderMode) setImageGenMode(false);
            notify(coderMode ? 'Oddiy rejim' : 'Dasturchi rejimi');
          }}
        >
          <IoCodeSlashOutline size={20}/>
          {coderMode}
          Coder Mode
        </button>
      </div>
      <div className="input-box">
        {pastedText && (
          <div className="pasted-preview">
            <span className="pasted-label">QOʻSHILGAN MATN</span>
            <button className="pasted-close" onClick={() => setPastedText('')}>
              <IoClose size={16}/>
            </button>
            <div>{pastedText.slice(0, 150)}...</div>
          </div>
        )}
        {selectedImage && (
          <div className="pre-img">
            <img src={selectedImage.uri} alt="preview" />
            <button onClick={() => setSelectedImage(null)}>
              <IoClose size={14}/>
            </button>
          </div>
        )}
        <div className="row">
          <input 
            type="file" 
            ref={fileInputRef} 
            hidden 
            accept="image/*" 
            onChange={(e) => {
              const f = e.target.files[0];
              if(!f) return;
              const r = new FileReader();
              r.onloadend = () => setSelectedImage({ 
                uri: r.result, 
                base64: r.result.split(',')[1], 
                type: f.type 
              });
              r.readAsDataURL(f);
            }} 
          />
          <button className="tool-btn" onClick={() => fileInputRef.current.click()}>
            <IoImageOutline size={24}/>
          </button>
          <textarea 
            ref={textareaRef}
            rows="1" 
            placeholder={
              imageGenMode 
                ? "Qanday rasm yaratishimni xohlaysiz?..." 
                : coderMode 
                ? "Qanday kod yozishim kerak?..."
                : "Xabar yuboring..."
            }
            value={input} 
            onChange={e => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => { 
              if(e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendMessage(); 
              }
            }} 
          />
          <button 
            className={`send-btn ${isLoading || isTyping ? 'stop' : ''}`} 
            onClick={isLoading || isTyping ? () => abortControllerRef.current.abort() : sendMessage}
          >
            {isLoading || isTyping ? <IoSquare size={16}/> : <IoArrowUp size={24}/>}
          </button>
        </div>
      </div>
    </footer>
  </main>
  {fullScreenImage && (
    <div className="img-modal" onClick={() => setFullScreenImage(null)}>
      <IoCloseCircle className="close-mod" />
      <img src={fullScreenImage} alt="fullscreen" />
    </div>
  )}
</div>
);
}