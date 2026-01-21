
import { GoogleGenAI, Type } from "@google/genai";
import { MediaType, AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeUrls = async (urls: string[]): Promise<AnalysisResult[]> => {
  if (urls.length === 0) return [];

  const prompt = `Analyze the following URLs and determine if they are direct links to images, videos, or documents (PDF/PPTX). 
  For each URL, suggest a filename and identify its media type.
  
  URLs to analyze:
  ${urls.join('\n')}
  
  Return a structured JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              url: { type: Type.STRING },
              type: { 
                type: Type.STRING, 
                enum: [MediaType.IMAGE, MediaType.VIDEO, MediaType.DOCUMENT, MediaType.OTHER] 
              },
              suggestedFilename: { type: Type.STRING },
              isDirectLink: { type: Type.BOOLEAN }
            },
            required: ["url", "type", "suggestedFilename", "isDirectLink"]
          }
        }
      }
    });

    const results = JSON.parse(response.text.trim());
    return results;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback if AI fails: basic regex/extension detection
    return urls.map(url => {
      const ext = url.split('.').pop()?.toLowerCase() || '';
      let type = MediaType.OTHER;
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) type = MediaType.IMAGE;
      else if (['mp4', 'mov', 'webm'].includes(ext)) type = MediaType.VIDEO;
      else if (['pdf', 'pptx', 'doc', 'docx'].includes(ext)) type = MediaType.DOCUMENT;

      return {
        url,
        type,
        suggestedFilename: url.split('/').pop() || 'file',
        isDirectLink: true
      };
    });
  }
};
