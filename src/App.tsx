import { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  BookOpen, 
  Upload, 
  Trash2, 
  Printer, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  Plus, 
  RefreshCw,
  X,
  FileText,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { Question, WrongQuestionRecord, TabType } from './types';
import { recognizeQuestion, extractKnowledgePoint, generateSimilarQuestions } from './services/geminiService';
import { cn } from './lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('recognition');
  const [records, setRecords] = useState<WrongQuestionRecord[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [currentOcrResult, setCurrentOcrResult] = useState<Partial<Question> | null>(null);
  const [currentKnowledgePoint, setCurrentKnowledgePoint] = useState<string>('');
  const [currentSimilarQuestions, setCurrentSimilarQuestions] = useState<Question[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  // Load records from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wrong_questions_notebook');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load records', e);
      }
    }
  }, []);

  // Save records to localStorage
  useEffect(() => {
    localStorage.setItem('wrong_questions_notebook', JSON.stringify(records));
  }, [records]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    setCurrentOcrResult(null);
    setCurrentKnowledgePoint('');
    setCurrentSimilarQuestions([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const result = await recognizeQuestion(base64);
        setCurrentOcrResult(result);
        const kp = await extractKnowledgePoint(result.content);
        setCurrentKnowledgePoint(kp);
      } catch (error) {
        console.error('OCR failed', error);
      } finally {
        setIsOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateSimilar = async () => {
    if (!currentOcrResult?.content || !currentKnowledgePoint) return;
    setIsGenerating(true);
    try {
      const questions = await generateSimilarQuestions(currentOcrResult.content, currentKnowledgePoint);
      setCurrentSimilarQuestions(questions);
    } catch (error) {
      console.error('Generation failed', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveRecord = () => {
    if (!currentOcrResult?.content || currentSimilarQuestions.length === 0) return;
    
    const newRecord: WrongQuestionRecord = {
      id: crypto.randomUUID(),
      originalQuestion: {
        id: crypto.randomUUID(),
        content: currentOcrResult.content,
        options: currentOcrResult.options,
        answer: currentOcrResult.answer,
      },
      knowledgePoint: currentKnowledgePoint,
      similarQuestions: currentSimilarQuestions,
      createdAt: Date.now(),
    };

    setRecords([newRecord, ...records]);
    setCurrentOcrResult(null);
    setCurrentKnowledgePoint('');
    setCurrentSimilarQuestions([]);
    setActiveTab('notebook');
  };

  const deleteRecord = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
    setSelectedRecordIds(selectedRecordIds.filter(rid => rid !== id));
  };

  const toggleSelectRecord = (id: string) => {
    if (selectedRecordIds.includes(id)) {
      setSelectedRecordIds(selectedRecordIds.filter(rid => rid !== id));
    } else {
      setSelectedRecordIds([...selectedRecordIds, id]);
    }
  };

  const generatePDF = async () => {
    if (selectedRecordIds.length === 0) return;
    setIsPrinting(true);
    
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    try {
      const canvas = await html2canvas(printArea, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`错题本_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF generation failed', error);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            错题举一反三打印机
          </h1>
          {activeTab === 'notebook' && records.length > 0 && (
            <button 
              onClick={generatePDF}
              disabled={selectedRecordIds.length === 0 || isPrinting}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              打印所选 ({selectedRecordIds.length})
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto p-4">
          <AnimatePresence mode="wait">
            {activeTab === 'recognition' ? (
              <motion.div
                key="recognition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Upload Section */}
                <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center hover:border-indigo-300 transition-colors cursor-pointer relative group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold">上传错题图片</p>
                      <p className="text-sm text-slate-500">支持拍照或从相册选择</p>
                    </div>
                  </div>
                </div>

                {/* OCR & Result Section */}
                {(isOcrLoading || currentOcrResult) && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <h2 className="font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        识别结果
                      </h2>
                      {isOcrLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
                    </div>
                    <div className="p-4 space-y-4">
                      {isOcrLoading ? (
                        <div className="space-y-3 py-4">
                          <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4"></div>
                          <div className="h-4 bg-slate-100 rounded animate-pulse w-1/2"></div>
                          <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6"></div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">题目内容</label>
                            <textarea 
                              value={currentOcrResult?.content || ''} 
                              onChange={(e) => setCurrentOcrResult({...currentOcrResult, content: e.target.value})}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">知识点</label>
                              <input 
                                value={currentKnowledgePoint} 
                                onChange={(e) => setCurrentKnowledgePoint(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="正在提取..."
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">标准答案</label>
                              <input 
                                value={currentOcrResult?.answer || ''} 
                                onChange={(e) => setCurrentOcrResult({...currentOcrResult, answer: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                          
                          <button 
                            onClick={handleGenerateSimilar}
                            disabled={isGenerating || !currentOcrResult?.content}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                            生成举一反三 (3道题)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Similar Questions Section */}
                {(isGenerating || currentSimilarQuestions.length > 0) && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 px-1">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      举一反三变式题
                    </h2>
                    {isGenerating ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
                            <div className="h-4 bg-slate-100 rounded animate-pulse w-full"></div>
                            <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6"></div>
                            <div className="h-20 bg-slate-50 rounded animate-pulse w-full"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {currentSimilarQuestions.map((q, idx) => (
                          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-start justify-between">
                              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded">变式题 {idx + 1}</span>
                            </div>
                            <p className="text-slate-800 leading-relaxed">{q.content}</p>
                            <div className="bg-green-50 p-4 rounded-xl space-y-2">
                              <p className="text-sm font-bold text-green-800">【正确答案】</p>
                              <p className="text-sm text-green-700">{q.answer}</p>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-xl space-y-2">
                              <p className="text-sm font-bold text-amber-800">【易错点分析】</p>
                              <p className="text-sm text-amber-700 italic">{q.commonPitfalls}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-sm font-bold text-slate-800">【解析】</p>
                              <div className="text-sm text-slate-600 prose prose-slate max-w-none">
                                <ReactMarkdown>{q.analysis}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={saveRecord}
                          className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                        >
                          <Plus className="w-6 h-6" />
                          保存到错题本
                        </button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="notebook"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {records.length === 0 ? (
                  <div className="text-center py-20 space-y-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <History className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-600">错题本空空如也</p>
                      <p className="text-sm text-slate-400">快去识别第一道错题吧！</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('recognition')}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-full font-medium hover:bg-indigo-700"
                    >
                      去识别
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setSelectedRecordIds(selectedRecordIds.length === records.length ? [] : records.map(r => r.id))}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          {selectedRecordIds.length === records.length ? '取消全选' : '全选所有'}
                        </button>
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase">共 {records.length} 条记录</span>
                    </div>

                    {records.map(record => (
                      <div 
                        key={record.id}
                        className={cn(
                          "bg-white rounded-2xl border transition-all overflow-hidden group",
                          selectedRecordIds.includes(record.id) ? "border-indigo-500 ring-1 ring-indigo-500 shadow-md" : "border-slate-200 shadow-sm"
                        )}
                      >
                        <div className="p-4 flex items-start gap-4">
                          <div 
                            onClick={() => toggleSelectRecord(record.id)}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors mt-1 shrink-0",
                              selectedRecordIds.includes(record.id) ? "bg-indigo-600 border-indigo-600" : "border-slate-200 hover:border-indigo-300"
                            )}
                          >
                            {selectedRecordIds.includes(record.id) && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                {record.knowledgePoint}
                              </span>
                              <span className="text-[10px] text-slate-400">{new Date(record.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-800 font-medium line-clamp-2 text-sm">{record.originalQuestion.content}</p>
                            <div className="flex items-center gap-3 pt-2">
                              <button 
                                onClick={() => {/* TODO: View detail */}}
                                className="text-xs font-semibold text-indigo-600 flex items-center gap-1 hover:underline"
                              >
                                查看详情 <ChevronRight className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => deleteRecord(record.id)}
                                className="text-xs font-semibold text-red-500 flex items-center gap-1 hover:underline ml-auto"
                              >
                                <Trash2 className="w-3 h-3" /> 删除
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Hidden Print Area */}
      <div className="fixed left-[-9999px] top-0">
        <div id="print-area" className="w-[210mm] bg-white p-10 space-y-10">
          <h1 className="text-3xl font-bold text-center border-b-2 border-slate-900 pb-4">错题举一反三练习卷</h1>
          {records.filter(r => selectedRecordIds.includes(r.id)).map((record, idx) => (
            <div key={record.id} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="bg-slate-900 text-white px-3 py-1 rounded text-sm">题目 {idx + 1}</span>
                  知识点：{record.knowledgePoint}
                </h2>
                <div className="p-4 border-2 border-slate-200 rounded-lg">
                  <p className="font-bold mb-2">【原错题】</p>
                  <p>{record.originalQuestion.content}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 pl-6 border-l-4 border-slate-100">
                {record.similarQuestions.map((sq, sIdx) => (
                  <div key={sIdx} className="space-y-3">
                    <p className="font-bold">变式题 {sIdx + 1}：</p>
                    <p className="leading-relaxed">{sq.content}</p>
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-200 text-sm text-slate-600 space-y-2">
                      <p><span className="font-bold text-slate-900">答案：</span>{sq.answer}</p>
                      <p><span className="font-bold text-slate-900">易错点：</span>{sq.commonPitfalls}</p>
                      <div className="prose prose-sm max-w-none">
                        <span className="font-bold text-slate-900">解析：</span>
                        <ReactMarkdown>{sq.analysis}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {idx < selectedRecordIds.length - 1 && <div className="border-b border-slate-200 my-10"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-around py-3">
          <button 
            onClick={() => setActiveTab('recognition')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === 'recognition' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Camera className="w-6 h-6" />
            <span className="text-xs font-bold">错题识别</span>
          </button>
          <button 
            onClick={() => setActiveTab('notebook')}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === 'notebook' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <History className="w-6 h-6" />
            <span className="text-xs font-bold">错题本</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
