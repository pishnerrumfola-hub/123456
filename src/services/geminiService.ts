import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function recognizeQuestion(base64Image: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1],
              mimeType: "image/png",
            },
          },
          {
            text: `请识别图片中的错题。提取题目文本、选项（如果有）、标准答案（如果有）。
            以 JSON 格式返回，包含字段：content (题目文本), options (数组), answer (标准答案)。
            如果某些信息不存在，请留空。`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.STRING },
        },
        required: ["content"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function extractKnowledgePoint(questionContent: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `分析以下题目，提取其核心知识点（如“一元二次方程根的判别式”、“现在完成时”等）。
    只返回知识点名称，不要有多余文字。
    题目：${questionContent}`,
  });

  return response.text.trim();
}

export async function generateSimilarQuestions(questionContent: string, knowledgePoint: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `基于知识点“${knowledgePoint}”，为以下原题生成 3 道“举一反三”的变式题。
    原题：${questionContent}
    
    要求：
    1. 覆盖同一知识点的不同角度或变换形式。
    2. 难度与原题相当或略高。
    3. 每道题包含：题目内容 (content)、选项 (options, 可选)、正确答案 (answer)、解析 (analysis)、易错点分析 (commonPitfalls)。
    
    以 JSON 数组格式返回。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING },
            analysis: { type: Type.STRING },
            commonPitfalls: { type: Type.STRING },
          },
          required: ["content", "answer", "analysis", "commonPitfalls"],
        },
      },
    },
  });

  return JSON.parse(response.text) as Question[];
}
