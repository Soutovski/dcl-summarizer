"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ManualFetch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const router = useRouter();

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Calls the same cron route that Vercel uses, optionally with a date
      const url = selectedDate ? `/api/cron/fetch?date=${selectedDate}` : '/api/cron/fetch';
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success || data.summary) {
        setSuccess(true);
        // Refresh the page to show the new data
        router.refresh();
      } else {
        // Could be that the summary already exists (which isn't really an error)
        if (data.error && data.error.includes("already exists")) {
            setSuccess(true);
        } else {
            setError(data.error || "Ocorreu um erro ao buscar o DCL.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 backdrop-blur-xl mb-12 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h3 className="text-xl font-bold text-neutral-100">Atualização Manual</h3>
        <p className="text-neutral-400 text-sm mt-1">
          O sistema busca novos diários automaticamente todo dia de manhã. Se desejar, force a busca do diário mais recente agora.
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-neutral-800 text-neutral-200 border border-neutral-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors"
        />
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={handleFetch}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold py-3 px-6 rounded-full transition-colors whitespace-nowrap"
          >
            {loading ? "Buscando e Resumindo..." : "Buscar DCL"}
          </button>
          {error && <span className="text-red-400 text-sm font-medium">{error}</span>}
          {success && <span className="text-emerald-400 text-sm font-medium">Busca finalizada com sucesso!</span>}
        </div>
      </div>
    </div>
  );
}
