import React, { useState, useRef, useEffect } from 'react';
import { IoArrowBack, IoMic, IoVideocam, IoVideocamOff, IoSync, IoStop } from 'react-icons/io5';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export default function VideoChat({ onBack }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' yoki 'environment'
  const [aiStatus, setAiStatus] = useState('Tayyorman...');
  const [lastAiResponse, setLastAiResponse] = useState('');
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastFrameRef = useRef(null);
  const streamRef = useRef(null);

  // 1. Kamerani boshqarish
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  async function startCamera() {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, width: { ideal: 1280 } }, 
        audio: true 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setAiStatus("Online");
    } catch (err) {
      console.error("Kamera xatosi:", err);
      setAiStatus("Ruxsat berilmadi");
    }
  }

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Kadrdan rasm olish (AI Vision uchun)
  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      lastFrameRef.current = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
    }
  };

  // 2. Ovoz yozish (MediaRecorder)
  const getSupportedMimeType = () => {
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    window.speechSynthesis.cancel();
    audioChunksRef.current = [];
    
    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};

    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        captureFrame(); 
        processSpeechAndVision(audioBlob, mimeType);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAiStatus("Sizni eshityapman...");
    } catch (err) {
      console.error("Mikrofon xatosi:", err);
      setAiStatus("Mikrofon xatosi");
    }
  };

  // 3. AI Tahlil (Whisper + Llama Vision)
  const processSpeechAndVision = async (audioBlob, mimeType) => {
    try {
      setAiStatus("Fikrlayapman...");
      
      // Matnga o'girish (Whisper)
      const formData = new FormData();
      const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
      formData.append("file", audioBlob, `audio.${ext}`);
      formData.append("model", "whisper-large-v3");
      formData.append("language", "uz");

      const transRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: formData
      });
      const transData = await transRes.json();
      const userText = transData.text;

      if (!userText || userText.length < 2) {
        setAiStatus("Tushunmadim, qaytadan ayting");
        return;
      }

      // Vision Tahlil (Llama 3.2 Vision)
      const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
              content: "Sen KIMO AI’san. Video muloqotdasan. Senga yuborilgan rasm orqali foydalanuvchini ko'rib turibsan. Uning emotsiyasi, kiyimi yoki atrofidagi narsalarga qarab samimiy va do'stona javob ber. Javobing o'zbek tilida, juda qisqa (2-3 gap) bo'lsin."
            },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${lastFrameRef.current}` } }
              ]
            }
          ]
        })
      });

      const chatData = await chatRes.json();
      const aiResponse = chatData.choices[0].message.content;
      
      setLastAiResponse(aiResponse);
      speak(aiResponse);
      setAiStatus("Online");

    } catch (err) {
      setAiStatus("Xatolik yuz berdi");
    }
  };

  // 4. Ovoz chiqarish (TTS)
  const speak = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'uz-UZ';
    utterance.rate = 1.0;
    
    // Ba'zi mobil qurilmalarda ovozni tanlash kerak
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('uz')) || voices.find(v => v.lang.startsWith('tr'));
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="v-chat-container">
      <style>{`
        .v-chat-container { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; z-index: 5000; font-family: sans-serif; }
        .v-header { padding: 20px; display: flex; align-items: center; gap: 15px; position: absolute; top: 0; z-index: 10; width: 100%; box-sizing: border-box; }
        .back-btn { background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px; border-radius: 50%; cursor: pointer; display: flex; }
        .v-main { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .user-video { width: 100%; height: 100%; object-fit: cover; transform: ${facingMode === 'user' ? 'scaleX(-1)' : 'none'}; }
        .ai-overlay { position: absolute; bottom: 130px; left: 20px; right: 20px; background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); padding: 15px; border-radius: 15px; border: 1px solid #00ff88; color: white; animation: slideUp 0.3s ease; }
        .v-footer { padding: 40px; display: flex; justify-content: center; align-items: center; gap: 30px; position: absolute; bottom: 0; width: 100%; box-sizing: border-box; background: linear-gradient(transparent, rgba(0,0,0,0.8)); }
        .control-btn { width: 65px; height: 65px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: 0.3s; }
        .mic-btn { background: #00ff88; color: #000; box-shadow: 0 0 20px rgba(0,255,136,0.4); }
        .mic-btn.active { background: #ff4444; color: white; animation: pulse 1.5s infinite; }
        .cam-btn { background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); }
        .status-badge { background: #00ff88; color: #000; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="v-header">
        <button className="back-btn" onClick={onBack}><IoArrowBack size={24} /></button>
        <span className="status-badge">{aiStatus}</span>
      </div>

      <div className="v-main">
        <video ref={videoRef} autoPlay playsInline muted className="user-video" style={{ display: isCameraOff ? 'none' : 'block' }} />
        {isCameraOff && <IoVideocamOff size={80} color="#555" />}
        {lastAiResponse && (
          <div className="ai-overlay">
            <div style={{color: '#00ff88', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px'}}>KIMO AI</div>
            {lastAiResponse}
          </div>
        )}
      </div>

      <div className="v-footer">
        <button className="control-btn cam-btn" onClick={() => {
          setIsCameraOff(!isCameraOff);
          streamRef.current.getVideoTracks()[0].enabled = isCameraOff;
        }}>
          {isCameraOff ? <IoVideocamOff size={28} /> : <IoVideocam size={28} />}
        </button>

        <button className={`control-btn mic-btn ${isRecording ? 'active' : ''}`} onClick={toggleRecording}>
          {isRecording ? <IoStop size={32} /> : <IoMic size={32} />}
        </button>

        <button className="control-btn cam-btn" onClick={toggleCamera}>
          <IoSync size={28} />
        </button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}