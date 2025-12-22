import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  IoMenu, IoAdd, IoChatbubbleOutline, IoTrashOutline, 
  IoSparkles, IoImageOutline, IoArrowUp, IoSquare, 
  IoCopyOutline, IoVolumeHighOutline, IoThumbsUpOutline, 
  IoThumbsUp, IoThumbsDownOutline, IoThumbsDown, 
  IoClose, IoCloseCircle, IoVolumeMediumOutline, IoDownloadOutline
} from 'react-icons/io5';
import './App.css';

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
          <IoSparkles className="spin-icon" size={30} />
          <span>KIMO san'at asari yaratmoqda...</span>
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
        <button style={{display:"none"}} className="img-download-btn" onClick={downloadImg}>
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
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentMessages = conversations.find(c => c.id === currentConvId)?.messages || [];

  useEffect(() => {
    const saved = localStorage.getItem('kimo_pro_v4');
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
      localStorage.setItem('kimo_pro_v4', JSON.stringify(conversations));
    }
  }, [conversations]);

  const chatWindowRef = useRef(null);

const isUserAtBottom = () => {
  const el = chatWindowRef.current;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop <= el.clientHeight + 30;
};


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

  const sendMessage = async () => {
    if (!input.trim() && !selectedImage) return;

    // Local snapshot for image to send to API
    const imgSnapshot = selectedImage;
    const textSnapshot = input;

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
    setSelectedImage(null);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      // API uchun xabarlarni tayyorlash
      const apiMessages = [
        { 
          role: 'system', 
          content: `Sen KIMO AI san, Abdulquddus tomonidan yaratilgan.
          1. Javobing tushunarli va tartibli bo'lsin.
          2. <g>, <r>, <y> teglari va **bold** ishlat.
          3. Rasm chizish: foydalanuvchi rasm so'rasa, inglizcha promptni kengaytirib https://image.pollinations.ai/prompt/{prompt}?nologo=true linkini ber.
          4. Foydalanuvchi rasm yuborsa, uni diqqat bilan tahlil qil.
          5. Har doim o'zbek tilida javob ber.`
        }
      ];

      // Tarixni va rasmlarni qo'shish
      updatedMsgs.slice(-10).forEach(msg => {
        if (msg.role === 'user') {
          const userContent = [{ type: "text", text: msg.content || "Bu rasmda nima bor?" }];
          if (msg.imageBase64) {
            userContent.push({
              type: "image_url",
              image_url: { url: `data:${msg.imageType};base64,${msg.imageBase64}` }
            });
          }
          apiMessages.push({ role: 'user', content: userContent });
        } else {
          apiMessages.push({ role: 'assistant', content: msg.content });
        }
      });

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct', // Rasmni ko'radigan model
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 4096
        })
      });

      const data = await response.json();
      let aiText = data.choices[0].message.content;

      if (Math.random() > 0.6) aiText += ` ${STICKERS[Math.floor(Math.random() * STICKERS.length)]}`;

      const aiMsg = { 
        role: 'assistant', 
        content: aiText, 
        timestamp: new Date().toISOString(),
        liked: false,
        disliked: false
      };
      
      updateConvMsgs([...updatedMsgs, aiMsg]);
      typeEffect(aiText);
    } catch (e) {
      if (e.name !== 'AbortError') notify("Xatolik yuz berdi");
    } finally {
      setIsLoading(false);
    }
  };

  const updateConvMsgs = (msgs) => {
    setConversations(prev => prev.map(c => 
      c.id === currentConvId ? { ...c, messages: msgs, title: msgs[0]?.content.slice(0, 30) || 'Yangi suhbat' } : c
    ));
  };

  const typeEffect = (text) => {
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    
    typingIntervalRef.current = setInterval(() => {
      if (i < text.length) {
        const chunk = text.slice(i, i + 15);
        setTypingText(prev => prev + chunk);
        i += 15;
      } else {
        clearInterval(typingIntervalRef.current);
        setIsTyping(false);
      }
    }, 15);
  };

  const parseMD = (text) => {
    const parts = text.split(/(https:\/\/image\.pollinations\.ai\/prompt\/[^\s\)]+|```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.includes('pollinations.ai')) {
        return <ImageWithLoader key={i} src={part} onClick={() => setFullScreenImage(part)} />;
      }
      if (part.startsWith('```')) {
        const code = part.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');
        return (
          <div key={i} className="code-card">
            <div className="code-header">
              <span className="code-dot red"></span><span className="code-dot yellow"></span><span className="code-dot green"></span>
              <span className="code-lang">KIMO CODE</span>
              <button style={{background:"none", color:"white", border:"none"}} className="code-copy" onClick={() => {navigator.clipboard.writeText(code); notify("Nusxalandi");}}><IoCopyOutline/></button>
            </div>
            <pre className="code-pre"><code>{code}</code></pre>
          </div>
        );
      }
      return <span key={i} className="formatted-text" dangerouslySetInnerHTML={{ __html: formatTags(part) }} />;
    });
  };

  const formatTags = (t) => t
    .replace(/\n/g, '<br/>')
    .replace(/<g>(.*?)<\/g>/g, '<span class="t-g">$1</span>')
    .replace(/<r>(.*?)<\/r>/g, '<span class="t-r">$1</span>')
    .replace(/<y>(.*?)<\/y>/g, '<span class="t-y">$1</span>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}
      <aside className={`sidebar ${menuOpen ? 'show' : ''}`} style={{ width: window.innerWidth > 768 ? `${sidebarWidth}px` : '100%' }}>
        <div className="sb-header">
          <div className="brand"><IoSparkles className="spark-icon" color="#00ff88"/> KIMO AI</div>
          <div className="sb-actions">
            <button className="add-btn" onClick={createNewChat} title="Yangi suhbat"><IoAdd size={24}/></button>
            <button className="close-sidebar-mob" onClick={() => setMenuOpen(false)}><IoClose size={28}/></button>
          </div>
        </div>
        <div className="chat-history">
          {conversations.map(c => (
            <div key={c.id} className={`chat-item ${currentConvId === c.id ? 'active' : ''}`} onClick={() => {setCurrentConvId(c.id); setMenuOpen(false);}}>
              <IoChatbubbleOutline className="chat-icon" />
              <span className="title">{c.title}</span>
              <button className="del-btn always-show" onClick={(e) => deleteChat(e, c.id)}><IoTrashOutline /></button>
            </div>
          ))}
        </div>
        <div className="resizer" onMouseDown={startResizing} />
      </aside>

      <main className="main">
        <header className="navbar">
          <button className="mob-menu-btn" onClick={() => setMenuOpen(true)}><IoMenu size={28}/></button>
          <div className="nav-title">KIMO ULTIMATE</div>
          <div className="nav-right-icon"><IoSparkles color="#00ff88" size={20}/></div>
        </header>

        <section className="chat-window">
          {currentMessages.length === 0 && (
            <div className="hero">
              <div className="hero-icon"><IoSparkles size={80} /></div>
              <h1>KIMO AI</h1>
              <p>Menga istalgan mavzuda savol bering yoki rasm chizdiring ✨</p>
            </div>
          )}
          {currentMessages.map((m, idx) => {
            const isLast = m.role === 'assistant' && idx === currentMessages.length - 1 && isTyping;
            return (
              <div key={idx} className={`msg-row ${m.role}`}>
                <div className="bubble">
                  {m.image && <img src={m.image} className="user-up-img" alt="User upload" onClick={() => setFullScreenImage(m.image)}/>}
                  <div className="msg-text">{parseMD(isLast ? typingText : m.content)}</div>
                  {m.role === 'assistant' && !isTyping && (
                    <div className="actions">
                      <button onClick={() => speak(m.content)} title="Eshittirish"><IoVolumeMediumOutline/></button>
                      <button onClick={() => {navigator.clipboard.writeText(m.content); notify("Nusxalandi");}}><IoCopyOutline/></button>
                      <button onClick={() => updateConvMsgs(currentMessages.map((msg, i) => i === idx ? {...msg, liked: !msg.liked, disliked: false} : msg))}>
                        {m.liked ? <IoThumbsUp color="#00ff88"/> : <IoThumbsUpOutline/>}
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

        <footer className="footer">
          <div className="input-box">
            {selectedImage && (
              <div className="pre-img">
                <img src={selectedImage.uri} alt="preview" />
                <button onClick={() => setSelectedImage(null)}><IoClose/></button>
              </div>
            )}
            <div className="row">
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
                const f = e.target.files[0];
                if(!f) return;
                const r = new FileReader();
                r.onloadend = () => setSelectedImage({ uri: r.result, base64: r.result.split(',')[1], type: f.type });
                r.readAsDataURL(f);
              }} />
              <button className="tool-btn" onClick={() => fileInputRef.current.click()}><IoImageOutline size={24}/></button>
              <textarea rows="1" placeholder="Xabar yuboring..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} />
              <button className={`send-btn ${isLoading || isTyping ? 'stop' : ''}`} onClick={isLoading || isTyping ? () => abortControllerRef.current.abort() : sendMessage}>
                {isLoading || isTyping ? <IoSquare size={14}/> : <IoArrowUp size={24}/>}
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