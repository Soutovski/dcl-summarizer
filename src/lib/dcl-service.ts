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

export async function fetchDailyDCL(dateParam?: string | null) {
  let pdfUrl = "";
  let dclDate = DateTime.now().setZone("America/Sao_Paulo").startOf("day").toJSDate();

  if (dateParam) {
    console.log(`Fetching historical DCL directly for date: ${dateParam}...`);
    // dateParam is assumed to be YYYY-MM-DD
    const parts = dateParam.split('-');
    if (parts.length === 3) {
      dclDate = DateTime.fromObject({ year: parseInt(parts[0]), month: parseInt(parts[1]), day: parseInt(parts[2]) }, { zone: "America/Sao_Paulo" }).startOf("day").toJSDate();
    }
    
    // Check if we already have this summary before querying google
    const existingSummary = await prisma.dailySummary.findUnique({
      where: { date: dclDate },
    });

    if (existingSummary) {
      console.log("Summary for this historical date already exists. Skipping.");
      return existingSummary;
    }

    // Prepare search query
    // Prepare search query
    // Example: "DCL nº * de 10 de março de 2026" ext:pdf site:cl.df.gov.br
    const monthsNameMap = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const monthNameStr = monthsNameMap[dclDate.getMonth() + 1];
    const queryDateStr = `${dclDate.getDate()} de ${monthNameStr} de ${dclDate.getFullYear()}`;
    const query = `"DCL" "${queryDateStr}" ext:pdf site:cl.df.gov.br/documents`;

    console.log("Google Custom Search Query:", query);

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_CX;

    if (!apiKey || !cx) {
      throw new Error("GOOGLE_SEARCH_API_KEY and GOOGLE_CX environment variables are required for historical searches.");
    }

    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=1`;
    const searchRes = await fetch(searchUrl);
    
    if (!searchRes.ok) {
       throw new Error(`Google Search API failed: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();

    if (!searchData.items || searchData.items.length === 0) {
      throw new Error(`No DCL found for date ${queryDateStr} on Google Search.`);
    }

    pdfUrl = searchData.items[0].link;
    console.log("Found Historical PDF URL via Google:", pdfUrl);

  } else {
    console.log("Fetching CLDF DCL Page for the latest release...");
  const response = await fetch(CLDF_DCL_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch CLDF website: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Find the exact 'Visualizar' link
  const vizLink = $("a").filter((i, el) => $(el).text().trim() === "Visualizar").first();
  pdfUrl = vizLink.attr("href") || "";

  if (!pdfUrl) {
    throw new Error("Could not extract PDF URL from the page.");
  }

  // Ensure absolute URL
  if (pdfUrl.startsWith("/")) {
    pdfUrl = `https://www.cl.df.gov.br${pdfUrl}`;
  }

  console.log("Found PDF URL:", pdfUrl);

    // Extract date from the PDF URL itself (CLDF uses divs, not table rows, so closest("tr") returns empty)
    // URL looks like: DCL+n%C2%BA+047%2C+de+12+de+mar%C3%A7o+de+2026.pdf
    const decodedUrl = decodeURIComponent(pdfUrl.replace(/\+/g, ' '));
    console.log("Decoded PDF URL:", decodedUrl);

    const dateMatch = decodedUrl.match(/de (\d{1,2}) de (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})/i);
    
    if (dateMatch) {
      const monthsMap: Record<string, number> = {
        janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6,
        julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
      };
      const day = parseInt(dateMatch[1], 10);
      const month = monthsMap[dateMatch[2].toLowerCase()];
      const year = parseInt(dateMatch[3], 10);
      
      // Create the date in local timezone
      dclDate = DateTime.fromObject({ year, month, day }, { zone: "America/Sao_Paulo" }).startOf("day").toJSDate();
      console.log("Parsed true DCL Date:", dclDate);
    } else {
      console.log("Could not parse date from URL, defaulting to today.");
    }
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
  
  // Truncate to stay within Gemini free tier token limits (250K tokens/min ≈ 200K chars)
  const MAX_TEXT_LENGTH = 200000;
  const textForSummary = rawText.length > MAX_TEXT_LENGTH 
    ? rawText.substring(0, MAX_TEXT_LENGTH) + "\n\n[TEXTO TRUNCADO PARA RESPEITAR LIMITE DE TOKENS]"
    : rawText;
  console.log("Text length for summary:", textForSummary.length);

  console.log("Summarizing with Gemini AI...");
  const summaryResult = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
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
${textForSummary}`
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
