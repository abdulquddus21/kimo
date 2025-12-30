import React, { useState, useRef, useEffect } from 'react';
import { IoArrowBack, IoMic, IoMicOff, IoVideocam, IoVideocamOff, IoSync } from 'react-icons/io5';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export default function VideoChat({ onBack }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [aiStatus, setAiStatus] = useState('Kutish kutilmoqda...');
  const [lastAiResponse, setLastAiResponse] = useState('');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Kamerani yoqish
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" }, 
          audio: true 
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        // Har 2 sekundda kadr olish
        const interval = setInterval(() => {
          captureFrame();
        }, 2000);

        return () => clearInterval(interval);
      } catch (err) {
        console.error("Kameraga ruxsat berilmadi:", err);
        setAiStatus("Xatolik: Kamera ruxsati yo'q");
      }
    }
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Kadrdan rasm olish (Base64)
  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      lastFrameRef.current = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
    }
  };

  // Ovozni yozishni boshlash/to'xtatish
  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAiStatus("Eshityapman...");
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    const stream = streamRef.current;
    mediaRecorderRef.current = new MediaRecorder(stream);
    
    mediaRecorderRef.current.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/m4a' });
      processSpeechAndVision(audioBlob);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
    setAiStatus("Gapiring...");
  };

  // Asosiy jarayon: Ovozni matnga aylantirish + AI Vision tahlili
  const processSpeechAndVision = async (audioBlob) => {
    try {
      setAiStatus("Fikrlayapman...");

      // 1. Whisper API (Transcription)
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.m4a");
      formData.append("model", "whisper-large-v3");

      const transResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: formData
      });
      const transData = await transResponse.json();
      const userText = transData.text;

      if (!userText || userText.trim().length === 0) {
        setAiStatus("Sizni eshitmadim");
        return;
      }

      // 2. Llama Vision API (User Image + Text)
      const chatResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "system",
              content: "Sen KIMO AI’san. Video muloqotdasan. Foydalanuvchini ko'rib turibsan. Samimiy, professional va do'stona gaplash. Javobing qisqa va lo'nda bo'lsin. Foydalanuvchi bilan ko'rishib turgandek harakat qil."
            },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { 
                  type: "image_url", 
                  image_url: { url: `data:image/jpeg;base64,${lastFrameRef.current}` } 
                }
              ]
            }
          ],
          max_tokens: 300
        })
      });

      const chatData = await chatResponse.json();
      const aiResponse = chatData.choices[0].message.content;
      
      setLastAiResponse(aiResponse);
      speak(aiResponse);
      setAiStatus("Online");

    } catch (err) {
      console.error(err);
      setAiStatus("Xatolik yuz berdi");
    }
  };

  // AI javobini ovoz chiqarib o'qish
  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'uz-UZ';
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="v-chat-container">
      <style>{`
        .v-chat-container {
          position: fixed;
          inset: 0;
          background: #000;
          display: flex;
          flex-direction: column;
          z-index: 5000;
          font-family: 'Inter', sans-serif;
          -webkit-tap-highlight-color: transparent;
        }
        .v-header {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 10;
        }
        .back-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          padding: 10px;
          border-radius: 50%;
          cursor: pointer;
          backdrop-filter: blur(10px);
        }
        .v-main {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .user-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        .ai-overlay {
          position: absolute;
          bottom: 120px;
          left: 20px;
          right: 20px;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(15px);
          padding: 15px;
          border-radius: 20px;
          border: 1px solid rgba(0,255,136,0.3);
          color: white;
          animation: slideUp 0.5s ease;
        }
        .v-footer {
          padding: 30px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 30px;
          background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
          position: absolute;
          bottom: 0; left: 0; right: 0;
        }
        .control-btn {
          width: 65px;
          height: 65px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.3s;
          color: white;
        }
        .mic-btn {
          background: #00ff88;
          color: black;
          box-shadow: 0 0 20px rgba(0,255,136,0.4);
        }
        .mic-btn.active {
          background: #ff4444;
          animation: pulse-red 1.5s infinite;
        }
        .cam-btn {
          background: rgba(255,255,255,0.2);
        }
        .status-badge {
          background: rgba(0,255,136,0.2);
          color: #00ff88;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        @keyframes pulse-red {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,68,68,0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 15px rgba(255,68,68,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,68,68,0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        canvas { display: none; }
      `}</style>

      <div className="v-header">
        <button className="back-btn" onClick={onBack}>
          <IoArrowBack size={24} />
        </button>
        <div>
          <span className="status-badge">{aiStatus}</span>
        </div>
      </div>

      <div className="v-main">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="user-video"
          style={{ display: isCameraOff ? 'none' : 'block' }}
        />
        {isCameraOff && <div style={{color: '#666'}}><IoVideocamOff size={80} /></div>}
        
        {lastAiResponse && (
          <div className="ai-overlay">
            <div style={{color: '#00ff88', fontSize: '12px', marginBottom: '5px', fontWeight: 800}}>KIMO AI</div>
            {lastAiResponse}
          </div>
        )}
      </div>

      <div className="v-footer">
        <button 
          className="control-btn cam-btn"
          onClick={() => {
            setIsCameraOff(!isCameraOff);
            streamRef.current.getVideoTracks()[0].enabled = isCameraOff;
          }}
        >
          {isCameraOff ? <IoVideocamOff size={28} /> : <IoVideocam size={28} />}
        </button>

        <button 
          className={`control-btn mic-btn ${isRecording ? 'active' : ''}`}
          onClick={toggleRecording}
        >
          {isRecording ? <IoMic size={32} /> : <IoMic size={32} />}
        </button>

        <button className="control-btn cam-btn" onClick={() => window.location.reload()}>
          <IoSync size={28} />
        </button>
      </div>

      <canvas ref={canvasRef} />
    </div>
  );
}