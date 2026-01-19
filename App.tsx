
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wand2, 
  Paintbrush, 
  UserSquare, 
  Scissors, 
  Baby, 
  Megaphone, 
  History, 
  Shirt, 
  MessageSquare, 
  Rotate3d,
  Menu,
  X,
  Sparkles,
  Trash2,
  Layers,
  Loader2,
  CheckCircle2,
  Settings,
  RefreshCw,
  Send,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Zap,
  Eye,
  EyeOff,
  UserCheck,
  Key,
  AlertCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { ToolId, Message } from './types';
import ImageUpload from './components/ImageUpload';
import LoadingOverlay from './components/LoadingOverlay';
import ResultDisplay from './components/ResultDisplay';
import { GoogleGenAI } from "@google/genai";

// TypeScript 전역 선언
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }

  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
    }
  }
}

const SidebarItem: React.FC<{ 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}> = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200
      ${active 
        ? 'text-indigo-400 sidebar-item-active' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ToolId>(ToolId.MagicEditor);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
  const [aiEngine, setAiEngine] = useState<'flash' | 'pro'>('flash');
  
  // API Key 관련 상태
  const [manualKey, setManualKey] = useState(() => localStorage.getItem('gemini_manual_key') || "");
  const [showKey, setShowKey] = useState(false);
  
  const [image1, setImage1] = useState<File | null>(null);
  const [image2, setImage2] = useState<File | null>(null);
  const [characterAvatarUrl, setCharacterAvatarUrl] = useState<string | null>(null);
  const [itemImages, setItemImages] = useState<(File | null)[]>([null]); 
  const [prompt, setPrompt] = useState("");
  const [option, setOption] = useState("");
  
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'ai', text: "안녕하세요! 사진을 업로드하고 대화를 시작해 보세요.", timestamp: new Date() }
  ]);
  const [chatInput, setChatInput] = useState("");

  const [apiStatus, setApiStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [verifiedEngine, setVerifiedEngine] = useState<'flash' | 'pro' | null>(null);
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);
  
  // 생성 중 발생한 에러 상태
  const [generationError, setGenerationError] = useState<string | null>(null);

  const getActiveApiKey = useCallback(() => {
    return manualKey || process.env.API_KEY || "";
  }, [manualKey]);

  useEffect(() => {
    if (image1) {
      const url = URL.createObjectURL(image1);
      setCharacterAvatarUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCharacterAvatarUrl(null);
    }
  }, [image1]);

  useEffect(() => {
    if (verifiedEngine !== aiEngine) {
      setApiStatus('idle');
      setTestErrorMessage(null);
    }
  }, [aiEngine, verifiedEngine]);

  useEffect(() => {
    const checkInitialKey = async () => {
      const currentKey = getActiveApiKey();
      if (currentKey) {
        setApiStatus('success');
        setVerifiedEngine(aiEngine);
      } else if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) {
          setApiStatus('success');
          setVerifiedEngine(aiEngine);
        }
      }
    };
    checkInitialKey();
  }, [getActiveApiKey]);

  const handleManualKeyChange = (val: string) => {
    setManualKey(val);
    localStorage.setItem('gemini_manual_key', val);
    setApiStatus('idle');
    setVerifiedEngine(null);
    setTestErrorMessage(null);
    setGenerationError(null);
  };

  const handleTestConnection = async () => {
    const keyToTest = manualKey || process.env.API_KEY;
    if (!keyToTest) {
      setApiStatus('error');
      setTestErrorMessage("테스트할 API 키가 없습니다.");
      return;
    }

    setApiStatus('testing');
    setTestErrorMessage(null);
    setGenerationError(null);
    
    // 이미지 모델 접근성 테스트를 위해 명시적으로 지정
    const testModel = aiEngine === 'pro' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash-image';
    
    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      // 실제 생성 없이 최소한의 요청으로 권한 확인
      await ai.models.generateContent({
        model: testModel,
        contents: 'test',
      });
      
      setApiStatus('success');
      setVerifiedEngine(aiEngine);
    } catch (err: any) {
      console.error("Connection test failed:", err);
      setApiStatus('error');
      setVerifiedEngine(null);
      let msg = err.message || "연결 실패";
      
      // 구체적인 에러 코드 분석
      if (msg.toLowerCase().includes("limit: 0")) {
        msg = "⚠️ [중요] 할당량 없음(Limit: 0). 이 키는 텍스트는 가능할지라도 이미지 생성 권한이 0으로 설정되어 있습니다. Google Cloud Console에서 'Generative Language API' 할당량이 0인지 확인하거나, 결제 수단이 등록된 다른 프로젝트의 키를 사용해 보세요.";
      } else if (msg.includes("429")) {
        msg = "요청이 너무 많습니다(429). 잠시 후 다시 시도하세요.";
      } else if (msg.includes("403") || msg.includes("404")) {
        msg = "인증 실패: 잘못된 API 키이거나 모델 권한이 없습니다.";
      }
      
      setTestErrorMessage(msg);
    }
  };

  const handleOpenKeySelect = async () => {
    try {
      if (window.aistudio?.openSelectKey) {
        await window.aistudio.openSelectKey();
        setApiStatus('success');
        setVerifiedEngine(aiEngine);
        setTestErrorMessage(null);
      }
    } catch (err) {
      setApiStatus('error');
    }
  };

  const fileToPart = async (file: File) => {
    return new Promise<any>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          const MAX_DIM = 1024;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) { height = (height / width) * MAX_DIM; width = MAX_DIM; }
            else { width = (width / height) * MAX_DIM; height = MAX_DIM; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error("Canvas context failed")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          resolve({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleGenerate = async () => {
    const apiKey = getActiveApiKey();
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setLoading(true);
    setGenerationError(null);
    let retryCount = 0;
    const maxRetries = 2; // 재시도 횟수 증가

    const performGeneration = async (): Promise<void> => {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const parts: any[] = [];
        let systemTask = "";
        
        if (activeTab === ToolId.VirtualModelFitting) {
          systemTask = `AI ${option} model with items.`;
          for (const file of itemImages) if (file) parts.push(await fileToPart(file));
        } else if (activeTab === ToolId.ItemSynthesis) {
          if (image1) parts.push(await fileToPart(image1));
          systemTask = "Synthesize items naturally.";
          for (const file of itemImages) if (file) parts.push(await fileToPart(file));
        } else {
          if (image1) parts.push(await fileToPart(image1));
          if (image2) parts.push(await fileToPart(image2));
          switch (activeTab) {
            case ToolId.MagicEditor: systemTask = `Edit: ${prompt}`; break;
            case ToolId.SketchToWebtoon: systemTask = "Webtoon style"; break;
            case ToolId.IDPhotoMaker: systemTask = `ID photo ${option}.`; break;
            case ToolId.FaceHairChanger: systemTask = "New hairstyle"; break;
            case ToolId.FutureBaby: systemTask = `Predict baby ${option}.`; break;
            case ToolId.AdPosterMaker: systemTask = `Ad poster: ${prompt}`; break;
            case ToolId.TimeTraveler: systemTask = `Travel to ${option}.`; break;
            case ToolId.Character360: systemTask = "360 view"; break;
          }
        }
        
        parts.push({ text: systemTask });
        const targetModel = aiEngine === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: { parts },
          config: { 
            imageConfig: { 
              aspectRatio: "3:4", 
              ...(targetModel === 'gemini-3-pro-image-preview' ? { imageSize: "1K" } : {})
            } 
          }
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          setResult(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
        } else {
          throw new Error("결과 이미지를 수신하지 못했습니다.");
        }
      } catch (error: any) {
        const errorMsg = error.message || "";
        
        // 429 오류 및 재시도 로직 (지수 백오프)
        if ((errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota")) && retryCount < maxRetries) {
          retryCount++;
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.warn(`Retry ${retryCount} after ${waitTime}ms...`);
          await new Promise(res => setTimeout(res, waitTime));
          return performGeneration();
        }
        throw error;
      }
    };

    try {
      await performGeneration();
    } catch (error: any) {
      console.error(error);
      const msg = error.message || "";
      if (msg.toLowerCase().includes("limit: 0")) {
        setGenerationError("⚠️ 할당량 제한 오류 (Limit: 0). 이 API 키는 이미지 생성 할당량이 0입니다. 프로젝트 설정에서 할당량을 확인하거나 다른 프로젝트의 키를 사용하세요.");
      } else if (msg.includes("429")) {
        setGenerationError("요청 한도 초과 (429). 약 1분 후에 다시 시도해 주세요.");
      } else {
        setGenerationError(`생성 실패: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const apiKey = getActiveApiKey();
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }
    
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: chatInput, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput; setChatInput("");
    
    try {
      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [];
      if (image1) parts.push(await fileToPart(image1));
      parts.push({ text: `Reply to: ${currentInput}` });
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts } 
      });
      const aiMsg: Message = { id: (Date.now() + 1).toString(), sender: 'ai', text: response.text || "...", timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      setMessages(prev => [...prev, { id: 'err', sender: 'ai', text: "메시지 전송 실패 (할당량 초과 가능성)", timestamp: new Date() }]);
    }
  };

  const resetTool = useCallback(() => {
    setResult(null); setImage1(null); setImage2(null); setItemImages([null]); setPrompt(""); setOption("");
    setGenerationError(null);
    setMessages([{ id: '1', sender: 'ai', text: "안녕하세요! 사진을 업로드하고 대화를 시작해 보세요.", timestamp: new Date() }]);
  }, []);

  useEffect(() => { resetTool(); }, [activeTab, resetTool]);

  const addImageSlot = () => { if (itemImages.length < 6) setItemImages([...itemImages, null]); };
  const removeImageSlot = (idx: number) => { setItemImages(itemImages.length > 1 ? itemImages.filter((_, i) => i !== idx) : [null]); };
  const updateItemImage = (idx: number, file: File | null) => {
    const newList = [...itemImages]; newList[idx] = file; setItemImages(newList);
  };

  const tools = [
    { id: ToolId.MagicEditor, label: '매직 에디터', icon: Wand2, desc: 'AI 사진 편집' },
    { id: ToolId.SketchToWebtoon, label: '스케치 투 웹툰', icon: Paintbrush, desc: '웹툰 변환' },
    { id: ToolId.IDPhotoMaker, label: '증명사진 메이커', icon: UserSquare, desc: 'ID 사진 생성' },
    { id: ToolId.FaceHairChanger, label: '헤어 & 페이스 체인저', icon: Scissors, desc: '스타일 변경' },
    { id: ToolId.FutureBaby, label: '2세 예측', icon: Baby, desc: '미래 아기 모습' },
    { id: ToolId.AdPosterMaker, label: '광고 포스터 메이커', icon: Megaphone, desc: '포스터 제작' },
    { id: ToolId.TimeTraveler, label: '타임 트래블러', icon: History, desc: '나이/시대 변환' },
    { id: ToolId.VirtualModelFitting, label: '가상 모델 피팅', icon: Shirt, desc: 'AI 모델 생성' },
    { id: ToolId.ItemSynthesis, label: '아이템 합성', icon: Layers, desc: '인물 정체성 유지 합성' },
    { id: ToolId.PersonaChat, label: '페르소나 채팅', icon: MessageSquare, desc: '캐릭터와 대화' },
    { id: ToolId.Character360, label: '360도 캐릭터 뷰', icon: Rotate3d, desc: '턴어라운드 생성' },
  ];

  const currentTool = tools.find(t => t.id === activeTab);

  return (
    <div className="flex h-screen w-full bg-[#030712] text-gray-100 font-sans overflow-hidden">
      {loading && <LoadingOverlay />}
      
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative glass w-full max-w-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col bg-[#0f121d]">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 rounded-xl"><Settings size={20} className="text-indigo-400" /></div>
                <h2 className="font-bold text-lg">사용자 API 설정</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all"><X size={20} className="text-gray-400" /></button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar max-h-[75vh]">
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-2xl space-y-6">
                <div className="flex gap-3">
                  <UserCheck size={20} className="text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">Gemini API 키 연결</p>
                    <p className="text-[11px] text-gray-400 mt-1">API 연결 시 실제 이미지 생성 권한을 함께 테스트합니다.</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">API KEY</label>
                    <div className="relative">
                      <input 
                        type={showKey ? "text" : "password"}
                        value={manualKey}
                        onChange={(e) => handleManualKeyChange(e.target.value)}
                        placeholder="AI Studio 키 입력..."
                        className="w-full bg-black/40 border-2 border-white/5 rounded-xl px-10 py-3.5 text-sm focus:border-indigo-500 outline-none transition-all"
                      />
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                      <button onClick={() => setShowKey(!showKey)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-indigo-400">
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-500 hover:text-indigo-400 flex items-center gap-1">키 발급받기 <ExternalLink size={10} /></a>
                      <button 
                        onClick={handleTestConnection}
                        disabled={apiStatus === 'testing' || (!manualKey && !process.env.API_KEY)}
                        className="text-[10px] font-bold text-indigo-400 hover:text-white flex items-center gap-1.5 transition-all disabled:opacity-30 px-3 py-1.5 bg-indigo-400/5 hover:bg-indigo-400/20 rounded-lg border border-indigo-400/20"
                      >
                        {apiStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        연결 테스트
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">생성 엔진 모드</label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAiEngine('flash')} className={`p-4 rounded-2xl border-2 flex flex-col gap-2 transition-all text-left ${aiEngine === 'flash' ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-600/10' : 'bg-white/5 border-white/5 text-gray-400 opacity-60'}`}>
                    <Zap size={18} className={aiEngine === 'flash' ? 'text-indigo-400' : 'text-gray-500'} />
                    <span className="font-bold text-sm">Flash 모드</span>
                    <span className="text-[10px] text-gray-400 leading-tight">무료 등급 최적화</span>
                  </button>
                  <button onClick={() => setAiEngine('pro')} className={`p-4 rounded-2xl border-2 flex flex-col gap-2 transition-all text-left ${aiEngine === 'pro' ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-600/10' : 'bg-white/5 border-white/5 text-gray-400 opacity-60'}`}>
                    <Cpu size={18} className={aiEngine === 'pro' ? 'text-indigo-400' : 'text-gray-500'} />
                    <span className="font-bold text-sm">Pro 모드</span>
                    <span className="text-[10px] text-gray-400 leading-tight">유료 결제 키 전용</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {apiStatus === 'success' ? <ShieldCheck size={16} className="text-green-500" /> : <ShieldAlert size={16} className={apiStatus === 'error' ? 'text-red-500' : 'text-gray-500'} />}
                    <span className={`text-xs font-bold uppercase tracking-widest ${apiStatus === 'success' ? 'text-green-500' : (apiStatus === 'error' ? 'text-red-500' : 'text-gray-500')}`}>
                      {apiStatus === 'success' ? `${verifiedEngine?.toUpperCase()} 연결 성공` : (apiStatus === 'error' ? '연결 실패' : '상태 확인 중...')}
                    </span>
                  </div>
                </div>
                {apiStatus === 'error' && testErrorMessage && (
                  <div className="flex gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    <p className="text-[11px] text-red-400 leading-relaxed font-medium">{testErrorMessage}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-black/20 border-t border-white/10 flex justify-end">
              <button onClick={() => setIsSettingsOpen(false)} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 active:scale-95">저장 후 닫기</button>
            </div>
          </div>
        </div>
      )}
      
      <aside className={`fixed md:relative z-40 h-full glass border-r border-white/10 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'}`}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-6 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20"><Sparkles className="text-white" size={20} /></div>
            {isSidebarOpen && <span className="font-bold text-xl bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">AI 스튜디오</span>}
          </div>
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-1">
            {tools.map((tool) => (
              <SidebarItem key={tool.id} icon={tool.icon} label={isSidebarOpen ? tool.label : ''} active={activeTab === tool.id} onClick={() => setActiveTab(tool.id)} />
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="flex glass border-b border-white/10 p-4 items-center justify-between px-6 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-xl transition-all"><Menu size={20} /></button>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white">{currentTool?.label}</h1>
              <p className="text-[10px] md:text-xs text-gray-400 font-medium tracking-wider">{currentTool?.desc}</p>
            </div>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all relative">
            <Settings size={20} className="text-gray-400" />
            {(apiStatus !== 'success' || verifiedEngine !== aiEngine) && <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto h-full grid grid-cols-1 xl:grid-cols-2 gap-8 pb-12">
            <div className="glass rounded-3xl border border-white/10 flex flex-col overflow-hidden shadow-2xl h-fit max-h-full transition-all duration-500 hover:border-white/20 relative">
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                {(activeTab === ToolId.VirtualModelFitting || activeTab === ToolId.ItemSynthesis) ? (
                  <div className="space-y-8">
                    {activeTab === ToolId.ItemSynthesis && <ImageUpload label="인물 사진" onImageSelect={setImage1} selectedImage={image1} />}
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest">아이템 사진</label>
                      <button onClick={addImageSlot} className="text-[10px] font-bold bg-indigo-600/20 text-indigo-400 px-4 py-2 rounded-full uppercase">+ 추가</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {itemImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <ImageUpload label={`아이템 ${idx+1}`} onImageSelect={f => updateItemImage(idx, f)} selectedImage={img} className="h-40" />
                          {itemImages.length > 1 && <button onClick={() => removeImageSlot(idx)} className="absolute top-10 right-2 p-2 bg-red-500/80 rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {activeTab === ToolId.FutureBaby ? (
                      <div className="space-y-8">
                        <div className="grid grid-cols-2 gap-4">
                          <ImageUpload label="부모 1" onImageSelect={setImage1} selectedImage={image1} className="h-48" />
                          <ImageUpload label="부모 2" onImageSelect={setImage2} selectedImage={image2} className="h-48" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {['아들', '딸'].map(g => (
                            <button key={g} onClick={() => setOption(g)} className={`p-4 rounded-2xl border-2 transition-all font-bold ${option === g ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-gray-400'}`}>{g}</button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <ImageUpload label={activeTab === ToolId.PersonaChat ? "캐릭터 프로필" : "이미지 업로드"} onImageSelect={setImage1} selectedImage={image1} />
                        {(activeTab === ToolId.MagicEditor || activeTab === ToolId.AdPosterMaker) && (
                          <textarea className="w-full bg-black/40 border-2 border-white/5 rounded-2xl p-4 text-sm focus:border-indigo-500 outline-none transition-all min-h-[120px]" placeholder="명령을 입력하세요..." value={prompt} onChange={e => setPrompt(e.target.value)} />
                        )}
                        {(activeTab === ToolId.IDPhotoMaker || activeTab === ToolId.TimeTraveler) && (
                          <div className="grid grid-cols-2 gap-4">
                            {['여성', '남성'].map(g => (
                              <button key={g} onClick={() => setOption(g)} className={`p-4 rounded-2xl border-2 transition-all font-bold ${option === g ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/5 text-gray-400'}`}>{g}</button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {generationError && (
                <div className="mx-6 mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 animate-in slide-in-from-bottom-2">
                  <AlertCircle className="text-red-500 shrink-0" size={18} />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-tighter">생성 실패 (할당량 제한)</p>
                    <p className="text-[11px] text-red-400/90 leading-relaxed">{generationError}</p>
                  </div>
                </div>
              )}

              <div className="p-6 md:p-8 border-t border-white/5 bg-black/20 shrink-0">
                {activeTab !== ToolId.PersonaChat && <button onClick={handleGenerate} disabled={loading} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98]">{loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}{loading ? '생성 중...' : 'AI 생성하기'}</button>}
              </div>
            </div>

            <div className="flex flex-col h-full min-h-[500px]">
              {activeTab === ToolId.PersonaChat ? (
                <div className="glass rounded-3xl border border-white/10 flex flex-col h-full shadow-2xl overflow-hidden bg-black/20">
                   <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 overflow-hidden">{characterAvatarUrl ? <img src={characterAvatarUrl} alt="C" className="w-full h-full object-cover" /> : <MessageSquare size={24} className="text-indigo-400" />}</div>
                       <div><span className="font-bold text-sm block text-white">AI 페르소나</span><span className="text-[10px] text-green-500 font-bold mt-0.5">Online</span></div>
                     </div>
                     <button onClick={resetTool} className="p-2 hover:bg-white/5 rounded-xl text-gray-400 transition-all"><RefreshCw size={16} /></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/30">
                     {messages.map(m => (
                       <div key={m.id} className={`flex items-start gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                         <div className={`px-5 py-3 rounded-2xl text-sm max-w-[85%] break-words shadow-xl ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/10 text-gray-100 rounded-tl-none border border-white/5'}`}>{m.text}</div>
                       </div>
                     ))}
                   </div>
                   <div className="p-6 border-t border-white/10 flex gap-3 bg-black/50 backdrop-blur-2xl">
                     <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 outline-none transition-all" placeholder="메시지를 입력하세요..." />
                     <button onClick={handleChatSend} className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-lg active:scale-90 flex items-center justify-center"><Send size={20} /></button>
                   </div>
                </div>
              ) : result ? (
                <ResultDisplay imageUrl={result} title={currentTool?.label || ""} onReset={() => setResult(null)} />
              ) : (
                <div className="glass rounded-3xl border border-white/10 flex-1 flex flex-col items-center justify-center text-center p-12 bg-black/10 border-dashed">
                   <div className="w-28 h-28 bg-indigo-600/10 rounded-full flex items-center justify-center mb-8 border-2 border-indigo-600/20">{currentTool && <currentTool.icon className="text-indigo-400" size={56} />}</div>
                   <h2 className="text-2xl font-bold mb-4 text-white">생성 준비 완료</h2>
                   <p className="text-gray-400 text-sm max-w-[320px] leading-relaxed">사진을 업로드하고 버튼을 누르면 AI가 작업을 시작합니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
