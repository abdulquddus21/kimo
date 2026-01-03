import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IoArrowBack, IoMic, IoVideocam, IoVideocamOff, IoSync, IoStop } from 'react-icons/io5';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || 'gsk_demo_key';

export default function VideoChat({ onBack }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [aiStatus, setAiStatus] = useState('Yuklanmoqda...');
  const [lastAiResponse, setLastAiResponse] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastFrameRef = useRef(null);
  const streamRef = useRef(null);
  const utteranceRef = useRef(null);
  const isMountedRef = useRef(true);

  // Kamerani ishga tushirish
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [facingMode]);

  const cleanup = useCallback(() => {
    // Ovozni to'xtatish
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // Yozishni to'xtatish
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('MediaRecorder stop error:', e);
      }
    }
    
    // Kamerani to'xtatish
    stopCamera();
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
  }, []);

  const startCamera = async () => {
    stopCamera();
    
    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setAiStatus('Online');
    } catch (err) {
      console.error('Kamera xatosi:', err);
      if (err.name === 'NotAllowedError') {
        setAiStatus('Kamera ruxsati berilmadi');
      } else if (err.name === 'NotFoundError') {
        setAiStatus('Kamera topilmadi');
      } else {
        setAiStatus('Kamera xatosi');
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const toggleCameraOnOff = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isCameraOff;
        setIsCameraOff(!isCameraOff);
      }
    }
  };

  // Kadrdan rasm olish
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      lastFrameRef.current = base64Image;
      return base64Image;
    } catch (err) {
      console.error('Rasm olish xatosi:', err);
      return null;
    }
  }, []);

  // Audio formatni aniqlash
  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Qo\'llab-quvvatlanadigan format:', type);
        return type;
      }
    }
    console.warn('Hech qanday format topilmadi');
    return 'video/webm'; // Default fallback
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    if (!streamRef.current) {
      setAiStatus('Kamera ishlamayapti');
      return;
    }

    // Oldingi ovozni to'xtatish
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    audioChunksRef.current = [];
    
    const mimeType = getSupportedMimeType();
    
    if (!mimeType) {
      setAiStatus('Audio yozish qo\'llab-quvvatlanmaydi');
      return;
    }

    try {
      // Faqat audio track ishlatish uchun yangi stream yaratish
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (!audioTrack) {
        setAiStatus('Mikrofon topilmadi');
        return;
      }

      // Faqat audio stream
      const audioStream = new MediaStream([audioTrack]);
      
      // Video yozish kerak bo'lsa, video+audio stream
      let recordStream;
      if (mimeType.startsWith('video/')) {
        recordStream = streamRef.current;
      } else {
        recordStream = audioStream;
      }

      const options = { 
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      };
      
      mediaRecorderRef.current = new MediaRecorder(recordStream, options);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log('Chunk olindi:', e.data.size, 'bytes');
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log('Recording to\'xtatildi, chunks:', audioChunksRef.current.length);
        
        if (audioChunksRef.current.length === 0) {
          setAiStatus('Audio yozilmadi');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Audio blob yaratildi:', audioBlob.size, 'bytes');
        
        if (audioBlob.size < 1000) {
          setAiStatus('Audio juda qisqa');
          return;
        }

        const frameData = captureFrame();
        await processSpeechAndVision(audioBlob, mimeType, frameData);
      };

      mediaRecorderRef.current.onerror = (e) => {
        console.error('MediaRecorder xatosi:', e.error);
        setAiStatus('Yozish xatosi: ' + (e.error?.name || 'Unknown'));
        setIsRecording(false);
      };

      mediaRecorderRef.current.onstart = () => {
        console.log('Recording boshlandi');
      };

      // Har 1 sekundda chunk olish
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setAiStatus('Tinglayapman...');
      console.log('MediaRecorder start qilindi');
      
    } catch (err) {
      console.error('Recording xatosi:', err.name, err.message);
      setAiStatus('Mikrofon xatosi: ' + err.name);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      } catch (e) {
        console.error('Stop recording error:', e);
      }
    }
  };

  // Speech va Vision tahlil
  const processSpeechAndVision = async (audioBlob, mimeType, frameData) => {
    try {
      setAiStatus('Tahlil qilyapman...');

      // 1. Whisper bilan matnga o'girish
      const formData = new FormData();
      
      // Video formatdan audio ajratib olish
      let audioFile = audioBlob;
      let filename = 'audio.webm';
      
      if (mimeType.startsWith('video/')) {
        filename = 'video.webm';
      } else if (mimeType.includes('mp4')) {
        filename = 'audio.mp4';
      } else if (mimeType.includes('ogg')) {
        filename = 'audio.ogg';
      }
      
      formData.append('file', audioFile, filename);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'uz');
      formData.append('response_format', 'json');
      formData.append('temperature', '0');

      console.log('Whisper ga yuborilmoqda:', filename, audioFile.size, 'bytes');

      const transcriptionResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: formData
      });

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error('Transcription xatosi:', errorText);
        throw new Error(`Transcription failed: ${transcriptionResponse.status}`);
      }

      const transcriptionData = await transcriptionResponse.json();
      const userText = transcriptionData.text?.trim();

      console.log('Transcription natijasi:', userText);

      if (!userText || userText.length < 2) {
        setAiStatus('Tushunmadim, qaytadan ayting');
        return;
      }

      // 2. Vision tahlil
      const messages = [
        {
          role: 'system',
          content: `Sen KIMO AI'san - samimiy va do'stona video yordamchisan. Senga foydalanuvchining rasmi va ovozli xabari yuboriladi. Javobingda:
- Foydalanuvchining emotsiyasi, kiyimi yoki atrofidagi muhim narsalarni eslatib o'ting
- Do'stona va samimiy bo'ling
- Javob 2-3 gap bo'lsin, juda qisqa va aniq
- Faqat o'zbek tilida javob bering`
        }
      ];

      // Tarix qo'shish (oxirgi 2 ta)
      const recentHistory = conversationHistory.slice(-4);
      messages.push(...recentHistory);

      // Yangi xabar
      const userMessage = {
        role: 'user',
        content: [
          { type: 'text', text: userText }
        ]
      };

      if (frameData) {
        userMessage.content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${frameData}`
          }
        });
      }

      messages.push(userMessage);

      const chatResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          messages: messages,
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (!chatResponse.ok) {
        throw new Error(`Chat failed: ${chatResponse.status}`);
      }

      const chatData = await chatResponse.json();
      const aiResponse = chatData.choices?.[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response from AI');
      }

      setLastAiResponse(aiResponse);
      
      // Tarixni yangilash
      setConversationHistory(prev => [
        ...prev.slice(-4),
        userMessage,
        { role: 'assistant', content: aiResponse }
      ]);

      speak(aiResponse);
      setAiStatus('Online');

    } catch (err) {
      console.error('AI tahlil xatosi:', err);
      setAiStatus('Xatolik yuz berdi');
      
      // Zaxira javob
      const fallbackResponse = 'Kechirasiz, sizni yaxshi eshitmadim. Iltimos, qaytadan urinib ko\'ring.';
      setLastAiResponse(fallbackResponse);
      speak(fallbackResponse);
    }
  };

  // Text-to-Speech
  const speak = (text) => {
    if (!window.speechSynthesis) {
      console.error('TTS qo\'llab-quvvatlanmaydi');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'uz-UZ';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Ovoz tanlash
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('uz') || 
      v.lang.startsWith('tr') || 
      v.lang.startsWith('ru')
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      console.log('Ovoz tugadi');
    };

    utterance.onerror = (e) => {
      console.error('TTS xatosi:', e);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="v-chat-container">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .v-chat-container {
          position: fixed;
          inset: 0;
          background: #000;
          display: flex;
          flex-direction: column;
          z-index: 5000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow: hidden;
        }

        .v-header {
          padding: env(safe-area-inset-top, 20px) 20px 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10;
          background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
        }

        .back-btn {
          background: rgba(255,255,255,0.25);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 10px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          width: 44px;
          height: 44px;
        }

        .back-btn:active {
          transform: scale(0.95);
          background: rgba(255,255,255,0.35);
        }

        .status-badge {
          background: #00ff88;
          color: #000;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 10px rgba(0,255,136,0.3);
        }

        .v-main {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #000;
        }

        .user-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: ${facingMode === 'user' ? 'scaleX(-1)' : 'none'};
        }

        .camera-off-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          color: #666;
        }

        .ai-overlay {
          position: absolute;
          bottom: 160px;
          left: 20px;
          right: 20px;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(20px);
          padding: 16px 18px;
          border-radius: 16px;
          border: 1px solid rgba(0,255,136,0.3);
          color: white;
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          max-height: 200px;
          overflow-y: auto;
        }

        .ai-label {
          color: #00ff88;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ai-label::before {
          content: '';
          width: 6px;
          height: 6px;
          background: #00ff88;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .ai-text {
          font-size: 15px;
          line-height: 1.5;
          color: #fff;
        }

        .v-footer {
          padding: 30px 20px calc(env(safe-area-inset-bottom, 20px) + 20px);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 30px;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
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
          color: white;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .control-btn:active {
          transform: scale(0.95);
        }

        .mic-btn {
          background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
          color: #000;
          box-shadow: 0 4px 30px rgba(0,255,136,0.5);
          width: 75px;
          height: 75px;
        }

        .mic-btn.active {
          background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
          color: white;
          animation: pulseRecord 1.5s infinite;
        }

        .cam-btn {
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        }

        .cam-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        @keyframes pulseRecord {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 4px 30px rgba(255,68,68,0.5);
          }
          50% { 
            transform: scale(1.08);
            box-shadow: 0 4px 40px rgba(255,68,68,0.8);
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Scrollbar styling */
        .ai-overlay::-webkit-scrollbar {
          width: 4px;
        }

        .ai-overlay::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
        }

        .ai-overlay::-webkit-scrollbar-thumb {
          background: #00ff88;
          border-radius: 2px;
        }

        @media (max-width: 400px) {
          .control-btn {
            width: 55px;
            height: 55px;
          }
          
          .mic-btn {
            width: 65px;
            height: 65px;
          }
          
          .v-footer {
            gap: 20px;
            padding: 20px 15px calc(env(safe-area-inset-bottom, 15px) + 15px);
          }
        }
      `}</style>

      <div className="v-header">
        <button className="back-btn" onClick={onBack} aria-label="Orqaga">
          <IoArrowBack size={24} />
        </button>
        <span className="status-badge">{aiStatus}</span>
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
        
        {isCameraOff && (
          <div className="camera-off-placeholder">
            <IoVideocamOff size={80} color="#444" />
            <p style={{color: '#666', fontSize: '14px'}}>Kamera o'chirilgan</p>
          </div>
        )}

        {lastAiResponse && (
          <div className="ai-overlay">
            <div className="ai-label">KIMO AI</div>
            <div className="ai-text">{lastAiResponse}</div>
          </div>
        )}
      </div>

      <div className="v-footer">
        <button
          className="control-btn cam-btn"
          onClick={toggleCameraOnOff}
          aria-label={isCameraOff ? "Kamerani yoqish" : "Kamerani o'chirish"}
        >
          {isCameraOff ? <IoVideocamOff size={28} /> : <IoVideocam size={28} />}
        </button>

        <button
          className={`control-btn mic-btn ${isRecording ? 'active' : ''}`}
          onClick={toggleRecording}
          aria-label={isRecording ? "Yozishni to'xtatish" : "Yozishni boshlash"}
        >
          {isRecording ? <IoStop size={32} /> : <IoMic size={32} />}
        </button>

        <button
          className="control-btn cam-btn"
          onClick={toggleCamera}
          aria-label="Kamerani almashtirish"
        >
          <IoSync size={28} />
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
}