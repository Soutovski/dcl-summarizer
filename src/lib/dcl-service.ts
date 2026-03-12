import * as cheerio from "cheerio";
import PDFParser from "pdf2json";
import { GoogleGenAI } from "@google/genai";
import { DateTime } from "luxon";
import prisma from "./prisma";

// Initialize Gemini
// This requires GEMINI_API_KEY to be set in the environment variables
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const CLDF_DCL_URL = "https://www.cl.df.gov.br/diario-da-camara-legislativa";

export async function fetchDailyDCL() {
  console.log("Fetching CLDF DCL Page...");
  const response = await fetch(CLDF_DCL_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch CLDF website: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Find the exact 'Visualizar' link
  const vizLink = $("a").filter((i, el) => $(el).text().trim() === "Visualizar").first();
  let pdfUrl = vizLink.attr("href");

  if (!pdfUrl) {
    throw new Error("Could not extract PDF URL from the page.");
  }

  // Ensure absolute URL
  if (pdfUrl.startsWith("/")) {
    pdfUrl = `https://www.cl.df.gov.br${pdfUrl}`;
  }

  console.log("Found PDF URL:", pdfUrl);

  // Use today's date (Brasilia time)
  const today = DateTime.now().setZone("America/Sao_Paulo").startOf("day").toJSDate();

  // Check if we already have this summary
  const existingSummary = await prisma.dailySummary.findUnique({
    where: { date: today },
  });

  if (existingSummary) {
    console.log("Summary for today already exists. Skipping.");
    return existingSummary;
  }

  console.log("Downloading PDF...");
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Failed to download PDF: ${pdfResponse.statusText}`);
  }

  const arrayBuffer = await pdfResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log("Parsing PDF...");

  const rawText = await new Promise<string>((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      const text = pdfParser.getRawTextContent();
      resolve(text);
    });
    
    pdfParser.parseBuffer(buffer);
  });

  if (!rawText || rawText.trim() === "") {
    throw new Error("Extracted PDF text is empty.");
  }

  console.log("Got PDF text. Length:", rawText.length);
  
  // Truncate to avoid huge limits if needed (Gemini Flash has 1M context so we're fine usually)
  // Let's summarize using Gemini
  console.log("Summarizing with Gemini AI...");
  const summaryResult = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Você é um assessor legislativo especialista. O texto abaixo é o extrato cru do Diário da Câmara Legislativa do Distrito Federal (DCL). 
Por favor, analise a publicação do DCL de hoje e faça um resumo executivo abrangente em português. 

O resumo deve:
1. Começar com uma breve sinopse (1 parágrafo) do dia.
2. Destacar as principais aprovações de leis (Projetos de Lei, Emendas).
3. Listar nomeações ou exonerações importantes.
4. Listar decretos ou atos da Mesa Diretora relevantes.
5. Ser muito bem formatado em Markdown, pronto para ser lido por cidadãos em um webapp.
6. Não usar jargão excessivamente denso, facilitando o entendimento.

Texto do DCL:
${rawText}`
  });

  const summary = summaryResult.text || "Não foi possível gerar um resumo claro.";

  console.log("Summary generated. Saving to database...");

  const savedRecord = await prisma.dailySummary.create({
    data: {
      date: today,
      pdfUrl,
      rawText,
      summary,
    },
  });

  console.log("Process complete!");
  return savedRecord;
}
