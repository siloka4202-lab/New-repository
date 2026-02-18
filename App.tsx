import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, GenerationStatus } from './types';
import { BookOpen, Download, Loader2, Sparkles, FileText, CheckCircle, GraduationCap, School } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Use a ref to track the polling interval so we can clear it easily
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  
  const [formData, setFormData] = useState<ProjectData>({
    topic: '',
    subject: 'Биология',
    grade: '9',
    pageCount: 5,
    difficulty: 3,
    hasPractical: false,
    hasHypothesis: true,
    sourceCount: 5,
    studentName: '',
    school: '',
    teacher: '',
    city: '',
    year: new Date().getFullYear().toString(),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value)
    }));
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const startPolling = (jobId: string) => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    
    pollInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/status/${jobId}`);
        if (!response.ok) return; // Retry next tick
        
        let data;
        try {
          data = await response.json();
        }catch {
          return; // если пустой ответ — просто ждём следующий polling
          }
        
        if (data.status === 'processing') {
          setProgress(data.progress);
          setStatusMessage(data.message);
        } else if (data.status === 'completed') {
          if (pollInterval.current) clearInterval(pollInterval.current);
          setProgress(100);
          setStatusMessage('Загрузка файла...');
          downloadResult(jobId);
        } else if (data.status === 'error') {
          if (pollInterval.current) clearInterval(pollInterval.current);
          setErrorMsg(data.error || 'Ошибка генерации');
          setStatus(GenerationStatus.ERROR);
        }
      } catch (err) {
        console.error("Polling error", err);
        // Continue polling in case of transient network error
      }
    }, 1000);
  };

  const downloadResult = async (jobId: string) => {
     try {
        const res = await fetch(`/api/download/${jobId}`);
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        setStatus(GenerationStatus.COMPLETE);
     } catch (err) {
        console.error(err);
        setErrorMsg('Ошибка при скачивании файла');
        setStatus(GenerationStatus.ERROR);
     }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(GenerationStatus.GENERATING_TEXT);
    setProgress(0);
    setStatusMessage('Инициализация...');
    setErrorMsg('');

    try {
      // 1. Start Job
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
  let errText;
  try {
    const errData = await response.json();
    errText = errData.error;
  } catch {
    errText = "Ошибка запуска генерации";
  }
  throw new Error(errText);
}

let jobId;
try {
  const data = await response.json();
  jobId = data.jobId;
} catch {
  throw new Error("Неверный ответ от сервера");
}


      // 2. Start Polling
      startPolling(jobId);

    } catch (err: any) {
      console.error(err);
      setStatus(GenerationStatus.ERROR);
      setErrorMsg(err.message || 'Что-то пошло не так. Убедитесь, что сервер запущен.');
    }
  };

  const resetForm = () => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    setStatus(GenerationStatus.IDLE);
    setPdfBlobUrl(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-18 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-indigo-600">
            <div className="bg-indigo-50 p-2 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">ScholarGen</h1>
          </div>
          <div className="text-sm font-medium text-gray-500 hidden sm:block bg-gray-100 px-3 py-1 rounded-full">
            AI Генератор школьных проектов
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-10">
        
        {status === GenerationStatus.IDLE && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white">
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-yellow-300" />
                Создать новый проект
              </h2>
              <p className="text-indigo-100 mt-2 text-lg">
                Заполните форму, и ИИ напишет структуру, текст и оформит всё в PDF по ГОСТу.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Academic Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-indigo-600 mb-2 border-b border-gray-100 pb-2">
                  <GraduationCap className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Параметры работы</h3>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Тема проекта</label>
                  <input
                    required
                    name="topic"
                    value={formData.topic}
                    onChange={handleChange}
                    placeholder="Например: Влияние музыки на рост растений"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition shadow-sm text-gray-900 placeholder-gray-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Предмет</label>
                    <div className="relative">
                      <select
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none text-gray-900 shadow-sm"
                      >
                        <option>Биология</option>
                        <option>История</option>
                        <option>Физика</option>
                        <option>Литература</option>
                        <option>География</option>
                        <option>Информатика</option>
                        <option>Химия</option>
                        <option>Обществознание</option>
                        <option>Математика</option>
                        <option>Английский язык</option>
                        <option>ОБЖ</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Класс</label>
                    <input
                      name="grade"
                      value={formData.grade}
                      onChange={handleChange}
                      placeholder="9 'А'"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-gray-900"
                    />
                  </div>
                </div>

                <div className="space-y-6 pt-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="font-medium text-gray-700">Количество страниц</label>
                      <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded text-xs">{formData.pageCount} стр.</span>
                    </div>
                    <input
                      type="range"
                      name="pageCount"
                      min="3"
                      max="20"
                      value={formData.pageCount}
                      onChange={handleRangeChange}
                      className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="font-medium text-gray-700">Уровень сложности</label>
                      <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded text-xs">{formData.difficulty}/5</span>
                    </div>
                    <input
                      type="range"
                      name="difficulty"
                      min="1"
                      max="5"
                      value={formData.difficulty}
                      onChange={handleRangeChange}
                      className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                   <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="font-medium text-gray-700">Количество источников</label>
                      <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded text-xs">{formData.sourceCount}</span>
                    </div>
                    <input
                      type="range"
                      name="sourceCount"
                      min="3"
                      max="10"
                      value={formData.sourceCount}
                      onChange={handleRangeChange}
                      className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        name="hasPractical"
                        checked={formData.hasPractical}
                        onChange={handleChange}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 shadow-sm transition-all checked:border-indigo-600 checked:bg-indigo-600 hover:border-indigo-400"
                      />
                       <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition">Практическая часть</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        name="hasHypothesis"
                        checked={formData.hasHypothesis}
                        onChange={handleChange}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-gray-300 shadow-sm transition-all checked:border-indigo-600 checked:bg-indigo-600 hover:border-indigo-400"
                      />
                      <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition">Гипотеза</span>
                  </label>
                </div>
              </div>

              {/* Personal Info */}
              <div className="space-y-6">
                 <div className="flex items-center gap-2 text-indigo-600 mb-2 border-b border-gray-100 pb-2">
                  <School className="w-5 h-5" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Титульный лист</h3>
                </div>
                 
                 <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">ФИО Ученика</label>
                  <input
                    required
                    name="studentName"
                    value={formData.studentName}
                    onChange={handleChange}
                    placeholder="Иванов Иван"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Название школы</label>
                  <input
                    required
                    name="school"
                    value={formData.school}
                    onChange={handleChange}
                    placeholder="МБОУ СОШ №1"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Учитель (Руководитель)</label>
                  <input
                    name="teacher"
                    value={formData.teacher}
                    onChange={handleChange}
                    placeholder="Петрова А.С."
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-gray-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Город</label>
                    <input
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Москва"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Год</label>
                    <input
                      name="year"
                      value={formData.year}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-gray-900"
                    />
                  </div>
                </div>

                <div className="pt-8 mt-auto">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-indigo-200 transition transform active:scale-[0.98] flex items-center justify-center gap-3 text-lg"
                  >
                    <Sparkles className="w-5 h-5" />
                    Создать проект
                  </button>
                  <p className="text-center text-xs text-gray-400 mt-3">
                    Генерация может занять до 30 секунд.
                  </p>
                </div>
              </div>
            </form>
          </div>
        )}

        {(status === GenerationStatus.GENERATING_TEXT || status === GenerationStatus.CONVERTING_PDF) && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
              <div className="relative bg-white p-4 rounded-full border-4 border-indigo-50">
                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Создаем ваш проект
            </h3>

            {/* Progress Bar */}
            <div className="w-full max-w-md bg-gray-100 rounded-full h-4 mb-3 overflow-hidden border border-gray-200 shadow-inner">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-4 rounded-full transition-all duration-500 ease-out shadow-sm" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between w-full max-w-md text-sm font-medium">
              <span className="text-gray-600 animate-pulse">{statusMessage}</span>
              <span className="text-indigo-600">{progress}%</span>
            </div>

            <p className="text-gray-400 max-w-sm mx-auto text-sm mt-8">
              Пожалуйста, не закрывайте вкладку. Это может занять около минуты.
            </p>
          </div>
        )}

        {status === GenerationStatus.ERROR && (
           <div className="bg-red-50 rounded-2xl shadow-lg border border-red-100 p-10 text-center flex flex-col items-center">
             <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <span className="text-red-500 text-4xl font-bold">!</span>
             </div>
             <h3 className="text-xl font-bold text-red-800 mb-2">Ошибка генерации</h3>
             <p className="text-red-600 mb-8 max-w-md">{errorMsg}</p>
             <button onClick={resetForm} className="px-6 py-3 bg-white border border-red-200 text-red-700 font-semibold rounded-lg hover:bg-red-50 transition shadow-sm">
               Попробовать снова
             </button>
           </div>
        )}

        {status === GenerationStatus.COMPLETE && pdfBlobUrl && (
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform transition-all duration-500 ease-out">
            <div className="bg-green-50 p-10 text-center border-b border-green-100">
               <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-green-50">
                 <CheckCircle className="w-10 h-10 text-green-600" />
               </div>
               <h2 className="text-3xl font-bold text-gray-800 mb-3">Проект готов!</h2>
               <p className="text-gray-600 text-lg">Ваш школьный проект успешно сгенерирован и отформатирован.</p>
            </div>
            
            <div className="p-10 flex flex-col items-center bg-white">
               <div className="bg-gray-100 p-6 rounded-2xl mb-10 border border-gray-200 shadow-inner">
                  <div className="w-40 h-56 bg-white shadow-lg border border-gray-200 flex flex-col items-center justify-center relative group cursor-default">
                      <div className="absolute top-0 right-0 w-8 h-8 bg-gray-50 border-b border-l border-gray-200"></div>
                      <FileText className="w-16 h-16 text-indigo-300 group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-[10px] text-gray-400 mt-4 font-medium tracking-widest">PDF PREVIEW</span>
                  </div>
               </div>

               <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                 <button 
                  onClick={resetForm}
                  className="flex-1 py-4 px-6 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:bg-gray-50 hover:border-gray-300 transition text-center"
                 >
                   Создать еще
                 </button>
                 <a 
                   href={pdfBlobUrl} 
                   download={`${formData.topic.replace(/\s+/g, '_')}_Проект.pdf`}
                   className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2"
                 >
                   <Download className="w-5 h-5" />
                   Скачать PDF
                 </a>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}