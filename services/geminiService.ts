
import { GoogleGenAI, Type } from "@google/genai";
import { MediaType, AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeUrls = async (urls: string[]): Promise<AnalysisResult[]> => {
  if (urls.length === 0) return [];

  const prompt = `分析以下網址並判斷它們是否為圖片、影片或文件（PDF/PPTX）的直接連結。
  
  特別要求：
  1. 對於影片檔案（VIDEO），必須確保建議的檔名（suggestedFilename）以 .mov 結尾，這是為了確保 Apple QuickTime Player 的最高相容性。
  2. 如果原檔名是其他影片格式（如 .mp4, .webm），請將其副檔名改為 .mov。
  3. 保持原檔名的主體部分，僅更換副檔名。
  
  網址列表：
  ${urls.join('\n')}
  
  請回傳結構化的 JSON 陣列。`;

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
    return urls.map(url => {
      const ext = url.split('.').pop()?.toLowerCase() || '';
      let type = MediaType.OTHER;
      let suggestedExt = ext;

      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        type = MediaType.IMAGE;
      } else if (['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(ext)) {
        type = MediaType.VIDEO;
        suggestedExt = 'mov'; // 強制 QuickTime 相容
      } else if (['pdf', 'pptx', 'doc', 'docx'].includes(ext)) {
        type = MediaType.DOCUMENT;
      }

      const baseName = url.split('/').pop()?.split('.')[0] || 'file';
      return {
        url,
        type,
        suggestedFilename: `${baseName}.${suggestedExt}`,
        isDirectLink: true
      };
    });
  }
};
