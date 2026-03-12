import prisma from "@/lib/prisma";
import ReactMarkdown from 'react-markdown';
import { DateTime } from 'luxon';
import ManualFetch from './components/ManualFetch';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fetch all summaries from the database, ordered by latest date
  const summaries = await prisma.dailySummary.findMany({
    orderBy: {
      date: 'desc'
    }
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans p-6 sm:p-12">
      <main className="max-w-4xl mx-auto">
        <header className="mb-16 text-center sm:text-left">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent mb-4">
            DCL Resumido
          </h1>
          <p className="text-neutral-400 text-lg sm:text-xl font-medium max-w-2xl">
            Inteligência Artificial decifrando o Diário da Câmara Legislativa do Distrito Federal para você, todos os dias.
          </p>
        </header>

        <ManualFetch />

        {summaries.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Nenhum DCL processado ainda.</h2>
            <p className="text-neutral-500">
              O sistema fará a leitura do primeiro documento hoje. Você pode acionar o web scraper rodando 
              a rota `/api/cron/fetch`.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {summaries.map((summary) => (
              <article 
                key={summary.id} 
                className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 sm:p-10 backdrop-blur-xl transition-all hover:bg-neutral-900/80 hover:border-neutral-700"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    DCL do dia {DateTime.fromJSDate(summary.date).setZone('America/Sao_Paulo').toFormat('dd/MM/yyyy')}
                  </h2>
                  <a 
                    href={summary.pdfUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-emerald-400 bg-emerald-400/10 rounded-full hover:bg-emerald-400/20 transition-colors"
                  >
                    Ler DCL Original (PDF)
                  </a>
                </div>
                
                <div className="prose prose-invert prose-emerald max-w-none prose-p:leading-relaxed prose-headings:font-bold">
                  <ReactMarkdown>
                    {summary.summary}
                  </ReactMarkdown>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
