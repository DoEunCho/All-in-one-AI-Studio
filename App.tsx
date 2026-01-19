
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
  Key,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Zap,
  HelpCircle,
  UserCheck
} from 'lucide-react';
import { ToolId, Message } from './types';
import ImageUpload from './components/ImageUpload';
import LoadingOverlay from './components/LoadingOverlay';
import ResultDisplay from './components/ResultDisplay';
import { GoogleGenAI } from "@google/genai";

// TypeScript 전역 선언을 통한 빌드 오류 방지
// window.aistudio가 이미 환경에 정의되어 있으므로 readonly 수식어와 함께 올바른 구조로 병합합니다.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
    }
  }
  interface Window {
    readonly aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
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
    const checkInitialKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey && !process.env.API_KEY) {
          setIsSettingsOpen(true);
        } else if (hasKey || process.env.API_KEY) {
          setApiStatus('success');
        }
      }
    };
    checkInitialKey();
  }, []);

  const handleOpenKeySelect = async () => {
    try {
      if (window.aistudio?.openSelectKey) {
        await window.aistudio.openSelectKey();
        setApiStatus('success');
        setIsSettingsOpen(false);
      }
    } catch (err) {
      console.error("키 선택 창 열기 실패:", err);
    }
  };

  const handleTestConnection = async () => {
    setApiStatus('testing');
    try {
      // API 키 상태 변경에 대응하기 위해 호출 직전에 인스턴스 생성
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'ping',
      });
      if (response.text) {
        setApiStatus('success');
      }
    } catch (err: any) {
      setApiStatus('error');
      if (err.message?.includes("not found")) {
        alert("선택된 프로젝트가 유효하지 않습니다. 다시 키를 선택해 주세요.");
        handleOpenKeySelect();
      }
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
          const MAX_DIM = 1536;
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
    if (!process.env.API_KEY) { setIsSettingsOpen(true); return; }

    setLoading(true);
    try {
      // API 호출 직전에 새 인스턴스 생성 (최신 키 반영 목적)
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        config: { imageConfig: { aspectRatio: "3:4", imageSize: "1K" } }
      });

      const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        setResult(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
      } else {
        alert("생성 결과가 없습니다. 무료 프로젝트라면 'Flash' 모드를 사용하세요.");
      }
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("Requested entity was not found") || error.message?.includes("not found")) {
        alert("프로젝트를 찾을 수 없습니다. 다시 키를 선택해 주세요.");
        setIsSettingsOpen(true);
      } else {
        alert(`생성 중 오류 발생: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || !process.env.API_KEY) { if (!process.env.API_KEY) setIsSettingsOpen(true); return; }
    
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: chatInput, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput; setChatInput("");
    
    try {
      // API 호출 직전에 새 인스턴스 생성
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];
      if (image1) parts.push(await fileToPart(image1));
      parts.push({ text: `Reply to: ${currentInput}` });
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts } });
      const aiMsg: Message = { id: (Date.now() + 1).toString(), sender: 'ai', text: response.text || "...", timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) { 
      setMessages(prev => [...prev, { id: 'err', sender: 'ai', text: "메시지 전송 오류가 발생했습니다.", timestamp: new Date() }]);
    }
  };

  const resetTool = useCallback(() => {
    setResult(null); setImage1(null); setImage2(null); setItemImages([null]); setPrompt(""); setOption("");
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
                <h2 className="font-bold text-lg">개별 사용자 API 설정</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all"><X size={20} className="text-gray-400" /></button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar max-h-[75vh]">
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-2xl space-y-4">
                <div className="flex gap-3">
                  <UserCheck size={20} className="text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">사용자님의 API 키로 직접 실행합니다</p>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                      이 앱은 서버에 키를 저장하지 않습니다. 구글 보안 팝업을 통해 자신의 프로젝트 키를 선택하면 안전하게 AI 도구를 사용할 수 있습니다.
                      결제 관련 정보는 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline inline-flex items-center gap-1">여기<ExternalLink size={10} /></a>에서 확인 가능합니다.
                    </p>
                  </div>
                </div>
                
                <div className="grid gap-3">
                  <button 
                    onClick={handleOpenKeySelect} 
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                  >
                    <Key size={18} /> 내 API 키 선택/가져오기
                  </button>
                  <p className="text-[10px] text-center text-gray-500">※ 팝업에서 "결제 수단이 등록된 프로젝트"를 선택해야 고성능 모델(Pro)이 작동합니다.</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">AI 이미지 엔진 선택</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAiEngine('flash')} className={`p-4 rounded-2xl border-2 flex flex-col gap-2 transition-all text-left ${aiEngine === 'flash' ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-600/10' : 'bg-white/5 border-white/5 hover:bg-white/10 opacity-60'}`}>
                    <div className="flex items-center justify-between"><Zap size={18} className={aiEngine === 'flash' ? 'text-indigo-400' : 'text-gray-500'} />{aiEngine === 'flash' && <CheckCircle2 size={14} className="text-indigo-400" />}</div>
                    <span className="font-bold text-sm">무료 모드 (Flash)</span>
                    <span className="text-[10px] text-gray-400 leading-tight">무료 등급 프로젝트용.</span>
                  </button>
                  <button onClick={() => setAiEngine('pro')} className={`p-4 rounded-2xl border-2 flex flex-col gap-2 transition-all text-left ${aiEngine === 'pro' ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-600/10' : 'bg-white/5 border-white/5 hover:bg-white/10 opacity-60'}`}>
                    <div className="flex items-center justify-between"><Cpu size={18} className={aiEngine === 'pro' ? 'text-indigo-400' : 'text-gray-500'} />{aiEngine === 'pro' && <CheckCircle2 size={14} className="text-indigo-400" />}</div>
                    <span className="font-bold text-sm">프로 모드 (Pro)</span>
                    <span className="text-[10px] text-gray-400 leading-tight">유료 결제 프로젝트용.</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  {apiStatus === 'success' ? <ShieldCheck size={14} className="text-green-500" /> : <ShieldAlert size={14} className="text-gray-500" />}
                  <span className={`text-[10px] font-bold uppercase tracking-tighter ${apiStatus === 'success' ? 'text-green-500' : 'text-gray-500'}`}>{apiStatus === 'success' ? 'API 감지됨' : '키 선택 필요'}</span>
                </div>
                <button onClick={handleTestConnection} disabled={apiStatus === 'testing'} className="text-[10px] font-bold text-indigo-400 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1.5">
                  {apiStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 연결 테스트
                </button>
              </div>
            </div>

            <div className="p-6 bg-black/20 border-t border-white/10 flex justify-end gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95">설정 완료 후 시작하기</button>
            </div>
          </div>
        </div>
      )}
      
      <aside className={`fixed md:relative z-40 h-full glass border-r border-white/10 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0 -translate-x-full md:w-20 md:translate-x-0'}`}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-6 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20"><Sparkles className="text-white" size={20} /></div>
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
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-xl transition-all active:scale-95"><Menu size={20} /></button>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white">{currentTool?.label}</h1>
              <p className="text-[10px] md:text-xs text-gray-400 font-medium uppercase tracking-wider">{currentTool?.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-full shadow-sm">
              {aiEngine === 'flash' ? <Zap size={12} className="text-indigo-400" /> : <Cpu size={12} className="text-amber-400" />}
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${aiEngine === 'flash' ? 'text-indigo-400' : 'text-amber-400'}`}>
                {aiEngine === 'flash' ? 'Flash Mode' : 'Pro Mode'}
              </span>
            </div>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-95 group">
              <Settings size={20} className="text-gray-400 group-hover:text-white group-hover:rotate-45 transition-all" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto h-full grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-12 pb-12">
            <div className="glass rounded-3xl border border-white/10 flex flex-col overflow-hidden shadow-2xl h-fit max-h-full transition-all duration-500 hover:border-white/20">
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                {(activeTab === ToolId.VirtualModelFitting || activeTab === ToolId.ItemSynthesis) ? (
                  <div className="space-y-8">
                    {activeTab === ToolId.ItemSynthesis && <ImageUpload label="인물 사진" onImageSelect={setImage1} selectedImage={image1} />}
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest">아이템 사진</label>
                      <button onClick={addImageSlot} className="text-[10px] font-bold bg-indigo-600/20 text-indigo-400 border border-indigo-400/30 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-full transition-all uppercase">+ 추가</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {itemImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <ImageUpload label={`아이템 ${idx+1}`} onImageSelect={f => updateItemImage(idx, f)} selectedImage={img} className="h-40" />
                          {itemImages.length > 1 && <button onClick={() => removeImageSlot(idx)} className="absolute top-10 right-2 p-2 bg-red-500/80 backdrop-blur-md hover:bg-red-600 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-90"><Trash2 size={12} /></button>}
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
                            <button key={g} onClick={() => setOption(g)} className={`p-4 rounded-2xl border-2 transition-all font-bold ${option === g ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/20 text-white' : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400'}`}>{g}</button>
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
                              <button key={g} onClick={() => setOption(g)} className={`p-4 rounded-2xl border-2 transition-all font-bold ${option === g ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-400'}`}>{g}</button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 md:p-8 border-t border-white/5 bg-black/20 shrink-0">
                {activeTab !== ToolId.PersonaChat && <button onClick={handleGenerate} disabled={loading} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] group">{loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}{loading ? '분석 중...' : 'AI 생성하기'}</button>}
              </div>
            </div>

            <div className="flex flex-col h-full min-h-[500px]">
              {activeTab === ToolId.PersonaChat ? (
                <div className="glass rounded-3xl border border-white/10 flex flex-col h-full shadow-2xl overflow-hidden bg-black/20 relative group hover:border-white/20 transition-all duration-500">
                   <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-xl">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 overflow-hidden shadow-inner">{characterAvatarUrl ? <img src={characterAvatarUrl} alt="C" className="w-full h-full object-cover" /> : <MessageSquare size={24} className="text-indigo-400" />}</div>
                       <div><span className="font-bold text-sm block text-white">AI 페르소나</span><span className="text-[10px] text-green-500 font-bold uppercase tracking-widest mt-0.5">Online</span></div>
                     </div>
                     <button onClick={resetTool} className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all"><RefreshCw size={16} /></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/30">
                     {messages.map(m => (
                       <div key={m.id} className={`flex items-start gap-3 ${m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                         <div className={`px-5 py-3 rounded-2xl text-sm max-w-[85%] break-words shadow-xl ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/10 text-gray-100 rounded-tl-none border border-white/5'}`}>{m.text}</div>
                       </div>
                     ))}
                   </div>
                   <div className="p-6 border-t border-white/10 flex gap-3 bg-black/50 backdrop-blur-2xl">
                     <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-gray-600" placeholder="메시지를 입력하세요..." />
                     <button onClick={handleChatSend} className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-lg active:scale-90 flex items-center justify-center"><Send size={20} /></button>
                   </div>
                </div>
              ) : result ? (
                <ResultDisplay imageUrl={result} title={currentTool?.label || ""} onReset={() => setResult(null)} />
              ) : (
                <div className="glass rounded-3xl border border-white/10 flex-1 flex flex-col items-center justify-center text-center p-12 bg-black/10 border-dashed">
                   <div className="w-28 h-28 bg-indigo-600/10 rounded-full flex items-center justify-center mb-8 border-2 border-indigo-600/20 animate-pulse">{currentTool && <currentTool.icon className="text-indigo-400" size={56} />}</div>
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
