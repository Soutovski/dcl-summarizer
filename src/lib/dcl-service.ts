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

  const rowText = vizLink.closest("tr").text().replace(/\s+/g, ' ').trim();
  console.log("Extracted row text:", rowText);

  // Extract date from text like "DCL nº 046, de 11 de março de 2026.pdf"
  const dateMatch = rowText.match(/de (\d{1,2}) de (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})/i);
  
  let dclDate = DateTime.now().setZone("America/Sao_Paulo").startOf("day").toJSDate();
  
  if (dateMatch) {
    const months: Record<string, number> = {
      janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6,
      julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
    };
    const day = parseInt(dateMatch[1], 10);
    const month = months[dateMatch[2].toLowerCase()];
    const year = parseInt(dateMatch[3], 10);
    
    // Create the date in local timezone
    dclDate = DateTime.fromObject({ year, month, day }, { zone: "America/Sao_Paulo" }).startOf("day").toJSDate();
    console.log("Parsed true DCL Date:", dclDate);
  } else {
    console.log("Could not parse date from text, defaulting to today.");
  }

  // Check if we already have this summary
  const existingSummary = await prisma.dailySummary.findUnique({
    where: { date: dclDate },
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
      date: dclDate,
      pdfUrl,
      rawText,
      summary,
    },
  });

  console.log("Process complete!");
  return savedRecord;
}
